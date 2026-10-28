import * as THREE from 'three';
import { CameraViewMode, LookGlance, VehicleState } from '../types/simulation';
import { ParkingScene } from './parkingScene';

export interface ViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class RenderPipeline {
  private renderer: THREE.WebGLRenderer;
  private parkingScene: ParkingScene;

  // Cameras
  public cockpitCamera: THREE.PerspectiveCamera;
  public leftMirrorCamera: THREE.PerspectiveCamera;
  public rightMirrorCamera: THREE.PerspectiveCamera;
  public rearviewCamera: THREE.PerspectiveCamera;
  public backupCamera: THREE.PerspectiveCamera;
  public birdsEyeCamera: THREE.OrthographicCamera;
  public exteriorCamera: THREE.PerspectiveCamera;

  // View state: only cockpit and exterior chase
  public viewMode: CameraViewMode = 'cockpit';
  public lookGlance: LookGlance = 'center';
  public headYaw: number = 0; // manual mouse look offset
  public headPitch: number = 0;
  private targetHeadYaw: number = 0;
  private targetHeadPitch: number = 0;

  // Orbit / Exterior camera angles
  public orbitAngle: number = 0.4;
  public orbitDistance: number = 9.5;
  public orbitHeight: number = 4.2;

  constructor(canvas: HTMLCanvasElement, parkingScene: ParkingScene) {
    this.parkingScene = parkingScene;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35; // Bright sunny daylight exposure
    this.renderer.setClearColor(0x87ceeb, 1);

    // 1. Cockpit Camera (Driver's Eyes)
    this.cockpitCamera = new THREE.PerspectiveCamera(65, 1, 0.08, 140);

    // 2. Left Wing Mirror Camera (Convex wide-angle FOV 58°)
    this.leftMirrorCamera = new THREE.PerspectiveCamera(58, 1, 0.04, 90);

    // 3. Right Wing Mirror Camera (Fisheye convex FOV 68°)
    this.rightMirrorCamera = new THREE.PerspectiveCamera(68, 1, 0.04, 90);

    // 4. Center Rearview Mirror Camera (Panoramic rear window FOV 54°)
    this.rearviewCamera = new THREE.PerspectiveCamera(54, 1, 0.04, 110);

    // 5. Backup Camera (mounted on rear bumper, angled down 20 deg, ultra-wide 86° FOV)
    this.backupCamera = new THREE.PerspectiveCamera(86, 1, 0.04, 60);

    // 6. Bird's Eye View (top-down orthographic)
    const frustumSize = 20;
    this.birdsEyeCamera = new THREE.OrthographicCamera(
      -frustumSize / 2,
      frustumSize / 2,
      frustumSize / 2,
      -frustumSize / 2,
      1,
      60
    );

    // 7. Exterior / Chase Camera
    this.exteriorCamera = new THREE.PerspectiveCamera(55, 1, 0.2, 140);
  }

