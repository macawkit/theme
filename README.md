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

Pick one geometry and one palette, they are interchangeable. The geometries are `shell`, sharp, chipped and lit like a console, and `candy`, round, glossy and soft. The palettes are `hyacinth` and `mulberry`, dark, `cream`, light, and `sunset`, a warm orange middle between them:

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

Every color of a palette has a name of its own next to it, the same token with `-name` at the end, `--mtt-color-main-name: "Hyacinth"`. It is a string, for a picker or a legend: `content: var(--color-category-3-name)` in CSS, or `getComputedStyle(document.documentElement).getPropertyValue('--color-category-3-name')` in a script.

`icon.css` is not optional: besides the `i.icon` set, it puts the marks on the controls, the tick of a checkbox, the check of the chosen option, the pickers of a date or a time field and the magnifier of a search field. The geometry only sizes and colors them. It embeds its icons as `data:` URIs, so a page with a strict Content-Security-Policy needs `img-src … data:`.

`general.js` draws the sparks, fills the meters where CSS can not, brings a chosen tab into sight, tells its row where it is so Candy can throw its candy from tab to tab, and opens a `dialog` marked `data-open` as a modal once, when the page loads. A page that adds them later or changes them, or checks the options of a combobox of many by script, calls `mtt.refresh()`, or `mtt.refresh(element)` to look only inside that element. Tabs, comboboxes and dialog buttons need nothing, they are listened to on the whole document.

`data-open` is for a dialog the server sends back, the form in it turned down with what was typed and why: `<dialog id="edit" data-open>`. Opened that way there is nothing to give the focus back to, so when it closes the focus goes to a button outside it with `commandfor="edit"`, the one that would have opened it.

In a choice, a combobox with a hidden input, an option with `data-value=""` names the choice of nothing, "All students" in a filter: the field holds it while the hidden input is empty, and goes back to it when emptied. A combobox fires `change` only when its value is another, as a `select` does.

## Pages and parts

- `.app` is a page with a navigation column: `<div class="app"><aside>…</aside><main>…</main></div>`. The `aside` is the column on the start side, a `nav` in it is drawn as the kit's navigation list, and the last thing in it, a note, sits at its bottom. The page is whatever follows the `aside`, a column of its parts. Anything else in `.app`, a dialog or a script, is left alone. Set `--nav-width` for a wider column. A `header` before the `aside` is a bar over the column and the page.
- `.page` is a box that scrolls in place of the window, the page of an `.app` held to the height of the screen: `<main class="page">`. The geometry draws the top of the page, the lit grid or the sky, on it instead of on the body, so it scrolls with what is on it. Without one it is on the body, never taller than the window.
- `.center` is a page of one thing, a sign-in, a confirmation or an error: `<main class="center"><section class="panel">…</section></main>`. It fills the window and holds what is in it in the middle, a panel as wide as a dialog.
- `.empty` says that there is nothing here yet: `<div class="well empty">` with an icon, a `strong` line, a `small` note and a button if there is a way to start.
- `.num` on a table cell sets a number to the end, every figure as wide as any other, so a column of them lines up.
- A meter is a `div` with `role="meter"` and its `aria-valuenow`, between `aria-valuemin` and `aria-valuemax`, 0 and 100 when they are not given, and an `aria-label` that says what it measures. A browser that reads attributes in CSS fills it with no script, and follows a change of `aria-valuenow` by itself. For the others `general.js` fills it.
- `.spark` draws its `data-values` as bars. Give it an `aria-label` that says what it shows, "Delivered, rising" say, and a screen reader reads it as one picture by that name. Without one it is skipped as decoration, so the figure next to it has to say it all.
- `.stack`, `.card`, `.row`, `.tiles`, `.empty`, `.alert`, a `footer` and the parts of `.app` space what they hold by their gap, and the margins of what sits right in them, a paragraph, a list or a header, are dropped. `.panel`, `.well` and the cells of a `dl` space by their padding, so only the first and the last lose their outer margin. Something between, a `form` say, brings its own margins back. A list in text is set in by `--margin`, a numbered one by twice that. All of it weighs nothing, a margin of your own wins.
- `.swatch` shows one color, `--color`, a category's most of all: `<span class="swatch" aria-hidden="true" style="--color: var(--color-category-7)"></span>` beside the name of what wears it. It is decoration, the name says it all. It is drawn and lit as the geometry draws a fill. `.small` is for a dense spot, a width and a height of your own work too, and `.quiet` is for a thing that is over, faint and unlit.
- `.card.compact` is a card for a dense spot, one of many in a cell of a grid: `<a class="card compact" href="…" style="--color: var(--color-category-3)">`. It is tight and wears `--color` as a swatch does, a wash of it as its ground and the color itself along its start, drawn by the geometry, and the text on it stays the palette's own, small text too, the muted ink is too faint for a wash. A link, its wash deepens and its rim takes the color under the pointer, the focus ring runs inside it, and given a height it fills it. `.quiet` is for a thing that is over. It is not `.small`, that one is small text.
- An icon in a button or a tab, an `i.icon`, an `svg` or an `img`, has as much room at its sides as above and below it, so a button of only an icon is square: `<button class="alt" title="Retry"><i class="icon i-refresh"></i></button>`. The `title` or an `aria-label` is its name. Next to a word the icon keeps the usual gap. Two icons side by side with no word between them come out close together.
- `nav.pages` is the pagination of a long list, written as it would be with no kit: a link for each page, `aria-current="page"` on the one shown, and `rel="prev"` and `rel="next"` on the way back and the way on, straight in the `nav` or in a list, an item for each:

  ```html
  <nav class="pages" aria-label="Pages">
      <ul>
          <li><a href="?page=3" rel="prev">Previous</a></li>
          <li><a href="?page=1">1</a></li>
          <li>…</li>
          <li><a href="?page=4" aria-current="page">4</a></li>
          <li><a href="?page=5" rel="next">Next</a></li>
      </ul>
  </nav>
  ```

  The kit draws the pages as tabs, the one shown with a glow bar under it in Shell and as the candy in a groove in Candy, and the way back and on as alt buttons beside them. With a word they are buttons of a word, with only an icon, `<i class="icon i-chevron-left"></i>`, and a `title` or an `aria-label`, they are square. What is not a link, "…", is the gap of the pages left out. On the first page the way back is left out, or, to keep the row from shifting, kept with no `href` and with `role="link"` and `aria-disabled="true"`, and so is the way on from the last. It wraps when it does not fit, keeping the run short is up to the server, and where it stands is up to the page: `<footer class="row between">` under a table, with how many there are, "61–80 of 128", in a `small` before it. `.small` makes it as tall as a small element.
