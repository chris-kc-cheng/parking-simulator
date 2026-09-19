const icon = name => `<span class="ico">${({ sound: '◖))', settings: '⚙', power: '◉', camera: '▣', eye: '◉', left: '‹', right: '›', reset: '↻', info: 'i' })[name]}</span>`;

document.querySelector('#root').innerHTML = `<main>
  <header><div class="brand"><div class="brandmark"><span></span></div><div><b>PARKWISE</b><small>DRIVING SIMULATOR</small></div></div><div class="step">LESSON 01 <i></i> <strong id="lesson">REVERSE PARK</strong></div><div class="topActions"><button id="sound">${icon('sound')}</button><button id="settings" aria-label="Open settings">${icon('settings')}</button><button class="exit">${icon('power')} EXIT</button></div></header>
  <section class="cockpit">
    <div class="mirror left"><canvas data-view="leftMirror"></canvas><span>OBJECTS IN MIRROR ARE CLOSER THAN THEY APPEAR</span></div>
    <div class="rearMirror"><canvas data-view="rearMirror"></canvas></div>
    <div class="mirror right"><canvas data-view="rightMirror"></canvas></div>
    <div class="windshield"><canvas data-view="front"></canvas><div class="scenarioTabs"><button class="active">Reverse park</button><button>Front-in</button><button>Parallel</button></div><div class="impact" hidden>OBSTACLE — VEHICLE STOPPED</div></div>
    <aside class="miniViews"><div class="monitor" id="camera"><div class="monitorTitle">${icon('camera')} REAR CAMERA <button class="hide">×</button></div><div class="feed"><canvas data-view="rearCamera"></canvas></div></div><div class="monitor" id="bird"><div class="monitorTitle">${icon('eye')} BIRD'S-EYE <button class="hide">×</button></div><div class="feed bird"><canvas data-view="bird"></canvas></div></div><div class="restore"></div></aside>
    <div class="dash"><div class="wheel"><div></div><b>P</b></div><div class="cluster"><small>SPEED</small><strong>00</strong><span>km/h</span></div><div class="gear">${['P', 'R', 'N', 'D'].map(g => `<button class="${g === 'P' ? 'active' : ''}">${g}</button>`).join('')}</div></div>
  </section>
  <footer><div class="hint">${icon('info')}<span><b>YOUR GOAL</b> Park fully inside the highlighted yellow bay without touching an obstacle.</span></div><div class="controls"><button data-key="ArrowLeft">${icon('left')}</button><div class="keygroup"><button data-key="ArrowUp">↑</button><small>DRIVE</small></div><div class="keygroup"><button data-key="ArrowDown">↓</button><small>REVERSE</small></div><button data-key="ArrowRight">${icon('right')}</button><button class="reset">${icon('reset')} RESET</button></div></footer>
  <div class="modalBackdrop" hidden><div class="modal"><button class="close">×</button><h2>Simulation settings</h2><p>Fine-tune the optical behavior of your driving aids.</p><label>Mirror fisheye <b><output id="fishValue">16</output>%</b></label><input id="fish" type="range" value="16" min="0" max="40"><label>Camera field of view <b><output id="fovValue">110</output>°</b></label><input id="fov" type="range" value="110" min="75" max="135"><button class="done">APPLY SETTINGS</button></div></div>
</main>`;

// The vehicle pose below is the single source of truth for every rendered view.
const state = { x: 0, z: 8, heading: 0, speed: 0, steer: 0, gear: 'P', fisheye: 16, fov: 110, impactUntil: 0 };
const keys = {};
const CAR = { width: 1.82, length: 4.45, wheelbase: 2.7, maxSteer: 32 * Math.PI / 180 };
const parkedCars = [
  { x: -4, z: -23, heading: 0, color: '#202326' }, { x: 4, z: -23, heading: 0, color: '#e7e2d7' },
  { x: -4, z: -13, heading: 0, color: '#eee9dd' }, { x: 4, z: -3, heading: 0, color: '#17191b' }
];
const scenarios = {
  'Reverse park': { x: 0, z: 8, heading: 0, target: { x: 4, z: -13, heading: 0 } },
  'Front-in': { x: 0, z: 8, heading: 0, target: { x: -4, z: -3, heading: 0 } },
  'Parallel': { x: 0, z: 5, heading: 0, target: { x: -4, z: -18, heading: 0 } }
};
let activeScenario = 'Reverse park';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function reset() {
  const start = scenarios[activeScenario];
  Object.assign(state, { x: start.x, z: start.z, heading: start.heading, speed: 0, steer: 0, gear: 'P', impactUntil: 0 });
  renderDash();
}

