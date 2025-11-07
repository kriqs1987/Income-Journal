
import React, { useState, useCallback, useEffect } from 'react';
import { AddEntry } from './components/AddEntry';
import { SalaryHistory } from './components/SalaryHistory';
import { SalaryEntry } from './types';
import { DziennikIcon, HistoryIcon, PlusCircleIcon, SpinnerIcon } from './components/Icons';
import { ConfirmDialog } from './components/ConfirmDialog';
import * as api from './services/apiService';

type ActiveTab = 'add' | 'history';

interface ConfirmationState {
  isOpen: boolean;
  message: string;
  onConfirm?: () => void | Promise<void>;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('history');
  const [editingEntry, setEditingEntry] = useState<SalaryEntry | null>(null);
  const [salaryEntries, setSalaryEntries] = useState<SalaryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [confirmationState, setConfirmationState] = useState<ConfirmationState>({
    isOpen: false,
    message: '',
  });

  useEffect(() => {
    const loadEntries = async () => {
      try {
        setIsLoading(true);
        const entries = await api.getEntries();
        setSalaryEntries(entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Nie udało się załadować danych z serwera.';
        setError(errorMessage);
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    loadEntries();
  }, []);

  const handleSaveEntry = useCallback(async (entryData: Omit<SalaryEntry, 'id'>) => {
    try {
      if (editingEntry) {
        const updatedEntry = await api.updateEntry({ ...editingEntry, ...entryData });
        const updatedEntries = salaryEntries.map(e =>
          e.id === updatedEntry.id ? updatedEntry : e
        );
        setSalaryEntries(updatedEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      } else {
        const newEntry = await api.addEntry(entryData);
        setSalaryEntries(prevEntries => [...prevEntries, newEntry].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      }
      setEditingEntry(null);
      setActiveTab('history');
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Nie udało się zapisać wpisu.';
      setError(errorMessage);
      console.error(err);
    }
  }, [salaryEntries, editingEntry]);
  
  const handleStartEdit = useCallback((entry: SalaryEntry) => {
    setEditingEntry(entry);
    setActiveTab('add');
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingEntry(null);
    setActiveTab('history');
  }, []);

  const handleConfirm = async () => {
    if (confirmationState.onConfirm) {
      await confirmationState.onConfirm();
    }
    setConfirmationState({ isOpen: false, message: '', onConfirm: undefined });
  };

  const handleCancelConfirmation = () => {
    setConfirmationState({ isOpen: false, message: '', onConfirm: undefined });
  };
  
  const handleDeleteEntry = useCallback((idToDelete: string) => {
    setConfirmationState({
      isOpen: true,
      message: 'Czy na pewno chcesz usunąć ten wpis? Tej operacji nie można cofnąć.',
      onConfirm: async () => {
        try {
          await api.deleteEntry(idToDelete);
          setSalaryEntries(prevEntries => prevEntries.filter(entry => entry.id !== idToDelete));
          setError(null);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Nie udało się usunąć wpisu.';
          setError(errorMessage);
          console.error(err);
        }
      }
    });
  }, []);

  const handleDeleteAllEntries = useCallback(() => {
    setConfirmationState({
      isOpen: true,
      message: 'Czy na pewno chcesz usunąć WSZYSTKIE wpisy? Tej operacji nie można cofnąć.',
      onConfirm: async () => {
        try {
          await api.deleteAllEntries();
          setSalaryEntries([]);
          setError(null);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Nie udało się usunąć wszystkich wpisów.';
          setError(errorMessage);
          console.error(err);
        }
      }
    });
  }, []);

  const handleImportEntries = useCallback(async (importedEntries: Omit<SalaryEntry, 'id'>[]): Promise<number> => {
      const existingDates = new Set(salaryEntries.map(e => e.date));
      const newUniqueEntries = importedEntries.filter(imported => !existingDates.has(imported.date));

      if (newUniqueEntries.length > 0) {
        try {
            const addedEntries = await api.importEntries(newUniqueEntries);
            setSalaryEntries(prevEntries => 
              [...prevEntries, ...addedEntries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            );
            setError(null);
            return addedEntries.length;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Nie udało się zaimportować wpisów na serwer.';
            setError(errorMessage);
            console.error(err);
            throw err; // Re-throw to be caught in SalaryHistory component UI
        }
      }
      return 0; // Return how many were actually added
    }, [salaryEntries]);

  const TabButton: React.FC<{
    tabName: ActiveTab;
    label: string;
    icon: React.ReactNode;
    }> = ({ tabName, label, icon }) => (
    <button
      onClick={() => {
        setActiveTab(tabName);
        if (tabName === 'history' && editingEntry) {
            setEditingEntry(null);
        }
      }}
      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-md transition-colors duration-200 ${
        activeTab === tabName
          ? 'bg-sky-600 text-white shadow-md'
          : 'bg-white text-slate-600 hover:bg-slate-100'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <>
      {isLoading && (
        <div className="fixed inset-0 bg-slate-100 bg-opacity-90 flex items-center justify-center z-50" aria-label="Ładowanie danych">
          <div className="flex flex-col items-center">
            <SpinnerIcon className="h-12 w-12 text-sky-600" />
            <p className="mt-4 text-lg text-slate-700 font-semibold">Ładowanie danych...</p>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg relative mb-6 shadow-md" role="alert">
              <div className="flex">
                <div className="py-1"><svg className="fill-current h-6 w-6 text-red-500 mr-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zM11.414 10l2.829-2.828-1.415-1.415L10 8.586 7.172 5.757 5.757 7.172 8.586 10l-2.829 2.828 1.415 1.415L10 11.414l2.828 2.829 1.415-1.415L11.414 10z"/></svg></div>
                <div>
                  <p className="font-bold">Błąd</p>
                  <p className="text-sm">{error}</p>
                </div>
                <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3" aria-label="Zamknij">
                  <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Zamknij</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
                </button>
              </div>
            </div>
          )}

          <header className="mb-8">
            <div className="flex items-center gap-4 mb-2">
              <DziennikIcon />
              <h1 className="text-3xl font-bold text-slate-800">Dziennik Zarobków</h1>
            </div>
            <p className="text-slate-500">Twoje osobiste centrum finansów w Norwegii.</p>
          </header>

          <nav className="mb-8 p-1.5 bg-slate-200 rounded-lg max-w-md mx-auto sm:mx-0 sm:max-w-sm flex gap-2">
            <TabButton tabName="history" label="Historia" icon={<HistoryIcon />} />
            <TabButton tabName="add" label="Dodaj Wpis" icon={<PlusCircleIcon />} />
          </nav>

          <main>
            {activeTab === 'add' && <AddEntry 
              onSave={handleSaveEntry} 
              entryToEdit={editingEntry} 
              onCancel={handleCancelEdit}
              entries={salaryEntries}
              onImport={handleImportEntries}
              onDeleteAll={handleDeleteAllEntries}
            />}
            {activeTab === 'history' && <SalaryHistory 
              entries={salaryEntries} 
              onEdit={handleStartEdit} 
              onDelete={handleDeleteEntry} 
            />}
          </main>
        </div>
      </div>
      <ConfirmDialog
        isOpen={confirmationState.isOpen}
        message={confirmationState.message}
        onConfirm={handleConfirm}
        onCancel={handleCancelConfirmation}
      />
    </>
  );
};

export default App;
