# Alerts P5B

Implemented locally; not deployed. Shell v3.9.0. Review `_project/p5-alerts/INSPECTION.md` and `REPORT.md` in the DisneyOS workspace before rollout.

Requires planner migration `0005_alert_watches.sql` before planner deployment, then frontend publication. The existing five-minute cron and PARK_API service binding evaluate normalized wait/status data. Owner is a DisneyOS Member; P2 supplies itinerary activation. No new raw acquisition stack or plan writes.

Shortcuts Alerts counts unresolved actions only. Profile badge retains People approval semantics. Activity and compact Home bar consume the same persisted Watch events. Paused, inactive-today, unsupported source, stale Match and Monitoring Issue remain distinct.

Dining/Extras store criteria with explicit monitoring-unavailable labels. P4 restaurant search needs its pending public Worker deployment. Named unlisted targets require future verified mapping. No production future availability source, credible historical wait baseline, background push transport, shared recipients or Admin Watch UI is claimed. Booking detection requires exact normalized target identity. AI proposals require structured form confirmation and never create Watches by themselves.

45 automated tests, responsive P5 browser checks and existing P3/P4 browser checks pass. Live D1 metadata inspection made zero changes; no production schema/data changes or deployment were performed. BG1 is untouched.
