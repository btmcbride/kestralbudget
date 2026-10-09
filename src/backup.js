const BACKUP_VERSION = 1;
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function isEntry(value) {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && Number.isFinite(value.planned)
    && Number.isFinite(value.actual)
    && (value.dueDate === undefined || typeof value.dueDate === 'string');
}

function isCategory(value) {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.type === 'string'
    && typeof value.name === 'string'
    && Array.isArray(value.entries)
    && value.entries.every(isEntry);
}

function isBudget(value) {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.month === 'string'
    && (value.seriesId === undefined || typeof value.seriesId === 'string')
    && (value.carryoverMethod === undefined || ['actual', 'planned'].includes(value.carryoverMethod))
    && (value.selectedTypes === undefined || (Array.isArray(value.selectedTypes) && value.selectedTypes.every((type) => typeof type === 'string')))
    && Array.isArray(value.categories)
    && value.categories.every(isCategory)
    && (value.transactions === undefined || (Array.isArray(value.transactions) && value.transactions.every((transaction) =>
      isRecord(transaction)
      && typeof transaction.id === 'string'
      && typeof transaction.date === 'string'
      && typeof transaction.description === 'string'
      && Number.isFinite(transaction.amount)
      && typeof transaction.categoryId === 'string'
      && (transaction.entryId === null || typeof transaction.entryId === 'string')
    )))
    && (value.incomeSchedules === undefined || (Array.isArray(value.incomeSchedules) && value.incomeSchedules.every((schedule) =>
      isRecord(schedule)
      && typeof schedule.id === 'string'
      && typeof schedule.name === 'string'
      && Number.isFinite(schedule.amount)
      && ['weekly', 'biweekly', 'monthly'].includes(schedule.frequency)
      && typeof schedule.nextPayday === 'string'
    )))
    && (value.expenseSchedules === undefined || (Array.isArray(value.expenseSchedules) && value.expenseSchedules.every((schedule) =>
      isRecord(schedule)
      && typeof schedule.id === 'string'
      && typeof schedule.categoryId === 'string'
      && value.categories.some((category) => category.id === schedule.categoryId)
      && typeof schedule.name === 'string'
      && Number.isFinite(schedule.amount)
      && ['weekly', 'biweekly', 'monthly', 'yearly'].includes(schedule.frequency)
      && typeof schedule.nextDueDate === 'string'
      && (schedule.paused === undefined || typeof schedule.paused === 'boolean')
    )));
}

function isBudgetState(value) {
  return isRecord(value)
    && Array.isArray(value.budgets)
    && value.budgets.every(isBudget)
    && (value.active === null || typeof value.active === 'string')
    && (value.preferences === undefined || (
      isRecord(value.preferences)
      && (value.preferences.defaultBudgetId === undefined || value.preferences.defaultBudgetId === null || typeof value.preferences.defaultBudgetId === 'string')
      && (value.preferences.userName === undefined || value.preferences.userName === null || typeof value.preferences.userName === 'string')
      && (value.preferences.transactionSortField === undefined || ['date', 'type', 'category', 'description', 'amount'].includes(value.preferences.transactionSortField))
      && (value.preferences.transactionSortDirection === undefined || value.preferences.transactionSortDirection === 'asc' || value.preferences.transactionSortDirection === 'desc')
      && (value.preferences.theme === undefined || ['system', 'light', 'dark'].includes(value.preferences.theme))
      && (value.preferences.carryoverMethod === undefined || ['actual', 'planned'].includes(value.preferences.carryoverMethod))
      && (value.preferences.weekStartsOn === undefined || ['sunday', 'monday'].includes(value.preferences.weekStartsOn))
      && (value.preferences.accentColor === undefined || ['forest', 'blue', 'purple', 'amber', 'rose'].includes(value.preferences.accentColor))
      && (value.preferences.density === undefined || ['comfortable', 'compact'].includes(value.preferences.density))
      && (value.preferences.textSize === undefined || ['small', 'medium', 'large', 'larger'].includes(value.preferences.textSize))
      && (value.preferences.currency === undefined || ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'JPY', 'CNY', 'INR', 'CHF', 'MXN', 'BRL'].includes(value.preferences.currency))
      && (value.preferences.dateFormat === undefined || ['mdy', 'dmy', 'iso'].includes(value.preferences.dateFormat))
    ));
}

export function createBackup(state, createdAt = new Date().toISOString()) {
  if (!isBudgetState(state)) throw new TypeError('Cannot back up invalid budget data.');
  return JSON.stringify({
    format: 'kestralbudget-backup',
    version: BACKUP_VERSION,
    createdAt,
    budgets: state.budgets,
    active: state.active,
    preferences: state.preferences ?? { defaultBudgetId: null, userName: null, transactionSortField: 'date', transactionSortDirection: 'desc' },
  }, null, 2);
}

export function parseBackup(contents) {
  const backup = JSON.parse(contents);
  if (backup?.format !== 'kestralbudget-backup' || backup.version !== BACKUP_VERSION || !isBudgetState(backup)) {
    throw new TypeError('This file is not a valid Kestral Budget backup.');
  }
  return {
    budgets: backup.budgets,
    active: backup.active,
    preferences: backup.preferences ?? { defaultBudgetId: null, userName: null, transactionSortField: 'date', transactionSortDirection: 'desc' },
  };
}