# SWR_SoloVariant
Solo variant instructions for Star War Rebellion

Public link - https://oz10.github.io/SWR_SoloVariant/

WIP

## Development

The app is a static site (`index.html`, `resources/`) served by GitHub Pages; there is no build step for the page itself. Node.js is only needed for the stylesheet and the tests.

```
npm install          # once
npm run css          # rebuild resources/css/index.css from resources/scss/
npm test             # run all browser tests (Edge on Windows, Chrome elsewhere)
```

- **Tests** live in `tests/`. They serve the site locally and drive a headless browser through the app. Screenshots are saved to `tests/output/`. They also run on GitHub Actions on every push.
- **Visual checks:** `npm run snap -- before`, make a change, `npm run snap -- after`, then `npm run diff -- before after` lists how much each view changed (screenshots in `tests/output/screens/`).
- **Offline support:** when adding or removing a file the app loads, update `PRECACHE_URLS` in `service-worker.js` and bump `CACHE_VERSION`. `npm test` fails if a file the page loads isn't cached.
- **Colours / dark mode:** the app's colours are CSS variables with light and dark values in `resources/scss/partials/_theme.scss`. Use those variables (not fixed colours) in new styles so both themes work. `npm run snap` captures every view in both themes.
- **Sass** needs Dart Sass (Bootstrap 5.3 doesn't build with older compilers); `npm run css` uses the right version.
