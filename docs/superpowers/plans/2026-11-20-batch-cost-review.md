# Batch Cost Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make batch quantity changes recalculate material and manufacturing money correctly, expose per-unit/per-batch price checks, and keep work tables aligned.

**Architecture:** Extend the current `CostEngine.calculate` result with production-only subtotals and profit-tax values, preserving the existing `qty`/`scope` model and backwards compatibility. Add small inline editors and rendering helpers in the existing UI modules; use existing persistence and validation paths.

**Tech Stack:** Browser JavaScript, CommonJS-compatible calculation modules, HTML template strings, existing Node regression/UI checks.

**Spec:** `docs/superpowers/specs/2026-11-20-batch-cost-review-design.md`

## Global Constraints

- Keep `qty` + `scope`; do not migrate old calculations.
- Work volume remains the unit norm; work money scales with the batch.
- Materials keep reserve, pack, and allocation behavior.
- Manufacturing means `costCategory=production` only.
- Profit tax is editable and defaults to 25%; unknown/partial values stay unknown.
- Input material VAT is already included and is not deducted.
- Preserve unrelated user changes and current module architecture.

## Review Focus

- Old JSON without `profitTax` must remain valid and use 25% only for new/default UI state.
- A `scope=batch` work line must remain a one-time batch cost and must not be multiplied twice.
- Unknown material/work prices must render as `—`, never as zero profit.
- Inline invalid volume edits must leave the original line unchanged and show existing validation errors.
- Workshop totals must use the same rows and categories as the engine, without double counting setup/operation rows.

### Task 1: Calculation model and schema

**Files:**
- Modify: `source-project/dist/engine.js`
- Modify: `source-project/dist/domain-schema.js`
- Modify: `source-project/dist/app.js` (default state and price settings)
- Test: `source-project/tests/regression/review-check.cjs` or a focused new check in `source-project/`

**Interfaces:**
- `CostEngine.calculate(state, qty)` returns `manufacturing`, `manufacturingUnit`, `profitTax`, `profitAfterTax`, and `priceWithProfit` while preserving existing fields.
- `state.profitTax` is a non-negative number when present; missing values remain backward compatible.

- [ ] Add a failing regression assertion for unit work volume preservation, batch-scaled manufacturing amount, material batch scaling, and 25% after-tax profit.
- [ ] Run the focused check and confirm it fails before implementation.
- [ ] Add `profitTax:25` to `blank()` and validate optional `profitTax` in the domain schema.
- [ ] In the engine, classify production rows using `ReviewCore.category` when available (fallback to `costCategory`/work), sum production money separately, and derive unit/batch price-review metrics without altering existing `C`, `P`, `total` formulas.
- [ ] Keep `scope=batch` work rows one-time while `scope=unit` work rows scale by `q`; leave displayed `l.qty` unchanged.
- [ ] Run the focused regression and confirm it passes.

### Task 2: Inline volume editing and workshop headers

**Files:**
- Modify: `source-project/dist/app.js`
- Modify: `source-project/dist/style.css`
- Modify: `source-project/dist/workspace.css`
- Test: `source-project/ui-smoke-check.cjs`

**Interfaces:**
- Add `inlineVolumeHTML(line)` and `commitInlineVolume(event,id)` in `app.js`; both reuse `workspaceLineErrors` and `persist`.
- `workRowsHTML` groups each workshop with header text containing unit and batch cost.

- [ ] Add UI assertions that materials and work rows contain an inline volume control and that workshop headers expose unit/batch labels.
- [ ] Run `node ui-smoke-check.cjs` and confirm the new assertions fail before implementation.
- [ ] Render material and work volume as number inputs with the current unit, committing on change/blur; invalid input must not mutate state.
- [ ] Add workshop aggregation from rendered rows, using `amount` and `amount/q` for unit scope and keeping batch rows one-time.
- [ ] Add fixed column sizing, wrapping, and a compact cost subline so work amounts stay inside their cells on desktop and mobile.
- [ ] Run `node ui-smoke-check.cjs` and confirm it passes.

### Task 3: Price review block

**Files:**
- Modify: `source-project/dist/review-ui.js`
- Modify: `source-project/dist/app.js`
- Test: `source-project/ui-smoke-check.cjs`

**Interfaces:**
- Add `priceReviewHTML(r)` in `review-ui.js`, rendered in internal result view.
- It shows unit and batch values for material cost, manufacturing cost, cost with input VAT, price with profit, profit before profit tax, and profit after profit tax.

- [ ] Add UI assertions for all requested Russian labels and both unit/batch values.
- [ ] Render the block from engine values; use `—` for partial/unknown values and label material/manufacturing values as VAT-included source costs.
- [ ] Keep client-facing document output unchanged and ensure the block is internal-only.
- [ ] Run `node ui-smoke-check.cjs` and confirm it passes.

### Task 4: Full verification and handoff

**Files:**
- Modify: `source-project/README.txt` or `source-project/ARCHITECTURE.txt` only if the final behavior needs a short entry.

- [ ] Run `node review-check.cjs`, `node ui-smoke-check.cjs`, and `node run-checks.cjs` from `source-project`.
- [ ] Inspect the diff for unrelated changes and verify the pre-existing modified files were not overwritten.
- [ ] Record exact test results and any remaining visual limitation in the final response.

