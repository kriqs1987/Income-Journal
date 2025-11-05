import React, { useState, useMemo, useEffect, useRef, ChangeEvent } from 'react';
import { SalaryEntry } from '../types';
import { NoDataIcon, EditIcon, DeleteIcon, SpinnerIcon, ImportIcon, SaveIcon as ExportIcon } from './Icons';
import { exportEntriesToXml, importEntriesFromXml } from '../services/xmlService';
import { calculateNorwegianTax } from '../services/taxService';


interface SalaryHistoryProps {
  entries: SalaryEntry[];
  onEdit: (entry: SalaryEntry) => void;
  onDelete: (id: string) => void;
  onImport: (newEntries: Omit<SalaryEntry, 'id'>[]) => number;
  onDeleteAll: () => void;
}

const formatCurrency = (amount: number, hideSymbol = false) => {
  const options: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  };
  if (hideSymbol) {
    options.style = 'decimal';
  }
  return new Intl.NumberFormat('nb-NO', options).format(Math.round(amount));
};

const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pl-PL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

interface SummaryCardProps {
    title: string;
    value: string;
    color: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, color }) => (
    <div className={`p-4 bg-white rounded-lg shadow-sm border-l-4 ${color}`}>
        <h4 className="text-sm text-slate-500 font-medium">{title}</h4>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
);


