/* A row of tabs scrolls sideways when it doesn't fit, the chosen one is brought into sight in it, the page doesn't move */
function reveal (row, item) {
    const style = getComputedStyle(row);
    const shown = row.getBoundingClientRect();
    const box = item.getBoundingClientRect();
    const start = shown.left + parseFloat(style.paddingLeft);
    const end = shown.right - parseFloat(style.paddingRight);

    if (box.left < start)
        row.scrollLeft -= start - box.left;
    else if (box.right > end)
        row.scrollLeft += box.right - end;
}

function select (list, tab) {
    reveal(list, tab);

    for (const candidate of list.querySelectorAll('[role=tab]')) {
        const selected = candidate === tab;
        candidate.setAttribute('aria-selected', String(selected));
        candidate.tabIndex = selected ? 0 : -1;

        const id = candidate.getAttribute('aria-controls');
        const panel = document.getElementById(id);
        if (panel)
            panel.hidden = !selected;
    }

    placeChosen(list);
}

/*
    A geometry may draw the mark of the chosen tab on the row instead of on the tab, and move it from tab to tab.
    The row is told where the chosen tab is, --mtt-tab-left and --mtt-tab-width, and data-mtt-tab says it has been,
    and is told again whenever the tabs change size. Until then the chosen tab draws its own mark
*/
const resized = new ResizeObserver(entries => {
    for (const list of new Set(entries.map(entry => entry.target.closest('[role=tablist]'))))
        if (list)
            placeChosen(list);
});

function placeChosen (list) {
    const tab = list.querySelector(':scope > [role=tab][aria-selected=true]');
    list.toggleAttribute('data-mtt-tab', Boolean(tab));
    if (!tab)
        return;

    list.style.setProperty('--mtt-tab-left', `${tab.offsetLeft}px`);
    list.style.setProperty('--mtt-tab-width', `${tab.offsetWidth}px`);
}

function watchTabs (root) {
    for (const list of root.querySelectorAll('[role=tablist]'))
        for (const element of [list, ...list.querySelectorAll(':scope > [role=tab]')])
            resized.observe(element);
}

// Tabs are listened to on the document, so a row of them the page adds later works as well
document.addEventListener('click', event => {
    const tab = event.target.closest('[role=tablist] [role=tab]');
    if (tab)
        select(tab.closest('[role=tablist]'), tab);
});

document.addEventListener('keydown', event => {
    const current = event.target.closest('[role=tablist] [role=tab]');
    if (!current)
        return;

    const list = current.closest('[role=tablist]');
    const tabs = [...list.querySelectorAll('[role=tab]')];
    const index = tabs.indexOf(current);
    let next;

    if (event.key === 'ArrowRight')
        next = tabs[(index + 1) % tabs.length];
    else if (event.key === 'ArrowLeft')
        next = tabs[(index - 1 + tabs.length) % tabs.length];
    else if (event.key === 'Home')
        next = tabs[0];
    else if (event.key === 'End')
        next = tabs.at(-1);
    else
        return;

    event.preventDefault();
    select(list, next);
    next.focus();
});

// The chosen tab may start past the edge of its row, it is brought in. So is the current link of the navigation column of .app, a row of them on a phone
function revealChosen (root) {
    for (const row of root.querySelectorAll('[role=tablist], nav.tabs, .app > aside > nav > :is(ul, ol)')) {
        const chosen = row.querySelector(':scope > :is([aria-selected=true], [aria-current]:not([aria-current=false])), :scope > li > [aria-current]:not([aria-current=false])');
        if (chosen)
            reveal(row, chosen);
    }
}

