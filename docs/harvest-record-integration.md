# Harvest Record Integration

Use the `Harvest` tab to record the cleaned harvest workbook directly in the app. The full harvest detail stays separate from the ledger until `Post Summary` is clicked.

## App Tab

Open the app and go to `Harvest`.

The tab records:

- Harvest dates and harvest expenses
- Chicken sales by classification
- By-product sales
- Financing / actual expenses
- Live totals for gross sales, harvest expenses, financing, and net proceeds

Click `Save` to keep the harvest report as a draft. Click `Post Summary` only when the report is final; that creates the summary ledger entries and locks the harvest report.

## Import File

Legacy generated archive file:

`outputs/harvest-import/octavio-harvest-archive-20260418.draft.json`

## What It Imports

- Batch `20260418`
- 3 `Net Meat Sale` income rows, one per harvest date
- 6 `OPEX` financing expense rows for feed, DOC, medicine, and brooding paper

The imported financial result should match the workbook:

- Harvest dates: May 18, 2026; May 20, 2026; May 21, 2026
- Batch start date: April 18, 2026
- Net sales after harvest expenses: PHP 4,579,342.29
- Financing expenses: PHP 4,765,520.00
- Net proceeds after financing: PHP -186,177.71
- Net proceeds per bird: PHP -5.6227

## Current App Steps

1. Open the app.
2. Go to `Batches` and select batch `20260418`.
3. Go to `Harvest`.
4. Review or edit the workbook-style rows.
5. Click `Save` to keep a draft.
6. Click `Post Summary` only when the report is final.

## Legacy Import Steps

Use these only if you still want to import the summary-only archive through Settings:

1. Go to `Settings`.
2. Under `Import Files`, choose `Single Batch Archive`.
3. Select `outputs/harvest-import/octavio-harvest-archive-20260418.draft.json`.
4. Click `Import File`.

## Review Before Final Use

The corrected harvest dates are May 18, 2026; May 20, 2026; and May 21, 2026. The generated archive uses those dates even though the visible row labels on the `Overview` and `Expenses & Net` sheets still show the old March dates.

The workbook's `Source Raw Data` sheet also still contains older date and gross-sales snapshot values. The archive uses the current calculated values from the `Overview`, `Chicken Sales`, `Byproducts`, `Expenses & Net`, and `Financing` sheets.