function localPoint(x, z, cameraYaw = 0) {
  const dx = x - state.x, dz = z - state.z;
  const right = Math.cos(state.heading) * dx + Math.sin(state.heading) * dz;
  const forward = Math.sin(state.heading) * dx - Math.cos(state.heading) * dz;
  const c = Math.cos(cameraYaw), s = Math.sin(cameraYaw);
  return { x: c * right - s * forward, y: s * right + c * forward };
}

function vehicleCorners(vehicle, margin = 0) {
  const hw = (CAR.width + margin) / 2, hl = (CAR.length + margin) / 2;
  return [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([x, z]) => ({
    x: vehicle.x + x * Math.cos(vehicle.heading) + z * Math.sin(vehicle.heading),
    z: vehicle.z + x * Math.sin(vehicle.heading) - z * Math.cos(vehicle.heading)
  }));
}

function polygonsOverlap(a, b) {
  for (const polygon of [a, b]) for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length], axis = { x: -(q.z - p.z), z: q.x - p.x };
    const range = poly => poly.reduce((r, v) => { const n = v.x * axis.x + v.z * axis.z; return [Math.min(r[0], n), Math.max(r[1], n)]; }, [Infinity, -Infinity]);
    const ra = range(a), rb = range(b);
    if (ra[1] < rb[0] || rb[1] < ra[0]) return false;
  }
  return true;
}

function collides(pose) {
  const player = vehicleCorners(pose, .08);
  if (player.some(p => Math.abs(p.x) > 9 || p.z < -31 || p.z > 13)) return true;
  return parkedCars.some(car => polygonsOverlap(player, vehicleCorners(car, .12)));
}

function projectedPath(direction, steps = 30) {
  const points = [];
  let x = state.x, z = state.z, heading = state.heading;
  const distance = .32 * direction;
  for (let i = 0; i < steps; i++) {
    heading += distance / CAR.wheelbase * Math.tan(state.steer);
    x += Math.sin(heading) * distance;
    z -= Math.cos(heading) * distance;
    points.push({ x, z, heading });
  }
  return points;
}

function drawTopCar(ctx, x, y, scale, heading, color, player = false, steer = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-heading); ctx.scale(scale, scale);
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(-CAR.width / 2, -CAR.length / 2, CAR.width, CAR.length, .35); ctx.fill();
  ctx.fillStyle = '#617176'; ctx.fillRect(-.72, -.78, 1.44, 1.55);
  const wheels = [{ x: -.96, z: -1.35, front: true }, { x: .96, z: -1.35, front: true }, { x: -.96, z: 1.35 }, { x: .96, z: 1.35 }];
  wheels.forEach(w => { ctx.save(); ctx.translate(w.x, w.z); if (w.front) ctx.rotate(steer); ctx.fillStyle = '#111'; ctx.fillRect(-.13, -.43, .26, .86); ctx.restore(); });
  if (player) { ctx.fillStyle = '#d9be8e'; ctx.fillRect(-.14, -2.32, .28, .18); }
  ctx.restore();
}

function cameraDefinition(view) {
  if (view === 'rearCamera') return { yaw: Math.PI, mirror: false, fov: state.fov, path: -1 };
  if (view === 'rearMirror') return { yaw: Math.PI, mirror: true, fov: 82, path: 0 };
  if (view === 'leftMirror') return { yaw: Math.PI + .48, mirror: true, fov: 76, path: 0 };
  if (view === 'rightMirror') return { yaw: Math.PI - .48, mirror: true, fov: 76, path: 0 };
  return { yaw: 0, mirror: false, fov: 92, path: 1 };
}

