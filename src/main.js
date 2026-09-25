const icon = name => `<span class="ico">${({ settings: '⚙', camera: '▣', eye: '◉', left: '‹', right: '›', reset: '↻', info: 'i' })[name]}</span>`;

document.querySelector('#root').innerHTML = `<main>
  <header><div class="brand"><div class="brandmark"><span></span></div><div><b>PARKING SIMULATOR</b><small>CONNECTED CITY • LIVE TRAFFIC</small></div></div><div class="cityBadge">CITY DRIVE</div><div class="topActions"><button id="settings" aria-label="Open settings">${icon('settings')}</button></div></header>
  <section class="cockpit">
    <div class="mirrorMount left" aria-hidden="true"></div><div class="mirrorMount right" aria-hidden="true"></div>
    <div class="mirror left"><canvas data-view="leftMirror"></canvas><span>OBJECTS IN MIRROR ARE CLOSER THAN THEY APPEAR</span></div>
    <div class="rearMirror"><canvas data-view="rearMirror"></canvas></div>
    <div class="mirror right"><canvas data-view="rightMirror"></canvas></div>
    <div class="windshield"><canvas data-view="front"></canvas><div class="impact" hidden>OBSTACLE — VEHICLE STOPPED</div></div>
    <aside class="miniViews"><div class="monitor" id="camera"><div class="monitorTitle">${icon('camera')} REAR CAMERA <button class="hide">×</button></div><div class="feed"><canvas data-view="rearCamera"></canvas></div></div><div class="monitor" id="bird"><div class="monitorTitle">${icon('eye')} BIRD'S-EYE <button class="hide">×</button></div><div class="feed bird"><canvas data-view="bird"></canvas></div></div><div class="restore"></div></aside>
    <div class="dash"><div class="wheel"><div class="wheelSpoke leftSpoke"></div><div class="wheelSpoke rightSpoke"></div><div class="wheelSpoke lowerSpoke"></div><b></b></div><div class="cluster"><small>SPEED</small><strong>00</strong><span>km/h</span></div><div class="gear">${['P', 'R', 'N', 'D'].map(g => `<button class="${g === 'P' ? 'active' : ''}">${g}</button>`).join('')}</div></div>
  </section>
  <footer><div class="hint">${icon('info')}<span><b>YOUR GOAL</b> Explore the connected city and park in the highlighted bay.</span></div><div class="controls"><button data-key="ArrowLeft">${icon('left')}</button><div class="keygroup"><button data-key="ArrowUp">↑</button><small>DRIVE</small></div><div class="keygroup"><button data-key="ArrowDown">↓</button><small>REVERSE</small></div><button data-key="ArrowRight">${icon('right')}</button><button class="reset">${icon('reset')} RESET</button></div></footer>
  <div class="modalBackdrop" hidden><div class="modal"><button class="close">×</button><h2>Simulation settings</h2><p>Fine-tune the optical behavior of your driving aids.</p><label>Mirror fisheye <b><output id="fishValue">16</output>%</b></label><input id="fish" type="range" value="16" min="0" max="40"><label>Camera field of view <b><output id="fovValue">110</output>°</b></label><input id="fov" type="range" value="110" min="75" max="135"><label>Driver eye height <b><output id="heightValue">1.25</output> m</b></label><input id="height" type="range" value="1.25" min="0.8" max="1.8" step="0.05"><button class="done">APPLY SETTINGS</button></div></div>
</main>`;

