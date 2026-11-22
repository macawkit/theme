# Theme

A small CSS kit for interface chrome: panels, controls, markers, and the layout around them. You write plain semantic HTML, and the kit styles it.

The [live demo](https://macawkit.github.io/theme/) shows every part, its source is [`demo.html`](demo.html). The kit is still early, things may change between minor versions.

## Install

```sh
npm install @macawkit/theme
# or
bun add @macawkit/theme
```

## Use

A page takes `theme.css`, one geometry, one palette, `icon.css` and `general.js`:

```js
import '@macawkit/theme/theme.css';
import '@macawkit/theme/geometry/shell.css';
import '@macawkit/theme/palette/hyacinth.css';
import '@macawkit/theme/icon.css';
import '@macawkit/theme/general';
```

Without a bundler, link the built files:

```html
<link rel="stylesheet" href="node_modules/@macawkit/theme/dist/theme.css">
<link rel="stylesheet" href="node_modules/@macawkit/theme/dist/geometry/shell.css">
<link rel="stylesheet" href="node_modules/@macawkit/theme/dist/palette/hyacinth.css">
<link rel="stylesheet" href="node_modules/@macawkit/theme/dist/icon.css">
<script src="node_modules/@macawkit/theme/dist/general.js" defer></script>
```

- `theme.css` is the structure every geometry shares.
- A **geometry** is the shape of things: `shell`, sharp, chipped and lit like a console, or `candy`, round, glossy and soft.
- A **palette** is the colors: `hyacinth` and `mulberry` are dark, `cream` is light, `sunset` is a warm orange between them. Any geometry works with any palette.
- `icon.css` is required, not only for `i.icon`: it draws the tick of a checkbox, the check of a chosen option, the pickers of date and time fields and the magnifier of a search field. Its icons are `data:` URIs, so a strict Content-Security-Policy needs `img-src data:`.
- `general.js` runs tabs, comboboxes, sparks and meters, and adds `commandfor` to browsers that lack it. See [Script](#script).

## Layout

### `.app`: a page with a navigation column

```html
<div class="app">
    <aside>
        <strong>Studio</strong>
        <nav><ul><li><a href="/" aria-current="true">Home</a></li>…</ul></nav>
        <small>Last thing: sits at the bottom</small>
    </aside>
    <main class="page">…</main>
</div>
```

- The `aside` is the column on the start side. A `nav` in it is a navigation list, `aria-current` marks the current link, and a `small` in a link is a count beside it. The last thing in the column sits at its bottom.
- The element after the `aside` is the page.
- `--nav-width` sets the width of the column.
- A `header` before the `aside` is a bar over the column and the page.
- Below 600px the column goes above the page as a row, and its links scroll sideways like tabs.

### `.page`: the page scrolls, not the window

With `class="page"` on the page of an `.app`, the `.app` is held to the height of the screen and only the page scrolls. The column stays in place, and scrolls on its own if it is taller than the screen. The geometry draws the top of the page (Shell's lit grid, Candy's sky) on the `.page`, so it scrolls with the content. Without a `.page` the whole window scrolls and the top is drawn on the body (in Candy under a bar, on the page).

### `.center`: a page of one thing

`<main class="center"><section class="panel">…</section></main>` fills the window and centres one panel, as wide as a dialog. Use it for a sign-in, a confirmation or an error.

### Boxes

| Class | What it does |
|---|---|
| `.stack` | a column, spaced by `--margin` |
| `.row` | a row that wraps, spaced by `--margin-tight`. `.row.between` pushes its ends apart |
| `.tiles` | a grid of equal tiles at least `--tile-width` wide, as many as fit, at most `--tiles-max`. With fewer tiles than columns they share the row. A `.wide` tile takes a whole row |
| `.cols` | a row of equal columns that never wraps, for a line of figures. `--rows` stacks it into rows |
| `.tight` | a `.stack`, `.row` or `.tiles` with the tight gap |
| `.scroll` | scrolls sideways inside its box, for anything wide, a table most of all |

`.stack`, `.row`, `.tiles`, `.card`, `.alert`, `.empty`, `footer` and the parts of `.app` space their children by their gap, so the children lose their own top and bottom margins. `.panel`, `.well` and the cells of a `dl` space by their padding, so only their first and last children lose the outer margin. These rules have no specificity, so a margin you set yourself always wins.

## Parts

### Surfaces

- `.panel` is the main surface. A `header` in it holds the title and anything after it, and wraps when there is no room.
- A page below a list leads back to it with a link before its title. Wrap the link and the heading in a `.title`, so the heading wraps beside the link and the rest of the header goes below when the line is full:

  ```html
  <header>
      <div class="title">
          <a class="button ghost" href="/students" aria-label="Back to Students"><i class="icon i-chevron-left"></i></a>
          <h1>Ida Lind</h1>
      </div>
      <button class="alt">Edit</button>
  </header>
  ```
- `.card` is a smaller surface inside a panel. `a.card` is a card you can click.
- `.card.compact` is a tight card for a dense spot, a cell of a calendar say. It is tinted with `--color`: `<a class="card compact" href="…" style="--color: var(--color-category-3)">`. `.quiet` fades it, for something that is over.
- `.well` is a sunken area inside a panel.
- `.alert` is a message in a tone: `<div class="alert warning" role="status"><i class="icon i-warn"></i><div class="stack">…</div><button class="ghost small">…</button></div>`.
- `.empty` says there is nothing here yet: `<div class="well empty">` with an icon, a `strong` line, a `small` note and a button if there is a way to start.
- A `dialog` is drawn as a panel. A `footer` puts its buttons at the end.

### Buttons

- `button`, or `.button` on a link or a label.
- `.alt` is the secondary style, `.ghost` has no body until hovered, `.danger` is for a destructive action, `.small` is shorter.
- A toggle is a button with `aria-pressed`, or a `label.button` around a checkbox or a radio, which keeps the input focusable and part of the form.
- An icon in a button gets as much room at its sides as above and below it, so a button with only an icon is square: `<button class="alt" title="Retry"><i class="icon i-refresh"></i></button>`. Give it a `title` or an `aria-label`.

### Navigation

- `nav.tabs` is a row of links, `aria-current="page"` on the current one. For tabs that switch panels in place, see [Tabs](#tabs).
- `nav.crumbs` is a breadcrumb trail, the current page last.
- `nav.pages` is pagination. Each page is a link, `aria-current="page"` marks the one shown, and `rel="prev"` and `rel="next"` mark the links back and forward. Anything that is not a link, such as "…", is a gap. The links can sit straight in the `nav` or in a list:

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

  The back and forward links are drawn as `.alt` buttons. With only an icon (`<i class="icon i-chevron-left"></i>`) and a `title`, they are square. On the first page, leave out the back link, or keep it in place without `href` and with `role="link" aria-disabled="true"`; the same goes for the forward link on the last page. The row wraps if it does not fit, so keep the run of pages short on the server. `.small` makes it as tall as a small button. Under a table: `<footer class="row between"><small>61–80 of 128</small><nav class="pages small">…</nav></footer>`.

### Markers and figures

- `.badge` (with a dot of light) and `.tag` are short labels. They are only as wide as their word, and in a narrow spot they shrink: a tag with an icon keeps the icon and drops the word, a badge keeps its dot, a word alone is cut with "…". Give them a `title` if the word matters.
- `.box` is a small square for one glyph or value, `<div class="box"><i class="icon i-user"></i></div>`. `.active` lights it.
- `.swatch` shows one color, `--color`: `<span class="swatch" aria-hidden="true" style="--color: var(--color-category-7)"></span>` next to the name of what wears it. `.small` makes it tiny, `.quiet` fades it.
- `.hero` is a big figure, `.label` a small caps label in the decorated color, `.note` a small caps label in the muted color. A label over a figure: `<div class="stack tight"><span class="note">Mailboxes</span><strong class="hero">42</strong></div>`.
- `.num` on a table cell aligns a number to the end, with every digit the same width.
- A `dl` is a grid of keys and values. Below 600px each key sits over its value. A value with no spaces, such as an address or a hash, wraps anywhere.

### Data

- **Meter:** `<div role="meter" aria-label="Storage" aria-valuenow="37" aria-valuemin="0" aria-valuemax="100"></div>`. Min and max default to 0 and 100. Browsers that support typed `attr()` fill it with CSS alone and follow changes to `aria-valuenow`. In the others, `general.js` fills it; call `mtt.refresh()` after a change.
- **Spark:** `<div class="spark" aria-label="Delivered, rising" data-values="40,45,44,55"></div>` draws the values as bars, the highest one full. The `aria-label` is what a screen reader reads; without one the spark is hidden from screen readers, so the text next to it has to say it all.
- **Share:** `<div class="share"><i class="success" style="--value: 23"></i><i class="warning" style="--value: 37"></i></div>` is a bar split into parts by their `--value`.

### Tones and colors

`.info`, `.signature`, `.success`, `.priority`, `.warning` and `.danger` give an element and everything in it a tone: its text, and the color of a badge, tag, alert, meter, spark or ghost button inside.

A palette has 16 category colors, `--color-category-1` to `--color-category-16`, to tell things apart (whose a row is, say), not to show state. Every palette color has its name next to it as a string, the same token with `-name` at the end, `--color-category-3-name: "Peony"` in Hyacinth. Use it in a picker or a legend: `content: var(--color-category-3-name)` in CSS, or `getComputedStyle(document.documentElement).getPropertyValue('--color-category-3-name')` in a script.

## Forms

Fields are plain `input`, `select` and `textarea`, usually inside a `label` with the label text before the field and a `small` hint after it. A `fieldset` lays its labels out in a column, and its `legend` is the group's title. `:user-invalid` or `aria-invalid="true"` marks a field as wrong, and its hint takes the danger color. `<input type="checkbox" class="switch">` is a switch.

### Combobox

An `input` with `role="combobox"` and a `[role=listbox][popover]` list, linked by `aria-controls`. Each option needs an `id`.

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

- **Typed:** what you type filters the options and highlights the match. Without the hidden input, the field posts its own text, so a value that is not in the list is allowed.
- **Dropdown:** `inputmode="none"` makes it a dropdown you click instead of typing into. It stays a real input, so `required` works.
- **Choice:** a hidden input right after the field limits it to the options. The hidden input posts the option's `data-value`, and the field shows its `data-label` or its text. Typing only searches. An option with `data-value=""` stands for "nothing" (such as "All students" in a filter); the field shows it while the value is empty.
- **Choice of many:** `aria-multiselectable="true"` on the list, and a checkbox in each option, which is what the form posts. The list stays open while you pick, and the field shows the checked labels.
- `data-find` adds search terms to an option, `data-empty` is the text when nothing matches, and a `role="presentation"` item is a caption over the options after it.
- A combobox fires `change` only when its value changes, as a `select` does. To choose an option from a script, call `option.click()`.

### Dialogs

`<button commandfor="edit" command="show-modal">` opens `<dialog id="edit">` as a modal, and `command="close"` closes it, with no script. `general.js` adds this to browsers that do not support it yet. Put the dialog's content in a `<form method="dialog">` with a `footer` for the buttons. In a dialog taller than the window, the content scrolls and the footer stays at the bottom.

`<dialog id="edit" data-open>` opens as a modal when the page loads. Use it for a form the server sends back with errors. When it closes, the focus goes to a button outside it with `commandfor="edit"`.

### Tabs

```html
<div role="tablist" aria-label="Queue">
    <button type="button" role="tab" id="t-all" aria-controls="p-all" aria-selected="true">All</button>
    <button type="button" role="tab" id="t-hold" aria-controls="p-hold" aria-selected="false">Hold</button>
</div>
<div id="p-all" role="tabpanel" aria-labelledby="t-all">…</div>
<div id="p-hold" role="tabpanel" aria-labelledby="t-hold" hidden>…</div>
```

A click or the arrow keys, Home and End choose a tab and show its panel. A row that does not fit scrolls sideways, and the chosen tab is scrolled into view. `.small` on the row makes it shorter.

## Small screens

The kit keeps its parts usable at any width. Arranging the page is up to you.

- Most parts adapt to their box, not to the screen. Headers wrap, rows of tabs scroll sideways, and a heading breaks a word too long for its line.
- Put anything wide in a `.scroll`, a table most of all. A table in it is never narrower than `--table-min-width`, which is 450px by default; raise it for a table with many columns.
- The kit uses one breakpoint, 600px. Below it a `dl` puts each key over its value, the column of `.app` goes above the page, and spacing gets a little tighter. Use the same width if your page rearranges itself for phones.
- On touch screens the geometry makes controls taller. Size things with `--element-height` and `--element-height-small` instead of fixed numbers, so they follow.
- Focus rings and glows reach `--overhang` past their element. A box of your own that clips (scrolling, `overflow: hidden`) needs at least that much padding, or they are cut off. The kit's own boxes already have it.

## Script

`general.js` listens on the whole document, so tabs, comboboxes and dialog buttons added later work without any call. Sparks, meters, `data-open` dialogs, new rows of tabs and checkboxes changed by script in a choice of many are handled when the page loads. After you add or change those, call `mtt.refresh()`, or `mtt.refresh(element)` to handle only that element and what is inside it.

## Licenses

The code is MIT. The bundled fonts, Space Grotesk, Nunito and JetBrains Mono, are under the SIL Open Font License; their license texts are next to the font files.

## Develop

Sources are in `src/`. `demo.html` links them directly, so you can see a change without building.

```sh
npm run build          # dist/, unminified
npm run build:release  # dist/, minified
```