function drawPerspective(canvas, view) {
  const ctx = canvas.getContext('2d'), w = canvas.clientWidth, h = canvas.clientHeight, dpr = devicePixelRatio || 1;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  const camera = cameraDefinition(view), horizon = h * .48;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon); sky.addColorStop(0, '#83939a'); sky.addColorStop(1, '#d7d2c6'); ctx.fillStyle = sky; ctx.fillRect(0, 0, w, horizon);
  ctx.fillStyle = '#717870'; ctx.fillRect(0, horizon, w, h - horizon);
  const project = (x, z) => { const p = localPoint(x, z, camera.yaw); if (p.y < .35) return null; const focal = (w / 2) / Math.tan(camera.fov * Math.PI / 360); let sx = w / 2 + p.x / p.y * focal; if (camera.mirror) sx = w - sx; const distortion = 1 + state.fisheye / 250 * Math.pow(Math.abs(sx - w / 2) / (w / 2), 2); sx = w / 2 + (sx - w / 2) * distortion; return { x: sx, y: horizon + h * .72 / p.y, depth: p.y }; };
  // Parking grid is projected from the same world coordinates as the bird's-eye view.
  ctx.lineWidth = 2; ctx.strokeStyle = '#edbd4e';
  for (const x of [-7, -5, -3, -1, 1, 3, 5, 7]) for (let z = -30; z <= 10; z += 10) { const a = project(x, z), b = project(x, z + 8); if (a && b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
  for (let z = -30; z <= 10; z += 10) { const a = project(-7, z), b = project(7, z); if (a && b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
  const target = scenarios[activeScenario].target, ta = project(target.x - 1, target.z), tb = project(target.x + 1, target.z); if (ta && tb) { ctx.strokeStyle = '#ffe393'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ta.x, ta.y); ctx.lineTo(tb.x, tb.y); ctx.stroke(); }
  if (camera.path) {
    const path = projectedPath(camera.path); ctx.strokeStyle = '#75d685'; ctx.lineWidth = 3; ctx.setLineDash([7, 5]); ctx.beginPath(); let begun = false;
    path.forEach(p => { const q = project(p.x, p.z); if (q) { begun ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); begun = true; } }); ctx.stroke(); ctx.setLineDash([]);
  }
  parkedCars.map(car => ({ car, p: localPoint(car.x, car.z, camera.yaw) })).filter(v => v.p.y > .35).sort((a, b) => b.p.y - a.p.y).forEach(({ car, p }) => { const q = project(car.x, car.z); if (!q) return; const size = clamp(210 / p.y, 10, 95); ctx.fillStyle = car.color; ctx.beginPath(); ctx.roundRect(q.x - size * .42, q.y - size, size * .84, size, 5); ctx.fill(); ctx.fillStyle = '#8fa8ad'; ctx.fillRect(q.x - size * .3, q.y - size * .78, size * .6, size * .23); });
  if (view === 'front') { ctx.fillStyle = '#242725'; ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, h * .9); ctx.quadraticCurveTo(w / 2, h * .73, w, h * .9); ctx.lineTo(w, h); ctx.fill(); }
}

