"""ITR Calculation Endpoints with Redis caching"""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.schemas import ITRCalculationRequest, ITRCalculationResponse
from app.models.itr_models import ITRCalculation, User
from app.services.tax_calculator import calculate_itr
from app.services.cache_service import cache
from app.agents.itr_agent import generate_ai_advice_for_calculation

router = APIRouter()


def _cache_key(req: ITRCalculationRequest) -> dict:
    return {
        "regime": req.tax_regime,
        "ay": req.assessment_year,
        "age": req.age,
        "income": req.income.model_dump(),
        "ded": req.deductions.model_dump(),
        "tds": req.tds_paid,
        "adv": req.advance_tax_paid,
    }


@router.post("/calculate", response_model=ITRCalculationResponse)
async def calculate_tax(
    request: ITRCalculationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    # Check Redis cache first
    cache_data = _cache_key(request)
    cached = cache.get_cached_calculation(cache_data)
    if cached:
        cached["cached"] = True
        return ITRCalculationResponse(**cached)

    calculation_id = str(uuid.uuid4())
    result = await calculate_itr(request, calculation_id)

    # Generate AI advice
    try:
        advice = await generate_ai_advice_for_calculation({
            "gross_total_income": result.gross_total_income,
            "taxable_income": result.taxable_income,
            "total_tax": result.total_tax,
            "recommended_regime": result.recommended_regime,
            "regime_savings": result.regime_savings,
        })
    except Exception:
        advice = "Consult a CA for personalised tax planning."

    result = await calculate_itr(request, calculation_id, advice)

    # Save to DB
    try:
        user_id = current_user.id if current_user else None
        db_calc = ITRCalculation(
            id=calculation_id,
            user_id=user_id,
            session_id=request.session_id or str(uuid.uuid4()),
            assessment_year=request.assessment_year,
            salary_income=request.income.salary_income,
            house_property_income=request.income.house_property_income,
            business_income=request.income.business_income,
            capital_gains_short=request.income.capital_gains_short,
            capital_gains_long=request.income.capital_gains_long,
            other_income=request.income.other_income,
            section_80c=request.deductions.section_80c,
            section_80d=request.deductions.section_80d,
            section_80e=request.deductions.section_80e,
            section_80g=request.deductions.section_80g,
            section_80tta=request.deductions.section_80tta,
            hra_exemption=request.deductions.hra_exemption,
            home_loan_interest=request.deductions.home_loan_interest,
            gross_total_income=result.gross_total_income,
            total_deductions=result.total_deductions,
            taxable_income=result.taxable_income,
            tax_liability=result.tax_liability,
            surcharge=result.surcharge,
            health_education_cess=result.health_education_cess,
            total_tax=result.total_tax,
            tds_paid=request.tds_paid,
            advance_tax_paid=request.advance_tax_paid,
            tax_refund_or_payable=result.tax_refund_or_payable,
            tax_regime=request.tax_regime,
            recommended_regime=result.recommended_regime,
            ai_advice=advice,
        )
        db.add(db_calc)
        await db.commit()
    except Exception as e:
        print(f"DB save error: {e}")

    # Cache result
    result_dict = result.model_dump()
    cache.cache_tax_calculation(cache_data, result_dict)

    return result


@router.get("/history/{session_id}")
async def get_history(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ITRCalculation)
        .where(ITRCalculation.session_id == session_id)
        .order_by(ITRCalculation.created_at.desc()).limit(10)
    )
    calcs = result.scalars().all()
    return {"session_id": session_id, "calculations": [
        {"id": c.id, "assessment_year": c.assessment_year,
         "gross_total_income": c.gross_total_income,
         "total_tax": c.total_tax, "tax_regime": c.tax_regime,
         "created_at": c.created_at.isoformat()} for c in calcs
    ]}


@router.get("/regimes/compare")
async def compare_regimes(salary: float = 1000000, deductions_80c: float = 150000, age: int = 30):
    from app.models.schemas import IncomeInput, DeductionInput, ITRCalculationRequest
    from app.services.tax_calculator import calculate_old_regime, calculate_new_regime
    req = ITRCalculationRequest(
        income=IncomeInput(salary_income=salary),
        deductions=DeductionInput(section_80c=deductions_80c),
        age=age, tax_regime="old",
    )
    old = calculate_old_regime(req)
    new = calculate_new_regime(req)
    return {
        "old_regime": {"taxable_income": old["taxable_income"], "total_tax": old["total_tax"]},
        "new_regime": {"taxable_income": new["taxable_income"], "total_tax": new["total_tax"]},
        "recommended": "old" if old["total_tax"] <= new["total_tax"] else "new",
        "savings": abs(old["total_tax"] - new["total_tax"]),
    }


@router.get("/cache-info")
async def cache_info():
    return cache.info()
