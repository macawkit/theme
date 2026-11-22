// scrolls only the row, never the page
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

// tells the row where its chosen tab is, for a geometry that draws the mark on the row
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
    for (const list of within(root, '[role=tablist]'))
        for (const element of [list, ...list.querySelectorAll(':scope > [role=tab]')])
            resized.observe(element);
}

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

function revealChosen (root) {
    for (const row of within(root, '[role=tablist], nav.tabs, .app > aside > nav > :is(ul, ol)')) {
        const chosen = row.querySelector(':scope > :is([aria-selected=true], [aria-current]:not([aria-current=false])), :scope > li > [aria-current]:not([aria-current=false])');
        if (chosen)
            reveal(row, chosen);
    }
}

// an unnamed spark is decoration, a named one is read as one image
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

const metersInCSS = CSS.supports('width', 'calc(attr(data-mtt type(<number>), 0) * 1%)');

function fillMeter (meter) {
    const value = Number(meter.getAttribute('aria-valuenow'));
    const min = Number(meter.getAttribute('aria-valuemin') ?? 0);
    const max = Number(meter.getAttribute('aria-valuemax') ?? 100);
    const share = max > min ? (value - min) / (max - min) : 0;

    meter.style.setProperty('--value', `${Math.min(Math.max(share, 0), 1) * 100}%`);
}

function within (root, selector) {
    const found = [...root.querySelectorAll(selector)];
    if (root instanceof Element && root.matches(selector))
        found.unshift(root);

    return found;
}

function refresh (root = document) {
    for (const dialog of within(root, 'dialog[data-open]')) {
        dialog.removeAttribute('data-open');
        if (!dialog.open)
            dialog.showModal();
    }

    for (const spark of within(root, '.spark'))
        drawSpark(spark);

    if (!metersInCSS)
        for (const meter of within(root, 'div[role=meter]'))
            fillMeter(meter);

    for (const field of within(root, 'input[role=combobox]'))
        if (isCombobox(field) && isMultiple(field))
            field.value = summaryOf(field);

    watchTabs(root);

    // once the fonts have given the tabs their widths
    document.fonts.ready.then(() => revealChosen(root));
}

globalThis.mtt = Object.assign(globalThis.mtt ?? {}, { refresh });
refresh();

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

function isChoice (field) {
    return Boolean(valueOf(field)) || isMultiple(field);
}

function boxOf (option) {
    return option.querySelector(':scope > input[type=checkbox]');
}

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

function matches (option, needle) {
    return `${option.textContent} ${option.dataset.label ?? ''} ${option.dataset.find ?? ''}`.toLowerCase().includes(needle);
}

function shownOptions (list) {
    return [...list.querySelectorAll('[role=option]:not([hidden])')];
}

function valueOfOption (option) {
    return option.dataset.value ?? labelOf(option);
}

function textOfOption (option) {
    return option.dataset.value ?? option.textContent.trim();
}

// the marked one first, so of two options with one value the chosen one stays
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

    // only the list scrolls, not the page
    option?.scrollIntoView({ block: 'nearest', container: 'nearest' });
    if (option?.id)
        field.setAttribute('aria-activedescendant', option.id);
    else
        field.removeAttribute('aria-activedescendant');
}

// manual, or a click on its own field would light-dismiss it and leave aria-expanded stale
function expand (field, open) {
    const list = listOf(field);
    const shown = open && (shownOptions(list).length > 0 || list.hasAttribute('data-empty'));
    if (list.popover !== 'manual' && !list.matches(':popover-open'))
        list.popover = 'manual';

    field.setAttribute('aria-expanded', String(shown));
    list.togglePopover(shown);
    if (shown && !isMultiple(field))
        markCurrent(field, currentOf(field));

    if (!shown)
        activate(field, null);
}

function showList (field) {
    expand(field, true);
    const current = currentOf(field);
    if (current && !current.hidden)
        activate(field, current);
}

// only inside the elements of the row, a mark in its own text would split the flex row
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

function toggle (field, option) {
    const box = boxOf(option);
    const searched = field.value !== summaryOf(field);
    box.checked = !box.checked;
    option.setAttribute('aria-checked', String(box.checked));
    if (!searched)
        field.value = summaryOf(field);

    box.dispatchEvent(new Event('change', { bubbles: true }));
}

// change fires only when the value changes, as on a select
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

// typing in a choice only searches, its own change is swallowed, choose fires the real one
document.addEventListener('change', event => {
    if (event.isTrusted && isCombobox(event.target) && isChoice(event.target))
        event.stopImmediatePropagation();
}, true);

// a dropdown stays a validated input, so required works, but takes no typing
document.addEventListener('beforeinput', event => {
    if (isCombobox(event.target) && isDropdown(event.target))
        event.preventDefault();
});

document.addEventListener('input', event => {
    if (!isCombobox(event.target))
        return;

    filter(event.target, event.target.value);
    expand(event.target, true);
    listOf(event.target).scrollTop = 0;
});

// the list keeps the focus in its field
document.addEventListener('mousedown', event => {
    if (event.target.closest('[role=listbox][popover]'))
        event.preventDefault();
});

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

// Chrome leaves the caret at the end, the text shows from its start
document.addEventListener('focusout', event => {
    if (!isCombobox(event.target))
        return;

    expand(event.target, false);
    settle(event.target);
    event.target.setSelectionRange(0, 0);
});

// Enter submits with no focusout, so a search in progress is settled first
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

// commandfor for the browsers that have none yet
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

// a dialog opened on load has no opener to give the focus back to, it goes to a button outside it that opens it
document.addEventListener('close', event => {
    const dialog = event.target;
    const focused = document.activeElement;
    if (!(dialog instanceof HTMLDialogElement) || !dialog.id || (focused && focused !== document.body && !dialog.contains(focused)))
        return;

    const openers = document.querySelectorAll(`button[commandfor="${CSS.escape(dialog.id)}"]`);
    [...openers].find(button => !dialog.contains(button))?.focus();
}, true);
