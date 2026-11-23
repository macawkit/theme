# Theme

A small CSS kit for interface chrome: panels, controls, status markers, and page layout. Write semantic HTML and the kit styles it.

See every component in the [live demo](https://macawkit.github.io/theme/) ([`demo.html`](demo.html)). The kit is still early; details may change between minor versions.

## Install

```sh
npm install @macawkit/theme
# or
bun add @macawkit/theme
```

## Use

Load `theme.css`, one **geometry**, one **palette**, `icon.css`, and `general.js`:

```js
import '@macawkit/theme/theme.css';
import '@macawkit/theme/geometry/shell.css';
import '@macawkit/theme/palette/hyacinth.css';
import '@macawkit/theme/icon.css';
import '@macawkit/theme/general';
```

Or link the built files directly without a bundler:

```html
<link rel="stylesheet" href="node_modules/@macawkit/theme/dist/theme.css">
<link rel="stylesheet" href="node_modules/@macawkit/theme/dist/geometry/shell.css">
<link rel="stylesheet" href="node_modules/@macawkit/theme/dist/palette/hyacinth.css">
<link rel="stylesheet" href="node_modules/@macawkit/theme/dist/icon.css">
<script src="node_modules/@macawkit/theme/dist/general.js" defer></script>
```

- **`theme.css`** — shared structure and behavior across all geometries.
- **Geometry** — shape, typography, and motion: `shell` (sharp, chipped, console-lit) or `candy` (rounded, glossy, soft).
- **Palette** — colors: `hyacinth` and `mulberry` (dark), `cream` (light), and `sunset` (warm orange). Any geometry pairs with any palette.
- **`icon.css`** — required even if you don't use `<i class="icon i-…"></i>`; it also supplies checkbox ticks, option checkmarks, date/time/file pickers, and search icons. Icons use `data:` URIs, so a strict CSP needs `img-src data:`.
- **`general.js`** — powers tabs, comboboxes, sparklines, fallback meters, and a `commandfor` polyfill. See [Script](#script).

## Layout

### `.app`: sidebar and main content

```html
<div class="app">
    <aside>
        <strong>Studio</strong>
        <nav><ul><li><a href="/" aria-current="true">Home</a></li>…</ul></nav>
        <small>Pinned to the bottom</small>
    </aside>
    <main class="page">…</main>
</div>
```

- `aside` is the sidebar (width controlled by `--nav-width`). A `nav` inside it renders a vertical link list; `aria-current` marks the active link, and a trailing `<small>` inside a link aligns to the end as a count. The last non-`nav` child sits at the bottom.
- The sibling after `aside` is the main content area.
- A `<header>` before `aside` spans across both the sidebar and the main area as a top bar.
- Below `600px`, the sidebar stacks above the content and its nav links scroll horizontally.

### `.page`: independent pane scrolling

Adding `class="page"` to the main area locks `.app` to the viewport height so the sidebar and page scroll independently. The geometry's top backdrop (Shell's lit grid, Candy's sky) renders on `.page` and scrolls with its content. Without `.page`, the whole window scrolls and the backdrop renders on `body` (or on the main pane under an `.app > header` in Candy).

### `.center`: single-panel page

`<main class="center"><section class="panel">…</section></main>` centers a single dialog-width panel in the viewport—useful for sign-in, confirmation, or error pages.

### Layout utilities

| Class | Purpose |
|---|---|
| `.stack` | Vertical flex column, gap `--margin` |
| `.row` | Wrapping flex row, gap `--margin-tight` (`.row.between` pushes ends apart) |
| `.tiles` | Responsive equal-width grid, at least `--tile-width` per column and at most `--tiles-max` columns; `.wide` spans a full row |
| `.cols` | Non-wrapping equal-column grid for aligned figures; set `--rows` to stack into multiple rows |
| `.tight` | Uses `--margin-tight` gap on `.stack`, `.row`, or `.tiles` |
| `.scroll` | Horizontal scroll container for wide content, especially tables |

Gap-spaced containers (`.stack`, `.row`, `.tiles`, `.card`, `.alert`, `.empty`, `footer`, and `.app` panes) strip vertical margins from direct children; padded containers (`.panel`, `.well`, `dt`, `dd`) strip outer margins from first/last children. All resets use `:where()`, so custom margins always win.

## Components

### Surfaces

- **`.panel`** — primary surface. A `<header>` inside holds a title and actions, wrapping when tight.
- **Back link + heading (`.title`)** — wrap a back button and heading inside `.title` so the heading wraps beside the button while trailing header actions drop below:

  ```html
  <header>
      <div class="title">
          <a class="button ghost" href="/students" aria-label="Back to Students"><i class="icon i-chevron-left"></i></a>
          <h1>Ida Lind</h1>
      </div>
      <button class="alt">Edit</button>
  </header>
  ```

- **`.card`** — nested surface inside a panel. `a.card` is interactive.
- **`.card.compact`** — dense, color-tinted card (e.g. calendar events) controlled by `--color`: `<a class="card compact" href="…" style="--color: var(--color-category-3)">`. Add `.quiet` to mute completed/past items.
- **`.well`** — recessed container inside a panel.
- **`.alert`** — toned banner: `<div class="alert warning" role="status"><i class="icon i-warn"></i><div class="stack">…</div><button class="ghost small">…</button></div>`.
- **`.empty`** — empty-state layout: `<div class="well empty">` with an icon, `<strong>` headline, `<small>` note, and optional action button.
- **`dialog`** — styled like a panel, with `<footer>` actions aligned to the end.

### Buttons

- `button`, `<input type="submit|reset|button">`, or `.button` on `<a>` or `<label>`.
- Variants: `.alt` (secondary), `.ghost` (transparent until hovered), `.danger` (destructive), `.small` (compact height).
- **Toggles**: use `aria-pressed` on a `<button>`, or wrap a checkbox/radio in `<label class="button">` so it stays natively focusable and submits with forms.
- **Icon buttons**: icons receive equal horizontal and vertical inset, making icon-only buttons square: `<button class="alt" title="Retry"><i class="icon i-refresh"></i></button>`. Always provide `title` or `aria-label`.

### Navigation

- **`nav.tabs`** — horizontal link tabs (`aria-current="page"` on the active link). For in-page panel switching, see [Tabs](#tabs).
- **`nav.crumbs`** — breadcrumb trail, current page last.
- **`nav.pages`** — pagination links, either directly inside `<nav>` or inside a `<ul>`/`<ol>`. Mark the current page with `aria-current="page"`, previous/next links with `rel="prev"` / `rel="next"`, and any non-link item (such as `…`) as a gap:

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

  `rel="prev"` and `rel="next"` render as `.alt` buttons (square when icon-only). On the first/last page, omit the inactive link or render it without `href` using `role="link" aria-disabled="true"`. Add `.small` to match small button height, e.g. `<footer class="row between"><small>61–80 of 128</small><nav class="pages small">…</nav></footer>`.

### Markers, icons, and typography

- **Icons**: `<i class="icon i-mail"></i>` (see the demo for the full built-in set).
- **`.badge` / `.tag`**: compact inline labels (`.badge` adds a leading status dot). In tight layouts they degrade gracefully: a tag with an icon keeps the icon, a badge keeps its dot, and text truncates with `…`. Add `title` if the full label matters.
- **`.box`**: small square frame for a single icon or value (`<div class="box"><i class="icon i-user"></i></div>`); add `.active` to highlight it.
- **`.swatch`**: color indicator using `--color` (`<span class="swatch" aria-hidden="true" style="--color: var(--color-category-7)"></span>`). Modifiers: `.small`, `.quiet`.
- **`.hero`**, **`.label`**, **`.note`**: large KPI figure, accented small-caps label, and muted small-caps label.
- **`.num`**: end-aligned tabular numbers for table cells.
- **`dl`**: key/value grid that stacks keys above values below `600px` and wraps unbroken strings (hashes, addresses).

### Data visualizations

- **Meter**: `<div role="meter" aria-label="Storage" aria-valuenow="37" aria-valuemin="0" aria-valuemax="100"></div>` (`aria-valuemin` / `aria-valuemax` default to `0` and `100`). Browsers with typed CSS `attr()` update purely in CSS; others fall back to `general.js` (call `mtt.refresh()` after script updates).
- **Sparkline**: `<div class="spark" aria-label="Delivered, rising" data-values="40,45,44,55"></div>` renders proportional bars scaled to the highest value. Without `aria-label` or `aria-labelledby`, it is marked `aria-hidden="true"` so adjacent text carries the meaning.
- **Share bar**: `<div class="share"><i class="success" style="--value: 23"></i><i class="warning" style="--value: 37"></i></div>` splits a bar into proportional segments.

### Tones and category colors

`.info`, `.signature`, `.success`, `.priority`, `.warning`, and `.danger` apply a semantic tone to text and nested badges, tags, alerts, meters, sparks, and ghost buttons.

Each palette also defines 16 non-semantic category colors (`--color-category-1` through `--color-category-16`) for distinguishing items. Every palette color has a matching human-readable `-name` string token (e.g. `--color-category-3-name: "Hot pink"` in Hyacinth, `"Peony"` in Cream), usable via `content: var(--color-category-3-name)` in CSS or inside `.swatches` pickers without JS resolution.

## Forms

Use plain `input`, `select`, and `textarea` elements inside `<label>`, with label text before the control and an optional `<small>` hint after it. A `<fieldset>` lays out its labels in a vertical grid with `<legend>` as the heading. `:user-invalid` or `aria-invalid="true"` styles the field as invalid and turns its `<small>` hint to the danger tone. `<input type="checkbox" class="switch">` renders a toggle switch; `<input type="color">`, `<input type="range">`, and `<input type="file">` are styled natively (standalone `<input type="color">` collapses to a compact square/circle swatch).

### Combobox

Pair an `<input role="combobox">` with a `[role="listbox"][popover]` linked by `aria-controls`. Every `[role="option"]` requires an `id`.

```html
<label>
    Time zone
    <input role="combobox" aria-controls="zones" aria-expanded="false" autocomplete="off">
    <input type="hidden" name="zone">
</label>
<ul role="listbox" id="zones" aria-label="Time zone" popover data-empty="No matches">
    <li role="presentation">Europe</li>
    <li role="option" id="tz-berlin" data-value="Europe/Berlin" data-find="cet">Berlin</li>
    …
</ul>
```

- **Free text**: typing filters options and highlights matches. Without a trailing `<input type="hidden">`, the input submits its own text (custom values allowed).
- **Dropdown**: add `inputmode="none"` to make it click/keyboard-only while keeping native `required` validation.
- **Single choice**: a trailing `<input type="hidden">` restricts selection to listed options; the hidden input submits `data-value` while the visible field displays `data-label` (or text content). An option with `data-value=""` acts as the empty/reset option (e.g. "All students").
- **Multi-select**: add `aria-multiselectable="true"` on the listbox and place a `<input type="checkbox">` inside each option. The list stays open while toggling, checkboxes submit the form values, and the field shows a comma-separated summary.
- **Rich options & leading markers**: options can contain custom HTML—such as `<span class="swatch" aria-hidden="true" style="--color: var(--color-category-3)"></span>`, `<i class="icon i-…"></i>`, `<svg>`, `<img>`, or trailing `<small>` hints. In single-choice comboboxes and dropdowns (except `type="search"`), a leading `.swatch`, `i.icon`, `svg`, or `img` on the chosen option is automatically mirrored inside the closed field, making it easy to build palette color pickers, icon dropdowns, or avatar selectors without custom controls.
- **Helpers**: `data-find` adds extra search terms, `data-empty` sets the empty-state message, `data-clear` (or `data-clear="Clear …"` for a custom `aria-label`) adds an inline clear button whenever a value is present, and `role="presentation"` renders sticky group headings.
- **Events**: `change` fires only when the value actually changes (matching `<select>`). To select an option programmatically, call `option.click()`.

### Swatch picker

Use `.swatches` with native `<input type="radio">` elements to pick from CSS palette colors—either **inline** (zero JS) or inside a **popover** paired with `button.picker`:

```html
<!-- Inline -->
<div class="swatches" role="radiogroup" aria-label="Student color">
    <input type="radio" name="color" value="" aria-label="None">
    <input type="radio" name="color" value="1" style="--color: var(--color-category-1); --name: var(--color-category-1-name)">
    <input type="radio" name="color" value="3" style="--color: var(--color-category-3); --name: var(--color-category-3-name)" checked>
</div>

<!-- Popover dropdown reusing the exact same .swatches -->
<label>
    Student color
    <button type="button" class="picker" popovertarget="student-colors" data-clear>None</button>
</label>
<div class="swatches" id="student-colors" role="radiogroup" aria-label="Student color" popover>
    <input type="radio" name="color" value="1" style="--color: var(--color-category-1); --name: var(--color-category-1-name)">
    <input type="radio" name="color" value="3" style="--color: var(--color-category-3); --name: var(--color-category-3-name)" checked>
</div>
```

- **Pure CSS color & name**: `--color` paints the swatch and `--name` renders the palette-dependent name via CSS `content: var(--name)`—no CSS resolution in JS, so palette switches update immediately. Omit `--color` (e.g. `value=""`) for a "None" swatch; omit `--name` for swatch-only or `data-label`/`aria-label` text.
- **Clear button**: add `data-clear` (or `data-clear="Clear color"`) on `button.picker` inside `<label>` to show an inline `×` button whenever a color is selected, so the popover stays a clean 2×8 grid of 16 colors without needing a "None" swatch.
- **Native form control**: preselection (`checked`), `required` validation, `disabled`, form submission, `form.reset()`, and arrow-key navigation work natively on the radio inputs.
- **Standalone trigger**: outside `<label>`, `button.picker` collapses to a compact square/circle swatch trigger (supports `.small`).
- **Grid sizing**: `.swatches` wraps at `--swatch-columns` (`8` by default) in popovers; add `.small` for compact swatches.

### Dialogs

Use `<button commandfor="edit" command="show-modal">` and `command="close"` to control `<dialog id="edit">` without custom JS (`general.js` polyfills browsers without `commandfor`). Wrap dialog contents in `<form method="dialog">` with a `<footer>` for actions; on tall dialogs, the body scrolls while the footer stays pinned.

Add `data-open` to open a dialog as a modal on page load (for example, server-rendered form errors). On close, focus returns to an external button targeting that dialog via `commandfor`.

### Tabs

```html
<div role="tablist" aria-label="Queue">
    <button type="button" role="tab" id="t-all" aria-controls="p-all" aria-selected="true">All</button>
    <button type="button" role="tab" id="t-hold" aria-controls="p-hold" aria-selected="false">Hold</button>
</div>
<div id="p-all" role="tabpanel" aria-labelledby="t-all">…</div>
<div id="p-hold" role="tabpanel" aria-labelledby="t-hold" hidden>…</div>
```

Clicking or using Arrow keys, Home, and End switches tabs (skipping disabled tabs) and toggles their linked panels. Overflowing tab rows scroll horizontally and keep the active tab in view. Add `.small` to shorten the bar.

## Responsive behavior

- Most components adapt to their container: headers wrap, tab bars scroll horizontally, and headings break long words.
- Wrap wide tables in `.scroll`. Tables inside `.scroll` enforce a minimum width of `--table-min-width` (`450px` by default).
- The kit uses one viewport breakpoint (`600px`): below it, `dl` stacks vertically, `.app`'s sidebar moves above the content, and spacing tightens.
- On coarse pointers (touch), controls grow taller—use `--element-height` and `--element-height-small` instead of hardcoded pixels so custom elements follow.
- Focus rings and glows extend `--overhang` beyond an element's box. Custom clipping/scrolling containers should add at least `--overhang` padding to avoid clipping them.

## Script

`general.js` uses document-level event delegation, so dynamically added tabs, comboboxes, and dialog triggers work automatically. Elements that require initialization—sparks, fallback meters, range fills, `data-open` dialogs, new tablists, and scripted combobox changes—are initialized on load. After inserting or updating those dynamically, call `mtt.refresh()` (or `mtt.refresh(element)` to scope it to a subtree).

## Licenses

Code is MIT. Bundled fonts (Space Grotesk, Nunito, JetBrains Mono) are licensed under the SIL Open Font License; license files sit alongside the fonts.

## Develop

Sources live in `src/`. `demo.html` links them directly for live editing without a build step.

```sh
npm run build          # dist/, unminified
npm run build:release  # dist/, minified
```
