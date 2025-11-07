// services/taxService.ts

export interface TaxCalculationResult {
    totalTax: number;
    details: {
        projectedGross: number;
        // The following are not calculated with the new user-provided formula.
        socialSecurityContribution: number;
        generalTaxableIncome: number;
        generalTax: number;
        progressiveTax: number;
        progressiveTaxBreakdown: { bracket: string; tax: number }[];
    }
}

/**
 * Calculates tax based on a simplified, user-provided bracket system.
 * This formula does not follow the official Norwegian tax system structure
 * (e.g., separate social security, general tax, progressive tax) but instead
 * uses combined marginal rates for different income brackets.
 * @param projectedGrossIncome The total gross income for the year.
 * @returns A TaxCalculationResult object with the total calculated tax.
 */
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

    let totalTax = 0;

    // This calculation is based on the user's provided Excel formula.
    if (projectedGrossIncome <= 198349) {
        totalTax = projectedGrossIncome * 0.22;
    } else if (projectedGrossIncome <= 279149) {
        totalTax = (198349 * 0.22) + ((projectedGrossIncome - 198349) * 0.237);
    } else if (projectedGrossIncome <= 642949) {
        totalTax = (198349 * 0.22) + ((279149 - 198349) * 0.237) + ((projectedGrossIncome - 279149) * 0.26);
    } else if (projectedGrossIncome <= 926799) {
        totalTax = (198349 * 0.22) + ((279149 - 198349) * 0.237) + ((642949 - 279149) * 0.26) + ((projectedGrossIncome - 642949) * 0.355);
    } else if (projectedGrossIncome <= 1499999) {
        totalTax = (198349 * 0.22) + ((279149 - 198349) * 0.237) + ((642949 - 279149) * 0.26) + ((926799 - 642949) * 0.355) + ((projectedGrossIncome - 926799) * 0.385);
    } else { // projectedGrossIncome > 1499999
        totalTax = (198349 * 0.22) + ((279149 - 198349) * 0.237) + ((642949 - 279149) * 0.26) + ((926799 - 642949) * 0.355) + ((1499999 - 926799) * 0.385) + ((projectedGrossIncome - 1499999) * 0.175);
    }
    
    return {
        totalTax: Math.round(totalTax),
        details: {
            projectedGross: projectedGrossIncome,
            // These details are not applicable to the new formula.
            socialSecurityContribution: 0,
            generalTaxableIncome: 0,
            generalTax: 0,
            progressiveTax: 0,
            progressiveTaxBreakdown: [],
        }
    };
};
