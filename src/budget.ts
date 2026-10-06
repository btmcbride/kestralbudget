import './budget.css';
import './budget-insights.css';
import './budget-workflow.css';
import './branding.css';
import './backup.css';
import './transactions.css';
import './recurring-expenses.css';
import './guided-tour.css';
import './budget-feedback.css';
import { buildExpenseEntriesForMonth, buildIncomeEntriesForMonth, type ExpenseFrequency } from './paycheck-scheduler.js';
import { createBackup, parseBackup } from './backup.js';

const KEY = 'cryptic-budgets.v1';
const GROUPS: StandardBudgetGroup[] = [
  { id: 'income', name: 'Income', color: 'green' },
  { id: 'bills', name: 'Bills', color: 'blue' },
  { id: 'expenses', name: 'Expenses', color: 'orange' },
  { id: 'subscriptions', name: 'Subscriptions', color: 'purple' },
  { id: 'debts', name: 'Debts', color: 'red' },
  { id: 'savings', name: 'Savings', color: 'teal' },
];
type StandardGroupId = 'income' | 'bills' | 'expenses' | 'subscriptions' | 'debts' | 'savings';
type BudgetGroupId = StandardGroupId | `custom:${string}`;
type PayFrequency = 'weekly' | 'biweekly' | 'monthly';
type TransactionSortField = 'date' | 'type' | 'category' | 'description' | 'amount';
type SortDirection = 'asc' | 'desc';
type TransactionSortConfig = { field: TransactionSortField; direction: SortDirection };

interface BudgetGroup {
  id: BudgetGroupId;
  name: string;
  color: string;
}

interface StandardBudgetGroup extends BudgetGroup {
  id: StandardGroupId;
}

interface RecurringIncomeSchedule {
  id: string;
  name: string;
  amount: number;
  frequency: PayFrequency;
  intervalDays: number;
  nextPayday: string;
}

interface RecurringExpenseSchedule {
  id: string;
  categoryId: string;
  name: string;
  amount: number;
  frequency: ExpenseFrequency;
  intervalDays: number;
  nextDueDate: string;
  paused?: boolean;
}

interface BudgetEntry {
  id: string;
  name: string;
  planned: number;
  actual: number;
  dueDate?: string;
  scheduleId?: string | null;
  scheduledDate?: string;
}

interface BudgetTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  categoryId: string;
  entryId: string | null;
}

interface BudgetCategory {
  id: string;
  type: BudgetGroupId;
  typeName?: string;
  name: string;
  entries: BudgetEntry[];
}

interface Budget {
  id: string;
  seriesId: string;
  name: string;
  month: string;
  carryover: number;
  carryoverMethod?: CarryoverMethod;
  selectedTypes: BudgetGroupId[];
  categories: BudgetCategory[];
  transactions: BudgetTransaction[];
  incomeSchedules: RecurringIncomeSchedule[];
  expenseSchedules: RecurringExpenseSchedule[];
}

type ThemePreference = 'system' | 'light' | 'dark';
type CarryoverMethod = 'actual' | 'planned';
type WeekStart = 'sunday' | 'monday';
type AccentColor = 'forest' | 'blue' | 'purple' | 'amber' | 'rose';
type DensityPreference = 'comfortable' | 'compact';
type TextSizePreference = 'small' | 'medium' | 'large';
type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'NZD' | 'JPY' | 'CNY' | 'INR' | 'CHF' | 'MXN' | 'BRL';
type DateFormat = 'mdy' | 'dmy' | 'iso';
interface AppPreferences {
  defaultBudgetId: string | null;
  transactionSortField?: TransactionSortField;
  transactionSortDirection?: SortDirection;
  theme?: ThemePreference;
  carryoverMethod?: CarryoverMethod;
  weekStartsOn?: WeekStart;
  accentColor?: AccentColor;
  density?: DensityPreference;
  textSize?: TextSizePreference;
  currency?: CurrencyCode;
  dateFormat?: DateFormat;
}

interface AppState {
  budgets: Budget[];
  active: string | null;
  view: 'dashboard' | 'transactions' | 'subscriptions' | 'review' | 'reports' | 'settings';
  preferences: AppPreferences;
}

interface WizardState {
  budgetId: string;
  groups: BudgetGroupId[];
  step: number;
}

interface AmountTotals {
  planned: number;
  actual: number;
}

interface DashboardTotals {
  income: AmountTotals;
  out: AmountTotals;
  carryover: number;
  plannedLeft: number;
  actualLeft: number;
}

const PAY_FREQUENCIES: Array<{ value: PayFrequency; label: string; description: string }> = [
  { value: 'weekly', label: 'Weekly', description: 'Every 7 days' },
  { value: 'biweekly', label: 'Biweekly', description: 'Every 14 days' },
  { value: 'monthly', label: 'Monthly', description: 'Once per month on the same day' },
];
const EXPENSE_FREQUENCIES: Array<{ value: ExpenseFrequency; label: string; description: string }> = [
  ...PAY_FREQUENCIES,
  { value: 'yearly', label: 'Yearly', description: 'Once per year' },
];
const GUIDED_TOUR_STEPS: Array<{ selector: string; view: 'overview' | 'transactions'; title: string; body: string }> = [
  { selector: '.budget-tabs', view: 'overview', title: 'Move between months', body: 'The month tabs switch between monthly plans. Choose + to create the next month; planned items carry forward, actuals reset, and the carryover follows your selected rule.' },
  { selector: '.metric-grid', view: 'overview', title: 'Read your monthly totals', body: 'Compare planned and actual income plus carryover, unallocated income, and allocated income.' },
  { selector: '.at-a-glance', view: 'overview', title: 'Review income and categories', body: 'Expand Income or Categories to see planned, actual, and difference details. Collapse either section to keep its totals visible.' },
  { selector: '.categories-section .section-title-row', view: 'overview', title: 'Organize your plan', body: 'Categories hold your budget items. Add categories, items, or recurring expenses here.' },
  { selector: '.transactions-panel .transaction-tools', view: 'transactions', title: 'Find and manage activity', body: 'Search and filter by budget item or category, then select visible transactions for bulk deletion.' },
  { selector: '.sidebar .backup-actions', view: 'overview', title: 'Protect your data', body: 'Export a backup or restore your budget from a previous backup.' },
];
const payFrequencyInterval = (frequency: PayFrequency): number => ({ weekly: 7, biweekly: 14, monthly: 30 }[frequency] ?? 14);
const expenseFrequencyInterval = (frequency: ExpenseFrequency): number => frequency === 'yearly' ? 365 : payFrequencyInterval(frequency);
const root = document.createElement('div');
root.id = 'budget-app';
const dialog = document.createElement('dialog');
dialog.className = 'dialog';
dialog.id = 'app-dialog';
document.body.replaceChildren(root, dialog);
const uid = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
const defaultCategories = (types: BudgetGroupId[] = GROUPS.map((g) => g.id)): BudgetCategory[] => GROUPS.filter((g) => types.includes(g.id)).map((g) => ({ id: uid(), type: g.id, name: g.name, entries: [] }));
const DEFAULT_TRANSACTION_SORT: TransactionSortConfig = { field: 'date', direction: 'desc' };
const isCarryoverMethod = (value: unknown): value is CarryoverMethod => value === 'actual' || value === 'planned';
const ACCENT_COLORS: Array<[AccentColor, string]> = [['forest', 'Forest green'], ['blue', 'Blue'], ['purple', 'Purple'], ['amber', 'Amber'], ['rose', 'Rose']];
const DENSITIES: Array<[DensityPreference, string]> = [['comfortable', 'Comfortable'], ['compact', 'Compact']];
const TEXT_SIZES: Array<[TextSizePreference, string]> = [['small', 'Small'], ['medium', 'Default'], ['large', 'Large']];
const CURRENCIES: Array<[CurrencyCode, string]> = [
  ['USD', 'US dollar (USD)'], ['EUR', 'Euro (EUR)'], ['GBP', 'British pound (GBP)'], ['CAD', 'Canadian dollar (CAD)'],
  ['AUD', 'Australian dollar (AUD)'], ['NZD', 'New Zealand dollar (NZD)'], ['JPY', 'Japanese yen (JPY)'],
  ['CNY', 'Chinese yuan (CNY)'], ['INR', 'Indian rupee (INR)'], ['CHF', 'Swiss franc (CHF)'],
  ['MXN', 'Mexican peso (MXN)'], ['BRL', 'Brazilian real (BRL)'],
];
const DATE_FORMATS: Array<[DateFormat, string]> = [
  ['mdy', 'Month day, year (Oct 6, 2026)'],
  ['dmy', 'Day month year (6 Oct 2026)'],
  ['iso', 'ISO 8601 (2026-10-06)'],
];
const isAccentColor = (value: unknown): value is AccentColor => ACCENT_COLORS.some(([option]) => option === value);
const isDensityPreference = (value: unknown): value is DensityPreference => DENSITIES.some(([option]) => option === value);
const isTextSizePreference = (value: unknown): value is TextSizePreference => TEXT_SIZES.some(([option]) => option === value);
const isCurrencyCode = (value: unknown): value is CurrencyCode => CURRENCIES.some(([option]) => option === value);
const isDateFormat = (value: unknown): value is DateFormat => DATE_FORMATS.some(([option]) => option === value);

