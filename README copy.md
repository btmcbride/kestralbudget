# VaultBudget

VaultBudget is a local-first monthly budgeting app. Create named budgets, plan income and spending, record transactions, and carry actual leftover money into later months.

## How the app is organized

- **Budget:** A named budget is a series of monthly budgets. Separate budgets keep their categories, months, transactions, and carryovers independent.
- **Month:** Each month has planned amounts, actuals, and transactions. Month tabs show the months belonging to the selected budget.
- **Category:** A category belongs to a standard spending type or a custom type. Examples include Rent under Bills or Pet care as a custom type.
- **Budget item:** An item is a planned line within a category, such as a paycheck, rent, or groceries. It has planned and manually entered actual amounts.
- **Transaction:** A dated record of actual income or spending. It belongs to a category and can optionally be linked to one of that category's budget items.

## Main workflows

### Create a budget

Choose **New budget**, enter a name, and select the standard sections to include. Income is always included; Bills, Expenses, Subscriptions, Debts, and Savings are optional. The setup wizard visits each selected section in order and lets you add budget items with planned amounts. You can skip a section's items and add them later.

Custom categories and custom spending types can be added from the Overview after setup.

### Use Overview and Transactions

The selected month has two views:

- **Overview** shows income, allocated amounts, planned and actual leftover, planned-versus-actual differences, the top 20 actual spending items, and budget categories.
- **Transactions** shows that month's dated transaction ledger. Use **Add transaction** to enter a date, description, amount, and category. You can optionally assign it to a budget item in that category. Transactions can be edited or deleted.

The category determines how a transaction is counted: transactions under Income add to actual income; transactions under other categories add to actual spending. A transaction linked to a budget item also appears in that item's actual amount. Category-only transactions still affect category totals and leftover, but are not assigned to a specific item.

### Create a new month

Choose **New month** from the selected budget. The new month copies the latest month's categories and planned budget items, resets copied item actuals, starts with an empty transaction ledger, and carries forward the prior month's actual leftover. Transactions remain with the month in which they were recorded.

If a month is deleted, carryovers for remaining months in that budget are recalculated in month order. **Delete entire budget** removes all months and transactions in that named budget.

## Calculations

For each spending type, the difference is actual minus planned. A negative income difference is shown as unfavorable; for spending types, spending above plan is unfavorable.

```text
Planned leftover = planned income + opening carryover - planned spending
Actual leftover  = actual income + opening carryover - actual spending
```

Actual income and spending include both manually entered item actuals and transactions. Transactions are counted once in their category totals. The Top Spending list ranks positive actual spending from budget items and transactions; income transactions are excluded.

Amounts are displayed in US dollars (USD). The app does not connect to financial institutions or import transactions automatically.

## Getting started

### Requirements

- Node.js 18 or later
- npm

### Install and run

From the project directory:

```powershell
npm install
npm run dev
```

Vite prints the local URL when the server starts. The development server binds to `127.0.0.1` by default.

### Build and type-check

```powershell
npm run typecheck
npm run build
```

The static production site is generated in `dist/`. Serve that directory with a static web server to host the built app.

## Data and privacy

Budgets are stored in the browser's `localStorage`, scoped to the browser profile and site origin. No account, server-side storage, or automatic cloud sync is currently provided. Clearing the browser's site data can permanently remove budgets, so keep an independent backup of important information.

The app restores the previously selected budget when available. A separate user-configurable default-budget preference, data export/import, and automatic recurring-paycheck scheduling are not currently implemented.

## Project structure

```text
index.html                 App entry point
src/budget.ts              Budget model, calculations, and interactions
src/budget.css             Main interface and responsive styles
src/budget-workflow.css    Dialog, setup, and action-menu styles
tsconfig.json              Strict TypeScript configuration
package.json               Scripts and development dependencies
dist/                      Generated production build
```
