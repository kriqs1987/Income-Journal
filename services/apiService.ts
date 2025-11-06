
import { SalaryEntry } from '../types';

// Załóżmy, że plik api.php znajduje się w głównym katalogu serwera.
// W środowisku produkcyjnym warto użyć pełnego adresu URL.
const API_BASE_URL = 'https://v442.mikr.dev/income/api.php'; 

// Funkcja pomocnicza do obsługi odpowiedzi z API
const handleResponse = async <T>(response: Response): Promise<T> => {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Wystąpił nieznany błąd serwera.' }));
        throw new Error(errorData.message || `Błąd HTTP! Status: ${response.status}`);
    }
    return response.json();
};

export const getEntries = async (): Promise<SalaryEntry[]> => {
    const response = await fetch(`${API_BASE_URL}?action=get`);
    const entries = await handleResponse<SalaryEntry[]>(response);
    // Upewnij się, że wartości liczbowe są liczbami, a nie stringami
    return entries.map(entry => ({
        ...entry,
        grossSalary: Number(entry.grossSalary),
        netSalary: Number(entry.netSalary),
        taxWithheld: Number(entry.taxWithheld),
    }));
};

export const addEntry = async (entry: Omit<SalaryEntry, 'id'>): Promise<SalaryEntry> => {
    const response = await fetch(`${API_BASE_URL}?action=add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
    });
    return handleResponse<SalaryEntry>(response);
};

export const updateEntry = async (entry: SalaryEntry): Promise<SalaryEntry> => {
    const response = await fetch(`${API_BASE_URL}?action=update&id=${entry.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
    });
    return handleResponse<SalaryEntry>(response);
};

export const deleteEntry = async (id: string): Promise<{ success: boolean }> => {
    const response = await fetch(`${API_BASE_URL}?action=delete&id=${id}`, {
        method: 'POST',
    });
    return handleResponse<{ success: boolean }>(response);
};

export const deleteAllEntries = async (): Promise<{ success: boolean }> => {
    const response = await fetch(`${API_BASE_URL}?action=deleteAll`, {
        method: 'POST',
    });
    return handleResponse<{ success: boolean }>(response);
};

export const importEntries = async (entries: Omit<SalaryEntry, 'id'>[]): Promise<SalaryEntry[]> => {
    const response = await fetch(`${API_BASE_URL}?action=import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entries),
    });
    return handleResponse<SalaryEntry[]>(response);
};
