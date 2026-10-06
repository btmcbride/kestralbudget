import test from 'node:test';
import assert from 'node:assert/strict';

import { buildExpenseEntriesForMonth, buildIncomeEntriesForMonth, isWithinMonth } from '../src/paycheck-scheduler.js';

test('buildIncomeEntriesForMonth includes every scheduled payday in the month for biweekly pay', () => {
  const entries = buildIncomeEntriesForMonth({
    id: 's1',
    name: 'Biweekly paycheck',
    amount: 2500,
    frequency: 'biweekly',
    nextPayday: '2026-01-02',
  }, '2026-01');

  assert.deepEqual(entries.map((entry) => entry.date), ['2026-01-02', '2026-01-16', '2026-01-30']);
  assert.deepEqual(entries.map((entry) => entry.amount), [2500, 2500, 2500]);
});

test('buildIncomeEntriesForMonth respects a weekly pay schedule', () => {
  const entries = buildIncomeEntriesForMonth({
    id: 's2',
    name: 'Weekly paycheck',
    amount: 1200,
    frequency: 'weekly',
    nextPayday: '2026-01-02',
  }, '2026-01');

  assert.deepEqual(entries.map((entry) => entry.date), ['2026-01-02', '2026-01-09', '2026-01-16', '2026-01-23', '2026-01-30']);
});

test('buildIncomeEntriesForMonth respects a monthly pay schedule', () => {
  const entries = buildIncomeEntriesForMonth({
    id: 's3',
    name: 'Monthly paycheck',
    amount: 3500,
    frequency: 'monthly',
    nextPayday: '2026-01-15',
  }, '2026-01');

  assert.deepEqual(entries.map((entry) => entry.date), ['2026-01-15']);
});

test('buildExpenseEntriesForMonth creates monthly planned entries and clamps short months', () => {
  const entries = buildExpenseEntriesForMonth({
    id: 'rent',
    name: 'Rent',
    amount: 1800,
    frequency: 'monthly',
    nextDueDate: '2026-01-31',
  }, '2026-02');

  assert.deepEqual(entries, [{ id: 'rent-2026-02-28', date: '2026-02-28', amount: 1800, name: 'Rent' }]);
});

test('buildExpenseEntriesForMonth includes each weekly occurrence in a month', () => {
  const entries = buildExpenseEntriesForMonth({
    id: 'cleaning',
    name: 'Cleaning',
    amount: 90,
    frequency: 'weekly',
    nextDueDate: '2026-01-02',
  }, '2026-01');

  assert.deepEqual(entries.map((entry) => entry.date), ['2026-01-02', '2026-01-09', '2026-01-16', '2026-01-23', '2026-01-30']);
});

test('buildExpenseEntriesForMonth creates yearly renewals on the anniversary date', () => {
  const entries = buildExpenseEntriesForMonth({
    id: 'streaming',
    name: 'Streaming annual plan',
    amount: 120,
    frequency: 'yearly',
    nextDueDate: '2026-05-31',
  }, '2027-05');

  assert.deepEqual(entries, [{ id: 'streaming-2027-05-31', date: '2027-05-31', amount: 120, name: 'Streaming annual plan' }]);
});

test('yearly expense schedules clamp renewal dates in shorter months', () => {
  const entries = buildExpenseEntriesForMonth({
    id: 'annual',
    name: 'Annual service',
    amount: 50,
    frequency: 'yearly',
    nextDueDate: '2024-02-29',
  }, '2025-02');

  assert.deepEqual(entries, [{ id: 'annual-2025-02-28', date: '2025-02-28', amount: 50, name: 'Annual service' }]);
});

test('buildExpenseEntriesForMonth does not generate before its first due date', () => {
  const entries = buildExpenseEntriesForMonth({
    id: 'rent',
    name: 'Rent',
    amount: 1800,
    frequency: 'monthly',
    nextDueDate: '2026-11-15',
  }, '2026-10');

  assert.deepEqual(entries, []);
});

test('buildExpenseEntriesForMonth skips paused schedules', () => {
  const entries = buildExpenseEntriesForMonth({
    id: 'rent',
    name: 'Rent',
    amount: 1800,
    frequency: 'monthly',
    nextDueDate: '2026-10-15',
    paused: true,
  }, '2026-10');

  assert.deepEqual(entries, []);
});

test('isWithinMonth returns true only for dates in the target month', () => {
  assert.equal(isWithinMonth('2026-01-31', '2026-01'), true);
  assert.equal(isWithinMonth('2026-02-01', '2026-01'), false);
});
