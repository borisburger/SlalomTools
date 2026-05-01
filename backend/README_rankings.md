# World Skate Rankings Extraction

This document describes how [`backend/rankings.py`](rankings.py) downloads the official Inline Freestyle world rankings and the global skater database from the World Skate rankings web application, and how the results are stored on disk for the rest of the app to consume.

## Source

The rankings live on a third-party hosted instance of the World Skate rankings app. The base URL is configured in [`backend/config.json`](config.json) under `worldSkateRankingsUrl` and currently defaults to:

```
https://app-69b8883b-99d4-4935-9b2b-704880862424.cleverapps.io
```

The site has no public REST API. Instead it serves:

- An HTML landing page that lists every available ranking discipline as a [DataTables](https://datatables.net/)-powered table, plus a sidebar of "Archives" links for each historical ranking month.
- A separate JSON endpoint per table (the `data-url` attribute on each `<table>`) that the DataTables JS calls with the standard server-side query parameters.
- A `/athletes.json` endpoint, also DataTables-powered, that returns the global skater database paginated.

Because there is no API contract, the module scrapes the HTML to discover what is available and then talks to the JSON endpoints directly.

## Two extraction flows

`rankings.py` exposes two independent download flows:

1. `fetch_rankings(base_url=None)` — downloads every per-discipline ranking table for the latest available month.
2. `fetch_skater_database(base_url=None)` — downloads the full global athletes database in chunks.

Both are also exposed via FastAPI endpoints in [`backend/main.py`](main.py) (`/api/rankings/update`, `/api/skater-db/update`, plus matching `/info` and `/progress` endpoints) and consumed by the `/rankings` page in the frontend ([`frontend/src/RankingsPage.js`](../frontend/src/RankingsPage.js)).

## Determining the latest ranking month

`fetch_rankings` starts by GETting the landing page and parsing it with BeautifulSoup. The "Archives" sidebar of the page looks like this:

```html
<div class="left-filters">
  <div class="left-filter-year">2026</div>
  <p><a href="/world_rankings?starting_date=2026-12-01">2026-12-01</a></p>
  <p><a href="/world_rankings?starting_date=2026-02-01">2026-02-01</a></p>
  <p><a href="/world_rankings?starting_date=2026-01-01">2026-01-01</a></p>
  <div class="left-filter-year">2025</div>
  ...
</div>
```

The naive approach of "take the first link" is unreliable because the site sometimes lists future-dated entries that don't actually have data yet (e.g. listing `2026-12-01` while it is only May 2026). To guard against that, `find_latest_archive_date(soup)`:

1. Reads every `<a>` inside `div.left-filters`.
2. Parses each link text as `YYYY-MM-DD`.
3. Discards any date later than today.
4. Returns the most recent remaining date.

The same helper is reused by `get_rankings_info()` in [`backend/main.py`](main.py) so the "Latest available rankings" indicator on the `/rankings` page never reports a future month.

The chosen `YYYY-MM-DD` date is then converted by `format_date_for_folder()` to `YYYY-MM_Mmm` (e.g. `2026-02_Feb`). That format is used throughout the app because:

- It is human-readable.
- Lexicographic sort over folders matches chronological sort, so `get_latest_rankings_folder()` can find the newest cached month with a plain `sorted()`.

## Discovering the discipline tables

The landing page also contains the actual ranking tables. The relevant structure is:

```html
<div class="rankings-container">
  <div class="table-container">
    <h2 table-id="123">...</h2>
    <table data-url="/world_rankings/123.json">
      <caption>World Ranking February 2026 - Classic - men - senior</caption>
      ...
    </table>
  </div>
  ...
</div>
```

For every `div.table-container` the scraper extracts:

| Field         | Source                                                 | Example                                              |
| ------------- | ------------------------------------------------------ | ---------------------------------------------------- |
| `discipline`  | `<caption>` text → `extract_discipline_type()`         | `classic`                                            |
| `sex`         | Words in the caption (`women` / `men`)                 | `men`                                                |
| `age`         | Words in the caption (`senior` / `junior`)             | `senior`                                             |
| `table_id`    | `h2[table-id]` → `DataTables_Table_<id>_wrapper`       | `DataTables_Table_123_wrapper`                       |
| `data_url`    | `table[data-url]` joined with the base URL             | `https://.../world_rankings/123.json`                |

This metadata is saved alongside the CSVs as `table_metadata.json` so the frontend can render filters (sex / age / discipline) and link each table back to its source endpoint without re-scraping.

`normalize_filename()` derives the on-disk filename from the caption: it strips the `World Ranking <month> <year> - ` prefix, lowercases the rest and replaces whitespace with hyphens. So the example caption above becomes `classic-men-senior.csv`.

## Calling the DataTables endpoints

Each per-discipline JSON endpoint expects the standard DataTables server-side request format. `build_datatables_params(num_cols=7)` builds those parameters:

- `draw` — a monotonically increasing request counter (`gi_drawNumber`).
- `start` / `length` — pagination. For rankings we ask for `length=2147483647` (effectively "all rows") in a single request.
- `columns[i][...]` — the column descriptors expected by the DataTables protocol; everything is set to defaults because we don't filter or sort server-side.
- `_` — current epoch in ms, as a cache-buster.

For each discipline `fetch_rankings` GETs the `data_url` with these params, takes `data["data"]` (a list of rows, each a list of HTML strings) and converts it to a pandas `DataFrame`. The seven columns are mapped to fixed names:

| Index | Column | Meaning                              |
| ----- | ------ | ------------------------------------ |
| 0     | Rank   | Current world rank                   |
| 1     | Prev   | Previous world rank                  |
| 2     | Best   | Sum of the 4 best scores             |
| 3     | Name   | Surname + first name                 |
| 4     | Nat.   | 3-letter country code                |
| 5     | ID     | World Skate ID                       |
| 6     | Total  | Total points in the last 12 months   |

Every cell still contains the markup the site uses for flag icons and links, so each value is run through `strip_html()` (BeautifulSoup `get_text(strip=True)`) before being written. The cleaned `DataFrame` is then dumped to CSV with `csv.QUOTE_ALL`.

## Output layout

After a successful run the `rankings/` folder looks like:

```
rankings/
├── 2026-02_Feb/
│   ├── table_metadata.json
│   ├── classic-men-senior.csv
│   ├── classic-women-senior.csv
│   ├── battle-men-senior.csv
│   ├── ...
│   └── slide-women-senior.csv
├── 2026-01_Jan/
│   └── ...
├── skater-db.json
└── skater-db.csv
```

Two helpers expose this structure to the rest of the backend:

- `get_latest_rankings_folder("rankings")` — returns the most recent `YYYY-MM_Mmm` directory (alphabetical sort works thanks to the folder-name format).
- `get_discipline_file_path(discipline_name, "rankings")` — given a (possibly un-normalized) discipline name, returns the path to that CSV inside the latest folder, with a case-insensitive fallback if the exact filename isn't found.

## Skater database extraction

`fetch_skater_database()` follows the same DataTables pattern but against `/<base_url>/athletes.json`:

1. Make one request with `length=1` to read `recordsTotal` from the response.
2. Loop in chunks of 500 (`start=0,500,1000,...`), sending DataTables params with `length=500` each time.
3. For every chunk, take the raw row arrays and convert them to dictionaries with explicit field names:

   | Index | Field             | Notes                                   |
   | ----- | ----------------- | --------------------------------------- |
   | 0     | `family_name`     | Stripped of HTML                        |
   | 1     | `first_name`      | Stripped of HTML                        |
   | 2     | `nationality`     | 3-letter code                           |
   | 3     | `world_skate_id`  | The canonical ID                        |
   | 4     | `birth_date`      | As shown on the site                    |
   | 5     | `previous_ids`    | List of historical IDs (or `[]`)        |
   | 6     | `edit_url`        | Admin-only link (kept for completeness) |

4. Sleep 0.5 s between chunks to avoid hammering the upstream server.
5. Write two artefacts side-by-side under `rankings/`:
   - `skater-db.json` — the full structure including a `timestamp` and the `fields` schema, useful for the frontend (which loads it client-side for fast lookup / verification on the registration page).
   - `skater-db.csv` — a flat CSV (with `previous_ids` joined by `;`) for spreadsheet use.

The frontend uses the JSON file to verify that the World Skate ID and date of birth a skater wrote on the registration form actually match an athlete in the official database (see `/reg` in [`RegistrationPage.js`](../frontend/src/RegistrationPage.js)).

## Progress tracking

Both flows expose a tiny progress dict so the frontend can show a progress bar while the download is running:

- Rankings: `download_progress = { current_discipline, total_disciplines, completed_disciplines, is_complete }`, with `reset_download_progress()` / `get_download_progress()` accessors. `total_disciplines` is set after the discipline list is parsed; `completed_disciplines` advances per CSV; `is_complete` flips to `True` at the end.
- Skater database: `skater_db_progress = { total_skaters, downloaded_skaters, is_complete }`, set from `recordsTotal`, advanced after every chunk, finalised at the end (and also on error so the UI doesn't get stuck on a spinner).

These dicts are read by the `/api/rankings/progress` and `/api/skater-db/progress` endpoints in [`backend/main.py`](main.py).

## Configuration

The only configuration the module reads is `worldSkateRankingsUrl` from [`backend/config.json`](config.json). Both `fetch_rankings()` and `fetch_skater_database()` accept an explicit `base_url` argument; if omitted they fall back to the config value, and finally to the hard-coded default. This makes it easy to point the whole pipeline at a staging instance of the upstream site without touching code.

## Running standalone

Both functions can be triggered through the FastAPI endpoints, but `rankings.py` also has a CLI entry point that downloads the rankings (not the skater database) for the latest month:

```bash
python rankings.py
```

It prints progress to stdout via the standard `logging` module and exits with `0` on success / `1` on any unhandled exception. On success the function returns `(folder_date, output_dir)`, e.g. `("2026-02_Feb", "rankings/2026-02_Feb")`.

## Failure modes & guard rails

- **Future-dated archives.** Mitigated by `find_latest_archive_date()` (see above). Without this filter the app would download an empty / phantom month and wrongly report "newer rankings available" to the user.
- **HTTP / network errors.** The initial landing-page fetch is wrapped in `try/except requests.RequestException` and re-raised. Per-discipline failures are caught individually and logged so one broken table doesn't abort the whole run.
- **Empty `data` arrays.** If a discipline endpoint returns no rows (e.g. brand-new discipline with no skaters yet) it is skipped with a warning, no CSV is written.
- **Missing structural elements.** Both `div.left-filters` and `div.rankings-container` are required; if either is absent (e.g. the upstream site is redesigned) the run fails fast with a `ValueError` so the caller can surface a clear error to the operator.
- **HTML in cell values.** Every cell is funnelled through `strip_html()` before reaching the CSV, so flag images and embedded `<a>` tags never leak into the output.
