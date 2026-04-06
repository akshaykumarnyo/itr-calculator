"""
ITR Tax Calculation Engine
Supports Old & New Tax Regimes for AY 2024-25
"""
from typing import Dict, List, Tuple
from app.models.schemas import (
    ITRCalculationRequest, ITRCalculationResponse, TaxSlabResult
)


# ─────────────────────────────────────────────
#  TAX SLABS (AY 2024-25)
# ─────────────────────────────────────────────

OLD_REGIME_SLABS = {
    "below_60": [
        (0, 250000, 0.0),
        (250000, 500000, 0.05),
        (500000, 1000000, 0.20),
        (1000000, float("inf"), 0.30),
    ],
    "60_to_80": [  # Senior Citizen
        (0, 300000, 0.0),
        (300000, 500000, 0.05),
        (500000, 1000000, 0.20),
        (1000000, float("inf"), 0.30),
    ],
    "above_80": [  # Super Senior Citizen
        (0, 500000, 0.0),
        (500000, 1000000, 0.20),
        (1000000, float("inf"), 0.30),
    ],
}

NEW_REGIME_SLABS_2024 = [
    (0, 300000, 0.0),
    (300000, 600000, 0.05),
    (600000, 900000, 0.10),
    (900000, 1200000, 0.15),
    (1200000, 1500000, 0.20),
    (1500000, float("inf"), 0.30),
]

SURCHARGE_RATES = [
    (5000000, 10000000, 0.10),
    (10000000, 20000000, 0.15),
    (20000000, 50000000, 0.25),
    (50000000, float("inf"), 0.37),
]

CESS_RATE = 0.04  # Health & Education Cess


def get_slab_key(age: int) -> str:
    if age < 60:
        return "below_60"
    elif age < 80:
        return "60_to_80"
    return "above_80"


def calculate_tax_on_slabs(
    taxable_income: float,
    slabs: list,
) -> Tuple[float, List[TaxSlabResult]]:
    """Calculate tax based on slabs and return breakdown."""
    total_tax = 0.0
    slab_results = []

    for lower, upper, rate in slabs:
        if taxable_income <= lower:
            break
        income_in_slab = min(taxable_income, upper) - lower
        tax = income_in_slab * rate
        total_tax += tax

        slab_results.append(TaxSlabResult(
            slab=f"₹{lower:,.0f} - {'Above ₹' + str(upper // 100000) + 'L' if upper == float('inf') else '₹' + str(upper // 100000) + 'L'}",
            rate=rate * 100,
            income_in_slab=income_in_slab,
            tax=tax,
        ))

    return total_tax, slab_results


def calculate_surcharge(tax: float, income: float) -> float:
    """Calculate surcharge based on income."""
    for lower, upper, rate in SURCHARGE_RATES:
        if lower < income <= upper:
            return tax * rate
    return 0.0


def apply_rebate_87a(tax: float, taxable_income: float, regime: str) -> float:
    """Section 87A rebate - up to ₹12,500 for income up to ₹5L (old) or ₹7L (new)."""
    if regime == "old" and taxable_income <= 500000:
        return max(0, tax - 12500)
    if regime == "new" and taxable_income <= 700000:
        return max(0, tax - 25000)
    return tax


def calculate_old_regime(request: ITRCalculationRequest) -> dict:
    """Calculate tax under Old Tax Regime."""
    inc = request.income
    ded = request.deductions

    # Gross Total Income
    gross = (
        inc.salary_income
        + inc.house_property_income
        + inc.business_income
        + inc.capital_gains_short
        + inc.capital_gains_long
        + inc.other_income
    )

    # Total Deductions
    total_deductions = (
        ded.section_80c
        + ded.section_80d
        + ded.section_80e
        + ded.section_80g
        + ded.section_80tta
        + ded.hra_exemption
        + ded.home_loan_interest
        + 50000  # Standard deduction for salaried
    )
    total_deductions = min(total_deductions, gross)  # Cannot exceed gross

    taxable_income = max(0, gross - total_deductions)

    # Get slabs based on age
    slab_key = get_slab_key(request.age)
    slabs = OLD_REGIME_SLABS[slab_key]

    tax, slab_results = calculate_tax_on_slabs(taxable_income, slabs)

    # Apply rebate 87A
    tax = apply_rebate_87a(tax, taxable_income, "old")

    surcharge = calculate_surcharge(tax, taxable_income)
    cess = (tax + surcharge) * CESS_RATE
    total_tax = tax + surcharge + cess

    return {
        "gross": gross,
        "total_deductions": total_deductions,
        "taxable_income": taxable_income,
        "tax": tax,
        "surcharge": surcharge,
        "cess": cess,
        "total_tax": total_tax,
        "slab_results": slab_results,
    }


