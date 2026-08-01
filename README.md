# DisneyOS v2.0.1 Home Fixes

Upload these files to the repository root. This release fixes the Home park selector, Wait Times API endpoint, Magic show filtering, profile-to-settings navigation, and Home section order.


## 2.0.2
- Opaque park selector menu.
- DisneyOS Magic now uses Ride, See, Watch, or Meet based on experience type.


## 2.0.3
- Fixed park selector stacking so hero-card content cannot draw above the menu.
- Made the selector surface fully opaque.
- Made the DisneyOS logo link to the v1 home page.
- Bumped service-worker cache.


## 2.0.4
- Removed the visible box behind the Home hero park name.
- Preserved a large invisible tap target.
- Added subtle chevron rotation while the menu is open.
- Retained the DisneyOS logo Home link.

## DisneyOS Membership activation

The `/activate/` experience registers a device through the DisneyOS membership API. The reusable NFC URL format is:

`https://disos.app/activate/?card=<membership-card-code>`

A successful activation stores the device credential in browser local storage under `disneyos-member-device-token`. The `/v1/` launch flow redirects devices without a membership credential to `/activate/`.


## Automatic device revocation

The `/v1/` startup gate validates the locally stored device token against `GET /v1/membership/me` on every launch. Deleting or revoking a row in `member_devices` causes the next online launch to clear the stale browser credential and redirect to `/activate/`. Temporary network/API failures use the existing local session so DisneyOS remains usable during an outage.
