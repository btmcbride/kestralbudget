export function getDefaultBudgetId(preferences = {}) {
  return preferences.defaultBudgetId ?? null;
}

export function setDefaultBudgetId(preferences = {}, budgetId) {
  return { ...preferences, defaultBudgetId: budgetId ?? null };
}
