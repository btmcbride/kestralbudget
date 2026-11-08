import test from 'node:test';
import assert from 'node:assert/strict';

import { allSavingsGoalsMet, savingsGoalProgress } from '../src/savings-goals.js';

test('savings goal progress sums only deposits assigned to that goal', () => {
  const goal = { id: 'emergency', target: 500 };
  const transactions = [
    { savingsGoalId: 'emergency', amount: 125 },
    { savingsGoalId: 'emergency', amount: 175 },
    { savingsGoalId: 'vacation', amount: 200 },
    { amount: 50 },
  ];

  assert.deepEqual(savingsGoalProgress(goal, transactions), { saved: 300, remaining: 200, met: false });
});

test('savings goal is met when assigned deposits reach or exceed its target', () => {
  const goal = { id: 'emergency', target: 300 };

  assert.deepEqual(savingsGoalProgress(goal, [
    { savingsGoalId: 'emergency', amount: 350 },
  ]), { saved: 350, remaining: 0, met: true });
});

test('all savings goals must exist and be met', () => {
  const transactions = [{ savingsGoalId: 'emergency', amount: 500 }];
  const emergency = { id: 'emergency', name: 'Emergency', target: 500 };
  const vacation = { id: 'vacation', name: 'Vacation', target: 200 };

  assert.equal(allSavingsGoalsMet([], transactions), false);
  assert.equal(allSavingsGoalsMet([emergency], transactions), true);
  assert.equal(allSavingsGoalsMet([emergency, vacation], transactions), false);
});
