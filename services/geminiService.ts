
import { GoogleGenAI, Type } from "@google/genai";
import { ParsedPayslipData } from '../types';

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      } else {
        // Handle ArrayBuffer if necessary, though for web it's usually data URL
        const arr = new Uint8Array(reader.result as ArrayBuffer);
        const base64 = btoa(String.fromCharCode.apply(null, Array.from(arr)));
        resolve(base64);
      }
    };
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};


export const parsePayslipWithGemini = async (file: File): Promise<ParsedPayslipData> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const imagePart = await fileToGenerativePart(file);

  const textPart = {
    text: `You are an expert OCR system for Norwegian financial documents (lønnsslipp).
    Analyze the provided payslip image or PDF.
    Extract the values for the following fields:
    - Date of payment (e.g., "Utbetalingsdato", "Dato")
    - Brutto lønn (gross salary)
    - Netto utbetalt (net salary)
    - Forskuddstrekk (tax withheld)
    - Company name (Arbeidsgiver / Firma)

    Return the data as a valid JSON object.
    - Return the date in YYYY-MM-DD format. If the exact day is not present, use the last day of the month found. If no date is found, return an empty string "".
    - If a numeric value is not found, return 0.
    - If the company name is not found, return an empty string "".
    - Clean the numbers: remove any currency symbols (like 'kr'), spaces, and thousand separators (like '.'). Use '.' as the decimal separator.
    - For the company name, return the full legal name of the employer.
    - Prioritize values from a summary or main section if multiple are present.
    `
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            date: {
                type: Type.STRING,
                description: 'Date of payment (Utbetalingsdato) in YYYY-MM-DD format.',
            },
            grossSalary: {
              type: Type.NUMBER,
              description: 'Gross salary (Brutto lønn)',
            },
            netSalary: {
              type: Type.NUMBER,
              description: 'Net salary (Netto utbetalt)',
            },
            taxWithheld: {
              type: Type.NUMBER,
              description: 'Tax withheld (Forskuddstrekk)',
            },
            companyName: {
                type: Type.STRING,
                description: 'Company name (Arbeidsgiver / Firma)',
            }
          },
          required: ["date", "grossSalary", "netSalary", "taxWithheld", "companyName"],
        },
      }
    });

    const jsonString = response.text.trim();
    const parsedData = JSON.parse(jsonString) as ParsedPayslipData;
    return parsedData;

  } catch (error) {
    console.error("Error parsing payslip with Gemini:", error);
    throw new Error("Failed to analyze the payslip. Please check the document or try again.");
  }
};