function drawBird(canvas) {
  const ctx = canvas.getContext('2d'), w = canvas.clientWidth, h = canvas.clientHeight, dpr = devicePixelRatio || 1;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#727b73'; ctx.fillRect(0, 0, w, h);
  const scale = Math.min(w / 18, h / 20), world = p => { const dx = p.x - state.x, dz = p.z - state.z; return { x: w / 2 + (Math.cos(state.heading) * dx + Math.sin(state.heading) * dz) * scale, y: h / 2 + (Math.sin(state.heading) * dx - Math.cos(state.heading) * dz) * scale }; };
  ctx.strokeStyle = '#e9b94c'; ctx.lineWidth = 2;
  for (const x of [-7, -5, -3, -1, 1, 3, 5, 7]) for (let z = -30; z < 12; z += 10) { const a = world({ x, z }), b = world({ x, z: z + 8 }); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  const target = scenarios[activeScenario].target, t = world(target); ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 3; ctx.strokeRect(t.x - scale, t.y - 2.35 * scale, 2 * scale, 4.7 * scale);
  [-1, 1].forEach(direction => { ctx.strokeStyle = direction > 0 ? '#77d789' : '#f0b75d'; ctx.setLineDash([5, 4]); ctx.beginPath(); projectedPath(direction).forEach((p, i) => { const q = world(p); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); ctx.stroke(); }); ctx.setLineDash([]);
  parkedCars.forEach(car => { const p = world(car); drawTopCar(ctx, p.x, p.y, scale, car.heading - state.heading, car.color); });
  drawTopCar(ctx, w / 2, h / 2, scale, 0, '#d5b58b', true, state.steer);
}

function renderDash() {
  document.querySelector('.cluster strong').textContent = Math.round(Math.abs(state.speed) * 3.6).toString().padStart(2, '0');
  document.querySelector('.wheel').style.transform = `rotate(${state.steer / CAR.maxSteer * 420}deg)`;
  document.querySelector('.wheel b').textContent = state.gear;
  document.querySelectorAll('.gear button').forEach(b => b.classList.toggle('active', b.textContent === state.gear));
}

addEventListener('keydown', e => { keys[e.key] = true; if (e.key.startsWith('Arrow')) e.preventDefault(); });
addEventListener('keyup', e => { keys[e.key] = false; });
document.querySelectorAll('[data-key]').forEach(button => { const set = value => keys[button.dataset.key] = value; button.onpointerdown = e => { button.setPointerCapture(e.pointerId); set(true); }; button.onpointerup = button.onpointercancel = () => set(false); });
document.querySelectorAll('.gear button').forEach(button => button.onclick = () => { state.gear = button.textContent; state.speed = 0; renderDash(); });
document.querySelector('.reset').onclick = reset;
document.querySelectorAll('.scenarioTabs button').forEach(button => button.onclick = () => { document.querySelector('.scenarioTabs .active').classList.remove('active'); button.classList.add('active'); activeScenario = button.textContent; document.querySelector('#lesson').textContent = activeScenario.toUpperCase(); reset(); });
document.querySelectorAll('.hide').forEach(button => button.onclick = () => { const box = button.closest('.monitor'), restore = document.querySelector('.restore'), replacement = document.createElement('button'); box.hidden = true; replacement.textContent = box.id === 'camera' ? '▣ Camera' : "◉ Bird's-eye"; replacement.onclick = () => { box.hidden = false; replacement.remove(); }; restore.append(replacement); });

const modal = document.querySelector('.modalBackdrop');
document.querySelector('#settings').onclick = () => { modal.hidden = false; };
document.querySelectorAll('.close,.done').forEach(button => button.onclick = () => { modal.hidden = true; });
modal.onclick = e => { if (e.target === modal) modal.hidden = true; };
document.querySelector('#fish').oninput = e => { state.fisheye = +e.target.value; document.querySelector('#fishValue').value = e.target.value; };
document.querySelector('#fov').oninput = e => { state.fov = +e.target.value; document.querySelector('#fovValue').value = e.target.value; };
let muted = false; document.querySelector('#sound').onclick = e => { muted = !muted; e.currentTarget.innerHTML = muted ? '◖ ×' : icon('sound'); };

let last = performance.now();
function loop(time) {
  const dt = Math.min((time - last) / 1000, .04); last = time;
  const steerInput = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
  const steerTarget = steerInput * CAR.maxSteer;
  state.steer += clamp(steerTarget - state.steer, -2.2 * dt, 2.2 * dt);
  if (!steerInput) state.steer *= Math.pow(.08, dt);
  let acceleration = 0;
  if (keys.ArrowUp) { state.gear = 'D'; acceleration = 2.7; }
  if (keys.ArrowDown) { state.gear = 'R'; acceleration = -2.2; }
  if (state.gear === 'P' || state.gear === 'N') state.speed *= Math.pow(.005, dt); else state.speed += (acceleration - state.speed * .8) * dt;
  state.speed = clamp(state.speed, -2.8, 4.2);
  const next = { ...state };
  next.heading += state.speed / CAR.wheelbase * Math.tan(state.steer) * dt;
  next.x += Math.sin(next.heading) * state.speed * dt;
  next.z -= Math.cos(next.heading) * state.speed * dt;
  if (collides(next)) { state.speed = 0; state.impactUntil = time + 1400; } else Object.assign(state, { x: next.x, z: next.z, heading: next.heading });
  const impact = document.querySelector('.impact'); impact.hidden = time > state.impactUntil;
  document.querySelectorAll('canvas').forEach(canvas => canvas.dataset.view === 'bird' ? drawBird(canvas) : drawPerspective(canvas, canvas.dataset.view));
  renderDash(); requestAnimationFrame(loop);
}
reset(); requestAnimationFrame(loop);
