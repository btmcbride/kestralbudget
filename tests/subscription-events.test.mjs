import test from 'node:test';
import assert from 'node:assert/strict';

import { hasMatchingUnscheduledOccurrence } from '../src/subscription-events.js';

const occurrence = { date: '2026-10-09', amount: 9.99, name: 'Fero+' };

test('matches an existing unscheduled calendar entry for a generated occurrence', () => {
  const events = [{
    categoryId: 'subscriptions',
    date: '2026-10-09',
    amount: 9.99,
    name: '  fero+ ',
  }];

  assert.equal(hasMatchingUnscheduledOccurrence(events, 'subscriptions', occurrence), true);
});

test('does not match a different category, date, amount, name, or scheduled entry', () => {
  const mismatches = [
    { categoryId: 'bills', date: occurrence.date, amount: occurrence.amount, name: occurrence.name },
    { categoryId: 'subscriptions', date: '2026-10-10', amount: occurrence.amount, name: occurrence.name },
    { categoryId: 'subscriptions', date: occurrence.date, amount: 10, name: occurrence.name },
    { categoryId: 'subscriptions', date: occurrence.date, amount: occurrence.amount, name: 'Another service' },
    { categoryId: 'subscriptions', date: occurrence.date, amount: occurrence.amount, name: occurrence.name, scheduleId: 'other-schedule' },
  ];

  for (const event of mismatches) {
    assert.equal(hasMatchingUnscheduledOccurrence([event], 'subscriptions', occurrence), false);
  }
});
