import test from 'node:test';
import assert from 'node:assert/strict';

// Minimal zero-dependency DOM implementation sufficient to exercise all of src/general.js.
class StyleMap {
    constructor () {
        this._map = new Map();
    }
    setProperty (name, value) {
        if (value === '' || value == null)
            this._map.delete(name);
        else
            this._map.set(name, String(value));
    }
    getPropertyValue (name) {
        return this._map.get(name) ?? '';
    }
    get height () { return this._map.get('height') ?? ''; }
    set height (v) { this.setProperty('height', v); }
    [Symbol.iterator] () {
        return this._map.keys();
    }
}

class TextNode {
    constructor (data) {
        this.nodeType = 3;
        this.data = String(data);
        this.parentNode = null;
    }
    get textContent () { return this.data; }
    before (...nodes) {
        const parent = this.parentNode;
        const idx = parent.childNodes.indexOf(this);
        for (const n of nodes) {
            if (n.parentNode) n.parentNode.removeChild(n);
            n.parentNode = parent;
        }
        parent.childNodes.splice(idx, 0, ...nodes);
    }
    splitText (offset) {
        const rest = new TextNode(this.data.slice(offset));
        this.data = this.data.slice(0, offset);
        const parent = this.parentNode;
        const idx = parent.childNodes.indexOf(this);
        rest.parentNode = parent;
        parent.childNodes.splice(idx + 1, 0, rest);
        return rest;
    }
    cloneNode () {
        return new TextNode(this.data);
    }
}

function camelToDash (k) {
    return k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
}
function dashToCamel (k) {
    return k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

class FakeEvent {
    constructor (type, init = {}) {
        this.type = type;
        this.bubbles = Boolean(init.bubbles);
        this.isTrusted = Boolean(init.isTrusted);
        this.detail = init.detail ?? 0;
        this.key = init.key ?? '';
        this.newState = init.newState ?? '';
        this.clientX = init.clientX ?? 0;
        this.clientY = init.clientY ?? 0;
        this.submitter = init.submitter ?? null;
        this.defaultPrevented = false;
        this._stoppedImmediate = false;
        this.target = null;
    }
    preventDefault () { this.defaultPrevented = true; }
    stopImmediatePropagation () { this._stoppedImmediate = true; }
}

function matchSingleSelector (el, raw, scope = null) {
    const sel = raw.trim();
    if (!sel) return false;
    // Handle :scope prefix
    if (sel.startsWith(':scope > ')) {
        if (!scope || el.parentNode !== scope) return false;
        return matchSelector(el, sel.slice(':scope > '.length), scope);
    }
    if (sel.startsWith(':scope ')) {
        if (!scope || !scope.contains(el) || scope === el) return false;
        return matchSelector(el, sel.slice(':scope '.length), scope);
    }

    // Handle combinators outside parens/brackets
    const parts = splitCombinators(sel);
    if (parts.length > 1) {
        const last = parts[parts.length - 1];
        if (!matchCompound(el, last.sel, scope)) return false;
        let cur = el;
        for (let i = parts.length - 2; i >= 0; i--) {
            const { sel: partSel, comb } = parts[i];
            if (comb === '>') {
                cur = cur.parentNode;
                if (!(cur instanceof FakeElement) || !matchCompound(cur, partSel, scope))
                    return false;
            } else {
                let p = cur.parentNode;
                let ok = false;
                while (p instanceof FakeElement) {
                    if (matchCompound(p, partSel, scope)) {
                        cur = p;
                        ok = true;
                        break;
                    }
                    p = p.parentNode;
                }
                if (!ok) return false;
            }
        }
        return true;
    }

    return matchCompound(el, sel, scope);
}

function splitTopLevel (str, sep) {
    const out = [];
    let depthP = 0, depthB = 0, quote = '', buf = '';
    for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (quote) {
            buf += ch;
            if (ch === quote && str[i - 1] !== '\\') quote = '';
            continue;
        }
        if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
        if (ch === '(') depthP++;
        else if (ch === ')') depthP--;
        else if (ch === '[') depthB++;
        else if (ch === ']') depthB--;
        if (depthP === 0 && depthB === 0 && ch === sep) {
            out.push(buf.trim());
            buf = '';
            continue;
        }
        buf += ch;
    }
    if (buf.trim()) out.push(buf.trim());
    return out;
}

function splitCombinators (sel) {
    const tokens = [];
    let depthP = 0, depthB = 0, quote = '', buf = '';
    for (let i = 0; i < sel.length; i++) {
        const ch = sel[i];
        if (quote) {
            buf += ch;
            if (ch === quote && sel[i - 1] !== '\\') quote = '';
            continue;
        }
        if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
        if (ch === '(') depthP++;
        else if (ch === ')') depthP--;
        else if (ch === '[') depthB++;
        else if (ch === ']') depthB--;
        if (depthP === 0 && depthB === 0) {
            if (ch === '>') {
                if (buf.trim()) tokens.push({ sel: buf.trim(), comb: '>' });
                else if (tokens.length) tokens[tokens.length - 1].comb = '>';
                buf = '';
                continue;
            }
            if (ch === ' ') {
                if (buf.trim()) tokens.push({ sel: buf.trim(), comb: ' ' });
                buf = '';
                continue;
            }
        }
        buf += ch;
    }
    if (buf.trim()) tokens.push({ sel: buf.trim(), comb: null });
    return tokens;
}

function matchCompound (el, compound, scope) {
    let i = 0;
    while (i < compound.length) {
        const ch = compound[i];
        if (ch === '.') {
            i++;
            let name = '';
            while (i < compound.length && /[\w-]/.test(compound[i])) name += compound[i++];
            if (!el.classList.contains(name)) return false;
        } else if (ch === '#') {
            i++;
            let name = '';
            while (i < compound.length && /[\w-]/.test(compound[i])) name += compound[i++];
            if (el.id !== name) return false;
        } else if (ch === '[') {
            i++;
            let inner = '', quote = '';
            while (i < compound.length) {
                const c = compound[i++];
                if (quote) {
                    if (c === quote && compound[i - 2] !== '\\') quote = '';
                    inner += c;
                } else if (c === '"' || c === "'") {
                    quote = c;
                    inner += c;
                } else if (c === ']') break;
                else inner += c;
            }
            const eq = inner.indexOf('=');
            if (eq === -1) {
                if (!el.hasAttribute(inner.trim())) return false;
            } else {
                const attr = inner.slice(0, eq).trim();
                let val = inner.slice(eq + 1).trim();
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
                    val = val.slice(1, -1).replace(/\\(.)/g, '$1');
                if (el.getAttribute(attr) !== val) return false;
            }
        } else if (ch === ':') {
            i++;
            let name = '';
            while (i < compound.length && /[\w-]/.test(compound[i])) name += compound[i++];
            let arg = null;
            if (compound[i] === '(') {
                i++;
                let depth = 1, buf = '';
                while (i < compound.length && depth > 0) {
                    const c = compound[i++];
                    if (c === '(') depth++;
                    else if (c === ')') { depth--; if (depth === 0) break; }
                    buf += c;
                }
                arg = buf;
            }
            if (name === 'scope') {
                if (el !== scope) return false;
            } else if (name === 'disabled') {
                if (!el.disabled) return false;
            } else if (name === 'checked') {
                if (!el.checked) return false;
            } else if (name === 'popover-open') {
                if (!el._popoverOpen) return false;
            } else if (name === 'first-child') {
                const parent = el.parentNode;
                if (!parent || parent.children[0] !== el) return false;
            } else if (name === 'not') {
                if (matchSelector(el, arg, scope)) return false;
            } else if (name === 'is') {
                if (!matchSelector(el, arg, scope)) return false;
            } else if (name === 'has') {
                const found = queryAll(el, arg);
                if (found.length === 0) return false;
            } else {
                return false;
            }
        } else {
            let tag = '';
            while (i < compound.length && /[\w-]/.test(compound[i])) tag += compound[i++];
            if (el.tagName !== tag.toUpperCase()) return false;
        }
    }
    return true;
}

function matchSelector (el, selector, scope = null) {
    return splitTopLevel(selector, ',').some(part => matchSingleSelector(el, part, scope));
}

