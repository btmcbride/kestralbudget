import test from 'node:test';
import assert from 'node:assert/strict';

import { getDefaultBudgetId, setDefaultBudgetId } from '../src/preferences.js';

test('setDefaultBudgetId persists the selected default budget', () => {
  const preferences = { defaultBudgetId: null };
  const next = setDefaultBudgetId(preferences, 'budget-123');
  assert.equal(getDefaultBudgetId(next), 'budget-123');
});

test('getDefaultBudgetId returns null when no default is set', () => {
  assert.equal(getDefaultBudgetId({ defaultBudgetId: null }), null);
});
