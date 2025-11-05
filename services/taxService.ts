// services/taxService.ts

export interface TaxCalculationResult {
    totalTax: number;
    details: {
        projectedGross: number;
        socialSecurityContribution: number;
        generalTaxableIncome: number;
        generalTax: number;
        progressiveTax: number;
        progressiveTaxBreakdown: { bracket: string; tax: number }[];
    }
}

// Uproszczone stawki i progi na rok 2024.
// Źródło: Skatteetaten (Norweski Urząd Skarbowy)
const TAX_YEAR = 2024;

// Składka na ubezpieczenie społeczne (Trygdeavgift)
const SOCIAL_SECURITY_RATE = 0.079; // 7.9%

// Podatek od dochodu ogólnego (Skatt på alminnelig inntekt)
const GENERAL_TAX_RATE = 0.22; // 22%

// Odliczenie osobiste (Personfradrag)
const PERSONAL_ALLOWANCE = 88250;

// Odliczenie z tytułu kosztów uzyskania przychodu (Minstefradrag)
const STANDARD_DEDUCTION_RATE = 0.46; // 46%
const STANDARD_DEDUCTION_MAX = 104450;

// Progi podatku progresywnego (Trinnskatt)
const PROGRESSIVE_TAX_BRACKETS = [
    { limit: 208050, rate: 0 },       // Krok 0 - poniżej nie ma podatku
    { limit: 292850, rate: 0.017 },   // Krok 1
    { limit: 670000, rate: 0.040 },   // Krok 2
    { limit: 937900, rate: 0.136 },   // Krok 3
    { limit: 1350000, rate: 0.176 },  // Krok 4
    { limit: Infinity, rate: 0.178 }, // Krok 5
];


export const calculateNorwegianTax = (projectedGrossIncome: number): TaxCalculationResult => {
    if (projectedGrossIncome <= 0) {
        return {
            totalTax: 0,
            details: {
                projectedGross: 0,
                socialSecurityContribution: 0,
                generalTaxableIncome: 0,
                generalTax: 0,
                progressiveTax: 0,
                progressiveTaxBreakdown: [],
            }
        };
    }

    // 1. Składka na ubezpieczenie społeczne (Trygdeavgift)
    const socialSecurityContribution = projectedGrossIncome * SOCIAL_SECURITY_RATE;

    // 2. Podatek od dochodu ogólnego (Alminnelig inntekt)
    const standardDeduction = Math.min(projectedGrossIncome * STANDARD_DEDUCTION_RATE, STANDARD_DEDUCTION_MAX);
    const generalTaxableIncomeBase = projectedGrossIncome - standardDeduction - PERSONAL_ALLOWANCE;
    const generalTaxableIncome = Math.max(0, generalTaxableIncomeBase);
    const generalTax = generalTaxableIncome * GENERAL_TAX_RATE;
    
    // 3. Podatek progresywny (Trinnskatt)
    let progressiveTax = 0;
    let remainingIncome = projectedGrossIncome;
    let lastLimit = 0;
    const progressiveTaxBreakdown: { bracket: string; tax: number }[] = [];

    for (const bracket of PROGRESSIVE_TAX_BRACKETS) {
        if (projectedGrossIncome > lastLimit) {
            const taxableInBracket = Math.min(projectedGrossIncome, bracket.limit) - lastLimit;
            if (taxableInBracket > 0 && bracket.rate > 0) {
                const taxForBracket = taxableInBracket * bracket.rate;
                progressiveTax += taxForBracket;
                progressiveTaxBreakdown.push({
                    bracket: `Krok ${PROGRESSIVE_TAX_BRACKETS.indexOf(bracket)} (${(bracket.rate * 100).toFixed(1)}%)`,
                    tax: taxForBracket
                });
            }
        }
        lastLimit = bracket.limit;
    }


    const totalTax = socialSecurityContribution + generalTax + progressiveTax;
    
    return {
        totalTax: Math.round(totalTax),
        details: {
            projectedGross: projectedGrossIncome,
            socialSecurityContribution: Math.round(socialSecurityContribution),
            generalTaxableIncome: Math.round(generalTaxableIncome),
            generalTax: Math.round(generalTax),
            progressiveTax: Math.round(progressiveTax),
            progressiveTaxBreakdown,
        }
    };
};
