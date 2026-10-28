import * as THREE from 'three';
import { ObstacleBox, ParkingBay, VehicleState } from '../types/simulation';

export class ParkingScene {
  public scene: THREE.Scene;
  public obstacles: ObstacleBox[] = [];
  public targetBay: ParkingBay;

  // Car 3D components
  public carGroup: THREE.Group;
  public carBodyMesh!: THREE.Mesh;
  public steeringWheelMesh!: THREE.Group;
  public frontLeftWheel!: THREE.Group;
  public frontRightWheel!: THREE.Group;
  public rearLeftWheel!: THREE.Group;
  public rearRightWheel!: THREE.Group;

  // Mirror & Camera Mount points (Object3Ds attached to car)
  public leftMirrorMount: THREE.Object3D;
  public rightMirrorMount: THREE.Object3D;
  public rearviewMount: THREE.Object3D;
  public backupCamMount: THREE.Object3D;
  public driverHeadMount: THREE.Object3D;

  // Lights
  public brakeLights: THREE.Mesh[] = [];
  public reverseLights: THREE.Mesh[] = [];
  public reverseSpotLight!: THREE.SpotLight;
  public sunLight!: THREE.DirectionalLight;
  public rearSunLight!: THREE.DirectionalLight;

  constructor() {
    this.scene = new THREE.Scene();

    // 1. Bright Sunny Day Sky and Atmosphere
    this.scene.background = new THREE.Color(0x87ceeb); // Clear sky blue
    this.scene.fog = new THREE.FogExp2(0xbbe1fa, 0.005);

    // Target bay definition (Bay #14)
    this.targetBay = {
      id: 'bay-14',
      number: 14,
      targetX: 0,
      targetZ: 6.6,
      targetHeading: Math.PI, // Backing in facing backwards into stall
      width: 3.2,
      length: 6.0,
      curbZ: 9.6,
    };

    this.carGroup = new THREE.Group();
    this.leftMirrorMount = new THREE.Object3D();
    this.rightMirrorMount = new THREE.Object3D();
    this.rearviewMount = new THREE.Object3D();
    this.backupCamMount = new THREE.Object3D();
    this.driverHeadMount = new THREE.Object3D();

    this.setupLighting();
    this.setupEnvironment();
    this.setupPlayerCar();
  }

  private setupLighting() {
    // 1. Omnidirectional sky & ground hemisphere light (max sunny daylight brightness)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x94a3b8, 1.2);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    // 2. Pure ambient fill light ensuring clean daylight illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    this.scene.add(ambientLight);

    // 3. Primary sunlight from front-right (gentle natural daylight)
    this.sunLight = new THREE.DirectionalLight(0xfffaec, 1.6);
    this.sunLight.position.set(25, 45, 20);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 120;
    this.sunLight.shadow.camera.left = -35;
    this.sunLight.shadow.camera.right = 35;
    this.sunLight.shadow.camera.top = 35;
    this.sunLight.shadow.camera.bottom = -35;
    this.sunLight.shadow.bias = -0.0004;
    this.scene.add(this.sunLight);

    // 4. Rear daylight sunlight softly illuminating the parking lot behind the car
    this.rearSunLight = new THREE.DirectionalLight(0xfffaed, 1.2);
    this.rearSunLight.position.set(-15, 35, -30);
    this.scene.add(this.rearSunLight);

    // 5. Soft angled skylight (off-zenith so top-down camera sees true paint colors without white glare)
    const skyLight = new THREE.DirectionalLight(0xe0f2fe, 0.45);
    skyLight.position.set(15, 35, 10);
    this.scene.add(skyLight);
  }

