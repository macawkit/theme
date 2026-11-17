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

    for (const candidate of list.querySelectorAll('[role="tab"]')) {
        const selected = candidate === tab;
        candidate.setAttribute('aria-selected', String(selected));
        candidate.tabIndex = selected ? 0 : -1;

        const id = candidate.getAttribute('aria-controls');
        const panel = document.getElementById(id);
        if (panel)
            panel.hidden = !selected;
    }
}

for (const list of document.querySelectorAll('[role="tablist"]')) {
    list.addEventListener('click', event => {
        const tab = event.target.closest('[role="tab"]');
        if (tab)
            select(list, tab);
    });

    list.addEventListener('keydown', event => {
        const current = event.target.closest('[role="tab"]');
        if (!current)
            return;

        const tabs = [...list.querySelectorAll('[role="tab"]')];
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
}

/*
    the chosen tab may start past the edge, it is brought in once the fonts have given the tabs their widths.
    So is the current link of the navigation column of .app, a row of them on a phone
*/
document.fonts.ready.then(() => {
    for (const row of document.querySelectorAll('[role="tablist"], nav.tabs, .app > aside > nav > :is(ul, ol)')) {
        const chosen = row.querySelector(':scope > :is([aria-selected="true"], [aria-current]:not([aria-current="false"])), :scope > li > [aria-current]:not([aria-current="false"])');
        if (chosen)
            reveal(row, chosen);
    }
});

/*
    Bars mean nothing to a screen reader. A spark the page names, aria-label="Delivered, rising" say, is read as
    one picture by that name, one it leaves unnamed is decoration and is skipped. Only the page knows what it shows
*/
for (const spark of document.querySelectorAll('.spark')) {
    if (spark.hasAttribute('aria-label') || spark.hasAttribute('aria-labelledby')) {
        if (!spark.hasAttribute('role'))
            spark.setAttribute('role', 'img');
    } else if (!spark.hasAttribute('aria-hidden')) {
        spark.setAttribute('aria-hidden', 'true');
    }
}

for (const spark of document.querySelectorAll('.spark')) {
    const valuesString = spark.dataset.values;
    if (!valuesString)
        continue;

    const values = valuesString.split(',').map(Number);
    const maxValue = Math.max(...values);

    spark.replaceChildren();

    for (const value of values) {
        const bar = document.createElement('i');
        bar.style.height = `${value / maxValue * 100}%`;
        spark.append(bar);
    }
}

for (const meter of document.querySelectorAll('div[role="meter"]')) {
    const value = meter.getAttribute('aria-valuenow');
    if (!value)
        continue;

    const min = meter.getAttribute('aria-valuemin') || 0;
    const max = meter.getAttribute('aria-valuemax') || 100;
    const range = max - min;
    const percentage = (value - min) / range * 100;

    meter.style.setProperty('--value', `${percentage}%`);
}

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
        && target.matches('[role="combobox"][aria-controls]')
        && Boolean(listOf(target)?.hasAttribute('popover'));
}

function isDropdown (field) {
    return field.inputMode === 'none';
}

function valueOf (field) {
    const next = field.nextElementSibling;
    return next?.matches('input[type="hidden"]') ? next : null;
}

function labelOf (option) {
    return option.dataset.label ?? option.textContent.trim();
}

// What a search reads: the text of the option, its label and its data-find
function matches (option, needle) {
    return `${option.textContent} ${option.dataset.label ?? ''} ${option.dataset.find ?? ''}`.toLowerCase().includes(needle);
}

function shownOptions (list) {
    return [...list.querySelectorAll('[role="option"]:not([hidden])')];
}

function currentOf (field) {
    return listOf(field).querySelector('[role="option"][aria-current="true"]');
}

function activate (field, option) {
    for (const row of listOf(field).querySelectorAll('[role="option"]'))
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
        value.value = option ? option.dataset.value ?? labelOf(option) : '';
        field.value = option ? labelOf(option) : '';
    } else
        field.value = option.dataset.value ?? option.textContent.trim();

    for (const row of listOf(field).querySelectorAll('[role="option"]'))
        if (row === option)
            row.setAttribute('aria-current', 'true');
        else
            row.removeAttribute('aria-current');

    filter(field, '');
    expand(field, false);
    field.dispatchEvent(new Event('change', { bubbles: true }));
}

// Leaving a choice takes the option named in full, or else the only one found. Emptied it is cleared, else it goes back
function settle (field) {
    if (!valueOf(field))
        return;

    const typed = field.value.trim().toLowerCase();
    const current = currentOf(field);
    const options = [...listOf(field).querySelectorAll('[role="option"]')];
    const named = options.find(option => [labelOf(option), option.dataset.value].some(name => name?.toLowerCase() === typed));
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
    if (event.target.closest('[role="listbox"][popover]'))
        event.preventDefault();
});

// A choice opened by the pointer has its text selected, so what is typed next searches anew
document.addEventListener('click', event => {
    const option = event.target.closest('[role="listbox"][popover] [role="option"]');
    if (option) {
        const id = CSS.escape(option.closest('[role="listbox"]').id);
        const field = document.querySelector(`[role="combobox"][aria-controls="${id}"]`);
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