function queryAll (root, selector) {
    const results = [];
    const visit = node => {
        for (const child of node.childNodes) {
            if (child instanceof FakeElement) {
                if (matchSelector(child, selector, root))
                    results.push(child);
                visit(child);
            }
        }
    };
    visit(root);
    return results;
}

class FakeElement {
    constructor (tagName) {
        this.nodeType = 1;
        this.tagName = tagName.toUpperCase();
        this.parentNode = null;
        this.childNodes = [];
        this._attrs = new Map();
        this.style = new StyleMap();
        this.hidden = false;
        this.disabled = false;
        this.readOnly = false;
        this.tabIndex = 0;
        this.scrollLeft = 0;
        this.scrollTop = 0;
        this.clientLeft = 0;
        this.clientTop = 0;
        this.clientWidth = 200;
        this.clientHeight = 120;
        this.offsetLeft = 0;
        this.offsetWidth = 80;
        this.offsetHeight = 40;
        this._rect = { left: 0, right: 100, top: 0, bottom: 40 };
        this._popoverOpen = false;
        this._popoverToggleCalls = [];
        this.scrolledIntoView = null;
        this.dataset = new Proxy({}, {
            get: (_, prop) => {
                const attr = `data-${camelToDash(String(prop))}`;
                return this._attrs.has(attr) ? this._attrs.get(attr) : undefined;
            },
            set: (_, prop, val) => {
                this._attrs.set(`data-${camelToDash(String(prop))}`, String(val));
                return true;
            },
            has: (_, prop) => this._attrs.has(`data-${camelToDash(String(prop))}`),
            deleteProperty: (_, prop) => {
                this._attrs.delete(`data-${camelToDash(String(prop))}`);
                return true;
            }
        });
        this.classList = {
            contains: name => this.className.split(/\s+/).filter(Boolean).includes(name),
            add: name => {
                const set = new Set(this.className.split(/\s+/).filter(Boolean));
                set.add(name);
                this.className = [...set].join(' ');
            }
        };
    }

    get parentElement () { return this.parentNode instanceof FakeElement ? this.parentNode : null; }
    get children () { return this.childNodes.filter(c => c instanceof FakeElement); }
    get nextElementSibling () {
        if (!this.parentNode) return null;
        const sibs = this.parentNode.children;
        const i = sibs.indexOf(this);
        return i >= 0 && i + 1 < sibs.length ? sibs[i + 1] : null;
    }
    get id () { return this.getAttribute('id') ?? ''; }
    set id (v) { this.setAttribute('id', v); }
    get className () { return this.getAttribute('class') ?? ''; }
    set className (v) { this.setAttribute('class', v); }
    get popover () { return this.getAttribute('popover'); }
    set popover (v) { this.setAttribute('popover', v); }

    get textContent () {
        return this.childNodes.map(c => c.textContent).join('');
    }
    set textContent (v) {
        this.replaceChildren(v === '' ? undefined : new TextNode(v));
    }

    getAttribute (name) {
        if (name === 'hidden') return this.hidden ? '' : null;
        if (name === 'disabled') return this.disabled ? '' : null;
        return this._attrs.has(name) ? this._attrs.get(name) : null;
    }
    setAttribute (name, value) {
        if (name === 'hidden') { this.hidden = true; return; }
        if (name === 'disabled') { this.disabled = true; return; }
        if (name === 'style') {
            this.style = new StyleMap();
            for (const decl of String(value).split(';')) {
                const idx = decl.indexOf(':');
                if (idx !== -1)
                    this.style.setProperty(decl.slice(0, idx).trim(), decl.slice(idx + 1).trim());
            }
            return;
        }
        this._attrs.set(name, String(value));
    }
    removeAttribute (name) {
        if (name === 'hidden') { this.hidden = false; return; }
        if (name === 'disabled') { this.disabled = false; return; }
        this._attrs.delete(name);
    }
    hasAttribute (name) {
        if (name === 'hidden') return this.hidden;
        if (name === 'disabled') return this.disabled;
        return this._attrs.has(name);
    }
    toggleAttribute (name, force) {
        const on = force === undefined ? !this.hasAttribute(name) : Boolean(force);
        if (on) this.setAttribute(name, '');
        else this.removeAttribute(name);
        return on;
    }

    append (...nodes) {
        for (const n of nodes) {
            if (n === undefined || n === null) continue;
            const node = typeof n === 'string' ? new TextNode(n) : n;
            if (node.parentNode) node.parentNode.removeChild(node);
            node.parentNode = this;
            this.childNodes.push(node);
        }
    }
    removeChild (node) {
        const i = this.childNodes.indexOf(node);
        if (i !== -1) {
            this.childNodes.splice(i, 1);
            node.parentNode = null;
        }
    }
    remove () {
        this.parentNode?.removeChild(this);
    }
    replaceChildren (...nodes) {
        for (const c of this.childNodes) c.parentNode = null;
        this.childNodes = [];
        this.append(...nodes);
    }
    before (...nodes) {
        const parent = this.parentNode;
        const idx = parent.childNodes.indexOf(this);
        const list = nodes.map(n => typeof n === 'string' ? new TextNode(n) : n);
        for (const n of list) {
            if (n.parentNode) n.parentNode.removeChild(n);
            n.parentNode = parent;
        }
        parent.childNodes.splice(idx, 0, ...list);
    }
    after (...nodes) {
        const parent = this.parentNode;
        const idx = parent.childNodes.indexOf(this);
        const list = nodes.map(n => typeof n === 'string' ? new TextNode(n) : n);
        for (const n of list) {
            if (n.parentNode) n.parentNode.removeChild(n);
            n.parentNode = parent;
        }
        parent.childNodes.splice(idx + 1, 0, ...list);
    }
    replaceWith (...nodes) {
        const parent = this.parentNode;
        const idx = parent.childNodes.indexOf(this);
        const list = nodes.map(n => typeof n === 'string' ? new TextNode(n) : n);
        for (const n of list) {
            if (n.parentNode) n.parentNode.removeChild(n);
            n.parentNode = parent;
        }
        parent.childNodes.splice(idx, 1, ...list);
        this.parentNode = null;
    }
    normalize () {
        const out = [];
        for (const c of this.childNodes) {
            if (c instanceof TextNode) {
                if (c.data === '') { c.parentNode = null; continue; }
                const prev = out[out.length - 1];
                if (prev instanceof TextNode) {
                    prev.data += c.data;
                    c.parentNode = null;
                    continue;
                }
            }
            out.push(c);
        }
        this.childNodes = out;
    }
    cloneNode (deep = false) {
        const copy = document.createElement(this.tagName.toLowerCase());
        for (const [k, v] of this._attrs) copy._attrs.set(k, v);
        for (const k of this.style) copy.style.setProperty(k, this.style.getPropertyValue(k));
        if (deep)
            for (const c of this.childNodes) copy.append(c.cloneNode(true));
        return copy;
    }
    contains (node) {
        let cur = node;
        while (cur) {
            if (cur === this) return true;
            cur = cur.parentNode;
        }
        return false;
    }
    matches (selector) { return matchSelector(this, selector); }
    closest (selector) {
        let cur = this;
        while (cur instanceof FakeElement) {
            if (cur.matches(selector)) return cur;
            cur = cur.parentNode;
        }
        return null;
    }
    querySelectorAll (selector) { return queryAll(this, selector); }
    querySelector (selector) { return queryAll(this, selector)[0] ?? null; }
    getBoundingClientRect () { return this._rect; }
    scrollIntoView (opts) { this.scrolledIntoView = opts; }
    focus () { document.activeElement = this; }

    togglePopover (force) {
        const next = force === undefined ? !this._popoverOpen : Boolean(force);
        this._popoverOpen = next;
        this._popoverToggleCalls.push(next);
        return next;
    }
    showPopover () {
        if (!this._popoverOpen) {
            document.dispatchOn(this, new FakeEvent('beforetoggle', { newState: 'open' }));
            this._popoverOpen = true;
            document.dispatchOn(this, new FakeEvent('toggle', { newState: 'open' }));
        }
    }
    hidePopover () {
        if (this._popoverOpen) {
            document.dispatchOn(this, new FakeEvent('beforetoggle', { newState: 'closed' }));
            this._popoverOpen = false;
            document.dispatchOn(this, new FakeEvent('toggle', { newState: 'closed' }));
        }
    }
    dispatchEvent (event) {
        return document.dispatchOn(this, event);
    }
}