function normalizeState(budgets: Budget[], active: string | null | undefined, preferences: Partial<AppPreferences> = {}): AppState {
  const allBudgets = budgets.filter((budget) => Array.isArray(budget.categories)).map((budget) => ({
    ...budget,
    seriesId: budget.seriesId || budget.id,
    carryover: Number(budget.carryover) || 0,
    selectedTypes: budget.selectedTypes || GROUPS.map((group) => group.id),
    transactions: Array.isArray(budget.transactions) ? budget.transactions.map((transaction) => ({ ...transaction, entryId: transaction.entryId ?? null })) : [],
    incomeSchedules: Array.isArray(budget.incomeSchedules) ? budget.incomeSchedules.map((schedule) => {
      const frequency = (schedule.frequency as PayFrequency | undefined) || ((Number(schedule.intervalDays) === 7) ? 'weekly' : (Number(schedule.intervalDays) === 14) ? 'biweekly' : 'monthly');
      return {
        ...schedule,
        amount: Number(schedule.amount) || 0,
        frequency,
        intervalDays: payFrequencyInterval(frequency),
      };
    }) : [],
    carryoverMethod: isCarryoverMethod(budget.carryoverMethod) ? budget.carryoverMethod : undefined,
    expenseSchedules: Array.isArray(budget.expenseSchedules) ? budget.expenseSchedules.map((schedule) => {
      const frequency = (schedule.frequency as ExpenseFrequency | undefined) || ((Number(schedule.intervalDays) === 7) ? 'weekly' : (Number(schedule.intervalDays) === 14) ? 'biweekly' : 'monthly');
      return {
        ...schedule,
        amount: Number(schedule.amount) || 0,
        frequency,
        intervalDays: expenseFrequencyInterval(frequency),
        paused: Boolean(schedule.paused),
      };
    }) : [],
  }));
  const validActive = active ? allBudgets.find((budget) => budget.id === active) ?? null : null;
  const defaultSeries = preferences.defaultBudgetId
    ? allBudgets.filter((budget) => budget.seriesId === preferences.defaultBudgetId)
    : [];
  const selectedSeriesId = validActive?.seriesId ?? defaultSeries.at(-1)?.seriesId ?? allBudgets.at(-1)?.seriesId ?? null;
  const normalizedBudgets = allBudgets.filter((budget) => budget.seriesId === selectedSeriesId);
  const resolvedActive = validActive?.id ?? normalizedBudgets.at(-1)?.id ?? null;
  return {
    budgets: normalizedBudgets,
    active: resolvedActive,
    view: 'dashboard',
    preferences: {
      defaultBudgetId: null,
      transactionSortField: ['date', 'type', 'category', 'description', 'amount'].includes(String(preferences.transactionSortField)) ? preferences.transactionSortField as TransactionSortField : DEFAULT_TRANSACTION_SORT.field,
      transactionSortDirection: preferences.transactionSortDirection === 'asc' ? 'asc' : DEFAULT_TRANSACTION_SORT.direction,
      theme: preferences.theme === 'light' || preferences.theme === 'dark' ? preferences.theme : 'system',
      carryoverMethod: isCarryoverMethod(preferences.carryoverMethod) ? preferences.carryoverMethod : 'actual',
      weekStartsOn: preferences.weekStartsOn === 'monday' ? 'monday' : 'sunday',
      accentColor: isAccentColor(preferences.accentColor) ? preferences.accentColor : 'forest',
      density: isDensityPreference(preferences.density) ? preferences.density : 'comfortable',
      textSize: isTextSizePreference(preferences.textSize) ? preferences.textSize : 'medium',
      currency: isCurrencyCode(preferences.currency) ? preferences.currency : 'USD',
      dateFormat: isDateFormat(preferences.dateFormat) ? preferences.dateFormat : 'mdy',
    },
  };
}
function load(): AppState {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { budgets?: Budget[]; active?: string | null; preferences?: Partial<AppPreferences> } | null;
    if (Array.isArray(data?.budgets)) return normalizeState(data.budgets, data.active, data.preferences);
  } catch { /* Start with a clean local workspace if stored data is invalid. */ }
  return normalizeState([], null);
}
const state: AppState = { budgets: [], active: null, view: 'dashboard', preferences: { defaultBudgetId: null, transactionSortField: DEFAULT_TRANSACTION_SORT.field, transactionSortDirection: DEFAULT_TRANSACTION_SORT.direction, carryoverMethod: 'actual', weekStartsOn: 'sunday', accentColor: 'forest', density: 'comfortable', textSize: 'medium', currency: 'USD', dateFormat: 'mdy' } };
let wizard: WizardState | null = null;
let guidedTourStep = 0;
let guidedTourLayer: HTMLElement | null = null;
let dashboardTab: 'overview' | 'transactions' = 'overview';
let transactionSearch = '';
let transactionCategoryFilter = 'all';
let transactionItemFilter = 'all';
const selectedTransactionIds = new Set<string>();
let saveTimer: number | undefined;
let saveQueue: Promise<void> = Promise.resolve();
let undoTimer: number | undefined;
let pendingUndo: (() => void) | null = null;
const HTML_ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);
const currencyFormatters = new Map<CurrencyCode, Intl.NumberFormat>();
const fmt = (value: number): string => {
  const currency = state.preferences.currency ?? 'USD';
  let formatter = currencyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat(navigator.language, { style: 'currency', currency });
    currencyFormatters.set(currency, formatter);
  }
  return formatter.format(Number(value) || 0);
};
const group = (type: BudgetGroupId): BudgetGroup => GROUPS.find((item) => item.id === type) || { id: type, name: current()?.categories.find((category) => category.type === type)?.typeName || type.replace(/^custom:/, ''), color: 'teal' };
const current = (): Budget | null => state.budgets.find((budget) => budget.id === state.active) || null;
const transactionSortConfig = (): TransactionSortConfig => ({
  field: state.preferences.transactionSortField ?? DEFAULT_TRANSACTION_SORT.field,
  direction: state.preferences.transactionSortDirection ?? DEFAULT_TRANSACTION_SORT.direction,
});
const transactionSortLabel = (field: TransactionSortField): string => ({ date: 'Date', type: 'Budget item', category: 'Category', description: 'Description', amount: 'Amount' })[field];
const transactionTypeName = (budget: Budget, transaction: BudgetTransaction): string => {
  const category = budget.categories.find((item) => item.id === transaction.categoryId);
  return category?.entries.find((entry) => entry.id === transaction.entryId)?.name ?? category?.name ?? 'Uncategorized';
};
const sortTransactions = (budget: Budget): BudgetTransaction[] => {
  const { field, direction } = transactionSortConfig();
  const factor = direction === 'asc' ? 1 : -1;
  return [...budget.transactions].sort((left, right) => {
    const leftCategory = budget.categories.find((item) => item.id === left.categoryId);
    const rightCategory = budget.categories.find((item) => item.id === right.categoryId);
    const leftType = transactionTypeName(budget, left);
    const rightType = transactionTypeName(budget, right);
    const leftCategoryName = leftCategory ? group(leftCategory.type).name : 'Uncategorized';
    const rightCategoryName = rightCategory ? group(rightCategory.type).name : 'Uncategorized';
    if (field === 'amount') return ((left.amount - right.amount) || right.date.localeCompare(left.date)) * factor;
    if (field === 'type') return ((leftType.localeCompare(rightType) || left.date.localeCompare(right.date) || left.description.localeCompare(right.description)) * factor);
    if (field === 'category') return ((leftCategoryName.localeCompare(rightCategoryName) || left.date.localeCompare(right.date) || left.description.localeCompare(right.description)) * factor);
    if (field === 'description') return ((left.description.localeCompare(right.description) || left.date.localeCompare(right.date)) * factor);
    return left.date.localeCompare(right.date) * factor || left.description.localeCompare(right.description);
  });
};
const setTransactionSort = (field: TransactionSortField, direction: SortDirection = transactionSortConfig().direction): void => {
  state.preferences = { ...state.preferences, transactionSortField: field, transactionSortDirection: direction };
  persist();
  render();
};
const seriesBudgets = (seriesId: string): Budget[] => state.budgets.filter((budget) => budget.seriesId === seriesId).sort((a, b) => a.month.localeCompare(b.month));
const latestInSeries = (seriesId: string | undefined): Budget | null => seriesId ? seriesBudgets(seriesId).at(-1) || null : null;
const groupsFor = (budget: Budget): BudgetGroup[] => {
  const enabled = new Set([...(budget.selectedTypes || GROUPS.map((g) => g.id)), ...budget.categories.map((c) => c.type)]);
  return [
    ...GROUPS.filter((item) => enabled.has(item.id)),
    ...[...new Set(budget.categories.filter((category) => category.type.startsWith('custom:')).map((category) => category.type))]
    .map((type) => ({ id: type, name: budget.categories.find((category) => category.type === type)?.typeName || type.slice(7), color: 'teal' })),
  ];
};
const monthText = (month: string): string => {
  const [year, monthNumber] = month.split('-').map(Number);
  if (!year || !monthNumber) return 'New budget';
  if (state.preferences.dateFormat === 'iso') return `${year}-${String(monthNumber).padStart(2, '0')}`;
  const locale = state.preferences.dateFormat === 'dmy' ? 'en-GB' : 'en-US';
  return new Date(year, monthNumber - 1, 1).toLocaleDateString(locale, { month: 'short', year: 'numeric' });
};
const dateFormatters: Record<Exclude<DateFormat, 'iso'>, Intl.DateTimeFormat> = {
  mdy: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  dmy: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
};
const displayDate = (date: string): string => {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  if (state.preferences.dateFormat === 'iso') return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const format = state.preferences.dateFormat === 'dmy' ? 'dmy' : 'mdy';
  return dateFormatters[format].format(new Date(year, month - 1, day));
};
async function putState(budgets: Budget[], active: string | null, preferences: AppPreferences = state.preferences): Promise<void> {
  const response = await fetch('/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ budgets, active, preferences }),
  });
  if (!response.ok) throw new Error(`Budget save failed (${response.status}).`);
}
function persist() {
  const status = document.querySelector('#save-status');
  if (status) status.textContent = 'Saving';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const payload = JSON.stringify({ budgets: state.budgets, active: state.active, preferences: state.preferences });
    saveQueue = saveQueue.catch(() => undefined).then(async () => {
      const response = await fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      if (!response.ok) throw new Error(`Budget save failed (${response.status}).`);
      const currentStatus = document.querySelector('#save-status');
      if (currentStatus) currentStatus.textContent = 'All changes saved';
    }).catch(() => {
      const currentStatus = document.querySelector('#save-status');
      if (currentStatus) currentStatus.textContent = 'Save failed';
    });
  }, 120);
}
function clearUndo(): void {
  clearTimeout(undoTimer);
  undoTimer = undefined;
  pendingUndo = null;
  document.querySelector('#undo-notice')?.remove();
}
function offerUndo(message: string, restore: () => void): void {
  clearUndo();
  pendingUndo = restore;
  const notice = document.createElement('div');
  notice.id = 'undo-notice';
  notice.className = 'undo-notice';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  notice.innerHTML = `<span>${esc(message)}</span><button class="button button-secondary" type="button" data-action="undo-delete">Undo</button>`;
  document.body.append(notice);
  undoTimer = window.setTimeout(clearUndo, 10000);
}
function restoreDeletedTransactions(budget: Budget, deleted: Array<{ index: number; transaction: BudgetTransaction }>): void {
  for (const item of [...deleted].sort((left, right) => left.index - right.index)) {
    if (budget.transactions.some((transaction) => transaction.id === item.transaction.id)) continue;
    budget.transactions.splice(Math.min(item.index, budget.transactions.length), 0, item.transaction);
  }
}
async function initialize(): Promise<void> {
  root.innerHTML = '<section class="welcome"><p class="overline">LOADING YOUR BUDGET</p><h1>Connecting to your budget data...</h1></section>';
  try {
    const response = await fetch('/api/state');
    if (!response.ok) throw new Error(`Budget load failed (${response.status}).`);
    const serverState = await response.json() as { budgets?: Budget[]; active?: string | null; initialized?: boolean; preferences?: Partial<AppPreferences> };
    if (serverState.initialized) {
      if (!Array.isArray(serverState.budgets)) throw new Error('The saved budget data is invalid.');
      const normalized = normalizeState(serverState.budgets, serverState.active, serverState.preferences);
      state.budgets = normalized.budgets;
      state.active = normalized.active;
      state.preferences = { ...normalized.preferences, transactionSortField: normalized.preferences.transactionSortField ?? DEFAULT_TRANSACTION_SORT.field, transactionSortDirection: normalized.preferences.transactionSortDirection ?? DEFAULT_TRANSACTION_SORT.direction };
      if (normalized.budgets.length !== serverState.budgets.length) await putState(state.budgets, state.active, state.preferences);
    } else {
      const legacyState = load();
      state.budgets = legacyState.budgets;
      state.active = legacyState.active;
      state.preferences = { ...legacyState.preferences, transactionSortField: legacyState.preferences.transactionSortField ?? DEFAULT_TRANSACTION_SORT.field, transactionSortDirection: legacyState.preferences.transactionSortDirection ?? DEFAULT_TRANSACTION_SORT.direction };
      await putState(state.budgets, state.active, state.preferences);
    }
    render();
  } catch (error) {
    console.error(error);
    root.innerHTML = '<section class="welcome"><p class="overline">DATA CONNECTION</p><h1>Unable to load budget data.</h1><p class="welcome-copy">Your saved data was not changed. Check the server and retry.</p><button class="button button-primary" data-action="retry-load">Retry</button></section>';
  }
}
function groupTotals(budget: Budget, type: BudgetGroupId): AmountTotals {
  const categories = budget.categories.filter((category) => category.type === type);
  const categoryIds = new Set(categories.map((category) => category.id));
  const entries = categories.flatMap((category) => category.entries);
  return {
    planned: entries.reduce((total, entry) => total + entry.planned, 0),
    actual: entries.reduce((total, entry) => total + entry.actual, 0)
      + budget.transactions.filter((transaction) => categoryIds.has(transaction.categoryId)).reduce((total, transaction) => total + transaction.amount, 0),
  };
}
function categoryTotals(budget: Budget, category: BudgetCategory): AmountTotals {
  return {
    planned: category.entries.reduce((total, entry) => total + entry.planned, 0),
    actual: category.entries.reduce((total, entry) => total + entry.actual, 0)
      + budget.transactions.filter((transaction) => transaction.categoryId === category.id).reduce((total, transaction) => total + transaction.amount, 0),
  };
}
function entryActual(budget: Budget, entry: BudgetEntry): number {
  return entry.actual + budget.transactions.filter((transaction) => transaction.entryId === entry.id).reduce((total, transaction) => total + transaction.amount, 0);
}
function totals(budget: Budget): DashboardTotals {
  const income = groupTotals(budget, 'income');
  const out = groupsFor(budget).filter((g) => g.id !== 'income').reduce((a, g) => { const t = groupTotals(budget, g.id); a.planned += t.planned; a.actual += t.actual; return a; }, { planned: 0, actual: 0 });
  const carryover = Number(budget.carryover) || 0;
  return { income, out, carryover, plannedLeft: income.planned + carryover - out.planned, actualLeft: income.actual + carryover - out.actual };
}
function carryoverAmount(budget: Budget, method: CarryoverMethod): number {
  const summary = totals(budget);
  return method === 'planned' ? summary.plannedLeft : summary.actualLeft;
}
function nextSchedulePayday(budget: Budget): { name: string; amount: number; date: string; frequency: PayFrequency } | null {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const upcoming = budget.incomeSchedules
    .map((schedule) => {
      const start = new Date(`${schedule.nextPayday}T00:00:00`);
      let cursor = new Date(start);
      const interval = payFrequencyInterval(schedule.frequency);
      while (cursor < now) {
        if (schedule.frequency === 'monthly') {
          const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, Number(schedule.nextPayday.slice(8, 10)));
          cursor = nextMonth;
        } else {
          cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + interval);
        }
      }
      return { name: schedule.name, amount: schedule.amount, date: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`, frequency: schedule.frequency };
    })
    .filter((entry) => entry.date)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return upcoming ?? null;
}
const signed = (n: number): string => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n))}`;

function requiredElement<T extends Element>(parent: ParentNode, selector: string): T {
  const element = parent.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

const themeQuery = window.matchMedia('(prefers-color-scheme: light)');
function applyTheme(): void {
  const choice = state.preferences.theme ?? 'system';
  document.documentElement.dataset.theme = choice === 'system' ? (themeQuery.matches ? 'light' : 'dark') : choice;
}
function applyAppearance(): void {
  const html = document.documentElement;
  html.dataset.accent = state.preferences.accentColor ?? 'forest';
  html.dataset.density = state.preferences.density ?? 'comfortable';
  const textScales: Record<TextSizePreference, string> = { small: '0.9', medium: '1', large: '1.15' };
  html.style.setProperty('--text-scale', textScales[state.preferences.textSize ?? 'medium']);
  applyTheme();
}
themeQuery.addEventListener('change', applyTheme);

function render(): void {
  applyAppearance();
  const budget = current();
  const currentTransactionIds = new Set(budget?.transactions.map((transaction) => transaction.id) ?? []);
  for (const id of selectedTransactionIds) if (!currentTransactionIds.has(id)) selectedTransactionIds.delete(id);
  const labels: Record<AppState['view'], string> = {
    dashboard: 'Dashboard',
    transactions: 'Transactions',
    subscriptions: 'Subscription Tracking',
    review: 'Monthly Review',
    reports: 'Reports',
    settings: 'Settings',
  };
  const page = budget
    ? state.view === 'settings' ? settingsPage()
      : state.view === 'subscriptions' ? subscriptionTrackingPage(budget, seriesBudgets(budget.seriesId))
      : state.view === 'review' ? monthlyReviewPage(budget)
        : state.view === 'reports' ? '<section class="page-placeholder"><p class="panel-kicker">COMING SOON</p><h1>Reports</h1><p>Reports will be available here in a future update.</p></section>'
          : dashboard(budget, seriesBudgets(budget.seriesId))
    : state.view === 'reports'
      ? '<section class="page-placeholder"><p class="panel-kicker">COMING SOON</p><h1>Reports</h1><p>Reports will be available here in a future update.</p></section>'
      : state.view === 'settings' ? settingsPage() : welcome();
  root.innerHTML = `<div class="app-shell"><aside class="sidebar">
    <a class="brand" href="#home" aria-label="Kestral Budget home"><span class="brand-mark"><img src="/kestral-mark.png" alt=""></span><span>Kestral Budget</span></a>
    <nav class="primary-nav" aria-label="Main navigation">
      <button class="sidebar-nav-item ${state.view === 'dashboard' ? 'active' : ''}" data-action="navigate" data-page="dashboard" ${state.view === 'dashboard' ? 'aria-current="page"' : ''}><span aria-hidden="true">⌂</span>Dashboard</button>
      <button class="sidebar-nav-item ${state.view === 'transactions' ? 'active' : ''}" data-action="navigate" data-page="transactions" ${state.view === 'transactions' ? 'aria-current="page"' : ''}><span aria-hidden="true">⇄</span>Transactions</button>
      <button class="sidebar-nav-item ${state.view === 'subscriptions' ? 'active' : ''}" data-action="navigate" data-page="subscriptions" ${state.view === 'subscriptions' ? 'aria-current="page"' : ''}><span aria-hidden="true">◷</span>Subscription Tracking</button>
      <button class="sidebar-nav-item ${state.view === 'review' ? 'active' : ''}" data-action="navigate" data-page="review" ${state.view === 'review' ? 'aria-current="page"' : ''}><span aria-hidden="true">✓</span>Monthly Review</button>
      <button class="sidebar-nav-item ${state.view === 'reports' ? 'active' : ''}" data-action="navigate" data-page="reports" ${state.view === 'reports' ? 'aria-current="page"' : ''}><span aria-hidden="true">▤</span>Reports</button>
    </nav>
    <div class="backup-actions"><button type="button" data-action="export-backup">Export backup</button><button type="button" data-action="import-backup">Import backup</button><input id="backup-file" type="file" accept="application/json,.json" hidden></div>
    <div class="sidebar-footer"><button class="sidebar-nav-item sidebar-settings ${state.view === 'settings' ? 'active' : ''}" data-action="navigate" data-page="settings" ${state.view === 'settings' ? 'aria-current="page"' : ''}><span aria-hidden="true">⚙</span>Settings</button>
      <div class="sidebar-bottom"><span class="saved-dot"></span><span>Stored in app database</span><span id="save-status">All changes saved</span></div></div></aside>
    <main class="main-area"><header class="topbar"><div class="breadcrumb"><strong>${labels[state.view]}</strong></div><div class="topbar-actions">${budget && state.view === 'transactions' ? '<button class="button button-primary" data-action="new-transaction"><span>+</span>Quick Transaction</button>' : ''}</div></header>${page}</main></div>`;
  const topbar = requiredElement<HTMLElement>(root, '.topbar');
  const topbarActions = requiredElement<HTMLElement>(topbar, '.topbar-actions');
  if (state.budgets.length) {
    const tourButton = document.createElement('button');
    tourButton.type = 'button';
    tourButton.className = 'icon-button tour-button';
    tourButton.dataset.action = 'guided-tour';
    tourButton.setAttribute('aria-label', 'Start app tour');
    tourButton.dataset.tooltip = 'Replay the guided tour';
    tourButton.title = 'Replay the guided tour';
    tourButton.innerHTML = '<span class="tour-cap" aria-hidden="true">🎓</span><span>App tour</span>';
    topbarActions.append(tourButton);
  }
  function settingsPage(): string {
    const themes: Array<[ThemePreference, string]> = [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']];
    const weekStarts: Array<[WeekStart, string]> = [['sunday', 'Sunday'], ['monday', 'Monday']];
    const carryoverMethods: Array<[CarryoverMethod, string]> = [['actual', 'Actual leftover'], ['planned', 'Planned unallocated income']];
    const settingRow = (id: string, title: string, description: string, options: Array<[string, string]>, selectedValue: string): string =>
      `<label class="settings-option-row" for="${id}"><span><strong>${title}</strong><small>${description}</small></span><select id="${id}" aria-label="${title}">${options.map(([value, label]) => `<option value="${value}" ${value === selectedValue ? 'selected' : ''}>${label}</option>`).join('')}</select></label>`;
    return `<section class="dashboard page-content settings-page"><div class="page-heading settings-page-heading"><div><p class="panel-kicker">PREFERENCES</p><h1>Settings</h1><p class="heading-subtitle">Personalize how Kestral Budget looks and formats your budget.</p></div></div><div class="settings-card"><section class="settings-section"><div class="settings-section-heading"><span class="settings-section-icon" aria-hidden="true">◐</span><div><h2>Appearance</h2><p>Choose a look and layout that feels right for you.</p></div></div>${settingRow('theme-select', 'Color theme', 'Choose a theme or follow your device setting.', themes, state.preferences.theme ?? 'system')}${settingRow('accent-color-select', 'Accent color', 'Personalize highlights and interactive accents.', ACCENT_COLORS, state.preferences.accentColor ?? 'forest')}${settingRow('text-size-select', 'Text size', 'Adjust text throughout the app.', TEXT_SIZES, state.preferences.textSize ?? 'medium')}${settingRow('density-select', 'Layout density', 'Choose more breathing room or a compact view.', DENSITIES, state.preferences.density ?? 'comfortable')}</section><section class="settings-section"><div class="settings-section-heading"><span class="settings-section-icon" aria-hidden="true">¤</span><div><h2>Regional formats</h2><p>Choose the currency and date style used across your budget.</p></div></div>${settingRow('currency-select', 'Currency', 'Display amounts using this currency; values are not converted.', CURRENCIES, state.preferences.currency ?? 'USD')}${settingRow('date-format-select', 'Date format', 'Use a familiar regional format or the ISO 8601 standard.', DATE_FORMATS, state.preferences.dateFormat ?? 'mdy')}</section><section class="settings-section"><div class="settings-section-heading"><span class="settings-section-icon" aria-hidden="true">▦</span><div><h2>Calendar</h2><p>Set the week layout for your subscription calendar.</p></div></div>${settingRow('week-start-select', 'First day of the week', 'Choose Sunday or Monday as the first weekday.', weekStarts, state.preferences.weekStartsOn ?? 'sunday')}</section><section class="settings-section"><div class="settings-section-heading"><span class="settings-section-icon" aria-hidden="true">↻</span><div><h2>Month rollover</h2><p>Choose how unallocated money carries into a new month.</p></div></div>${settingRow('carryover-method-select', 'New-month carryover', "Pick the basis for calculating the next month's opening carryover.", carryoverMethods, state.preferences.carryoverMethod ?? 'actual')}<div class="settings-note"><span aria-hidden="true">i</span><p>Changes apply to months created from now on. Existing month carryovers are preserved.</p></div></section></div></section>`;
  }
  if (budget?.expenseSchedules.length && state.view === 'dashboard') {
    const categoryHeading = root.querySelector<HTMLElement>('.categories-section .section-title-row > div');
    if (categoryHeading) {
      const manageButton = document.createElement('button');
      manageButton.type = 'button';
      manageButton.className = 'text-action recurring-manager-trigger';
      manageButton.dataset.action = 'manage-expense-schedules';
      manageButton.textContent = `Manage recurring (${budget.expenseSchedules.length})`;
      categoryHeading.append(manageButton);
    }
  }
  applyTransactionFilters();
}
function setupCompleteDialog(): void {
  dialog.innerHTML = '<section class="tour-content"><div class="dialog-topline"><span class="dialog-icon">✓</span><button class="icon-button dialog-close" data-action="close" type="button" aria-label="Close">×</button></div><p class="panel-kicker">BUDGET SETUP COMPLETE</p><h2>Your budget is ready</h2><p class="dialog-copy">Take a quick guided tour of the overview, categories, and transactions, or start exploring on your own.</p><div class="dialog-actions"><button class="button button-secondary" data-action="setup-finish" type="button">Maybe later</button><button class="button button-primary" data-action="guided-tour" type="button">Take a guided tour</button></div></section>';
  dialog.showModal();
}
function finishGuidedTour(): void {
  guidedTourLayer?.remove();
  guidedTourLayer = null;
  root.inert = false;
  root.querySelector<HTMLButtonElement>('[data-action="guided-tour"]')?.focus();
}
function showGuidedTour(step = 0): void {
  guidedTourStep = Math.max(0, Math.min(step, GUIDED_TOUR_STEPS.length - 1));
  const currentStep = GUIDED_TOUR_STEPS[guidedTourStep];
  if (dialog.open) dialog.close();
  const tourView = currentStep.view === 'transactions' ? 'transactions' : 'dashboard';
  if (state.view !== tourView) {
    state.view = tourView;
    dashboardTab = currentStep.view;
    render();
  }
  const target = root.querySelector<HTMLElement>(currentStep.selector) || root.querySelector<HTMLElement>('.topbar');
  if (!target) return;
  target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  root.inert = true;
  if (!guidedTourLayer) {
    guidedTourLayer = document.createElement('div');
    guidedTourLayer.className = 'guided-tour-layer';
    guidedTourLayer.innerHTML = '<div class="tour-spotlight"></div><section class="tour-callout" role="dialog" aria-modal="true" aria-labelledby="tour-title"></section>';
    document.body.append(guidedTourLayer);
  }
  const spotlight = requiredElement<HTMLElement>(guidedTourLayer, '.tour-spotlight');
  const callout = requiredElement<HTMLElement>(guidedTourLayer, '.tour-callout');
  callout.innerHTML = `<div class="tour-callout-head"><span class="tour-step-count">${guidedTourStep + 1} / ${GUIDED_TOUR_STEPS.length}</span><button class="tour-close" type="button" data-action="tour-finish" aria-label="Close tour">×</button></div><div class="tour-progress" aria-hidden="true">${GUIDED_TOUR_STEPS.map((_, index) => `<span class="${index <= guidedTourStep ? 'done' : ''}"></span>`).join('')}</div><h2 id="tour-title">${esc(currentStep.title)}</h2><p>${esc(currentStep.body)}</p><div class="tour-callout-actions"><button class="button button-secondary" data-action="tour-finish" type="button">Skip tour</button><button class="button button-secondary" data-action="tour-previous" type="button" ${guidedTourStep === 0 ? 'disabled' : ''}>Back</button><button class="button button-primary" data-action="tour-next" type="button">${guidedTourStep === GUIDED_TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}</button></div>`;
  const rect = target.getBoundingClientRect();
  const padding = 5;
  spotlight.style.left = `${Math.max(4, rect.left - padding)}px`;
  spotlight.style.top = `${Math.max(4, rect.top - padding)}px`;
  spotlight.style.width = `${Math.min(window.innerWidth - Math.max(4, rect.left - padding) - 4, rect.width + padding * 2)}px`;
  spotlight.style.height = `${Math.min(window.innerHeight - Math.max(4, rect.top - padding) - 4, rect.height + padding * 2)}px`;
  const calloutWidth = Math.min(390, window.innerWidth - 32);
  callout.style.width = `${calloutWidth}px`;
  const calloutHeight = callout.offsetHeight;
  const left = Math.min(Math.max(16, rect.left), window.innerWidth - calloutWidth - 16);
  const below = rect.bottom + 14;
  const top = below + calloutHeight <= window.innerHeight - 16
    ? below
    : rect.top - calloutHeight - 14 >= 16
      ? rect.top - calloutHeight - 14
      : Math.max(16, (window.innerHeight - calloutHeight) / 2);
  callout.style.left = `${left}px`;
  callout.style.top = `${top}px`;
  callout.querySelector<HTMLButtonElement>('[data-action="tour-next"]')?.focus();
}
function welcome(): string {
  return `<section class="welcome"><p class="overline">A CLEAR VIEW OF YOUR MONEY</p><h1>Give every dollar<br>somewhere to go.</h1><p class="welcome-copy">Set up a monthly budget, plan the essentials, and see what is left at a glance.</p><button class="button button-primary" data-action="new-budget"><span>+</span> Create your first budget</button></section>`;
}
function exportBackup(): void {
  const contents = createBackup({ budgets: state.budgets, active: state.active, preferences: state.preferences });
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `kestralbudget-backup-${date}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function importBackup(file: File): Promise<void> {
  let imported: ReturnType<typeof parseBackup>;
  try {
    imported = parseBackup(await file.text());
  } catch (error) {
    console.error(error);
    window.alert('This file is not a valid Kestral Budget backup.');
    return;
  }
  if (!window.confirm('Replace the current budget and preferences with this backup? If it contains multiple budgets, only the active budget and its months will be restored. This cannot be undone.')) return;
  const normalized = normalizeState(imported.budgets as Budget[], imported.active, imported.preferences);
  root.inert = true;
  clearTimeout(saveTimer);
  try {
    await saveQueue.catch(() => undefined);
    await putState(normalized.budgets, normalized.active, normalized.preferences);
    state.budgets = normalized.budgets;
    state.active = normalized.active;
    state.preferences = normalized.preferences;
    state.view = 'dashboard';
    wizard = null;
    render();
  } catch (error) {
    console.error(error);
    window.alert('The backup could not be saved. Your current data was not changed.');
  } finally {
    root.inert = false;
  }
}
function monthTabs(budget: Budget, budgets: Budget[]): string {
  return `<div class="budget-tabs" role="tablist" aria-label="Choose a month">${budgets.map((item) => `<button class="month-tab ${item.id === budget.id ? 'selected' : ''}" data-action="select-month" data-id="${esc(item.id)}" role="tab" aria-selected="${item.id === budget.id}">${esc(monthText(item.month))}</button>`).join('')}<button class="month-add" data-action="new-month" aria-label="Create a new month" title="Create a new month">+</button></div>`;
}

function dashboard(b: Budget, budgets: Budget[]): string {
  const summary = totals(b);
  const groups = groupsFor(b);
  const incomeCategories = b.categories.filter((category) => category.type === 'income');
  const spendingCategories = b.categories.filter((category) => category.type !== 'income');
  const incomeRows = incomeCategories.flatMap((category) => category.entries.map((entry) => {
    const actual = entryActual(b, entry);
    return `<tr><td>${esc(entry.name)}</td><td>${fmt(entry.planned)}</td><td>${fmt(actual)}</td><td class="${actual < entry.planned ? 'negative' : actual > entry.planned ? 'positive' : ''}">${signed(actual - entry.planned)}</td></tr>`;
  })).join('');
  const categoryRows = spendingCategories.map((category) => {
    const amount = categoryTotals(b, category);
    return `<tr><td>${esc(category.name)}</td><td>${fmt(amount.planned)}</td><td>${fmt(amount.actual)}</td><td class="${amount.actual > amount.planned ? 'negative' : amount.actual < amount.planned ? 'positive' : ''}">${signed(amount.actual - amount.planned)}</td></tr>`;
  }).join('');
  const topEntries = spendingCategories.flatMap((category) => category.entries.map((entry) => ({
    name: entry.name,
    category: category.name,
    type: category.type,
    actual: entry.actual,
  })));
  const topTransactions = b.transactions.flatMap((transaction) => {
    const category = b.categories.find((item) => item.id === transaction.categoryId);
    return category && category.type !== 'income'
      ? [{ name: transaction.description, category: category.name, type: category.type, actual: transaction.amount }]
      : [];
  });
  const top = [...topEntries, ...topTransactions]
    .filter((item) => item.actual > 0)
    .sort((left, right) => right.actual - left.actual)
    .slice(0, 20);
  const summaryDisclosure = (label: string, planned: number, actual: number, rows: string, isIncome = false): string => {
    const diffClass = isIncome
      ? actual > planned ? 'positive' : actual < planned ? 'negative' : ''
      : actual > planned ? 'negative' : actual < planned ? 'positive' : '';
    return `<details class="summary-disclosure" open><summary><strong>${label}</strong><span><small>Planned</small>${fmt(planned)}</span><span><small>Actual</small>${fmt(actual)}</span><span class="${diffClass}"><small>Diff</small>${signed(actual - planned)}</span></summary><div class="table-scroll"><table><thead><tr><th>${label === 'Income' ? 'INCOME SOURCE' : 'CATEGORY'}</th><th>PLANNED</th><th>ACTUAL</th><th>DIFF</th></tr></thead><tbody>${rows || `<tr><td colspan="4">No ${label.toLowerCase()} items yet.</td></tr>`}</tbody></table></div></details>`;
  };
  const incomeTotalActual = summary.income.actual;
  const categoryActual = summary.out.actual;
  if (transactionCategoryFilter !== 'all' && !b.categories.some((category) => category.id === transactionCategoryFilter)) transactionCategoryFilter = 'all';
  const hasCategoryOnlyTransactions = b.transactions.some((transaction) => !transaction.entryId);
  if (transactionItemFilter !== 'all'
    && !(transactionItemFilter === 'category-only'
      ? hasCategoryOnlyTransactions
      : b.categories.some((category) => category.entries.some((entry) => entry.id === transactionItemFilter)))) {
    transactionItemFilter = 'all';
  }
  const transactionRows = sortTransactions(b).map((transaction) => {
    const category = b.categories.find((item) => item.id === transaction.categoryId);
    const itemName = transactionTypeName(b, transaction);
    const categoryName = category?.name ?? 'Uncategorized';
    const isIncome = category?.type === 'income';
    const searchText = [transaction.description, categoryName, itemName, transaction.date, displayDate(transaction.date)].join(' ').toLocaleLowerCase();
    return `<tr data-transaction-row data-transaction-id="${esc(transaction.id)}" data-category-id="${esc(transaction.categoryId)}" data-entry-id="${esc(transaction.entryId ?? 'category-only')}" data-search="${esc(searchText)}" data-type-name="${esc(itemName)}" data-category-name="${esc(categoryName)}" data-amount="${esc(transaction.amount)}"><td><input class="transaction-select" type="checkbox" data-transaction-check="${esc(transaction.id)}" aria-label="Select ${esc(transaction.description)}" ${selectedTransactionIds.has(transaction.id) ? 'checked' : ''}></td><td>${esc(displayDate(transaction.date))}</td><td>${esc(transaction.description)}</td><td>${esc(categoryName)}</td><td>${esc(itemName)}</td><td class="${isIncome ? 'positive' : 'negative'}">${isIncome ? '+' : '−'}${fmt(transaction.amount)}</td><td class="transaction-actions"><button class="text-action" data-action="edit-transaction" data-transaction="${esc(transaction.id)}">Edit</button><button class="text-action transaction-delete" data-action="delete-transaction" data-transaction="${esc(transaction.id)}">Delete</button></td></tr>`;
  }).join('');
  const metricCard = (title: string, icon: string, amount: number, details: string, amountClass = ''): string =>
    `<article class="metric-card"><div class="metric-label"><span class="metric-icon">${icon}</span>${title.toUpperCase()}</div><div class="metric-value ${amountClass}">${fmt(amount)}</div><div class="metric-foot">${details}</div></article>`;
  const plannedAvailableIncome = summary.income.planned + summary.carryover;
  const isTransactionsPage = state.view === 'transactions';
  return `<section class="dashboard">${monthTabs(b, budgets)}
    <div class="page-heading"><span>${esc(monthText(b.month))}</span><details class="budget-menu"><summary class="button button-secondary budget-menu-trigger" aria-label="More options" title="More options">⋯</summary><div class="budget-menu-panel"><button type="button" data-action="delete-month">Delete this month</button></div></details></div>
    <section class="metric-grid" aria-label="Income allocation summary" ${isTransactionsPage ? 'hidden' : ''}>
      ${metricCard('Income + Carryover', '↗', plannedAvailableIncome, `<span>Planned income ${fmt(summary.income.planned)}</span><span>Carryover ${fmt(summary.carryover)}</span>`)}
      ${metricCard('Unallocated Income', '◷', summary.plannedLeft, '<span>Available income not yet allocated</span>', summary.plannedLeft < 0 ? 'negative' : 'positive')}
      ${metricCard('Allocated Income', '≋', summary.out.planned, '<span>Planned across categories</span>')}
    </section>
    <section class="dashboard-grid dashboard-insights" ${isTransactionsPage ? 'hidden' : ''}>
      <section class="panel at-a-glance"><div class="panel-heading"><div><p class="panel-kicker">MONTHLY SUMMARY</p><h2>At a glance</h2></div></div>
        ${summaryDisclosure('Income', summary.income.planned, incomeTotalActual, incomeRows, true)}
        ${summaryDisclosure('Categories', summary.out.planned, categoryActual, categoryRows)}
      </section>
      <section class="panel top-spending"><div class="panel-heading"><div><p class="panel-kicker">WHERE IT WENT</p><h2>Top spending</h2></div><span class="count-badge">${top.length} / 20</span></div>${top.length ? `<ol class="top-list">${top.map((item, index) => `<li><span class="rank">${String(index + 1).padStart(2, '0')}</span><span class="top-copy"><strong>${esc(item.name)}</strong><small>${esc(item.category)} · ${esc(group(item.type).name)}</small></span><span class="top-amount">${fmt(item.actual)}</span></li>`).join('')}</ol>` : '<div class="quiet-empty">Actual spending will appear here as you record it.</div>'}</section>
    </section>
    <section class="categories-section" ${isTransactionsPage ? 'hidden' : ''}><div class="section-title-row"><div><p class="panel-kicker">YOUR PLAN</p><h2>Budget categories</h2></div><button class="button button-secondary" data-action="add-category">＋ Add category</button></div><div class="category-grid">${groups.map((groupItem) => categoryCard(groupItem, b)).join('')}</div></section>
    <section class="transactions-panel panel" ${isTransactionsPage ? '' : 'hidden'}><div class="panel-heading"><div><p class="panel-kicker">RECORDED ACTIVITY</p><h2>Transactions</h2></div><div class="panel-heading-actions"><span class="count-badge">${b.transactions.length}</span><button class="button button-primary" data-action="new-transaction"><span>+</span> Add transaction</button></div></div><div class="transaction-tools"><label class="transaction-filter">Search<input id="transaction-search" type="search" value="${esc(transactionSearch)}" placeholder="Description, budget item, category, or date"></label><label class="transaction-filter">Budget item<select id="transaction-item-filter"><option value="all">All budget items</option>${b.categories.flatMap((category) => category.entries.map((entry) => `<option value="${esc(entry.id)}" ${transactionItemFilter === entry.id ? 'selected' : ''}>${esc(category.name)} · ${esc(entry.name)}</option>`)).join('')}${hasCategoryOnlyTransactions ? `<option value="category-only" ${transactionItemFilter === 'category-only' ? 'selected' : ''}>Category only</option>` : ''}</select></label><label class="transaction-filter">Category<select id="transaction-category-filter"><option value="all">All categories</option>${b.categories.map((category) => `<option value="${esc(category.id)}" ${transactionCategoryFilter === category.id ? 'selected' : ''}>${esc(category.name)}</option>`).join('')}</select></label><label class="transaction-filter">Sort by<select id="transaction-sort-field">${(['date', 'description', 'type', 'category', 'amount'] as TransactionSortField[]).map((field) => `<option value="${field}" ${transactionSortConfig().field === field ? 'selected' : ''}>${transactionSortLabel(field)}</option>`).join('')}</select></label><div class="transaction-filter transaction-direction"><span>Direction</span><button class="button button-secondary" type="button" data-action="toggle-transaction-sort-direction">${transactionSortConfig().direction === 'asc' ? 'Ascending' : 'Descending'}</button></div><div class="transaction-bulk"><span id="transaction-selection-count" aria-live="polite">0 selected</span><button class="button button-secondary" type="button" data-action="select-visible">Select visible</button><button class="button button-secondary" type="button" data-action="clear-selection" disabled>Clear selection</button><button class="button button-danger" type="button" data-action="delete-selected" disabled>Delete selected</button></div></div>${b.transactions.length ? `<div class="table-scroll"><table><thead><tr><th><span class="visually-hidden">Select</span></th><th>DATE</th><th>DESCRIPTION</th><th>CATEGORY</th><th>BUDGET ITEM</th><th>AMOUNT</th><th></th></tr></thead><tbody>${transactionRows}</tbody></table></div><p id="transaction-no-results" class="transaction-no-results" hidden>No transactions match these filters.</p>` : '<div class="quiet-empty">No transactions recorded this month.</div>'}</section></section>`;
}

function monthlyReviewPage(budget: Budget): string {
  const summary = totals(budget);
  const activity = budget.categories
    .filter((category) => category.type !== 'income')
    .map((category) => ({ category, ...categoryTotals(budget, category) }))
    .map((item) => ({ ...item, difference: item.actual - item.planned }))
    .filter((item) => item.actual !== 0);
  const overPlan = activity.filter((item) => item.difference > 0.01).sort((left, right) => right.difference - left.difference);
  const underPlan = activity.filter((item) => item.difference < -0.01).sort((left, right) => left.difference - right.difference);
  const overTotal = overPlan.reduce((total, item) => total + item.difference, 0);
  const underTotal = underPlan.reduce((total, item) => total - item.difference, 0);
  const progress = summary.out.planned > 0 ? Math.round(summary.out.actual / summary.out.planned * 100) : summary.out.actual > 0 ? 100 : 0;
  const progressWidth = Math.min(100, progress);
  const renderReviewRows = (items: typeof activity): string => items.slice(0, 3).map(({ category, planned, actual, difference }) => `<div class="review-row"><span><strong>${esc(category.name)}</strong><small>${fmt(actual)} actual · ${fmt(planned)} planned</small></span><strong class="${difference > 0 ? 'negative' : 'positive'}">${signed(difference)}</strong></div>`).join('');
  const hasActivity = budget.transactions.length > 0 || budget.categories.some((category) => category.entries.some((entry) => entry.actual !== 0));
  const breakdown = hasActivity
    ? `<div class="review-breakdown"><section class="review-column"><h3>Over plan <strong>${fmt(overTotal)}</strong></h3>${renderReviewRows(overPlan) || '<p class="review-empty">No categories are over plan.</p>'}${overPlan.length > 3 ? `<small class="review-more">And ${overPlan.length - 3} more</small>` : ''}</section><section class="review-column"><h3>Under plan <strong>${fmt(underTotal)}</strong></h3>${renderReviewRows(underPlan) || '<p class="review-empty">No recorded spending is under plan.</p>'}${underPlan.length > 3 ? `<small class="review-more">And ${underPlan.length - 3} more</small>` : ''}</section></div>`
    : '<p class="review-empty">Record income or spending to see a useful comparison with your plan.</p>';
  return `<section class="dashboard page-content">${monthTabs(budget, seriesBudgets(budget.seriesId))}<div class="page-heading"><div><p class="panel-kicker">MONTHLY RECAP</p><h1>${esc(monthText(budget.month))} review</h1><p class="heading-subtitle">A snapshot of recorded activity against the plan for this month.</p></div></div><div class="review-stats"><div><span>Income recorded</span><strong>${fmt(summary.income.actual)}</strong><small>${fmt(summary.income.planned)} planned · ${signed(summary.income.actual - summary.income.planned)}</small></div><div><span>Spending recorded</span><strong>${fmt(summary.out.actual)}</strong><small>of ${fmt(summary.out.planned)} planned</small></div><div><span>Left after actuals</span><strong class="${summary.actualLeft < 0 ? 'negative' : 'positive'}">${fmt(summary.actualLeft)}</strong><small>including carryover</small></div></div><section class="review-progress"><div><strong>Spending against plan</strong><span>${progress}% used</span></div><div class="review-progress-track" role="meter" aria-label="Spending against plan" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressWidth}"><span style="width:${progressWidth}%"></span></div><small>${fmt(summary.out.actual)} recorded of ${fmt(summary.out.planned)} planned</small></section>${breakdown}</section>`;
}

function expenseFrequencyLabel(frequency: ExpenseFrequency): string {
  return EXPENSE_FREQUENCIES.find((option) => option.value === frequency)?.label ?? 'Recurring';
}

function monthlyEquivalent(schedule: RecurringExpenseSchedule): number {
  if (schedule.frequency === 'weekly') return schedule.amount * 52 / 12;
  if (schedule.frequency === 'biweekly') return schedule.amount * 26 / 12;
  if (schedule.frequency === 'yearly') return schedule.amount / 12;
  return schedule.amount;
}

function subscriptionTrackingPage(budget: Budget, budgets: Budget[]): string {
  const subscriptions = budget.expenseSchedules.flatMap((schedule) => {
    const category = budget.categories.find((item) => item.id === schedule.categoryId);
    return category?.type === 'subscriptions' && !schedule.paused ? [{ schedule, category }] : [];
  });
  const eventEntries: Array<{ date: string; name: string; amount: number; categoryId: string; entryId?: string; scheduleId?: string | null }> = budget.categories.filter((category) => category.type === 'subscriptions').flatMap((category) => category.entries.flatMap((entry) => {
    const date = entry.scheduledDate ?? entry.dueDate;
    return date?.startsWith(`${budget.month}-`) ? [{ date, name: entry.name, amount: entry.planned, categoryId: category.id, entryId: entry.id, scheduleId: entry.scheduleId }] : [];
  }));
  const events = [...eventEntries];
  for (const { schedule, category } of subscriptions) {
    for (const occurrence of buildExpenseEntriesForMonth(schedule, budget.month)) {
      if (events.some((event) => event.scheduleId === schedule.id && event.date === occurrence.date)) continue;
      events.push({ date: occurrence.date, name: occurrence.name, amount: occurrence.amount, categoryId: category.id, scheduleId: schedule.id });
    }
  }
  events.sort((left, right) => left.date.localeCompare(right.date) || left.name.localeCompare(right.name));
  const [year, month] = budget.month.split('-').map(Number);
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const weekStartsOn = state.preferences.weekStartsOn ?? 'sunday';
  const firstDay = weekStartsOn === 'monday' ? (firstWeekday + 6) % 7 : firstWeekday;
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: string[] = [];
  for (let index = 0; index < firstDay; index++) cells.push('<div class="calendar-day calendar-day-empty" aria-hidden="true"></div>');
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${budget.month}-${String(day).padStart(2, '0')}`;
    const dayEvents = events.filter((event) => event.date === date);
    cells.push(`<div class="calendar-day" aria-label="${esc(displayDate(date))}"><span class="calendar-date">${day}</span>${dayEvents.map((item) => `<button class="calendar-event" ${item.entryId ? `data-action="edit-entry" data-category="${esc(item.categoryId)}" data-entry="${esc(item.entryId)}"` : `data-action="edit-expense-schedule" data-schedule="${esc(item.scheduleId ?? '')}"`} title="${esc(item.name)} · ${fmt(item.amount)}"><strong>${esc(item.name)}</strong><small>${fmt(item.amount)}</small></button>`).join('')}</div>`);
  }
  while (cells.length % 7 !== 0) cells.push('<div class="calendar-day calendar-day-empty" aria-hidden="true"></div>');
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekdays = weekStartsOn === 'monday' ? [...weekdayNames.slice(1), weekdayNames[0]] : weekdayNames;
  const monthlyTotal = subscriptions.reduce((total, item) => total + monthlyEquivalent(item.schedule), 0)
    + budget.categories.filter((category) => category.type === 'subscriptions')
      .flatMap((category) => category.entries)
      .filter((entry) => !entry.scheduleId)
      .reduce((total, entry) => total + entry.planned, 0);
  const hasSubscriptions = budget.categories.some((category) => category.type === 'subscriptions' && category.entries.length > 0)
    || budget.expenseSchedules.some((schedule) => budget.categories.some((category) => category.id === schedule.categoryId && category.type === 'subscriptions'));
  const undatedEntries = budget.categories.filter((category) => category.type === 'subscriptions').flatMap((category) => category.entries
    .filter((entry) => !entry.dueDate && !entry.scheduledDate && !entry.scheduleId)
    .map((entry) => ({ category, entry })));
  const undatedList = undatedEntries.length
    ? `<section class="subscription-list-panel"><h2>Subscriptions without a due date</h2><div class="subscription-list">${undatedEntries.map(({ category, entry }) => `<div class="subscription-row"><div class="subscription-copy"><strong>${esc(entry.name)}</strong><small>${esc(category.name)} · No due date set</small></div><div class="subscription-cost"><strong>${fmt(entry.planned)}</strong><small>budgeted per month</small></div><div class="subscription-row-actions"><button class="button button-secondary" data-action="edit-entry" data-category="${esc(category.id)}" data-entry="${esc(entry.id)}" type="button">Edit</button><button class="button button-secondary" data-action="schedule-subscription" data-category="${esc(category.id)}" data-entry="${esc(entry.id)}" type="button">Schedule</button></div></div>`).join('')}</div></section>`
    : '';
  const noSubscriptions = !hasSubscriptions
    ? '<div class="subscription-empty"><strong>No subscriptions yet</strong><p>Add a subscription with a due date or recurring schedule to see it on the calendar.</p></div>'
    : !events.length
      ? '<div class="subscription-empty"><strong>No due dates this month</strong><p>Add a reminder date or recurring schedule to place subscriptions on the calendar.</p></div>'
      : '';
  return `<section class="dashboard page-content subscription-page">${monthTabs(budget, budgets)}<div class="page-heading"><div><p class="panel-kicker">RENEWALS & DUE DATES</p><h1>Subscription Tracking</h1><p class="heading-subtitle">${events.length} due ${events.length === 1 ? 'date' : 'dates'} · ${fmt(monthlyTotal)} monthly estimate</p></div><div class="heading-actions">${budget.expenseSchedules.length ? '<button class="button button-secondary" data-action="manage-expense-schedules">Manage schedules</button>' : ''}<button class="button button-primary" data-action="add-subscription">+ Add subscription</button></div></div>${noSubscriptions}<section class="subscription-calendar" aria-label="${esc(monthText(budget.month))} subscription calendar"><div class="calendar-weekdays">${weekdays.map((day) => `<span>${day}</span>`).join('')}</div><div class="calendar-grid">${cells.join('')}</div></section>${undatedList}</section>`;
}

function beginSubscriptionSetup(): void {
  const budget = current();
  if (!budget) return;
  let category = budget.categories.find((item) => item.type === 'subscriptions');
  if (!category) {
    category = { id: uid(), type: 'subscriptions', name: 'Subscriptions', entries: [] };
    budget.categories.push(category);
    const selectedTypes: BudgetGroupId[] = budget.selectedTypes ?? GROUPS.map((item) => item.id);
    budget.selectedTypes = [...new Set<BudgetGroupId>([...selectedTypes, 'subscriptions'])];
    persist();
    render();
  }
  entryDialog(category.id, 'expenses');
}

function applyTransactionFilters(): void {
  const search = transactionSearch.trim().toLocaleLowerCase();
  const rows = [...root.querySelectorAll<HTMLTableRowElement>('[data-transaction-row]')];
  for (const row of rows) {
    row.hidden = (transactionCategoryFilter !== 'all' && row.dataset.categoryId !== transactionCategoryFilter)
      || (transactionItemFilter !== 'all' && row.dataset.entryId !== transactionItemFilter)
      || (search !== '' && !String(row.dataset.search ?? '').includes(search));
  }
  const noResults = root.querySelector<HTMLElement>('#transaction-no-results');
  if (noResults) noResults.hidden = rows.length === 0 || rows.some((row) => !row.hidden);
  updateTransactionSelectionUI();
}

function updateTransactionSelectionUI(): void {
  const selectedCount = current()?.transactions.filter((transaction) => selectedTransactionIds.has(transaction.id)).length ?? 0;
  const count = root.querySelector<HTMLElement>('#transaction-selection-count');
  const deleteButton = root.querySelector<HTMLButtonElement>('[data-action="delete-selected"]');
  const clearButton = root.querySelector<HTMLButtonElement>('[data-action="clear-selection"]');
  const selectVisibleButton = root.querySelector<HTMLButtonElement>('[data-action="select-visible"]');
  const visibleCount = root.querySelectorAll('[data-transaction-row]:not([hidden])').length;
  if (count) count.textContent = `${selectedCount} selected`;
  if (deleteButton) deleteButton.disabled = selectedCount === 0;
  if (clearButton) clearButton.disabled = selectedCount === 0;
  if (selectVisibleButton) selectVisibleButton.disabled = visibleCount === 0;
}
function categoryCard(g: BudgetGroup, budget: Budget): string {
  const cats = budget.categories.filter((c) => c.type === g.id);
  const entries = cats.flatMap((c) => c.entries);
  const groupTotal = cats.reduce((total, category) => {
    const categoryAmount = categoryTotals(budget, category);
    total.planned += categoryAmount.planned;
    total.actual += categoryAmount.actual;
    return total;
  }, { planned: 0, actual: 0 });
  const { planned, actual } = groupTotal;
  const differenceClass = g.id === 'income'
    ? actual < planned ? 'negative' : actual > planned ? 'positive' : ''
    : actual > planned ? 'negative' : actual < planned ? 'positive' : '';
  const symbols: Record<string, string> = { income: '↗', bills: '▤', expenses: '◔', subscriptions: '↻', debts: '◧', savings: '◈' };
  const symbol = symbols[g.id] || '●';
  const body = `${cats.length ? cats.map((c) => `<div class="sub-category"><div class="sub-category-title"><span>${esc(c.name)}</span><span class="sub-category-actions"><button class="text-action" data-action="add-entry" data-category="${esc(c.id)}">Add item</button>${g.id === 'income' ? '' : `<button class="text-action" data-action="add-expense-schedule" data-category="${esc(c.id)}">Schedule item</button>`}</span></div>${c.entries.length ? c.entries.map((e) => { const actualForEntry = entryActual(budget, e); const expenseSchedule = budget.expenseSchedules.find((item) => item.id === e.scheduleId); const scheduleLabel = expenseSchedule ? `${PAY_FREQUENCIES.find((item) => item.value === expenseSchedule.frequency)?.label ?? 'Recurring'} · ${displayDate(e.scheduledDate ?? expenseSchedule.nextDueDate)}` : ''; return `<button class="entry-row" data-action="edit-entry" data-category="${esc(c.id)}" data-entry="${esc(e.id)}"><span class="entry-name">${esc(e.name)}${scheduleLabel ? `<small class="entry-schedule">${esc(scheduleLabel)}</small>` : ''}</span><span class="entry-planned">${fmt(e.planned)}</span><span class="entry-actual ${actualForEntry > +e.planned && g.id !== 'income' ? 'negative' : ''}">${fmt(actualForEntry)}</span></button>`; }).join('') : '<p class="category-empty">Nothing added yet</p>'}</div>`).join('') : `<div class="first-category"><span>No ${g.name.toLowerCase()} categories yet</span><button class="text-action" data-action="add-category" data-type="${esc(g.id)}">Create one</button></div>`}`;
  return `<section class="category-card"><header class="category-header"><span class="category-symbol ${g.color}">${symbol}</span><div class="category-heading"><h3>${g.name}</h3><span>${entries.length} ${entries.length === 1 ? 'item' : 'items'}</span></div><div class="category-total"><strong>${fmt(planned)}</strong><small>planned</small></div><div class="category-actions"><button class="icon-button add-small" data-action="add-entry" data-type="${esc(g.id)}" data-category="${esc(cats[0]?.id || '')}" aria-label="Add ${esc(g.name)} entry">+</button></div></header><div class="category-progress"><span class="${actual > planned && g.id !== 'income' ? 'over-budget' : ''}" style="width:${planned ? Math.min(100, actual / planned * 100) : (actual ? 100 : 0)}%"></span></div>${body}<footer class="category-footer"><span>Actual ${fmt(actual)}</span><span class="${differenceClass}">${signed(actual - planned)} diff</span></footer></section>`;
}

function open(content: string): void { dialog.innerHTML = content; if (!dialog.open) dialog.showModal(); }
function newBudgetDialog(): void {
  if (state.budgets.length) return;
  open(`<form class="dialog-form" data-form="budget"><div class="dialog-topline"><span class="dialog-icon">◷</span><button class="icon-button dialog-close" data-action="close" type="button" aria-label="Close">×</button></div><p class="panel-kicker">START YOUR BUDGET</p><h2>Set up your budget</h2><p class="dialog-copy">Choose the sections you want to include. You can add or remove categories later.</p><fieldset class="group-picker"><legend>Budget sections</legend>${GROUPS.map((g) => `<label class="group-option"><input type="checkbox" name="groups" value="${g.id}" ${g.id === 'income' ? 'checked disabled' : 'checked'}><span class="type-dot ${g.color}"></span><span>${g.name}</span>${g.id === 'income' ? '<small>Required</small>' : ''}</label>`).join('')}</fieldset><div class="dialog-actions"><button class="button button-secondary" data-action="close" type="button">Cancel</button><button class="button button-primary" type="submit">Set up <span>→</span></button></div></form>`);
}
function getWizard(): WizardState | null {
  return wizard;
}
function clearWizard(): void {
  wizard = null;
}
function wizardView(): void {
  const wizard = getWizard();
  if (!wizard) return;
  const b = state.budgets.find((item) => item.id === wizard.budgetId);
  if (!b) return;
  const steps = wizard.groups || GROUPS.map((group) => group.id);
  const g = GROUPS.find((group) => group.id === steps[wizard.step]);
  if (!g) { state.active = b.id; state.view = 'dashboard'; clearWizard(); persist(); render(); dialog.close(); setupCompleteDialog(); return; }
  const cats = b.categories.filter((c) => c.type === g.id);
  const count = b.categories.reduce((n, c) => n + c.entries.length, 0);
  dialog.innerHTML = `<div class="wizard"><div class="wizard-head"><span class="dialog-icon">${wizard.step + 1}</span><button class="icon-button dialog-close" data-action="close" type="button" aria-label="Close">×</button></div><p class="panel-kicker">BUDGET SETUP · ${wizard.step + 1} OF 6</p><div class="wizard-progress">${GROUPS.map((_, i) => `<span class="${i <= wizard.step ? 'done' : ''}"></span>`).join('')}</div><h2>Add ${g.name.toLowerCase()}</h2><p class="dialog-copy">${({ income: 'Start with money coming in. Add each source and its monthly planned amount.', bills: 'Add regular bills like rent, utilities, and insurance.', expenses: 'Add flexible spending such as groceries and transport.', subscriptions: 'Keep recurring memberships and services together.', debts: 'Plan payments toward loans, cards, and balances.', savings: 'Set aside money for goals, reserves, and future plans.' })[g.id]}</p><div class="wizard-existing">${cats.flatMap((c) => c.entries.map((e) => `<div class="wizard-row"><span>${esc(e.name)}</span><strong>${fmt(e.planned)}</strong></div>`)).join('') || '<span class="wizard-empty">Add items now, or skip this step and return later.</span>'}</div><form class="wizard-add-form" data-form="wizard-entry"><label for="wizard-name">${g.id === 'income' ? 'Income source' : 'Item name'}</label><div class="wizard-fields"><input id="wizard-name" name="name" placeholder="${g.id === 'income' ? 'e.g. Paycheck' : 'e.g. Monthly amount'}" maxlength="80" required><label class="sr-only" for="wizard-amount">Planned amount</label><span class="currency-prefix">$</span><input id="wizard-amount" name="planned" type="number" min="0" step="0.01" placeholder="0.00" required>${g.id === 'income' ? '<label for="wizard-pay-frequency">Pay frequency</label><select id="wizard-pay-frequency" name="frequency">' + PAY_FREQUENCIES.map((option) => `<option value="${option.value}" ${option.value === 'biweekly' ? 'selected' : ''}>${option.label}</option>`).join('') + '</select><label for="wizard-next-payday">Next payday</label><input id="wizard-next-payday" name="nextPayday" type="date">' : ''}</div><button class="button button-secondary wizard-add-button" type="submit">＋ Add ${g.id === 'income' ? 'income' : 'item'}</button></form><div class="dialog-actions wizard-actions"><button class="button button-secondary" data-action="wizard-back" type="button" ${wizard.step === 0 ? 'disabled' : ''}>Back</button><span class="wizard-count">${count} ${count === 1 ? 'item' : 'items'} added</span><button class="button button-primary" data-action="wizard-next" type="button">${wizard.step === 5 ? 'Finish setup' : 'Continue'} <span>→</span></button></div></div>`;
  const progress = requiredElement<HTMLElement>(dialog, '.wizard-progress');
  progress.replaceChildren(...steps.map((_, index) => {
    const segment = document.createElement('span');
    if (index <= wizard.step) segment.classList.add('done');
    return segment;
  }));
  requiredElement<HTMLElement>(dialog, '.wizard .panel-kicker').textContent = `BUDGET SETUP · ${wizard.step + 1} OF ${steps.length}`;
  requiredElement<HTMLButtonElement>(dialog, '[data-action="wizard-next"]').innerHTML = `${wizard.step === steps.length - 1 ? 'Finish setup' : 'Continue'} <span>→</span>`;
}
function monthAfter(month: string): string {
  const [year, number] = month.split('-').map(Number);
  const next = new Date(year, number, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}
function recalculateCarryovers(seriesId: string): void {
  const months = seriesBudgets(seriesId);
  months.forEach((budget, index) => {
    budget.carryover = index === 0 ? 0 : carryoverAmount(months[index - 1], budget.carryoverMethod ?? 'actual');
  });
}
function deleteCurrentMonth(): void {
  const budget = current();
  if (!budget || !window.confirm(`Delete ${monthText(budget.month)}? This month's categories and transactions will be removed.`)) return;
  const { seriesId, month } = budget;
  const removedIndex = state.budgets.indexOf(budget);
  const removedBudget = JSON.parse(JSON.stringify(budget)) as Budget;
  state.budgets = state.budgets.filter((item) => item.id !== budget.id);
  recalculateCarryovers(seriesId);
  const remaining = seriesBudgets(seriesId);
  const previous = remaining.filter((item) => item.month < month).at(-1);
  const fallback = previous || remaining[0] || [...state.budgets].sort((a, b) => b.month.localeCompare(a.month))[0];
  state.active = fallback?.id ?? null;
  if (!fallback) state.view = 'dashboard';
  offerUndo(`${monthText(month)} deleted`, () => {
    if (!state.budgets.some((item) => item.id === removedBudget.id)) {
      state.budgets.splice(Math.min(removedIndex, state.budgets.length), 0, removedBudget);
    }
    recalculateCarryovers(seriesId);
    state.active = removedBudget.id;
  });
  persist();
  render();
}
function newMonthDialog(): void {
  const source = latestInSeries(current()?.seriesId);
  if (!source) return;
  const carryoverMethod = state.preferences.carryoverMethod ?? 'actual';
  const carryover = carryoverAmount(source, carryoverMethod);
  const carryoverDescription = carryoverMethod === 'planned'
    ? 'planned unallocated income (planned income and carryover minus planned allocations)'
    : 'actual leftover (actual income and carryover minus actual spending)';
  const carryoverLabel = carryoverMethod === 'planned' ? 'Planned unallocated income' : 'Actual leftover';
  const month = monthAfter(source.month);
  open(`<form class="dialog-form" data-form="month" data-source="${esc(source.id)}"><div class="dialog-topline"><span class="dialog-icon">◷</span><button class="icon-button dialog-close" data-action="close" type="button" aria-label="Close">×</button></div><p class="panel-kicker">CLOSE ${esc(monthText(source.month).toUpperCase())}</p><h2>Create the next month?</h2><p class="dialog-copy">This will end ${esc(monthText(source.month))}. Planned categories and amounts will carry forward, actuals will reset to zero, and ${carryoverDescription} will become the next month’s carryover.</p><label for="new-month">New month</label><input id="new-month" name="month" type="month" value="${month}" required><p class="carryover-preview">${carryoverLabel} to next month <strong>${fmt(carryover)}</strong></p><p class="form-error" id="month-error" aria-live="polite"></p><div class="dialog-actions"><button class="button button-secondary" data-action="close" type="button">Cancel</button><button class="button button-primary" type="submit">Confirm and create month <span>→</span></button></div></form>`);
}
function expenseScheduleDialog(categoryId: string, schedule?: RecurringExpenseSchedule, sourceEntry?: BudgetEntry): void {
  const budget = current();
  if (!budget) return;
  const category = budget.categories.find((item) => item.id === (schedule?.categoryId ?? categoryId));
  const categories = budget.categories.filter((item) => item.type !== 'income' && (!sourceEntry || item.type === 'subscriptions'));
  if (!category || categories.length === 0) return;
  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const editing = schedule !== undefined;
  open(`<form class="dialog-form" data-form="expense-schedule" data-schedule="${esc(schedule?.id ?? '')}" data-source-entry="${esc(sourceEntry?.id ?? '')}"><div class="dialog-topline"><span class="dialog-icon">◷</span><button class="icon-button dialog-close" data-action="close" type="button" aria-label="Close">×</button></div><p class="panel-kicker">${editing ? 'UPDATE RECURRING EXPENSE' : sourceEntry ? 'SET UP SUBSCRIPTION RENEWAL' : 'REPEAT A PLANNED EXPENSE'}</p><h2>${editing ? 'Manage schedule' : sourceEntry ? 'Schedule subscription' : 'Schedule recurring item'}</h2><p class="dialog-copy">${sourceEntry ? 'This keeps your existing budget item and uses it for the next matching charge, rather than adding a duplicate.' : 'A planned item is added to each eligible month. Actual spending is recorded separately.'}</p><label for="expense-schedule-name">Item name</label><input id="expense-schedule-name" name="name" maxlength="80" value="${esc(schedule?.name ?? sourceEntry?.name ?? '')}" placeholder="e.g. Rent" required><label for="expense-schedule-amount">Planned amount</label><div class="input-money"><span>$</span><input id="expense-schedule-amount" name="amount" type="number" min="0.01" step="0.01" value="${schedule ? esc(schedule.amount) : sourceEntry ? esc(sourceEntry.planned) : ''}" placeholder="0.00" required></div><label for="expense-schedule-category">Category</label><select id="expense-schedule-category" name="categoryId" required>${categories.map((item) => `<option value="${esc(item.id)}" ${item.id === category.id ? 'selected' : ''}>${esc(item.name)} · ${esc(group(item.type).name)}</option>`).join('')}</select><label for="expense-schedule-frequency">Frequency</label><select id="expense-schedule-frequency" name="frequency">${PAY_FREQUENCIES.map((option) => `<option value="${option.value}" ${option.value === (schedule?.frequency ?? 'monthly') ? 'selected' : ''}>${option.label}</option>`).join('')}</select><label for="expense-schedule-date">Next due date</label><input id="expense-schedule-date" name="nextDueDate" type="date" value="${esc(schedule?.nextDueDate ?? sourceEntry?.dueDate ?? todayString)}" required><div class="dialog-actions">${editing ? `<button class="button button-danger" data-action="remove-expense-schedule" data-schedule="${esc(schedule.id)}" type="button">Remove</button><button class="button button-secondary" data-action="toggle-expense-schedule" data-schedule="${esc(schedule.id)}" type="button">${schedule.paused ? 'Resume' : 'Pause'}</button>` : ''}<button class="button button-secondary" data-action="close" type="button">Cancel</button><button class="button button-primary" type="submit">${editing ? 'Save changes' : 'Create schedule'}</button></div></form>`);
  const frequencySelect = requiredElement<HTMLSelectElement>(dialog, '#expense-schedule-frequency');
  const selectedFrequency = schedule?.frequency ?? 'monthly';
  frequencySelect.add(new Option('Yearly', 'yearly'));
  frequencySelect.value = selectedFrequency;
  if (category.type === 'subscriptions') {
    const setupTip = document.createElement('p');
    setupTip.className = 'subscription-form-tip';
    setupTip.textContent = 'Enter the amount charged each billing cycle and the next renewal date. Yearly charges are included as a monthly equivalent in your tracker.';
    requiredElement<HTMLElement>(dialog, 'label[for="expense-schedule-name"]').before(setupTip);
  }
  requiredElement<HTMLInputElement>(dialog, '#expense-schedule-name').focus();
}
function manageExpenseSchedulesDialog(categoryId?: string): void {
  const budget = current();
  const schedules = budget?.expenseSchedules.filter((schedule) => !categoryId || schedule.categoryId === categoryId) ?? [];
  if (!budget || schedules.length === 0) return;
  open(`<section class="dialog-form"><div class="dialog-topline"><span class="dialog-icon">◷</span><button class="icon-button dialog-close" data-action="close" type="button" aria-label="Close">×</button></div><p class="panel-kicker">BUDGET SETUP</p><h2>Recurring schedules</h2><p class="dialog-copy">Edit a schedule to update future planned items, or pause or remove it.</p><div class="expense-schedule-list">${schedules.map((schedule) => { const category = budget.categories.find((item) => item.id === schedule.categoryId); return `<div class="expense-schedule-row"><div><strong>${esc(schedule.name)}</strong><small>${esc(category?.name ?? 'Category')} · ${PAY_FREQUENCIES.find((item) => item.value === schedule.frequency)?.label ?? 'Recurring'} · ${schedule.paused ? 'Paused' : `Next due ${esc(displayDate(schedule.nextDueDate))}`}</small></div><button class="button button-secondary" data-action="edit-expense-schedule" data-schedule="${esc(schedule.id)}" type="button">Manage</button></div>`; }).join('')}</div><div class="dialog-actions"><button class="button button-secondary" data-action="close" type="button">Done</button></div></section>`);
}
function expenseEntryHasActivity(budget: Budget, entry: BudgetEntry): boolean {
  return entry.actual !== 0 || budget.transactions.some((transaction) => transaction.entryId === entry.id);
}
function synchronizeExpenseEntries(budget: Budget, schedule: RecurringExpenseSchedule): void {
  const destination = budget.categories.find((category) => category.id === schedule.categoryId);
  if (!destination) return;
  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const occurrences = schedule.paused ? [] : buildExpenseEntriesForMonth(schedule, budget.month).filter((entry) => entry.date >= todayString);
  const remainingOccurrences = new Map(occurrences.map((occurrence) => [occurrence.date, occurrence]));
  const scheduledEntries = budget.categories.flatMap((category) => category.entries
    .filter((entry) => entry.scheduleId === schedule.id)
    .map((entry) => ({ category, entry })));
  for (const { category, entry } of scheduledEntries) {
    const index = category.entries.indexOf(entry);
    if (index === -1 || !entry.scheduledDate || entry.scheduledDate < todayString) continue;
    const occurrence = remainingOccurrences.get(entry.scheduledDate);
    if (!occurrence) {
      if (expenseEntryHasActivity(budget, entry)) {
        if (!schedule.paused) {
          entry.scheduleId = null;
          delete entry.scheduledDate;
        } else if (category.id !== destination.id) {
          category.entries.splice(index, 1);
          destination.entries.push(entry);
          budget.transactions.forEach((transaction) => { if (transaction.entryId === entry.id) transaction.categoryId = destination.id; });
        }
      } else {
        category.entries.splice(index, 1);
      }
      continue;
    }
    remainingOccurrences.delete(entry.scheduledDate);
    if (category.id !== destination.id) {
      category.entries.splice(index, 1);
      destination.entries.push(entry);
      budget.transactions.forEach((transaction) => { if (transaction.entryId === entry.id) transaction.categoryId = destination.id; });
    }
    entry.name = occurrence.name;
    entry.planned = occurrence.amount;
  }
  for (const occurrence of remainingOccurrences.values()) {
    const existingEntry = destination.entries.find((entry) => !entry.scheduleId
      && entry.name.trim().toLocaleLowerCase() === occurrence.name.trim().toLocaleLowerCase());
    if (existingEntry) {
      existingEntry.name = occurrence.name;
      existingEntry.planned = occurrence.amount;
      existingEntry.scheduleId = schedule.id;
      existingEntry.scheduledDate = occurrence.date;
      delete existingEntry.dueDate;
    } else {
      destination.entries.push({ id: uid(), name: occurrence.name, planned: occurrence.amount, actual: 0, scheduleId: schedule.id, scheduledDate: occurrence.date });
    }
  }
}
function addExpenseSchedule(schedule: RecurringExpenseSchedule, sourceBudget: Budget): void {
  const sourceCategory = sourceBudget.categories.find((category) => category.id === schedule.categoryId);
  if (!sourceCategory) return;
  const futureBudgets = seriesBudgets(sourceBudget.seriesId).filter((budget) => budget.month >= sourceBudget.month);
  for (const budget of futureBudgets) {
    let category = budget.id === sourceBudget.id
      ? budget.categories.find((item) => item.id === sourceCategory.id)
      : budget.categories.find((item) => item.type === sourceCategory.type && item.name === sourceCategory.name);
    if (!category) {
      category = { ...sourceCategory, id: uid(), entries: [] };
      budget.categories.push(category);
      if (!budget.selectedTypes.includes(category.type)) budget.selectedTypes.push(category.type);
    }
    const monthSchedule = { ...schedule, categoryId: category.id };
    budget.expenseSchedules = [...(budget.expenseSchedules || []).filter((item) => item.id !== schedule.id), monthSchedule];
    synchronizeExpenseEntries(budget, monthSchedule);
  }
}
function removeExpenseSchedule(scheduleId: string, sourceBudget: Budget): void {
  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  for (const budget of seriesBudgets(sourceBudget.seriesId)) {
    for (const category of budget.categories) {
      for (let index = category.entries.length - 1; index >= 0; index--) {
        const entry = category.entries[index];
        if (entry.scheduleId !== scheduleId) continue;
        if (entry.scheduledDate && entry.scheduledDate >= todayString && !expenseEntryHasActivity(budget, entry)) {
          category.entries.splice(index, 1);
        } else {
          entry.scheduleId = null;
          delete entry.scheduledDate;
        }
      }
    }
    budget.expenseSchedules = budget.expenseSchedules.filter((schedule) => schedule.id !== scheduleId);
  }
}
function transactionItemOptions(categoryId: string, selectedEntryId: string | null = null): string {
  const category = current()?.categories.find((item) => item.id === categoryId);
  return `<option value="" ${selectedEntryId ? '' : 'selected'}>Category only</option>${category?.entries.map((entry) => `<option value="${esc(entry.id)}" ${entry.id === selectedEntryId ? 'selected' : ''}>${esc(entry.name)}</option>`).join('') ?? ''}`;
}
function transactionDialog(transaction: BudgetTransaction | null = null, duplicate = false): void {
  const budget = current();
  if (!budget || budget.categories.length === 0) return;
  const selectedCategoryId = transaction?.categoryId ?? budget.categories[0].id;
  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  open(`<form class="dialog-form" data-form="transaction" data-transaction="${esc(transaction?.id ?? '')}"><div class="dialog-topline"><span class="dialog-icon">${transaction ? '↗' : '＋'}</span><button class="icon-button dialog-close" data-action="close" type="button" aria-label="Close">×</button></div><p class="panel-kicker">${transaction ? 'UPDATE RECORDED ACTIVITY' : 'RECORD ACTUAL ACTIVITY'}</p><h2>${transaction ? 'Edit transaction' : 'Add transaction'}</h2><label for="transaction-date">Date</label><input id="transaction-date" name="date" type="date" value="${esc(transaction?.date ?? todayString)}" required><label for="transaction-description">Description</label><input id="transaction-description" name="description" maxlength="100" value="${esc(transaction?.description ?? '')}" placeholder="e.g. Grocery store" required><label for="transaction-amount">Amount</label><div class="input-money"><span>$</span><input id="transaction-amount" name="amount" type="number" min="0.01" step="0.01" value="${transaction ? esc(transaction.amount) : ''}" placeholder="0.00" required></div><label for="transaction-category">Budget category</label><select id="transaction-category" name="categoryId" required>${budget.categories.map((category) => `<option value="${esc(category.id)}" ${category.id === selectedCategoryId ? 'selected' : ''}>${esc(category.name)} · ${esc(group(category.type).name)}</option>`).join('')}</select><label for="transaction-entry">Budget item <span>(optional)</span></label><select id="transaction-entry" name="entryId">${transactionItemOptions(selectedCategoryId, transaction?.entryId ?? null)}</select><div class="dialog-actions">${transaction ? '<button class="button button-danger" data-action="delete-transaction" data-transaction="' + esc(transaction.id) + '" type="button">Delete</button>' : '<span></span>'}<button class="button button-secondary" data-action="close" type="button">Cancel</button><button class="button button-primary" type="submit">${transaction ? 'Save changes' : 'Add transaction'}</button></div></form>`);
  if (transaction && duplicate) {
    requiredElement<HTMLFormElement>(dialog, 'form').dataset.transaction = '';
    requiredElement<HTMLElement>(dialog, '.panel-kicker').textContent = 'CREATE A COPY OF RECORDED ACTIVITY';
    requiredElement<HTMLHeadingElement>(dialog, 'h2').textContent = 'Duplicate transaction';
    requiredElement<HTMLButtonElement>(dialog, '[data-action="delete-transaction"]').remove();
    requiredElement<HTMLButtonElement>(dialog, '.button-primary').textContent = 'Add duplicate';
  } else if (transaction) {
    const duplicateButton = document.createElement('button');
    duplicateButton.type = 'button';
    duplicateButton.className = 'text-action transaction-duplicate';
    duplicateButton.dataset.action = 'duplicate-transaction';
    duplicateButton.dataset.transaction = transaction.id;
    duplicateButton.textContent = 'Duplicate';
    requiredElement<HTMLElement>(dialog, '.dialog-topline').insertBefore(duplicateButton, requiredElement(dialog, '.dialog-close'));
  }
  requiredElement<HTMLInputElement>(dialog, '#transaction-description').focus();
}
function categoryDialog(type: string = 'expenses'): void {
  const customType = type.startsWith('custom:');
  open(`<form class="dialog-form" data-form="category"><div class="dialog-topline"><span class="dialog-icon">＋</span><button class="icon-button dialog-close" data-action="close" type="button" aria-label="Close">×</button></div><p class="panel-kicker">MAKE ROOM FOR A NEW LINE</p><h2>New category</h2><p class="dialog-copy">Create a category inside a standard group or define a new spending type.</p><label for="category-name">Category name</label><input id="category-name" name="name" maxlength="60" placeholder="e.g. Home projects" required><label for="category-type">Category type</label><select id="category-type" name="type">${GROUPS.map((g) => `<option value="${g.id}" ${g.id === type ? 'selected' : ''}>${g.name}</option>`).join('')}<option value="custom" ${customType ? 'selected' : ''}>Custom type…</option></select><div id="custom-type-field" ${customType ? '' : 'hidden'}><label for="custom-type">Custom type name</label><input id="custom-type" name="customType" maxlength="40" value="${customType ? esc(type.slice(7)) : ''}" placeholder="e.g. Pet care" ${customType ? 'required' : ''}></div><div class="dialog-actions"><button class="button button-secondary" data-action="close" type="button">Cancel</button><button class="button button-primary" type="submit">Create category</button></div></form>`);
  requiredElement<HTMLInputElement>(dialog, '#category-name').focus();
}
function entryDialog(categoryId: string = '', type: string = 'expenses', entry: BudgetEntry | null = null): void {
  const b = current(); if (!b) return;
  const cat = b.categories.find((c) => c.id === categoryId);
  const wantedType = cat?.type || type;
  const options = b.categories.filter((c) => c.type === wantedType);
  const selected = cat?.id || options[0]?.id || '';
  open(`<form class="dialog-form" data-form="${entry ? 'edit-entry' : 'entry'}" data-entry="${esc(entry?.id || '')}"><div class="dialog-topline"><span class="dialog-icon">${entry ? '↗' : '＋'}</span><button class="icon-button dialog-close" data-action="close" type="button" aria-label="Close">×</button></div><p class="panel-kicker">${entry ? 'UPDATE YOUR PLAN' : 'ADD TO YOUR PLAN'}</p><h2>${entry ? 'Edit entry' : 'New entry'}</h2><label for="entry-name">Name</label><input id="entry-name" name="name" maxlength="80" value="${esc(entry?.name || '')}" placeholder="e.g. Electricity" required><label for="entry-category">Category</label><select id="entry-category" name="categoryId" required>${b.categories.map((c) => `<option value="${esc(c.id)}" ${c.id === selected ? 'selected' : ''}>${esc(c.name)} · ${group(c.type).name}</option>`).join('')}</select><div class="amount-fields"><div><label for="entry-planned">Planned</label><div class="input-money"><span>$</span><input id="entry-planned" name="planned" type="number" min="0" step="0.01" value="${esc(entry?.planned ?? 0)}" required></div></div><div><label for="entry-actual">Actual</label><div class="input-money"><span>$</span><input id="entry-actual" name="actual" type="number" min="0" step="0.01" value="${esc(entry?.actual ?? 0)}" required></div></div></div><div class="dialog-actions">${entry ? `<button class="button button-danger" data-action="delete-entry" data-entry="${esc(entry.id)}" type="button">Delete</button>` : '<span></span>'}<button class="button button-secondary" data-action="close" type="button">Cancel</button><button class="button button-primary" type="submit">${entry ? 'Save changes' : 'Add entry'}</button></div></form>`);
  const dueDateField = document.createElement('div');
  dueDateField.id = 'entry-due-date-field';
  dueDateField.className = 'subscription-date-field';
  dueDateField.hidden = cat?.type !== 'subscriptions' || Boolean(entry?.scheduleId);
  dueDateField.innerHTML = `<label for="entry-due-date">Next due date <span class="field-optional">Optional</span></label><input id="entry-due-date" name="dueDate" type="date" value="${esc(entry?.dueDate ?? '')}"><small>For reminders only. To add this charge to future budgets, use the Schedule option in the tracker.</small>`;
  requiredElement<HTMLElement>(dialog, '.amount-fields').after(dueDateField);
  requiredElement<HTMLInputElement>(dialog, '#entry-name').focus();
}

document.addEventListener('click', (event: MouseEvent) => {
  if (!(event.target instanceof Element)) return;
  const openBudgetMenu = root.querySelector<HTMLDetailsElement>('.budget-menu[open]');
  if (openBudgetMenu && !openBudgetMenu.contains(event.target)) openBudgetMenu.open = false;
  const button = event.target.closest<HTMLButtonElement>('[data-action]'); if (!button) return;
  const { action, id, category, type, entry, transaction, schedule } = button.dataset;
  if (action === 'navigate' && ['dashboard', 'transactions', 'subscriptions', 'review', 'reports', 'settings'].includes(button.dataset.page ?? '')) {
    state.view = button.dataset.page as AppState['view'];
    if (state.view === 'dashboard' || state.view === 'transactions') dashboardTab = state.view === 'transactions' ? 'transactions' : 'overview';
    render();
    return;
  }
  if (action === 'undo-delete') {
    const restore = pendingUndo;
    clearUndo();
    if (restore) {
      restore();
      persist();
      render();
    }
    return;
  }
  if (action === 'retry-load') { void initialize(); return; }
  if (action === 'guided-tour') { showGuidedTour(); return; }
  if (action === 'setup-finish') { dialog.close(); return; }
  if (action === 'tour-finish') { finishGuidedTour(); return; }
  if (action === 'tour-previous') { showGuidedTour(guidedTourStep - 1); return; }
  if (action === 'tour-next') {
    if (guidedTourStep === GUIDED_TOUR_STEPS.length - 1) finishGuidedTour();
    else showGuidedTour(guidedTourStep + 1);
    return;
  }
  if (action === 'export-backup') exportBackup();
  if (action === 'import-backup') requiredElement<HTMLInputElement>(root, '#backup-file').click();
  if (action === 'new-budget') newBudgetDialog();
  if (action === 'new-month') newMonthDialog();
  if (action === 'add-subscription') {
    beginSubscriptionSetup();
    return;
  }
  if (action === 'toggle-transaction-sort-direction') {
    const sort = transactionSortConfig();
    setTransactionSort(sort.field, sort.direction === 'asc' ? 'desc' : 'asc');
    return;
  }
  if (action === 'select-visible') {
    for (const row of root.querySelectorAll<HTMLTableRowElement>('[data-transaction-row]:not([hidden])')) {
      const id = row.dataset.transactionId;
      if (id) selectedTransactionIds.add(id);
      const checkbox = row.querySelector<HTMLInputElement>('.transaction-select');
      if (checkbox) checkbox.checked = true;
    }
    updateTransactionSelectionUI();
  }
  if (action === 'clear-selection') {
    selectedTransactionIds.clear();
    root.querySelectorAll<HTMLInputElement>('.transaction-select').forEach((checkbox) => { checkbox.checked = false; });
    updateTransactionSelectionUI();
  }
  if (action === 'delete-selected') {
    const budget = current();
    const selected = budget?.transactions.filter((item) => selectedTransactionIds.has(item.id)) ?? [];
    if (budget && selected.length && window.confirm(`Delete ${selected.length} selected ${selected.length === 1 ? 'transaction' : 'transactions'}? You can undo this briefly.`)) {
      const deleted = selected.map((transaction) => ({ transaction, index: budget.transactions.indexOf(transaction) }));
      budget.transactions = budget.transactions.filter((item) => !selectedTransactionIds.has(item.id));
      selectedTransactionIds.clear();
      offerUndo(`${deleted.length} ${deleted.length === 1 ? 'transaction' : 'transactions'} deleted`, () => restoreDeletedTransactions(budget, deleted));
      persist(); render();
    }
  }
  if (action === 'delete-month') deleteCurrentMonth();
  if (action === 'new-transaction') transactionDialog();
  if (action === 'toggle-transaction-sort-direction') {
    const sort = transactionSortConfig();
    setTransactionSort(sort.field, sort.direction === 'asc' ? 'desc' : 'asc');
    return;
  }
  if (action === 'edit-transaction' && transaction) {
    const found = current()?.transactions.find((item) => item.id === transaction);
    if (found) transactionDialog(found);
  }
  if (action === 'duplicate-transaction' && transaction) {
    const found = current()?.transactions.find((item) => item.id === transaction);
    if (found) transactionDialog(found, true);
  }
  if (action === 'select-month' && id) { state.active = id; persist(); render(); }
  if (action === 'add-category') categoryDialog(type || 'expenses');
  if (action === 'add-entry') entryDialog(category || '', type || 'expenses');
  if (action === 'add-expense-schedule' && category) expenseScheduleDialog(category);
  if (action === 'schedule-subscription' && category && entry) {
    const budget = current();
    const sourceEntry = budget?.categories.find((item) => item.id === category)?.entries.find((item) => item.id === entry);
    if (sourceEntry) expenseScheduleDialog(category, undefined, sourceEntry);
  }
  if (action === 'manage-expense-schedules') manageExpenseSchedulesDialog(category);
  if (action === 'edit-expense-schedule' && schedule) {
    const budget = current();
    const found = budget?.expenseSchedules.find((item) => item.id === schedule);
    if (found) expenseScheduleDialog(found.categoryId, found);
  }
  if (action === 'toggle-expense-schedule' && schedule) {
    const budget = current();
    const found = budget?.expenseSchedules.find((item) => item.id === schedule);
    if (budget && found) {
      addExpenseSchedule({ ...found, paused: !found.paused }, budget);
      persist(); dialog.close(); render();
    }
  }
  if (action === 'remove-expense-schedule' && schedule) {
    const budget = current();
    const found = budget?.expenseSchedules.find((item) => item.id === schedule);
    if (budget && found && window.confirm(`Remove the recurring schedule for "${found.name}"? Future planned occurrences without actual activity will be removed.`)) {
      const snapshots = seriesBudgets(budget.seriesId).map((monthBudget) => {
        const monthSchedule = monthBudget.expenseSchedules.find((item) => item.id === schedule);
        return {
          budgetId: monthBudget.id,
          scheduleIndex: monthBudget.expenseSchedules.findIndex((item) => item.id === schedule),
          schedule: monthSchedule ? { ...monthSchedule } : undefined,
          entries: monthBudget.categories.flatMap((item) => item.entries.map((scheduledEntry, index) => ({ categoryId: item.id, index, entry: { ...scheduledEntry } })).filter(({ entry: scheduledEntry }) => scheduledEntry.scheduleId === schedule)),
        };
      });
      removeExpenseSchedule(schedule, budget);
      offerUndo(`Schedule for "${found.name}" removed`, () => {
        for (const snapshot of snapshots) {
          const monthBudget = state.budgets.find((item) => item.id === snapshot.budgetId);
          if (!monthBudget || !snapshot.schedule) continue;
          for (const item of monthBudget.categories) item.entries = item.entries.filter((scheduledEntry) => !snapshot.entries.some(({ entry: original }) => original.id === scheduledEntry.id));
          monthBudget.expenseSchedules = monthBudget.expenseSchedules.filter((item) => item.id !== schedule);
          monthBudget.expenseSchedules.splice(Math.max(0, snapshot.scheduleIndex), 0, snapshot.schedule);
          for (const original of [...snapshot.entries].sort((left, right) => left.index - right.index)) {
            const destination = monthBudget.categories.find((item) => item.id === original.categoryId);
            if (destination) destination.entries.splice(Math.min(original.index, destination.entries.length), 0, original.entry);
          }
        }
      });
      persist(); dialog.close(); render();
    }
  }
  if (action === 'edit-entry' && category) { const found = current()?.categories.find((c) => c.id === category)?.entries.find((e) => e.id === entry); if (found) entryDialog(category, 'expenses', found); }
  if (action === 'close') dialog.close();
  if (action === 'wizard-back' && wizard && wizard.step > 0) { wizard.step--; wizardView(); }
  if (action === 'wizard-next' && wizard) { wizard.step++; persist(); wizardView(); }
  if (action === 'delete-entry' && entry && window.confirm('Delete this budget entry? Its linked transactions will also be removed.')) {
    const budget = current();
    if (budget) {
      const location = budget.categories.flatMap((item) => item.entries.map((budgetEntry, index) => ({ category: item, entry: budgetEntry, index }))).find((item) => item.entry.id === entry);
      const deletedTransactions = budget.transactions.map((item, index) => ({ transaction: item, index })).filter(({ transaction: item }) => item.entryId === entry);
      if (location) {
        location.category.entries = location.category.entries.filter((item) => item.id !== entry);
      }
      budget.transactions = budget.transactions.filter((transaction) => transaction.entryId !== entry);
      if (location) offerUndo(`"${location.entry.name}" deleted`, () => {
        const destination = budget.categories.find((item) => item.id === location.category.id);
        if (destination && !destination.entries.some((item) => item.id === entry)) {
          destination.entries.splice(Math.min(location.index, destination.entries.length), 0, location.entry);
        }
        restoreDeletedTransactions(budget, deletedTransactions);
      });
    }
    persist(); dialog.close(); render();
  }
  if (action === 'delete-transaction' && transaction && window.confirm('Delete this transaction?')) {
    const budget = current();
    const deleted = budget?.transactions.map((item, index) => ({ transaction: item, index })).filter(({ transaction: item }) => item.id === transaction) ?? [];
    if (budget) {
      budget.transactions = budget.transactions.filter((item) => item.id !== transaction);
      if (deleted.length) offerUndo('Transaction deleted', () => restoreDeletedTransactions(budget, deleted));
    }
    persist(); dialog.close(); render();
  }
});
document.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape' && guidedTourLayer) {
    event.preventDefault();
    finishGuidedTour();
  }
});
document.addEventListener('input', (event: Event) => {
  if (!(event.target instanceof HTMLInputElement) || event.target.id !== 'transaction-search') return;
  transactionSearch = event.target.value;
  selectedTransactionIds.clear();
  root.querySelectorAll<HTMLInputElement>('.transaction-select').forEach((checkbox) => { checkbox.checked = false; });
  applyTransactionFilters();
});
document.addEventListener('change', (event: Event) => {
  const target = event.target;
  if (target instanceof HTMLSelectElement && ['transaction-category-filter', 'transaction-item-filter'].includes(target.id)) {
    if (target.id === 'transaction-category-filter') transactionCategoryFilter = target.value;
    else transactionItemFilter = target.value;
    selectedTransactionIds.clear();
    root.querySelectorAll<HTMLInputElement>('.transaction-select').forEach((checkbox) => { checkbox.checked = false; });
    applyTransactionFilters();
    return;
  }
  if (target instanceof HTMLSelectElement && target.id === 'theme-select') {
    state.preferences = { ...state.preferences, theme: target.value as ThemePreference };
    persist();
    applyAppearance();
    return;
  }
  if (target instanceof HTMLSelectElement && target.id === 'accent-color-select') {
    const accentColor = ACCENT_COLORS.find(([value]) => value === target.value)?.[0];
    if (!accentColor) return;
    state.preferences = { ...state.preferences, accentColor };
    persist();
    applyAppearance();
    return;
  }
  if (target instanceof HTMLSelectElement && target.id === 'text-size-select') {
    const textSize = TEXT_SIZES.find(([value]) => value === target.value)?.[0];
    if (!textSize) return;
    state.preferences = { ...state.preferences, textSize };
    persist();
    applyAppearance();
    return;
  }
  if (target instanceof HTMLSelectElement && target.id === 'density-select') {
    const density = DENSITIES.find(([value]) => value === target.value)?.[0];
    if (!density) return;
    state.preferences = { ...state.preferences, density };
    persist();
    applyAppearance();
    return;
  }
  if (target instanceof HTMLSelectElement && target.id === 'currency-select') {
    const currency = CURRENCIES.find(([value]) => value === target.value)?.[0];
    if (!currency) return;
    state.preferences = { ...state.preferences, currency };
    persist();
    render();
    return;
  }
  if (target instanceof HTMLSelectElement && target.id === 'date-format-select') {
    const dateFormat = DATE_FORMATS.find(([value]) => value === target.value)?.[0];
    if (!dateFormat) return;
    state.preferences = { ...state.preferences, dateFormat };
    persist();
    render();
    return;
  }
  if (target instanceof HTMLSelectElement && target.id === 'week-start-select') {
    state.preferences = { ...state.preferences, weekStartsOn: target.value as WeekStart };
    persist();
    return;
  }
  if (target instanceof HTMLSelectElement && target.id === 'carryover-method-select') {
    state.preferences = { ...state.preferences, carryoverMethod: target.value as CarryoverMethod };
    persist();
    return;
  }
  if (target instanceof HTMLSelectElement && target.id === 'transaction-sort-field') {
    setTransactionSort(target.value as TransactionSortField);
    return;
  }
});
document.addEventListener('change', (event: Event) => {
  if (!(event.target instanceof HTMLInputElement)) return;
  if (event.target.classList.contains('transaction-select')) {
    const id = event.target.dataset.transactionCheck;
    if (id && event.target.checked) selectedTransactionIds.add(id);
    else if (id) selectedTransactionIds.delete(id);
    updateTransactionSelectionUI();
    return;
  }
  if (event.target.id !== 'backup-file') return;
  const [file] = event.target.files ?? [];
  if (file) void importBackup(file);
  event.target.value = '';
});
dialog.addEventListener('change', (event: Event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  if (target.id === 'category-type') {
    const custom = target.value === 'custom';
    requiredElement<HTMLElement>(dialog, '#custom-type-field').hidden = !custom;
    requiredElement<HTMLInputElement>(dialog, '#custom-type').required = custom;
  } else if (target.id === 'transaction-category') {
    requiredElement<HTMLSelectElement>(dialog, '#transaction-entry').innerHTML = transactionItemOptions(target.value);
  } else if (target.id === 'entry-category') {
    const budget = current();
    const selectedCategory = budget?.categories.find((item) => item.id === target.value);
    const dueDateField = dialog.querySelector<HTMLElement>('#entry-due-date-field');
    if (dueDateField) dueDateField.hidden = selectedCategory?.type !== 'subscriptions';
  }
});
dialog.addEventListener('click', (event: MouseEvent) => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('submit', (event: SubmitEvent) => {
  if (!(event.target instanceof HTMLFormElement)) return;
  event.preventDefault();
  const form = event.target;
  const data = new FormData(form);
  if (form.dataset.form === 'budget') {
    const selectedTypes: BudgetGroupId[] = ['income', ...Array.from(form.querySelectorAll<HTMLInputElement>('input[name="groups"]:checked'), (input) => input.value as BudgetGroupId).filter((type) => type !== 'income')];
    const now = new Date(), month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const b = { id: uid(), seriesId: uid(), name: 'Budget', month, carryover: 0, selectedTypes, categories: defaultCategories(selectedTypes), transactions: [], incomeSchedules: [], expenseSchedules: [] };
    state.budgets = [b]; state.active = b.id; state.view = 'dashboard'; dashboardTab = 'overview'; wizard = { budgetId: b.id, groups: selectedTypes, step: 0 }; persist(); wizardView();
  } else if (form.dataset.form === 'month') {
    const source = state.budgets.find((item) => item.id === form.dataset.source);
    if (!source) return;
    const month = String(data.get('month'));
    if (seriesBudgets(source.seriesId).some((item) => item.month === month)) {
      requiredElement<HTMLElement>(dialog, '#month-error').textContent = 'This budget already has a month with that date.';
      return;
    }
    const latest = latestInSeries(source.seriesId);
    const template = latest || source;
    const clonedCategories = template.categories.map((category) => ({
      ...category,
      id: uid(),
      entries: category.entries.map((entry) => {
        const clonedEntry = { ...entry, id: uid(), actual: 0 };
        if (clonedEntry.dueDate && clonedEntry.dueDate < `${month}-01`) delete clonedEntry.dueDate;
        return clonedEntry;
      }),
    }));
    const categoryIdMap = new Map(template.categories.map((category, index) => [category.id, clonedCategories[index].id]));
    const expenseScheduleIds = new Set((template.expenseSchedules || []).map((schedule) => schedule.id));
    clonedCategories.forEach((category) => { category.entries = category.entries.filter((entry) => !entry.scheduleId || !expenseScheduleIds.has(entry.scheduleId)); });
    const expenseSchedules = (template.expenseSchedules || []).flatMap((schedule) => {
      const categoryId = categoryIdMap.get(schedule.categoryId);
      return categoryId ? [{ ...schedule, categoryId }] : [];
    });
    for (const schedule of expenseSchedules) {
      const category = clonedCategories.find((item) => item.id === schedule.categoryId);
      if (!category) continue;
      for (const occurrence of buildExpenseEntriesForMonth(schedule, month)) {
        const existingEntry = category.entries.find((entry) => !entry.scheduleId
          && entry.name.trim().toLocaleLowerCase() === occurrence.name.trim().toLocaleLowerCase());
        if (existingEntry) {
          existingEntry.name = occurrence.name;
          existingEntry.planned = occurrence.amount;
          existingEntry.scheduleId = schedule.id;
          existingEntry.scheduledDate = occurrence.date;
          delete existingEntry.dueDate;
        } else {
          category.entries.push({
            id: uid(),
            name: occurrence.name,
            planned: occurrence.amount,
            actual: 0,
            scheduleId: schedule.id,
            scheduledDate: occurrence.date,
          });
        }
      }
    }
    const incomeCategory = clonedCategories.find((category) => category.type === 'income');
    if (incomeCategory) {
      incomeCategory.entries = incomeCategory.entries.filter((entry) => !entry.scheduleId);
      const scheduledEntries = (template.incomeSchedules || []).flatMap((schedule) => buildIncomeEntriesForMonth(schedule, month).map((entry: { name: string; amount: number }) => ({
        id: uid(),
        name: entry.name,
        planned: entry.amount,
        actual: 0,
        scheduleId: schedule.id,
      })));
      incomeCategory.entries.push(...scheduledEntries);
    }
    const carryoverMethod = state.preferences.carryoverMethod ?? 'actual';
    const b = {
      id: uid(), seriesId: template.seriesId, name: template.name, month,
      carryover: carryoverAmount(template, carryoverMethod),
      carryoverMethod,
      selectedTypes: [...(template.selectedTypes || GROUPS.map((g) => g.id))],
      transactions: [],
      categories: clonedCategories,
      incomeSchedules: [...(template.incomeSchedules || [])],
      expenseSchedules,
    };
    state.budgets.push(b); state.active = b.id; state.view = 'dashboard'; persist(); dialog.close(); render();
  } else if (form.dataset.form === 'expense-schedule') {
    const budget = current();
    const categoryId = String(data.get('categoryId') ?? '');
    const category = budget?.categories.find((item) => item.id === categoryId);
    if (!budget || !category || category.type === 'income') return;
    const name = String(data.get('name') ?? '').trim();
    const amount = Number(data.get('amount'));
    const frequency = String(data.get('frequency') || 'monthly') as ExpenseFrequency;
    const nextDueDate = String(data.get('nextDueDate') ?? '');
    if (!name || amount <= 0 || !nextDueDate || !EXPENSE_FREQUENCIES.some((option) => option.value === frequency)) return;
    const existing = budget.expenseSchedules.find((schedule) => schedule.id === form.dataset.schedule);
    const sourceEntryId = form.dataset.sourceEntry;
    if (sourceEntryId && !existing) {
      const source = budget.categories
        .flatMap((item) => item.entries.map((entry) => ({ category: item, entry })))
        .find((item) => item.entry.id === sourceEntryId);
      if (source) {
        if (source.category.id !== category.id) {
          source.category.entries.splice(source.category.entries.indexOf(source.entry), 1);
          category.entries.push(source.entry);
          budget.transactions.forEach((transaction) => { if (transaction.entryId === sourceEntryId) transaction.categoryId = category.id; });
        }
        source.entry.name = name;
        source.entry.dueDate = nextDueDate;
      }
    }
    addExpenseSchedule({
      id: existing?.id ?? uid(),
      categoryId: category.id,
      name,
      amount,
      frequency,
      intervalDays: expenseFrequencyInterval(frequency),
      nextDueDate,
      paused: existing?.paused ?? false,
    }, budget);
    persist(); dialog.close(); render();
  } else if (form.dataset.form === 'transaction') {
    const budget = current();
    if (!budget) return;
    const categoryId = String(data.get('categoryId') ?? '');
    const entryId = String(data.get('entryId') ?? '') || null;
    const amount = Number(data.get('amount'));
    const description = String(data.get('description') ?? '').trim();
    const date = String(data.get('date') ?? '');
    const category = budget.categories.find((item) => item.id === categoryId);
    if (!category || (entryId && !category.entries.some((item) => item.id === entryId)) || !description || !date || amount <= 0) return;
    const transaction: BudgetTransaction = { id: form.dataset.transaction || uid(), date, description, amount, categoryId, entryId };
    const existingIndex = budget.transactions.findIndex((item) => item.id === transaction.id);
    if (existingIndex >= 0) budget.transactions[existingIndex] = transaction;
    else budget.transactions.push(transaction);
    persist(); dialog.close(); render();
  } else if (form.dataset.form === 'wizard-entry') {
    const activeWizard = wizard;
    if (!activeWizard) return;
    const b = state.budgets.find((item) => item.id === activeWizard.budgetId);
    const groupId = activeWizard.groups[activeWizard.step];
    const g = GROUPS.find((item) => item.id === groupId);
    if (!b || !g) return;
    let c = b.categories.find((item) => item.type === g.id); if (!c) { c = { id: uid(), type: g.id, name: g.name, entries: [] }; b.categories.push(c); }
    const name = String(data.get('name') ?? '').trim();
    const planned = Number(data.get('planned')) || 0;
    const nextPayday = String(data.get('nextPayday') ?? '').trim();
    if (g.id === 'income' && nextPayday) {
      const frequency = (String(data.get('frequency') || 'biweekly') as PayFrequency);
      const schedule: RecurringIncomeSchedule = { id: uid(), name, amount: planned, frequency, intervalDays: payFrequencyInterval(frequency), nextPayday };
      b.incomeSchedules.push(schedule);

  // Use the existing scheduler to find all paydays in the current month
      const monthEntries = buildIncomeEntriesForMonth(schedule, b.month);
  
  // Sum them up to get the true monthly planned amount
      const calculatedPlanned = monthEntries.reduce((sum, item) => sum + item.amount, 0);

  // Fallback to the raw single amount if the scheduler returns 0 for any reason
      const finalPlanned = calculatedPlanned > 0 ? calculatedPlanned : planned;

      c.entries.push({ id: uid(), name, planned: finalPlanned, actual: 0, scheduleId: schedule.id });
    } else {
      c.entries.push({ id: uid(), name, planned, actual: 0 });
    }
    persist(); wizardView();
  } else if (form.dataset.form === 'category') {
    const b = current(); if (!b) return;
    const customName = String(data.get('customType') || '').trim();
    const type = (data.get('type') === 'custom' ? `custom:${customName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : String(data.get('type'))) as BudgetGroupId;
    b.categories.push({ id: uid(), type, ...(customName ? { typeName: customName } : {}), name: String(data.get('name')).trim(), entries: [] }); persist(); dialog.close(); render();
  } else if (form.dataset.form === 'entry' || form.dataset.form === 'edit-entry') {
    const b = current(); if (!b) return;
    const c = b.categories.find((item) => item.id === String(data.get('categoryId'))); if (!c) return;
    const values = { name: String(data.get('name') ?? '').trim(), planned: Number(data.get('planned')) || 0, actual: Number(data.get('actual')) || 0 };
    const dueDate = String(data.get('dueDate') ?? '');
    if (form.dataset.form === 'edit-entry') {
      let old: BudgetEntry | undefined;
      b.categories.forEach((item) => { const index = item.entries.findIndex((e) => e.id === form.dataset.entry); if (index !== -1) old = item.entries.splice(index, 1)[0]; });
      if (!old) return;
      const existingEntry = old;
      const savedEntry = { ...existingEntry, ...values };
      if (c.type === 'subscriptions' && dueDate && !savedEntry.scheduleId) savedEntry.dueDate = dueDate;
      else delete savedEntry.dueDate;
      c.entries.push(savedEntry);
      b.transactions.forEach((transaction) => { if (transaction.entryId === existingEntry.id) transaction.categoryId = c.id; });
    } else c.entries.push({ id: uid(), ...values, ...(c.type === 'subscriptions' && dueDate ? { dueDate } : {}) });
    persist(); dialog.close(); render();
  }
});
void initialize();