/*
    Bars mean nothing to a screen reader. A spark the page names, aria-label="Delivered, rising" say, is read as
    one picture by that name, one it leaves unnamed is decoration and is skipped. Only the page knows what it shows.
    The tallest value is a full bar, the others in proportion to it. What is not a number, or below zero, is an empty bar, and so is every bar when none is above zero
*/
function drawSpark (spark) {
    if (spark.hasAttribute('aria-label') || spark.hasAttribute('aria-labelledby')) {
        if (!spark.hasAttribute('role'))
            spark.setAttribute('role', 'img');
    } else if (!spark.hasAttribute('aria-hidden')) {
        spark.setAttribute('aria-hidden', 'true');
    }

    if (!spark.dataset.values)
        return;

    const values = spark.dataset.values.split(',').map(value => Math.max(Number(value) || 0, 0));
    const top = Math.max(...values);

    spark.replaceChildren(...values.map(value => {
        const bar = document.createElement('i');
        bar.style.height = `${top > 0 ? value / top * 100 : 0}%`;
        return bar;
    }));
}

/*
    A meter is filled by its aria-valuenow, between aria-valuemin and aria-valuemax, 0 and 100 when they are not given.
    A browser that reads attributes in CSS does it there, see theme.css, and follows a change of them by itself.
    For the others it is done here, and redone by refresh
*/
const metersInCSS = CSS.supports('width', 'calc(attr(data-mtt type(<number>), 0) * 1%)');

function fillMeter (meter) {
    const value = Number(meter.getAttribute('aria-valuenow'));
    const min = Number(meter.getAttribute('aria-valuemin') ?? 0);
    const max = Number(meter.getAttribute('aria-valuemax') ?? 100);
    const share = max > min ? (value - min) / (max - min) : 0;

    meter.style.setProperty('--value', `${Math.min(Math.max(share, 0), 1) * 100}%`);
}

/*
    What the kit draws by script is drawn once, when the page loads. A page that adds or changes sparks or meters later,
    or a row of tabs, or checks the options of a field of many, or adds a dialog to open, calls mtt.refresh(),
    with the element that holds them to look only there.
    A dialog with data-open is opened as a modal, once: one the server sends back with a form it turned down, say
*/
function refresh (root = document) {
    for (const dialog of root.querySelectorAll('dialog[data-open]')) {
        dialog.removeAttribute('data-open');
        if (!dialog.open)
            dialog.showModal();
    }

    for (const spark of root.querySelectorAll('.spark'))
        drawSpark(spark);

    if (!metersInCSS)
        for (const meter of root.querySelectorAll('div[role=meter]'))
            fillMeter(meter);

    for (const field of root.querySelectorAll('input[role=combobox]'))
        if (isCombobox(field) && isMultiple(field))
            field.value = summaryOf(field);

    watchTabs(root);

    // once the fonts have given the tabs their widths
    document.fonts.ready.then(() => revealChosen(root));
}

globalThis.mtt = Object.assign(globalThis.mtt ?? {}, { refresh });
refresh();

/*
    Combobox: an input and the listbox its aria-controls names, the option chosen
    gives the input its data-value or its text. One with inputmode=none is a
    dropdown that takes no typing, any other filters the options by what is typed and marks the match.

    A hidden input right after the field makes it a choice of the options and of nothing else: the
    hidden input takes the data-value of the option chosen, the field its data-label or its text, and
    what is typed only searches. An option is also found by its data-find, and a list with data-empty
    says that when nothing is. An option with data-value="" names the choice of nothing, "All students"
    in a filter say: the field holds it while its hidden input is empty, and goes back to it when emptied.
    A choice fires change only when its value does. A script chooses an option by clicking it.

    A list with aria-multiselectable=true makes it a choice of many: each option holds a checkbox, the form
    posts the checked ones. Picking an option checks or unchecks it and the list stays open, the field shows
    the labels of the checked ones, and what is typed only searches.
*/
function listOf (field) {
    return document.getElementById(field.getAttribute('aria-controls'));
}

function isCombobox (target) {
    return target instanceof HTMLInputElement
        && target.matches('[role=combobox][aria-controls]')
        && Boolean(listOf(target)?.hasAttribute('popover'));
}

function isDropdown (field) {
    return field.inputMode === 'none';
}

function valueOf (field) {
    const next = field.nextElementSibling;
    return next?.matches('input[type=hidden]') ? next : null;
}

function isMultiple (field) {
    return listOf(field).getAttribute('aria-multiselectable') === 'true';
}