// The vehicle pose below is the single source of truth for every rendered view.
const state = { x: 0, z: 8, heading: 0, speed: 0, steer: 0, gear: 'P', fisheye: 16, fov: 110, eyeHeight: 1.25, impactUntil: 0 };
const keys = {};
const CAR = { width: 1.82, length: 4.45, height: 1.48, wheelbase: 2.7, maxSteer: 32 * Math.PI / 180 };
// The old scene ended after 66 m. This six-and-a-half kilometre city is 100× longer.
const CITY = { length: 6600, roadHalf: 7, sidewalk: 3, block: 80 };
const BAY_WIDTH = 2.7;
const BAY = { width: BAY_WIDTH, length: 5.5, rows: [-28, -16, -4], columns: [24, 27, 30, 33] };
const lotCars = [
  { x: BAY.columns[0], z: -27, heading: 0, color: '#202326', type: 'van' }, { x: BAY.columns[1], z: -27, heading: 0, color: '#e7e2d7' },
  { x: BAY.columns[2], z: -27, heading: 0, color: '#566977' }, { x: BAY.columns[3], z: -27, heading: 0, color: '#9a3f38' },
  { x: BAY.columns[0], z: -15, heading: 0, color: '#eee9dd' }, { x: BAY.columns[1], z: -15, heading: 0, color: '#34383a' },
  { x: BAY.columns[3], z: -15, heading: 0, color: '#bec5bd', type: 'truck' }, { x: BAY.columns[2], z: -3, heading: 0, color: '#315268' },
  { x: BAY.columns[3], z: -3, heading: 0, color: '#17191b' }
];
const traffic = [
  { x: 2.7, z: -35, heading: 0, speed: 5.4, cruise: 5.4, color: '#d4d8d5' },
  { x: 2.7, z: 35, heading: 0, speed: 4.5, cruise: 4.5, color: '#c08b35', type: 'van' },
  { x: -2.7, z: -48, heading: Math.PI, speed: 5.1, cruise: 5.1, color: '#54748a' },
  { x: -2.7, z: 28, heading: Math.PI, speed: 4.1, cruise: 4.1, color: '#852f2f' }
];
const trafficStarts = traffic.map(car => ({ ...car }));
const TARGET = { x: BAY.columns[2], z: -16, heading: 0 };
const parkedCars = () => lotCars;
const visibleCars = () => [...lotCars, ...traffic];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Road surfaces and paint are generated once in world coordinates. Every view
// consumes these same physical segments, so a white edge line seen through the
// windshield appears at the identical position in mirrors and camera feeds.
function nearbyRoadMap(centerX, centerZ, reach) {
  const vertical = [], horizontal = [], markings = [];
  const firstX = Math.floor((centerX - reach) / CITY.block) * CITY.block;
  const firstZ = Math.floor((centerZ - reach) / CITY.block) * CITY.block;
  for (let x = firstX; x <= centerX + reach; x += CITY.block) {
    vertical.push({ left: x - CITY.roadHalf, right: x + CITY.roadHalf, near: centerZ - reach, far: centerZ + reach });
    markings.push(
      { ax: x - CITY.roadHalf, az: centerZ - reach, bx: x - CITY.roadHalf, bz: centerZ + reach, color: '#f2eee3', width: .18 },
      { ax: x + CITY.roadHalf, az: centerZ - reach, bx: x + CITY.roadHalf, bz: centerZ + reach, color: '#f2eee3', width: .18 },
      { ax: x, az: centerZ - reach, bx: x, bz: centerZ + reach, color: '#d6b84a', width: .1, dash: true }
    );
  }
  for (let z = firstZ; z <= centerZ + reach; z += CITY.block) {
    horizontal.push({ left: centerX - reach, right: centerX + reach, near: z - CITY.roadHalf, far: z + CITY.roadHalf });
    markings.push(
      { ax: centerX - reach, az: z - CITY.roadHalf, bx: centerX + reach, bz: z - CITY.roadHalf, color: '#f2eee3', width: .18 },
      { ax: centerX - reach, az: z + CITY.roadHalf, bx: centerX + reach, bz: z + CITY.roadHalf, color: '#f2eee3', width: .18 },
      { ax: centerX - reach, az: z, bx: centerX + reach, bz: z, color: '#d6b84a', width: .1, dash: true }
    );
  }
  return { vertical, horizontal, markings };
}

// Buildings, streets, and vehicles all live in the same world-space map.
// Keeping this geometry shared prevents the mirrors and overhead camera from
// inventing a different shape or position for an object.
function nearbyBuildings(centerZ, reach = 180, centerX = state.x) {
  const buildings = [];
  const firstX = Math.floor((centerX - reach) / CITY.block) * CITY.block;
  const firstZ = Math.floor((centerZ - reach) / CITY.block) * CITY.block;
  for (let roadX = firstX; roadX <= centerX + reach; roadX += CITY.block) {
    for (let roadZ = firstZ; roadZ <= centerZ + reach; roadZ += CITY.block) {
      // Four compact, solid buildings occupy each block while leaving sidewalks,
      // every street, and every intersection continuously connected.
      for (const [ox, oz] of [[24, 24], [55, 24], [24, 55], [55, 55]]) {
        const seed = Math.abs((roadX + ox) * 3 + (roadZ + oz));
        buildings.push({ x: roadX + ox, z: roadZ + oz, width: 23, length: 23,
          height: 8 + (seed % 5) * 1.6, color: seed % 2 ? '#766f68' : '#82796e', type: 'building' });
      }
    }
  }
  // The starting block is a public parking lot instead of another building.
  return buildings.filter(building => !(building.x > 10 && building.x < 70 && building.z > -70 && building.z < 10));
}

function mapObstacles(center = state.z, reach = 24) {
  return nearbyBuildings(center, reach + 24, state.x).map(building => ({ ...building, heading: 0 }));
}

function reset() {
  Object.assign(state, { x: 2.7, z: 18, heading: 0, speed: 0, steer: 0, gear: 'P', impactUntil: 0 });
  traffic.forEach((car, i) => Object.assign(car, trafficStarts[i]));
  renderDash();
}

function localPoint(x, z, cameraYaw = 0, mountForward = 0) {
  const cameraX = state.x + Math.sin(state.heading) * mountForward;
  const cameraZ = state.z - Math.cos(state.heading) * mountForward;
  const dx = x - cameraX, dz = z - cameraZ;
  const right = Math.cos(state.heading) * dx + Math.sin(state.heading) * dz;
  const forward = Math.sin(state.heading) * dx - Math.cos(state.heading) * dz;
  const c = Math.cos(cameraYaw), s = Math.sin(cameraYaw);
  return { x: c * right - s * forward, y: s * right + c * forward };
}