  public resize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
  }

  public setLookGlance(glance: LookGlance) {
    this.lookGlance = glance;
    switch (glance) {
      case 'center':
        this.targetHeadYaw = 0;
        this.targetHeadPitch = -0.05;
        break;
      case 'left-mirror':
        this.targetHeadYaw = -0.72; // turn head towards left wing mirror
        this.targetHeadPitch = -0.08;
        break;
      case 'right-mirror':
        this.targetHeadYaw = 0.85; // turn head towards right wing mirror
        this.targetHeadPitch = -0.05;
        break;
      case 'rearview':
        this.targetHeadYaw = 0.15;
        this.targetHeadPitch = 0.22; // glance up at center rearview mirror
        break;
      case 'over-shoulder-left':
        this.targetHeadYaw = -2.35; // Glance over driver's left shoulder looking backwards
        this.targetHeadPitch = -0.02;
        break;
      case 'over-shoulder-right':
        this.targetHeadYaw = 2.35; // Glance over driver's right shoulder looking backwards
        this.targetHeadPitch = -0.02;
        break;
    }
  }

  public addManualLook(deltaYaw: number, deltaPitch: number) {
    this.lookGlance = 'center';
    this.targetHeadYaw = Math.max(-2.6, Math.min(2.6, this.targetHeadYaw + deltaYaw));
    this.targetHeadPitch = Math.max(-0.5, Math.min(0.5, this.targetHeadPitch + deltaPitch));
  }

  public updateCameras(state: VehicleState, dt: number) {
    // Smooth, rapid response when glancing or releasing
    const interpSpeed = 16;
    this.headYaw += (this.targetHeadYaw - this.headYaw) * interpSpeed * dt;
    this.headPitch += (this.targetHeadPitch - this.headPitch) * interpSpeed * dt;

    const carPos = this.parkingScene.carGroup.position;
    const carHeading = state.heading;

    // 1. Update Cockpit Camera
    const headWorldPos = new THREE.Vector3();
    this.parkingScene.driverHeadMount.getWorldPosition(headWorldPos);
    this.cockpitCamera.position.copy(headWorldPos);

    const effectiveYaw = carHeading + this.headYaw;
    const forwardX = Math.sin(effectiveYaw) * Math.cos(this.headPitch);
    const forwardY = Math.sin(this.headPitch);
    const forwardZ = Math.cos(effectiveYaw) * Math.cos(this.headPitch);

    const lookTarget = new THREE.Vector3(
      headWorldPos.x + forwardX,
      headWorldPos.y + forwardY,
      headWorldPos.z + forwardZ
    );
    this.cockpitCamera.lookAt(lookTarget);

    // 2. Update Left Mirror Camera (pointing backwards along left flank)
    const leftMountPos = new THREE.Vector3();
    this.parkingScene.leftMirrorMount.getWorldPosition(leftMountPos);
    this.leftMirrorCamera.position.copy(leftMountPos);

    const leftMirrorYaw = carHeading + Math.PI + 0.16;
    this.leftMirrorCamera.lookAt(
      leftMountPos.x + Math.sin(leftMirrorYaw),
      leftMountPos.y - 0.22, // Angled down toward pavement & stall lines
      leftMountPos.z + Math.cos(leftMirrorYaw)
    );

    // 3. Update Right Mirror Camera (pointing backwards along right flank)
    const rightMountPos = new THREE.Vector3();
    this.parkingScene.rightMirrorMount.getWorldPosition(rightMountPos);
    this.rightMirrorCamera.position.copy(rightMountPos);

    const rightMirrorYaw = carHeading + Math.PI - 0.16;
    this.rightMirrorCamera.lookAt(
      rightMountPos.x + Math.sin(rightMirrorYaw),
      rightMountPos.y - 0.22, // Angled down toward pavement & stall lines
      rightMountPos.z + Math.cos(rightMirrorYaw)
    );

    // 4. Update Rearview Mirror Camera (looking back through rear windshield)
    const rearMountPos = new THREE.Vector3();
    this.parkingScene.rearviewMount.getWorldPosition(rearMountPos);
    this.rearviewCamera.position.copy(rearMountPos);

    const rearYaw = carHeading + Math.PI;
    this.rearviewCamera.lookAt(
      rearMountPos.x + Math.sin(rearYaw),
      rearMountPos.y - 0.16, // Angled down toward stalls behind
      rearMountPos.z + Math.cos(rearYaw)
    );

    // 5. Update Backup Camera (rear bumper, angled down 20 deg)
    const backupMountPos = new THREE.Vector3();
    this.parkingScene.backupCamMount.getWorldPosition(backupMountPos);
    this.backupCamera.position.copy(backupMountPos);

    const backupYaw = carHeading + Math.PI;
    const backupPitch = -0.34;
    this.backupCamera.lookAt(
      backupMountPos.x + Math.sin(backupYaw) * Math.cos(backupPitch),
      backupMountPos.y + Math.sin(backupPitch),
      backupMountPos.z + Math.cos(backupYaw) * Math.cos(backupPitch)
    );

    // 6. Update Bird's Eye Camera (orthographic, top-down)
    this.birdsEyeCamera.position.set(carPos.x, 24, carPos.z);
    // Crucial: Set up vector along car heading (orthogonal to downward view direction 0, -1, 0)
    // This prevents NaN matrix degeneration and aligns car facing forward/up on monitor
    this.birdsEyeCamera.up.set(Math.sin(carHeading), 0, Math.cos(carHeading));
    this.birdsEyeCamera.lookAt(carPos.x, 0, carPos.z);

    // 7. Update Exterior Chase Camera
    const chaseYaw = carHeading + this.orbitAngle;
    const chaseX = carPos.x - Math.sin(chaseYaw) * this.orbitDistance;
    const chaseZ = carPos.z - Math.cos(chaseYaw) * this.orbitDistance;
    this.exteriorCamera.position.set(chaseX, carPos.y + this.orbitHeight, chaseZ);
    this.exteriorCamera.lookAt(carPos.x, carPos.y + 0.9, carPos.z);
  }

  /**
   * Render all camera views to their respective canvas viewports
   */
  public render(
    canvasWidth: number,
    canvasHeight: number,
    rects: {
      leftMirror?: ViewportRect | null;
      rightMirror?: ViewportRect | null;
      rearviewMirror?: ViewportRect | null;
      backupCam?: ViewportRect | null;
      birdsEye?: ViewportRect | null;
    }
  ) {
    const scene = this.parkingScene.scene;

    // Enable scissor test so each viewport only paints inside its exact rectangle
    this.renderer.setScissorTest(true);

    // --- 1. MAIN VIEWPORT (fills entire canvas) ---
    this.renderer.setViewport(0, 0, canvasWidth, canvasHeight);
    this.renderer.setScissor(0, 0, canvasWidth, canvasHeight);
    this.renderer.toneMappingExposure = 1.35;

    const activeMainCam: THREE.Camera =
      this.viewMode === 'exterior' ? this.exteriorCamera : this.cockpitCamera;

    if (activeMainCam instanceof THREE.PerspectiveCamera) {
      activeMainCam.aspect = canvasWidth / canvasHeight;
      activeMainCam.updateProjectionMatrix();
    }
    this.renderer.render(scene, activeMainCam);

    // Helper to render a sub-viewport with optional mirror flipping
    const renderSubView = (
      rect: ViewportRect,
      cam: THREE.PerspectiveCamera | THREE.OrthographicCamera,
      mirrorHorizontal: boolean = false
    ) => {
      if (rect.width <= 4 || rect.height <= 4) return;

      const glY = canvasHeight - (rect.y + rect.height);
      this.renderer.setViewport(rect.x, glY, rect.width, rect.height);
      this.renderer.setScissor(rect.x, glY, rect.width, rect.height);

      if (cam instanceof THREE.PerspectiveCamera) {
        cam.aspect = rect.width / rect.height;
        cam.updateProjectionMatrix();

        if (mirrorHorizontal) {
          // Invert horizontal axis and switch front face winding so geometry is not culled
          cam.projectionMatrix.elements[0] *= -1;
          const gl = this.renderer.getContext();
          gl.frontFace(gl.CW);
          gl.disable(gl.CULL_FACE); // Disable backface culling so all triangles render in mirrors

          // In Three.js, inverted projection matrix inverts frustum plane normals.
          // Temporarily disable frustum culling so all meshes render smoothly into the camera!
          const unculledList: THREE.Object3D[] = [];
          scene.traverse((obj) => {
            if (obj.frustumCulled) {
              obj.frustumCulled = false;
              unculledList.push(obj);
            }
          });

          this.renderer.render(scene, cam);

          for (let i = 0; i < unculledList.length; i++) {
            unculledList[i].frustumCulled = true;
          }
          gl.enable(gl.CULL_FACE);
          gl.frontFace(gl.CCW);
          cam.projectionMatrix.elements[0] *= -1;
          return;
        }
      } else if (cam instanceof THREE.OrthographicCamera) {
        const aspect = rect.width / rect.height;
        const s = 18;
        // Standard non-flipped horizontal axis: left = -w/2, right = +w/2
        cam.left = (-s * aspect) / 2;
        cam.right = (s * aspect) / 2;
        cam.top = s / 2;
        cam.bottom = -s / 2;
        cam.updateProjectionMatrix();
      }

      this.renderer.render(scene, cam);
    };

    // Render subviews only in cockpit view mode with full outside brightness
    if (this.viewMode === 'cockpit') {
      // Clean natural sunny daylight exposure without color blowout
      this.renderer.toneMappingExposure = 1.15;

      // 2. Left Wing Mirror (Driver side - physical mirror reflection flip)
      if (rects.leftMirror) {
        renderSubView(rects.leftMirror, this.leftMirrorCamera, true);
      }

      // 3. Right Wing Mirror (Passenger side convex - physical mirror reflection flip)
      if (rects.rightMirror) {
        renderSubView(rects.rightMirror, this.rightMirrorCamera, true);
      }

      // 4. Center Rearview Mirror (Windshield top-center - physical mirror reflection flip)
      if (rects.rearviewMirror) {
        renderSubView(rects.rearviewMirror, this.rearviewCamera, true);
      }

      // 5. In-Dash Backup Camera (Mirrored reflection with dynamic trajectory)
      if (rects.backupCam) {
        renderSubView(rects.backupCam, this.backupCamera, true);
      }

      // 6. In-Dash Live Bird's Eye 3D View (Clean daylight saturation)
      if (rects.birdsEye) {
        renderSubView(rects.birdsEye, this.birdsEyeCamera, false);
      }

      this.renderer.toneMappingExposure = 1.05;
    }

    this.renderer.setScissorTest(false);
  }

  public dispose() {
    this.renderer.dispose();
  }
}