- `.box` is a square as tall as a small element for one glyph or one value, `<div class="box"><i class="icon i-user"></i></div>`, and a wider value widens it. `.active` lights it.
- A badge or a tag is as wide as its word wherever it is, and sits in the middle of a line or a heading. With no room for its word, in a cell of a month say, it gets narrower: one with an icon before its word, `<span class="tag"><i class="icon i-user"></i>Ann</span>`, keeps the icon and drops the word, a badge keeps its light. A word in a `span` of its own with nothing before it is cut short with "…" instead, so give the marker a `title` when the word matters. A value in a `dl` wraps anywhere when it has no spaces, an address or a hash.

## Small screens

The kit makes its parts hold up at any width. Arranging the page is up to the page.

- Most parts adjust to the box they are in, not to the screen. Headers wrap, so whatever follows the title goes under it when there is no room. A row of tabs stays on one line and scrolls sideways.
- Put anything wide, a table most of all, in a `.scroll`. It scrolls sideways inside its box instead of widening the page. A table in it never gets narrower than `--table-min-width` (three columns by default), set it higher on a table with many columns.
- `.tiles` is for a group of equal things that should reflow, it fits as many as there is room for. `.cols` is a fixed row, of figures say, it never wraps.
- The kit asks about the screen's width once: below `600px` a key of a `dl` sits over its value, the navigation column of `.app` goes over the page as a row, its links scrolling sideways like tabs, and the geometry spaces things a little closer. A page that rearranges itself for phones can use the same width to change in step.
- On a touch screen the geometry makes controls taller. Size things by `--element-height` and `--element-height-small` rather than by a number, so they follow.
- A focus ring or a glow can reach past its element by `--overhang`. A box of your own that clips what it holds, scrolling or `overflow: hidden`, leaves that much room around it. `.scroll` and the tabs already do: a `.scroll` above and below, its table has room in its cells, a row of tabs all around, reaching out of its box by `--overhang`, so it sits in one with at least that much padding, as every box of the kit has.

## Licenses

The code is MIT. The bundled fonts, Space Grotesk, Nunito and JetBrains Mono, are under the SIL Open Font License, the texts are next to the font files.

## Develop

Sources are in `src/`, `demo.html` links them directly, so no build is needed to see a change.

```sh
npm run build          # dist/, unminified
npm run build:release  # dist/, minified
```
