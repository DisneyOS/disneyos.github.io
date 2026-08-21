DisneyOS Party Manager UI - Phase 1
===================================

Built from the current authenticated disneyos.github.io frontend.

What is included
----------------
- Settings > Connections now shows the linked Disney profile.
- New Party Management screen uses the member's existing DisneyOS device token.
- Loads GET /v1/membership/me and GET /v1/parties.
- Creates saved parties through POST /v1/parties.
- Switches the default party through POST /v1/parties/{partyId}/default.
- Only profileAccess records are rendered; the full central Planner directory is never shown.
- The existing first Kyle party should appear as Active immediately.
- Service-worker/app cache versions bumped so phones discover the deployment.

No PowerShell is required for end users. PowerShell was only used to prove the APIs before the UI existed.

Files changed
-------------
- v1/index.html
- v1/js/app.js
- v1/css/styles.css
- v1/service-worker.js
