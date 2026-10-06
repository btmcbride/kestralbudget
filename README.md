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

**Make it your budget.** Customize sections and categories, with no app-imposed limit on categories or budget items. Install it as a standalone desktop app or self-host it. No subscription fees or paid features.

## Features

- **Plan by month:** Compare planned and actual income and spending, track unallocated income, and carry a chosen balance forward.
- **Customize your setup:** Choose budget sections, add custom sections and items, and personalize the theme, currency, date format, and layout.
- **Track activity:** Record transactions, link them to budget items, and search, filter, sort, or manage them in bulk.
- **Keep an eye on due dates:** Schedule income and expenses, and see subscription reminders on a calendar.
- **Understand your budget:** Run Budget Performance, Cash Flow & Leftover Income, or Spending Trends reports.

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

## Build and release

### Run locally

Requires Node.js 22 or later and npm. Start the API and frontend in separate terminals:

```powershell
npm install
npm run api
```

```powershell
npm run dev
```

Check and build the app:

```powershell
npm run typecheck
npm run build
```

### Build desktop installers

**Windows x64**

```powershell
npm ci
npm run desktop:dist
```

Output: `release/windows/`

**macOS Apple Silicon**

```bash
npm ci
npm run desktop:dist:mac
```

Output: `release/mac/`. The macOS build is unsigned; sign and notarize it before broad distribution.

### Publish a release

Run from the repository root. Bump the version (`patch`, `minor`, or `major`), then commit the version change and release code **before** creating the tag:

```powershell
npm version patch --no-git-tag-version
$version = node -p "require('./package.json').version"
git status
git add -A
git commit -m "Release v$version"
git push origin main
git tag "v$version"
git push origin "v$version"
```

The `Desktop Builds` workflow builds the commit referenced by the tag and publishes the installers. Check the GitHub release for both assets.

To list or remove an asset from a release, use its exact filename:

```powershell
gh release view "v$version" --json assets --jq ".assets[].name"
gh release delete-asset "v$version" "exact-asset-filename" --yes
```

### Self-host with Docker Compose

Requires Docker Compose. From the repository root:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Open `http://localhost:8080`. Data is stored in the persistent `kestralbudget-data` Docker volume.

## Data and privacy

Kestral Budget has no accounts, bank connections, cloud sync, or automatic backups. The desktop app stores data on your computer; the self-hosted edition stores it in its configured database volume. Keep independent backups of important data.