// A choice holds only options, what is typed in it searches them
function isChoice (field) {
    return Boolean(valueOf(field)) || isMultiple(field);
}

function boxOf (option) {
    return option.querySelector(':scope > input[type=checkbox]');
}

// The options of a choice of many that are checked, each marked as it is for the list to show
function checkedOf (field) {
    const checked = [];
    for (const option of listOf(field).querySelectorAll('[role=option]')) {
        const on = Boolean(boxOf(option)?.checked);
        option.setAttribute('aria-checked', String(on));
        if (on)
            checked.push(option);
    }

    return checked;
}

function summaryOf (field) {
    return checkedOf(field).map(labelOf).join(', ');
}

function labelOf (option) {
    return option.dataset.label ?? option.textContent.trim();
}

// What a search reads: the text of the option, its label and its data-find
function matches (option, needle) {
    return `${option.textContent} ${option.dataset.label ?? ''} ${option.dataset.find ?? ''}`.toLowerCase().includes(needle);
}

function shownOptions (list) {
    return [...list.querySelectorAll('[role=option]:not([hidden])')];
}

// What an option posts in a choice
function valueOfOption (option) {
    return option.dataset.value ?? labelOf(option);
}

// What an option puts in a field that is not a choice
function textOfOption (option) {
    return option.dataset.value ?? option.textContent.trim();
}

// The option a field holds: the one with its text, in a choice the one with the value of its hidden input. The marked one first,
// so of two options with one value the one chosen stays, and so does one the page or the user set by the value alone.
// A choice of many holds several, the first is where its list starts. A choice with an empty value holds its option of nothing, if it has one
function currentOf (field) {
    if (isMultiple(field))
        return checkedOf(field)[0] ?? null;

    const list = listOf(field);
    const marked = list.querySelector('[role=option][aria-current=true]');
    const hidden = valueOf(field);
    const held = hidden ? hidden.value : field.value.trim();
    const of = hidden ? valueOfOption : textOfOption;
    if (held === '')
        return hidden ? nothingOf(field) : null;

    if (marked && of(marked) === held)
        return marked;

    return [...list.querySelectorAll('[role=option]')].find(option => of(option) === held) ?? null;
}

// The option of a choice that names the choice of nothing, the marked one first
function nothingOf (field) {
    const options = [...listOf(field).querySelectorAll('[role=option]')].filter(option => option.dataset.value === '');
    return options.find(option => option.getAttribute('aria-current') === 'true') ?? options[0] ?? null;
}

function markCurrent (field, option) {
    for (const row of listOf(field).querySelectorAll('[role=option]'))
        if (row === option)
            row.setAttribute('aria-current', 'true');
        else
            row.removeAttribute('aria-current');
}

function activate (field, option) {
    for (const row of listOf(field).querySelectorAll('[role=option]'))
        row.setAttribute('aria-selected', String(row === option));

    // only the list scrolls to it, not the page
    option?.scrollIntoView({ block: 'nearest', container: 'nearest' });
    if (option?.id)
        field.setAttribute('aria-activedescendant', option.id);
    else
        field.removeAttribute('aria-activedescendant');
}

// However it opens, by the pointer, a key or a search, the list ticks the option the field holds now: a script, a reset or the Back button may have set it
function expand (field, open) {
    const list = listOf(field);
    const shown = open && (shownOptions(list).length > 0 || list.hasAttribute('data-empty'));
    field.setAttribute('aria-expanded', String(shown));
    list.togglePopover(shown);
    if (shown && !isMultiple(field))
        markCurrent(field, currentOf(field));

    if (!shown)
        activate(field, null);
}

// Opened without a search, the list starts at the option the field holds
function showList (field) {
    expand(field, true);
    const current = currentOf(field);
    if (current && !current.hidden)
        activate(field, current);
}

