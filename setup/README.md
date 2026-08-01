# DisneyOS Setup

Upload these files to the root of the `disneyos-setup` GitHub repository and enable GitHub Pages.

## Files

- `index.html` — site shell
- `theme.css` — design tokens
- `styles.css` — layout and components
- `config.js` — versions, URLs, shortcut links, and release notes
- `app.js` — installer flow and local progress
- `assets/` — DisneyOS logo and icons

Update `config.js` when links, versions, or release notes change.

## Branding

This release uses the approved DisneyOS blue-to-cyan gradient branding:
- `disneyos-logo-transparent.png` for the installer hero
- `disneyos-mark.png` for compact branding
- approved Apple touch, manifest, favicon, and social-preview assets

## Navigation

Every setup page after Welcome includes an iPhone-style circular back button. Progress and completed checklist states remain stored in localStorage when navigating backward.
