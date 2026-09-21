# P7 Genie

Local shell v3.11.0 implements the contextual Genie companion. **Not deployed.** Planner migration `0007_genie_confirmations.sql` and `GENIE_ENABLED=true` are required for reasoning/actions; the local configuration defaults to false until rollout. Model selection is backend-configurable using `GENIE_MODEL` and the existing server-side API key.

The center lamp opens a sheet/full-screen workspace with text, quick prompts, push-to-talk transcript review, current-screen context, compact cards and explicit confirmation. Reads and writes remain owned by P0–P6. No source reservations, Admin actions or LL transactions are exposed.

Full implementation notes, remaining acceptance and rollout sequence: `../_project/p7-genie/REPORT.md`. Evidence includes 165 passing automated tests, eight new browser scenarios, existing Home/Parks/Alerts/Notifications browser regressions, responsive screenshots and a successful Worker dry build. Actual model-service and physical-device voice acceptance remain open.
