// Each input source owns its hold. Releasing one finger (or a keyboard key)
// must not release another finger holding the same action.
export function createDrivingInput(keys, buttons, {
  windowTarget = window, documentTarget = document, canDrive = () => true,
} = {}) {
  const keyboard = new Set();
  const pointers = new Map();
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
    if (hold?.button.hasPointerCapture(pointerId)) hold.button.releasePointerCapture(pointerId);
    sync();
  };
  const clear = () => {
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
    listen(button, 'pointerdown', event => {
      if ((event.pointerType === 'mouse' && event.button !== 0) || !canDrive()) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { key: button.dataset.key, button });
      sync();
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      listen(button, type, event => releasePointer(event.pointerId));
    }
    listen(button, 'contextmenu', event => event.preventDefault());
  }
  listen(windowTarget, 'blur', clear);
  listen(windowTarget, 'pagehide', clear);
  listen(windowTarget, 'orientationchange', clear);
  listen(documentTarget, 'visibilitychange', () => { if (documentTarget.hidden) clear(); });
  sync();
  return { clear, destroy() { clear(); disposers.forEach(dispose => dispose()); } };
}
