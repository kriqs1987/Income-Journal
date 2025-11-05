
import React, { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import { SalaryEntry } from '../types';
import { parsePayslipWithGemini } from '../services/geminiService';
import { UploadIcon, SpinnerIcon, SaveIcon } from './Icons';

interface AddEntryProps {
  onSave: (entry: Omit<SalaryEntry, 'id'>) => void;
  entryToEdit?: SalaryEntry | null;
  onCancel: () => void;
}

const initialFormState = {
  date: new Date().toISOString().split('T')[0],
  companyName: '',
  grossSalary: '',
  netSalary: '',
  taxWithheld: '',
  sourceFileName: '',
};

export const AddEntry: React.FC<AddEntryProps> = ({ onSave, entryToEdit, onCancel }) => {
  const [formData, setFormData] = useState(initialFormState);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
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
  );
};
