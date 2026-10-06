<p align="center">
  <img src="public/kestral-mark.png" alt="" width="76">
</p>

<h1 align="center">Kestral Budget</h1>

<p align="center">
  <strong>A clear, calm plan for your money—month by month.</strong><br>
  Fast and lightweight, with local-first budgeting and no bank connections or cloud accounts.
</p>

<p align="center">
  <a href="https://github.com/btmcbride/kestralbudget/releases/latest">Download</a>
  · <a href="#features">Features</a>
  · <a href="#self-host-with-docker-compose">Self-host</a>
  · <a href="#build-and-release">Build and release</a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/v/release/btmcbride/kestralbudget?display_name=tag" alt="Latest GitHub release">
  <img src="https://img.shields.io/badge/Windows-x64-0078D6?logo=windows&amp;logoColor=white" alt="Windows x64">
  <img src="https://img.shields.io/badge/macOS-Apple%20Silicon-555555?logo=apple&amp;logoColor=white" alt="macOS Apple Silicon">
  <img src="https://img.shields.io/badge/no-subscription%20fee-2ea043" alt="No subscription fee">
</p>

Kestral Budget brings your monthly plan and actual spending together. Plan income, bills, savings, and everyday expenses; record transactions against your budget items; then see how real activity compares with your plan. At a glance, understand what’s allocated, what’s still available, and what can carry forward.

**Make it your budget.** Add as many categories and budget items as you need, choose the sections you use, and personalize your currency, date format, theme, and layout. Run it as a standalone desktop app or self-host it. There are no subscription fees or feature paywalls.

## Budgeting that works your way

- **Plan and adjust:** Set monthly targets, compare planned with actual income and spending, see unallocated income, and carry a balance forward when you choose.
- **Shape your setup:** Organize your budget with the categories, sections, and items that make sense to you. Choose your currency, date format, theme, and layout.
- **Track the details:** Log transactions against budget items, then search, filter, sort, and manage activity in bulk.
- **Keep due dates visible:** Add due dates to bills, subscriptions, and debts, and see upcoming subscriptions on a calendar.
- **Learn from the numbers:** Use Budget Performance, Cash Flow & Leftover Income, and Spending Trends reports to explore your budget over time.

## Screenshots

Screenshots use fictional sample data. Select a preview to open its full-size image.

| Dashboard | Transactions |
| :---: | :---: |
| [![Open full-size dashboard screenshot](docs/screenshots/dashboard-thumb.png)](docs/screenshots/dashboard.png) | [![Open full-size transactions screenshot](docs/screenshots/transactions-thumb.png)](docs/screenshots/transactions.png) |

| Subscription tracking | Reports |
| :---: | :---: |
| [![Open full-size subscription tracking screenshot](docs/screenshots/subscriptions-thumb.png)](docs/screenshots/subscriptions.png) | [![Open full-size reports screenshot](docs/screenshots/reports-thumb.png)](docs/screenshots/reports.png) |

## Install or self-host

| Edition | Get started | Platform |
| --- | --- | --- |
| Standalone desktop app | [Download the latest release](https://github.com/btmcbride/kestralbudget/releases/latest) | Windows x64 or macOS Apple Silicon |
| Self-hosted app | [Docker Compose instructions](#self-host-with-docker-compose) | Your own computer or server |

The desktop and self-hosted editions use separate databases. Export and import a backup to move data between them. Backups are manual; do not expose a self-hosted instance to an untrusted network.

### Self-host with Docker Compose

Requires Docker Compose. From the repository root:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Open `http://localhost:8080`. Data is stored in the persistent `kestralbudget-data` Docker volume.

## Data and privacy

Kestral Budget has no accounts, bank connections, cloud sync, or automatic backups. The desktop app stores data on your computer; the self-hosted edition stores it in its configured database volume. Keep independent backups of important data.
