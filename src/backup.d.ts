export interface BackupState {
  budgets: unknown[];
  active: string | null;
  preferences?: { defaultBudgetId: string | null; userName?: string | null; transactionSortField?: 'date' | 'type' | 'category' | 'description' | 'amount'; transactionSortDirection?: 'asc' | 'desc'; theme?: 'system' | 'light' | 'dark' };
}

export function createBackup(state: BackupState, createdAt?: string): string;
export function parseBackup(contents: string): BackupState & { preferences: { defaultBudgetId: string | null; userName?: string | null; transactionSortField?: 'date' | 'type' | 'category' | 'description' | 'amount'; transactionSortDirection?: 'asc' | 'desc'; theme?: 'system' | 'light' | 'dark' } };