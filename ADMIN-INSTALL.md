# DisneyOS Admin Console Installation

This repository includes the new `/admin/` interface and membership details in Settings.

## Required Worker update

The website must be paired with `ADMIN-WORKER-REPLACEMENT.js`.

1. Open Cloudflare → Workers & Pages → `disneyos-api-dev` → Edit Code.
2. Replace the single Worker file with the complete contents of `ADMIN-WORKER-REPLACEMENT.js`.
3. Deploy.
4. Upload the website repository contents to `disneyos.github.io`.
5. Open `https://disos.app/v1/`, then Settings.
6. Confirm the Membership section displays your member ID and Active status.
7. On an admin device, open `https://disos.app/admin/`.

## Admin Console v1 capabilities

- Lists members.
- Shows active membership cards.
- Shows trusted devices and last-seen time.
- Revokes a device remotely.
- Enables or disables a member.
- Enables or disables a membership card.
- Prevents the current admin device from revoking itself.
- Prevents the current administrator from disabling their own account.

A revoked device is redirected to membership activation the next time DisneyOS validates its token.
