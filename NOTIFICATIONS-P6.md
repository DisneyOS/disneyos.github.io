# P6 Notifications checkpoint

Main shell v3.10.0 extends the existing PWA. Production rollout is in progress; physical iPhone acceptance remains open. Full inspection and validation: `../_project/p6-notifications/REPORT.md`; production evidence: `../_project/p6-notifications/rollout/` in the DisneyOS workspace.

Production migration 0006 was applied after verified 0001–0005 on 2026-09-20. VAPID is securely configured and NOTIFICATIONS_ENABLED=true. Backend version 6b1d5f46-4927-4832-881f-2c8696e4d70f passed staged disabled/enabled verification before this frontend release. Older dev frontend and setup are intentionally not mirrored.

92 automated tests, 12 P6 browser cases, existing P5/Home/Parks browser regressions and Worker dry build pass. Browser permission/subscription/provider cases are synthetic. Real iPhone Home Screen background delivery, badge and tap acceptance are outstanding. Migration verification preserved pre-existing schema/table counts, and enabling P6 created no automatic subscriptions or events.
