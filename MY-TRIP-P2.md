# My Trip P2

P2 is implemented locally in v1. It replaces the flat My Trip/Dining presentation with saved Trips, date sections and shared plan cards. Backend dependency: disneyos-api-dev with migration 0004_my_trip.sql applied BEFORE publishing these frontend assets.

New frontend modules are js/my-trip.mjs and js/trip-model.mjs; css/my-trip.css uses the existing theme. Service-worker cache is v3.6.0. The separate disneyos-dev frontend was intentionally not mirrored.

My Trip uses authenticated /v1/trips. It does not call Disney or acquire plans directly. Home links and external deep links use index.html?view=trip&trip=<id>&date=YYYY-MM-DD&plan=<planId>. My Trip never updates Home's park setting.

Normalized optional fields are rendered only when supplied: status/cancelled/used/completed, confirmationNumber, endDate, earlyEntry/extendedEveningHours, directionsUrl, cancellationDetails, and practicalWindow {startTime,endTime,unofficial,explanation} plus officialAllowance {description}. Published startTime/endTime remain unchanged. Current X1 acquisition drops several of these fields; see the implementation report for live limitations. No practical timing is hard-coded.

Full pre-edit investigation, acceptance evidence, P0/P1 coordination, limitations and rollout notes are at ../_project/p2-my-trip/INSPECTION.md and REPORT.md in the DisneyOS workspace. Screenshots and reproducible tests are alongside that report. This change has not been deployed.
