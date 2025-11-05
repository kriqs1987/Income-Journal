
export interface SalaryEntry {
  id: string;
  date: string; // YYYY-MM-DD format
  grossSalary: number;
  netSalary: number;
  taxWithheld: number;
  companyName?: string; // Optional: name of the company
  sourceFileName?: string; // Optional: name of the uploaded payslip file
}

export interface ParsedPayslipData {
  date: string; // YYYY-MM-DD format
  grossSalary: number;
  netSalary: number;
  taxWithheld: number;
  companyName: string;
}