def calculate_new_regime(request: ITRCalculationRequest) -> dict:
    """Calculate tax under New Tax Regime 2024."""
    inc = request.income

    # New regime - minimal deductions
    gross = (
        inc.salary_income
        + inc.house_property_income
        + inc.business_income
        + inc.capital_gains_short
        + inc.capital_gains_long
        + inc.other_income
    )

    # New regime allows standard deduction of ₹75,000 for salaried
    standard_deduction = 75000 if inc.salary_income > 0 else 0
    taxable_income = max(0, gross - standard_deduction)

    tax, slab_results = calculate_tax_on_slabs(taxable_income, NEW_REGIME_SLABS_2024)

    # Apply rebate 87A
    tax = apply_rebate_87a(tax, taxable_income, "new")

    surcharge = calculate_surcharge(tax, taxable_income)
    cess = (tax + surcharge) * CESS_RATE
    total_tax = tax + surcharge + cess

    return {
        "gross": gross,
        "total_deductions": standard_deduction,
        "taxable_income": taxable_income,
        "tax": tax,
        "surcharge": surcharge,
        "cess": cess,
        "total_tax": total_tax,
        "slab_results": slab_results,
    }


def generate_optimization_tips(request: ITRCalculationRequest, old_result: dict, new_result: dict) -> List[str]:
    """Generate tax optimization tips."""
    tips = []
    ded = request.deductions
    inc = request.income

    if ded.section_80c < 150000:
        remaining = 150000 - ded.section_80c
        tips.append(f"💡 You can invest ₹{remaining:,.0f} more under Section 80C (PPF, ELSS, LIC) to save ₹{remaining * 0.3:,.0f} in tax.")

    if ded.section_80d < 25000:
        tips.append("💡 Buy health insurance to claim Section 80D deduction up to ₹25,000.")

    if inc.salary_income > 0 and ded.hra_exemption == 0:
        tips.append("💡 If you pay rent, you can claim HRA exemption to reduce taxable salary.")

    if ded.home_loan_interest == 0 and inc.salary_income > 500000:
        tips.append("💡 Home loan interest up to ₹2,00,000 is deductible under Section 24(b).")

    if old_result["total_tax"] < new_result["total_tax"]:
        savings = new_result["total_tax"] - old_result["total_tax"]
        tips.append(f"✅ Old Tax Regime saves you ₹{savings:,.0f} due to your deductions.")
    else:
        savings = old_result["total_tax"] - new_result["total_tax"]
        tips.append(f"✅ New Tax Regime saves you ₹{savings:,.0f} with simpler compliance.")

    if old_result["gross"] > 1000000:
        tips.append("💡 Consider NPS contribution under Section 80CCD(1B) for additional ₹50,000 deduction.")

    return tips[:5]  # Top 5 tips


async def calculate_itr(
    request: ITRCalculationRequest,
    calculation_id: str,
    ai_advice: str = "",
) -> ITRCalculationResponse:
    """Main ITR calculation function."""

    old_result = calculate_old_regime(request)
    new_result = calculate_new_regime(request)

    # Choose regime
    if request.tax_regime == "old":
        result = old_result
    else:
        result = new_result

    # Recommended regime
    recommended = "old" if old_result["total_tax"] <= new_result["total_tax"] else "new"
    regime_savings = abs(old_result["total_tax"] - new_result["total_tax"])

    # Tax refund or payable
    total_paid = request.tds_paid + request.advance_tax_paid
    balance = result["total_tax"] - total_paid
    # Negative = refund, positive = payable

    optimization_tips = generate_optimization_tips(request, old_result, new_result)

    return ITRCalculationResponse(
        calculation_id=calculation_id,
        assessment_year=request.assessment_year,
        tax_regime=request.tax_regime,
        recommended_regime=recommended,
        gross_total_income=result["gross"],
        total_deductions=result["total_deductions"],
        taxable_income=result["taxable_income"],
        tax_liability=result["tax"],
        surcharge=result["surcharge"],
        health_education_cess=result["cess"],
        total_tax=result["total_tax"],
        tds_paid=request.tds_paid,
        advance_tax_paid=request.advance_tax_paid,
        tax_refund_or_payable=balance,
        tax_slabs=result["slab_results"],
        old_regime_tax=old_result["total_tax"],
        new_regime_tax=new_result["total_tax"],
        regime_savings=regime_savings,
        ai_advice=ai_advice,
        optimization_tips=optimization_tips,
    )
