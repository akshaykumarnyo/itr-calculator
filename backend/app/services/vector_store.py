"""
Vector Store Service - ChromaDB with SQLite backend
Stores Indian Income Tax knowledge for RAG
"""
import os
from typing import List
import chromadb
from chromadb.config import Settings as ChromaSettings
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.schema import Document
from app.core.config import settings

# ITR Knowledge Base
ITR_KNOWLEDGE = [
    # Section 80C
    Document(
        page_content="""Section 80C deductions allow investment up to ₹1,50,000 per year.
        Eligible investments include PPF (Public Provident Fund), ELSS (Equity Linked Savings Scheme),
        NSC (National Savings Certificate), Tax Saver FD, LIC premium, Employee PF contribution,
        SCSS (Senior Citizen Savings Scheme), Sukanya Samriddhi Yojana, tuition fees for children,
        home loan principal repayment.""",
        metadata={"section": "80C", "category": "deduction"}
    ),
    Document(
        page_content="""Section 80D allows deduction for health insurance premiums.
        For self, spouse and children: up to ₹25,000 (₹50,000 if senior citizen).
        For parents: additional ₹25,000 (₹50,000 if senior citizen parents).
        Maximum combined deduction: ₹1,00,000 if both taxpayer and parents are senior citizens.
        Preventive health checkup: ₹5,000 included within the limit.""",
        metadata={"section": "80D", "category": "deduction"}
    ),
    Document(
        page_content="""Section 80E provides deduction for education loan interest.
        Deduction available for interest paid on loan taken for higher education.
        No maximum limit on deduction amount.
        Available for 8 consecutive years from start of repayment.
        Loan must be taken from approved financial institution or charitable institution.
        Applicable for self, spouse, children or student for whom taxpayer is legal guardian.""",
        metadata={"section": "80E", "category": "deduction"}
    ),
    Document(
        page_content="""Section 80G provides deduction for donations to charitable institutions.
        100% deduction: PM Relief Fund, National Defence Fund, Clean Ganga Fund.
        50% deduction: Prime Minister's Drought Relief Fund, National Children's Fund.
        Donations above ₹2,000 must be made by non-cash mode.
        Qualifying amount is 10% of adjusted gross total income for some institutions.""",
        metadata={"section": "80G", "category": "deduction"}
    ),
    Document(
        page_content="""HRA (House Rent Allowance) exemption calculation:
        Minimum of: (1) Actual HRA received, (2) 50% of salary for metro cities or 40% for non-metro,
        (3) Actual rent paid minus 10% of salary.
        Metro cities: Delhi, Mumbai, Chennai, Kolkata.
        Rent receipt and landlord PAN required if annual rent exceeds ₹1,00,000.""",
        metadata={"section": "HRA", "category": "exemption"}
    ),
    Document(
        page_content="""Standard Deduction under Old Regime: ₹50,000 flat deduction for salaried employees.
        Standard Deduction under New Regime (from AY 2024-25): ₹75,000 for salaried employees.
        Available without any proof or documentation.
        Replaced earlier deductions for transport allowance and medical reimbursement.""",
        metadata={"section": "Standard Deduction", "category": "deduction"}
    ),
    Document(
        page_content="""New Tax Regime Slabs for AY 2024-25:
        ₹0 - ₹3,00,000: Nil tax
        ₹3,00,001 - ₹6,00,000: 5% tax
        ₹6,00,001 - ₹9,00,000: 10% tax
        ₹9,00,001 - ₹12,00,000: 15% tax
        ₹12,00,001 - ₹15,00,000: 20% tax
        Above ₹15,00,000: 30% tax
        Rebate u/s 87A: Tax nil if income up to ₹7,00,000 under new regime.""",
        metadata={"section": "New Regime Slabs", "category": "tax_slab"}
    ),
    Document(
        page_content="""Old Tax Regime Slabs for AY 2024-25 (Below 60 years):
        ₹0 - ₹2,50,000: Nil tax
        ₹2,50,001 - ₹5,00,000: 5% tax
        ₹5,00,001 - ₹10,00,000: 20% tax
        Above ₹10,00,000: 30% tax
        Rebate u/s 87A: Up to ₹12,500 if income up to ₹5,00,000.
        Senior citizens (60-79): Basic exemption ₹3,00,000.
        Super senior citizens (80+): Basic exemption ₹5,00,000.""",
        metadata={"section": "Old Regime Slabs", "category": "tax_slab"}
    ),
    Document(
        page_content="""Section 24(b) - Home Loan Interest Deduction:
        Self-occupied property: Maximum deduction ₹2,00,000 per year.
        Let-out property: No limit on interest deduction.
        Pre-construction interest: Deductible in 5 equal installments from year of completion.
        Under old regime only. Under new regime, this deduction is NOT available.""",
        metadata={"section": "24b", "category": "deduction"}
    ),
    Document(
        page_content="""Capital Gains Tax rates in India:
        Short Term Capital Gains (STCG) on equity/mutual funds: 20% (increased from 15% in Budget 2024).
        Long Term Capital Gains (LTCG) on equity/mutual funds above ₹1,25,000: 12.5% (increased from 10%).
        STCG on other assets: As per slab rates.
        LTCG on other assets (held > 24 months): 12.5% without indexation or 20% with indexation (pre-2024 rule changed).
        Debt mutual funds (purchased after April 2023): Taxed as per slab rates.""",
        metadata={"section": "Capital Gains", "category": "tax_type"}
    ),
    Document(
        page_content="""NPS (National Pension System) tax benefits:
        Section 80CCD(1): Contribution up to 10% of salary (within 80C limit of ₹1.5L).
        Section 80CCD(1B): Additional ₹50,000 deduction over and above 80C limit.
        Section 80CCD(2): Employer contribution up to 10% of salary - fully deductible.
        Available under Old Regime. Under new regime, only 80CCD(2) is available.""",
        metadata={"section": "NPS/80CCD", "category": "deduction"}
    ),
    Document(
        page_content="""Surcharge on Income Tax:
        Income > ₹50 lakh to ₹1 crore: 10% surcharge on tax.
        Income > ₹1 crore to ₹2 crore: 15% surcharge on tax.
        Income > ₹2 crore to ₹5 crore: 25% surcharge on tax.
        Income > ₹5 crore: 37% surcharge (25% under new regime).
        Health & Education Cess: 4% on (tax + surcharge).""",
        metadata={"section": "Surcharge", "category": "tax_component"}
    ),
    Document(
        page_content="""ITR Form Types:
        ITR-1 (Sahaj): Resident individuals with salary, one house property, other income up to ₹50L.
        ITR-2: Individuals/HUF with capital gains, multiple house properties, foreign income.
        ITR-3: Individuals/HUF with business/profession income.
        ITR-4 (Sugam): Presumptive income under 44AD, 44ADA, 44AE.
        ITR-5: Firms, LLPs, AOP.
        Due date: July 31 for non-audit cases. October 31 for audit cases.""",
        metadata={"section": "ITR Forms", "category": "compliance"}
    ),
    Document(
        page_content="""Section 80TTA and 80TTB:
        80TTA: Deduction up to ₹10,000 on interest from savings bank account (for non-senior citizens).
        80TTB: Senior citizens can claim ₹50,000 deduction on interest from all deposits (bank/post office).
        80TTB covers FD interest, savings interest, recurring deposit interest.
        80TTB is only available under Old Tax Regime.""",
        metadata={"section": "80TTA/80TTB", "category": "deduction"}
    ),
    Document(
        page_content="""Agriculture income in India is fully exempt from income tax under Section 10(1).
        However, if you have both agricultural and non-agricultural income, agricultural income
        is used for rate purposes (clubbed for calculating tax rate on non-agricultural income).
        Partial integration method applies when non-agricultural income exceeds basic exemption limit.""",
        metadata={"section": "Agriculture Income", "category": "exemption"}
    ),
]

_vector_store = None


async def init_vector_store():
    """Initialize ChromaDB vector store with ITR knowledge."""
    global _vector_store
    try:
        os.makedirs(settings.CHROMA_PERSIST_DIRECTORY, exist_ok=True)

        embeddings = GoogleGenerativeAIEmbeddings(
            model="models/embedding-001",
            google_api_key=settings.GOOGLE_API_KEY,
        )

        _vector_store = Chroma.from_documents(
            documents=ITR_KNOWLEDGE,
            embedding=embeddings,
            persist_directory=settings.CHROMA_PERSIST_DIRECTORY,
            collection_name="itr_knowledge",
        )
        print("✅ Vector store initialized with ITR knowledge base")
    except Exception as e:
        print(f"⚠️ Vector store initialization warning: {e}")
        _vector_store = None


async def search_itr_knowledge(query: str, k: int = 3) -> List[str]:
    """Search for relevant ITR knowledge."""
    if _vector_store is None:
        return []
    try:
        docs = _vector_store.similarity_search(query, k=k)
        return [doc.page_content for doc in docs]
    except Exception as e:
        print(f"Vector search error: {e}")
        return []
