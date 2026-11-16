function select (list, tab) {
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

function shownOptions (list) {
    return [...list.querySelectorAll('[role="option"]:not([hidden])')];
}

function activate (field, option) {
    for (const row of listOf(field).querySelectorAll('[role="option"]'))
        row.setAttribute('aria-selected', String(row === option));

    option?.scrollIntoView({ block: 'nearest' });
    if (option?.id)
        field.setAttribute('aria-activedescendant', option.id);
    else
        field.removeAttribute('aria-activedescendant');
}

function expand (field, open) {
    const list = listOf(field);
    const shown = open && shownOptions(list).length > 0;
    field.setAttribute('aria-expanded', String(shown));
    list.togglePopover(shown);
    if (!shown)
        activate(field, null);
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

// A caption shows while an option after it does
function filter (field, query) {
    const needle = query.trim().toLowerCase();
    let caption = null;
    for (const row of listOf(field).children) {
        if (row.getAttribute('role') === 'presentation') {
            caption = row;
            caption.hidden = true;
            continue;
        }

        row.hidden = !row.textContent.toLowerCase().includes(needle);
        if (caption && !row.hidden)
            caption.hidden = false;

        mark(row, needle);
    }

    activate(field, null);
}

function choose (field, option) {
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

// A dropdown stays a field the browser validates, so required works, but nothing is typed or pasted into it
document.addEventListener('beforeinput', event => {
    if (isCombobox(event.target) && isDropdown(event.target))
        event.preventDefault();
});

document.addEventListener('input', event => {
    if (!isCombobox(event.target))
        return;

    filter(event.target, event.target.value);
    expand(event.target, true);
});

// The list keeps the focus in its field
document.addEventListener('mousedown', event => {
    if (event.target.closest('[role="listbox"][popover]'))
        event.preventDefault();
});

document.addEventListener('click', event => {
    const option = event.target.closest('[role="listbox"][popover] [role="option"]');
    if (option) {
        const id = CSS.escape(option.closest('[role="listbox"]').id);
        const field = document.querySelector(`[role="combobox"][aria-controls="${id}"]`);
        if (field)
            choose(field, option);
    } else if (isCombobox(event.target)) {
        const field = event.target;
        expand(field, !isDropdown(field) || field.getAttribute('aria-expanded') !== 'true');
    }
});

document.addEventListener('focusout', event => {
    if (isCombobox(event.target))
        expand(event.target, false);
});

document.addEventListener('keydown', event => {
    const field = event.target;
    if (!isCombobox(field))
        return;

    const open = field.getAttribute('aria-expanded') === 'true';
    const options = shownOptions(listOf(field));
    const active = options.find(option => option.getAttribute('aria-selected') === 'true');

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!open) {
            expand(field, true);
            return;
        }

        const step = event.key === 'ArrowDown' ? 1 : -1;
        const index = active ? options.indexOf(active) + step : Math.min(step, 0);
        activate(field, options.at(index % options.length));
    } else if (event.key === 'Escape' && open) {
        event.preventDefault();
        expand(field, false);
    } else if (event.key === 'Enter' || (isDropdown(field) && event.key === ' ')) {
        if (open && active) {
            event.preventDefault();
            choose(field, active);
        } else if (isDropdown(field)) {
            event.preventDefault();
            expand(field, !open);
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
