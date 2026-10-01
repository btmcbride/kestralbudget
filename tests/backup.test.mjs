import test from 'node:test';
import assert from 'node:assert/strict';

import { createBackup, parseBackup } from '../src/backup.js';

const state = {
  budgets: [{
    id: 'month-1',
    seriesId: 'series-1',
    name: 'Household',
    month: '2026-10',
    categories: [{ id: 'bills', type: 'bills', name: 'Bills', entries: [] }],
    expenseSchedules: [{ id: 'rent', categoryId: 'bills', name: 'Rent', amount: 1800, frequency: 'monthly', intervalDays: 30, nextDueDate: '2026-10-01', paused: true }],
  }],
  active: 'month-1',
  preferences: { defaultBudgetId: 'series-1' },
};

test('backup round-trips budgets, active selection, and preferences', () => {
  const contents = createBackup(state, '2026-10-01T12:00:00.000Z');
  assert.deepEqual(parseBackup(contents), state);
  assert.match(contents, /"version": 1/);
});

test('backup import rejects unsupported formats and invalid budget data', () => {
  assert.throws(() => parseBackup('{"format":"other","version":1,"budgets":[],"active":null}'));
  assert.throws(() => parseBackup('{"format":"kestralbudget-backup","version":1,"budgets":[{"id":"x","name":"x","month":"2026-10","categories":[{"id":"c","type":"bills","name":"Bills","entries":[{}]}]}],"active":null}'));
  assert.throws(() => createBackup({ budgets: [{}], active: null }));
});