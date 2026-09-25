const icon = name => `<span class="ico">${({ settings: '⚙', camera: '▣', eye: '◉', left: '‹', right: '›', reset: '↻', info: 'i' })[name]}</span>`;

document.querySelector('#root').innerHTML = `<main>
  <section class="cockpit">
    <div class="windshieldBrand"><b>PARKING SIMULATOR</b></div>
    <div class="mirrorMount left" aria-hidden="true"></div><div class="mirrorMount right" aria-hidden="true"></div>
    <div class="mirror left"><canvas data-view="leftMirror"></canvas><span>OBJECTS IN MIRROR ARE CLOSER THAN THEY APPEAR</span></div>
    <div class="rearMirrorStem" aria-hidden="true"></div><div class="rearMirror"><canvas data-view="rearMirror"></canvas></div>
    <div class="mirror right"><canvas data-view="rightMirror"></canvas></div>
    <div class="windshield"><canvas data-view="front"></canvas><canvas class="weatherGlass" aria-hidden="true"></canvas><div class="wipers off" aria-hidden="true"><i class="left"></i><i class="right"></i></div><div class="impact" hidden>OBSTACLE — VEHICLE STOPPED</div></div>
    <aside class="miniViews"><div class="monitor" id="camera"><div class="monitorTitle">${icon('camera')} REAR CAMERA <button class="hide">×</button></div><div class="feed"><canvas data-view="rearCamera"></canvas></div></div><div class="monitor" id="bird"><div class="monitorTitle">${icon('eye')} BIRD'S-EYE <button class="hide">×</button></div><div class="feed bird"><canvas data-view="bird"></canvas></div></div><div class="restore"></div></aside>
    <div class="dash"><div class="turnStalk" aria-label="Turn-signal stalk"><i></i></div><div class="wiperStalk" aria-label="Windshield-wiper stalk"><i></i></div><div class="wheel"><div class="wheelSpoke leftSpoke"></div><div class="wheelSpoke rightSpoke"></div><div class="wheelSpoke lowerSpoke"></div><button class="horn" aria-label="Honk horn"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 27h10l20-12v34L20 37H10zM40 25h6a8 8 0 0 1 0 16h-6"/><path class="sound" d="M51 20l5-5M54 32h7M51 44l5 5"/></svg></button></div><div class="cluster"><i class="turnIndicator left">◀</i><i class="turnIndicator right">▶</i><strong>00</strong><span>km/h</span></div><div class="gear">${['P', 'R', 'N', 'D'].map(g => `<button class="${g === 'P' ? 'active' : ''}">${g}</button>`).join('')}</div></div>
  </section>
  <footer><div class="utilityControls" role="group" aria-label="Settings, weather, headlamps, cameras, and reset"><button id="settings" class="footerSettings" aria-label="Open settings">${icon('settings')} <small>SETTINGS</small></button><button data-weather="0" aria-label="Sunny weather">☀ <small>SUNNY</small></button><button data-weather="1" aria-label="Rainy weather">☂ <small>RAIN</small></button><button data-weather="2" aria-label="Night weather">☾ <small>NIGHT</small></button><button class="headlampToggle" aria-label="Turn headlamps on" aria-pressed="false">◖ <small>HEADLAMP OFF</small></button><button class="camerasToggle active" aria-label="Disable both cameras" aria-pressed="true">▣ <small>CAMERAS ON</small></button><button class="reset">${icon('reset')} <small>RESET</small></button></div><div class="controls"><button data-signal="left" aria-label="Left turn signal">◀ <small>L</small></button><button data-signal="right" aria-label="Right turn signal">▶ <small>R</small></button><button class="wiperControl" aria-label="Cycle windshield wipers">⌁ <small>W · OFF</small></button><button data-key="ArrowLeft">${icon('left')}</button><div class="keygroup"><button data-key="ArrowUp" aria-label="Drive forward">↑</button></div><div class="keygroup"><button data-key="ArrowDown" aria-label="Reverse">↓</button></div><button data-key="ArrowRight">${icon('right')}</button></div></footer>
  <div class="modalBackdrop" hidden><div class="modal"><button class="close">×</button><h2>Simulation settings</h2><p>Fine-tune the optical behavior of your driving aids.</p><label>Mirror fisheye <b><output id="fishValue">16</output>%</b></label><input id="fish" type="range" value="16" min="0" max="40"><label>Camera field of view <b><output id="fovValue">110</output>°</b></label><input id="fov" type="range" value="110" min="75" max="135"><label>Driver eye height <b><output id="heightValue">1.25</output> m</b></label><input id="height" type="range" value="1.25" min="0.8" max="1.8" step="0.05"><button class="done">APPLY SETTINGS</button></div></div>
</main>`;

