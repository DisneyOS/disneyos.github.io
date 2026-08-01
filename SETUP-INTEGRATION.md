# DisneyOS integrated setup

Membership activation now continues to `/setup/`. The setup experience was copied from the `disneyos-setup` repository and retains its local progress state and shortcut links.

NFC flow:

1. `/activate/?card=...`
2. Membership password verification
3. Persistent device credential
4. `/setup/`
5. `/v1/` after setup completion