class FakeInputElement extends FakeElement {
    constructor () {
        super('input');
        this.value = '';
        this.min = '';
        this.max = '';
        this.checked = false;
        this.inputMode = '';
        this.selected = false;
        this.valid = true;
        this.reportedValidity = 0;
    }
    get type () { return this.getAttribute('type') ?? 'text'; }
    set type (v) { this.setAttribute('type', v); }
    select () { this.selected = true; }
    checkValidity () { return this.valid; }
    reportValidity () { this.reportedValidity++; return this.valid; }
}

class FakeButtonElement extends FakeElement {
    constructor () { super('button'); }
}

class FakeDialogElement extends FakeElement {
    constructor () {
        super('dialog');
        this.open = false;
    }
    showModal () { this.open = true; }
    close () {
        this.open = false;
        document.dispatchOn(this, new FakeEvent('close'));
    }
}

class FakeFormElement extends FakeElement {
    constructor () {
        super('form');
        this.noValidate = false;
    }
    get elements () {
        return this.querySelectorAll('input, button, select, textarea');
    }
}

class FakeDocument extends FakeElement {
    constructor () {
        super('#document');
        this.readyState = 'loading';
        this.body = new FakeElement('body');
        this.append(this.body);
        this.activeElement = this.body;
        this._listeners = new Map();
        this.fonts = { ready: Promise.resolve() };
    }
    createElement (tag) {
        const t = tag.toLowerCase();
        if (t === 'input') return new FakeInputElement();
        if (t === 'button') return new FakeButtonElement();
        if (t === 'dialog') return new FakeDialogElement();
        if (t === 'form') return new FakeFormElement();
        return new FakeElement(t);
    }
    getElementById (id) {
        if (!id) return null;
        return queryAll(this, `[id="${id}"]`)[0] ?? null;
    }
    createTreeWalker (root) {
        const texts = [];
        const walk = node => {
            for (const c of node.childNodes) {
                if (c instanceof TextNode) texts.push(c);
                else if (c instanceof FakeElement) walk(c);
            }
        };
        walk(root);
        let idx = -1;
        return {
            currentNode: null,
            nextNode () {
                idx++;
                if (idx >= texts.length) return false;
                this.currentNode = texts[idx];
                return true;
            }
        };
    }
    addEventListener (type, fn, opts) {
        const capture = typeof opts === 'boolean' ? opts : Boolean(opts?.capture);
        const once = typeof opts === 'object' && Boolean(opts?.once);
        if (!this._listeners.has(type)) this._listeners.set(type, []);
        this._listeners.get(type).push({ fn, capture, once });
    }
    dispatchOn (target, event) {
        event.target = target;
        const list = [...(this._listeners.get(event.type) ?? [])];
        for (const phase of [true, false]) {
            for (const entry of list) {
                if (entry.capture !== phase) continue;
                if (entry.once) {
                    const arr = this._listeners.get(event.type);
                    const i = arr.indexOf(entry);
                    if (i !== -1) arr.splice(i, 1);
                }
                entry.fn(event);
                if (event._stoppedImmediate) return !event.defaultPrevented;
            }
        }
        return !event.defaultPrevented;
    }
    dispatchEvent (event) {
        return this.dispatchOn(this, event);
    }
}

let resizeCallback = null;
const observed = new Set();
const rafQueue = [];

globalThis.Element = FakeElement;
globalThis.HTMLInputElement = FakeInputElement;
globalThis.HTMLButtonElement = FakeButtonElement;
globalThis.HTMLDialogElement = FakeDialogElement;
globalThis.HTMLFormElement = FakeFormElement;
globalThis.Event = FakeEvent;
globalThis.NodeFilter = { SHOW_TEXT: 4 };
globalThis.CSS = {
    supports: () => false,
    escape: s => String(s).replace(/([^\w-])/g, '\\$1')
};
globalThis.ResizeObserver = class {
    constructor (cb) { resizeCallback = cb; }
    observe (el) { observed.add(el); }
};
globalThis.getComputedStyle = el => ({
    paddingLeft: el._paddingLeft ?? '0px',
    paddingRight: el._paddingRight ?? '0px'
});
globalThis.requestAnimationFrame = fn => { rafQueue.push(fn); };

globalThis.document = new FakeDocument();

function flushRaf () {
    while (rafQueue.length) rafQueue.shift()();
}

function el (tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (k === 'value') node.value = v;
        else if (k === 'checked') node.checked = v;
        else if (k === 'disabled') node.disabled = v;
        else if (k === 'readOnly') node.readOnly = v;
        else if (k === 'inputMode') node.inputMode = v;
        else if (k === 'min') node.min = v;
        else if (k === 'max') node.max = v;
        else if (k === 'hidden') node.hidden = v;
        else node.setAttribute(k, v);
    }
    for (const child of children) node.append(child);
    return node;
}

await import('../src/general.js');

test('DOMContentLoaded boot and readyState != loading', async () => {
    document.body.replaceChildren();
    const dlg = el('dialog', { 'data-open': '' });
    document.body.append(dlg);
    document.dispatchEvent(new FakeEvent('DOMContentLoaded'));
    assert.equal(dlg.open, true);
    assert.equal(dlg.hasAttribute('data-open'), false);
    // Already-open dialog stays open
    dlg.setAttribute('data-open', '');
    globalThis.mtt.refresh(dlg);
    assert.equal(dlg.open, true);
});

test('DDL bug fixes: preselection hydration, swatch-only survival, settle, and form reset', () => {
    document.body.replaceChildren();
    const form = el('form');

    // 1. Preselected single-choice DDL with NO value attribute on visible input
    const ddl = el('input', { role: 'combobox', 'aria-controls': 'mc', inputMode: 'none' });
    const hidden = el('input', { type: 'hidden', name: 'marker', value: '3' });
    const label = el('label', {}, ['Marker', ddl, hidden]);
    const optNone = el('li', { role: 'option', id: 'mc-none', 'data-value': '' }, ['None']);
    const opt1 = el('li', { role: 'option', id: 'mc-1', 'data-value': '1' }, [
        el('span', { class: 'swatch', style: '--color: var(--color-category-1)' }),
        'Personal'
    ]);
    const opt3 = el('li', { role: 'option', id: 'mc-3', 'data-value': '3' }, [
        el('span', { class: 'swatch', style: '--color: var(--color-category-3)' }),
        'Alerts'
    ]);
    const list = el('ul', { role: 'listbox', id: 'mc', popover: 'manual' }, [optNone, opt1, opt3]);

    // 2. Swatch-only DDL option (no textContent at all!)
    const ddlEmpty = el('input', { role: 'combobox', 'aria-controls': 'so', inputMode: 'none' });
    const hiddenEmpty = el('input', { type: 'hidden', name: 'so', value: '5' });
    const labelEmpty = el('label', {}, ['Swatch only', ddlEmpty, hiddenEmpty]);
    const opt5 = el('li', { role: 'option', id: 'so-5', 'data-value': '5' }, [
        el('span', { class: 'swatch', style: '--color: var(--color-category-5)' })
    ]);
    const listEmpty = el('ul', { role: 'listbox', id: 'so', popover: 'manual' }, [opt5]);

    // 3. Single-choice DDL with empty value and no nothing option
    const ddlNoNothing = el('input', { role: 'combobox', 'aria-controls': 'nn', inputMode: 'none' });
    const hiddenNoNothing = el('input', { type: 'hidden', name: 'nn', value: '' });
    const listNoNothing = el('ul', { role: 'listbox', id: 'nn', popover: 'manual' }, [
        el('li', { role: 'option', id: 'nn-1', 'data-value': '1' }, ['One'])
    ]);

    form.append(label, list, labelEmpty, listEmpty, ddlNoNothing, hiddenNoNothing, listNoNothing);
    document.body.append(form);

    globalThis.mtt.refresh(form);

    // Preselection hydrated visible input, aria-current, AND mirrored swatch!
    assert.equal(ddl.value, 'Alerts');
    assert.equal(opt3.getAttribute('aria-current'), 'true');
    assert.equal(label.querySelector(':scope > [data-mtt-lead]')?.className, 'swatch');
    assert.equal(ddlNoNothing.value, '');

    // Swatch-only DDL keeps value="5" on focusout AND submit!
    assert.equal(ddlEmpty.value, '');
    assert.equal(opt5.getAttribute('aria-current'), 'true');
    assert.equal(labelEmpty.querySelector(':scope > [data-mtt-lead]')?.className, 'swatch');

    ddlEmpty.dispatchEvent(new FakeEvent('focusout', { bubbles: true }));
    assert.equal(hiddenEmpty.value, '5');
    assert.equal(labelEmpty.querySelector(':scope > [data-mtt-lead]')?.className, 'swatch');

    form.dispatchEvent(new FakeEvent('submit', { bubbles: true }));
    assert.equal(hiddenEmpty.value, '5');

    // Selecting empty reset option works on dropdown and keeps label "None"
    optNone.dispatchEvent(new FakeEvent('click', { bubbles: true }));
    assert.equal(hidden.value, '');
    assert.equal(ddl.value, 'None');
    assert.equal(label.querySelector(':scope > [data-mtt-lead]'), null);

    // Focusout on dropdown with no current option sets empty value
    ddlNoNothing.dispatchEvent(new FakeEvent('focusout', { bubbles: true }));
    assert.equal(ddlNoNothing.value, '');

    // Form reset re-hydrates single-choice DDL via refresh()
    hidden.value = '1';
    ddl.value = '';
    form.dispatchEvent(new FakeEvent('reset', { bubbles: true }));
    flushRaf();
    assert.equal(ddl.value, 'Personal');
    assert.equal(opt1.getAttribute('aria-current'), 'true');
});

