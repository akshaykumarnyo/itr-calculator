"""Streaming ITR Agent — LangGraph + Redis cache + SSE streaming"""
import json
from typing import TypedDict, List, Optional, AsyncGenerator
from langgraph.graph import StateGraph, END
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.schema import HumanMessage, SystemMessage, AIMessage
from app.core.config import settings
from app.services.vector_store import search_itr_knowledge
from app.services.cache_service import cache


class ITRAgentState(TypedDict):
    user_message: str
    chat_history: List[dict]
    retrieved_context: List[str]
    extracted_financial_data: Optional[dict]
    final_response: str
    needs_calculation: bool
    session_id: str


SYSTEM_PROMPT = """You are an expert Indian Income Tax (ITR) consultant and CA (Chartered Accountant).
You help users understand and calculate their income tax for Assessment Year 2024-25.

Cover: Old/New regime, salary, business, capital gains, 80C/80D/80E/80G/HRA/home loan, NPS.
Be conversational, precise with numbers, use Indian format (₹ lakhs/crores).
When numbers are mentioned, extract them and offer to calculate full tax.
Respond in markdown for formatting."""


def get_llm(streaming: bool = False):
    return ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        google_api_key=settings.GOOGLE_API_KEY,
        temperature=0.3,
        streaming=streaming,
    )


async def retrieve_context(state: ITRAgentState) -> ITRAgentState:
    query = state["user_message"]
    cached = cache.get_cached_vector_search(query)
    if cached:
        return {**state, "retrieved_context": cached}
    context = await search_itr_knowledge(query, k=3)
    cache.cache_vector_search(query, context)
    return {**state, "retrieved_context": context}


async def extract_financial_data(state: ITRAgentState) -> ITRAgentState:
    llm = get_llm()
    prompt = f"""Extract financial/tax data from this message. Return only JSON, no markdown.
If no numbers mentioned, return {{}}.
Message: {state['user_message']}
Keys (only if present): salary_income, business_income, capital_gains_short, capital_gains_long,
other_income, section_80c, section_80d, section_80e, section_80g, hra_exemption,
home_loan_interest, tds_paid, age, tax_regime"""
    try:
        r = await llm.ainvoke([HumanMessage(content=prompt)])
        t = r.content.strip().replace("```json", "").replace("```", "").strip()
        data = json.loads(t) if t and t != "{}" else None
    except Exception:
        data = None
    return {**state, "extracted_financial_data": data, "needs_calculation": bool(data)}


async def generate_response(state: ITRAgentState) -> ITRAgentState:
    llm = get_llm()
    messages = [SystemMessage(content=SYSTEM_PROMPT)]
    if state["retrieved_context"]:
        messages.append(HumanMessage(content="Tax knowledge:\n" + "\n\n".join(state["retrieved_context"])))
    for msg in state["chat_history"][-10:]:
        cls = HumanMessage if msg["role"] == "user" else AIMessage
        messages.append(cls(content=msg["content"]))
    content = state["user_message"]
    if state["extracted_financial_data"]:
        content += f"\n[Data detected: {state['extracted_financial_data']}. Acknowledge and offer full calculation.]"
    messages.append(HumanMessage(content=content))
    r = await llm.ainvoke(messages)
    return {**state, "final_response": r.content}


def build_itr_graph():
    wf = StateGraph(ITRAgentState)
    wf.add_node("retrieve", retrieve_context)
    wf.add_node("extract", extract_financial_data)
    wf.add_node("respond", generate_response)
    wf.set_entry_point("retrieve")
    wf.add_edge("retrieve", "extract")
    wf.add_edge("extract", "respond")
    wf.add_edge("respond", END)
    return wf.compile()


_agent = None


def get_itr_agent():
    global _agent
    if _agent is None:
        _agent = build_itr_graph()
    return _agent


# ── Streaming SSE ────────────────────────────────────────────────

