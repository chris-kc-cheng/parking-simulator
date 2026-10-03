import { bindContacts } from './contact-input.mjs?v=20261003-iphone-touch';

// Match the dashboard's existing 420-degree rotation from center to full lock.
export const WHEEL_LOCK_DEGREES = 420;
const clamp = value => Math.max(-1, Math.min(1, value));

export function createWheelInput(wheel, { canDrive = () => true, getSteering = () => 0,
  windowTarget = window, documentTarget = document } = {}) {
  let drag = null;
  const disposers = [];
  const listen = (type, callback) => {
    wheel.addEventListener(type, callback);
    disposers.push(() => wheel.removeEventListener(type, callback));
  };
  const pointAt = event => ({ x: event.clientX - drag.x, y: event.clientY - drag.y });
  const angleAt = ({ x: dx, y: dy }) => {
    // Ignore the hub, where tiny finger movements cause large angular jumps.
    return Math.hypot(dx, dy) < drag.deadZone ? null : Math.atan2(dy, dx);
  };
  const crossesHub = (from, to) => {
    const dx = to.x - from.x, dy = to.y - from.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared ? Math.max(0, Math.min(1, -(from.x * dx + from.y * dy) / lengthSquared)) : 0;
    return Math.hypot(from.x + t * dx, from.y + t * dy) < drag.deadZone;
  };
  const rebase = () => {
    if (!drag) return;
    const box = wheel.getBoundingClientRect();
    const x = box.left + box.width / 2, y = box.top + box.height / 2;
    drag.point = { x: drag.point.x + drag.x - x, y: drag.point.y + drag.y - y };
    drag.x = x; drag.y = y;
    drag.deadZone = (wheel.offsetWidth || Math.min(box.width, box.height)) * .15;
    drag.angle = angleAt(drag.point);
  };
  const clear = () => {
    const previous = drag;
    drag = null;
    wheel.classList.toggle('steering-held', false);
    if (previous) contacts.release(previous.id);
  };
  const contacts = bindContacts(wheel, { windowTarget, documentTarget,
    start(id, event, target) {
      if (drag || !canDrive() || target.closest?.('button')) return false;
      const box = wheel.getBoundingClientRect();
      drag = { id, x: box.left + box.width / 2, y: box.top + box.height / 2,
        deadZone: (wheel.offsetWidth || Math.min(box.width, box.height)) * .15,
        value: clamp(getSteering()), angle: null };
      drag.point = pointAt(event);
      drag.angle = angleAt(drag.point);
      wheel.classList.toggle('steering-held', true);
      return true;
    },
    move(id, event) {
      if (!drag || id !== drag.id) return;
      if (!canDrive()) { clear(); return; }
      const point = pointAt(event), angle = angleAt(point);
      // Also catch a fast swipe whose sampled endpoints skip across the hub.
      if (angle !== null && drag.angle !== null && !crossesHub(drag.point, point)) {
        // Unwrap the +/-180-degree seam using the shortest signed movement.
        const delta = Math.atan2(Math.sin(angle - drag.angle), Math.cos(angle - drag.angle));
        drag.value = clamp(drag.value + delta * 180 / Math.PI / WHEEL_LOCK_DEGREES);
      }
      // Always update at the hard stops so reversing direction responds immediately.
      // Crossing the hub rebases the angle instead of flipping the steering.
      drag.angle = angle;
      drag.point = point;
    },
    end(id) { if (id === drag?.id) clear(); },
  });
  listen('contextmenu', event => event.preventDefault());
  return {
    get value() { return drag?.value ?? null; },
    clear, rebase,
    destroy() { clear(); contacts.destroy(); disposers.forEach(dispose => dispose()); },
  };
}
