# Parks P4

Implemented locally, not deployed. Frontend shell version 3.8.1, Parks module v2, shared app v3.8.0. Deploy the public `disneyos-api` Worker with `/v1/park-explorer` and `/v1/parks-dining-detail` before publishing these frontend assets. No migration or new binding is required. Existing Home `/park-day` and standalone `/wait-times` endpoints remain supported.

Parks is independent of Home selection, Trips, People and provisioning. It stores its own destination/date context in sessionStorage and category/item hierarchy in the URL. Today is Orlando's date; earlier dates are rejected. Main is the active frontend; the older separate dev frontend was intentionally not mirrored.

Existing ThemeParks destination children supply parent-verified restaurant/show references. Existing schedules supply selected-date park hours; live show records supply only exact-date performances. Queue-Times supplies current waits, with per-record source timestamps. Failures retain date/destination-scoped last-known components. Future ride records contain no current wait/status; there is no predictive source.

Dining now enriches the existing references from the public structured endpoint used by Disney's official website. Exact restaurant IDs preserve catalogue identities; explicit destination IDs include Disney Springs. Supported fields include categories, cuisine, prices, positive Mobile Order/reservation flags, character dining, dated hours and official detail links. Description/menu links load on demand from the structured restaurant detail. Missing fields remain absent and base/cached references survive failures. List/detail caching uses 15 minutes/one day with six-second upstream timeouts. No restaurant assignment is inferred from coordinates or names. The site-internal API has no guaranteed external contract; verify access from Cloudflare during deployment validation.

Official map links reuse the verified P3 routes. Disney controls its map/list presentation; specific-item map focus is not available. Services are clearly labeled resort-wide official references. No native directions, historical acquisition, AI routing, alerts or shopping were added.

Wait-history capture was classified MODERATE and deferred: existing persistent availability history uses canonical IDs and change-based recording, while public Queue-Times reads lack verified aliases and scheduled sampling. No historical storage, prediction or third-party historical integration was added.

P4 is ready for deployment/live validation when requested. The follow-up passes 26 tests, existing Parks and new dining browser checks at phone/tablet/desktop widths, real-source read-only checks and a Worker dry-run build.

Detailed initial inspection is in `../_project/p4-parks/INSPECTION.md` and `REPORT.md`. The latest dining findings, changed-file inventory, wait-history/storage assessment, limitations and validation evidence are in `../_project/p4-parks/enrichment/REPORT.md`. That follow-up supersedes the original report's dining limitations.
