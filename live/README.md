# Live Research

This folder contains research-grade manual execution aids for the CCW Dynamic Hedge Overlay.

- `reports/` stores the recommended static HTML operator interface:
  - `ACTIVE_MONITORING_DAILY.html`
  - `LIVE_POSITION_TIMELINE.html`
- `snapshots/` stores read-only BTC/ETH live research snapshots.
- `ACTIVE_MONITORING_DAILY.md` and `LIVE_POSITION_TIMELINE.md` remain backward-compatible markdown artifacts.
- `LIVE_POSITION_TIMELINE.csv` provides a spreadsheet-friendly timeline export.
- `manual_decision_log_template.csv` provides an auditable manual logging schema.

Live reports separate two accounting views:

- Current Cycle Accounting: underlying PnL since the cycle reference price, current-cycle option PnL, current-cycle hedge PnL, Net Cycle PnL, Net Cycle PnL %, and capital base.
- Portfolio / Lifetime Accounting: underlying PnL since original spot purchase, current option PnL, current hedge PnL, Portfolio Net PnL, Portfolio Net PnL %, and capital base.

`live/position_register.json` may include a minimal `cycle_accounting` block with the cycle underlying reference price. This is active operational state only, not a cycle ledger and not realized accounting.

These files do not place orders and do not validate live economic superiority.
