import { bindContacts } from './contact-input.mjs?v=20261003-iphone-touch';
import { createWheelInput } from './wheel-input.mjs?v=20261003-iphone-touch';

// Each input source owns its hold. Releasing one finger (or a keyboard key)
// must not release another finger holding the same action.
export function createDrivingInput(keys, buttons, {
  windowTarget = window, documentTarget = document, canDrive = () => true,
  wheel = null, getSteering = () => 0,
} = {}) {
  const wheelInput = wheel ? createWheelInput(wheel, { canDrive, getSteering, windowTarget, documentTarget }) : null;
  const keyboard = new Set();
  const pointers = new Map();
  const contacts = [];
  const actions = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ']);
  const disposers = [];
  const listen = (target, type, callback, options) => {
    target.addEventListener(type, callback, options);
    disposers.push(() => target.removeEventListener(type, callback, options));
  };
  const sync = () => {
    for (const key of actions) keys[key] = keyboard.has(key) || [...pointers.values()].some(hold => hold.key === key);
    for (const button of buttons) {
      button.classList.toggle('held', !!keys[button.dataset.key]);
      button.setAttribute('aria-pressed', String(!!keys[button.dataset.key]));
    }
  };
  const releasePointer = pointerId => {
    const hold = pointers.get(pointerId);
    pointers.delete(pointerId);
    hold?.contact.release(pointerId);
    sync();
  };
  const clear = () => {
    wheelInput?.clear();
    keyboard.clear();
    for (const pointerId of [...pointers.keys()]) releasePointer(pointerId);
    sync();
  };
  const isEditing = target => target?.matches?.('input, textarea, select, [contenteditable="true"]');
  listen(windowTarget, 'keydown', event => {
    if (!actions.has(event.key) || isEditing(event.target) || !canDrive()) return;
    // Space on a focused native button must retain its normal activation.
    if (event.key === ' ' && event.target?.closest?.('button')) return;
    event.preventDefault();
    keyboard.add(event.key);
    sync();
  });
  listen(windowTarget, 'keyup', event => { keyboard.delete(event.key); sync(); });
  for (const button of buttons) {
    const contact = bindContacts(button, { windowTarget, documentTarget,
      start(id) {
        if (!canDrive()) return false;
        pointers.set(id, { key: button.dataset.key, button, contact });
        sync();
        return true;
      },
      end: releasePointer,
    });
    contacts.push(contact);
    listen(button, 'contextmenu', event => event.preventDefault());
  }
  listen(windowTarget, 'blur', clear);
  listen(windowTarget, 'pagehide', clear);
  listen(windowTarget, 'orientationchange', clear);
  listen(documentTarget, 'visibilitychange', () => { if (documentTarget.hidden) clear(); });
  sync();
  return {
    get steering() { return wheelInput?.value ?? null; },
    clear,
    rebaseWheel() { wheelInput?.rebase(); },
    destroy() { clear(); wheelInput?.destroy(); contacts.forEach(contact => contact.destroy()); disposers.forEach(dispose => dispose()); },
  };
}

