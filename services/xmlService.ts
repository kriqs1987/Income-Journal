import { SalaryEntry } from '../types';

// Funkcja pomocnicza do ucieczki znaków specjalnych XML
const escapeXml = (unsafe: string): string => {
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
};

export const exportEntriesToXml = (entries: SalaryEntry[]): void => {
    const sortedEntries = entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let xmlString = '<?xml version="1.0" encoding="UTF-8"?>\n<SalaryEntries>\n';

    sortedEntries.forEach(entry => {
        xmlString += '  <Entry>\n';
        xmlString += `    <Date>${entry.date}</Date>\n`;
        if (entry.companyName) {
            xmlString += `    <CompanyName>${escapeXml(entry.companyName)}</CompanyName>\n`;
        }
        xmlString += `    <GrossSalary>${entry.grossSalary}</GrossSalary>\n`;
        xmlString += `    <NetSalary>${entry.netSalary}</NetSalary>\n`;
        xmlString += `    <TaxWithheld>${entry.taxWithheld}</TaxWithheld>\n`;
        if (entry.sourceFileName) {
            xmlString += `    <SourceFileName>${escapeXml(entry.sourceFileName)}</SourceFileName>\n`;
        }
        xmlString += '  </Entry>\n';
    });

    xmlString += '</SalaryEntries>';

    const blob = new Blob([xmlString], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dziennik-zarobkow-${new Date().toISOString().split('T')[0]}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};


export const importEntriesFromXml = (file: File): Promise<Omit<SalaryEntry, 'id'>[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const xmlString = event.target?.result as string;
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlString, "application/xml");

                const errorNode = xmlDoc.querySelector('parsererror');
                if (errorNode) {
                    const errorText = errorNode.textContent || "Nieprawidłowa struktura XML.";
                    throw new Error(`Błąd parsowania pliku XML: ${errorText.split('\n')[0]}`);
                }

                if (xmlDoc.documentElement.tagName !== 'SalaryEntries') {
                    throw new Error("Błąd formatu pliku: Oczekiwano głównego tagu <SalaryEntries>.");
                }

                const entryNodes = xmlDoc.getElementsByTagName('Entry');
                const importedEntries: Omit<SalaryEntry, 'id'>[] = [];
                const validationErrors: string[] = [];
                
                for (let i = 0; i < entryNodes.length; i++) {
                    const entryNode = entryNodes[i];
                    const getElementValue = (tagName: string): string | undefined => {
                        const element = entryNode.getElementsByTagName(tagName)[0];
                        return element?.textContent?.trim() ?? undefined;
                    };

                    const date = getElementValue('Date');
                    const companyName = getElementValue('CompanyName');
                    const grossSalaryStr = getElementValue('GrossSalary');
                    const netSalaryStr = getElementValue('NetSalary');
                    const taxWithheldStr = getElementValue('TaxWithheld');
                    const sourceFileName = getElementValue('SourceFileName');
                    
                    if (!date || !grossSalaryStr || !netSalaryStr || !taxWithheldStr) {
                         validationErrors.push(`Wpis #${i + 1}: Brakuje jednego z wymaganych pól (Date, GrossSalary, NetSalary, TaxWithheld).`);
                         continue;
                    }
                    
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                        validationErrors.push(`Wpis #${i + 1}: Nieprawidłowy format daty '${date}'. Wymagany format: YYYY-MM-DD.`);
                        continue;
                    }

                    const grossSalary = parseFloat(grossSalaryStr);
                    const netSalary = parseFloat(netSalaryStr);
                    const taxWithheld = parseFloat(taxWithheldStr);

                    if (isNaN(grossSalary) || isNaN(netSalary) || isNaN(taxWithheld)) {
                         validationErrors.push(`Wpis #${i + 1}: Jedna z wartości (GrossSalary, NetSalary, TaxWithheld) nie jest prawidłową liczbą.`);
                         continue;
                    }

                    importedEntries.push({
                        date,
                        companyName: companyName ? companyName : undefined,
                        grossSalary,
                        netSalary,
                        taxWithheld,
                        sourceFileName: sourceFileName ? sourceFileName : undefined,
                    });
                }
                
                if (importedEntries.length === 0 && validationErrors.length > 0) {
                    const combinedErrors = validationErrors.slice(0, 5).join('\n- ');
                    const fullError = `Plik został odczytany, ale nie zaimportowano żadnych wpisów z powodu błędów w danych:\n- ${combinedErrors}${validationErrors.length > 5 ? '\n...' : ''}`;
                    throw new Error(fullError);
                }

                resolve(importedEntries);

            } catch (error) {
                reject(error instanceof Error ? error : new Error("Wystąpił nieznany błąd podczas odczytu pliku."));
            }
        };

        reader.onerror = () => {
            reject(new Error("Nie można odczytać pliku."));
        };

        reader.readAsText(file);
    });
};