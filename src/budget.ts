import './budget.css';
import './budget-workflow.css';

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

interface BudgetGroup {
  id: BudgetGroupId;
  name: string;
  color: string;
}

interface StandardBudgetGroup extends BudgetGroup {
  id: StandardGroupId;
}

interface BudgetEntry {
  id: string;
  name: string;
  planned: number;
  actual: number;
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
  selectedTypes: BudgetGroupId[];
  categories: BudgetCategory[];
  transactions: BudgetTransaction[];
}

interface AppState {
  budgets: Budget[];
  active: string | null;
  view: 'home' | 'budget';
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

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const root = document.createElement('div');
root.id = 'budget-app';
const dialog = document.createElement('dialog');
dialog.className = 'dialog';
dialog.id = 'app-dialog';
document.body.replaceChildren(root, dialog);
const uid = () => crypto.randomUUID();
const defaultCategories = (types: BudgetGroupId[] = GROUPS.map((g) => g.id)): BudgetCategory[] => GROUPS.filter((g) => types.includes(g.id)).map((g) => ({ id: uid(), type: g.id, name: g.name, entries: [] }));

function load(): AppState {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { budgets?: Budget[]; active?: string | null } | null;
    if (Array.isArray(data?.budgets)) return {
      budgets: data.budgets.filter((budget) => Array.isArray(budget.categories)).map((budget) => ({ ...budget, seriesId: budget.seriesId || budget.id, carryover: Number(budget.carryover) || 0, selectedTypes: budget.selectedTypes || GROUPS.map((group) => group.id), transactions: Array.isArray(budget.transactions) ? budget.transactions.map((transaction) => ({ ...transaction, entryId: transaction.entryId ?? null })) : [] })),
      active: data.active ?? null,
      view: 'home',
    };
  } catch { /* Start with a clean local workspace if stored data is invalid. */ }
  return { budgets: [], active: null, view: 'home' };
}
const state: AppState = load();
let wizard: WizardState | null = null;
let dashboardTab: 'overview' | 'transactions' = 'overview';
let saveTimer: number | undefined;
const HTML_ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);
const fmt = (value: number): string => money.format(Number(value) || 0);
const group = (type: BudgetGroupId): BudgetGroup => GROUPS.find((item) => item.id === type) || { id: type, name: current()?.categories.find((category) => category.type === type)?.typeName || type.replace(/^custom:/, ''), color: 'teal' };
const current = (): Budget | null => state.budgets.find((budget) => budget.id === state.active) || null;
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
const monthText = (month: string): string => { const [y, m] = month.split('-').map(Number); return y && m ? new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'New budget'; };
const displayDate = (date: string): string => {
  const [year, month, day] = date.split('-').map(Number);
  return year && month && day ? new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : date;
};
function persist() {
  const status = document.querySelector('#save-status');
  if (status) status.textContent = 'Saving';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(KEY, JSON.stringify({ budgets: state.budgets, active: state.active }));
    const currentStatus = document.querySelector('#save-status');
    if (currentStatus) currentStatus.textContent = 'All changes saved';
  }, 120);
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
const signed = (n: number): string => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n))}`;

function requiredElement<T extends Element>(parent: ParentNode, selector: string): T {
  const element = parent.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

function render(): void {
  const budget = current();
  const series = [...new Set(state.budgets.map((b) => b.seriesId))]
    .map((seriesId) => latestInSeries(seriesId))
    .filter((budget): budget is Budget => budget !== null)
    .sort((a, b) => b.month.localeCompare(a.month));
  root.innerHTML = `<div class="app-shell"><aside class="sidebar">
    <a class="brand" href="#home" aria-label="Kestral Budget home"><span class="brand-mark">$</span><span>Kestral Budget</span></a>
    <button class="home-link ${state.view === 'home' ? 'active' : ''}" data-action="home"><span class="home-icon">⌂</span>Overview</button>
    <div class="side-section-title"><span>YOUR BUDGETS</span><button class="icon-button" data-action="new-budget" aria-label="Create a new budget" title="Create a new budget">+</button></div>
    <nav class="budget-nav" aria-label="Your budgets">${series.length ? series.map((b) => `<button class="budget-nav-item ${b.seriesId === budget?.seriesId && state.view === 'budget' ? 'active' : ''}" data-action="select-series" data-id="${esc(b.seriesId)}"><span class="nav-month-icon">${seriesBudgets(b.seriesId).length}</span><span class="nav-budget-copy"><strong>${esc(b.name)}</strong><small>${seriesBudgets(b.seriesId).length} ${seriesBudgets(b.seriesId).length === 1 ? 'month' : 'months'}</small></span></button>`).join('') : '<p class="nav-empty">Your budgets<br>will show up here.</p>'}</nav>
    <div class="sidebar-bottom"><span class="saved-dot"></span><span>Stored on this device</span><span id="save-status">All changes saved</span></div></aside>
    <main class="main-area"><header class="topbar"><div class="breadcrumb"><span>PERSONAL FINANCE</span><span class="crumb-divider">/</span><strong>${state.view === 'home' ? 'Overview' : esc(budget?.name)}</strong></div><button class="button button-primary top-new" data-action="new-budget"><span>+</span> New budget</button></header>${budget ? dashboard(budget, seriesBudgets(budget.seriesId)) : welcome()}</main></div>`;
}
function welcome(): string {
  return `<section class="welcome"><p class="overline">A CLEAR VIEW OF YOUR MONEY</p><h1>Give every dollar<br>somewhere to go.</h1><p class="welcome-copy">Set up a monthly budget, plan the essentials, and see what is left at a glance.</p><button class="button button-primary" data-action="new-budget"><span>+</span> Create your first budget</button></section>`;
}
function dashboard(b: Budget, budgets: Budget[]): string {
  const t = totals(b), income = t.income;
  const groups = groupsFor(b);
  const typeRows = groups.filter((g) => g.id !== 'income').map((g) => { const v = groupTotals(b, g.id); return `<tr><td><i class="type-dot ${g.color}"></i>${esc(g.name)}</td><td>${fmt(v.planned)}</td><td>${fmt(v.actual)}</td><td class="${v.actual > v.planned ? 'negative' : v.actual < v.planned ? 'positive' : ''}">${signed(v.actual - v.planned)}</td></tr>`; }).join('');
  const topEntries = b.categories.filter((category) => category.type !== 'income').flatMap((category) => category.entries.map((entry) => ({ name: entry.name, category: category.name, type: category.type, actual: entry.actual })));
  const topTransactions = b.transactions.flatMap((transaction) => {
    const category = b.categories.find((item) => item.id === transaction.categoryId);
    return category && category.type !== 'income' ? [{ name: transaction.description, category: category.name, type: category.type, actual: transaction.amount }] : [];
  });
  const top = [...topEntries, ...topTransactions].filter((entry) => entry.actual > 0).sort((a, z) => z.actual - a.actual).slice(0, 20);
  const transactionRows = [...b.transactions].sort((a, z) => z.date.localeCompare(a.date)).map((transaction) => {
    const category = b.categories.find((item) => item.id === transaction.categoryId);
    const isIncome = category?.type === 'income';
    return `<tr><td>${esc(displayDate(transaction.date))}</td><td>${esc(transaction.description)}</td><td>${esc(category?.name ?? 'Uncategorized')}</td><td class="${isIncome ? 'positive' : 'negative'}">${isIncome ? '+' : '−'}${fmt(transaction.amount)}</td><td class="transaction-actions"><button class="text-action" data-action="edit-transaction" data-transaction="${esc(transaction.id)}">Edit</button><button class="text-action transaction-delete" data-action="delete-transaction" data-transaction="${esc(transaction.id)}">Delete</button></td></tr>`;
  }).join('');
  return `<section class="dashboard"><div class="budget-tabs" role="tablist" aria-label="Choose a month">${budgets.map((item) => `<button class="month-tab ${item.id === b.id ? 'selected' : ''}" data-action="select-month" data-id="${esc(item.id)}" role="tab" aria-selected="${item.id === b.id}">${esc(monthText(item.month))}</button>`).join('')}<button class="month-add" data-action="new-month" aria-label="Create a new month" title="Create a new month">+</button></div>
    <div class="page-heading"><div><p class="overline">MONTHLY OVERVIEW <span class="heading-separator">/</span> ${esc(monthText(b.month).toUpperCase())}</p><h1>${esc(b.name)}</h1><p class="heading-subtitle">Your plan, actuals, and what remains this month.</p></div><div class="heading-actions"><button class="button button-secondary" data-action="add-category" ${dashboardTab === 'transactions' ? 'hidden' : ''}>＋ Category</button><button class="button button-secondary" data-action="new-month">New month</button><details class="budget-menu"><summary class="icon-button" aria-label="Budget actions" title="Budget actions">⋯</summary><div class="budget-menu-panel"><button type="button" data-action="delete-month">Delete this month</button><button class="is-danger" type="button" data-action="delete-budget">Delete entire budget</button></div></details></div></div>
    <div class="budget-tabs budget-view-tabs" role="tablist" aria-label="Budget view"><button class="month-tab ${dashboardTab === 'overview' ? 'selected' : ''}" data-action="budget-view" data-view="overview" role="tab" aria-selected="${dashboardTab === 'overview'}">Overview</button><button class="month-tab ${dashboardTab === 'transactions' ? 'selected' : ''}" data-action="budget-view" data-view="transactions" role="tab" aria-selected="${dashboardTab === 'transactions'}">Transactions</button></div>
    <section class="metric-grid" aria-label="Budget summary" ${dashboardTab === 'transactions' ? 'hidden' : ''}>
      <article class="metric-card income-card"><div class="metric-label"><span class="metric-icon">↗</span>INCOME + CARRYOVER</div><div class="metric-value">${fmt(income.actual + t.carryover)}<span>available</span></div><div class="metric-foot"><span>Income ${fmt(income.actual)}</span><span>Carryover ${signed(t.carryover)}</span></div></article>
      <article class="metric-card"><div class="metric-label"><span class="metric-icon">◷</span>PLANNED LEFT OVER</div><div class="metric-value ${t.plannedLeft < 0 ? 'negative' : ''}">${fmt(t.plannedLeft)}</div><div class="metric-foot"><span>${fmt(income.planned)} income</span><span>− ${fmt(t.out.planned)} planned</span></div></article>
      <article class="metric-card"><div class="metric-label"><span class="metric-icon">↘</span>ACTUAL LEFT OVER</div><div class="metric-value ${t.actualLeft < 0 ? 'negative' : 'highlight-value'}">${fmt(t.actualLeft)}</div><div class="metric-foot"><span>${fmt(income.actual)} income</span><span>− ${fmt(t.out.actual)} actual</span></div></article>
      <article class="metric-card"><div class="metric-label"><span class="metric-icon">≋</span>ALLOCATED</div><div class="metric-value">${fmt(t.out.planned)}<span>planned</span></div><div class="metric-foot"><span>Actual ${fmt(t.out.actual)}</span><span class="${t.out.actual > t.out.planned ? 'negative' : 'positive'}">${signed(t.out.actual - t.out.planned)}</span></div></article>
    </section>
    <div class="dashboard-grid" ${dashboardTab === 'transactions' ? 'hidden' : ''}><section class="panel"><div class="panel-heading"><div><p class="panel-kicker">AT A GLANCE</p><h2>Income & allocations</h2></div><button class="icon-button add-small" data-action="add-category" aria-label="Add category">+</button></div>
      <div class="summary-income"><span><i class="type-dot green"></i>Income</span><strong>${fmt(income.planned)}</strong><span>${fmt(income.actual)}</span><span class="${income.actual >= income.planned ? 'positive' : 'negative'}">${signed(income.actual - income.planned)}</span></div>${t.carryover ? `<div class="summary-income carryover-row"><span><i class="type-dot teal"></i>Opening carryover</span><strong>${fmt(t.carryover)}</strong><span>${fmt(t.carryover)}</span><span>From prior month</span></div>` : ''}<div class="table-scroll"><table><thead><tr><th>TYPE</th><th>PLANNED</th><th>ACTUAL</th><th>DIFF</th></tr></thead><tbody>${typeRows}</tbody></table></div><div class="table-legend"><span>Planned vs actual amounts</span><span>Diff = actual − planned</span></div></section>
      <section class="panel"><div class="panel-heading"><div><p class="panel-kicker">WHERE IT WENT</p><h2>Top spending</h2></div><span class="count-badge">${top.length} / 20</span></div>${top.length ? `<ol class="top-list">${top.map((entry, index) => `<li><span class="rank">${String(index + 1).padStart(2, '0')}</span><span class="top-copy"><strong>${esc(entry.name)}</strong><small>${esc(entry.category)} · ${group(entry.type).name}</small></span><span class="top-amount">${fmt(entry.actual)}</span></li>`).join('')}</ol>` : '<div class="quiet-empty">Actual spending will appear here as you record it.</div>'}</section></div>
    <section class="categories-section" ${dashboardTab === 'transactions' ? 'hidden' : ''}><div class="section-title-row"><div><p class="panel-kicker">YOUR PLAN</p><h2>Budget categories</h2></div><button class="button button-secondary" data-action="add-category">＋ Add category</button></div><div class="category-grid">${groups.map((g) => categoryCard(g, b)).join('')}</div></section>
    <section class="transactions-panel panel" ${dashboardTab === 'overview' ? 'hidden' : ''}><div class="panel-heading"><div><p class="panel-kicker">RECORDED ACTIVITY</p><h2>Transactions</h2></div><div class="panel-heading-actions"><span class="count-badge">${b.transactions.length}</span><button class="button button-primary" data-action="new-transaction"><span>+</span> Add transaction</button></div></div>${transactionRows ? `<div class="table-scroll"><table><thead><tr><th>DATE</th><th>DESCRIPTION</th><th>CATEGORY</th><th>AMOUNT</th><th></th></tr></thead><tbody>${transactionRows}</tbody></table></div>` : '<div class="quiet-empty">No transactions recorded this month.</div>'}</section></section>`;
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
  const symbols: Record<string, string> = { income: '↗', bills: '▤', expenses: '◉', subscriptions: '⟳', debts: '↘', savings: '⌑' };
  const symbol = symbols[g.id] || '◈';
  return `<section class="category-card"><header class="category-header"><span class="category-symbol ${g.color}">${symbol}</span><div class="category-heading"><h3>${g.name}</h3><span>${entries.length} ${entries.length === 1 ? 'item' : 'items'}</span></div><div class="category-total"><strong>${fmt(planned)}</strong><small>planned</small></div><button class="icon-button add-small" data-action="add-entry" data-type="${g.id}" data-category="${cats[0]?.id || ''}" aria-label="Add ${g.name} entry">+</button></header><div class="category-progress"><span class="${actual > planned && g.id !== 'income' ? 'over-budget' : ''}" style="width:${planned ? Math.min(100, actual / planned * 100) : (actual ? 100 : 0)}%"></span></div>
    ${cats.length ? cats.map((c) => `<div class="sub-category"><div class="sub-category-title"><span>${esc(c.name)}</span><button class="text-action" data-action="add-entry" data-category="${esc(c.id)}">Add item</button></div>${c.entries.length ? c.entries.map((e) => { const actualForEntry = entryActual(budget, e); return `<button class="entry-row" data-action="edit-entry" data-category="${esc(c.id)}" data-entry="${esc(e.id)}"><span class="entry-name">${esc(e.name)}</span><span class="entry-planned">${fmt(e.planned)}</span><span class="entry-actual ${actualForEntry > +e.planned && g.id !== 'income' ? 'negative' : ''}">${fmt(actualForEntry)}</span></button>`; }).join('') : '<p class="category-empty">Nothing added yet</p>'}</div>`).join('') : `<div class="first-category"><span>No ${g.name.toLowerCase()} categories yet</span><button class="text-action" data-action="add-category" data-type="${g.id}">Create one</button></div>`}
    <footer class="category-footer"><span>Actual ${fmt(actual)}</span><span class="${differenceClass}">${signed(actual - planned)} diff</span></footer></section>`;
}
function open(content: string): void { dialog.innerHTML = content; dialog.showModal(); }
function newBudgetDialog(): void {
  open(`<form class="dialog-form" data-form="budget"><div class="dialog-topline"><span class="dialog-icon">◷</span><button class="icon-button dialog-close" data-action="close" type="button" aria-label="Close">×</button></div><p class="panel-kicker">START A NEW BUDGET</p><h2>Name your budget</h2><label for="budget-name">Budget name</label><input id="budget-name" name="name" maxlength="80" placeholder="e.g. Household" required><fieldset class="group-picker"><legend>Choose what to include</legend><p>Income is included in every budget. Select the sections you want to set up.</p>${GROUPS.map((g) => `<label class="group-option"><input type="checkbox" name="groups" value="${g.id}" ${g.id === 'income' ? 'checked disabled' : 'checked'}><span class="type-dot ${g.color}"></span><span>${g.name}</span>${g.id === 'income' ? '<small>Required</small>' : ''}</label>`).join('')}</fieldset><div class="dialog-actions"><button class="button button-secondary" data-action="close" type="button">Cancel</button><button class="button button-primary" type="submit">Set up budget <span>→</span></button></div></form>`);
  requiredElement<HTMLInputElement>(dialog, '#budget-name').focus();
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
  if (!g) { state.active = b.id; state.view = 'budget'; clearWizard(); persist(); render(); dialog.close(); return; }
  const cats = b.categories.filter((c) => c.type === g.id);
  const count = b.categories.reduce((n, c) => n + c.entries.length, 0);
  dialog.innerHTML = `<div class="wizard"><div class="wizard-head"><span class="dialog-icon">${wizard.step + 1}</span><button class="icon-button dialog-close" data-action="close" type="button" aria-label="Close">×</button></div><p class="panel-kicker">BUDGET SETUP · ${wizard.step + 1} OF 6</p><div class="wizard-progress">${GROUPS.map((_, i) => `<span class="${i <= wizard.step ? 'done' : ''}"></span>`).join('')}</div><h2>Add ${g.name.toLowerCase()}</h2><p class="dialog-copy">${({ income: 'Start with money coming in. Add each source and its monthly planned amount.', bills: 'Add regular bills like rent, utilities, and insurance.', expenses: 'Add flexible spending such as groceries and transport.', subscriptions: 'Keep recurring memberships and services together.', debts: 'Plan payments toward loans, cards, and balances.', savings: 'Set aside money for goals, reserves, and future plans.' })[g.id]}</p><div class="wizard-existing">${cats.flatMap((c) => c.entries.map((e) => `<div class="wizard-row"><span>${esc(e.name)}</span><strong>${fmt(e.planned)}</strong></div>`)).join('') || '<span class="wizard-empty">Add items now, or skip this step and return later.</span>'}</div><form class="wizard-add-form" data-form="wizard-entry"><label for="wizard-name">${g.id === 'income' ? 'Income source' : 'Item name'}</label><div class="wizard-fields"><input id="wizard-name" name="name" placeholder="${g.id === 'income' ? 'e.g. Paycheck' : 'e.g. Monthly amount'}" maxlength="80" required><label class="sr-only" for="wizard-amount">Planned amount</label><span class="currency-prefix">$</span><input id="wizard-amount" name="planned" type="number" min="0" step="0.01" placeholder="0.00" required></div><button class="button button-secondary wizard-add-button" type="submit">＋ Add ${g.id === 'income' ? 'income' : 'item'}</button></form><div class="dialog-actions wizard-actions"><button class="button button-secondary" data-action="wizard-back" type="button" ${wizard.step === 0 ? 'disabled' : ''}>Back</button><span class="wizard-count">${count} ${count === 1 ? 'item' : 'items'} added</span><button class="button button-primary" data-action="wizard-next" type="button">${wizard.step === 5 ? 'Finish setup' : 'Continue'} <span>→</span></button></div></div>`;
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
    budget.carryover = index === 0 ? 0 : totals(months[index - 1]).actualLeft;
  });
}
function deleteCurrentMonth(): void {
  const budget = current();
  if (!budget || !window.confirm(`Delete ${monthText(budget.month)} from "${budget.name}"? This month's categories and transactions will be removed.`)) return;
  const { seriesId, month } = budget;
  state.budgets = state.budgets.filter((item) => item.id !== budget.id);
  recalculateCarryovers(seriesId);
  const remaining = seriesBudgets(seriesId);
  const previous = remaining.filter((item) => item.month < month).at(-1);
  const fallback = previous || remaining[0] || [...state.budgets].sort((a, b) => b.month.localeCompare(a.month))[0];
  state.active = fallback?.id ?? null;
  state.view = fallback ? 'budget' : 'home';
  persist();
  render();
}
function deleteCurrentBudget(): void {
  const budget = current();
  if (!budget) return;
  const count = seriesBudgets(budget.seriesId).length;
  if (!window.confirm(`Delete "${budget.name}" and all ${count} ${count === 1 ? 'month' : 'months'} in it? This also removes its transactions.`)) return;
  state.budgets = state.budgets.filter((item) => item.seriesId !== budget.seriesId);
  const fallback = [...state.budgets].sort((a, b) => b.month.localeCompare(a.month))[0];
  state.active = fallback?.id ?? null;
  state.view = fallback ? 'budget' : 'home';
  persist();
  render();
}
function newMonthDialog(): void {
  const source = latestInSeries(current()?.seriesId);
  if (!source) return;
  const carryover = totals(source).actualLeft;
  const month = monthAfter(source.month);
  open(`<form class="dialog-form" data-form="month" data-source="${esc(source.id)}"><div class="dialog-topline"><span class="dialog-icon">◷</span><button class="icon-button dialog-close" data-action="close" type="button" aria-label="Close">×</button></div><p class="panel-kicker">CONTINUE ${esc(source.name.toUpperCase())}</p><h2>Create a new month</h2><p class="dialog-copy">Your planned categories and amounts will copy from ${esc(monthText(source.month))}. Actuals start at zero, and the actual leftover carries forward.</p><label for="new-month">Month</label><input id="new-month" name="month" type="month" value="${month}" required><p class="carryover-preview">Opening carryover <strong>${fmt(carryover)}</strong></p><p class="form-error" id="month-error" aria-live="polite"></p><div class="dialog-actions"><button class="button button-secondary" data-action="close" type="button">Cancel</button><button class="button button-primary" type="submit">Create month <span>→</span></button></div></form>`);
}
function transactionItemOptions(categoryId: string, selectedEntryId: string | null = null): string {
  const category = current()?.categories.find((item) => item.id === categoryId);
  return `<option value="" ${selectedEntryId ? '' : 'selected'}>Category only</option>${category?.entries.map((entry) => `<option value="${esc(entry.id)}" ${entry.id === selectedEntryId ? 'selected' : ''}>${esc(entry.name)}</option>`).join('') ?? ''}`;
}
function transactionDialog(transaction: BudgetTransaction | null = null): void {
  const budget = current();
  if (!budget || budget.categories.length === 0) return;
  const selectedCategoryId = transaction?.categoryId ?? budget.categories[0].id;
  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  open(`<form class="dialog-form" data-form="transaction" data-transaction="${esc(transaction?.id ?? '')}"><div class="dialog-topline"><span class="dialog-icon">${transaction ? '↗' : '＋'}</span><button class="icon-button dialog-close" data-action="close" type="button" aria-label="Close">×</button></div><p class="panel-kicker">${transaction ? 'UPDATE RECORDED ACTIVITY' : 'RECORD ACTUAL ACTIVITY'}</p><h2>${transaction ? 'Edit transaction' : 'Add transaction'}</h2><label for="transaction-date">Date</label><input id="transaction-date" name="date" type="date" value="${esc(transaction?.date ?? todayString)}" required><label for="transaction-description">Description</label><input id="transaction-description" name="description" maxlength="100" value="${esc(transaction?.description ?? '')}" placeholder="e.g. Grocery store" required><label for="transaction-amount">Amount</label><div class="input-money"><span>$</span><input id="transaction-amount" name="amount" type="number" min="0.01" step="0.01" value="${transaction ? esc(transaction.amount) : ''}" placeholder="0.00" required></div><label for="transaction-category">Budget category</label><select id="transaction-category" name="categoryId" required>${budget.categories.map((category) => `<option value="${esc(category.id)}" ${category.id === selectedCategoryId ? 'selected' : ''}>${esc(category.name)} · ${esc(group(category.type).name)}</option>`).join('')}</select><label for="transaction-entry">Budget item <span>(optional)</span></label><select id="transaction-entry" name="entryId">${transactionItemOptions(selectedCategoryId, transaction?.entryId ?? null)}</select><div class="dialog-actions">${transaction ? '<button class="button button-danger" data-action="delete-transaction" data-transaction="' + esc(transaction.id) + '" type="button">Delete</button>' : '<span></span>'}<button class="button button-secondary" data-action="close" type="button">Cancel</button><button class="button button-primary" type="submit">${transaction ? 'Save changes' : 'Add transaction'}</button></div></form>`);
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
  requiredElement<HTMLInputElement>(dialog, '#entry-name').focus();
}

