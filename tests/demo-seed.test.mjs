import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformWithEsbuild } from 'vite';

test('demo budgets use the same default category names as a new budget', async () => {
  const source = await readFile(new URL('../src/demo-seed.ts', import.meta.url), 'utf8');
  const { code } = await transformWithEsbuild(source, 'demo-seed.ts');
  const { demoSeed } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  const state = demoSeed();
  const expected = [
    ['income', 'Income'],
    ['bills', 'Bills'],
    ['expenses', 'Expenses'],
    ['subscriptions', 'Subscriptions'],
    ['debts', 'Debts'],
    ['savings', 'Savings'],
  ];
  assert.ok(state.budgets.some((budget) => budget.id === state.active));
  for (const budget of state.budgets) {
    assert.deepEqual(budget.categories.map(({ type, name }) => [type, name]), expected);
    assert.ok(budget.transactions.every((transaction) => budget.categories.some((category) =>
      category.id === transaction.categoryId && category.entries.some((entry) => entry.id === transaction.entryId))));
  }
});
