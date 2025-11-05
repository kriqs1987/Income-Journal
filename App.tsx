
import React, { useState, useCallback, useEffect } from 'react';
import { AddEntry } from './components/AddEntry';
import { SalaryHistory } from './components/SalaryHistory';
import { SalaryEntry } from './types';
import { DziennikIcon, HistoryIcon, PlusCircleIcon } from './components/Icons';
import { ConfirmDialog } from './components/ConfirmDialog';

type ActiveTab = 'add' | 'history';

interface ConfirmationState {
  isOpen: boolean;
  message: string;
  onConfirm?: () => void;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('add');
  const [editingEntry, setEditingEntry] = useState<SalaryEntry | null>(null);
  const [salaryEntries, setSalaryEntries] = useState<SalaryEntry[]>(() => {
    // Lazy initial state to load from localStorage
    try {
      const savedEntries = localStorage.getItem('salaryEntries');
      return savedEntries ? JSON.parse(savedEntries) : [];
    } catch (error) {
      console.error("Could not parse salary entries from localStorage", error);
      return [];
    }
  });
  
  const [confirmationState, setConfirmationState] = useState<ConfirmationState>({
    isOpen: false,
    message: '',
  });

  useEffect(() => {
    // Persist to localStorage whenever entries change
    localStorage.setItem('salaryEntries', JSON.stringify(salaryEntries));
  }, [salaryEntries]);

  const handleSaveEntry = useCallback((entryData: Omit<SalaryEntry, 'id'>) => {
    if (editingEntry) {
      // Update existing entry
      const updatedEntries = salaryEntries.map(e =>
        e.id === editingEntry.id ? { ...editingEntry, ...entryData } : e
      );
      setSalaryEntries(updatedEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } else {
      // Add new entry
      const newEntry: SalaryEntry = {
        ...entryData,
        id: new Date().toISOString() + Math.random().toString(),
      };
      setSalaryEntries(prevEntries => [...prevEntries, newEntry].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }
    setEditingEntry(null);
    setActiveTab('history');
  }, [salaryEntries, editingEntry]);
  
  const handleStartEdit = useCallback((entry: SalaryEntry) => {
    setEditingEntry(entry);
    setActiveTab('add');
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingEntry(null);
    setActiveTab('history');
  }, []);

  const handleConfirm = () => {
    if (confirmationState.onConfirm) {
      confirmationState.onConfirm();
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
      onConfirm: () => {
        setSalaryEntries(prevEntries => prevEntries.filter(entry => entry.id !== idToDelete));
      }
    });
  }, []);

  const handleDeleteAllEntries = useCallback(() => {
    setConfirmationState({
      isOpen: true,
      message: 'Czy na pewno chcesz usunąć WSZYSTKIE wpisy? Tej operacji nie można cofnąć.',
      onConfirm: () => {
        setSalaryEntries([]);
        localStorage.removeItem('salaryEntries');
      }
    });
  }, []);

  const handleImportEntries = useCallback((importedEntries: Omit<SalaryEntry, 'id'>[]): number => {
      const existingDates = new Set(salaryEntries.map(e => e.date));
      const newUniqueEntries = importedEntries.filter(imported => !existingDates.has(imported.date));

      if (newUniqueEntries.length > 0) {
        const entriesToAdd: SalaryEntry[] = newUniqueEntries.map(entry => ({
          ...entry,
          id: new Date().toISOString() + Math.random().toString(),
        }));

        setSalaryEntries(prevEntries => 
          [...prevEntries, ...entriesToAdd].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        );
      }
      return newUniqueEntries.length; // Return how many were actually added
    }, [salaryEntries]);

  const TabButton: React.FC<{
    tabName: ActiveTab;
    label: string;
    icon: React.ReactNode;
    }> = ({ tabName, label, icon }) => (
    <button
      onClick={() => {
        setActiveTab(tabName);
        if (tabName === 'add') {
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
      <div className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <header className="mb-8">
            <div className="flex items-center gap-4 mb-2">
              <DziennikIcon />
              <h1 className="text-3xl font-bold text-slate-800">Dziennik Zarobków</h1>
            </div>
            <p className="text-slate-500">Twoje osobiste centrum finansów w Norwegii.</p>
          </header>

          <nav className="mb-8 p-1.5 bg-slate-200 rounded-lg max-w-md mx-auto sm:mx-0 sm:max-w-sm flex gap-2">
            <TabButton tabName="add" label="Dodaj Wpis" icon={<PlusCircleIcon />} />
            <TabButton tabName="history" label="Historia" icon={<HistoryIcon />} />
          </nav>

          <main>
            {activeTab === 'add' && <AddEntry onSave={handleSaveEntry} entryToEdit={editingEntry} onCancel={handleCancelEdit} />}
            {activeTab === 'history' && <SalaryHistory entries={salaryEntries} onEdit={handleStartEdit} onDelete={handleDeleteEntry} onImport={handleImportEntries} onDeleteAll={handleDeleteAllEntries} />}
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
