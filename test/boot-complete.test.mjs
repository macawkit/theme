import test from 'node:test';
import assert from 'node:assert/strict';

// Covers the readyState !== 'loading', native metersInCSS, and native commandForElement branches.
class MinimalElement {
    matches () { return false; }
    querySelectorAll () { return []; }
    closest () { return null; }
}
class MinimalButton extends MinimalElement {}
MinimalButton.prototype.commandForElement = null;

globalThis.Element = MinimalElement;
globalThis.HTMLInputElement = class extends MinimalElement {};
globalThis.HTMLButtonElement = MinimalButton;
globalThis.HTMLDialogElement = class extends MinimalElement {};
globalThis.HTMLFormElement = class extends MinimalElement {};
globalThis.CSS = { supports: () => true, escape: s => s };
globalThis.ResizeObserver = class { observe () {} };
globalThis.matchMedia = () => ({ addEventListener () {} });
const listeners = new Map();
globalThis.document = {
    readyState: 'complete',
    fonts: { ready: Promise.resolve() },
    querySelectorAll: () => [],
    addEventListener: (type, fn) => {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(fn);
    }
};

await import('../src/general.js');

test('boots immediately when document.readyState is complete', () => {
    assert.equal(typeof globalThis.mtt.refresh, 'function');
    globalThis.mtt.refresh();
    for (const fn of listeners.get('click') ?? [])
        fn({ target: new MinimalElement() });
});
