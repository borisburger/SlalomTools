# Slalom Tools

Slalom Tools is a Python (FastAPI) + React web app for managing **Inline Freestyle Slalom** competitions. It builds seeded starting lists from a Google Sheets registration paired with World Skate rankings, and provides a live operator + audience display driven by Excel judging sheets stored in OneDrive.

## What it does

- **Reads registrations from Google Sheets.** Competition organisers typically collect entries via a Google Form / Google Sheet. The app authenticates with Google, parses the sheet (flexible column heuristics for name, surname, World Skate ID, date of birth, sex, nationality, disciplines, club, etc.) and exposes the registered skaters per discipline.
- **Pairs entries with World Skate rankings.** Starting lists for Inline Freestyle have to be ordered by each skater's current world ranking. The app scrapes the official World Skate rankings site, downloads the per-discipline / per-age / per-sex tables and caches them locally as CSV files (under `rankings/<YYYY-MM_Mmm>/`). It then looks up each registered skater by World Skate ID to enrich the starting list with their world rank.
- **Maintains a local World Skate skater database.** The app can download the global athletes database (`skater-db.json` and `skater-db.csv`) and use it to verify that the World Skate ID and date of birth provided by each registered skater actually match the official record.
- **Connects to OneDrive judging sheets for Inline Freestyle Classic.** During an event the judges fill in an Excel workbook stored in OneDrive. The app authenticates with Microsoft (MSAL device-code flow), downloads the workbook, parses the "Final results" / "Marks" sheets, figures out which skaters have already skated, their current standings, and who skated last. This data is broadcast over WebSockets to a separate page intended to be shown on a TV or projector for the audience, with the last skater's row highlighted.
- **Batch-exports combined result sheets (CLI).** A separate command-line flow merges OneDrive Excel results with the registration data and applies name transliteration, producing a single `combined_results.csv` per event.

## Frontend pages

Routing lives in [`frontend/src/App.js`](frontend/src/App.js). All pages call the backend at `http://localhost:8000`.

- **`/operator` — [`OperatorPage.js`](frontend/src/OperatorPage.js)**
  Event operator console. Microsoft auth, load Excel from a OneDrive share URL, configure auto-refresh interval, side-by-side view of live judges' data vs the snapshot currently published to the public display, switch the public display between results and a custom message, mark a category complete (which surfaces medal badges), and publish the latest snapshot.
- **`/public` — [`PublicPage.js`](frontend/src/PublicPage.js)**
  Read-only TV / projector view driven by WebSocket updates. Shows the top N rows (configurable via `style.publicDisplayLimit`) with medal styling for ranks 1–3, country flags, a last-skater highlight, an optional background image with on-screen scale controls, and a full-screen message mode.
- **`/reg` — [`RegistrationPage.js`](frontend/src/RegistrationPage.js)**
  Registration and starting-list builder. Google auth, load a Google Sheet by URL (URL is remembered in `localStorage`), filter by discipline / gender / age, choose a display preset (Classic, Battle, Names only, Complete profile, New skaters, Skaters with WS ID), enrich each row with the skater's current world rank, verify each skater against the local skater database (ID + DOB), then copy the resulting table as TSV to the clipboard for pasting into Excel or Google Sheets.
- **`/rankings` — [`RankingsPage.js`](frontend/src/RankingsPage.js)**
  Rankings and skater-database maintenance. Compares the locally cached rankings against the latest available on the World Skate site, runs an update with a progress bar, lets you browse each discipline in a searchable modal, and downloads all rankings as a single zip. The same page manages the skater database (status, update with progress, download as JSON or CSV).

## Backend feature areas

All HTTP and WebSocket endpoints are defined in [`backend/main.py`](backend/main.py).

