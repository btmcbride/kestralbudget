# Kestral Budget

![GitHub release](https://img.shields.io/github/v/release/btmcbride/kestralbudget?display_name=tag)
![Desktop builds](https://img.shields.io/github/actions/workflow/status/btmcbride/kestralbudget/desktop-builds.yml?branch=main&label=desktop%20builds)

Kestral Budget is a local-first monthly budgeting app. Create named budgets, plan income and spending, record transactions, and carry actual leftover money into later months.

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

- Node.js 22 or later
- npm

### Install and run

From the project directory, start the API in one terminal:

```powershell
npm install
npm run api
```

Start the Vite frontend in a second terminal:

```powershell
npm run dev
```

Vite prints the local URL when it starts. Its `/api` requests are forwarded to the local API server.

### Build and type-check

```powershell
npm run typecheck
npm run build
```

The production container builds the frontend and runs it with the API server.

### Release checklist

Use this checklist before publishing a new desktop release:

1. Update the app version in `package.json` to the next release version.
2. Verify the app builds locally on your target platform.
3. Build the Windows installer on Windows x64:

```powershell
npm ci
npm run desktop:dist
```

4. Build the macOS disk image on macOS:

```bash
npm ci
npm run desktop:dist:mac
```

5. Commit the release changes and push them to `main`.
6. Create and push a version tag:

```powershell
git tag v1.0.1
git push origin v1.0.1
```

7. Watch the `Desktop Builds` workflow. The Windows and macOS jobs should complete successfully, then the tag-gated release job uploads the `.exe` and `.dmg` to the GitHub Release.
8. Verify the release page contains both installer artifacts before sharing the link.

### Build the Windows desktop installer

On Windows x64, install dependencies and build the NSIS installer:

```powershell
npm install
npm run desktop:dist
```

The Windows installer is written to `release/windows/`. On macOS, run `npm run desktop:dist:mac` to build an Apple Silicon DMG in `release/mac/`. Installed users do not need Node.js or Podman. The desktop app stores its SQLite database in Electron's per-user `userData` directory and runs its API on loopback only. It uses the WebAssembly SQLite adapter, so no native compiler or Electron-specific SQLite rebuild is needed.

The `Desktop Builds` GitHub Actions workflow builds both installers on every push and uploads separate Windows and Mac artifacts. Pushing a `v*` tag also publishes a GitHub Release with the `.exe` and `.dmg`. The Mac build is unsigned; sign and notarize it with Apple Developer credentials before distributing it broadly.

The desktop and container editions currently use separate databases. Importing/exporting data between them is not implemented yet. Windows installers are unsigned unless a code-signing certificate is configured, so Windows may show a publisher warning.

### Run with Podman

Create a named volume once, then build and run the container:

```powershell
podman volume create kestralbudget-data
podman build -f DockerFile -t localhost/vaultbudget:latest .
podman run -d --name vaultbudget -p 8888:8080 -v kestralbudget-data:/data:U localhost/vaultbudget:latest
```

Keep using the same `kestralbudget-data` volume when replacing the container. Remove an existing container with `podman rm -f vaultbudget` before running the replacement. Removing the container does not remove the volume; removing the volume permanently deletes the saved budgets.

## Data and privacy

The container edition stores budgets in `/data/kestralbudget.sqlite`; mount a persistent Podman volume there to retain data across container replacement. The desktop edition stores its SQLite database under Electron's per-user `userData` directory using the WebAssembly SQLite adapter. Each edition has its own database. The container app imports existing `localStorage` budgets once when its server database is first initialized; after that, the server database is authoritative. Neither edition has accounts, cloud sync, or automatic backups. Do not expose the container API to an untrusted network, and keep independent backups of important data.

The app restores the previously selected budget when available. A separate user-configurable default-budget preference, data export/import, and automatic recurring-paycheck scheduling are not currently implemented.

## Project structure

```text
index.html                 App entry point
src/budget.ts              Budget model, calculations, and interactions
src/budget.css             Main interface and responsive styles
src/budget-workflow.css    Dialog, setup, and action-menu styles
tsconfig.json              Strict TypeScript configuration
package.json               Scripts and development dependencies
server.mjs                 Static file server and SQLite API
desktop/main.cjs           Electron desktop application entry point
icon.png                   Supplied kestrel logo artwork
public/kestral-mark.png    Cropped transparent logo generated from icon.png
scripts/build-icons.mjs    Generate Windows and Mac icons from icon.png
dist/                      Generated production build
```
