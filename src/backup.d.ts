export interface BackupState {
  budgets: unknown[];
  active: string | null;
  preferences?: { defaultBudgetId: string | null; userName?: string | null };
}

export function createBackup(state: BackupState, createdAt?: string): string;
export function parseBackup(contents: string): BackupState & { preferences: { defaultBudgetId: string | null; userName?: string | null } };