- **Registration (Google Sheets).** `/google/auth/initiate`, `/api/google/auth/callback`, `/google/auth/status`, `/registration/load`, `/registration/disciplines`, `/registration/skaters`. Sheet fetching, OAuth and column heuristics live in [`backend/google_sheets.py`](backend/google_sheets.py). See [`backend/README_GOOGLE_INTEGRATION.md`](backend/README_GOOGLE_INTEGRATION.md) for setup.
- **World Skate rankings.** `/api/rankings/info`, `/api/rankings/update`, `/api/rankings/progress`, `/api/rankings/download-zip`, `/api/rankings/table-metadata`, `/api/rankings/{discipline}`, plus `/api/rankings/all/combined` (used by the registration page to look up each skater's rank by World Skate ID). Site scraping and DataTables download logic live in [`backend/rankings.py`](backend/rankings.py).
- **Skater database.** `/api/skater-db/info`, `/api/skater-db/update`, `/api/skater-db/progress`, `/api/skater-db/download` (JSON), `/api/skater-db/download-csv`, `/api/skater-db/data` (full payload for client-side search and verification). Implementation in [`backend/rankings.py`](backend/rankings.py) (`fetch_skater_database`).
- **OneDrive live results.** MSAL device-code auth (`/auth/initiate`, `/auth/status`, `/auth/test`), `/load_excel`, `/refresh_data`, `/auto_refresh/status`, `/auto_refresh/settings`, `/publish`, `/mark_complete`, `/display_message`, `/switch_display_mode`, `/upload_background`, plus the WebSocket channels `/ws/operator` and `/ws/public` that push live and published updates. The server also runs a background task that polls OneDrive for file changes when auto-refresh is enabled.
- **Batch results CLI.** [`backend/result_sheets.py`](backend/result_sheets.py) reads either a OneDrive folder or local CSVs, joins them with registration data via [`backend/registration_data.py`](backend/registration_data.py), transliterates names and writes a `combined_results.csv`. See [`backend/README_result_sheets.md`](backend/README_result_sheets.md) and [`backend/ONEDRIVE_INTEGRATION_SUMMARY.md`](backend/ONEDRIVE_INTEGRATION_SUMMARY.md).
- **Configuration.** [`backend/config.json`](backend/config.json) holds `paths` (static dir, default Excel file, default background image), `style` (fonts, colors, `publicDisplayLimit`), `default_excel_url`, `worldSkateRankingsUrl` and `registration.default_nationality`.

## Running the app

Backend (from the `backend` folder):

```
uvicorn --timeout-keep-alive 1 --timeout-graceful-shutdown 1 main:app
```

Frontend (from the `frontend` folder):

```
npm run start-no-prompt
```

The frontend expects the backend at `http://localhost:8000` (HTTP + WebSocket).

### Prerequisites

- Python dependencies: `pip install -r backend/requirements.txt`.
- Node dependencies: `npm install` in `frontend/`.
- Google Sheets integration: see [`backend/README_GOOGLE_INTEGRATION.md`](backend/README_GOOGLE_INTEGRATION.md) (Google Cloud project, OAuth desktop client, `google_secrets.json`).
- OneDrive integration: see [`backend/README_result_sheets.md`](backend/README_result_sheets.md) and [`backend/ONEDRIVE_INTEGRATION_SUMMARY.md`](backend/ONEDRIVE_INTEGRATION_SUMMARY.md) (Microsoft `secrets.json`, device-code auth via the operator page).

## Project layout

- `backend/main.py` — FastAPI app: HTTP + WebSocket endpoints, auth, OneDrive polling, public-display state.
- `backend/rankings.py` — World Skate rankings scraper and skater-database downloader.
- `backend/google_sheets.py` — Google OAuth and registration-sheet parsing.
- `backend/result_sheets.py` — Batch CLI that joins OneDrive Excel results with registration data into a combined CSV.
- `backend/registration_data.py` — Helper for looking up registered skaters by ID or name from a local CSV.
- `backend/config.json` — App configuration (style, default URLs, default nationality).
- `frontend/src/App.js` — React Router setup.
- `frontend/src/OperatorPage.js` — operator console (`/operator`).
- `frontend/src/PublicPage.js` — TV / projector view (`/public`).
- `frontend/src/RegistrationPage.js` — registration and starting-list builder (`/reg`).
- `frontend/src/RankingsPage.js` — rankings and skater-database manager (`/rankings`).