async def stream_itr_response(
    user_message: str,
    chat_history: List[dict],
    session_id: str,
) -> AsyncGenerator[str, None]:
    """Stream response token-by-token as Server-Sent Events."""

    def sse(payload: dict) -> str:
        return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

    yield sse({"type": "status", "content": "🔍 Searching knowledge base…"})

    # Vector search with Redis cache
    cached_ctx = cache.get_cached_vector_search(user_message)
    if cached_ctx:
        context = cached_ctx
        yield sse({"type": "status", "content": "⚡ Cache hit — instant context"})
    else:
        context = await search_itr_knowledge(user_message, k=3)
        cache.cache_vector_search(user_message, context)
        yield sse({"type": "status", "content": "✓ Knowledge retrieved"})

    # Extract financial data
    yield sse({"type": "status", "content": "🧠 Analyzing your query…"})
    extracted_data = None
    try:
        llm_e = get_llm()
        ext_r = await llm_e.ainvoke([HumanMessage(
            content=f"Extract financial data as JSON only ({{}} if none).\n"
                    f"Message: {user_message}\n"
                    f"Keys: salary_income,section_80c,section_80d,hra_exemption,"
                    f"home_loan_interest,tds_paid,age,tax_regime"
        )])
        t = ext_r.content.strip().replace("```json", "").replace("```", "").strip()
        extracted_data = json.loads(t) if t and t != "{}" else None
    except Exception:
        extracted_data = None

    if extracted_data:
        yield sse({"type": "extracted", "content": extracted_data})

    # Build messages
    yield sse({"type": "status", "content": "✍️ Generating response…"})

    messages = [SystemMessage(content=SYSTEM_PROMPT)]
    if context:
        messages.append(HumanMessage(content="Tax knowledge:\n" + "\n\n".join(context)))

    # Pull history from Redis cache
    cached_history = cache.get_cached_chat_history(session_id) or chat_history
    for msg in cached_history[-8:]:
        cls = HumanMessage if msg["role"] == "user" else AIMessage
        messages.append(cls(content=msg["content"]))

    user_content = user_message
    if extracted_data:
        user_content += f"\n[Detected data: {extracted_data}. Acknowledge and offer to calculate.]"
    messages.append(HumanMessage(content=user_content))

    # Stream tokens
    llm_stream = get_llm(streaming=True)
    full_response = ""

    try:
        async for chunk in llm_stream.astream(messages):
            token = chunk.content
            if token:
                full_response += token
                yield sse({"type": "token", "content": token})
    except Exception as e:
        yield sse({"type": "error", "content": f"Error: {str(e)}"})
        return

    # Cache updated history
    updated = (cached_history or chat_history) + [
        {"role": "user", "content": user_message},
        {"role": "assistant", "content": full_response},
    ]
    cache.cache_chat_history(session_id, updated)

    yield sse({"type": "done", "content": full_response, "extracted_data": extracted_data})


async def run_itr_agent(user_message: str, chat_history: List[dict], session_id: str) -> dict:
    """Non-streaming fallback."""
    agent = get_itr_agent()
    result = await agent.ainvoke(ITRAgentState(
        user_message=user_message,
        chat_history=chat_history,
        retrieved_context=[],
        extracted_financial_data=None,
        final_response="",
        needs_calculation=False,
        session_id=session_id,
    ))
    return {
        "response": result["final_response"],
        "extracted_data": result["extracted_financial_data"],
        "needs_calculation": result["needs_calculation"],
    }


async def generate_ai_advice_for_calculation(data: dict) -> str:
    cache_key = f"itr:advice:{abs(hash(str(sorted(data.items()))))}"
    cached = cache.get(cache_key)
    if cached:
        return cached
    llm = get_llm()
    prompt = (f"Tax results for AY 2024-25:\n"
              f"Gross: ₹{data.get('gross_total_income',0):,.0f}, "
              f"Taxable: ₹{data.get('taxable_income',0):,.0f}, "
              f"Tax: ₹{data.get('total_tax',0):,.0f}, "
              f"Regime: {data.get('recommended_regime','old').upper()}, "
              f"Savings: ₹{data.get('regime_savings',0):,.0f}.\n"
              f"Give 2-3 lines of actionable personalized tax advice.")
    r = await llm.ainvoke([SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=prompt)])
    cache.set(cache_key, r.content, ttl_seconds=3600)
    return r.content
