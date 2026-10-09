import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { startServer } from '../server.mjs';

test('state API preserves UI preferences across reloads', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'kestralbudget-state-'));
  let app;
  t.after(async () => {
    try {
      if (app) await app.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  app = await startServer({
    host: '127.0.0.1',
    port: 0,
    databasePath: join(directory, 'state.sqlite'),
    storage: 'wasm',
  });

  const preferences = {
    defaultBudgetId: null,
    userName: null,
    transactionSortField: 'amount',
    transactionSortDirection: 'asc',
    theme: 'dark',
    carryoverMethod: 'planned',
    weekStartsOn: 'monday',
    accentColor: 'purple',
    density: 'compact',
    textSize: 'larger',
    currency: 'EUR',
    dateFormat: 'iso',
  };
  const saveResponse = await fetch(`${app.origin}/api/state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ budgets: [], active: null, preferences }),
  });
  assert.equal(saveResponse.status, 200);

  const loadResponse = await fetch(`${app.origin}/api/state`);
  assert.equal(loadResponse.status, 200);
  const savedState = await loadResponse.json();
  assert.deepEqual(savedState.preferences, preferences);
});
