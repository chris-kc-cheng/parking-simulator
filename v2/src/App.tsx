import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CameraViewMode, LookGlance, VehicleInputs, VehicleState, SonarSensors, ParkingEvaluation } from './types/simulation';
import { ParkingScene } from './simulation/parkingScene';
import { RenderPipeline, ViewportRect } from './simulation/renderPipeline';
import { VehiclePhysics } from './simulation/vehiclePhysics';
import { ParkingEvaluator } from './simulation/parkingEvaluator';
import { soundEngine } from './utils/audio';
import { EpisodeHeader } from './components/EpisodeHeader';
import { CockpitOverlay } from './components/CockpitOverlay';
import { MirrorWidgets } from './components/MirrorWidgets';
import { InfotainmentDisplay } from './components/InfotainmentDisplay';
import { DrivingControls } from './components/DrivingControls';
import { EvaluationModal } from './components/EvaluationModal';
import { ControlsHelpModal } from './components/ControlsHelpModal';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Simulation singletons in refs
  const sceneRef = useRef<ParkingScene | null>(null);
  const pipelineRef = useRef<RenderPipeline | null>(null);
  const physicsRef = useRef<VehiclePhysics | null>(null);
  const evaluatorRef = useRef<ParkingEvaluator | null>(null);

  // View state: strictly 'cockpit' or 'exterior'
  const [viewMode, setViewMode] = useState<CameraViewMode>('cockpit');
  const [currentGlance, setCurrentGlance] = useState<LookGlance>('center');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showGuidelines, setShowGuidelines] = useState<boolean>(true);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showEvalModal, setShowEvalModal] = useState<boolean>(false);
  const [hadRecentCollision, setHadRecentCollision] = useState<boolean>(false);

  // Vehicle and parking state
  const [vehicleState, setVehicleState] = useState<VehicleState>({
    x: -4.5,
    z: 0.0, // Middle of the driveway
    y: 0,
    heading: 0,
    speed: 0,
    steeringAngle: 0,
    wheelRotation: 0,
    gear: 'P',
    brakeLight: false,
    reverseLight: false,
    engineRPM: 800,
    pitch: 0,
    roll: 0,
  });

  const [sonar, setSonar] = useState<SonarSensors>({
    rearLeft: 5.0,
    rearCenter: 5.0,
    rearRight: 5.0,
    frontLeft: 5.0,
    frontCenter: 5.0,
    frontRight: 5.0,
    closestDistance: 5.0,
  });

  const [evaluation, setEvaluation] = useState<ParkingEvaluation>({
    isInsideBay: false,
    completionPercentage: 0,
    lateralOffsetCm: 0,
    headingErrorDeg: 0,
    distanceToCurbM: 5.0,
    isParkedSuccessfully: false,
    score: 100,
    rating: 'In Progress',
    collisions: 0,
    gearShifts: 0,
    elapsedSeconds: 0,
    guidanceMessage: 'Welcome to Episode 1. Hold DOWN to reverse into Bay #14.',
  });

  // Current simplified driving inputs
  const inputsRef = useRef<VehicleInputs>({
    forward: false,
    reverse: false,
    steer: 0,
    park: true,
    gear: 'P',
  });
  const [inputsState, setInputsState] = useState<VehicleInputs>(inputsRef.current);

  // Mouse / Touch Dragging for cockpit look-around or orbit
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // Default Initial Position: End of the parking lot (west entrance), on the forward right lane (z = 1.8), facing into the lot (+X)
  const DEFAULT_START_X = -17.0;
  const DEFAULT_START_Z = 1.8;
  const DEFAULT_START_HEADING = Math.PI / 2; // Facing East down the aisle

  // Reset scenario
  const restartEpisode = useCallback(
    (startX = DEFAULT_START_X, startZ = DEFAULT_START_Z, startHeading = DEFAULT_START_HEADING) => {
      if (!physicsRef.current || !evaluatorRef.current) return;

      physicsRef.current.reset(startX, startZ, startHeading);
      evaluatorRef.current.reset();

      inputsRef.current = {
        forward: false,
        reverse: false,
        steer: 0,
        park: false,
        gear: 'D',
      };
      setInputsState({ ...inputsRef.current });

      if (pipelineRef.current) {
        pipelineRef.current.setLookGlance('center');
        setCurrentGlance('center');
      }

      setShowEvalModal(false);
      setHadRecentCollision(false);
    },
    []
  );

  // Initialize Three.js scene & render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 1. Create Scene & Physics
    const parkingScene = new ParkingScene();
    sceneRef.current = parkingScene;

    const initialX = DEFAULT_START_X;
    const initialZ = DEFAULT_START_Z; // Right lane of the aisle
    const initialHeading = DEFAULT_START_HEADING; // Facing +X into the parking lot

    const physics = new VehiclePhysics(initialX, initialZ, initialHeading);
    physicsRef.current = physics;

    const pipeline = new RenderPipeline(canvas, parkingScene);
    pipelineRef.current = pipeline;

    const evaluator = new ParkingEvaluator(parkingScene.targetBay);
    evaluatorRef.current = evaluator;

    const handleResize = () => {
      if (!canvas || !pipelineRef.current) return;
      pipelineRef.current.resize(canvas.clientWidth, canvas.clientHeight);
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // 2. Main Simulation & Animation Loop
    let animationFrameId: number;
    let lastTime = performance.now();
    let collisionCooldown = 0;

    const getDOMRectRelativeToCanvas = (elementId: string): ViewportRect | null => {
      const el = document.getElementById(elementId);
      if (!el || !canvas) return null;
      const elRect = el.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();

      return {
        x: Math.round(elRect.left - canvasRect.left),
        y: Math.round(elRect.top - canvasRect.top),
        width: Math.round(elRect.width),
        height: Math.round(elRect.height),
      };
    };

    const loop = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(loop);

      const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      // Update Physics
      const { hadCollision } = physics.update(inputsRef.current, dt, parkingScene.obstacles);

      if (hadCollision) {
        soundEngine.playCollision();
        setHadRecentCollision(true);
        collisionCooldown = 1.2;
      } else if (collisionCooldown > 0) {
        collisionCooldown -= dt;
        if (collisionCooldown <= 0) {
          setHadRecentCollision(false);
        }
      }

      // Update Audio Engine
      const speedKmh = Math.abs(physics.state.speed * 3.6);
      const isReverse = physics.state.gear === 'R';
      soundEngine.updateEngine(speedKmh, physics.state.engineRPM, isReverse);
      soundEngine.updateSonar(physics.sonar.closestDistance, isReverse);

      // Update 3D Model
      parkingScene.updateCar(physics.state);

      // Update Camera positions & tracking
      pipeline.updateCameras(physics.state, dt);

      // Measure Sub-Viewport DOM Elements
      const leftMirrorRect = getDOMRectRelativeToCanvas('left-mirror-viewport');
      const rightMirrorRect = getDOMRectRelativeToCanvas('right-mirror-viewport');
      const rearviewRect = getDOMRectRelativeToCanvas('rearview-mirror-viewport');
      const backupCamRect = getDOMRectRelativeToCanvas('backup-cam-viewport');
      const birdsEyeRect = getDOMRectRelativeToCanvas('birds-eye-viewport');

      // Render all camera views
      pipeline.render(canvas.clientWidth, canvas.clientHeight, {
        leftMirror: leftMirrorRect,
        rightMirror: rightMirrorRect,
        rearviewMirror: rearviewRect,
        backupCam: backupCamRect,
        birdsEye: birdsEyeRect,
      });

      // Parking Evaluation
      const carCorners = physics.getCarCorners();
      const evalResult = evaluator.evaluate(physics.state, carCorners, physics.collisionCount);

      // Sync state to React
      setVehicleState({ ...physics.state });
      setSonar({ ...physics.sonar });
      setEvaluation(evalResult);

      if (evalResult.isParkedSuccessfully && !showEvalModal) {
        soundEngine.playSuccessFanfare();
        setShowEvalModal(true);
      }
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      pipeline.dispose();
    };
  }, [restartEpisode, showEvalModal]);

  // Simplified Keyboard driving controls & hold-to-glance
  useEffect(() => {
    const activeKeys = new Set<string>();

    const updateFromKeys = () => {
      soundEngine.init();

      let forward = false;
      let reverse = false;
      let steer = 0;

      if (activeKeys.has('KeyW') || activeKeys.has('ArrowUp')) forward = true;
      if (activeKeys.has('KeyS') || activeKeys.has('ArrowDown')) reverse = true;
      if (activeKeys.has('KeyA') || activeKeys.has('ArrowLeft')) steer -= 1;
      if (activeKeys.has('KeyD') || activeKeys.has('ArrowRight')) steer += 1;

      if (forward && !reverse) {
        inputsRef.current.park = false;
        inputsRef.current.forward = true;
        inputsRef.current.reverse = false;
      } else if (reverse && !forward) {
        inputsRef.current.park = false;
        inputsRef.current.reverse = true;
        inputsRef.current.forward = false;
      } else {
        inputsRef.current.forward = false;
        inputsRef.current.reverse = false;
      }

      inputsRef.current.steer = steer;
      setInputsState({ ...inputsRef.current });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      activeKeys.add(e.code);

      if (e.code === 'Space' || e.code === 'KeyP') {
        e.preventDefault();
        inputsRef.current.park = !inputsRef.current.park;
        if (inputsRef.current.park) {
          inputsRef.current.forward = false;
          inputsRef.current.reverse = false;
        }
        setInputsState({ ...inputsRef.current });
        soundEngine.playGearShift();
      } else if (e.code === 'KeyQ' || e.code === 'KeyZ') {
        // Hold Left Over-Shoulder
        e.preventDefault();
        pipelineRef.current?.setLookGlance('over-shoulder-left');
        setCurrentGlance('over-shoulder-left');
      } else if (e.code === 'KeyE' || e.code === 'KeyC') {
        // Hold Right Over-Shoulder
        e.preventDefault();
        pipelineRef.current?.setLookGlance('over-shoulder-right');
        setCurrentGlance('over-shoulder-right');
      } else if (e.code === 'KeyV') {
        // Toggle Cockpit / Exterior
        e.preventDefault();
        setViewMode((prev) => {
          const next = prev === 'cockpit' ? 'exterior' : 'cockpit';
          if (pipelineRef.current) pipelineRef.current.viewMode = next;
          return next;
        });
      }

      updateFromKeys();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      activeKeys.delete(e.code);

      // Return to forward view upon releasing shoulder glance keys
      if (e.code === 'KeyQ' || e.code === 'KeyZ' || e.code === 'KeyE' || e.code === 'KeyC') {
        pipelineRef.current?.setLookGlance('center');
        setCurrentGlance('center');
      }

      updateFromKeys();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Mouse / Touch Look Around Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    soundEngine.init();
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || !pipelineRef.current) return;

    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    if (viewMode === 'exterior') {
      pipelineRef.current.orbitAngle += dx * 0.008;
      pipelineRef.current.orbitHeight = Math.max(1.2, Math.min(8.0, pipelineRef.current.orbitHeight - dy * 0.02));
    } else {
      pipelineRef.current.addManualLook(dx * 0.004, dy * 0.003);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  const handleSetInput = <K extends keyof VehicleInputs>(key: K, value: VehicleInputs[K]) => {
    soundEngine.init();
    inputsRef.current[key] = value;
    setInputsState({ ...inputsRef.current });
  };

  const handleTogglePark = () => {
    soundEngine.init();
    inputsRef.current.park = !inputsRef.current.park;
    if (inputsRef.current.park) {
      inputsRef.current.forward = false;
      inputsRef.current.reverse = false;
    }
    setInputsState({ ...inputsRef.current });
    soundEngine.playGearShift();
  };

  const handleSelectViewMode = (mode: CameraViewMode) => {
    soundEngine.init();
    setViewMode(mode);
    if (pipelineRef.current) {
      pipelineRef.current.viewMode = mode;
      pipelineRef.current.setLookGlance('center');
      setCurrentGlance('center');
    }
  };

  const handleSelectGlance = (glance: LookGlance) => {
    soundEngine.init();
    setCurrentGlance(glance);
    if (pipelineRef.current) {
      pipelineRef.current.setLookGlance(glance);
    }
  };

  const handleToggleMute = () => {
    const muted = soundEngine.toggleMute();
    setIsMuted(muted);
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-neutral-950 font-sans">
      {/* 3D WebGL Canvas filling entire viewport */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-full h-full block cursor-grab active:cursor-grabbing outline-none"
      />

      {/* Top Bar Header (Cockpit View & Exterior Chase only) */}
      <EpisodeHeader
        viewMode={viewMode}
        onSelectViewMode={handleSelectViewMode}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onRestart={() => restartEpisode()}
        onToggleHelp={() => setShowHelpModal(true)}
      />

      {/* Fully Bright Mirror Widgets (Left Wing, Right Wing, Center Rearview) */}
      <MirrorWidgets
        sonar={sonar}
        visible={viewMode === 'cockpit'}
        onEnlargeMirror={(mirror) => {
          if (mirror === 'left') handleSelectGlance('left-mirror');
          else if (mirror === 'right') handleSelectGlance('right-mirror');
          else if (mirror === 'rearview') handleSelectGlance('rearview');
        }}
      />

      {/* Cockpit Overlay (Instrument Cluster Speedometer & Hold-to-Glance Over-Shoulder Buttons) */}
      {viewMode === 'cockpit' && (
        <CockpitOverlay
          state={vehicleState}
          sonar={sonar}
          currentGlance={currentGlance}
          onSelectGlance={handleSelectGlance}
          hadRecentCollision={hadRecentCollision}
        />
      )}

      {/* Central Infotainment Console: Integrated Mirrored Rear Backup Cam + Live 3D Bird's Eye View */}
      {viewMode === 'cockpit' && (
        <InfotainmentDisplay
          state={vehicleState}
          sonar={sonar}
          showGuidelines={showGuidelines}
          onToggleGuidelines={() => setShowGuidelines((prev) => !prev)}
          guidanceMessage={evaluation.guidanceMessage}
        />
      )}

      {/* Simplified Driving Controls: UP for Forward, DOWN for Reverse, Steering, and Park */}
      <DrivingControls
        inputs={inputsState}
        onSetInput={handleSetInput}
        onTogglePark={handleTogglePark}
      />

      {/* Parking Performance Evaluation Modal */}
      <EvaluationModal
        evaluation={evaluation}
        isOpen={showEvalModal}
        onRestart={() => restartEpisode()}
        onNextEpisode={() => restartEpisode()}
        onClose={() => setShowEvalModal(false)}
      />

      {/* Controls and Strategy Help Modal */}
      <ControlsHelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />
    </main>
  );
}
