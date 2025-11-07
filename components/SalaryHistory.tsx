import React, { useState, useMemo, useEffect } from 'react';
import { SalaryEntry } from '../types';
import { NoDataIcon, EditIcon, DeleteIcon, ArrowUpIcon, ArrowDownIcon } from './Icons';
import { calculateNorwegianTax } from '../services/taxService';


interface SalaryHistoryProps {
  entries: SalaryEntry[];
  onEdit: (entry: SalaryEntry) => void;
  onDelete: (id: string) => void;
}

type SortableKeys = keyof Pick<SalaryEntry, 'date' | 'companyName' | 'grossSalary' | 'netSalary' | 'taxWithheld'>;

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

const SalaryChart: React.FC<{ entries: SalaryEntry[] }> = ({ entries }) => {
    const monthlyTotals = useMemo(() => {
        const totals = Array(12).fill(0);
        entries.forEach(entry => {
            const month = new Date(entry.date).getMonth();
            totals[month] += entry.grossSalary;
        });
        return totals;
    }, [entries]);

    const maxTotal = useMemo(() => Math.max(...monthlyTotals), [monthlyTotals]);

    if (maxTotal === 0) {
        return null;
    }

    const monthLabels = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];

    return (
        <div className="bg-white p-6 rounded-lg border border-slate-200 mb-8 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-700 mb-4">Miesięczny Przegląd Brutto</h3>
            <div className="flex justify-between items-end h-60 space-x-2 md:space-x-4 px-2">
                {monthlyTotals.map((total, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center justify-end h-full group">
                        <div className="relative w-full h-full flex items-end">
                            <div
                                className="w-full bg-sky-200 rounded-t-md hover:bg-sky-500 transition-colors duration-300"
                                style={{ height: `${(total / maxTotal) * 100}%` }}
                                aria-label={`Zarobki w ${monthLabels[index]}: ${formatCurrency(total)}`}
                            />
                             <div className="absolute bottom-full mb-1 w-full text-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                                <span className="text-xs font-bold text-white bg-slate-700 px-2 py-1 rounded-md shadow-lg">
                                    {formatCurrency(total)}
                                </span>
                            </div>
                        </div>
                        <span className="mt-2 text-xs text-slate-500 font-medium">{monthLabels[index]}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};


export const SalaryHistory: React.FC<SalaryHistoryProps> = ({ entries, onEdit, onDelete }) => {
  const years = useMemo(() => {
    const yearSet = new Set(entries.map(e => new Date(e.date).getFullYear()));
    return Array.from(yearSet).sort((a, b) => Number(b) - Number(a));
  }, [entries]);

  const [selectedYear, setSelectedYear] = useState<number | null>(years.length > 0 ? years[0] : null);
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' }>({ key: 'date', direction: 'descending' });
  const [showTaxDetails, setShowTaxDetails] = useState(false);
  
  useEffect(() => {
    if (selectedYear && !years.includes(selectedYear)) {
      setSelectedYear(years.length > 0 ? years[0] : null);
    }
    if (!selectedYear && years.length > 0) {
        setSelectedYear(years[0]);
    }
    setSelectedCompany('all'); // Reset company filter on year change
  }, [years, selectedYear]);

  const yearFilteredEntries = useMemo(() => {
    if (selectedYear === null) return [];
    return entries.filter(e => new Date(e.date).getFullYear() === selectedYear);
  }, [entries, selectedYear]);

  const companyNames = useMemo(() => {
    const names = new Set(
        yearFilteredEntries
            .map(e => e.companyName)
            .filter((name): name is string => !!name)
    );
    return Array.from(names).sort();
  }, [yearFilteredEntries]);


  const displayedEntries = useMemo(() => {
    let filtered = [...yearFilteredEntries];
    if (selectedCompany !== 'all') {
        filtered = filtered.filter(entry => entry.companyName === selectedCompany);
    }
    
    filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;

        let comparison = 0;
        if (typeof aValue === 'number' && typeof bValue === 'number') {
            comparison = aValue - bValue;
        } else {
            comparison = String(aValue).localeCompare(String(bValue));
        }

        return sortConfig.direction === 'ascending' ? comparison : -comparison;
    });

    return filtered;
  }, [yearFilteredEntries, selectedCompany, sortConfig]);

  const yearTotals = useMemo(() => {
    return displayedEntries.reduce(
      (acc, entry) => {
        acc.gross += Number(entry.grossSalary || 0);
        acc.net += Number(entry.netSalary || 0);
        acc.tax += Number(entry.taxWithheld || 0);
        return acc;
      },
      { gross: 0, net: 0, tax: 0 }
    );
  }, [displayedEntries]);
  
  const taxCalculation = useMemo(() => {
    if (yearTotals.gross === 0) {
        return null;
    }
    const calculationResult = calculateNorwegianTax(yearTotals.gross);
    const totalTaxDue = calculationResult.totalTax;
    const totalTaxPaid = yearTotals.tax;
    const difference = totalTaxPaid - totalTaxDue;

    return {
        difference,
        currentGross: yearTotals.gross,
        totalTaxPaid,
        totalTaxDue,
        details: calculationResult.details,
        monthsRecorded: displayedEntries.length,
    };
  }, [yearTotals, displayedEntries.length]);

  const requestSort = (key: SortableKeys) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const SortableHeader: React.FC<{ label: string; columnKey: SortableKeys; className?: string }> = ({ label, columnKey, className = '' }) => (
    <th
        scope="col"
        className={`px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer transition-colors hover:bg-slate-100 ${className}`}
        onClick={() => requestSort(columnKey)}
    >
        <div className="flex items-center gap-2">
            <span>{label}</span>
            {sortConfig.key === columnKey && (
                sortConfig.direction === 'ascending' ? <ArrowUpIcon /> : <ArrowDownIcon />
            )}
        </div>
    </th>
  );


  if (entries.length === 0) {
    return (
        <div className="text-center bg-white p-12 rounded-lg border border-slate-200">
            <NoDataIcon />
            <h2 className="mt-4 text-xl font-semibold text-slate-700">Brak zapisanych wpisów</h2>
            <p className="mt-2 text-slate-500">Dodaj swój pierwszy wpis wypłaty, aby zobaczyć historię.</p>
        </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-600">Rok:</span>
          {years.map(year => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                selectedYear === year
                  ? 'bg-sky-600 text-white shadow'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-300'
              }`}
            >
              {year}
            </button>
          ))}
        </div>
        
        {companyNames.length > 0 && (
          <div className="flex items-center gap-2">
             <label htmlFor="company-filter" className="text-sm font-medium text-slate-600">Firma:</label>
             <select
                id="company-filter"
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="block w-full max-w-[200px] rounded-md border-slate-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm bg-white"
             >
                <option value="all">Wszystkie firmy</option>
                {companyNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                ))}
             </select>
          </div>
        )}
      </div>
      
      {selectedYear && (
          <>
            <h2 className="text-2xl font-bold text-slate-800 mb-4">
                Podsumowanie za {selectedYear}
                {selectedCompany !== 'all' && <span className="text-lg text-slate-500 font-normal ml-2">({selectedCompany})</span>}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <SummaryCard title="Suma Brutto" value={formatCurrency(yearTotals.gross)} color="border-blue-500" />
                <SummaryCard title="Zapłacony Podatek" value={formatCurrency(yearTotals.tax)} color="border-red-500" />
                <SummaryCard title="Suma Netto" value={formatCurrency(yearTotals.net)} color="border-green-500" />
            </div>

            <SalaryChart entries={displayedEntries} />

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
                            <SortableHeader label="Data" columnKey="date" />
                            <SortableHeader label="Firma" columnKey="companyName" />
                            <SortableHeader label="Brutto" columnKey="grossSalary" />
                            <SortableHeader label="Podatek" columnKey="taxWithheld" />
                            <SortableHeader label="Netto" columnKey="netSalary" />
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Akcje</th>
                        </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                        {displayedEntries.map(entry => (
                            <tr key={entry.id} className="group even:bg-slate-50 hover:bg-sky-50 transition-all duration-200 ease-in-out">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 transition-colors group-hover:text-sky-900">{formatDate(entry.date)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 truncate max-w-xs transition-colors group-hover:text-sky-800">
                                    <div className="font-medium text-slate-800 group-hover:text-sky-900">{entry.companyName || '—'}</div>
                                    {entry.sourceFileName && (
                                        <div className="text-xs text-slate-400 truncate overflow-hidden max-h-0 group-hover:max-h-5 transition-all duration-300 ease-in-out group-hover:text-sky-700 mt-1">
                                            {entry.sourceFileName}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 transition-colors group-hover:text-sky-800">{formatCurrency(entry.grossSalary)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 transition-colors group-hover:text-sky-800">{formatCurrency(entry.taxWithheld)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-semibold transition-colors group-hover:text-sky-900">{formatCurrency(entry.netSalary)}</td>
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
                            <td className="px-6 py-3"></td>
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