test('Swatch picker (popover reusing .swatches) without CSS resolution in JS', () => {
    document.body.replaceChildren();
    const form = el('form');

    const btn = el('button', { type: 'button', class: 'picker', popovertarget: 'pal' }, ['Choose…']);
    const label = el('label', {}, ['Color', btn]);

    const rNone = el('input', { type: 'radio', name: 'c', value: '', 'aria-label': 'None' });
    const r3 = el('input', {
        type: 'radio', name: 'c', value: '3', checked: true,
        style: '--color: var(--color-category-3); --name: var(--color-category-3-name); margin: 4px'
    });
    const rClass = el('input', { type: 'radio', name: 'c', value: '4', class: 'cat-4', 'data-label': 'Coral' });
    const rBare = el('input', { type: 'radio', name: 'c', value: '5', style: '--color: var(--color-category-5)' });
    const rDisabled = el('input', { type: 'radio', name: 'c', value: '6', disabled: true, style: '--color: var(--color-category-6)' });
    const swatches = el('div', { class: 'swatches', id: 'pal', role: 'radiogroup', popover: '' }, [
        rNone, r3, rClass, rBare, rDisabled
    ]);

    // Button pointing to missing or non-swatches popover
    const badBtn1 = el('button', { type: 'button', class: 'picker', popovertarget: 'missing' });
    const badBtn2 = el('button', { type: 'button', class: 'picker', popovertarget: '' });
    const otherPop = el('div', { id: 'not-swatches', popover: '' });
    const badBtn3 = el('button', { type: 'button', class: 'picker', popovertarget: 'not-swatches' });
    // Swatches without id
    const noIdSwatches = el('div', { class: 'swatches', popover: '' }, [
        el('input', { type: 'radio', name: 'x', value: '1' })
    ]);
    // Swatches with id but no trigger button
    const orphanSwatches = el('div', { class: 'swatches', id: 'orphan', popover: '' }, [
        el('input', { type: 'radio', name: 'o', value: '1' })
    ]);

    form.append(label, swatches, badBtn1, badBtn2, otherPop, badBtn3, noIdSwatches, orphanSwatches);
    document.body.append(form);

    // Sync on refresh
    globalThis.mtt.refresh(form);
    assert.equal(btn.getAttribute('aria-expanded'), 'false');
    assert.equal(btn.hasAttribute('data-mtt-empty'), false);
    const valSpan = btn.querySelector('[data-mtt-value]');
    assert.equal(valSpan.style.getPropertyValue('--color'), 'var(--color-category-3)');
    assert.equal(valSpan.style.getPropertyValue('--name'), 'var(--color-category-3-name)');
    assert.equal(valSpan.style.getPropertyValue('margin'), ''); // non-custom prop NOT copied
    assert.equal(valSpan.querySelector('.swatch')?.getAttribute('aria-hidden'), 'true');
    assert.equal(valSpan.querySelector('[data-mtt-name]')?.hasAttribute('data-label'), false);

    // Scoped refresh directly on .swatches[popover]
    r3.checked = false;
    rClass.checked = true;
    globalThis.mtt.refresh(swatches);
    assert.equal(btn.querySelector('[data-mtt-value]')?.className, 'cat-4');
    assert.equal(btn.querySelector('[data-mtt-name]')?.dataset.label, 'Coral');
    assert.ok(btn.querySelector('.swatch'));

    // Swatch-only radio (no --name, no label)
    rClass.checked = false;
    rBare.checked = true;
    rBare.dispatchEvent(new FakeEvent('change', { bubbles: true }));
    assert.ok(btn.querySelector('.swatch'));
    assert.equal(btn.querySelector('[data-mtt-name]')?.dataset.label, undefined);
    assert.equal(btn.hasAttribute('data-mtt-empty'), false);

    // "None" radio (value="", no --color, aria-label="None")
    rBare.checked = false;
    rNone.checked = true;
    rNone.dispatchEvent(new FakeEvent('change', { bubbles: true }));
    assert.equal(btn.querySelector('.swatch'), null);
    assert.equal(btn.querySelector('[data-mtt-name]')?.dataset.label, 'None');
    assert.equal(btn.hasAttribute('data-mtt-empty'), true);

    // Nothing checked -> uses original placeholder text
    rNone.checked = false;
    globalThis.mtt.refresh(btn);
    assert.equal(btn.querySelector('.swatch'), null);
    assert.equal(btn.querySelector('[data-mtt-name]')?.dataset.label, 'Choose…');
    assert.equal(btn.hasAttribute('data-mtt-empty'), true);

    // Placeholder via data-placeholder attribute
    const btn2 = el('button', { type: 'button', class: 'picker', popovertarget: 'pal', 'data-placeholder': 'Pick' });
    document.body.append(btn2);
    globalThis.mtt.refresh(btn2);
    assert.equal(btn2.querySelector('[data-mtt-name]')?.dataset.label, 'Pick');
    btn2.remove();

    // Non-radio change and radio outside .swatches[popover] are ignored
    const plainRadio = el('input', { type: 'radio', name: 'plain', value: 'a' });
    document.body.append(plainRadio);
    plainRadio.dispatchEvent(new FakeEvent('change', { bubbles: true }));
    el('input', { type: 'text' }).dispatchEvent(new FakeEvent('change', { bubbles: true }));
    orphanSwatches.querySelector('input').dispatchEvent(new FakeEvent('change', { bubbles: true }));

    // beforetoggle + toggle focus management (none checked -> focuses first enabled radio)
    swatches.showPopover();
    assert.equal(btn.getAttribute('aria-expanded'), 'true');
    assert.equal(document.activeElement, rNone);

    // Toggle when a radio IS checked -> focuses checked radio
    swatches.hidePopover();
    assert.equal(btn.getAttribute('aria-expanded'), 'false');
    r3.checked = true;
    swatches.showPopover();
    assert.equal(document.activeElement, r3);

    // Non-swatches toggle/beforetoggle ignored
    otherPop.showPopover();
    document.dispatchOn(new TextNode('x'), new FakeEvent('beforetoggle', { newState: 'open' }));
    document.dispatchOn(new TextNode('x'), new FakeEvent('toggle', { newState: 'open' }));

    // Clicking a swatch with mouse (detail > 0) closes popover & focuses trigger
    rBare.dispatchEvent(new FakeEvent('click', { bubbles: true, detail: 1 }));
    assert.equal(swatches._popoverOpen, false);
    assert.equal(document.activeElement, btn);

    // Clicking when already closed, or detail === 0, or disabled does not break/close
    rBare.dispatchEvent(new FakeEvent('click', { bubbles: true, detail: 1 }));
    swatches.showPopover();
    rBare.dispatchEvent(new FakeEvent('click', { bubbles: true, detail: 0 }));
    assert.equal(swatches._popoverOpen, true);
    rDisabled.dispatchEvent(new FakeEvent('click', { bubbles: true, detail: 1 }));
    assert.equal(swatches._popoverOpen, true);

    // Keyboard Enter checks unchecked radio, dispatches change, closes popover & focuses trigger
    r3.checked = false;
    rBare.checked = false;
    const enterEvt = new FakeEvent('keydown', { bubbles: true, key: 'Enter' });
    rBare.dispatchEvent(enterEvt);
    assert.equal(enterEvt.defaultPrevented, true);
    assert.equal(rBare.checked, true);
    assert.equal(swatches._popoverOpen, false);
    assert.equal(document.activeElement, btn);

    // Keyboard Enter on already-checked, disabled, closed popover, or non-Enter key
    rBare.dispatchEvent(new FakeEvent('keydown', { bubbles: true, key: 'Enter' })); // already closed
    swatches.showPopover();
    rBare.dispatchEvent(new FakeEvent('keydown', { bubbles: true, key: 'ArrowRight' }));
    assert.equal(swatches._popoverOpen, true);
    rDisabled.dispatchEvent(new FakeEvent('keydown', { bubbles: true, key: 'Enter' }));
    assert.equal(rDisabled.checked, false);
    assert.equal(swatches._popoverOpen, false);

    // Invalid event on required radio inside closed .swatches[popover] opens it and reports validity
    const invEvt = new FakeEvent('invalid');
    r3.dispatchEvent(invEvt);
    assert.equal(invEvt.defaultPrevented, true);
    assert.equal(swatches._popoverOpen, true);
    flushRaf();
    assert.equal(r3.reportedValidity, 1);

    // Invalid event when already open or on non-radio is ignored
    const invOpen = new FakeEvent('invalid');
    r3.dispatchEvent(invOpen);
    assert.equal(invOpen.defaultPrevented, false);
    plainRadio.dispatchEvent(new FakeEvent('invalid'));
    el('input', { type: 'text' }).dispatchEvent(new FakeEvent('invalid'));
});

