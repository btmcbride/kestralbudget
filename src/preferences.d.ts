export interface BudgetPreferences {
  defaultBudgetId: string | null;
  userName?: string | null;
  transactionSortField?: 'date' | 'type' | 'category' | 'description' | 'amount';
  transactionSortDirection?: 'asc' | 'desc';
  theme?: 'system' | 'light' | 'dark';
}

export function getDefaultBudgetId(preferences?: Partial<BudgetPreferences>): string | null;
export function setDefaultBudgetId(preferences: Partial<BudgetPreferences>, budgetId: string | null): BudgetPreferences;
