
import React, { useState, ChangeEvent, FormEvent, useEffect, useRef } from 'react';
import { SalaryEntry } from '../types';
import { parsePayslipWithGemini } from '../services/geminiService';
import { UploadIcon, SpinnerIcon, SaveIcon, ImportIcon, SaveIcon as ExportIcon, AnalysisIcon, CheckCircleIcon, XCircleIcon, DeleteIcon } from './Icons';
import { exportEntriesToXml, importEntriesFromXml } from '../services/xmlService';

interface AddEntryProps {
  onSave: (entry: Omit<SalaryEntry, 'id'>) => void;
  entryToEdit?: SalaryEntry | null;
  onCancel: () => void;
  entries: SalaryEntry[];
  onImport: (newEntries: Omit<SalaryEntry, 'id'>[]) => Promise<number>;
  onDeleteAll: () => void;
}

type AnalysisStatus = 'pending' | 'processing' | 'success' | 'error';
interface AnalysisResult {
    fileName: string;
    status: AnalysisStatus;
    error?: string;
}

const initialFormState = {
  date: new Date().toISOString().split('T')[0],
  companyName: '',
  grossSalary: '',
  netSalary: '',
  taxWithheld: '',
  sourceFileName: '',
};

export const AddEntry: React.FC<AddEntryProps> = ({ onSave, entryToEdit, onCancel, entries, onImport, onDeleteAll }) => {
  const [formData, setFormData] = useState(initialFormState);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{ error: string; successCount: number | null }>({ error: '', successCount: null });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [analysisSummary, setAnalysisSummary] = useState<{ success: number, error: number } | null>(null);
  const analysisFileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!entryToEdit;

  useEffect(() => {
    if (entryToEdit) {
      setFormData({
        date: entryToEdit.date,
        companyName: entryToEdit.companyName || '',
        grossSalary: entryToEdit.grossSalary.toString(),
        netSalary: entryToEdit.netSalary.toString(),
        taxWithheld: entryToEdit.taxWithheld.toString(),
        sourceFileName: entryToEdit.sourceFileName || '',
      });
    } else {
      setFormData(initialFormState);
    }
  }, [entryToEdit]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setError(null);
    setFormData(prev => ({ ...prev, sourceFileName: file.name }));

    try {
      const parsedData = await parsePayslipWithGemini(file);
      setFormData(prev => ({
        ...prev,
        date: parsedData.date || prev.date,
        companyName: parsedData.companyName,
        grossSalary: parsedData.grossSalary.toString(),
        netSalary: parsedData.netSalary.toString(),
        taxWithheld: parsedData.taxWithheld.toString(),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const { date, companyName, grossSalary, netSalary, taxWithheld, sourceFileName } = formData;
    
    if (!date || !grossSalary || !netSalary || !taxWithheld) {
        setError("Wszystkie pola (oprócz pliku i firmy) są wymagane.");
        return;
    }

    onSave({
      date,
      companyName: companyName || undefined,
      grossSalary: parseFloat(grossSalary),
      netSalary: parseFloat(netSalary),
      taxWithheld: parseFloat(taxWithheld),
      sourceFileName: sourceFileName || undefined,
    });
    setFormData(initialFormState); // Reset form after save
    setError(null);
  };

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
        const addedCount = await onImport(importedEntries);
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
  
  const handleBatchFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    startBatchAnalysis(Array.from(files));
    if (analysisFileInputRef.current) {
        analysisFileInputRef.current.value = "";
    }
  };

  const startBatchAnalysis = async (files: File[]) => {
    setIsAnalyzing(true);
    setAnalysisResults(files.map(f => ({ fileName: f.name, status: 'pending' })));
    setAnalysisSummary(null);

    const successfulEntries: Omit<SalaryEntry, 'id'>[] = [];
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setAnalysisResults(prev => prev.map((r, index) => index === i ? { ...r, status: 'processing' } : r));
        
        try {
            const parsedData = await parsePayslipWithGemini(file);
            if (!parsedData.date || !parsedData.grossSalary || !parsedData.netSalary) {
                throw new Error("Brak kluczowych danych (data, brutto, netto).");
            }
            successfulEntries.push({ ...parsedData, sourceFileName: file.name });
            setAnalysisResults(prev => prev.map((r, index) => index === i ? { ...r, status: 'success' } : r));
        } catch (err) {
            errorCount++;
            const errorMessage = err instanceof Error ? err.message : 'Nieznany błąd.';
            setAnalysisResults(prev => prev.map((r, index) => index === i ? { ...r, status: 'error', error: errorMessage } : r));
        }
    }

    let addedCount = 0;
    if (successfulEntries.length > 0) {
        addedCount = await onImport(successfulEntries);
    }

    setAnalysisSummary({ success: addedCount, error: errorCount + (successfulEntries.length - addedCount) });
    setIsAnalyzing(false);
  };

  const clearAnalysisState = () => {
    setAnalysisResults([]);
    setAnalysisSummary(null);
  }
  
  const triggerAnalysisFileInput = () => {
    clearAnalysisState();
    analysisFileInputRef.current?.click();
  };

  return (
    <div className="space-y-8">
      {/* SECTION 1: ADD SINGLE ENTRY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-1 bg-white p-6 rounded-lg border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-700 mb-1">Prześlij Lønnsslipp</h3>
            <p className="text-sm text-slate-500 mb-4">Automatycznie uzupełnij formularz, przesyłając dokument (PDF lub obraz).</p>
          
            <label htmlFor="file-upload" className="relative cursor-pointer bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:border-sky-500 transition-colors">
              {isParsing ? (
                  <>
                      <SpinnerIcon />
                      <span className="mt-2 text-sm font-medium text-slate-600">Analizowanie...</span>
                  </>
              ) : (
                  <>
                      <UploadIcon />
                      <span className="mt-2 text-sm font-medium text-sky-600">Wybierz plik</span>
                      <span className="text-xs text-slate-500">PDF, PNG, JPG</span>
                  </>
              )}
            </label>
            <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".pdf,.png,.jpg,.jpeg" disabled={isParsing} />
            {formData.sourceFileName && !isParsing && (
              <div className="mt-4 text-sm text-slate-600 bg-green-50 border border-green-200 rounded-md p-2 text-center">
                Załadowano: <span className="font-semibold">{formData.sourceFileName}</span>
              </div>
            )}
        </div>

        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-4">{isEditing ? 'Edytuj Wpis Wypłaty' : 'Nowy Wpis Wypłaty'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                  <label htmlFor="companyName" className="block text-sm font-medium text-slate-600">Nazwa firmy</label>
                  <input type="text" name="companyName" id="companyName" value={formData.companyName} onChange={handleInputChange} placeholder="np. Fjord Technologies AS" className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm bg-white" />
              </div>
              <div>
                  <label htmlFor="date" className="block text-sm font-medium text-slate-600">Data wypłaty</label>
                  <input type="date" name="date" id="date" value={formData.date} onChange={handleInputChange} required className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm bg-white" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                  <label htmlFor="grossSalary" className="block text-sm font-medium text-slate-600">Brutto (kr)</label>
                  <input type="number" step="0.01" name="grossSalary" id="grossSalary" value={formData.grossSalary} onChange={handleInputChange} placeholder="np. 50000.00" required className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm bg-white" />
              </div>
              <div>
                  <label htmlFor="taxWithheld" className="block text-sm font-medium text-slate-600">Podatek (kr)</label>
                  <input type="number" step="0.01" name="taxWithheld" id="taxWithheld" value={formData.taxWithheld} onChange={handleInputChange} placeholder="np. 15000.00" required className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm bg-white" />
              </div>
              <div>
                  <label htmlFor="netSalary" className="block text-sm font-medium text-slate-600">Netto (kr)</label>
                  <input type="number" step="0.01" name="netSalary" id="netSalary" value={formData.netSalary} onChange={handleInputChange} placeholder="np. 35000.00" required className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm bg-white" />
              </div>
            </div>
            
            {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</p>}
            
            <div className="pt-2 flex justify-end items-center gap-4">
              {isEditing && (
                  <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2">
                      Anuluj
                  </button>
              )}
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-transparent bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
                disabled={isParsing}
              >
                <SaveIcon />
                <span>{isEditing ? 'Zapisz Zmiany' : 'Zapisz Wpis'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {/* SECTION 2: ANALYSIS RESULTS (CONDITIONAL) */}
      {analysisResults.length > 0 && (
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-700 mb-4">Postęp Analizy</h3>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                  {analysisResults.map((result, index) => (
                      <div key={index}>
                          <div className="flex items-center justify-between text-sm p-2 rounded-md bg-slate-50">
                              <span className="truncate pr-4">{result.fileName}</span>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                  {result.status === 'pending' && <span className="text-slate-500">Oczekuje...</span>}
                                  {result.status === 'processing' && <SpinnerIcon className="h-4 w-4 text-sky-600" />}
                                  {result.status === 'success' && <CheckCircleIcon className="h-5 w-5 text-green-600" />}
                                  {result.status === 'error' && <XCircleIcon className="h-5 w-5 text-red-600" />}
                              </div>
                          </div>
                          {result.status === 'error' && result.error && (
                              <p className="text-xs text-red-600 mt-1 pl-2">{result.error}</p>
                          )}
                      </div>
                  ))}
              </div>
              {analysisSummary && (
                  <div className="mt-4 border-t pt-4">
                      <h4 className="font-semibold text-slate-800">Analiza zakończona</h4>
                      <p className="text-sm text-green-700">Pomyślnie dodano {analysisSummary.success} nowych wpisów (pominięto duplikaty).</p>
                      {analysisSummary.error > 0 && (
                          <p className="text-sm text-red-700">{analysisSummary.error} plików nie udało się przetworzyć.</p>
                      )}
                      <button onClick={clearAnalysisState} className="mt-4 px-3 py-1 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200">
                          Zamknij
                      </button>
                  </div>
              )}
          </div>
      )}

      {/* SECTION 3: BATCH ANALYSIS */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Analiza Wsadowa Lønnsslipp</h3>
          <p className="text-sm text-slate-500 mb-4">
            Prześlij wiele plików (PDF/obraz), aby automatycznie dodać wpisy do historii.
          </p>
            <input type="file" ref={analysisFileInputRef} onChange={handleBatchFileSelect} className="sr-only" accept=".pdf,.png,.jpg,.jpeg" disabled={isAnalyzing} multiple />
            <button 
              onClick={triggerAnalysisFileInput}
              disabled={isAnalyzing}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-transparent bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? <SpinnerIcon /> : <AnalysisIcon />}
              <span>{isAnalyzing ? 'Analizowanie...' : 'Wybierz pliki i analizuj'}</span>
          </button>
      </div>

      {/* SECTION 4: IMPORT/EXPORT */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Import i Eksport Danych</h3>
          <p className="text-sm text-slate-500 mb-4">
            Zapisz kopię zapasową w pliku XML lub zaimportuj dane z istniejącego pliku.
          </p>
          <div className="flex flex-wrap gap-4">
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="sr-only" accept="application/xml, text/xml" disabled={isImporting} />
              <button 
                onClick={triggerFileInput}
                disabled={isImporting}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:bg-slate-200 disabled:cursor-not-allowed"
              >
                  {isImporting ? <SpinnerIcon /> : <ImportIcon />}
                  <span>Importuj XML</span>
              </button>
              <button 
                onClick={handleExport}
                disabled={isImporting}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:bg-slate-200 disabled:cursor-not-allowed"
              >
                  <ExportIcon />
                  <span>Eksportuj XML</span>
              </button>
              <button 
                onClick={onDeleteAll}
                disabled={isImporting || isAnalyzing}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:bg-slate-200 disabled:cursor-not-allowed"
              >
                  <DeleteIcon />
                  <span>Usuń Wszystko</span>
              </button>
          </div>
          {importStatus.successCount !== null && (
            <div className="mt-4 text-sm text-green-700 bg-green-50 p-2 rounded-md">
              Pomyślnie zaimportowano {importStatus.successCount} nowych wpisów.
            </div>
          )}
          {importStatus.error && (
            <div className="mt-4 text-sm text-red-700 bg-red-50 p-2 rounded-md whitespace-pre-wrap">
              <strong>Błąd importu XML:</strong> {importStatus.error}
            </div>
          )}
      </div>
    </div>
  );
};