test('Tabs, ResizeObserver, revealChosen, sparks, meters, ranges, dialogs', async () => {
    document.body.replaceChildren();

    // Tabs + panels + disabled tab + horizontal scroll reveal
    const panel1 = el('div', { id: 'p1' });
    const panel2 = el('div', { id: 'p2', hidden: true });
    const t1 = el('button', { role: 'tab', 'aria-controls': 'p1', 'aria-selected': 'true' });
    const t2 = el('button', { role: 'tab', 'aria-controls': 'p2', 'aria-selected': 'false' });
    const t3 = el('button', { role: 'tab', 'aria-selected': 'false' });
    const tDis = el('button', { role: 'tab', disabled: true });
    t1._rect = { left: -20, right: 40 };
    t2._rect = { left: 120, right: 180 };
    t3._rect = { left: 20, right: 80 };
    t1.offsetLeft = 10; t1.offsetWidth = 50;
    t2.offsetLeft = 70; t2.offsetWidth = 60;
    const tablist = el('div', { role: 'tablist' }, [t1, t2, t3, tDis]);
    tablist._rect = { left: 0, right: 100 };

    // Empty tablist (no selected, no enabled)
    const emptyTablist = el('div', { role: 'tablist' }, [el('button', { role: 'tab', disabled: true })]);
    // Tablist with no aria-selected (falls back to first enabled)
    const fallbackTablist = el('div', { role: 'tablist' }, [el('button', { role: 'tab' })]);

    // Sparks
    const sLabeled = el('div', { class: 'spark', 'aria-label': 'Trend', 'data-values': '10, 20, -5, foo' });
    const sRole = el('div', { class: 'spark', 'aria-labelledby': 'x', role: 'img', 'data-values': '0, 0' });
    const sUnlabeled = el('div', { class: 'spark', 'data-values': '   ' });
    const sHidden = el('div', { class: 'spark', 'aria-hidden': 'true' });

    // Meters
    const m1 = el('div', { role: 'meter', 'aria-valuenow': '40', 'aria-valuemin': '0', 'aria-valuemax': '80' });
    const m2 = el('div', { role: 'meter', 'aria-valuenow': '', 'aria-valuemin': '10', 'aria-valuemax': '10' });

    // Ranges
    const r1 = el('input', { type: 'range', min: '0', max: '10', value: '5' });
    const r2 = el('input', { type: 'range', value: '50' });
    const r3 = el('input', { type: 'range', min: '5', max: '5', value: '5' });

    // Dialog + commandfor polyfill + close focus return
    const opener = el('button', { commandfor: 'dlg1', command: 'show-modal' });
    const closer = el('button', { commandfor: 'dlg1', command: 'close' });
    const noopBtn = el('button', { commandfor: 'dlg1', command: 'other' });
    const badCmd = el('button', { commandfor: 'p1', command: 'show-modal' });
    const dlg = el('dialog', { id: 'dlg1' }, [closer]);

    document.body.append(
        tablist, panel1, panel2, emptyTablist, fallbackTablist,
        sLabeled, sRole, sUnlabeled, sHidden,
        m1, m2, r1, r2, r3,
        opener, noopBtn, badCmd, dlg
    );

    globalThis.mtt.refresh();
    await document.fonts.ready;

    assert.equal(tablist.style.getPropertyValue('--mtt-tab-left'), '10px');
    assert.equal(sLabeled.getAttribute('role'), 'img');
    assert.equal(sLabeled.children.length, 4);
    assert.equal(sRole.children[0].style.height, '0%');
    assert.equal(sUnlabeled.getAttribute('aria-hidden'), 'true');
    assert.equal(m1.style.getPropertyValue('--value'), '50%');
    assert.equal(m2.style.getPropertyValue('--value'), '0%');
    assert.equal(r1.style.getPropertyValue('--value'), '50%');
    assert.equal(r2.style.getPropertyValue('--value'), '50%');
    assert.equal(r3.style.getPropertyValue('--value'), '0%');

    // ResizeObserver callback
    resizeCallback([{ target: t1 }, { target: document.body }]);

    // Tab clicks + keyboard navigation
    tDis.dispatchEvent(new FakeEvent('click', { bubbles: true }));
    assert.equal(t1.getAttribute('aria-selected'), 'true');
    t2.dispatchEvent(new FakeEvent('click', { bubbles: true }));
    assert.equal(t2.getAttribute('aria-selected'), 'true');
    assert.equal(panel1.hidden, true);
    assert.equal(panel2.hidden, false);

    t2.dispatchEvent(new FakeEvent('keydown', { bubbles: true, key: 'ArrowRight' }));
    assert.equal(t3.getAttribute('aria-selected'), 'true');
    t3.dispatchEvent(new FakeEvent('keydown', { bubbles: true, key: 'ArrowLeft' }));
    assert.equal(t2.getAttribute('aria-selected'), 'true');
    t2.dispatchEvent(new FakeEvent('keydown', { bubbles: true, key: 'Home' }));
    assert.equal(t1.getAttribute('aria-selected'), 'true');
    t1.dispatchEvent(new FakeEvent('keydown', { bubbles: true, key: 'End' }));
    assert.equal(t3.getAttribute('aria-selected'), 'true');
    t3.dispatchEvent(new FakeEvent('keydown', { bubbles: true, key: 'a' }));
    tDis.dispatchEvent(new FakeEvent('keydown', { bubbles: true, key: 'ArrowRight' }));

    // Range input event
    r1.value = '8';
    r1.dispatchEvent(new FakeEvent('input', { bubbles: true }));
    assert.equal(r1.style.getPropertyValue('--value'), '80%');

    // Dialog commandfor polyfill + close focus restoration
    opener.dispatchEvent(new FakeEvent('click', { bubbles: true }));
    assert.equal(dlg.open, true);
    closer.focus();
    closer.dispatchEvent(new FakeEvent('click', { bubbles: true }));
    assert.equal(dlg.open, false);
    assert.equal(document.activeElement, opener);

    // Close when focus is outside dialog or non-dialog target does not steal focus
    noopBtn.dispatchEvent(new FakeEvent('click', { bubbles: true }));
    badCmd.dispatchEvent(new FakeEvent('click', { bubbles: true }));
    document.body.dispatchEvent(new FakeEvent('click', { bubbles: true }));
    document.dispatchOn(new TextNode('x'), new FakeEvent('click'));
    document.dispatchOn(new TextNode('x'), new FakeEvent('keydown'));
    document.dispatchOn(new TextNode('x'), new FakeEvent('mousedown'));
    panel1.dispatchEvent(new FakeEvent('close'));
    t1.focus();
    dlg.dispatchEvent(new FakeEvent('close'));
    assert.equal(document.activeElement, t1);
});

