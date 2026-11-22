function isDisabled (element) {
    return element.matches(':disabled, [aria-disabled=true]');
}

// scroll only the horizontal container, never the page
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

function tabsOf (list) {
    return [...list.querySelectorAll(':scope > [role=tab]')];
}

function select (list, tab) {
    if (isDisabled(tab))
        return;

    reveal(list, tab);

    for (const candidate of tabsOf(list)) {
        const selected = candidate === tab;
        candidate.setAttribute('aria-selected', String(selected));
        candidate.tabIndex = selected ? 0 : -1;

        const id = candidate.getAttribute('aria-controls');
        const panel = id ? document.getElementById(id) : null;
        if (panel)
            panel.hidden = !selected;
    }

    placeChosen(list);
}

// expose active tab geometry on the tablist for sliding indicators (e.g. Candy)
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
    for (const list of within(root, '[role=tablist]')) {
        const tabs = tabsOf(list);
        const active = tabs.find(tab => tab.getAttribute('aria-selected') === 'true')
            ?? tabs.find(tab => !isDisabled(tab));
        for (const tab of tabs)
            tab.tabIndex = tab === active ? 0 : -1;

        for (const element of [list, ...tabs])
            resized.observe(element);

        placeChosen(list);
    }
}

function revealChosen (root) {
    const rows = '[role=tablist], nav.tabs, .app > aside > nav:not(.tabs, .crumbs, .pages, :has(> :is(ul, ol))), .app > aside > nav:not(.tabs, .crumbs, .pages) > :is(ul, ol)';
    for (const row of within(root, rows)) {
        const chosen = row.querySelector(':scope > :is([aria-selected=true], [aria-current]:not([aria-current=false])), :scope > li > [aria-current]:not([aria-current=false])');
        if (chosen)
            reveal(row, chosen);
    }
}

// unlabeled sparks are decorative; labeled ones are exposed as a single image
function drawSpark (spark) {
    if (spark.hasAttribute('aria-label') || spark.hasAttribute('aria-labelledby')) {
        if (!spark.hasAttribute('role'))
            spark.setAttribute('role', 'img');
    } else if (!spark.hasAttribute('aria-hidden')) {
        spark.setAttribute('aria-hidden', 'true');
    }

    if (!('values' in spark.dataset))
        return;

    if (spark.dataset.values.trim() === '') {
        spark.replaceChildren();
        return;
    }

    const values = spark.dataset.values.split(',').map(value => Math.max(Number(value) || 0, 0));
    const top = Math.max(...values);

    spark.replaceChildren(...values.map(value => {
        const bar = document.createElement('i');
        bar.style.height = `${top > 0 ? value / top * 100 : 0}%`;
        return bar;
    }));
}

const metersInCSS = CSS.supports('width', 'calc(attr(data-mtt type(<number>), 0) * 1%)');

function numericAttr (element, name, fallback) {
    const raw = element.getAttribute(name);
    const parsed = raw !== null && raw.trim() !== '' ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : fallback;
}

function fillMeter (meter) {
    const value = numericAttr(meter, 'aria-valuenow', 0);
    const min = numericAttr(meter, 'aria-valuemin', 0);
    const max = numericAttr(meter, 'aria-valuemax', 100);
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
        for (const meter of within(root, '[role=meter]'))
            fillMeter(meter);

    for (const field of within(root, 'input[role=combobox]'))
        if (isCombobox(field) && isMultiple(field))
            field.value = summaryOf(field);

    watchTabs(root);

    // wait for webfonts so tab widths are final before scrolling the active item into view
    document.fonts.ready.then(() => revealChosen(root));
}

globalThis.mtt = Object.assign(globalThis.mtt ?? {}, { refresh });
if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', () => refresh(), { once: true });
else
    refresh();

function listOf (field) {
    return document.getElementById(field.getAttribute('aria-controls'));
}

function isCombobox (target) {
    return target instanceof HTMLInputElement
        && target.matches('[role=combobox][aria-controls]')
        && Boolean(listOf(target)?.hasAttribute('popover'));
}