document.addEventListener('click', (event: MouseEvent) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLButtonElement>('[data-action]'); if (!button) return;
  const { action, id, category, type, entry, transaction } = button.dataset;
  if (action === 'budget-view' && (button.dataset.view === 'overview' || button.dataset.view === 'transactions')) { dashboardTab = button.dataset.view; render(); }
  if (action === 'new-budget') newBudgetDialog();
  if (action === 'new-month') newMonthDialog();
  if (action === 'delete-month') deleteCurrentMonth();
  if (action === 'delete-budget') deleteCurrentBudget();
  if (action === 'new-transaction') transactionDialog();
  if (action === 'edit-transaction' && transaction) {
    const found = current()?.transactions.find((item) => item.id === transaction);
    if (found) transactionDialog(found);
  }
  if (action === 'home') { state.view = 'home'; render(); }
  if (action === 'select-series' && id) { state.active = latestInSeries(id)?.id ?? null; state.view = 'budget'; persist(); render(); }
  if ((action === 'select-month' || action === 'select') && id) { state.active = id; state.view = 'budget'; persist(); render(); }
  if (action === 'budget-view' && (button.dataset.view === 'overview' || button.dataset.view === 'transactions')) { dashboardTab = button.dataset.view; render(); }
  if (action === 'add-category') categoryDialog(type || 'expenses');
  if (action === 'add-entry') entryDialog(category || '', type || 'expenses');
  if (action === 'edit-entry' && category) { const found = current()?.categories.find((c) => c.id === category)?.entries.find((e) => e.id === entry); if (found) entryDialog(category, 'expenses', found); }
  if (action === 'close') dialog.close();
  if (action === 'wizard-back' && wizard && wizard.step > 0) { wizard.step--; wizardView(); }
  if (action === 'wizard-next' && wizard) { wizard.step++; persist(); wizardView(); }
  if (action === 'delete-entry' && entry && window.confirm('Delete this budget entry? Its linked transactions will also be removed.')) {
    const budget = current();
    if (budget) {
      budget.categories.forEach((category) => { category.entries = category.entries.filter((item) => item.id !== entry); });
      budget.transactions = budget.transactions.filter((transaction) => transaction.entryId !== entry);
    }
    persist(); dialog.close(); render();
  }
  if (action === 'delete-transaction' && transaction && window.confirm('Delete this transaction?')) {
    const budget = current();
    if (budget) budget.transactions = budget.transactions.filter((item) => item.id !== transaction);
    persist(); dialog.close(); render();
  }
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
    const b = { id: uid(), seriesId: uid(), name: String(data.get('name')).trim(), month, carryover: 0, selectedTypes, categories: defaultCategories(selectedTypes), transactions: [] };
    state.budgets.push(b); state.active = b.id; state.view = 'budget'; dashboardTab = 'overview'; wizard = { budgetId: b.id, groups: selectedTypes, step: 0 }; persist(); wizardView();
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
    const b = {
      id: uid(), seriesId: template.seriesId, name: template.name, month,
      carryover: totals(template).actualLeft,
      selectedTypes: [...(template.selectedTypes || GROUPS.map((g) => g.id))],
      transactions: [],
      categories: template.categories.map((category) => ({
        ...category,
        id: uid(),
        entries: category.entries.map((entry) => ({ ...entry, id: uid(), actual: 0 })),
      })),
    };
    state.budgets.push(b); state.active = b.id; state.view = 'budget'; persist(); dialog.close(); render();
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
    c.entries.push({ id: uid(), name: String(data.get('name') ?? '').trim(), planned: Number(data.get('planned')) || 0, actual: 0 }); persist(); wizardView();
  } else if (form.dataset.form === 'category') {
    const b = current(); if (!b) return;
    const customName = String(data.get('customType') || '').trim();
    const type = (data.get('type') === 'custom' ? `custom:${customName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : String(data.get('type'))) as BudgetGroupId;
    b.categories.push({ id: uid(), type, ...(customName ? { typeName: customName } : {}), name: String(data.get('name')).trim(), entries: [] }); persist(); dialog.close(); render();
  } else if (form.dataset.form === 'entry' || form.dataset.form === 'edit-entry') {
    const b = current(); if (!b) return;
    const c = b.categories.find((item) => item.id === String(data.get('categoryId'))); if (!c) return;
    const values = { name: String(data.get('name') ?? '').trim(), planned: Number(data.get('planned')) || 0, actual: Number(data.get('actual')) || 0 };
    if (form.dataset.form === 'edit-entry') {
      let old: BudgetEntry | undefined;
      b.categories.forEach((item) => { const index = item.entries.findIndex((e) => e.id === form.dataset.entry); if (index !== -1) old = item.entries.splice(index, 1)[0]; });
      if (!old) return;
      const existingEntry = old;
      c.entries.push({ ...existingEntry, ...values });
      b.transactions.forEach((transaction) => { if (transaction.entryId === existingEntry.id) transaction.categoryId = c.id; });
    } else c.entries.push({ id: uid(), ...values });
    persist(); dialog.close(); render();
  }
});
render();