// Only inside an element of the row: the row is a flex box, a mark in its own text would split it into items
function mark (row, needle) {
    for (const old of row.querySelectorAll('mark'))
        old.replaceWith(...old.childNodes);

    row.normalize();
    if (needle === '')
        return;

    const hits = [];
    const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
        const at = walker.currentNode.data.toLowerCase().indexOf(needle);
        if (at !== -1 && walker.currentNode.parentNode !== row)
            hits.push([walker.currentNode, at]);
    }

    for (const [node, at] of hits) {
        const hit = node.splitText(at);
        hit.splitText(needle.length);
        const highlight = document.createElement('mark');
        hit.before(highlight);
        highlight.append(hit);
    }
}

// A caption shows while an option after it does. A choice is only searched, so Enter takes its first match
function filter (field, query) {
    const needle = query.trim().toLowerCase();
    const list = listOf(field);
    let caption = null;
    for (const row of list.children) {
        if (row.getAttribute('role') === 'presentation') {
            caption = row;
            caption.hidden = true;
            continue;
        }

        row.hidden = !matches(row, needle);
        if (caption && !row.hidden)
            caption.hidden = false;

        mark(row, needle);
    }

    activate(field, isChoice(field) && needle !== '' ? shownOptions(list)[0] : null);
}

// In a choice of many the option is checked or unchecked and the list stays open. The field shows what is checked, unless a search is in it
function toggle (field, option) {
    const box = boxOf(option);
    const searched = field.value !== summaryOf(field);
    box.checked = !box.checked;
    option.setAttribute('aria-checked', String(box.checked));
    if (!searched)
        field.value = summaryOf(field);

    box.dispatchEvent(new Event('change', { bubbles: true }));
}

// With no option a choice is cleared, to its option of nothing if it has one. Change is told only when the value is another, as a select does
function choose (field, option) {
    if (isMultiple(field)) {
        toggle(field, option);
        return;
    }

    const value = valueOf(field);
    const before = value ? value.value : field.value;
    if (value) {
        option ??= nothingOf(field);
        value.value = option ? valueOfOption(option) : '';
        field.value = option ? labelOf(option) : '';
    } else
        field.value = textOfOption(option);

    markCurrent(field, option);

    filter(field, '');
    expand(field, false);
    if ((value ? value.value : field.value) !== before)
        field.dispatchEvent(new Event('change', { bubbles: true }));
}

// Leaving a choice takes the option named in full, the one it holds first, or else the only one found. Emptied it is cleared, else it goes back.
// A choice of many takes nothing that is typed, it goes back to what is checked. Any other field keeps what is typed. Whichever, the search is over
function settle (field) {
    if (isMultiple(field))
        field.value = summaryOf(field);
    else if (valueOf(field)) {
        const typed = field.value.trim().toLowerCase();
        const current = currentOf(field);
        const options = [...listOf(field).querySelectorAll('[role=option]')];
        const isNamed = option => [labelOf(option), option.dataset.value].some(name => name?.toLowerCase() === typed);
        const named = current && isNamed(current) ? current : options.find(isNamed);
        const found = typed === '' ? [] : options.filter(option => matches(option, typed));
        const option = named ?? (found.length === 1 ? found[0] : undefined);

        if (typed === '' && current)
            choose(field, null);
        else if (option && option !== current)
            choose(field, option);
        else
            field.value = current ? labelOf(current) : '';
    }

    filter(field, '');
}

// The text of a choice is only its search, so the change the browser sees in it is not the choice's, choose says that
document.addEventListener('change', event => {
    if (event.isTrusted && isCombobox(event.target) && isChoice(event.target))
        event.stopImmediatePropagation();
}, true);

// A dropdown stays a field the browser validates, so required works, but nothing is typed or pasted into it
document.addEventListener('beforeinput', event => {
    if (isCombobox(event.target) && isDropdown(event.target))
        event.preventDefault();
});

document.addEventListener('input', event => {
    if (!isCombobox(event.target))
        return;

    // a new search starts at its first match
    filter(event.target, event.target.value);
    expand(event.target, true);
    listOf(event.target).scrollTop = 0;
});

// The list keeps the focus in its field
document.addEventListener('mousedown', event => {
    if (event.target.closest('[role=listbox][popover]'))
        event.preventDefault();
});