function isInteractiveCombobox (target) {
    return isCombobox(target) && !isDisabled(target) && !target.readOnly;
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

function checkedOf (field, sync = true) {
    const checked = [];
    for (const option of listOf(field).querySelectorAll('[role=option]')) {
        const on = Boolean(boxOf(option)?.checked);
        if (sync)
            option.setAttribute('aria-checked', String(on));
        if (on)
            checked.push(option);
    }

    return checked;
}

function summaryOf (field, sync = true) {
    return checkedOf(field, sync).map(labelOf).join(', ');
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

// prefer the already-marked option when multiple options share the same value
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

    // scroll only the listbox, not the outer page
    option?.scrollIntoView({ block: 'nearest', container: 'nearest' });
    if (option?.id)
        field.setAttribute('aria-activedescendant', option.id);
    else
        field.removeAttribute('aria-activedescendant');
}

// use manual popovers so clicking the input doesn't light-dismiss the list and desync aria-expanded
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

// wrap direct text nodes before splitting so <mark> doesn't become a separate flex item
function mark (row, needle) {
    for (const old of row.querySelectorAll('mark, span[data-mtt-mark]'))
        old.replaceWith(...old.childNodes);

    row.normalize();
    if (needle === '')
        return;

    const hits = [];
    const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
        const at = walker.currentNode.data.toLowerCase().indexOf(needle);
        if (at !== -1)
            hits.push([walker.currentNode, at]);
    }

    for (const [node, at] of hits) {
        if (node.parentNode === row) {
            const wrapper = document.createElement('span');
            wrapper.dataset.mttMark = '';
            node.before(wrapper);
            wrapper.append(node);
        }

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
    let firstShown = null;
    for (const row of list.children) {
        if (row.getAttribute('role') === 'presentation') {
            caption = row;
            caption.hidden = true;
            continue;
        }

        row.hidden = !matches(row, needle);
        if (!row.hidden) {
            if (caption)
                caption.hidden = false;
            if (!firstShown)
                firstShown = row;

            mark(row, needle);
        }
    }

    activate(field, isChoice(field) && needle !== '' ? firstShown : null);
}

function toggle (field, option) {
    const box = boxOf(option);
    if (!box || box.disabled)
        return;

    const searched = field.value !== summaryOf(field, false);
    box.checked = !box.checked;
    option.setAttribute('aria-checked', String(box.checked));
    if (!searched)
        field.value = summaryOf(field, false);

    box.dispatchEvent(new Event('change', { bubbles: true }));
}

// fire change only when the value actually changes, matching <select>
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
    let chose = false;
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

        if (typed === '' && current) {
            choose(field, null);
            chose = true;
        } else if (option && option !== current) {
            choose(field, option);
            chose = true;
        } else
            field.value = current ? labelOf(current) : '';
    }

    if (!chose)
        filter(field, '');
}

// suppress native change from search typing in choice comboboxes; choose() dispatches the real one
document.addEventListener('change', event => {
    if (event.isTrusted && isCombobox(event.target) && isChoice(event.target))
        event.stopImmediatePropagation();
}, true);

// dropdowns stay real inputs (so required works) while blocking typed input
document.addEventListener('beforeinput', event => {
    if (isInteractiveCombobox(event.target) && isDropdown(event.target))
        event.preventDefault();
});

document.addEventListener('input', event => {
    if (!isInteractiveCombobox(event.target))
        return;

    filter(event.target, event.target.value);
    expand(event.target, true);
    listOf(event.target).scrollTop = 0;
});

// keep focus in the combobox when clicking the list, while still allowing scrollbar drags
document.addEventListener('mousedown', event => {
    if (!(event.target instanceof Element))
        return;

    const list = event.target.closest('[role=listbox][popover]');
    if (!list)
        return;

    if (event.target === list) {
        const box = list.getBoundingClientRect();
        if (event.clientX >= box.left + list.clientLeft + list.clientWidth
            || event.clientY >= box.top + list.clientTop + list.clientHeight)
            return;
    }

    event.preventDefault();
});