test('Comboboxes: typed choice, free text, multiselect, filtering, marking, keyboard, submit, mousedown', () => {
    document.body.replaceChildren();
    const form = el('form');

    // Typed single-choice combobox with group presentation, duplicate value, and data-empty
    const cb = el('input', { role: 'combobox', 'aria-controls': 'tz' });
    const cbVal = el('input', { type: 'hidden', name: 'tz', value: 'EU/B' });
    const cbLabel = el('label', {}, ['Zone', cb, cbVal]);
    const grp = el('li', { role: 'presentation' }, ['Europe']);
    const o1 = el('li', { role: 'option', id: 'o1', 'data-value': 'EU/B', 'data-label': 'Berlin', 'data-find': 'cet' }, [
        el('span', {}, ['Berlin'])
    ]);
    const o2 = el('li', { role: 'option', id: 'o2', 'data-value': 'EU/B', 'aria-current': 'true' }, ['Berlin 2']);
    const o3 = el('li', { role: 'option', id: 'o3', 'data-value': 'EU/P' }, ['Paris']);
    const o4 = el('li', { role: 'option', id: 'o4' }, ['Rome']);
    const tzList = el('ul', { role: 'listbox', id: 'tz', popover: '', 'data-empty': 'None' }, [grp, o1, o2, o3, o4]);

    // Free-text combobox (no hidden input) + search type (syncLead skips search)
    const free = el('input', { role: 'combobox', 'aria-controls': 'flist' });
    const freeSearch = el('input', { role: 'combobox', type: 'search', 'aria-controls': 'flist' });
    const fLabel = el('label', {}, [freeSearch]);
    const f1 = el('li', { role: 'option', id: 'f1' }, ['Alpha']);
    const f2 = el('li', { role: 'option' }, ['Beta']);
    const fList = el('ul', { role: 'listbox', id: 'flist', popover: 'manual' }, [f1, f2]);

    // Multi-select combobox
    const multi = el('input', { role: 'combobox', 'aria-controls': 'mlist' });
    const c1 = el('input', { type: 'checkbox', checked: true });
    const c2 = el('input', { type: 'checkbox' });
    const c3 = el('input', { type: 'checkbox', disabled: true });
    const m1 = el('li', { role: 'option', id: 'm1' }, [c1, 'One']);
    const m2 = el('li', { role: 'option', id: 'm2' }, [c2, 'Two']);
    const m3 = el('li', { role: 'option', id: 'm3' }, [c3, 'Three']);
    const m4 = el('li', { role: 'option', id: 'm4' }, ['NoBox']);
    const mList = el('ul', { role: 'listbox', id: 'mlist', 'aria-multiselectable': 'true', popover: 'manual' }, [m1, m2, m3, m4]);

    // Non-combobox input[role=combobox] (no popover on list) + plain input
    const fakeCb = el('input', { role: 'combobox', 'aria-controls': 'nopop' });
    const noPop = el('ul', { id: 'nopop' });
    const plain = el('input', { type: 'text' });

    form.append(cbLabel, tzList, free, fLabel, fList, multi, mList, fakeCb, noPop, plain);
    document.body.append(form);
    globalThis.mtt.refresh(form);

    // Marked duplicate preferred
    assert.equal(cb.value, 'Berlin 2');
    assert.equal(multi.value, 'One');

    // Suppress trusted change on choice combobox
    const trusted = new FakeEvent('change', { isTrusted: true });
    cb.dispatchEvent(trusted);
    assert.equal(trusted._stoppedImmediate, true);

    // beforeinput blocked on dropdown only
    const dd = el('input', { role: 'combobox', 'aria-controls': 'flist', inputMode: 'none' });
    document.body.append(dd);
    const bi = new FakeEvent('beforeinput');
    dd.dispatchEvent(bi);
    assert.equal(bi.defaultPrevented, true);
    const bi2 = new FakeEvent('beforeinput');
    cb.dispatchEvent(bi2);
    assert.equal(bi2.defaultPrevented, false);

    // Click combobox opens and selects text; dropdown click toggles closed
    cb.dispatchEvent(new FakeEvent('click', { bubbles: true }));
    assert.equal(cb.getAttribute('aria-expanded'), 'true');
    assert.equal(cb.selected, true);
    assert.equal(tzList.popover, 'manual');
    cb.dispatchEvent(new FakeEvent('click', { bubbles: true })); // non-dropdown stays open
    dd.dispatchEvent(new FakeEvent('click', { bubbles: true }));
    assert.equal(dd.getAttribute('aria-expanded'), 'true');
    dd.dispatchEvent(new FakeEvent('click', { bubbles: true }));
    assert.equal(dd.getAttribute('aria-expanded'), 'false');

    // Filter + mark (both wrapped span text and direct text node)
    cb.value = 'par';
    cb.dispatchEvent(new FakeEvent('input', { bubbles: true }));
    assert.equal(o3.hidden, false);
    assert.equal(o1.hidden, true);
    assert.equal(grp.hidden, false);
    assert.ok(o3.querySelector('mark'));

    cb.value = 'ber';
    cb.dispatchEvent(new FakeEvent('input', { bubbles: true }));
    assert.ok(o1.querySelector('mark'));

    // Settle via unique match, exact match, clear on empty, and revert on no match
    cb.value = 'par';
    cb.dispatchEvent(new FakeEvent('focusout', { bubbles: true }));
    assert.equal(cbVal.value, 'EU/P');
    assert.equal(cb.value, 'Paris');

    cb.value = 'zzz-nomatch';
    cb.dispatchEvent(new FakeEvent('focusout', { bubbles: true }));
    assert.equal(cb.value, 'Paris');

    cb.value = '';
    cb.dispatchEvent(new FakeEvent('focusout', { bubbles: true }));
    assert.equal(cbVal.value, '');
    assert.equal(cb.value, '');

    // Choosing option without data-value uses labelOf
    o4.dispatchEvent(new FakeEvent('click', { bubbles: true }));
    assert.equal(cbVal.value, 'Rome');

    // Free-text choice + search input
    f2.dispatchEvent(new FakeEvent('click', { bubbles: true }));
    assert.equal(free.value, 'Beta');
    free.dispatchEvent(new FakeEvent('focusout', { bubbles: true }));
    freeSearch.value = 'Alpha';
    globalThis.mtt.refresh(fLabel);

    // Multi-select toggling (normal, searched, disabled, no-box, focusout settle)
    m2.dispatchEvent(new FakeEvent('click', { bubbles: true }));
    assert.equal(c2.checked, true);
    assert.equal(multi.value, 'One, Two');
    multi.value = 'custom-search';
    m1.dispatchEvent(new FakeEvent('click', { bubbles: true }));
    assert.equal(multi.value, 'custom-search');
    m3.dispatchEvent(new FakeEvent('click', { bubbles: true }));
    m4.dispatchEvent(new FakeEvent('click', { bubbles: true }));
    multi.dispatchEvent(new FakeEvent('focusout', { bubbles: true }));
    assert.equal(multi.value, 'Two');

    // Multi-select with none checked
    c2.checked = false;
    multi.dispatchEvent(new FakeEvent('click', { bubbles: true }));

    // Keyboard nav on combobox and dropdown: ArrowDown/Up, PageDown/Up, Home/End, Escape, Enter, Space
    cb.dispatchEvent(new FakeEvent('keydown', { bubbles: true, key: 'ArrowDown' }));
    assert.equal(cb.getAttribute('aria-expanded'), 'true');
    cb.dispatchEvent(new FakeEvent('keydown', { bubbles: true, key: 'ArrowDown' }));
    cb.dispatchEvent(new FakeEvent('keydown', { bubbles: true, key: 'ArrowUp' }));
    cb.dispatchEvent(new FakeEvent('keydown', { bubbles: true, key: 'PageDown' }));
    cb.dispatchEvent(new FakeEvent('keydown', { bubbles: true, key: 'PageUp' }));
    cb.dispatchEvent(new FakeEvent('keydown', { bubbles: true, key: 'Escape' }));
    assert.equal(cb.getAttribute('aria-expanded'), 'false');

    // ArrowDown when active is null
    o1.offsetHeight = 0; // hit || 1 fallback
    cb.dispatchEvent(new FakeEvent('keydown', { bubbles: true, key: 'ArrowDown' }));
    cb.dispatchEvent(new FakeEvent('keydown', { bubbles: true, key: 'PageDown' }));
    cb.dispatchEvent(new FakeEvent('keydown', { bubbles: true, key: 'Enter' }));

    // Dropdown Home/End/Space/Enter
    dd.dispatchEvent(new FakeEvent('keydown', { bubbles: true, key: ' ' }));
    assert.equal(dd.getAttribute('aria-expanded'), 'true');
    dd.dispatchEvent(new FakeEvent('keydown', { bubbles: true, key: 'Home' }));
    dd.dispatchEvent(new FakeEvent('keydown', { bubbles: true, key: 'End' }));
    dd.dispatchEvent(new FakeEvent('keydown', { bubbles: true, key: 'Escape' }));
    dd.dispatchEvent(new FakeEvent('keydown', { bubbles: true, key: 'Enter' }));
    assert.equal(dd.getAttribute('aria-expanded'), 'true');
    // Space when open with no active closes dropdown
    fList.querySelectorAll('[role=option]').forEach(o => o.setAttribute('aria-selected', 'false'));
    dd.dispatchEvent(new FakeEvent('keydown', { bubbles: true, key: ' ' }));
    assert.equal(dd.getAttribute('aria-expanded'), 'false');

    // Mousedown inside listbox (prevents default) vs scrollbar drag (allows default) vs outside
    const md1 = new FakeEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 });
    o1.dispatchEvent(md1);
    assert.equal(md1.defaultPrevented, true);
    tzList._rect = { left: 0, top: 0, right: 220, bottom: 140 };
    tzList.clientWidth = 200;
    tzList.clientHeight = 120;
    const mdScrollX = new FakeEvent('mousedown', { bubbles: true, clientX: 210, clientY: 10 });
    tzList.dispatchEvent(mdScrollX);
    assert.equal(mdScrollX.defaultPrevented, false);
    const mdScrollY = new FakeEvent('mousedown', { bubbles: true, clientX: 10, clientY: 130 });
    tzList.dispatchEvent(mdScrollY);
    assert.equal(mdScrollY.defaultPrevented, false);
    const mdBody = new FakeEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 });
    tzList.dispatchEvent(mdBody);
    assert.equal(mdBody.defaultPrevented, true);
    plain.dispatchEvent(new FakeEvent('mousedown', { bubbles: true }));

    // Non-combobox events ignored
    plain.dispatchEvent(new FakeEvent('input', { bubbles: true }));
    plain.dispatchEvent(new FakeEvent('focusout', { bubbles: true }));
    plain.dispatchEvent(new FakeEvent('keydown', { bubbles: true, key: 'ArrowDown' }));
    document.body.dispatchEvent(new FakeEvent('reset', { bubbles: true }));

    // Submit with invalid combobox prevents default & calls reportValidity
    cb.valid = false;
    free.valid = false;
    const subEvt = new FakeEvent('submit', { bubbles: true });
    form.dispatchEvent(subEvt);
    assert.equal(subEvt.defaultPrevented, true);
    assert.equal(cb.reportedValidity, 1);

    // Submit with noValidate or submitter.formNoValidate skips validity check
    form.noValidate = true;
    const subNoVal = new FakeEvent('submit', { bubbles: true });
    form.dispatchEvent(subNoVal);
    assert.equal(subNoVal.defaultPrevented, false);
    form.noValidate = false;
    const subBtnNoVal = new FakeEvent('submit', { bubbles: true, submitter: { formNoValidate: true } });
    form.dispatchEvent(subBtnNoVal);
    assert.equal(subBtnNoVal.defaultPrevented, false);

    // Unmatched hidden value -> currentOf returns null; settle with gibberish resets to '' while closing open list
    cbVal.value = 'NONEXISTENT';
    cb.setAttribute('aria-expanded', 'true');
    cb.value = 'gibberish';
    cb.dispatchEvent(new FakeEvent('focusout', { bubbles: true }));
    assert.equal(cb.value, '');
    assert.equal(cb.getAttribute('aria-expanded'), 'false');

    // Filtering to 0 matches: with data-empty stays open; without data-empty closes
    cb.value = 'zzzz-no-match';
    cb.dispatchEvent(new FakeEvent('input', { bubbles: true }));
    assert.equal(cb.getAttribute('aria-expanded'), 'true');
    free.value = 'zzzz-no-match';
    free.dispatchEvent(new FakeEvent('input', { bubbles: true }));
    assert.equal(free.getAttribute('aria-expanded'), 'false');

    // ArrowDown and PageDown when open with NO active option
    cb.value = '';
    cb.dispatchEvent(new FakeEvent('input', { bubbles: true }));
    tzList.querySelectorAll('[role=option]').forEach(o => o.setAttribute('aria-selected', 'false'));
    cb.dispatchEvent(new FakeEvent('keydown', { bubbles: true, key: 'ArrowDown' }));
    tzList.querySelectorAll('[role=option]').forEach(o => o.setAttribute('aria-selected', 'false'));
    cb.dispatchEvent(new FakeEvent('keydown', { bubbles: true, key: 'PageDown' }));

    // Typed combobox with empty-label current option does NOT wipe on empty focusout
    const emptyOpt = el('li', { role: 'option', id: 'e1', 'data-value': '7' });
    const emptyList = el('ul', { role: 'listbox', id: 'elist', popover: 'manual' }, [emptyOpt]);
    const eCb = el('input', { role: 'combobox', 'aria-controls': 'elist' });
    const eHid = el('input', { type: 'hidden', value: '7' });
    document.body.append(eCb, eHid, emptyList);
    eCb.dispatchEvent(new FakeEvent('focusout', { bubbles: true }));
    assert.equal(eHid.value, '7');

    // Empty-value duplicate options prefer aria-current=true in nothingOf
    const n1 = el('li', { role: 'option', id: 'n1', 'data-value': '' }, ['A']);
    const n2 = el('li', { role: 'option', id: 'n2', 'data-value': '', 'aria-current': 'true' }, ['B']);
    const nList = el('ul', { role: 'listbox', id: 'nlist', popover: 'manual' }, [n1, n2]);
    const nCb = el('input', { role: 'combobox', 'aria-controls': 'nlist' });
    const nHid = el('input', { type: 'hidden', value: '' });
    document.body.append(nCb, nHid, nList);
    globalThis.mtt.refresh(nCb);
    assert.equal(nCb.value, 'B');
});

