# Kestral Budget

![GitHub release](https://img.shields.io/github/v/release/btmcbride/kestralbudget?display_name=tag)

Kestral Budget is a local-first monthly budgeting app. Plan income and spending in one budget, record transactions, and carry actual leftover money into later months.

## How the app is organized

- **Budget:** The app has one budget, organized into monthly plans.
- **Month:** Each month has planned amounts, actuals, and transactions. Month tabs switch between months in the budget.
- **Category:** A category belongs to a standard spending type or a custom type. Examples include Rent under Bills or Pet care as a custom type.
- **Budget item:** An item is a planned line within a category, such as a paycheck, rent, or groceries. It has planned and manually entered actual amounts.
- **Transaction:** A dated record of actual income or spending. It belongs to a category and can optionally be linked to one of that category's budget items.

## Main workflows

### Set up the budget

Choose **Create your first budget** and select the sections to include. Income is always included; Bills, Expenses, Subscriptions, Debts, and Savings are optional. The setup wizard visits each selected section in order and lets you add budget items with planned amounts. You can skip a section's items and add them later.

For recurring income, choose a weekly, biweekly, or monthly frequency and enter the next payday. The app generates a planned income item for each scheduled payday in each month. One-off or irregular income can still be entered manually.

Use the left sidebar to navigate to **Dashboard**, **Transactions**, **Subscription Tracking**, **Monthly Review**, or **Reports**. Open **Settings** at the bottom of the sidebar to customize the theme, accent color, text size, and layout density, and to choose currency, date format, calendar week start, and month carryover preferences. Reports is a placeholder for a future update. Export and import options remain in the sidebar.

Custom categories can be added from the Dashboard after setup. When setup finishes, you can start an optional guided tour; use the graduation-cap **App tour** button in the top bar to replay it later.

### Dashboard and Transactions

- **Dashboard** starts with planned income plus carryover, unallocated planned income, and planned allocations. The **At a glance** pane contains collapsible Income and Categories summaries with planned, actual, and difference details; **Top spending** remains in its own pane alongside it. Budget categories and items appear below.
- **Transactions** shows the selected month's dated ledger. Use **Add transaction** to enter a date, description, amount, and category. You can optionally assign it to a budget item in that category. Search by description, budget item, category, or date, filter by budget item or category (or both), and select visible transactions for bulk deletion. Transactions can be edited, duplicated, or deleted individually.

### Subscription Tracking and Monthly Review

**Subscription Tracking** displays subscription due dates and recurring scheduled items on a calendar for the selected month. Add subscriptions with an optional reminder date or a recurring schedule.

**Monthly Review** compares recorded income and spending to the selected month's plan, including over- and under-plan categories.

The category determines how a transaction is counted: transactions under Income add to actual income; transactions under other categories add to actual spending. A transaction linked to a budget item also appears in that item's actual amount. Category-only transactions still affect category totals and leftover, but are not assigned to a specific item.

### Create a new month

Choose **+** beside the month tabs. A confirmation explains that creating the next month ends the current month and carries forward an amount based on the selected **Settings → New-month carryover** rule. The default is actual leftover; you can instead use planned unallocated income. The selected rule is recorded for each new month, so changing the preference only affects future months and leaves existing carryovers unchanged. The new month copies planned categories and budget items, resets actuals, and starts with an empty transaction ledger. Transactions remain with the month in which they were recorded.

Use **Schedule item** in a non-income category to repeat a planned expense weekly, biweekly, or monthly. Each occurrence is added as a planned item with its due date; actual spending is recorded separately. Adding a schedule also fills matching future months already in the budget series.

Use **Manage recurring** above the categories to edit a schedule, change its category, pause or resume it, or remove it. Changes update future planned entries in existing months. Historical entries and entries with actual amounts or linked transactions are retained when a schedule is paused or removed.

Use the ellipsis menu to delete the selected month. Carryovers for remaining months are recalculated in month order.

### Back up and restore data

Use the export and import controls in the sidebar to download a JSON backup or restore one. A backup includes the budget's months and saved preferences. Importing replaces the current data after confirmation; when a legacy backup contains multiple independent budgets, only its active budget and its months are restored.

## Calculations

For income, the difference is actual minus planned; for categories, spending above plan is unfavorable.

```text
Planned leftover = planned income + opening carryover - planned spending
Actual leftover  = actual income + opening carryover - actual spending
```

The Settings page lets you format dates as month-day-year, day-month-year, or ISO 8601 (`YYYY-MM-DD`), and choose among USD, EUR, GBP, CAD, AUD, NZD, JPY, CNY, INR, CHF, MXN, and BRL. Currency symbols, separators, and decimal places follow the device's locale and the selected currency.

Actual income and spending include both manually entered item actuals and transactions. Transactions are counted once in their category totals.

Amounts are displayed in US dollars (USD) by default; the currency can be changed in Settings. The app does not connect to financial institutions or import transactions automatically.

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

1. Bump the app's patch version in `package.json` (use `minor` or `major` instead of `patch` when appropriate):

```powershell
npm version patch --no-git-tag-version
```

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
6. Create and push a version tag matching the version in `package.json` (for example, `v1.1.8`):

```powershell
git tag vX.Y.Z
git push origin vX.Y.Z
```

If you need to replace a tag that already exists, delete it locally and remotely before recreating it:

```powershell
git tag -d vX.Y.Z
git push origin --delete vX.Y.Z
git tag vX.Y.Z
git push origin vX.Y.Z
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

If macOS says the app is damaged after you open the DMG, clear the quarantine flag and try again:

```bash
xattr -cr "/Applications/Kestral Budget.app"
```

The `Desktop Builds` GitHub Actions workflow builds both installers on every push and uploads separate Windows and Mac artifacts. Pushing a `v*` tag also publishes a GitHub Release with the `.exe` and `.dmg`. The Mac build is unsigned; sign and notarize it with Apple Developer credentials before distributing it broadly.

The desktop and container editions use separate databases. Export a backup from one edition and import it into the other to transfer data. Windows installers are unsigned unless a code-signing certificate is configured, so Windows may show a publisher warning.

### Run with Docker Compose

Copy the sample environment file and start the app with one command:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

The compose setup exposes the app on `http://localhost:8080` by default and stores saved budgets in a persistent Docker volume named `kestralbudget-data`.

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

The app restores the previously selected month in its single budget. Backups are manual; store exported files securely and keep independent copies of important data.

## Project structure

```text
index.html                 App entry point
src/budget.ts              Budget model, calculations, and interactions
src/backup.js              Versioned JSON export/import validation
src/budget.css             Main interface and responsive styles
src/budget-workflow.css    Dialog, setup, and action-menu styles
src/guided-tour.css         Guided tour overlay and top-bar control
src/paycheck-scheduler.js   Recurring income and expense date generation
src/preferences.js          Legacy preference helpers
src/transactions.css        Transaction search, filters, and bulk actions
src/recurring-expenses.css  Recurring expense category controls
src/budget-feedback.css    Subtle planned-leftover feedback
tsconfig.json              Strict TypeScript configuration
package.json               Scripts and development dependencies
server.mjs                 Static file server and SQLite API
desktop/main.cjs           Electron desktop application entry point
icon.png                   Supplied kestrel logo artwork
public/kestral-mark.png    Cropped transparent logo generated from icon.png
scripts/build-icons.mjs    Generate Windows and Mac icons from icon.png
dist/                      Generated production build
```