// The vehicle pose below is the single source of truth for every rendered view.
const state = { x: 0, z: 8, heading: 0, speed: 0, steer: 0, gear: 'P', fisheye: 16, fov: 110, eyeHeight: 1.25, impactUntil: 0, signal: null, signalOn: false, signalNextTick: 0, wiperMode: 0, weather: 0, headlights: false };
const keys = {};
const CAR = { width: 1.82, length: 4.45, height: 1.48, wheelbase: 2.7, maxSteer: 32 * Math.PI / 180, forwardAcceleration: 3.2, reverseAcceleration: 2.2, brakeDeceleration: 8 };
// The old scene ended after 66 m. This six-and-a-half kilometre city is 100× longer.
const CITY = { length: 6600, roadHalf: 7, sidewalk: 3, block: 80 };
const ROAD = { laneOffset: 2.7, dashLength: 3, dashGap: 3, lineWidth: .18 };
const ROUNDABOUTS = [];
// The city uses one simple orthogonal street grid. Every junction is a
// four-way '+' intersection; there are no diagonal or curved road overlays.
const BERCZY_ROADS = [];
const BAY_WIDTH = 3;
const BAY = { width: BAY_WIDTH, length: 5.5, rows: [42, 54, 66], columns: [-124, -121, -118, -115] };
const EXTRA_LOTS = [
  { width: 3, length: 5.5, rows: [42, 54], columns: [24, 27, 30, 33] },
  { width: 3, length: 5.5, rows: [-62, -50], columns: [-54, -51, -48, -45] }
];
const PARKING_LOTS = [BAY, ...EXTRA_LOTS];
const lotCars = [
  { x: BAY.columns[0], z: BAY.rows[0], heading: 0, color: '#202326', type: 'van' }, { x: BAY.columns[1], z: BAY.rows[0], heading: 0, color: '#e7e2d7' },
  { x: BAY.columns[2], z: BAY.rows[0], heading: 0, color: '#566977' }, { x: BAY.columns[3], z: BAY.rows[0], heading: 0, color: '#9a3f38' },
  { x: BAY.columns[0], z: BAY.rows[1], heading: 0, color: '#eee9dd' }, { x: BAY.columns[1], z: BAY.rows[1], heading: 0, color: '#34383a' },
  { x: BAY.columns[3], z: BAY.rows[1], heading: 0, color: '#bec5bd', type: 'truck' }, { x: BAY.columns[2], z: BAY.rows[2], heading: 0, color: '#315268' },
  { x: BAY.columns[3], z: BAY.rows[2], heading: 0, color: '#17191b' },
  ...EXTRA_LOTS.flatMap((lot, lotIndex) => lot.rows.flatMap((z, row) => lot.columns.filter((_, column) => (column + row + lotIndex) % 3 !== 1).map((x, column) => ({ x, z, heading: 0, color: ['#4a6574', '#d9d5c9', '#7d3432', '#313638'][(column + row + lotIndex) % 4], type: column === 0 && row === 0 ? 'van' : 'car' }))))
];
const curbCars = [
  { x: 5.55, z: -58, heading: 0, color: '#755a3c' }, { x: 5.55, z: -48, heading: 0, color: '#d7d9d5' }, { x: 5.55, z: 46, heading: 0, color: '#425b6b' },
  { x: -5.55, z: -32, heading: Math.PI, color: '#782f32' }, { x: -5.55, z: 34, heading: Math.PI, color: '#d1c5ad' }, { x: -5.55, z: 56, heading: Math.PI, color: '#343a3d', type: 'van' },
  { x: -52, z: 5.55, heading: Math.PI / 2, color: '#536f55' }, { x: 45, z: -5.55, heading: -Math.PI / 2, color: '#b6b2a7' }
];
const traffic = [
  { x: ROAD.laneOffset, z: -35, heading: 0, speed: 5.4, cruise: 5.4, color: '#d4d8d5' },
  { x: ROAD.laneOffset, z: 35, heading: 0, speed: 4.5, cruise: 4.5, color: '#c08b35', type: 'van' },
  { x: -ROAD.laneOffset, z: -48, heading: Math.PI, speed: 5.1, cruise: 5.1, color: '#54748a' },
  { x: -ROAD.laneOffset, z: 28, heading: Math.PI, speed: 4.1, cruise: 4.1, color: '#852f2f' },
  { x: ROAD.laneOffset, z: -112, heading: 0, speed: 5.8, cruise: 5.8, color: '#466779' },
  { x: -ROAD.laneOffset, z: 116, heading: Math.PI, speed: 5.2, cruise: 5.2, color: '#d2c9b7' },
  { x: -64, z: ROAD.laneOffset, heading: Math.PI / 2, speed: 4.8, cruise: 4.8, color: '#893c35' },
  { x: 61, z: -ROAD.laneOffset, heading: -Math.PI / 2, speed: 5.5, cruise: 5.5, color: '#39566a' },
  { x: -138, z: ROAD.laneOffset, heading: Math.PI / 2, speed: 4.6, cruise: 4.6, color: '#d6d9d5', type: 'van' },
  { x: 142, z: -ROAD.laneOffset, heading: -Math.PI / 2, speed: 5, cruise: 5, color: '#8d6a3d' },
  { x: ROAD.laneOffset, z: 154, heading: 0, speed: 4.9, cruise: 4.9, color: '#66715f' },
  { x: -ROAD.laneOffset, z: -152, heading: Math.PI, speed: 5.3, cruise: 5.3, color: '#a8afb0' },
  // Nearby cross-street traffic is immediately visible from the learner bay.
  // Eastbound uses the south/right lane; westbound uses the north/right lane.
  { x: -138, z: 82.7, heading: Math.PI / 2, speed: 5.2, cruise: 5.2, color: '#d2d7d5' },
  { x: -103, z: 77.3, heading: -Math.PI / 2, speed: 4.8, cruise: 4.8, color: '#37637a' },
  { x: -72, z: 82.7, heading: Math.PI / 2, speed: 5.6, cruise: 5.6, color: '#a54d3d' },
  { x: -151, z: 77.3, heading: -Math.PI / 2, speed: 4.6, cruise: 4.6, color: '#c4b27f', type: 'van' }
];
const trafficStarts = traffic.map(car => ({ ...car }));
traffic.forEach(car => car.movingTraffic = true);
const TARGET = { x: BAY.columns[2], z: BAY.rows[1], heading: 0 };
const parkedCars = () => [...lotCars, ...curbCars];
const visibleCars = () => [...parkedCars(), ...traffic];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Road surfaces and paint are generated in world coordinates. Every camera
// consumes these same physical segments; no view invents its own road lines.
function nearbyRoadMap(centerX, centerZ, reach) {
  const vertical = [], horizontal = [], markings = [];
  const firstX = Math.floor((centerX - reach) / CITY.block) * CITY.block;
  const firstZ = Math.floor((centerZ - reach) / CITY.block) * CITY.block;
  for (let x = firstX; x <= centerX + reach; x += CITY.block) {
    vertical.push({ left: x - CITY.roadHalf, right: x + CITY.roadHalf, near: centerZ - reach, far: centerZ + reach });
    markings.push(
      { ax: x - CITY.roadHalf, az: centerZ - reach, bx: x - CITY.roadHalf, bz: centerZ + reach, color: '#f2eee3', width: ROAD.lineWidth },
      { ax: x + CITY.roadHalf, az: centerZ - reach, bx: x + CITY.roadHalf, bz: centerZ + reach, color: '#f2eee3', width: ROAD.lineWidth }
    );
    const firstDash = Math.floor((centerZ - reach) / (ROAD.dashLength + ROAD.dashGap)) * (ROAD.dashLength + ROAD.dashGap);
    for (let z = firstDash; z < centerZ + reach; z += ROAD.dashLength + ROAD.dashGap) {
      const start = Math.max(z, centerZ - reach), end = Math.min(z + ROAD.dashLength, centerZ + reach);
      const intersection = Math.round((start + end) / 2 / CITY.block) * CITY.block;
      if (end > start && !(start < intersection + CITY.roadHalf && end > intersection - CITY.roadHalf)) markings.push({ ax: x, az: start, bx: x, bz: end, color: '#f2eee3', width: ROAD.lineWidth });
    }
  }
  for (let z = firstZ; z <= centerZ + reach; z += CITY.block) {
    horizontal.push({ left: centerX - reach, right: centerX + reach, near: z - CITY.roadHalf, far: z + CITY.roadHalf });
    markings.push(
      { ax: centerX - reach, az: z - CITY.roadHalf, bx: centerX + reach, bz: z - CITY.roadHalf, color: '#f2eee3', width: ROAD.lineWidth },
      { ax: centerX - reach, az: z + CITY.roadHalf, bx: centerX + reach, bz: z + CITY.roadHalf, color: '#f2eee3', width: ROAD.lineWidth }
    );
    const firstDash = Math.floor((centerX - reach) / (ROAD.dashLength + ROAD.dashGap)) * (ROAD.dashLength + ROAD.dashGap);
    for (let x = firstDash; x < centerX + reach; x += ROAD.dashLength + ROAD.dashGap) {
      const start = Math.max(x, centerX - reach), end = Math.min(x + ROAD.dashLength, centerX + reach);
      const intersection = Math.round((start + end) / 2 / CITY.block) * CITY.block;
      if (end > start && !(start < intersection + CITY.roadHalf && end > intersection - CITY.roadHalf)) markings.push({ ax: start, az: z, bx: end, bz: z, color: '#f2eee3', width: ROAD.lineWidth });
    }
  }
  return { vertical, horizontal, markings };
}

function markingCorners(marking) {
  const dx = marking.bx - marking.ax, dz = marking.bz - marking.az;
  const length = Math.hypot(dx, dz) || 1, ox = -dz / length * marking.width / 2, oz = dx / length * marking.width / 2;
  return [[marking.ax + ox, marking.az + oz], [marking.bx + ox, marking.bz + oz], [marking.bx - ox, marking.bz - oz], [marking.ax - ox, marking.az - oz]];
}

function circlePoints(x, z, radius, segments = 48) {
  return Array.from({ length: segments }, (_, i) => {
    const angle = i / segments * Math.PI * 2;
    return [x + Math.cos(angle) * radius, z + Math.sin(angle) * radius];
  });
}

function segmentCorners(ax, az, bx, bz, width) {
  const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz) || 1;
  const ox = -dz / length * width / 2, oz = dx / length * width / 2;
  return [[ax + ox, az + oz], [bx + ox, bz + oz], [bx - ox, bz - oz], [ax - ox, az - oz]];
}

function nearbyBerczyRoads(centerX, centerZ, reach) {
  return BERCZY_ROADS.flatMap(road => road.points.slice(1).map((point, index) => ({
    name: road.name, width: road.width, ax: road.points[index][0], az: road.points[index][1], bx: point[0], bz: point[1]
  }))).filter(segment => Math.min(segment.ax, segment.bx) <= centerX + reach && Math.max(segment.ax, segment.bx) >= centerX - reach && Math.min(segment.az, segment.bz) <= centerZ + reach && Math.max(segment.az, segment.bz) >= centerZ - reach);
}

function nearbyRoundabouts(centerX, centerZ, reach) {
  return ROUNDABOUTS.filter(roundabout => Math.abs(roundabout.x - centerX) <= reach + roundabout.outerRadius && Math.abs(roundabout.z - centerZ) <= reach + roundabout.outerRadius);
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
  // Reserve the complete parking-lot footprint; generated buildings may not
  // overlap its pavement, bays, or access margin.
  return buildings.filter(building => PARKING_LOTS.every(lot => {
    const lotLeft = lot.columns[0] - lot.width / 2 - 4, lotRight = lot.columns.at(-1) + lot.width / 2 + 4;
    const lotFar = lot.rows[0] - lot.length / 2 - 4, lotNear = lot.rows.at(-1) + lot.length / 2 + 4;
    return building.x + building.width / 2 <= lotLeft || building.x - building.width / 2 >= lotRight || building.z + building.length / 2 <= lotFar || building.z - building.length / 2 >= lotNear;
  }));
}