  private setupEnvironment() {
    // Clean Daylight Asphalt Pavement
    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x64748b, // Bright clean daylight asphalt slate
      roughness: 0.7,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Concrete curbs and walls
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.75 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 });

    // North Curb & Wall (at z = 10.4)
    const northCurb = new THREE.Mesh(new THREE.BoxGeometry(80, 0.35, 1.8), curbMat);
    northCurb.position.set(0, 0.175, 10.9);
    this.scene.add(northCurb);

    const northWall = new THREE.Mesh(new THREE.BoxGeometry(80, 2.5, 0.8), wallMat);
    northWall.position.set(0, 1.25, 12.0);
    this.scene.add(northWall);

    this.obstacles.push({
      name: 'North Curb Barrier',
      minX: -40,
      maxX: 40,
      minZ: 10.1,
      maxZ: 13.0,
      height: 2.5,
    });

    // South Curb & Wall (at z = -10.4)
    const southCurb = new THREE.Mesh(new THREE.BoxGeometry(80, 0.35, 1.8), curbMat);
    southCurb.position.set(0, 0.175, -10.9);
    this.scene.add(southCurb);

    const southWall = new THREE.Mesh(new THREE.BoxGeometry(80, 2.5, 0.8), wallMat);
    southWall.position.set(0, 1.25, -12.0);
    this.scene.add(southWall);

    this.obstacles.push({
      name: 'South Curb Barrier',
      minX: -40,
      maxX: 40,
      minZ: -13.0,
      maxZ: -10.1,
      height: 2.5,
    });

    this.createDecorativeTrees();

    // ALL PARKING STALLS: Complete White Rectangles
    // North Row: z from 3.6 to 9.6 (Depth 6.0m, Width 3.2m)
    // South Row: z from -3.6 to -9.6 (Depth 6.0m, Width 3.2m)
    const stallWidth = 3.2;
    const northStallFrontZ = 3.6;
    const northStallRearZ = 9.6;
    const southStallFrontZ = -3.6;
    const southStallRearZ = -9.6;

    const stallXs = [-12.8, -9.6, -6.4, -3.2, 0, 3.2, 6.4, 9.6, 12.8];

    stallXs.forEach((x) => {
      const isTarget = Math.abs(x) < 0.1;
      this.createStallRectangle(x, northStallFrontZ, northStallRearZ, stallWidth, isTarget);
      this.createWheelStop(x, 9.15); // Yellow blocking bar strictly inside white rectangle

      this.createStallRectangle(x, southStallFrontZ, southStallRearZ, stallWidth, false);
      this.createWheelStop(x, -9.15);
    });

    // Target Bay #14 floor label
    const bayMarkerGeo = new THREE.PlaneGeometry(2.6, 0.7);
    const targetFloorCanvas = document.createElement('canvas');
    targetFloorCanvas.width = 512;
    targetFloorCanvas.height = 128;
    const ctx = targetFloorCanvas.getContext('2d')!;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 50px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BAY #14 - BACK IN', 256, 64);

    const bayTexture = new THREE.CanvasTexture(targetFloorCanvas);
    const baySign = new THREE.Mesh(bayMarkerGeo, new THREE.MeshBasicMaterial({ map: bayTexture, transparent: true }));
    baySign.rotation.x = -Math.PI / 2;
    baySign.position.set(0, 0.025, 4.4);
    this.scene.add(baySign);

    // ROAD ARROWS & DRIVEWAY LANE MARKINGS
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
    for (let x = -20; x <= 20; x += 4.0) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.16), yellowMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.015, 0);
      this.scene.add(dash);
    }

    // Right lane (z = +1.8, driving forward +X into parking lot):
    this.createRoadArrow(-14, 1.8, 0);
    this.createRoadArrow(-2, 1.8, 0);

    // Left/oncoming lane (z = -1.8, driving opposite direction -X):
    this.createRoadArrow(14, -1.8, Math.PI);
    this.createRoadArrow(2, -1.8, Math.PI);

    // POPULATE PARKED CARS: VIBRANT, LIGHT, AND COLORFUL (NO DARK CARS)
    // North Row:
    this.createParkedCar(-9.6, 6.6, Math.PI, 0xf8fafc, 'Parked Glacier White SUV (Bay 11)');
    this.createParkedCar(-6.4, 6.6, Math.PI, 0xf59e0b, 'Parked Solar Gold Sedan (Bay 12)');
    this.createParkedCar(-3.2, 6.6, Math.PI, 0xe2e8f0, 'Parked Sonic Silver Sedan (Bay 13)');
    // Bay 14 (x = 0): EMPTY TARGET BAY!
    this.createParkedCar(3.2, 6.6, Math.PI, 0xf87171, 'Parked Coral Rose SUV (Bay 15)');
    this.createParkedCar(6.4, 6.6, Math.PI, 0x38bdf8, 'Parked Sky Blue Hatchback (Bay 16)');
    this.createParkedCar(9.6, 6.6, Math.PI, 0x4ade80, 'Parked Mint Green Coupe (Bay 17)');

    // South Row:
    this.createParkedCar(-9.6, -6.6, 0, 0xfb923c, 'Parked Sunburst Orange Car (South 1)');
    this.createParkedCar(-6.4, -6.6, 0, 0xffffff, 'Parked Alpine White Car (South 2)');
    this.createParkedCar(-3.2, -6.6, 0, 0x22d3ee, 'Parked Turquoise Cyan Sedan (South 3)');
    this.createParkedCar(3.2, -6.6, 0, 0xc084fc, 'Parked Soft Lavender SUV (South 4)');
    this.createParkedCar(6.4, -6.6, 0, 0xfacc15, 'Parked Canary Yellow Coupe (South 5)');
    this.createParkedCar(9.6, -6.6, 0, 0xcfd8dc, 'Parked Platinum Silver Car (South 6)');
    // Continuous White Driveway Edge Lines along both sides of the aisle
    const aisleEdgeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.95,
      roughness: 0.1,
      side: THREE.DoubleSide,
    });
    // North aisle white line (z = 3.6)
    const northEdge = new THREE.Mesh(new THREE.BoxGeometry(48, 0.04, 0.24), aisleEdgeMat);
    northEdge.position.set(0, 0.02, 3.6);
    this.scene.add(northEdge);

    // South aisle white line (z = -3.6)
    const southEdge = new THREE.Mesh(new THREE.BoxGeometry(48, 0.04, 0.24), aisleEdgeMat);
    southEdge.position.set(0, 0.02, -3.6);
    this.scene.add(southEdge);
  }

  private createStallRectangle(x: number, frontZ: number, rearZ: number, width: number, isTarget: boolean) {
    const halfW = width / 2;
    const depth = Math.abs(rearZ - frontZ);
    const centerZ = (frontZ + rearZ) / 2;

    // High-visibility crisp white reflective 3D thermal road paint
    const whiteLineMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.1,
      metalness: 0.1,
      emissive: 0xffffff,
      emissiveIntensity: 0.95, // Glowing bright white so it pops in all mirrors & cameras
      side: THREE.DoubleSide,  // Guaranteed no backface culling in mirrored viewports
    });

    const lineWidth = 0.32; // 32cm bold parking stripe
    const lineHeight = 0.04; // 4cm 3D solid raised block
    const lineY = lineHeight / 2 + 0.005;

    // Left white stall boundary line (solid 3D box)
    const leftLine = new THREE.Mesh(new THREE.BoxGeometry(lineWidth, lineHeight, depth), whiteLineMat);
    leftLine.position.set(x - halfW, lineY, centerZ);
    this.scene.add(leftLine);

    // Right white stall boundary line (solid 3D box)
    const rightLine = new THREE.Mesh(new THREE.BoxGeometry(lineWidth, lineHeight, depth), whiteLineMat);
    rightLine.position.set(x + halfW, lineY, centerZ);
    this.scene.add(rightLine);

    // Rear white boundary line (solid 3D box)
    const rearLine = new THREE.Mesh(new THREE.BoxGeometry(width + lineWidth, lineHeight, lineWidth), whiteLineMat);
    rearLine.position.set(x, lineY, rearZ);
    this.scene.add(rearLine);

    // Front white boundary line (solid 3D box)
    const frontLine = new THREE.Mesh(new THREE.BoxGeometry(width + lineWidth, lineHeight, lineWidth), whiteLineMat);
    frontLine.position.set(x, lineY, frontZ);
    this.scene.add(frontLine);

    // If target stall: add inner glowing green target guide strips so user sees both white lines and target indication
    if (isTarget) {
      const greenGuideMat = new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        emissive: 0x22c55e,
        emissiveIntensity: 0.9,
        side: THREE.DoubleSide,
      });

      const innerW = width - 0.6;
      const innerD = depth - 0.6;

      const innerLeft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, innerD), greenGuideMat);
      innerLeft.position.set(x - innerW / 2, lineY + 0.006, centerZ);

      const innerRight = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, innerD), greenGuideMat);
      innerRight.position.set(x + innerW / 2, lineY + 0.006, centerZ);

      this.scene.add(innerLeft, innerRight);
    }
  }

  private createWheelStop(x: number, z: number) {
    const stopGeo = new THREE.BoxGeometry(2.0, 0.16, 0.18);
    const stopMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.5,
      metalness: 0.2,
    });
    const stop = new THREE.Mesh(stopGeo, stopMat);
    stop.position.set(x, 0.08, z);
    stop.receiveShadow = true;
    stop.castShadow = true;
    this.scene.add(stop);

    this.obstacles.push({
      name: `Wheel Stop (${x.toFixed(1)})`,
      minX: x - 1.0,
      maxX: x + 1.0,
      minZ: z - 0.1,
      maxZ: z + 0.1,
      height: 0.2,
    });
  }

  private createRoadArrow(x: number, z: number, rotationY: number) {
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 1.1);
    arrowShape.lineTo(0.55, 0.35);
    arrowShape.lineTo(0.22, 0.35);
    arrowShape.lineTo(0.22, -1.1);
    arrowShape.lineTo(-0.22, -1.1);
    arrowShape.lineTo(-0.22, 0.35);
    arrowShape.lineTo(-0.55, 0.35);
    arrowShape.closePath();

    const arrowGeo = new THREE.ShapeGeometry(arrowShape);
    const arrowMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.85,
      roughness: 0.3,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.rotation.x = -Math.PI / 2;
    arrow.rotation.z = -Math.PI / 2 + rotationY;
    arrow.position.set(x, 0.022, z);
    this.scene.add(arrow);
  }

  private createDecorativeTrees() {
    const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
    const treeFoliageMat = new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.7 });

    const createTree = (x: number, z: number) => {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 2.5, 8), treeTrunkMat);
      trunk.position.y = 1.25;
      trunk.castShadow = true;
      tree.add(trunk);

      const foliage = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5, 1), treeFoliageMat);
      foliage.position.y = 3.2;
      foliage.castShadow = true;
      tree.add(foliage);

      tree.position.set(x, 0, z);
      this.scene.add(tree);
    };

    createTree(-14, 12.5);
    createTree(-2, 12.5);
    createTree(10, 12.5);
    createTree(-10, -12.5);
    createTree(6, -12.5);
  }

  private createParkedCar(x: number, z: number, heading: number, paintColor: number, name: string) {
    const carGroup = new THREE.Group();

    const lowerGeo = new THREE.BoxGeometry(1.82, 0.65, 4.42);
    const paintMat = new THREE.MeshStandardMaterial({
      color: paintColor,
      roughness: 0.45,
      metalness: 0.05,
    });
    const lowerBody = new THREE.Mesh(lowerGeo, paintMat);
    lowerBody.position.y = 0.55;
    lowerBody.castShadow = true;
    lowerBody.receiveShadow = true;
    carGroup.add(lowerBody);

    // Colored Hood
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.1, 1.3), paintMat);
    hood.position.set(0, 0.72, 1.4);
    carGroup.add(hood);

    // Colored Trunk
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.1, 0.9), paintMat);
    trunk.position.set(0, 0.72, -1.6);
    carGroup.add(trunk);

    const cabinGeo = new THREE.BoxGeometry(1.52, 0.58, 2.3);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.1 });
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(0, 1.1, -0.2);
    cabin.castShadow = true;
    carGroup.add(cabin);

    // Colored Roof covering the cabin top with the car's distinctive color!
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.08, 2.2), paintMat);
    roof.position.set(0, 1.42, -0.2);
    roof.castShadow = true;
    carGroup.add(roof);

    const bumperMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
    const fTrim = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.25, 0.22), bumperMat);
    fTrim.position.set(0, 0.35, 2.2);
    carGroup.add(fTrim);

    const rTrim = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.25, 0.22), bumperMat);
    rTrim.position.set(0, 0.35, -2.2);
    carGroup.add(rTrim);

    const headLightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, emissive: 0xffffff, emissiveIntensity: 0.6 });
    const fL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.08), headLightMat);
    fL.position.set(-0.65, 0.6, 2.2);
    const fR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.08), headLightMat);
    fR.position.set(0.65, 0.6, 2.2);
    carGroup.add(fL, fR);

    const tailLightMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.2, emissive: 0x7f1d1d, emissiveIntensity: 0.4 });
    const rL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.08), tailLightMat);
    rL.position.set(-0.65, 0.65, -2.2);
    const rR = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.08), tailLightMat);
    rR.position.set(0.65, 0.65, -2.2);
    carGroup.add(rL, rR);

    const wheelGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 20);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.8, roughness: 0.2 });

    const makeWheel = (wx: number, wz: number) => {
      const wGroup = new THREE.Group();
      const tire = new THREE.Mesh(wheelGeo, wheelMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wGroup.add(tire);

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.25, 12), rimMat);
      rim.rotation.z = Math.PI / 2;
      wGroup.add(rim);

      wGroup.position.set(wx, 0.33, wz);
      return wGroup;
    };

    carGroup.add(makeWheel(-0.85, 1.35));
    carGroup.add(makeWheel(0.85, 1.35));
    carGroup.add(makeWheel(-0.85, -1.35));
    carGroup.add(makeWheel(0.85, -1.35));

    carGroup.position.set(x, 0, z);
    carGroup.rotation.y = heading;
    this.scene.add(carGroup);

    this.obstacles.push({
      name,
      minX: x - 0.95,
      maxX: x + 0.95,
      minZ: z - 2.25,
      maxZ: z + 2.25,
      height: 1.6,
    });
  }

  private setupPlayerCar() {
    // Player's Car (Modern Electric Sport Sedan in luminous radiant electric blue)
    const carMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Luminous, high-visibility bright electric cyan blue
      roughness: 0.15,
      metalness: 0.35,
    });
    this.carBodyMesh = new THREE.Mesh();

    const bodyGeo = new THREE.BoxGeometry(1.88, 0.62, 4.54);
    const body = new THREE.Mesh(bodyGeo, carMat);
    body.position.y = 0.52;
    body.castShadow = true;
    body.receiveShadow = true;
    this.carGroup.add(body);

    // Radiant Blue Hood for expansive forward visibility and top-down color
    const hoodGeo = new THREE.BoxGeometry(1.82, 0.12, 1.45);
    const hood = new THREE.Mesh(hoodGeo, carMat);
    hood.position.set(0, 0.70, 1.5);
    hood.rotation.x = 0.05;
    this.carGroup.add(hood);

    // Radiant Blue Trunk Deck Lid for rear profile and top-down color
    const trunkGeo = new THREE.BoxGeometry(1.82, 0.12, 1.05);
    const trunk = new THREE.Mesh(trunkGeo, carMat);
    trunk.position.set(0, 0.70, -1.6);
    this.carGroup.add(trunk);

    const trimMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
    const darkInteriorMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.9 });

    // Wide Radiant Blue Roof - dominant car color in Bird's Eye View
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.08, 2.1), carMat);
    roof.position.set(0, 1.48, -0.35);
    roof.castShadow = true;
    this.carGroup.add(roof);

    // Slim Tinted Sunroof Insert leaving wide radiant blue roof borders
    const sunroofGeo = new THREE.BoxGeometry(0.72, 0.02, 0.85);
    const sunroofMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 });
    const sunroof = new THREE.Mesh(sunroofGeo, sunroofMat);
    sunroof.position.set(0, 1.53, -0.35);
    this.carGroup.add(sunroof);

    const aPillarL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.65, 0.08), trimMat);
    aPillarL.position.set(-0.72, 1.15, 0.72);
    aPillarL.rotation.x = -0.55;
    this.carGroup.add(aPillarL);

    const aPillarR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.65, 0.08), trimMat);
    aPillarR.position.set(0.72, 1.15, 0.72);
    aPillarR.rotation.x = -0.55;
    this.carGroup.add(aPillarR);

    const cPillarL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.15), trimMat);
    cPillarL.position.set(-0.73, 1.15, -1.35);
    cPillarL.rotation.x = 0.45;
    this.carGroup.add(cPillarL);

    const cPillarR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.15), trimMat);
    cPillarR.position.set(0.73, 1.15, -1.35);
    cPillarR.rotation.x = 0.45;
    this.carGroup.add(cPillarR);

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.04,
      roughness: 0.0,
      metalness: 0.0,
    });
    const windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.74), glassMat);
    windshield.position.set(0, 1.14, 0.74);
    windshield.rotation.x = -0.55;
    this.carGroup.add(windshield);

    const rearGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.65), glassMat);
    rearGlass.position.set(0, 1.18, -1.45);
    rearGlass.rotation.x = Math.PI - 0.45;
    this.carGroup.add(rearGlass);

    // LOWERED DASHBOARD 3D BLOCK (Now at y = 0.72, height 0.18, so driver view is completely open!)
    const dashGeo = new THREE.BoxGeometry(1.7, 0.18, 0.58);
    const dashboard = new THREE.Mesh(dashGeo, darkInteriorMat);
    dashboard.position.set(0, 0.72, 0.55);
    this.carGroup.add(dashboard);

    const consoleGeo = new THREE.BoxGeometry(0.35, 0.35, 1.2);
    const centerConsole = new THREE.Mesh(consoleGeo, darkInteriorMat);
    centerConsole.position.set(0, 0.55, -0.2);
    this.carGroup.add(centerConsole);

    // Driver & Passenger Front Seats (Driver shifted to left at x = -0.42)
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const createSeat = (sx: number) => {
      const sGroup = new THREE.Group();
      const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.55), seatMat);
      cushion.position.set(0, 0.45, 0);
      sGroup.add(cushion);

      const back = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.65, 0.14), seatMat);
      back.position.set(0, 0.8, -0.25);
      back.rotation.x = -0.15;
      sGroup.add(back);

      const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.12), seatMat);
      headrest.position.set(0, 1.18, -0.32);
      sGroup.add(headrest);

      sGroup.position.set(sx, 0, -0.25);
      return sGroup;
    };
    this.carGroup.add(createSeat(-0.56)); // Driver seat on the left of cockpit
    this.carGroup.add(createSeat(0.42)); // Passenger seat

    // STEERING WHEEL: FULLY REVEALED ON THE LEFT OF THE COCKPIT
    this.steeringWheelMesh = new THREE.Group();
    const wheelRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.19, 0.022, 16, 32),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6, metalness: 0.2 })
    );
    this.steeringWheelMesh.add(wheelRing);

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.03, 16),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 })
    );
    hub.rotation.x = Math.PI / 2;
    this.steeringWheelMesh.add(hub);

    const spokeH = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.035, 0.015), trimMat);
    this.steeringWheelMesh.add(spokeH);
    const spokeV = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.17, 0.015), trimMat);
    spokeV.position.y = -0.07;
    this.steeringWheelMesh.add(spokeV);

    // Position steering wheel on the left side of the dashboard directly in front of driver seat (x = -0.56)
    this.steeringWheelMesh.position.set(-0.56, 0.88, 0.40);
    this.steeringWheelMesh.rotation.x = -0.32;
    this.carGroup.add(this.steeringWheelMesh);

    // Instrument gauge cluster hood on left side of dashboard behind steering wheel
    const binnacleGeo = new THREE.BoxGeometry(0.48, 0.14, 0.28);
    const binnacle = new THREE.Mesh(binnacleGeo, darkInteriorMat);
    binnacle.position.set(-0.56, 0.88, 0.52);
    this.carGroup.add(binnacle);

    // Mirrors Housings & Mount Points
    const mirrorHousingMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });

    const leftMirrorHousing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.22), mirrorHousingMat);
    leftMirrorHousing.position.set(-1.02, 0.96, 0.58);
    this.carGroup.add(leftMirrorHousing);

    this.leftMirrorMount.position.set(-1.04, 0.97, 0.44);
    this.carGroup.add(this.leftMirrorMount);

    const rightMirrorHousing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.22), mirrorHousingMat);
    rightMirrorHousing.position.set(1.02, 0.96, 0.58);
    this.carGroup.add(rightMirrorHousing);

    this.rightMirrorMount.position.set(1.04, 0.97, 0.44);
    this.carGroup.add(this.rightMirrorMount);

    const rearviewHousing = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.05), mirrorHousingMat);
    rearviewHousing.position.set(0, 1.4, 0.42);
    this.carGroup.add(rearviewHousing);

    this.rearviewMount.position.set(0, 1.36, 0.34);
    this.carGroup.add(this.rearviewMount);

    this.backupCamMount.position.set(0, 0.78, -2.36);
    this.carGroup.add(this.backupCamMount);

    // Driver Eye Position: Clearly on the LEFT of the car (x = -0.56, y = 1.18, z = -0.15)
    this.driverHeadMount.position.set(-0.56, 1.18, -0.15);
    this.carGroup.add(this.driverHeadMount);

    // Lights
    const headBulbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9 });
    const headL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.06), headBulbMat);
    headL.position.set(-0.66, 0.62, 2.27);
    const headR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.06), headBulbMat);
    headR.position.set(0.66, 0.62, 2.27);
    this.carGroup.add(headL, headR);

    const tailMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x991b1b, emissiveIntensity: 0.4 });
    const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.06), tailMat);
    tailL.position.set(-0.66, 0.66, -2.27);
    const tailR = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.06), tailMat);
    tailR.position.set(0.66, 0.66, -2.27);
    this.carGroup.add(tailL, tailR);
    this.brakeLights.push(tailL, tailR);

    const revMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.1 });
    const revL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.06), revMat);
    revL.position.set(-0.35, 0.66, -2.27);
    const revR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.06), revMat);
    revR.position.set(0.35, 0.66, -2.27);
    this.carGroup.add(revL, revR);
    this.reverseLights.push(revL, revR);

    this.reverseSpotLight = new THREE.SpotLight(0xffffff, 0, 10, Math.PI / 3, 0.5, 1.5);
    this.reverseSpotLight.position.set(0, 0.7, -2.3);
    const revTarget = new THREE.Object3D();
    revTarget.position.set(0, 0, -8);
    this.carGroup.add(this.reverseSpotLight, revTarget);
    this.reverseSpotLight.target = revTarget;

    // Wheels
    const makePlayerWheel = () => {
      const wGroup = new THREE.Group();
      const tireGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 24);
      const tire = new THREE.Mesh(tireGeo, new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85 }));
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wGroup.add(tire);

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.25, 16), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.15 }));
      rim.rotation.z = Math.PI / 2;
      wGroup.add(rim);

      const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.09), new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 }));
      caliper.position.set(0, 0.12, 0.08);
      wGroup.add(caliper);

      return wGroup;
    };

    this.frontLeftWheel = new THREE.Group();
    this.frontLeftWheel.add(makePlayerWheel());
    this.frontLeftWheel.position.set(-0.85, 0.33, 1.35);

    this.frontRightWheel = new THREE.Group();
    this.frontRightWheel.add(makePlayerWheel());
    this.frontRightWheel.position.set(0.85, 0.33, 1.35);

    this.rearLeftWheel = new THREE.Group();
    this.rearLeftWheel.add(makePlayerWheel());
    this.rearLeftWheel.position.set(-0.85, 0.33, -1.35);

    this.rearRightWheel = new THREE.Group();
    this.rearRightWheel.add(makePlayerWheel());
    this.rearRightWheel.position.set(0.85, 0.33, -1.35);

    this.carGroup.add(this.frontLeftWheel, this.frontRightWheel, this.rearLeftWheel, this.rearRightWheel);
    this.scene.add(this.carGroup);
  }

  public updateCar(state: VehicleState) {
    this.carGroup.position.set(state.x, state.y, state.z);
    this.carGroup.rotation.y = state.heading;
    this.carGroup.rotation.x = state.pitch;
    this.carGroup.rotation.z = state.roll;

    // Steering wheel rotates intuitively: Left turns left, Right turns right
    if (this.steeringWheelMesh) {
      this.steeringWheelMesh.rotation.z = state.steeringAngle * 2.5;
    }

    if (this.frontLeftWheel && this.frontRightWheel) {
      this.frontLeftWheel.rotation.y = -state.steeringAngle;
      this.frontRightWheel.rotation.y = -state.steeringAngle;
    }

    const rotateWheel = (wGroup: THREE.Group) => {
      if (wGroup.children[0]) {
        wGroup.children[0].rotation.x = state.wheelRotation;
      }
    };
    rotateWheel(this.frontLeftWheel);
    rotateWheel(this.frontRightWheel);
    rotateWheel(this.rearLeftWheel);
    rotateWheel(this.rearRightWheel);

    const brakeIntensity = state.brakeLight ? 1.5 : 0.3;
    for (const bl of this.brakeLights) {
      (bl.material as THREE.MeshStandardMaterial).emissiveIntensity = brakeIntensity;
      (bl.material as THREE.MeshStandardMaterial).color.setHex(state.brakeLight ? 0xff0000 : 0x7f1d1d);
    }

    const isRev = state.reverseLight;
    for (const rl of this.reverseLights) {
      (rl.material as THREE.MeshStandardMaterial).emissiveIntensity = isRev ? 1.2 : 0.05;
    }
    if (this.reverseSpotLight) {
      this.reverseSpotLight.intensity = isRev ? 2.5 : 0;
    }
  }
}