test('Clear button (data-clear) for pickers, DDLs, comboboxes, and multiselect', () => {
    document.body.replaceChildren();

    // 1. Swatch popover picker WITHOUT a "None" radio (pure 2x8 palette)
    const pBtn = el('button', { type: 'button', class: 'picker', popovertarget: 'p16', 'data-clear': 'Clear color' }, ['None']);
    const pLabel = el('label', {}, ['Palette', pBtn]);
    const pr1 = el('input', { type: 'radio', name: 'p16', value: '1', style: '--color: var(--color-category-1)' });
    const pr3 = el('input', { type: 'radio', name: 'p16', value: '3', checked: true, style: '--color: var(--color-category-3); --name: var(--color-category-3-name)' });
    const pSwatches = el('div', { class: 'swatches', id: 'p16', popover: '' }, [pr1, pr3]);

    // 2. Swatch popover picker WITH a value="" reset radio
    const pBtn2 = el('button', { type: 'button', class: 'picker', popovertarget: 'pReset', 'data-clear': '' }, ['None']);
    const pLabel2 = el('label', {}, ['Palette 2', pBtn2]);
    const prNone = el('input', { type: 'radio', name: 'pReset', value: '', 'aria-label': 'None' });
    const pr2 = el('input', { type: 'radio', name: 'pReset', value: '2', checked: true, style: '--color: var(--color-category-2)' });
    const pSwatches2 = el('div', { class: 'swatches', id: 'pReset', popover: '' }, [prNone, pr2]);

    // 3. Single-choice DDL with data-clear (no empty option)
    const ddl = el('input', { role: 'combobox', inputMode: 'none', 'aria-controls': 'cdl', 'data-clear': '' });
    const ddlHid = el('input', { type: 'hidden', name: 'cdl', value: '3' });
    const ddlLabel = el('label', {}, ['Marker', ddl, ddlHid]);
    const ddlList = el('ul', { role: 'listbox', id: 'cdl', popover: 'manual' }, [
        el('li', { role: 'option', id: 'cdl-3', 'data-value': '3' }, [
            el('span', { class: 'swatch', style: '--color: var(--color-category-3)' }),
            'Alerts'
        ])
    ]);

    // 4. Typed single-choice combobox with data-clear (clearable while typing too)
    const typed = el('input', { role: 'combobox', 'aria-controls': 'cty', 'data-clear': '' });
    const typedHid = el('input', { type: 'hidden', name: 'cty', value: '' });
    const typedLabel = el('label', {}, ['Typed', typed, typedHid]);
    const typedList = el('ul', { role: 'listbox', id: 'cty', popover: 'manual' }, [
        el('li', { role: 'option', id: 'cty-1', 'data-value': '1' }, ['Alpha'])
    ]);

    // 5. Free-text combobox with data-clear
    const free = el('input', { role: 'combobox', 'aria-controls': 'cfr', value: 'Custom', 'data-clear': '' });
    const freeLabel = el('label', {}, ['Free', free]);
    const freeList = el('ul', { role: 'listbox', id: 'cfr', popover: 'manual' }, [
        el('li', { role: 'option', id: 'cfr-1' }, ['One'])
    ]);

    // 6. Multi-select combobox with data-clear (mix of enabled + disabled checkboxes)
    const multi = el('input', { role: 'combobox', inputMode: 'none', 'aria-controls': 'cmu', 'data-clear': '' });
    const multiLabel = el('label', {}, ['Multi', multi]);
    const mc1 = el('input', { type: 'checkbox', checked: true });
    const mc2 = el('input', { type: 'checkbox', checked: true, disabled: true });
    const multiList = el('ul', { role: 'listbox', id: 'cmu', 'aria-multiselectable': 'true', popover: 'manual' }, [
        el('li', { role: 'option', id: 'cmu-1' }, [mc1, 'Enabled']),
        el('li', { role: 'option', id: 'cmu-2' }, [mc2, 'Locked']),
        el('li', { role: 'option', id: 'cmu-3' }, ['NoBox'])
    ]);

    // 7. Search combobox with data-clear (skipped) & standalone picker (no label)
    const search = el('input', { role: 'combobox', type: 'search', 'aria-controls': 'cfr', value: 'q', 'data-clear': '' });
    const searchLabel = el('label', {}, ['Search', search]);
    const standalone = el('button', { type: 'button', class: 'picker', popovertarget: 'p16', 'data-clear': '' });

    // 8. Orphan clear button inside label with no matching control
    const orphanClear = el('button', { type: 'button', 'data-mtt-clear': '' });
    const orphanLabel = el('label', {}, [orphanClear]);

    document.body.append(
        pLabel, pSwatches, pLabel2, pSwatches2,
        ddlLabel, ddlList, typedLabel, typedList,
        freeLabel, freeList, multiLabel, multiList,
        searchLabel, standalone, orphanLabel
    );
    globalThis.mtt.refresh();

    // Picker 1: clear button exists with custom aria-label, visible while pr3 is checked
    const pClear = pLabel.querySelector('button[data-mtt-clear]');
    assert.equal(pClear.getAttribute('aria-label'), 'Clear color');
    assert.equal(pClear.hidden, false);

    // Mousedown on clear button prevents default focus loss
    const mdClear = new FakeEvent('mousedown', { bubbles: true });
    pClear.dispatchEvent(mdClear);
    assert.equal(mdClear.defaultPrevented, true);

    // Clicking clear button while popover open unchecks pr3, closes popover, focuses pBtn, hides clear button
    pSwatches.showPopover();
    let p16Changed = 0;
    document.addEventListener('change', e => { if (e.target === pr3) p16Changed++; });
    const pClick = new FakeEvent('click', { bubbles: true });
    pClear.dispatchEvent(pClick);
    assert.equal(pClick.defaultPrevented, true);
    assert.equal(pr3.checked, false);
    assert.equal(pSwatches._popoverOpen, false);
    assert.equal(pBtn.hasAttribute('data-mtt-empty'), true);
    assert.equal(pClear.hidden, true);
    assert.equal(document.activeElement, pBtn);
    assert.equal(p16Changed, 1);

    // Clicking clear button again when nothing checked is a safe no-op
    pClear.dispatchEvent(new FakeEvent('click', { bubbles: true }));

    // Disabled picker hides clear button and ignores clear
    pr1.checked = true;
    pBtn.disabled = true;
    globalThis.mtt.refresh(pLabel);
    assert.equal(pClear.hidden, true);
    pClear.dispatchEvent(new FakeEvent('click', { bubbles: true }));
    assert.equal(pr1.checked, true);
    pBtn.disabled = false;

    // Removing data-clear removes the clear button on refresh
    pBtn.removeAttribute('data-clear');
    globalThis.mtt.refresh(pLabel);
    assert.equal(pLabel.querySelector('button[data-mtt-clear]'), null);

    // Picker 2: clicking clear selects value="" reset radio
    const pClear2 = pLabel2.querySelector('button[data-mtt-clear]');
    assert.equal(pClear2.getAttribute('aria-label'), 'Clear');
    assert.equal(pClear2.hidden, false);
    pClear2.dispatchEvent(new FakeEvent('click', { bubbles: true }));
    assert.equal(prNone.checked, true);
    assert.equal(pClear2.hidden, true);

    // Single-choice DDL: clear button sits AFTER hidden input (preserving valueOf) and clears both hidden + visible + swatch
    const ddlClear = ddlLabel.querySelector('button[data-mtt-clear]');
    assert.equal(ddl.nextElementSibling, ddlHid);
    assert.equal(ddlClear.hidden, false);
    ddlClear.dispatchEvent(new FakeEvent('click', { bubbles: true }));
    assert.equal(ddlHid.value, '');
    assert.equal(ddl.value, '');
    assert.equal(ddlLabel.querySelector('[data-mtt-lead]'), null);
    assert.equal(ddlClear.hidden, true);

    // Typed single-choice combobox: hidden while empty, visible while typing, cleared by clicking
    const typedClear = typedLabel.querySelector('button[data-mtt-clear]');
    assert.equal(typedClear.hidden, true);
    typed.value = 'Alp';
    typed.dispatchEvent(new FakeEvent('input', { bubbles: true }));
    assert.equal(typedClear.hidden, false);
    typedClear.dispatchEvent(new FakeEvent('click', { bubbles: true }));
    assert.equal(typed.value, '');
    assert.equal(typedClear.hidden, true);

    // Free-text combobox: clears value and dispatches change; second clear does not dispatch change
    const freeClear = freeLabel.querySelector('button[data-mtt-clear]');
    assert.equal(freeClear.hidden, false);
    let freeChanges = 0;
    document.addEventListener('change', e => { if (e.target === free) freeChanges++; });
    freeClear.dispatchEvent(new FakeEvent('click', { bubbles: true }));
    assert.equal(free.value, '');
    assert.equal(freeClear.hidden, true);
    assert.equal(freeChanges, 1);
    freeClear.dispatchEvent(new FakeEvent('click', { bubbles: true }));
    assert.equal(freeChanges, 1);

    // Disabled combobox hides clear button and ignores clear
    free.value = 'Locked';
    free.disabled = true;
    globalThis.mtt.refresh(freeLabel);
    assert.equal(freeClear.hidden, true);
    freeClear.dispatchEvent(new FakeEvent('click', { bubbles: true }));
    assert.equal(free.value, 'Locked');

    // Multi-select: clears enabled checked boxes, preserves disabled checked box, hides clear when only disabled remain
    const multiClear = multiLabel.querySelector('button[data-mtt-clear]');
    assert.equal(multiClear.hidden, false);
    multiClear.dispatchEvent(new FakeEvent('click', { bubbles: true }));
    assert.equal(mc1.checked, false);
    assert.equal(mc2.checked, true);
    assert.equal(multi.value, 'Locked');
    assert.equal(multiClear.hidden, true);

    // Search combobox gets no injected clear button; orphan clear button click is a no-op
    assert.equal(searchLabel.querySelector('button[data-mtt-clear]'), null);
    orphanClear.dispatchEvent(new FakeEvent('click', { bubbles: true }));
});
