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
    or a row of tabs, calls mtt.refresh(), with the element that holds them to look only there
*/
function refresh (root = document) {
    for (const spark of root.querySelectorAll('.spark'))
        drawSpark(spark);

    if (!metersInCSS)
        for (const meter of root.querySelectorAll('div[role=meter]'))
            fillMeter(meter);

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
    says that when nothing is. A script chooses an option by clicking it.
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

// The option a field holds. In a choice it is the one with the value of its hidden input, the marked one first,
// so of two options with one label the one chosen stays, and so does one the page set by the value alone
function currentOf (field) {
    const list = listOf(field);
    const marked = list.querySelector('[role=option][aria-current=true]');
    const value = valueOf(field);
    if (!value)
        return marked;

    if (value.value === '')
        return null;

    if (marked && valueOfOption(marked) === value.value)
        return marked;

    return [...list.querySelectorAll('[role=option]')].find(option => valueOfOption(option) === value.value) ?? null;
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

function expand (field, open) {
    const list = listOf(field);
    const shown = open && (shownOptions(list).length > 0 || list.hasAttribute('data-empty'));
    field.setAttribute('aria-expanded', String(shown));
    list.togglePopover(shown);
    if (!shown)
        activate(field, null);
}

// Opened without a search, the list starts at the option the field holds
function showList (field) {
    expand(field, true);
    const current = currentOf(field);
    if (valueOf(field))
        markCurrent(field, current);

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

    activate(field, valueOf(field) && needle !== '' ? shownOptions(list)[0] : null);
}

// With no option a choice is cleared
function choose (field, option) {
    const value = valueOf(field);
    if (value) {
        value.value = option ? valueOfOption(option) : '';
        field.value = option ? labelOf(option) : '';
    } else
        field.value = option.dataset.value ?? option.textContent.trim();

    markCurrent(field, option);

    filter(field, '');
    expand(field, false);
    field.dispatchEvent(new Event('change', { bubbles: true }));
}

// Leaving a choice takes the option named in full, the one it holds first, or else the only one found. Emptied it is cleared, else it goes back
function settle (field) {
    if (!valueOf(field))
        return;

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
    else {
        field.value = current ? labelOf(current) : '';
        filter(field, '');
    }
}

// The text of a choice is only its search, so the change the browser sees in it is not the choice's, choose says that
document.addEventListener('change', event => {
    if (event.isTrusted && isCombobox(event.target) && valueOf(event.target))
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
            if (valueOf(field) && !isDropdown(field))
                field.select();
        } else if (isDropdown(field))
            expand(field, false);
    }
});

document.addEventListener('focusout', event => {
    if (!isCombobox(event.target))
        return;

    expand(event.target, false);
    settle(event.target);
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
