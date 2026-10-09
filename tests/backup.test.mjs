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
  preferences: { defaultBudgetId: 'series-1', userName: 'Brandon', transactionSortField: 'amount', transactionSortDirection: 'asc' },
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

test('backup round-trips yearly subscription schedules', () => {
  const subscriptionState = structuredClone(state);
  subscriptionState.budgets[0].categories[0].type = 'subscriptions';
  subscriptionState.budgets[0].expenseSchedules[0].frequency = 'yearly';
  subscriptionState.budgets[0].expenseSchedules[0].nextDueDate = '2027-10-01';

  assert.deepEqual(parseBackup(createBackup(subscriptionState)), subscriptionState);
});

test('backup round-trips optional subscription reminder dates', () => {
  const subscriptionState = structuredClone(state);
  subscriptionState.budgets[0].categories[0].type = 'subscriptions';
  subscriptionState.budgets[0].categories[0].entries.push({
    id: 'streaming',
    name: 'Streaming',
    planned: 15.99,
    actual: 0,
    dueDate: '2026-10-18',
  });

  assert.deepEqual(parseBackup(createBackup(subscriptionState)), subscriptionState);
});

test('backup round-trips savings goals and their allocated deposits', () => {
  const savingsState = structuredClone(state);
  savingsState.budgets[0].categories[0] = {
    id: 'savings',
    type: 'savings',
    name: 'Savings',
    entries: [{
      id: 'emergency-fund',
      name: 'Emergency fund',
      planned: 200,
      actual: 0,
      goals: [{ id: 'goal-1', name: 'Rainy day fund', target: 1000 }],
    }],
  };
  savingsState.budgets[0].expenseSchedules = [];
  savingsState.budgets[0].transactions = [{
    id: 'deposit-1',
    date: '2026-10-08',
    description: 'Payday deposit',
    amount: 100,
    categoryId: 'savings',
    entryId: 'emergency-fund',
    savingsGoalId: 'goal-1',
  }];

  assert.deepEqual(parseBackup(createBackup(savingsState)), savingsState);
});

test('backup round-trips display, regional, calendar, and carryover preferences', () => {
  const settingsState = structuredClone(state);
  settingsState.budgets[0].carryoverMethod = 'planned';
  settingsState.preferences = {
    ...settingsState.preferences,
    carryoverMethod: 'planned',
    weekStartsOn: 'monday',
    accentColor: 'purple',
    density: 'compact',
    textSize: 'larger',
    currency: 'EUR',
    dateFormat: 'iso',
  };

  assert.deepEqual(parseBackup(createBackup(settingsState)), settingsState);
});

test('backup rejects invalid settings preferences', () => {
  const invalidState = structuredClone(state);
  invalidState.preferences = { ...invalidState.preferences, currency: 'FRA' };
  assert.throws(() => createBackup(invalidState));

  const invalidTextSize = structuredClone(state);
  invalidTextSize.preferences = { ...invalidTextSize.preferences, textSize: 'huge' };
  assert.throws(() => createBackup(invalidTextSize));

  const invalidBudget = structuredClone(state);
  invalidBudget.budgets[0].carryoverMethod = 'future';
  assert.throws(() => createBackup(invalidBudget));
});