function mapObstacles(center = state.z, reach = 24) {
  const buildings = nearbyBuildings(center, reach + 24, state.x).map(building => ({ ...building, heading: 0 }));
  const islands = nearbyRoundabouts(state.x, center, reach + 24).map(roundabout => ({ ...roundabout, type: 'island' }));
  return [...buildings, ...islands];
}

function reset() {
  Object.assign(state, { x: TARGET.x, z: TARGET.z, heading: TARGET.heading, speed: 0, steer: 0, gear: 'P', impactUntil: 0, signal: null, signalOn: false, signalNextTick: 0, wiperMode: 0, weather: 0, headlights: false });
  renderWipers();
  renderWeather();
  renderHeadlamps();
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

function vehicleCorners(vehicle, widthMargin = 0, lengthMargin = widthMargin) {
  const size = vehicleSize(vehicle), mirrors = vehicleMirrorGeometry(vehicle);
  const physicalWidth = Math.max(size.width, ...mirrors.map(part => Math.max(Math.abs(part.minSide), Math.abs(part.maxSide)) * 2));
  const hw = (physicalWidth + widthMargin) / 2, hl = (size.length + lengthMargin) / 2;
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
  return [...visibleCars(), ...mapObstacles(pose.z)].some(object => polygonsOverlap(player, obstaclePolygon(object)));
}

function obstaclePolygon(object) {
  if (object.type === 'island') return circlePoints(object.x, object.z, object.islandRadius).map(([x, z]) => ({ x, z }));
  if (object.type === 'barrier' || object.type === 'building') return objectCorners(object);
  return vehicleCorners(object);
}

function objectCorners(object, margin = 0) {
  const hw = (object.width + margin) / 2, hl = (object.length + margin) / 2;
  return [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([x, z]) => ({ x: object.x + x, z: object.z + z }));
}

function segmentIntersectsBox(ax, az, bx, bz, box, endBefore = .98) {
  const minX = box.x - box.width / 2, maxX = box.x + box.width / 2;
  const minZ = box.z - box.length / 2, maxZ = box.z + box.length / 2;
  const dx = bx - ax, dz = bz - az;
  let enter = 0, exit = endBefore;
  for (const [origin, delta, min, max] of [[ax, dx, minX, maxX], [az, dz, minZ, maxZ]]) {
    if (Math.abs(delta) < 1e-8) { if (origin < min || origin > max) return false; continue; }
    const t1 = (min - origin) / delta, t2 = (max - origin) / delta;
    enter = Math.max(enter, Math.min(t1, t2)); exit = Math.min(exit, Math.max(t1, t2));
    if (enter > exit) return false;
  }
  return exit >= 0 && enter <= endBefore;
}

function vehicleSize(vehicle) {
  if (vehicle.type === 'van') return { width: 2.05, length: 5.2, height: 2.25 };
  if (vehicle.type === 'truck') return { width: 2.1, length: 5.35, height: 2.15 };
  return CAR;
}

// Physical mirror solids are owned by the vehicle and reused by every view.
function vehicleMirrorGeometry(vehicle) {
  const size = vehicleSize(vehicle), forward = -size.length * .12;
  return [-1, 1].flatMap(side => {
    const edge = side * size.width / 2, signed = distance => edge + side * distance;
    return [
      { kind: 'mount', side, minSide: Math.min(signed(-.08), signed(.2)), maxSide: Math.max(signed(-.08), signed(.2)), minForward: forward - .1, maxForward: forward + .1, bottom: .7, top: 1.02 },
      { kind: 'housing', side, minSide: Math.min(signed(.14), signed(.42)), maxSide: Math.max(signed(.14), signed(.42)), minForward: forward - .18, maxForward: forward + .18, bottom: .82, top: 1.16 }
    ];
  });
}

function vehicleHeadlightBeams(vehicle) {
  const size = vehicleSize(vehicle), front = size.length / 2 + .04, reach = state.weather === 2 ? 26 : 18;
  const worldPoint = (side, forward) => ({
    x: vehicle.x + side * Math.cos(vehicle.heading) + forward * Math.sin(vehicle.heading),
    z: vehicle.z + side * Math.sin(vehicle.heading) - forward * Math.cos(vehicle.heading)
  });
  return [-1, 1].map(side => {
    const lamp = side * size.width * .28, farCenter = lamp + side * .65, spread = state.weather === 2 ? 6.5 : 5.5;
    return [worldPoint(lamp - .16, front), worldPoint(lamp + .16, front), worldPoint(farCenter + spread, front + reach), worldPoint(farCenter - spread, front + reach)];
  });
}

function vehicleHeadlightBands(vehicle, bands = 6, lateralBands = 5) {
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
  return vehicleHeadlightBeams(vehicle).flatMap(beam => Array.from({ length: bands }, (_, index) => {
    const nearT = index / bands, farT = (index + 1) / bands, midpoint = (nearT + farT) / 2;
    const nearLeft = lerp(beam[0], beam[3], nearT), nearRight = lerp(beam[1], beam[2], nearT), farLeft = lerp(beam[0], beam[3], farT), farRight = lerp(beam[1], beam[2], farT);
    return Array.from({ length: lateralBands }, (_, lateralIndex) => {
      const leftT = lateralIndex / lateralBands, rightT = (lateralIndex + 1) / lateralBands, lateralMid = (leftT + rightT) / 2;
      const edgeFade = Math.pow(Math.sin(lateralMid * Math.PI), .7);
      return { points: [lerp(nearLeft, nearRight, leftT), lerp(nearLeft, nearRight, rightT), lerp(farLeft, farRight, rightT), lerp(farLeft, farRight, leftT)], intensity: Math.pow(1 - midpoint, 1.35) * edgeFade };
    });
  }).flat());
}

const activeHeadlightVehicles = () => state.headlights ? [...traffic, state] : [...traffic];
function headlightIntensityAt(x, z, exclude = null) {
  let illumination = 0;
  for (const source of activeHeadlightVehicles()) {
    if (source === exclude) continue;
    const size = vehicleSize(source), dx = x - source.x, dz = z - source.z;
    const forward = dx * Math.sin(source.heading) - dz * Math.cos(source.heading);
    const lateral = dx * Math.cos(source.heading) + dz * Math.sin(source.heading);
    const start = size.length / 2, reach = state.weather === 2 ? 26 : 18;
    if (forward < start || forward > start + reach) continue;
    const distance = forward - start, halfWidth = size.width * .45 + distance * .32;
    if (Math.abs(lateral) > halfWidth) continue;
    const beam = Math.pow(1 - distance / reach, .7) * Math.pow(1 - Math.abs(lateral) / halfWidth, .65);
    illumination = Math.max(illumination, beam);
  }
  return illumination;
}

function headlightGlow(intensity, nightScale = 1) {
  return `rgba(255,232,166,${Math.min(.48, intensity * .32 * nightScale)})`;
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

function drawTopCar(ctx, x, y, scale, heading, color, player = false, steer = 0, type = 'car', lightsOn = player) {
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
  vehicleMirrorGeometry({ type }).forEach(part => {
    ctx.fillStyle = part.kind === 'mount' ? color : '#202a2d';
    ctx.beginPath(); ctx.roundRect(part.minSide, part.minForward, part.maxSide - part.minSide, part.maxForward - part.minForward, part.kind === 'housing' ? .08 : .03); ctx.fill();
    ctx.strokeStyle = '#111716'; ctx.lineWidth = .04; ctx.stroke();
  });
  ctx.fillStyle = lightsOn ? '#fff4bd' : '#4b514e'; ctx.fillRect(-size.width * .3, -size.length / 2, size.width * .6, .08);
  ctx.fillStyle = '#a91e18'; ctx.fillRect(-size.width * .3, size.length / 2 - .08, size.width * .6, .08);
  if (player) { ctx.fillStyle = '#d9be8e'; ctx.fillRect(-.14, -2.32, .28, .18); }
  ctx.restore();
}

function cameraDefinition(view) {
  if (view === 'rearCamera') return { yaw: Math.PI, mount: -CAR.length / 2, mirror: false, fov: state.fov, path: -1 };
  if (view === 'rearMirror') return { yaw: Math.PI, mount: .35, mirror: true, fov: 82, path: 0 };
  if (view === 'leftMirror') return { yaw: Math.PI + .48, mount: .45, mirror: true, fov: 76, horizon: .27, path: 0 };
  if (view === 'rightMirror') return { yaw: Math.PI - .48, mount: .45, mirror: true, fov: 76, horizon: .27, path: 0 };
  return { yaw: 0, mount: .55, mirror: false, fov: 92, path: 1 };
}

function drawPerspective(canvas, view) {
  const ctx = canvas.getContext('2d'), w = canvas.clientWidth, h = canvas.clientHeight, dpr = devicePixelRatio || 1;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  const camera = cameraDefinition(view), horizon = h * (camera.horizon ?? .48);
  const cameraX = state.x + Math.sin(state.heading) * camera.mount;
  const cameraZ = state.z - Math.cos(state.heading) * camera.mount;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon); sky.addColorStop(0, '#83939a'); sky.addColorStop(1, '#d7d2c6'); ctx.fillStyle = sky; ctx.fillRect(0, 0, w, horizon);
  ctx.fillStyle = '#717870'; ctx.fillRect(0, horizon, w, h - horizon);
  const focal = (w / 2) / Math.tan(camera.fov * Math.PI / 360);
  const distortionAmount = camera.mirror ? state.fisheye : 0;
  const project3d = (x, z, height = 0) => { const p = localPoint(x, z, camera.yaw, camera.mount); if (p.y < .04) return null; let sx = w / 2 + p.x / p.y * focal; if (camera.mirror) sx = w - sx; const distortion = 1 + distortionAmount / 250 * Math.pow(Math.abs(sx - w / 2) / (w / 2), 2); sx = w / 2 + (sx - w / 2) * distortion; return { x: sx, y: horizon + focal * (state.eyeHeight - height) / p.y, depth: p.y }; };
  const project = (x, z) => project3d(x, z, 0);
  let redrawBuildings = () => {};
  let redrawStopSigns = () => {};
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
    const berczyRoads = nearbyBerczyRoads(state.x, center, reach);
    berczyRoads.forEach(road => groundPolygon(segmentCorners(road.ax, road.az, road.bx, road.bz, road.width), '#444b4c'));
    PARKING_LOTS.forEach(lot => {
      const lotLeft = lot.columns[0] - lot.width / 2 - 4, lotRight = lot.columns.at(-1) + lot.width / 2 + 4;
      const lotNear = lot.rows.at(-1) + lot.length / 2 + 4, lotFar = lot.rows[0] - lot.length / 2 - 4;
      groundPolygon([[lotLeft, lotFar], [lotRight, lotFar], [lotRight, lotNear], [lotLeft, lotNear]], '#555d5b');
    });
    roadMap.markings.forEach(marking => groundPolygon(markingCorners(marking), marking.color));
    berczyRoads.forEach(road => groundPolygon(segmentCorners(road.ax, road.az, road.bx, road.bz, ROAD.lineWidth), '#f2eee3'));
    const roundabouts = nearbyRoundabouts(state.x, center, reach);
    roundabouts.forEach(roundabout => {
      // The circular road, curb, and island are all map geometry shared by
      // every view. Drawing it after the grid removes through-lines cleanly.
      groundPolygon(circlePoints(roundabout.x, roundabout.z, roundabout.outerRadius), '#f2eee3');
      groundPolygon(circlePoints(roundabout.x, roundabout.z, roundabout.outerRadius - ROAD.lineWidth), '#444b4c');
      groundPolygon(circlePoints(roundabout.x, roundabout.z, roundabout.islandRadius + .35), '#eee9dd');
      groundPolygon(circlePoints(roundabout.x, roundabout.z, roundabout.islandRadius), '#65755d');
    });
    const blocks = nearbyBuildings(center, reach, state.x).map(block => ({ ...block, depth: localPoint(block.x, block.z, camera.yaw, camera.mount).y })).filter(block => block.depth > .4);
    const drawBuilding = block => {
      const corners = objectCorners(block);
      const raw = (point, height) => ({ ...localPoint(point.x, point.z, camera.yaw, camera.mount), height });
      const bottom = corners.map(point => raw(point, 0)), top = corners.map(point => raw(point, block.height));
      const clipWall = vertices => {
        const clipped = [];
        vertices.forEach((current, i) => {
          const previous = vertices[(i + vertices.length - 1) % vertices.length], inside = current.y >= .1, previousInside = previous.y >= .1;
          if (inside !== previousInside) { const t = (.1 - previous.y) / (current.y - previous.y); clipped.push({ x: previous.x + (current.x - previous.x) * t, y: .1, height: previous.height + (current.height - previous.height) * t }); }
          if (inside) clipped.push(current);
        });
        return clipped;
      };
      const toScreen = point => { let x = w / 2 + point.x / point.y * focal; if (camera.mirror) x = w - x; return { x, y: horizon + focal * (state.eyeHeight - point.height) / point.y }; };
      const face = (vertices, fill) => { const points = clipWall(vertices).map(toScreen); if (points.length < 3) return; ctx.fillStyle = fill; ctx.strokeStyle = '#3f3b37'; ctx.lineWidth = 1; ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.fill(); ctx.stroke(); };
      ctx.globalAlpha = 1;
      const visibleFace = i => i === 0 ? cameraZ < block.z - block.length / 2 : i === 1 ? cameraX > block.x + block.width / 2 : i === 2 ? cameraZ > block.z + block.length / 2 : cameraX < block.x - block.width / 2;
      const faces = [0, 1, 2, 3].filter(visibleFace).map(i => ({ i, depth: [bottom[i], bottom[(i + 1) % 4]].reduce((sum, point) => sum + point.y, 0) / 2 })).sort((a, b) => b.depth - a.depth);
      // Each visible side is one painter unit: opaque wall first, then only
      // that wall's windows. Hidden rear faces are never submitted at all.
      faces.forEach(({ i }) => {
        const rawWall = [bottom[i], bottom[(i + 1) % 4], top[(i + 1) % 4], top[i]];
        face(rawWall, i % 2 ? block.color : '#625c57');
        if (rawWall.some(point => point.y < .1)) return;
        const wall = rawWall.map(toScreen);
        const interpolate = (u, v) => ({ x: wall[0].x * (1 - u) * (1 - v) + wall[1].x * u * (1 - v) + wall[2].x * u * v + wall[3].x * (1 - u) * v, y: wall[0].y * (1 - u) * (1 - v) + wall[1].y * u * (1 - v) + wall[2].y * u * v + wall[3].y * (1 - u) * v });
        for (const u of [.15, .43, .71]) {
          const glass = [interpolate(u, .22), interpolate(u + .16, .22), interpolate(u + .16, .52), interpolate(u, .52)];
          ctx.fillStyle = '#4f7582'; ctx.beginPath(); glass.forEach((point, j) => j ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.closePath(); ctx.fill();
        }
        const light = Math.max(...corners.map(point => headlightIntensityAt(point.x, point.z)), headlightIntensityAt(block.x, block.z));
        if (light > .01) face(rawWall, headlightGlow(light, state.weather === 2 ? 1.5 : 1));
      });
    };
    blocks.sort((a, b) => b.depth - a.depth);
    redrawBuildings = () => blocks.forEach(drawBuilding);
    redrawBuildings();
    // Stop signs sit on the near-right corner of each intersection. They are
    // redrawn after buildings only when the camera has a clear line of sight.
    redrawStopSigns = () => {
      for (const roadX of roadMap.vertical) for (const roadZ of roadMap.horizontal) {
        const x = (roadX.left + roadX.right) / 2, z = (roadZ.near + roadZ.far) / 2;
        if (roundabouts.some(roundabout => Math.hypot(roundabout.x - x, roundabout.z - z) < 1)) continue;
        // One sign for every approach, each on that driver's right shoulder.
        for (const [ox, oz] of [[9, 9], [-9, -9], [-9, 9], [9, -9]]) {
          const signX = x + ox, signZ = z + oz;
          if (blocks.some(building => segmentIntersectsBox(cameraX, cameraZ, signX, signZ, building))) continue;
          const pole = project3d(signX, signZ, 0), sign = project3d(signX, signZ, 2.35);
          if (!pole || !sign) continue;
          ctx.strokeStyle = '#d8d8d2'; ctx.lineWidth = Math.max(1, 22 / sign.depth); ctx.beginPath(); ctx.moveTo(pole.x, pole.y); ctx.lineTo(sign.x, sign.y); ctx.stroke();
          const signScale = view === 'front' ? 1.55 : camera.mirror ? .55 : .85;
          const radius = clamp(220 / sign.depth * signScale, 3, view === 'front' ? 28 : 15); ctx.fillStyle = '#b92f2b'; ctx.beginPath(); for (let i = 0; i < 8; i++) { const angle = Math.PI / 8 + i * Math.PI / 4; const px = sign.x + Math.cos(angle) * radius, py = sign.y + Math.sin(angle) * radius; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.fill();
          if (radius > 7) { ctx.fillStyle = '#fff'; ctx.font = `bold ${radius * .55}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('STOP', sign.x, sign.y + radius * .2); }
        }
      }
    };
    redrawStopSigns();
  }
  // Parking grid is projected from the same world coordinates as the bird's-eye view.
  ctx.lineWidth = 2; ctx.strokeStyle = '#edbd4e';
  PARKING_LOTS.forEach(lot => lot.rows.forEach(z => {
    const near = z + lot.length / 2, far = z - lot.length / 2;
    const left = lot.columns[0] - lot.width / 2, right = lot.columns.at(-1) + lot.width / 2;
    const targetRow = lot === BAY && z === TARGET.z, targetIndex = lot.columns.indexOf(TARGET.x);
    for (let i = 0; i <= lot.columns.length; i++) {
      const x = left + i * lot.width;
      if (targetRow && (i === targetIndex || i === targetIndex + 1)) continue;
      groundLine(x, near, x, far);
    }
    if (targetRow) {
      const targetLeft = TARGET.x - lot.width / 2, targetRight = TARGET.x + lot.width / 2;
      groundLine(left, near, targetLeft, near); groundLine(targetRight, near, right, near); groundLine(left, far, targetLeft, far); groundLine(targetRight, far, right, far);
    } else { groundLine(left, near, right, near); groundLine(left, far, right, far); }
  }));
  const target = TARGET;
  ctx.strokeStyle = '#ffe393'; ctx.lineWidth = 4;
  const targetWidth = BAY.width;
  const targetLength = BAY.length;
  const left = target.x - targetWidth / 2, right = target.x + targetWidth / 2, near = target.z + targetLength / 2, far = target.z - targetLength / 2;
  groundLine(left, near, right, near); groundLine(left, near, left, far); groundLine(right, near, right, far); groundLine(left, far, right, far);
  if (view !== 'front' && camera.path) {
    ctx.strokeStyle = camera.path > 0 ? '#63d67a' : '#ed5f59'; ctx.lineWidth = 3; ctx.setLineDash([7, 5]);
    projectedTracks(camera.path).forEach(path => { ctx.beginPath(); let begun = false; path.forEach(p => { const q = project(p.x, p.z); if (q) { begun ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); begun = true; } }); ctx.stroke(); });
    ctx.setLineDash([]);
  }
  const drawProjectedCar = car => {
    // Project the real 1.82 m × 4.45 m × 1.48 m vehicle box. In particular,
    // the nearest bumper—not the car center—determines its apparent size.
    const size = vehicleSize(car), hw = size.width / 2, hl = size.length / 2;
    const cameraDx = cameraX - car.x, cameraDz = cameraZ - car.z;
    const cameraSide = cameraDx * Math.cos(car.heading) + cameraDz * Math.sin(car.heading);
    const cameraForward = cameraDx * Math.sin(car.heading) - cameraDz * Math.cos(car.heading);
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
    const faceVisible = i => i === 0 ? cameraForward > 0 : i === 1 ? cameraSide > 0 : i === 2 ? cameraForward < 0 : cameraSide < 0;
    const faces = (lower, upper) => [0, 1, 2, 3].filter(faceVisible).map(i => ({ i, points: [lower[i], lower[(i + 1) % 4], upper[(i + 1) % 4], upper[i]], depth: (lower[i].y + lower[(i + 1) % 4].y) / 2 })).sort((a, b) => b.depth - a.depth);
    faces(bottom, bodyTop).forEach(face => polygon(face.points, face.i % 2 ? car.color : '#313838'));
    polygon(bodyTop, car.color);
    if (traffic.includes(car) && cameraForward > 0) for (const side of [-1, 1]) {
      const lamp = side * size.width * .28;
      polygon([point(lamp - .12, hl + .006, .25), point(lamp + .12, hl + .006, .25), point(lamp + .12, hl + .006, .46), point(lamp - .12, hl + .006, .46)], '#fff2b8');
    }
    faces(cabinBase, roof).forEach(face => {
      polygon(face.points, car.color);
      const glass = face.points.map((p, i) => ({ ...p, height: p.height + (i < 2 ? .13 : -.12) }));
      polygon(glass, face.i === 0 ? '#8eabb5' : '#304b58');
    });
    polygon(roof, car.color);
    const receivedLight = headlightIntensityAt(car.x, car.z, car);
    if (receivedLight > .01) {
      const glow = headlightGlow(receivedLight, state.weather === 2 ? 1.6 : 1);
      faces(bottom, bodyTop).forEach(face => polygon(face.points, glow)); polygon(bodyTop, glow);
      faces(cabinBase, roof).forEach(face => polygon(face.points, glow)); polygon(roof, glow);
    }
    const cuboid = (part, fill) => {
      const footprint = [[part.minSide, part.maxForward], [part.maxSide, part.maxForward], [part.maxSide, part.minForward], [part.minSide, part.minForward]];
      const lower = footprint.map(([side, forward]) => point(side, forward, part.bottom));
      const upper = footprint.map(([side, forward]) => point(side, forward, part.top));
      faces(lower, upper).forEach(face => polygon(face.points, fill)); polygon(upper, fill);
    };
    vehicleMirrorGeometry(car).filter(part => Math.abs(cameraSide) < hw * .12 || part.side * cameraSide > 0).forEach(part => cuboid(part, part.kind === 'mount' ? car.color : '#202a2d'));
  };
  // Repaint solid structures after every ground overlay and sign. Canvas has no
  // depth buffer, so this pass prevents guides and street furniture from being
  // painted through a wall.
  const headlightVehicles = activeHeadlightVehicles();
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  headlightVehicles.forEach(car => vehicleHeadlightBands(car).forEach(band => groundPolygon(band.points.map(point => [point.x, point.z]), `rgba(255,238,181,${band.intensity * (state.weather === 2 ? .42 : .32)})`)));
  ctx.restore();
  redrawBuildings();
  redrawStopSigns();
  const occluders = nearbyBuildings(state.z, 180, state.x);
  visibleCars().filter(car => !occluders.some(building => segmentIntersectsBox(cameraX, cameraZ, car.x, car.z, building))).map(car => ({ car, depth: localPoint(car.x, car.z, camera.yaw, camera.mount).y })).sort((a, b) => b.depth - a.depth).forEach(item => drawProjectedCar(item.car));
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
  PARKING_LOTS.forEach(lot => lot.rows.forEach(z => {
    const left = lot.columns[0] - lot.width / 2, right = lot.columns.at(-1) + lot.width / 2;
    const near = z + lot.length / 2, far = z - lot.length / 2;
    const targetRow = lot === BAY && z === TARGET.z, targetIndex = lot.columns.indexOf(TARGET.x);
    for (let i = 0; i <= lot.columns.length; i++) {
      if (targetRow && (i === targetIndex || i === targetIndex + 1)) continue;
      const a = world({ x: left + i * lot.width, z: near }), b = world({ x: left + i * lot.width, z: far });
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    if (targetRow) {
      const targetLeft = TARGET.x - BAY.width / 2, targetRight = TARGET.x + BAY.width / 2;
      for (const edgeZ of [near, far]) for (const [ax, bx] of [[left, targetLeft], [targetRight, right]]) { const a = world({ x: ax, z: edgeZ }), b = world({ x: bx, z: edgeZ }); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    } else { const topLeft = world({ x: left, z: far }); ctx.strokeRect(topLeft.x, topLeft.y, (right - left) * scale, lot.length * scale); }
  }));
  const roadMap = nearbyRoadMap(state.x, state.z, 30);
  ctx.fillStyle = '#444b4c';
  roadMap.vertical.forEach(road => { const p = world({ x: road.left, z: road.near }); ctx.fillRect(p.x, p.y, (road.right - road.left) * scale, (road.far - road.near) * scale); });
  roadMap.horizontal.forEach(road => { const p = world({ x: road.left, z: road.near }); ctx.fillRect(p.x, p.y, (road.right - road.left) * scale, (road.far - road.near) * scale); });
  const berczyRoads = nearbyBerczyRoads(state.x, state.z, 30);
  berczyRoads.forEach(road => {
    const corners = segmentCorners(road.ax, road.az, road.bx, road.bz, road.width).map(([x, z]) => world({ x, z }));
    ctx.fillStyle = '#444b4c'; ctx.beginPath(); corners.forEach((point, i) => i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.closePath(); ctx.fill();
  });
  roadMap.markings.forEach(marking => {
    const corners = markingCorners(marking).map(([x, z]) => world({ x, z }));
    ctx.fillStyle = marking.color; ctx.beginPath(); corners.forEach((point, i) => i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.closePath(); ctx.fill();
  });
  berczyRoads.forEach(road => {
    const corners = segmentCorners(road.ax, road.az, road.bx, road.bz, ROAD.lineWidth).map(([x, z]) => world({ x, z }));
    ctx.fillStyle = '#f2eee3'; ctx.beginPath(); corners.forEach((point, i) => i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.closePath(); ctx.fill();
  });
  nearbyRoundabouts(state.x, state.z, 30).forEach(roundabout => {
    const center = world(roundabout);
    ctx.fillStyle = '#f2eee3'; ctx.beginPath(); ctx.arc(center.x, center.y, roundabout.outerRadius * scale, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#444b4c'; ctx.beginPath(); ctx.arc(center.x, center.y, (roundabout.outerRadius - ROAD.lineWidth) * scale, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#eee9dd'; ctx.beginPath(); ctx.arc(center.x, center.y, (roundabout.islandRadius + .35) * scale, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#65755d'; ctx.beginPath(); ctx.arc(center.x, center.y, roundabout.islandRadius * scale, 0, Math.PI * 2); ctx.fill();
  });
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  activeHeadlightVehicles().forEach(car => vehicleHeadlightBands(car).forEach(band => {
    const points = band.points.map(world); ctx.fillStyle = `rgba(255,238,181,${band.intensity * (state.weather === 2 ? .44 : .3)})`; ctx.beginPath(); points.forEach((point, i) => i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.closePath(); ctx.fill();
  }));
  ctx.restore();
  nearbyBuildings(state.z, 35, state.x).forEach(building => { const p = world({ x: building.x - building.width / 2, z: building.z - building.length / 2 }); ctx.fillStyle = building.color; ctx.fillRect(p.x, p.y, building.width * scale, building.length * scale); ctx.strokeStyle = '#353837'; ctx.strokeRect(p.x, p.y, building.width * scale, building.length * scale); });
  const target = TARGET, t = world(target), targetWidth = BAY.width, targetLength = BAY.length;
  ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 3; ctx.strokeRect(t.x - targetWidth * scale / 2, t.y - targetLength * scale / 2, targetWidth * scale, targetLength * scale);
  [-1, 1].forEach(direction => { ctx.strokeStyle = direction > 0 ? '#63d67a' : '#ed5f59'; ctx.setLineDash([5, 4]); projectedTracks(direction).forEach(path => { ctx.beginPath(); path.forEach((p, i) => { const q = world(p); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); ctx.stroke(); }); }); ctx.setLineDash([]);
  visibleCars().forEach(car => { const p = world(car); drawTopCar(ctx, p.x, p.y, scale, car.heading, car.color, false, car.steer || 0, car.type, traffic.includes(car)); });
  drawTopCar(ctx, w / 2, h / 2, scale, state.heading, '#d5b58b', true, state.steer, 'car', true);
}

function renderDash() {
  document.querySelector('.cluster strong').textContent = Math.round(Math.abs(state.speed) * 3.6).toString().padStart(2, '0');
  document.querySelector('.wheel').style.transform = `rotate(${state.steer / CAR.maxSteer * 420}deg)`;
  document.querySelectorAll('.gear button').forEach(b => b.classList.toggle('active', b.textContent === state.gear));
  document.querySelectorAll('.turnIndicator').forEach(indicator => indicator.classList.toggle('active', state.signalOn && indicator.classList.contains(state.signal)));
  document.querySelectorAll('[data-signal]').forEach(button => button.classList.toggle('active', button.dataset.signal === state.signal));
}

addEventListener('keydown', e => {
  keys[e.key] = true;
  const signalKey = e.key.toLowerCase();
  if (!e.repeat && (signalKey === 'l' || signalKey === 'r')) toggleSignal(signalKey === 'l' ? 'left' : 'right');
  if (!e.repeat && signalKey === 'w') cycleWipers();
  if (e.key.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.key] = false; });
document.querySelectorAll('[data-key]').forEach(button => { const set = value => keys[button.dataset.key] = value; button.onpointerdown = e => { button.setPointerCapture(e.pointerId); set(true); }; button.onpointerup = button.onpointercancel = () => set(false); });
document.querySelectorAll('.gear button').forEach(button => button.onclick = () => { state.gear = button.textContent; state.speed = 0; renderDash(); });
document.querySelector('.reset').onclick = reset;
const headlampToggle = document.querySelector('.headlampToggle');
function renderHeadlamps() {
  headlampToggle.classList.toggle('active', state.headlights);
  headlampToggle.setAttribute('aria-pressed', state.headlights);
  headlampToggle.setAttribute('aria-label', `Turn headlamps ${state.headlights ? 'off' : 'on'}`);
  headlampToggle.querySelector('small').textContent = `HEADLAMP ${state.headlights ? 'ON' : 'OFF'}`;
}
headlampToggle.onclick = () => { state.headlights = !state.headlights; renderHeadlamps(); };
let hornAudio;
const audioContext = () => hornAudio ||= new (window.AudioContext || window.webkitAudioContext)();
function honk() {
  hornAudio = audioContext();
  const now = hornAudio.currentTime;
  const gain = hornAudio.createGain(), filter = hornAudio.createBiquadFilter(), compressor = hornAudio.createDynamicsCompressor();
  filter.type = 'bandpass'; filter.frequency.value = 470; filter.Q.value = .75;
  compressor.threshold.value = -18; compressor.knee.value = 8; compressor.ratio.value = 6; compressor.attack.value = .004; compressor.release.value = .12;
  gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.32, now + .018); gain.gain.setValueAtTime(.32, now + .38); gain.gain.exponentialRampToValueAtTime(.0001, now + .58);
  gain.connect(filter); filter.connect(compressor); compressor.connect(hornAudio.destination);
  [410, 515].forEach((frequency, index) => {
    const oscillator = hornAudio.createOscillator();
    oscillator.type = index ? 'square' : 'sawtooth';
    oscillator.frequency.setValueAtTime(frequency * .985, now); oscillator.frequency.linearRampToValueAtTime(frequency, now + .05);
    oscillator.connect(gain); oscillator.start(now); oscillator.stop(now + .6);
  });
}
document.querySelector('.horn').onclick = event => { event.stopPropagation(); honk(); };
function indicatorClick(on) {
  if (!hornAudio) return;
  const now = hornAudio.currentTime, oscillator = hornAudio.createOscillator(), gain = hornAudio.createGain();
  oscillator.type = 'square'; oscillator.frequency.value = on ? 1250 : 820;
  gain.gain.setValueAtTime(.035, now); gain.gain.exponentialRampToValueAtTime(.0001, now + .045);
  oscillator.connect(gain); gain.connect(hornAudio.destination); oscillator.start(now); oscillator.stop(now + .05);
}
function toggleSignal(direction) {
  audioContext();
  state.signal = state.signal === direction ? null : direction;
  state.signalOn = Boolean(state.signal); state.signalNextTick = performance.now() + 480;
  indicatorClick(state.signalOn); renderDash();
}
function cancelSignal() {
  if (!state.signal) return;
  state.signal = null; state.signalOn = false; state.signalNextTick = 0; indicatorClick(false); renderDash();
}
document.querySelectorAll('[data-signal]').forEach(button => button.onclick = event => { event.stopPropagation(); toggleSignal(button.dataset.signal); });
const WIPER_MODES = ['off', 'slow'];
function renderWipers() {
  const mode = WIPER_MODES[state.wiperMode], wipers = document.querySelector('.wipers'), button = document.querySelector('.wiperControl');
  wipers.className = `wipers ${mode}`;
  button.classList.toggle('active', state.wiperMode > 0);
  button.querySelector('small').textContent = `W · ${mode.toUpperCase()}`;
}
function cycleWipers() {
  audioContext();
  state.wiperMode = (state.wiperMode + 1) % WIPER_MODES.length;
  renderWipers();
}
document.querySelector('.wiperControl').onclick = event => { event.stopPropagation(); cycleWipers(); };
const WEATHER_MODES = ['sunny', 'rainy', 'night'];
const rainDrops = [];
let nextRainDrop = 0, lastWiperSide = 0;
let previousWiperPose = { left: .04, right: .04 };
function renderWeather() {
  const mode = WEATHER_MODES[state.weather];
  document.querySelector('.cockpit').dataset.weather = mode;
  document.querySelectorAll('button[data-weather]').forEach(button => { const active = +button.dataset.weather === state.weather; button.classList.toggle('active', active); button.setAttribute('aria-pressed', active); });
  if (mode !== 'rainy') rainDrops.length = 0;
}
document.querySelectorAll('button[data-weather]').forEach(button => button.onclick = event => { event.stopPropagation(); state.weather = +button.dataset.weather; renderWeather(); });
function pointToBlade(x, y, pivotX, pivotY, angle, length) {
  const endX = pivotX + Math.cos(angle) * length, endY = pivotY - Math.sin(angle) * length;
  const dx = endX - pivotX, dy = endY - pivotY;
  const t = clamp(((x - pivotX) * dx + (y - pivotY) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(x - (pivotX + t * dx), y - (pivotY + t * dy));
}
function wiperPose(time) {
  if (!state.wiperMode) return { left: .08, right: .08, moving: false };
  const periods = [0, 1800], phase = (time % periods[state.wiperMode]) / periods[state.wiperMode];
  const sweep = .04 + (.5 - .5 * Math.cos(phase * Math.PI * 2)) * 1.48;
  const side = phase < .5 ? 1 : -1;
  if (side !== lastWiperSide) { wiperMotorClick(state.wiperMode); lastWiperSide = side; }
  return { left: sweep, right: Math.min(1.54, sweep * 1.02), moving: true };
}
function renderWeatherGlass(time, dt) {
  const canvas = document.querySelector('.weatherGlass'), box = canvas.getBoundingClientRect(), dpr = devicePixelRatio || 1;
  if (canvas.width !== Math.round(box.width * dpr) || canvas.height !== Math.round(box.height * dpr)) { canvas.width = Math.round(box.width * dpr); canvas.height = Math.round(box.height * dpr); }
  const ctx = canvas.getContext('2d'), width = box.width, height = box.height;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
  const pose = wiperPose(time), leftPivot = { x: width * .075, y: height * .82 }, rightPivot = { x: width * .49, y: height * .82 }, bladeLength = width * .49;
  document.querySelector('.wipers .left').style.transform = `rotate(${-pose.left}rad)`;
  document.querySelector('.wipers .right').style.transform = `rotate(${-pose.right}rad)`;
  if (state.weather !== 1) return;
  while (time >= nextRainDrop && rainDrops.length < 520) { rainDrops.push({ x: Math.random() * width, y: Math.random() * height * .8, r: 1.2 + Math.random() * 2.5 }); nextRainDrop = time + 18; }
  const bladeTouched = drop => {
    const angleTravel = Math.max(Math.abs(pose.left - previousWiperPose.left), Math.abs(pose.right - previousWiperPose.right));
    const samples = Math.max(1, Math.ceil(angleTravel / .025));
    for (let sample = 0; sample <= samples; sample++) {
      const t = sample / samples;
      const leftAngle = previousWiperPose.left + (pose.left - previousWiperPose.left) * t;
      const rightAngle = previousWiperPose.right + (pose.right - previousWiperPose.right) * t;
      if (pointToBlade(drop.x, drop.y, leftPivot.x, leftPivot.y, leftAngle, bladeLength) <= drop.r + 9 || pointToBlade(drop.x, drop.y, rightPivot.x, rightPivot.y, rightAngle, bladeLength) <= drop.r + 9) return true;
    }
    return false;
  };
  for (let i = rainDrops.length - 1; i >= 0; i--) {
    const drop = rainDrops[i]; drop.y += (8 + drop.r * 4) * dt;
    const wiped = bladeTouched(drop);
    if (wiped || drop.y > height * .84) { rainDrops.splice(i, 1); continue; }
    const gradient = ctx.createLinearGradient(drop.x, drop.y - drop.r * 3, drop.x, drop.y + drop.r * 4); gradient.addColorStop(0, '#d9f1ff22'); gradient.addColorStop(1, '#b8e4ffbb');
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.ellipse(drop.x, drop.y, drop.r, drop.r * 2.4, 0, 0, Math.PI * 2); ctx.fill();
  }
  previousWiperPose = { left: pose.left, right: pose.right };
}
function wiperMotorClick(mode) {
  if (!hornAudio || !mode) return;
  const now = hornAudio.currentTime, osc = hornAudio.createOscillator(), gain = hornAudio.createGain(), filter = hornAudio.createBiquadFilter();
  osc.type = 'triangle'; osc.frequency.setValueAtTime(72 + mode * 11, now); osc.frequency.exponentialRampToValueAtTime(42, now + .11);
  filter.type = 'lowpass'; filter.frequency.value = 260; gain.gain.setValueAtTime(.025, now); gain.gain.exponentialRampToValueAtTime(.0001, now + .14);
  osc.connect(filter); filter.connect(gain); gain.connect(hornAudio.destination); osc.start(now); osc.stop(now + .15);
}
const cameraPanels = [...document.querySelectorAll('.monitor')], cameraToggle = document.querySelector('.camerasToggle'), restore = document.querySelector('.restore');
function renderCameraToggle() {
  const allVisible = cameraPanels.every(panel => !panel.hidden), allHidden = cameraPanels.every(panel => panel.hidden);
  cameraToggle.classList.toggle('active', allVisible); cameraToggle.setAttribute('aria-pressed', allVisible);
  cameraToggle.setAttribute('aria-label', allHidden ? 'Enable both cameras' : 'Disable both cameras');
  cameraToggle.querySelector('small').textContent = allHidden ? 'CAMERAS OFF' : allVisible ? 'CAMERAS ON' : 'CAMERAS MIXED';
}
function addCameraRestore(box) {
  const replacement = document.createElement('button'); replacement.dataset.restore = box.id;
  replacement.textContent = box.id === 'camera' ? '▣ Camera' : "◉ Bird's-eye";
  replacement.onclick = () => { box.hidden = false; replacement.remove(); renderCameraToggle(); };
  restore.append(replacement);
}
document.querySelectorAll('.hide').forEach(button => button.onclick = () => { const box = button.closest('.monitor'); box.hidden = true; addCameraRestore(box); renderCameraToggle(); });
cameraToggle.onclick = () => {
  const hideBoth = cameraPanels.some(panel => !panel.hidden);
  cameraPanels.forEach(panel => panel.hidden = hideBoth); restore.replaceChildren();
  if (hideBoth) cameraPanels.forEach(addCameraRestore);
  renderCameraToggle();
};

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
let captureFrames = 0;
let lastFrontRender = 0, lastAuxRender = 0;
function predictedPose(vehicle, seconds, speed = vehicle.speed) {
  const heading = vehicle.heading + speed / CAR.wheelbase * Math.tan(vehicle.steer || 0) * seconds;
  return { ...vehicle, heading, x: vehicle.x + Math.sin(heading) * speed * seconds, z: vehicle.z - Math.cos(heading) * speed * seconds };
}

function trafficHazard(car) {
  // Reserve three complete car lengths between a traffic bumper and the driver.
  // The look-ahead envelope means traffic brakes before entering that space,
  // rather than reacting only when the physical vehicle boxes overlap.
  const stopGap = CAR.length * 3;
  const closingWithDriver = Math.abs(car.speed) + Math.abs(state.speed);
  const horizon = clamp(2 + closingWithDriver / 2, 3, 6);
  for (let seconds = .25; seconds <= horizon; seconds += .25) {
    const futureCar = predictedPose(car, seconds);
    const futureDriver = predictedPose(state, seconds);
    // Lengthen the driver's collision envelope along the road, not sideways
    // across the white line into the legal oncoming lane.
    if (polygonsOverlap(vehicleCorners(futureCar), vehicleCorners(futureDriver, .4, stopGap * 2))) return { danger: true, seconds };
  }
  return { danger: false, seconds: Infinity };
}

const angleDifference = (target, current) => Math.atan2(Math.sin(target - current), Math.cos(target - current));

function routeTraffic(car) {
  const vertical = Math.abs(Math.cos(car.heading)) >= Math.abs(Math.sin(car.heading));
  const intersectionX = vertical ? Math.round(car.x / CITY.block) * CITY.block : Math.round(car.x / CITY.block) * CITY.block;
  const intersectionZ = vertical ? Math.round(car.z / CITY.block) * CITY.block : Math.round(car.z / CITY.block) * CITY.block;
  const junction = `${intersectionX},${intersectionZ}`;
  const distance = Math.hypot(car.x - intersectionX, car.z - intersectionZ);
  if (distance > 20 && car.lastJunction === junction) car.lastJunction = null;
  if (!car.turning && car.lastJunction !== junction && distance < 12) {
    const choice = [-1, 0, 1][Math.floor(Math.random() * 3)];
    car.lastJunction = junction;
    if (choice) car.turning = { target: car.heading + choice * Math.PI / 2, x: intersectionX, z: intersectionZ };
  }
  if (!car.turning) { car.steer += (0 - car.steer) * .18; return; }
  const error = angleDifference(car.turning.target, car.heading);
  car.steer = clamp(error * 1.8, -CAR.maxSteer, CAR.maxSteer);
  if (Math.abs(error) < .045) {
    car.heading = Math.atan2(Math.sin(car.turning.target), Math.cos(car.turning.target));
    const cardinal = Math.round(car.heading / (Math.PI / 2));
    if (Math.abs(cardinal) % 2 === 0) car.x = car.turning.x + (Math.cos(car.heading) > 0 ? ROAD.laneOffset : -ROAD.laneOffset);
    else car.z = car.turning.z + (Math.sin(car.heading) > 0 ? ROAD.laneOffset : -ROAD.laneOffset);
    car.turning = null; car.steer = 0;
  }
}

function updateTraffic(dt) {
  traffic.forEach((car, index) => {
    // Every road user uses the same bicycle model as the driver's car.
    const cruise = trafficStarts[index].cruise;
    routeTraffic(car);
    const hazard = trafficHazard(car);
    const sameLaneDistances = traffic.filter(other => other !== car).map(other => {
      const dx = other.x - car.x, dz = other.z - car.z;
      const forward = dx * Math.sin(car.heading) - dz * Math.cos(car.heading);
      const lateral = Math.abs(dx * Math.cos(car.heading) + dz * Math.sin(car.heading));
      const directionMatch = Math.cos(other.heading - car.heading) > .72;
      return directionMatch && forward > 0 && lateral < 2.3 ? forward : Infinity;
    });
    const followingGap = Math.min(...sameLaneDistances);
    const followingSpeed = followingGap < 7 ? 0 : followingGap < 18 ? cruise * (followingGap - 7) / 11 : cruise;
    const hazardSpeed = hazard.danger ? (hazard.seconds < 2.2 ? 0 : cruise * clamp((hazard.seconds - 2) / 2.5, 0, 1)) : cruise;
    const desiredSpeed = Math.min(followingSpeed, hazardSpeed);
    car.speed += clamp(desiredSpeed - car.speed, -7.5 * dt, 1.4 * dt);
    const next = { ...car, heading: car.heading + car.speed / CAR.wheelbase * Math.tan(car.steer) * dt };
    next.x += Math.sin(next.heading) * car.speed * dt; next.z -= Math.cos(next.heading) * car.speed * dt;
    const blockers = [...parkedCars(), ...traffic.filter(other => other !== car), state];
    const crash = blockers.some(other => polygonsOverlap(vehicleCorners(next), other === state ? vehicleCorners(other, .4, CAR.length * 6) : vehicleCorners(other, .18))) || mapObstacles(next.z).some(object => polygonsOverlap(vehicleCorners(next), obstaclePolygon(object)));
    if (crash) car.speed = Math.max(0, car.speed - 8 * dt);
    else Object.assign(car, { x: next.x, z: next.z, heading: next.heading });
    car.stoppedFor = car.speed < .15 ? (car.stoppedFor || 0) + dt : 0;
    // A traffic vehicle that remains boxed in is recycled to its moving route
    // instead of becoming a permanent non-parking street obstacle.
    if (car.stoppedFor > 3) { Object.assign(car, trafficStarts[index], { movingTraffic: true, stoppedFor: 0, speed: cruise }); }
    // Recycle both north/south and east/west traffic at the city boundary.
    if (Math.abs(car.z) > CITY.length / 2) car.z = -Math.sign(car.z) * (CITY.length / 2 - 10);
    if (Math.abs(car.x) > CITY.length / 2) car.x = -Math.sign(car.x) * (CITY.length / 2 - 10);
  });
}
function loop(time) {
  const dt = Math.min((time - last) / 1000, .04); last = time;
  if (state.signal && time >= state.signalNextTick) {
    state.signalOn = !state.signalOn; state.signalNextTick = time + 480; indicatorClick(state.signalOn);
  }
  updateTraffic(dt);
  const steerInput = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
  if ((state.signal === 'left' && steerInput > 0) || (state.signal === 'right' && steerInput < 0)) cancelSignal();
  const steerTarget = steerInput * CAR.maxSteer;
  // A road-car steering rack takes time to travel lock-to-lock. The gentler
  // rate also keeps the on-screen wheel from snapping around at key-down.
  state.steer += clamp(steerTarget - state.steer, -.8 * dt, .8 * dt);
  if (!steerInput) state.steer *= Math.pow(.35, dt);
  let acceleration = 0, braking = false;
  if (keys.ArrowUp) {
    if (state.speed < 0) { state.speed = Math.min(0, state.speed + CAR.brakeDeceleration * dt); braking = true; }
    else { state.gear = 'D'; acceleration = CAR.forwardAcceleration; }
  }
  if (keys.ArrowDown) {
    if (state.speed > 0) { state.speed = Math.max(0, state.speed - CAR.brakeDeceleration * dt); braking = true; }
    else { state.gear = 'R'; acceleration = -CAR.reverseAcceleration; }
  }
  if (braking) acceleration = 0;
  else if (state.gear === 'P' || state.gear === 'N') state.speed *= Math.pow(.005, dt);
  else {
    const drag = state.speed < 0 ? .8 : .09;
    state.speed += (acceleration - state.speed * drag) * dt;
  }
  state.speed = clamp(state.speed, -2.8, 100 / 3.6);
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
  if (time - lastFrontRender >= 33 || !lastFrontRender) {
    const front = document.querySelector('canvas[data-view="front"]'); drawPerspective(front, 'front');
    renderWeatherGlass(time, dt); renderDash(); lastFrontRender = time;
  }
  if (time - lastAuxRender >= 83 || !lastAuxRender) {
    document.querySelectorAll('canvas[data-view]:not([data-view="front"])').forEach(canvas => canvas.dataset.view === 'bird' ? drawBird(canvas) : drawPerspective(canvas, canvas.dataset.view));
    lastAuxRender = time;
  }
  if (!new URLSearchParams(location.search).has('capture') || ++captureFrames < 2) requestAnimationFrame(loop);
}
reset(); requestAnimationFrame(loop);