export const SalaryHistory: React.FC<SalaryHistoryProps> = ({ entries, onEdit, onDelete, onImport, onDeleteAll }) => {
  const years = useMemo(() => {
    const yearSet = new Set(entries.map(e => new Date(e.date).getFullYear()));
    // FIX: Explicitly convert sort comparison values to numbers to prevent type errors.
    return Array.from(yearSet).sort((a, b) => Number(b) - Number(a));
  }, [entries]);

  const [selectedYear, setSelectedYear] = useState<number | null>(years.length > 0 ? years[0] : null);
  const [showTaxDetails, setShowTaxDetails] = useState(false);
  
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{ error: string; successCount: number | null }>({ error: '', successCount: null });
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (selectedYear && !years.includes(selectedYear)) {
      setSelectedYear(years.length > 0 ? years[0] : null);
    }
    if (!selectedYear && years.length > 0) {
        setSelectedYear(years[0]);
    }
  }, [years, selectedYear]);

  const filteredEntries = useMemo(() => {
    if (selectedYear === null) return [];
    return entries.filter(e => new Date(e.date).getFullYear() === selectedYear);
  }, [entries, selectedYear]);

  const yearTotals = useMemo(() => {
    return filteredEntries.reduce(
      (acc, entry) => {
        acc.gross += Number(entry.grossSalary || 0);
        acc.net += Number(entry.netSalary || 0);
        acc.tax += Number(entry.taxWithheld || 0);
        return acc;
      },
      { gross: 0, net: 0, tax: 0 }
    );
  }, [filteredEntries]);
  
  const taxCalculation = useMemo(() => {
    if (yearTotals.gross === 0) {
        return null;
    }
    
    // Calculate the tax due for the income earned so far
    const calculationResult = calculateNorwegianTax(yearTotals.gross);
    const totalTaxDue = calculationResult.totalTax;

    // Get the tax already paid (sum of withholdings)
    const totalTaxPaid = yearTotals.tax;

    // The difference shows if there is an overpayment (+) or underpayment (-)
    const difference = totalTaxPaid - totalTaxDue;

    return {
        difference,
        currentGross: yearTotals.gross,
        totalTaxPaid,
        totalTaxDue,
        details: calculationResult.details,
        monthsRecorded: filteredEntries.length,
    };
  }, [yearTotals, filteredEntries.length]);


  const handleExport = () => {
    if (entries.length === 0) {
      setImportStatus({ error: "Brak danych do wyeksportowania.", successCount: null });
      return;
    }
    try {
        exportEntriesToXml(entries);
        setImportStatus({ error: '', successCount: null }); // Clear previous messages
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Wystąpił nieznany błąd podczas eksportu.';
        setImportStatus({ error: errorMessage, successCount: null });
    }
  };
  
    const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        
        setIsImporting(true);
        setImportStatus({ error: '', successCount: null });
        try {
            const importedEntries = await importEntriesFromXml(file);
            const addedCount = onImport(importedEntries);
            setImportStatus({ error: '', successCount: addedCount });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Wystąpił nieznany błąd podczas importu.';
            setImportStatus({ error: errorMessage, successCount: null });
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const triggerFileInput = () => {
        setImportStatus({ error: '', successCount: null }); // Clear messages on new action
        fileInputRef.current?.click();
    };

  if (entries.length === 0) {
    return (
        <div>
          <div className="text-center bg-white p-12 rounded-lg border border-slate-200">
            <NoDataIcon />
            <h2 className="mt-4 text-xl font-semibold text-slate-700">Brak zapisanych wpisów</h2>
            <p className="mt-2 text-slate-500">Dodaj swój pierwszy wpis wypłaty, aby zobaczyć historię.</p>
          </div>
          <div className="bg-white p-6 rounded-lg border border-slate-200 mt-8 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Importuj Dane</h3>
            <p className="text-sm text-slate-500 mb-4">
              Masz już dane w pliku XML? Zaimportuj je, aby rozpocząć.
            </p>
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="sr-only" accept="application/xml, text/xml" disabled={isImporting} />
                <button 
                  onClick={triggerFileInput}
                  disabled={isImporting}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-transparent bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                    {isImporting ? <SpinnerIcon /> : <ImportIcon />}
                    <span>{isImporting ? 'Importowanie...' : 'Importuj z Pliku XML'}</span>
                </button>
                 {importStatus.successCount !== null && (
                    <div className="text-sm text-green-700 bg-green-50 p-2 rounded-md">
                        Pomyślnie zaimportowano {importStatus.successCount} nowych wpisów.
                    </div>
                )}
                {importStatus.error && (
                    <div className="text-sm text-red-700 bg-red-50 p-2 rounded-md whitespace-pre-wrap">
                        <strong>Błąd:</strong> {importStatus.error}
                    </div>
                )}
            </div>
          </div>
        </div>
    );
  }

  return (
    <div>
        <div className="bg-white p-6 rounded-lg border border-slate-200 mb-8 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Import i Eksport Danych</h3>
            <p className="text-sm text-slate-500 mb-4">
              Zapisz kopię zapasową w pliku XML na swoim komputerze lub zaimportuj dane z istniejącego pliku.
            </p>
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex flex-wrap gap-4">
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="sr-only" accept="application/xml, text/xml" disabled={isImporting} />
                    <button 
                      onClick={triggerFileInput}
                      disabled={isImporting}
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:bg-slate-200 disabled:cursor-not-allowed"
                    >
                        {isImporting ? <SpinnerIcon /> : <ImportIcon />}
                        <span>{isImporting ? 'Importowanie...' : 'Importuj'}</span>
                    </button>
                    <button 
                      onClick={handleExport}
                      disabled={isImporting}
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:bg-slate-200 disabled:cursor-not-allowed"
                    >
                        <ExportIcon />
                        <span>Eksportuj</span>
                    </button>
                    <button 
                      onClick={onDeleteAll}
                      disabled={isImporting}
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:bg-slate-200 disabled:cursor-not-allowed"
                    >
                        <DeleteIcon />
                        <span>Usuń Wszystko</span>
                    </button>
                </div>
                <div className="flex-grow">
                    {importStatus.successCount !== null && (
                      <div className="text-sm text-green-700 bg-green-50 p-2 rounded-md">
                        Pomyślnie zaimportowano {importStatus.successCount} nowych wpisów.
                      </div>
                    )}
                    {importStatus.error && (
                      <div className="text-sm text-red-700 bg-red-50 p-2 rounded-md whitespace-pre-wrap">
                        <strong>Błąd:</strong> {importStatus.error}
                      </div>
                    )}
                </div>
            </div>
        </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {years.map(year => (
          <button
            key={year}
            onClick={() => setSelectedYear(year)}
            className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${
              selectedYear === year
                ? 'bg-sky-600 text-white shadow'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {year}
          </button>
        ))}
      </div>
      
      {selectedYear && (
          <>
            <h2 className="text-2xl font-bold text-slate-800 mb-4">Podsumowanie za {selectedYear}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <SummaryCard title="Suma Brutto" value={formatCurrency(yearTotals.gross)} color="border-blue-500" />
                <SummaryCard title="Zapłacony Podatek" value={formatCurrency(yearTotals.tax)} color="border-red-500" />
                <SummaryCard title="Suma Netto" value={formatCurrency(yearTotals.net)} color="border-green-500" />
            </div>

            {taxCalculation && (
                 <div className="bg-white p-6 rounded-lg border border-slate-200 mb-8 shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-700">Bieżąca Kalkulacja Podatkowa</h3>
                    <p className="text-xs text-slate-500 mb-4">
                        Obliczenia na podstawie dotychczasowych zarobków ({taxCalculation.monthsRecorded} mies.) w {selectedYear}.
                    </p>

                    <div className="text-center p-4 rounded-lg bg-slate-50">
                        <p className="text-sm text-slate-600">
                            {taxCalculation.difference >= 0 ? "Bieżąca nadpłata podatku:" : "Bieżąca niedopłata podatku:"}
                        </p>
                        <p className={`text-4xl font-bold ${taxCalculation.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(Math.abs(taxCalculation.difference))}
                        </p>
                    </div>

                    <div className="mt-4">
                        <button onClick={() => setShowTaxDetails(!showTaxDetails)} className="text-sm font-medium text-sky-600 hover:text-sky-800">
                            {showTaxDetails ? 'Ukryj szczegóły obliczeń' : 'Pokaż szczegóły obliczeń'}
                        </button>
                        {showTaxDetails && (
                            <div className="mt-3 bg-slate-50 p-4 rounded-md text-sm text-slate-700 space-y-2 border border-slate-200">
                                <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-md">
                                  <strong>UWAGA:</strong> To jest uproszczona kalkulacja dla dotychczasowego dochodu i nie zastępuje oficjalnego rozliczenia podatkowego.
                                </p>
                                <div className="flex justify-between py-1 border-b">
                                    <span>Łączny dochód brutto do tej pory:</span>
                                    <span className="font-semibold">{formatCurrency(taxCalculation.currentGross)}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b">
                                    <span>Suma zapłaconych zaliczek:</span>
                                    <span className="font-semibold">{formatCurrency(taxCalculation.totalTaxPaid)}</span>
                                </div>
                                <div className="flex justify-between py-1 font-bold text-base text-slate-800">
                                    <span>Należny podatek od tej kwoty:</span>
                                    <span className="font-bold">{formatCurrency(taxCalculation.totalTaxDue)}</span>
                                </div>
                                <div className="pl-4 text-xs space-y-1 text-slate-600">
                                    <div className="flex justify-between pt-1">
                                      <span>- Podatek od dochodu ogólnego (22%):</span>
                                      <span>{formatCurrency(taxCalculation.details.generalTax)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>- Składka na ubezp. (7.9%):</span>
                                      <span>{formatCurrency(taxCalculation.details.socialSecurityContribution)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>- Podatek progresywny (łącznie):</span>
                                      <span>{formatCurrency(taxCalculation.details.progressiveTax)}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}


            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Data</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Firma</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Brutto</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Podatek</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Netto</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Plik</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Akcje</th>
                        </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                        {filteredEntries.map(entry => (
                            <tr key={entry.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{formatDate(entry.date)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 truncate max-w-xs">{entry.companyName || '—'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{formatCurrency(entry.grossSalary)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{formatCurrency(entry.taxWithheld)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-semibold">{formatCurrency(entry.netSalary)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 truncate max-w-xs">{entry.sourceFileName || '—'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                                <button onClick={() => onEdit(entry)} className="p-2 text-sky-600 hover:text-sky-900 hover:bg-sky-100 rounded-full transition-colors" aria-label="Edytuj wpis">
                                    <EditIcon />
                                </button>
                                <button onClick={() => onDelete(entry.id)} className="p-2 ml-2 text-red-600 hover:text-red-900 hover:bg-red-100 rounded-full transition-colors" aria-label="Usuń wpis">
                                    <DeleteIcon />
                                </button>
                            </td>
                            </tr>
                        ))}
                        </tbody>
                        <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                          <tr>
                            <td colSpan={2} className="px-6 py-3 text-left text-sm font-semibold text-slate-800">Suma:</td>
                            <td className="px-6 py-3 text-left text-sm font-semibold text-slate-800">{formatCurrency(yearTotals.gross)}</td>
                            <td className="px-6 py-3 text-left text-sm font-semibold text-slate-800">{formatCurrency(yearTotals.tax)}</td>
                            <td className="px-6 py-3 text-left text-sm font-semibold text-slate-800">{formatCurrency(yearTotals.net)}</td>
                            <td colSpan={2} className="px-6 py-3"></td>
                          </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </>
      )}

    </div>
  );
};