// A choice opened by the pointer has its text selected, so what is typed next searches anew
document.addEventListener('click', event => {
    const option = event.target.closest('[role=listbox][popover] [role=option]');
    if (option) {
        const id = CSS.escape(option.closest('[role=listbox]').id);
        const field = document.querySelector(`[role=combobox][aria-controls="${id}"]`);
        if (field)
            choose(field, option);
    } else if (isCombobox(event.target)) {
        const field = event.target;
        if (field.getAttribute('aria-expanded') !== 'true') {
            showList(field);
            if (isChoice(field) && !isDropdown(field))
                field.select();
        } else if (isDropdown(field))
            expand(field, false);
    }
});

// Left, a field shows its text from the start, as Chrome does by itself: the caret goes there, what was selected or typed in it scrolled it to the end
document.addEventListener('focusout', event => {
    if (!isCombobox(event.target))
        return;

    expand(event.target, false);
    settle(event.target);
    event.target.setSelectionRange(0, 0);
});

// Enter in a field sends its form without leaving it, so a choice with a search in it is settled first
document.addEventListener('submit', event => {
    for (const field of event.target.elements)
        if (isCombobox(field))
            settle(field);
}, true);

document.addEventListener('keydown', event => {
    const field = event.target;
    if (!isCombobox(field))
        return;

    const open = field.getAttribute('aria-expanded') === 'true';
    const list = listOf(field);
    const options = shownOptions(list);
    const active = options.find(option => option.getAttribute('aria-selected') === 'true');
    const index = options.indexOf(active);

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!open) {
            showList(field);
            return;
        }

        const step = event.key === 'ArrowDown' ? 1 : -1;
        activate(field, options.at(active ? (index + step) % options.length : Math.min(step, 0)));
    } else if ((event.key === 'PageDown' || event.key === 'PageUp') && open && options.length > 0) {
        // as many rows as the list shows
        event.preventDefault();
        const page = Math.max(1, Math.floor(list.clientHeight / options[0].offsetHeight));
        const to = (active ? index : -1) + (event.key === 'PageDown' ? page : -page);
        activate(field, options[Math.min(Math.max(to, 0), options.length - 1)]);
    } else if ((event.key === 'Home' || event.key === 'End') && open && isDropdown(field)) {
        // a field that is typed in keeps these for its caret
        event.preventDefault();
        activate(field, options.at(event.key === 'Home' ? 0 : -1));
    } else if (event.key === 'Escape' && open) {
        event.preventDefault();
        expand(field, false);
    } else if (event.key === 'Enter' || (isDropdown(field) && event.key === ' ')) {
        if (open && active) {
            event.preventDefault();
            choose(field, active);
        } else if (isDropdown(field)) {
            event.preventDefault();
            if (open)
                expand(field, false);
            else
                showList(field);
        }
    }
});

// Invoker commands for the browsers that have none yet: a button with commandfor opens or closes its dialog
if (!('commandForElement' in HTMLButtonElement.prototype))
    document.addEventListener('click', event => {
        const button = event.target.closest('button[commandfor]');
        if (!button)
            return;

        const dialog = document.getElementById(button.getAttribute('commandfor'));
        if (!(dialog instanceof HTMLDialogElement))
            return;

        const command = button.getAttribute('command');
        if (command === 'show-modal' && !dialog.open)
            dialog.showModal();
        else if (command === 'close')
            dialog.close();
    });

// A dialog closed with nowhere to give the focus back, one opened as the page loaded say, gives it to a button outside it that opens it.
// The focus may still be in it then, on its way out
document.addEventListener('close', event => {
    const dialog = event.target;
    const focused = document.activeElement;
    if (!(dialog instanceof HTMLDialogElement) || !dialog.id || (focused && focused !== document.body && !dialog.contains(focused)))
        return;

    const openers = document.querySelectorAll(`button[commandfor="${CSS.escape(dialog.id)}"]`);
    [...openers].find(button => !dialog.contains(button))?.focus();
}, true);
