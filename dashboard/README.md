# Profit dashboard (mockup v1)

Internal gross profit overview for Fone Nova Ltd, built from `FoneNova_Order_Ledger.xlsx`.
Local only: no backend, auth or live integrations.

## Run it

```bash
cd dashboard
npm install
# put the real ledger at data/FoneNova_Order_Ledger.xlsx, then:
npm run import      # xlsx -> data/generated/ledger.json, runs reconciliation, exits 1 on any mismatch
npm run dev         # http://localhost:3100
npm test            # unit tests + to-the-cent reconciliation against the real import
```

Without the real file the app falls back to `data/sample/ledger.json` (fake data, `npm run sample`
regenerates it) and shows a "Sample data" banner on every screen.

## Privacy

Everything in `data/` is git-ignored except `data/sample/`. Full PDF paths are imported but
stripped on the server before data reaches the browser; the UI shows file names only.

## Structure

| Path | Role |
| --- | --- |
| `scripts/import-ledger.ts` | Reads the xlsx, validates headers, writes typed JSON, reconciles |
| `lib/types.ts` | Domain types (`Order`, `OrderLine`, `CreditNote`, `LedgerException`, `Customer`, `Supplier`) |
| `lib/metrics.ts` | Every calculation, in integer cents |
| `lib/periods.ts` | Presets, previous-period rules, chart buckets |
| `lib/data-source.ts` | `DataSource` interface + local-file adapter. A Xero adapter replaces this file's adapter only |
| `components/dashboard/*` | The overview screen |

## Rules baked in

- Money is integer cents end to end. Float noise from the spreadsheet is rounded once, at import.
- Headline profit is **gross**. Net profit is shown as not available until own shipping, fees and
  overheads exist in the data.
- Credit notes count in the period of their own date. A credit referencing several orders is never
  split; it is shown as unallocated at portfolio level.
- Period comparisons show only when both periods sit inside the ledger's coverage (first order month
  to the Xero snapshot date). Otherwise the UI says why there is no comparison.
- Xero statuses, balances and "overdue N days" text are a snapshot (4 Oct 2026) and are never
  recalculated from today's date.
- Margin bands follow the ledger: amber under 0.5%, red below zero.

## Known importer quirk

exceljs drops cached formula results equal to 0, so a formula cell with no cached result is read as 0.
The import prints how many cells this affected (60 in the current ledger, all verified as 0 with a
second parser). A formula that was genuinely never calculated would also read as 0, but the
reconciliation would then fail rather than pass silently.

## Hosting (dashboard.fonenova.com)

Separate Vercel project (`fonenova-dashboard`, root directory `dashboard/`), not the marketing site.

**Access.** Google sign-in, locked to one address. Every request passes `proxy.ts`, and the page
re-checks the session before loading any data. Sessions are signed cookies (12 hours). Missing
configuration in production locks everyone out; it never opens up.

| Variable | Purpose |
| --- | --- |
| `AUTH_ALLOWED_EMAIL` | The only Google account that can sign in |
| `AUTH_URL` | `https://dashboard.fonenova.com` (fixed OAuth redirect origin) |
| `AUTH_SECRET` | 32+ random characters; signs cookies. Changing it signs everyone out |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth web client, redirect URI `https://dashboard.fonenova.com/auth/callback` |
| `FN_LEDGER_BR` | The ledger, from `npm run pack-ledger` (brotli + base64, file paths stripped) |

**Updating the figures.** `npm run import && npm run pack-ledger`, paste
`data/generated/ledger.br.b64` into `FN_LEDGER_BR` on Vercel (Production), redeploy. The real
ledger never enters git. Without `FN_LEDGER_BR` the hosted app shows the fake sample with its banner.

Local `npm run dev` skips sign-in when `GOOGLE_CLIENT_ID` is unset. Production builds never do.
