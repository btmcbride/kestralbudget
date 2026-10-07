// Sample data for the browser-only live demo. Dates are relative to today.
const pad = (n: number): string => String(n).padStart(2, '0');
const monthKey = (offset: number): string => {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const day = (month: string, n: number): string => `${month}-${pad(n)}`;
const id = (): string => crypto.randomUUID();

type Item = [name: string, planned: number, actual: number, dueDay?: number];
type Plan = Record<string, Array<[category: string, items: Item[]]>>;

const PLAN: Plan = {
  income: [['Paychecks', [['Paycheck - Acme Co', 4200, 4200], ['Side projects', 400, 350]]]],
  bills: [['Home', [['Rent', 1450, 1450, 1], ['Electric', 95, 88, 12], ['Internet', 65, 65, 15]]]],
  expenses: [['Everyday', [['Groceries', 520, 0], ['Dining out', 160, 0], ['Fuel', 120, 0], ['Fun money', 100, 0]]]],
  subscriptions: [['Streaming & apps', [['Streaming', 16, 16, 8], ['Music', 11, 11, 20], ['Cloud storage', 3, 3, 25]]]],
  debts: [['Loans', [['Car loan', 310, 310, 5]]]],
  savings: [['Goals', [['Emergency fund', 300, 300], ['Vacation', 150, 150]]]],
};

function buildBudget(offset: number, seriesId: string) {
  const month = monthKey(offset);
  const current = offset === 0;
  const categories = Object.entries(PLAN).flatMap(([type, cats]) => cats.map(([name, items]) => ({
    id: id(), type, name,
    entries: items.map(([entryName, planned, actual, due]) => ({
      id: id(), name: entryName, planned,
      actual: current ? (type === 'expenses' || entryName === 'Electric' || type === 'income' ? 0 : actual > 0 && (due ?? 0) <= new Date().getDate() ? actual : 0) : (type === 'expenses' ? Math.round(planned * (0.85 + ((offset + 5) % 3) * 0.1)) : actual),
      ...(due ? { dueDate: day(month, due) } : {}),
    })),
  })));
  const entryId = (name: string) => categories.flatMap((c) => c.entries.map((e) => ({ e, c }))).find(({ e }) => e.name === name)!;
  const transactions = current ? ([
    ['Paycheck - Acme Co', 4200, 1], ['Side projects', 350, 6], ['Groceries', 86.4, 2], ['Groceries', 112.15, 8], ['Fuel', 48.7, 3],
    ['Dining out', 42.5, 5], ['Dining out', 31.2, 9], ['Fun money', 24, 7], ['Electric', 131, 9],
  ] as Array<[string, number, number]>).filter(([, , d]) => d <= Math.max(new Date().getDate(), 9)).map(([name, amount, d]) => {
    const { e, c } = entryId(name);
    return { id: id(), date: day(month, d), description: name, amount, categoryId: c.id, entryId: e.id };
  }) : [];
  return {
    id: id(), seriesId, name: 'Household budget', month, carryover: current ? 0 : 0,
    selectedTypes: ['income', 'bills', 'expenses', 'subscriptions', 'debts', 'savings'],
    categories, transactions, incomeSchedules: [], expenseSchedules: [],
  };
}

export function demoSeed() {
  const seriesId = id();
  const budgets = [-2, -1, 0].map((offset) => buildBudget(offset, seriesId));
  return {
    budgets,
    active: budgets[2].id,
    preferences: { defaultBudgetId: null, userName: 'Demo', transactionSortField: 'date', transactionSortDirection: 'desc' },
  };
}
