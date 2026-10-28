// Touch Events retain the original target for the whole finger gesture. Prefer
// that path on touch-capable browsers, avoiding rotating-element pointer capture
// differences in iOS/WebKit. Mouse and pen still use Pointer Events.
export function bindContacts(element, { windowTarget, documentTarget, start, move = () => {}, end }) {
  const touchEvents = 'ontouchstart' in windowTarget;
  const active = new Map(), disposers = [], seen = new WeakSet();
  let lastTouch = -Infinity;
  const listen = (target, type, callback, options) => {
    target.addEventListener(type, callback, options);
    disposers.push(() => target.removeEventListener(type, callback, options));
  };
  const prevent = event => { if (event.cancelable) event.preventDefault(); };
  const release = id => {
    const contact = active.get(id);
    active.delete(id);
    if (contact?.kind === 'pointer') {
      try { if (element.hasPointerCapture?.(id)) element.releasePointerCapture(id); } catch { /* Already ended. */ }
    }
  };
  const finish = id => { if (active.has(id)) { release(id); end(id); } };
  listen(element, 'pointerdown', event => {
    if ((touchEvents && event.pointerType === 'touch') ||
        (event.pointerType === 'mouse' && (event.button !== 0 || Date.now() - lastTouch < 800))) return;
    if (!start(event.pointerId, event, event.target)) return;
    prevent(event);
    active.set(event.pointerId, { kind: 'pointer', pointerType: event.pointerType });
    // Document listeners below are the continuation fallback if capture fails.
    try { element.setPointerCapture?.(event.pointerId); } catch { /* Safari or detached target. */ }
  });
  const pointerMove = event => {
    if (!active.has(event.pointerId) || seen.has(event)) return;
    seen.add(event);
    if (active.get(event.pointerId).pointerType === 'mouse' && event.buttons === 0) {
      finish(event.pointerId); return;
    }
    prevent(event); move(event.pointerId, event);
  };
  const pointerEnd = event => {
    if (seen.has(event)) return;
    seen.add(event); finish(event.pointerId);
  };
  for (const target of new Set([element, documentTarget])) {
    listen(target, 'pointermove', pointerMove, { passive: false });
    listen(target, 'pointerup', pointerEnd);
    listen(target, 'pointercancel', pointerEnd);
  }
  listen(element, 'lostpointercapture', event => {
    // A descendant losing implicit capture bubbles through the wheel; it does
    // not mean the wheel's own gesture ended.
    if (event.target === element) finish(event.pointerId);
  });
  if (touchEvents) {
    listen(element, 'touchstart', event => {
      lastTouch = Date.now();
      for (const touch of event.changedTouches) {
        const id = `touch:${touch.identifier}`;
        const target = touch.target || event.target;
        // Some browsers share a batched changedTouches list across targets.
        if (target !== element && !element.contains?.(target)) continue;
        if (start(id, touch, target)) {
          active.set(id, { kind: 'touch' }); prevent(event);
        }
      }
    }, { passive: false });
    listen(element, 'touchmove', event => {
      lastTouch = Date.now();
      for (const touch of event.changedTouches) {
        const id = `touch:${touch.identifier}`;
        if (active.has(id)) { prevent(event); move(id, touch); }
      }
    }, { passive: false });
    for (const type of ['touchend', 'touchcancel']) listen(element, type, event => {
      lastTouch = Date.now();
      for (const touch of event.changedTouches) {
        const id = `touch:${touch.identifier}`;
        if (active.has(id)) { prevent(event); finish(id); }
      }
    }, { passive: false });
  }
  return {
    release,
    clear() { for (const id of [...active.keys()]) release(id); },
    destroy() { this.clear(); disposers.forEach(dispose => dispose()); },
  };
}