const needsCommandFor = !('commandForElement' in HTMLButtonElement.prototype);

document.addEventListener('click', event => {
    if (!(event.target instanceof Element))
        return;

    const tab = event.target.closest('[role=tablist] > [role=tab]');
    if (tab) {
        select(tab.closest('[role=tablist]'), tab);
        return;
    }

    const option = event.target.closest('[role=listbox][popover] [role=option]');
    if (option) {
        const id = CSS.escape(option.closest('[role=listbox]').id);
        const field = document.querySelector(`[role=combobox][aria-controls="${id}"]`);
        if (field && isInteractiveCombobox(field))
            choose(field, option);
        return;
    }

    if (isInteractiveCombobox(event.target)) {
        const field = event.target;
        if (field.getAttribute('aria-expanded') !== 'true') {
            showList(field);
            if (isChoice(field) && !isDropdown(field))
                field.select();
        } else if (isDropdown(field))
            expand(field, false);
        return;
    }

    // polyfill commandfor="id" command="show-modal|close" where unsupported
    if (needsCommandFor) {
        const button = event.target.closest('button[commandfor]');
        if (!button)
            return;

        const dialog = document.getElementById(button.getAttribute('commandfor'));
        if (!(dialog instanceof HTMLDialogElement))
            return;

        const command = button.getAttribute('command');
        if (command === 'show-modal' && !dialog.open) {
            event.preventDefault();
            dialog.showModal();
        } else if (command === 'close' && dialog.open) {
            event.preventDefault();
            dialog.close();
        }
    }
});

// reset horizontal scroll on blur so truncated values read from the start
document.addEventListener('focusout', event => {
    if (!isCombobox(event.target))
        return;

    settle(event.target);
    if (event.target.getAttribute('aria-expanded') === 'true')
        expand(event.target, false);
    event.target.scrollLeft = 0;
});

// Enter submits without focusout, so settle pending searches and re-check validity first
document.addEventListener('submit', event => {
    const validate = !event.target.noValidate && !event.submitter?.formNoValidate;
    let invalid = null;
    for (const field of event.target.elements) {
        if (!isCombobox(field))
            continue;

        settle(field);
        if (validate && !invalid && !field.checkValidity())
            invalid = field;
    }

    if (invalid) {
        event.preventDefault();
        event.stopImmediatePropagation();
        invalid.reportValidity();
    }
}, true);

document.addEventListener('keydown', event => {
    if (!(event.target instanceof Element))
        return;

    const currentTab = event.target.closest('[role=tablist] > [role=tab]');
    if (currentTab) {
        const list = currentTab.closest('[role=tablist]');
        const tabs = tabsOf(list).filter(tab => !isDisabled(tab));
        const index = tabs.indexOf(currentTab);
        if (index === -1)
            return;

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
        return;
    }

    const field = event.target;
    if (!isInteractiveCombobox(field))
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
        const page = Math.max(1, Math.floor(list.clientHeight / (options[0].offsetHeight || 1)));
        const to = (active ? index : -1) + (event.key === 'PageDown' ? page : -page);
        activate(field, options[Math.min(Math.max(to, 0), options.length - 1)]);
    } else if ((event.key === 'Home' || event.key === 'End') && open && isDropdown(field)) {
        // leave Home/End to caret navigation in typed comboboxes
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

// dialogs opened via data-open have no opener; return focus to an external commandfor trigger on close
document.addEventListener('close', event => {
    const dialog = event.target;
    const focused = document.activeElement;
    if (!(dialog instanceof HTMLDialogElement) || !dialog.id || (focused && focused !== document.body && !dialog.contains(focused)))
        return;

    const openers = document.querySelectorAll(`button[commandfor="${CSS.escape(dialog.id)}"]`);
    [...openers].find(button => !dialog.contains(button))?.focus();
}, true);
