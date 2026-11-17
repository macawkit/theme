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

## Pages and parts

- `.app` is a page with a navigation column: `<div class="app"><aside>…</aside><main>…</main></div>`. The `aside` is the column on the start side, a `nav` in it is drawn as the kit's navigation list, and the last thing in it, a note, sits at its bottom. The page is whatever follows the `aside`, a column of its parts. Anything else in `.app`, a dialog or a script, is left alone. Set `--nav-width` for a wider column.
- `.center` is a page of one thing, a sign-in, a confirmation or an error: `<main class="center"><section class="panel">…</section></main>`. It fills the window and holds what is in it in the middle, a panel as wide as a dialog.
- `.empty` says that there is nothing here yet: `<div class="well empty">` with an icon, a `strong` line, a `small` note and a button if there is a way to start.
- `.num` on a table cell sets a number to the end, every figure as wide as any other, so a column of them lines up.
- `.spark` draws its `data-values` as bars. Give it an `aria-label` that says what it shows, "Delivered, rising" say, and a screen reader reads it as one picture by that name. Without one it is skipped as decoration, so the figure next to it has to say it all.
- `.stack`, `.card`, `.row`, `.tiles`, `.empty`, `.alert`, a `footer` and the parts of `.app` space what they hold by their gap, and the margins of what sits right in them, a paragraph, a list or a header, are dropped. `.panel`, `.well` and the cells of a `dl` space by their padding, so only the first and the last lose their outer margin. Something between, a `form` say, brings its own margins back. A list in text is set in by `--margin`, a numbered one by twice that. All of it weighs nothing, a margin of your own wins.
- A badge or a tag is as wide as its word wherever it is, and sits in the middle of a line or a heading. A value in a `dl` wraps anywhere when it has no spaces, an address or a hash.

## Small screens

The kit makes its parts hold up at any width. Arranging the page is up to the page.

- Most parts adjust to the box they are in, not to the screen. Headers wrap, so whatever follows the title goes under it when there is no room. A row of tabs stays on one line and scrolls sideways.
- Put anything wide, a table most of all, in a `.scroll`. It scrolls sideways inside its box instead of widening the page. A table in it never gets narrower than `--table-min-width` (three columns by default), set it higher on a table with many columns.
- `.tiles` is for a group of equal things that should reflow, it fits as many as there is room for. `.cols` is a fixed row, of figures say, it never wraps.
- The kit asks about the screen's width once: below `600px` a key of a `dl` sits over its value, the navigation column of `.app` goes over the page as a row, its links scrolling sideways like tabs, and the geometry spaces things a little closer. A page that rearranges itself for phones can use the same width to change in step.
- On a touch screen the geometry makes controls taller. Size things by `--element-height` and `--element-height-small` rather than by a number, so they follow.
- A focus ring or a glow can reach past its element by `--overhang`. A box of your own that clips what it holds, scrolling or `overflow: hidden`, leaves that much room around it. `.scroll` and the tabs already do: a `.scroll` above and below, its table has room in its cells, a row of tabs all around, reaching out of its box by `--overhang`, so it sits in one with at least that much padding, as every box of the kit has.

## Licenses

The code is MIT. The bundled fonts, Space Grotesk and JetBrains Mono, are under the SIL Open Font License, the texts are next to the font files.

## Develop

Sources are in `src/`, `demo.html` links them directly, so no build is needed to see a change.

```sh
npm run build          # dist/, unminified
npm run build:release  # dist/, minified
```
