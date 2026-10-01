export interface BudgetPreferences {
  defaultBudgetId: string | null;
}

export function getDefaultBudgetId(preferences?: Partial<BudgetPreferences>): string | null;
export function setDefaultBudgetId(preferences: Partial<BudgetPreferences>, budgetId: string | null): BudgetPreferences;
