# Theme

A small CSS kit for interface chrome — panels, controls, markers, and the layout helpers around them.

Color lives in `palette/`. Visual treatment lives in `geometry/`. Shared structure and semantics live in `theme.css`. Icons and a few runtime helpers sit alongside.

Still early; the [live demo](https://macawkit.github.io/theme/) (source: [`demo.html`](demo.html)) is the best place to see what it can do.

## Install

```sh
npm install @macawkit/theme
# or
bun add @macawkit/theme
```

## Use

Pick one geometry and one palette, they are interchangeable. The palettes are `hyacinth`, dark, and `cream`, light:

```js
import '@macawkit/theme/theme.css';
import '@macawkit/theme/geometry/shell.css';
import '@macawkit/theme/palette/hyacinth.css';
import '@macawkit/theme/icon.css';
import '@macawkit/theme/general'; // tabs, comboboxes, sparks and meters behaviour, dialog buttons in older browsers
```

Without a bundler, link the built files:

```html
<link rel="stylesheet" href="node_modules/@macawkit/theme/dist/theme.css">
<link rel="stylesheet" href="node_modules/@macawkit/theme/dist/geometry/shell.css">
<link rel="stylesheet" href="node_modules/@macawkit/theme/dist/palette/hyacinth.css">
<link rel="stylesheet" href="node_modules/@macawkit/theme/dist/icon.css">
<script src="node_modules/@macawkit/theme/dist/general.js" defer></script>
```

`icon.css` embeds its icons as `data:` URIs, so a page with a strict Content-Security-Policy needs `img-src … data:`.

## Licenses

The code is MIT. The bundled fonts, Space Grotesk and JetBrains Mono, are under the SIL Open Font License, the texts are next to the font files.

## Develop

Sources are in `src/`, `demo.html` links them directly, so no build is needed to see a change.

```sh
npm run build          # dist/, unminified
npm run build:release  # dist/, minified
```