function vehicleCorners(vehicle, margin = 0) {
  const size = vehicleSize(vehicle), hw = (size.width + margin) / 2, hl = (size.length + margin) / 2;
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
  const player = vehicleCorners(pose);
  return [...visibleCars(), ...mapObstacles(pose.z)].some(object => polygonsOverlap(player, object.type === 'barrier' || object.type === 'building' ? objectCorners(object) : vehicleCorners(object)));
}

function objectCorners(object, margin = 0) {
  const hw = (object.width + margin) / 2, hl = (object.length + margin) / 2;
  return [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([x, z]) => ({ x: object.x + x, z: object.z + z }));
}

function vehicleSize(vehicle) {
  if (vehicle.type === 'van') return { width: 2.05, length: 5.2, height: 2.25 };
  if (vehicle.type === 'truck') return { width: 2.1, length: 5.35, height: 2.15 };
  return CAR;
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

function projectedTracks(direction) {
  const halfTrack = CAR.width * .42;
  const center = projectedPath(direction);
  return [-halfTrack, halfTrack].map(offset => center.map(p => ({
    x: p.x + Math.cos(p.heading) * offset,
    z: p.z + Math.sin(p.heading) * offset
  })));
}

function drawTopCar(ctx, x, y, scale, heading, color, player = false, steer = 0, type = 'car') {
  const size = vehicleSize({ type });
  ctx.save(); ctx.translate(x, y); ctx.rotate(heading); ctx.scale(scale, scale);
  const paint = ctx.createLinearGradient(-size.width / 2, 0, size.width / 2, 0); paint.addColorStop(0, '#202625'); paint.addColorStop(.16, color); paint.addColorStop(.78, color); paint.addColorStop(1, '#151a19');
  ctx.fillStyle = paint; ctx.beginPath(); ctx.roundRect(-size.width / 2, -size.length / 2, size.width, size.length, .3); ctx.fill();
  ctx.fillStyle = '#243943';
  if (type === 'truck') { ctx.fillRect(-.78, -1.72, 1.56, 1.05); ctx.fillStyle = '#303839'; ctx.fillRect(-.83, -.25, 1.66, 2.65); }
  else { ctx.fillRect(-size.width * .4, -size.length * .22, size.width * .8, type === 'van' ? 3.2 : 2.05); ctx.fillStyle = '#9bb2b8'; ctx.fillRect(-size.width * .37, -size.length * .22, size.width * .74, .32); }
  ctx.fillStyle = '#20282b'; for (const side of [-1, 1]) ctx.fillRect(side * (size.width / 2 + .04) - .11, -size.length * .26, .22, .25);
  const wheels = [{ x: -size.width / 2 - .05, z: -size.length * .3, front: true }, { x: size.width / 2 + .05, z: -size.length * .3, front: true }, { x: -size.width / 2 - .05, z: size.length * .3 }, { x: size.width / 2 + .05, z: size.length * .3 }];
  wheels.forEach(w => { ctx.save(); ctx.translate(w.x, w.z); if (w.front) ctx.rotate(steer); ctx.fillStyle = '#111'; ctx.fillRect(-.13, -.43, .26, .86); ctx.restore(); });
  // Mirrors grow out of the doors rather than floating beside the vehicle.
  ctx.fillStyle = color; for (const side of [-1, 1]) { ctx.beginPath(); ctx.roundRect(side < 0 ? -size.width / 2 - .18 : size.width / 2 - .02, -size.length * .18, .2, .34, .08); ctx.fill(); }
  ctx.fillStyle = '#f4e7bd'; ctx.fillRect(-size.width * .3, -size.length / 2, size.width * .6, .08);
  ctx.fillStyle = '#a91e18'; ctx.fillRect(-size.width * .3, size.length / 2 - .08, size.width * .6, .08);
  if (player) { ctx.fillStyle = '#d9be8e'; ctx.fillRect(-.14, -2.32, .28, .18); }
  ctx.restore();
}

function cameraDefinition(view) {
  if (view === 'rearCamera') return { yaw: Math.PI, mount: -CAR.length / 2, mirror: false, fov: state.fov, path: -1 };
  if (view === 'rearMirror') return { yaw: Math.PI, mount: .35, mirror: true, fov: 82, path: 0 };
  if (view === 'leftMirror') return { yaw: Math.PI + .48, mount: .45, mirror: true, fov: 76, path: 0 };
  if (view === 'rightMirror') return { yaw: Math.PI - .48, mount: .45, mirror: true, fov: 76, path: 0 };
  return { yaw: 0, mount: .55, mirror: false, fov: 92, path: 1 };
}

function drawPerspective(canvas, view) {
  const ctx = canvas.getContext('2d'), w = canvas.clientWidth, h = canvas.clientHeight, dpr = devicePixelRatio || 1;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  const camera = cameraDefinition(view), horizon = h * .48;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon); sky.addColorStop(0, '#83939a'); sky.addColorStop(1, '#d7d2c6'); ctx.fillStyle = sky; ctx.fillRect(0, 0, w, horizon);
  ctx.fillStyle = '#717870'; ctx.fillRect(0, horizon, w, h - horizon);
  const focal = (w / 2) / Math.tan(camera.fov * Math.PI / 360);
  const distortionAmount = camera.mirror ? state.fisheye : 0;
  const project3d = (x, z, height = 0) => { const p = localPoint(x, z, camera.yaw, camera.mount); if (p.y < .04) return null; let sx = w / 2 + p.x / p.y * focal; if (camera.mirror) sx = w - sx; const distortion = 1 + distortionAmount / 250 * Math.pow(Math.abs(sx - w / 2) / (w / 2), 2); sx = w / 2 + (sx - w / 2) * distortion; return { x: sx, y: horizon + focal * (state.eyeHeight - height) / p.y, depth: p.y }; };
  const project = (x, z) => project3d(x, z, 0);
  const groundPolygon = (points, fill) => {
    const vertices = points.map(([x, z]) => localPoint(x, z, camera.yaw, camera.mount)), clipped = [];
    vertices.forEach((current, i) => {
      const previous = vertices[(i + vertices.length - 1) % vertices.length], inside = current.y >= .1, previousInside = previous.y >= .1;
      if (inside !== previousInside) { const t = (.1 - previous.y) / (current.y - previous.y); clipped.push({ x: previous.x + (current.x - previous.x) * t, y: .1 }); }
      if (inside) clipped.push(current);
    });
    if (clipped.length < 3) return;
    const projected = clipped.map(p => { let x = w / 2 + p.x / p.y * focal; if (camera.mirror) x = w - x; return { x, y: horizon + focal * state.eyeHeight / p.y }; });
    ctx.fillStyle = fill; ctx.beginPath(); projected.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.fill();
  };
  const groundLine = (ax, az, bx, bz) => { ctx.beginPath(); let drawing = false; for (let i = 0; i <= 40; i++) { const t = i / 40, p = project(ax + (bx - ax) * t, az + (bz - az) * t); if (!p) { drawing = false; continue; } if (!drawing) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); drawing = true; } ctx.stroke(); };
  {
    const reach = 170, center = state.z;
    // A continuous grid replaces the old isolated street/lot modes. Parallel
    // roads and cross streets form turnable intersections without dead ends.
    groundPolygon([[state.x - reach, center - reach], [state.x + reach, center - reach], [state.x + reach, center + reach], [state.x - reach, center + reach]], '#aaa79d');
    const roadMap = nearbyRoadMap(state.x, center, reach);
    roadMap.vertical.forEach(road => groundPolygon([[road.left, road.near], [road.right, road.near], [road.right, road.far], [road.left, road.far]], '#444b4c'));
    roadMap.horizontal.forEach(road => groundPolygon([[road.left, road.near], [road.right, road.near], [road.right, road.far], [road.left, road.far]], '#444b4c'));
    groundPolygon([[11, -37], [45, -37], [45, 8], [11, 8]], '#555d5b');
    roadMap.markings.forEach(marking => {
      ctx.strokeStyle = marking.color; ctx.lineWidth = marking.width * 12;
      ctx.setLineDash(marking.dash ? [12, 12] : []);
      groundLine(marking.ax, marking.az, marking.bx, marking.bz);
    });
    ctx.setLineDash([]);
    const blocks = nearbyBuildings(center, reach, state.x).map(block => ({ ...block, depth: localPoint(block.x, block.z, camera.yaw, camera.mount).y })).filter(block => block.depth > .4);
    blocks.sort((a, b) => b.depth - a.depth).forEach(block => {
      const corners = objectCorners(block), bottom = corners.map(p => project3d(p.x, p.z, 0)), top = corners.map(p => project3d(p.x, p.z, block.height));
      const face = (points, fill) => { if (points.some(p => !p)) return; ctx.fillStyle = fill; ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.fill(); };
      ctx.globalAlpha = 1;
      [0, 1, 2, 3].map(i => ({ i, depth: localPoint(corners[i].x, corners[i].z, camera.yaw, camera.mount).y })).sort((a, b) => b.depth - a.depth).forEach(({ i }) => face([bottom[i], bottom[(i + 1) % 4], top[(i + 1) % 4], top[i]], i % 2 ? block.color : '#625c57'));
      face(top, '#91877a');
      // Walls are always fully opaque. Only the inset window glazing uses
      // transparency, so scenery can never show through the building itself.
      [0, 1, 2, 3].forEach(i => {
        const wall = [bottom[i], bottom[(i + 1) % 4], top[(i + 1) % 4], top[i]];
        if (wall.some(point => !point)) return;
        const interpolate = (u, v) => ({ x: wall[0].x * (1 - u) * (1 - v) + wall[1].x * u * (1 - v) + wall[2].x * u * v + wall[3].x * (1 - u) * v, y: wall[0].y * (1 - u) * (1 - v) + wall[1].y * u * (1 - v) + wall[2].y * u * v + wall[3].y * (1 - u) * v });
        for (const u of [.15, .43, .71]) {
          const glass = [interpolate(u, .22), interpolate(u + .16, .22), interpolate(u + .16, .52), interpolate(u, .52)];
          ctx.fillStyle = 'rgba(92, 137, 153, .72)'; ctx.beginPath(); glass.forEach((point, j) => j ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.closePath(); ctx.fill();
        }
      });
    });
    // Stop signs sit on the near-right corner of each intersection.
    for (const roadX of roadMap.vertical) for (const roadZ of roadMap.horizontal) {
      const x = (roadX.left + roadX.right) / 2, z = (roadZ.near + roadZ.far) / 2;
      const pole = project3d(x + 9, z + 9, 0), sign = project3d(x + 9, z + 9, 2.1);
      if (!pole || !sign) continue;
      ctx.strokeStyle = '#d8d8d2'; ctx.lineWidth = Math.max(1, 18 / sign.depth); ctx.beginPath(); ctx.moveTo(pole.x, pole.y); ctx.lineTo(sign.x, sign.y); ctx.stroke();
      const radius = clamp(90 / sign.depth, 2, 15); ctx.fillStyle = '#b92f2b'; ctx.beginPath(); for (let i = 0; i < 8; i++) { const angle = Math.PI / 8 + i * Math.PI / 4; const px = sign.x + Math.cos(angle) * radius, py = sign.y + Math.sin(angle) * radius; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.fill();
      if (radius > 7) { ctx.fillStyle = '#fff'; ctx.font = `bold ${radius * .55}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('STOP', sign.x, sign.y + radius * .2); }
    }
  }
  // Parking grid is projected from the same world coordinates as the bird's-eye view.
  ctx.lineWidth = 2; ctx.strokeStyle = '#edbd4e';
  for (const z of BAY.rows) {
    const near = z + BAY.length / 2, far = z - BAY.length / 2;
    const left = BAY.columns[0] - BAY.width / 2, right = BAY.columns.at(-1) + BAY.width / 2;
    for (let i = 0; i <= BAY.columns.length; i++) {
      const x = left + i * BAY.width;
      groundLine(x, near, x, far);
    }
    groundLine(left, near, right, near); groundLine(left, far, right, far);
  }
  const target = TARGET;
  ctx.strokeStyle = '#ffe393'; ctx.lineWidth = 4;
  const targetWidth = BAY.width;
  const targetLength = BAY.length;
  const left = target.x - targetWidth / 2, right = target.x + targetWidth / 2, near = target.z + targetLength / 2, far = target.z - targetLength / 2;
  groundLine(left, near, right, near); groundLine(left, near, left, far); groundLine(right, near, right, far); groundLine(left, far, right, far);
  if (camera.path) {
    ctx.strokeStyle = camera.path > 0 ? '#63d67a' : '#ed5f59'; ctx.lineWidth = 3; ctx.setLineDash([7, 5]);
    projectedTracks(camera.path).forEach(path => { ctx.beginPath(); let begun = false; path.forEach(p => { const q = project(p.x, p.z); if (q) { begun ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); begun = true; } }); ctx.stroke(); });
    ctx.setLineDash([]);
  }
  const drawProjectedCar = car => {
    // Project the real 1.82 m × 4.45 m × 1.48 m vehicle box. In particular,
    // the nearest bumper—not the car center—determines its apparent size.
    const size = vehicleSize(car), hw = size.width / 2, hl = size.length / 2;
    const point = (side, forward, height) => {
      const x = car.x + side * Math.cos(car.heading) + forward * Math.sin(car.heading);
      const z = car.z + side * Math.sin(car.heading) - forward * Math.cos(car.heading);
      return { ...localPoint(x, z, camera.yaw, camera.mount), height };
    };
    const ring = (width, front, rear, height) => [[-width / 2, front], [width / 2, front], [width / 2, rear], [-width / 2, rear]].map(([side, forward]) => point(side, forward, height));
    // Clip each face against the camera's near plane. A nearby car can straddle
    // the plane, so rejecting the whole box makes it disappear at close range.
    const bottom = ring(size.width, hl, -hl, 0);
    const bodyTop = ring(size.width, hl, -hl, car.type === 'truck' ? .95 : .72);
    const cabinFront = car.type === 'truck' ? hl - .3 : hl - .55;
    const cabinRear = car.type === 'truck' ? .15 : car.type === 'van' ? -hl + .25 : -hl + .62;
    const cabinBase = ring(size.width * .84, cabinFront, cabinRear, .72);
    const roof = ring(size.width * .8, cabinFront - .28, cabinRear + .2, size.height);
    const near = .3;
    const clipFace = vertices => {
      const clipped = [];
      vertices.forEach((current, i) => {
        const previous = vertices[(i + vertices.length - 1) % vertices.length];
        const currentInside = current.y >= near, previousInside = previous.y >= near;
        if (currentInside !== previousInside) {
          const t = (near - previous.y) / (current.y - previous.y);
          clipped.push({ x: previous.x + (current.x - previous.x) * t, y: near, height: previous.height + (current.height - previous.height) * t });
        }
        if (currentInside) clipped.push(current);
      });
      return clipped;
    };
    const screenPoint = p => {
      let sx = w / 2 + p.x / p.y * focal;
      if (camera.mirror) sx = w - sx;
      const distortion = 1 + distortionAmount / 250 * Math.pow(Math.abs(sx - w / 2) / (w / 2), 2);
      return { x: w / 2 + (sx - w / 2) * distortion, y: horizon + focal * (state.eyeHeight - p.height) / p.y };
    };
    const polygon = (vertices, fill) => {
      const points = clipFace(vertices).map(screenPoint);
      if (points.length < 3) return;
      ctx.fillStyle = fill; ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.fill();
    };
    const faces = (lower, upper) => [0, 1, 2, 3].map(i => ({ i, points: [lower[i], lower[(i + 1) % 4], upper[(i + 1) % 4], upper[i]], depth: (lower[i].y + lower[(i + 1) % 4].y) / 2 })).sort((a, b) => b.depth - a.depth);
    faces(bottom, bodyTop).forEach(face => polygon(face.points, face.i % 2 ? car.color : '#313838'));
    polygon(bodyTop, car.color);
    faces(cabinBase, roof).forEach(face => {
      polygon(face.points, car.color);
      const glass = face.points.map((p, i) => ({ ...p, height: p.height + (i < 2 ? .13 : -.12) }));
      polygon(glass, face.i === 0 ? '#8eabb5' : '#304b58');
    });
    polygon(roof, car.color);
    for (const side of [-1, 1]) {
      const edge = side * hw, outer = side * (hw + .2), forward = cabinFront - .12;
      polygon([point(edge, forward + .14, .96), point(outer, forward + .14, 1.02), point(outer, forward - .14, 1.18), point(edge, forward - .14, 1.14)], '#202a2d');
    }
  };
  visibleCars().map(car => ({ car, depth: localPoint(car.x, car.z, camera.yaw, camera.mount).y })).sort((a, b) => b.depth - a.depth).forEach(item => drawProjectedCar(item.car));
  if (view === 'leftMirror' || view === 'rightMirror') {
    // The inner edge of each side mirror catches a sliver of our own rear door.
    const inner = view === 'leftMirror' ? w : 0, sign = view === 'leftMirror' ? -1 : 1;
    ctx.fillStyle = '#d5b58b'; ctx.beginPath(); ctx.moveTo(inner, h * .48);
    ctx.quadraticCurveTo(inner + sign * w * .035, h * .52, inner + sign * w * .12, h);
    ctx.lineTo(inner, h); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#7d6345'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(inner, h * .48); ctx.quadraticCurveTo(inner + sign * w * .035, h * .52, inner + sign * w * .12, h); ctx.stroke();
  }
  if (view === 'front') { ctx.fillStyle = '#242725'; ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, h * .9); ctx.quadraticCurveTo(w / 2, h * .73, w, h * .9); ctx.lineTo(w, h); ctx.fill(); }
}

function drawBird(canvas) {
  const ctx = canvas.getContext('2d'), w = canvas.clientWidth, h = canvas.clientHeight, dpr = devicePixelRatio || 1;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#727b73'; ctx.fillRect(0, 0, w, h);
  const scale = Math.min(w / 34, h / 27), world = p => ({ x: w / 2 + (p.x - state.x) * scale, y: h / 2 + (p.z - state.z) * scale });
  ctx.strokeStyle = '#e9b94c'; ctx.lineWidth = 2;
  for (const z of BAY.rows) {
    const left = BAY.columns[0] - BAY.width / 2, right = BAY.columns.at(-1) + BAY.width / 2;
    const near = z + BAY.length / 2, far = z - BAY.length / 2;
    for (let i = 0; i <= BAY.columns.length; i++) {
      const a = world({ x: left + i * BAY.width, z: near }), b = world({ x: left + i * BAY.width, z: far });
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    const topLeft = world({ x: left, z: far });
    ctx.strokeRect(topLeft.x, topLeft.y, (right - left) * scale, BAY.length * scale);
  }
  const roadMap = nearbyRoadMap(state.x, state.z, 30);
  ctx.fillStyle = '#444b4c';
  roadMap.vertical.forEach(road => { const p = world({ x: road.left, z: road.near }); ctx.fillRect(p.x, p.y, (road.right - road.left) * scale, (road.far - road.near) * scale); });
  roadMap.horizontal.forEach(road => { const p = world({ x: road.left, z: road.near }); ctx.fillRect(p.x, p.y, (road.right - road.left) * scale, (road.far - road.near) * scale); });
  roadMap.markings.forEach(marking => {
    const a = world({ x: marking.ax, z: marking.az }), b = world({ x: marking.bx, z: marking.bz });
    ctx.strokeStyle = marking.color; ctx.lineWidth = Math.max(1, marking.width * scale); ctx.setLineDash(marking.dash ? [5, 5] : []);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  });
  ctx.setLineDash([]);
  nearbyBuildings(state.z, 35, state.x).forEach(building => { const p = world({ x: building.x - building.width / 2, z: building.z - building.length / 2 }); ctx.fillStyle = building.color; ctx.fillRect(p.x, p.y, building.width * scale, building.length * scale); ctx.strokeStyle = '#353837'; ctx.strokeRect(p.x, p.y, building.width * scale, building.length * scale); });
  const target = TARGET, t = world(target), targetWidth = BAY.width, targetLength = BAY.length;
  ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 3; ctx.strokeRect(t.x - targetWidth * scale / 2, t.y - targetLength * scale / 2, targetWidth * scale, targetLength * scale);
  [-1, 1].forEach(direction => { ctx.strokeStyle = direction > 0 ? '#63d67a' : '#ed5f59'; ctx.setLineDash([5, 4]); projectedTracks(direction).forEach(path => { ctx.beginPath(); path.forEach((p, i) => { const q = world(p); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); ctx.stroke(); }); }); ctx.setLineDash([]);
  visibleCars().forEach(car => { const p = world(car); drawTopCar(ctx, p.x, p.y, scale, car.heading, car.color, false, car.steer || 0, car.type); });
  drawTopCar(ctx, w / 2, h / 2, scale, state.heading, '#d5b58b', true, state.steer);
}

function renderDash() {
  document.querySelector('.cluster strong').textContent = Math.round(Math.abs(state.speed) * 3.6).toString().padStart(2, '0');
  document.querySelector('.wheel').style.transform = `rotate(${state.steer / CAR.maxSteer * 420}deg)`;
  document.querySelectorAll('.gear button').forEach(b => b.classList.toggle('active', b.textContent === state.gear));
}

addEventListener('keydown', e => { keys[e.key] = true; if (e.key.startsWith('Arrow')) e.preventDefault(); });
addEventListener('keyup', e => { keys[e.key] = false; });
document.querySelectorAll('[data-key]').forEach(button => { const set = value => keys[button.dataset.key] = value; button.onpointerdown = e => { button.setPointerCapture(e.pointerId); set(true); }; button.onpointerup = button.onpointercancel = () => set(false); });
document.querySelectorAll('.gear button').forEach(button => button.onclick = () => { state.gear = button.textContent; state.speed = 0; renderDash(); });
document.querySelector('.reset').onclick = reset;
document.querySelectorAll('.hide').forEach(button => button.onclick = () => { const box = button.closest('.monitor'), restore = document.querySelector('.restore'), replacement = document.createElement('button'); box.hidden = true; replacement.textContent = box.id === 'camera' ? '▣ Camera' : "◉ Bird's-eye"; replacement.onclick = () => { box.hidden = false; replacement.remove(); }; restore.append(replacement); });

const cockpit = document.querySelector('.cockpit');
const movableWindows = [...document.querySelectorAll('.mirror,.rearMirror,.monitor')];
movableWindows.forEach(panel => {
  let drag = null;
  panel.addEventListener('pointerdown', event => {
    if (event.target.closest('button')) return;
    const panelRect = panel.getBoundingClientRect();
    drag = { pointerId: event.pointerId, offsetX: event.clientX - panelRect.left, offsetY: event.clientY - panelRect.top };
    panel.setPointerCapture(event.pointerId);
    panel.classList.add('dragging');
    panel.style.zIndex = '12';
  });
  panel.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const area = cockpit.getBoundingClientRect(), width = panel.offsetWidth, height = panel.offsetHeight;
    const current = panel.getBoundingClientRect();
    const x = clamp(event.clientX - area.left - drag.offsetX, 0, area.width - width);
    const y = clamp(event.clientY - area.top - drag.offsetY, 0, area.height - height);
    const overlaps = (left, top) => movableWindows.some(other => {
      if (other === panel || other.hidden || getComputedStyle(other).display === 'none') return false;
      const box = other.getBoundingClientRect();
      return left < box.right && left + width > box.left && top < box.bottom && top + height > box.top;
    });
    const setPosition = (left, top) => { panel.style.left = `${left - area.left}px`; panel.style.top = `${top - area.top}px`; panel.style.right = 'auto'; };
    if (!overlaps(area.left + x, area.top + y)) setPosition(area.left + x, area.top + y);
    else if (!overlaps(area.left + x, current.top)) setPosition(area.left + x, current.top);
    else if (!overlaps(current.left, area.top + y)) setPosition(current.left, area.top + y);
  });
  const endDrag = event => { if (drag?.pointerId !== event.pointerId) return; drag = null; panel.classList.remove('dragging'); };
  panel.addEventListener('pointerup', endDrag);
  panel.addEventListener('pointercancel', endDrag);
});

const modal = document.querySelector('.modalBackdrop');
document.querySelector('#settings').onclick = () => { modal.hidden = false; };
document.querySelectorAll('.close,.done').forEach(button => button.onclick = () => { modal.hidden = true; });
modal.onclick = e => { if (e.target === modal) modal.hidden = true; };
document.querySelector('#fish').oninput = e => { state.fisheye = +e.target.value; document.querySelector('#fishValue').value = e.target.value; };
document.querySelector('#fov').oninput = e => { state.fov = +e.target.value; document.querySelector('#fovValue').value = e.target.value; };
document.querySelector('#height').oninput = e => { state.eyeHeight = +e.target.value; document.querySelector('#heightValue').value = (+e.target.value).toFixed(2); };

let last = performance.now();
function predictedPose(vehicle, seconds, speed = vehicle.speed) {
  const heading = vehicle.heading + speed / CAR.wheelbase * Math.tan(vehicle.steer || 0) * seconds;
  return { ...vehicle, heading, x: vehicle.x + Math.sin(heading) * speed * seconds, z: vehicle.z - Math.cos(heading) * speed * seconds };
}

function trafficHazard(car) {
  // Reserve two complete car lengths between a traffic bumper and the driver.
  // The look-ahead envelope means traffic brakes before entering that space,
  // rather than reacting only when the physical vehicle boxes overlap.
  const stopGap = CAR.length * 2;
  const closingWithDriver = Math.abs(car.speed) + Math.abs(state.speed);
  const horizon = clamp(2 + closingWithDriver / 2, 3, 6);
  for (let seconds = .25; seconds <= horizon; seconds += .25) {
    const futureCar = predictedPose(car, seconds);
    const futureDriver = predictedPose(state, seconds);
    if (polygonsOverlap(vehicleCorners(futureCar), vehicleCorners(futureDriver, stopGap * 2))) return { danger: true, seconds };
  }
  return { danger: false, seconds: Infinity };
}

function updateTraffic(dt) {
  traffic.forEach((car, index) => {
    // Every road user uses the same bicycle model as the driver's car.
    const cruise = trafficStarts[index].cruise;
    car.steer += (0 - car.steer) * Math.min(1, dt * 4);
    const hazard = trafficHazard(car);
    const desiredSpeed = hazard.danger ? (hazard.seconds < 2.2 ? 0 : cruise * clamp((hazard.seconds - 2) / 2.5, 0, 1)) : cruise;
    car.speed += clamp(desiredSpeed - car.speed, -7.5 * dt, 1.4 * dt);
    const next = { ...car, heading: car.heading + car.speed / CAR.wheelbase * Math.tan(car.steer) * dt };
    next.x += Math.sin(next.heading) * car.speed * dt; next.z -= Math.cos(next.heading) * car.speed * dt;
    const blockers = [...parkedCars(), ...traffic.filter(other => other !== car), state];
    const crash = blockers.some(other => polygonsOverlap(vehicleCorners(next), vehicleCorners(other, other === state ? CAR.length * 2 : .18))) || mapObstacles(next.z).some(object => polygonsOverlap(vehicleCorners(next), objectCorners(object)));
    if (crash) car.speed = Math.max(0, car.speed - 8 * dt);
    else Object.assign(car, { x: next.x, z: next.z, heading: next.heading });
    // Recycle traffic only at the far ends of the full 6.6 km map.
    if (Math.abs(car.z) > CITY.length / 2) car.z = -Math.sign(car.z) * (CITY.length / 2 - 10);
  });
}
function loop(time) {
  const dt = Math.min((time - last) / 1000, .04); last = time;
  updateTraffic(dt);
  const steerInput = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
  const steerTarget = steerInput * CAR.maxSteer;
  // A road-car steering rack takes time to travel lock-to-lock. The gentler
  // rate also keeps the on-screen wheel from snapping around at key-down.
  state.steer += clamp(steerTarget - state.steer, -.8 * dt, .8 * dt);
  if (!steerInput) state.steer *= Math.pow(.35, dt);
  let acceleration = 0;
  if (keys.ArrowUp) { state.gear = 'D'; acceleration = 2.7; }
  if (keys.ArrowDown) { state.gear = 'R'; acceleration = -2.2; }
  if (state.gear === 'P' || state.gear === 'N') state.speed *= Math.pow(.005, dt); else state.speed += (acceleration - state.speed * .8) * dt;
  state.speed = clamp(state.speed, -2.8, 4.2);
  const next = { ...state };
  next.heading += state.speed / CAR.wheelbase * Math.tan(state.steer) * dt;
  next.x += Math.sin(next.heading) * state.speed * dt;
  next.z -= Math.cos(next.heading) * state.speed * dt;
  if (collides(next)) {
    // Advance to the last clear pose so the bumpers meet without overlapping.
    let clear = 0, blocked = 1;
    for (let i = 0; i < 12; i++) {
      const fraction = (clear + blocked) / 2;
      const pose = { x: state.x + (next.x - state.x) * fraction, z: state.z + (next.z - state.z) * fraction, heading: state.heading + (next.heading - state.heading) * fraction };
      if (collides(pose)) blocked = fraction; else clear = fraction;
    }
    state.x += (next.x - state.x) * clear;
    state.z += (next.z - state.z) * clear;
    state.heading += (next.heading - state.heading) * clear;
    state.speed = 0; state.impactUntil = time + 1400;
  } else Object.assign(state, { x: next.x, z: next.z, heading: next.heading });
  const impact = document.querySelector('.impact'); impact.hidden = time > state.impactUntil;
  document.querySelectorAll('canvas').forEach(canvas => canvas.dataset.view === 'bird' ? drawBird(canvas) : drawPerspective(canvas, canvas.dataset.view));
  renderDash(); requestAnimationFrame(loop);
}
reset(); requestAnimationFrame(loop);
