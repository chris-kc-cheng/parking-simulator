import React, { useMemo } from 'react';
import { SonarSensors, VehicleState } from '../types/simulation';
import { Camera, Eye } from 'lucide-react';

interface InfotainmentDisplayProps {
  state: VehicleState;
  sonar: SonarSensors;
  showGuidelines: boolean;
  onToggleGuidelines: () => void;
  guidanceMessage: string;
}

export const InfotainmentDisplay: React.FC<InfotainmentDisplayProps> = ({
  state,
  sonar,
  showGuidelines,
  onToggleGuidelines,
  guidanceMessage,
}) => {
  // Generate dynamic curving trajectory path that narrows hyperbolically with distance (perspective physics)
  // and curves in an authentic circular Ackermann arc based on wheel angle
  const trajectoryData = useMemo(() => {
    // Physical vehicle and camera parameters
    const wheelbase = 2.7; // m
    const guideWidth = 2.06; // m (car width + safety cushion)
    const steerAngle = state.steeringAngle; // rad (-0.61 to +0.61)

    // Perspective Camera parameters for the rear backup camera
    // Camera is mounted at rear bumper facing backward, tilted down by ~20 deg
    const camHeight = 0.78; // m
    const tiltRad = 0.35; // ~20 degrees downward tilt in radians
    const cosTilt = Math.cos(tiltRad);
    const sinTilt = Math.sin(tiltRad);

    const fovY = (86 * Math.PI) / 180;
    const viewW = 320;
    const viewH = 220;
    const centerX = viewW / 2;
    const horizonY = viewH * 0.36; // Horizon line in camera perspective
    const focalLength = (viewH * 0.52) / Math.tan(fovY / 2);

    // Project 3D ground point (x, y=0, z) relative to rear bumper into 2D camera screen coordinates
    // z: distance along ground behind bumper (positive meters)
    // x: lateral distance (positive = right side of car, negative = left side)
    const projectPoint = (x: number, z: number) => {
      const yRel = -camHeight;
      const zRel = z;

      // Rotate by downward tilt angle into camera optical frame
      const camY = yRel * cosTilt + zRel * sinTilt;
      const camZ = -yRel * sinTilt + zRel * cosTilt;

      if (camZ <= 0.1) return null;

      // In mirrored backup camera: positive x (right side of car) is on the right side of the screen
      const screenX = centerX + (focalLength * x) / camZ;
      const screenY = horizonY - (focalLength * camY) / camZ;

      return { x: screenX, y: screenY };
    };

    // Exact Vehicle & Rear Wheel Contact Geometry
    const trackWidth = 1.70; // m (center-to-center distance between left and right rear tires)
    const tireWidth = 0.24; // m (24cm wide contact patch on the asphalt)
    const halfTrack = trackWidth / 2; // 0.85m

    const leftWheelCenter = -halfTrack; // -0.85m
    const rightWheelCenter = halfTrack;  // +0.85m

    const leftOuter = leftWheelCenter - tireWidth / 2; // -0.97m
    const leftInner = leftWheelCenter + tireWidth / 2; // -0.73m
    const rightInner = rightWheelCenter - tireWidth / 2; // +0.73m
    const rightOuter = rightWheelCenter + tireWidth / 2; // +0.97m

    // =========================================================================
    // EXACT KINEMATIC CONCENTRIC CIRCLES (IDENTICAL FOCAL POINT ON REAR AXLE)
    // Front wheel turned by steerAngle:
    // Radius of rear axle center: R = wheelbase / tan(steerAngle)
    // Focal Point (Center of Rotation): (X_focal = R, Z_focal = 0)
    // Both Left and Right curves are edges of two circles with the SAME FOCAL POINT!
    // =========================================================================
    const isStraight = Math.abs(steerAngle) < 0.005;
    const R = isStraight ? 0 : wheelbase / Math.tan(steerAngle);

    // Exact Concentric Circle Point Evaluator
    // For any wheel contact offset w, its distance from focal point is r = R - w.
    // Circle equation: (x - R)^2 + distBehindAxle^2 = r^2
    const getConcentricCirclePoint = (sDist: number, lateralOffset: number) => {
      if (isStraight) {
        return {
          x: lateralOffset,
          distBehindAxle: sDist,
        };
      }
      const phi = sDist / R;
      const r = R - lateralOffset; // Exact radius of this circle edge from focal point
      const x = R - r * Math.cos(phi); // Exact circle X: (x - R)^2 + dist^2 = r^2
      const distBehindAxle = r * Math.sin(phi); // Exact circle distance behind rear axle
      return { x, distBehindAxle };
    };

    const sampleSteps = 24;
    // Bumper is 1.01m behind rear axle, so min arc distance along axle is 1.25m (starts just behind bumper)
    const minS = 1.25;
    const maxS = 4.8;

    const leftOuterPts: { x: number; y: number }[] = [];
    const leftInnerPts: { x: number; y: number }[] = [];
    const leftCenterPts: { x: number; y: number }[] = [];

    const rightInnerPts: { x: number; y: number }[] = [];
    const rightOuterPts: { x: number; y: number }[] = [];
    const rightCenterPts: { x: number; y: number }[] = [];

    const centerPts: { x: number; y: number }[] = [];

    // Bird's Eye View coordinate mapping:
    // (120, 100) car center, 11.111 px/m, Up = Forward, Down = Backward
    const birdScale = 11.111; // 200 / 18m
    const birdCenterX = 120;
    const birdCenterY = 100;
    const birdRearAxleY = birdCenterY + 1.35 * birdScale;

    const birdLeftOuterPts: { x: number; y: number }[] = [];
    const birdLeftInnerPts: { x: number; y: number }[] = [];
    const birdLeftCenterPts: { x: number; y: number }[] = [];

    const birdRightInnerPts: { x: number; y: number }[] = [];
    const birdRightOuterPts: { x: number; y: number }[] = [];
    const birdRightCenterPts: { x: number; y: number }[] = [];

    const birdCenterPts: { x: number; y: number }[] = [];

    const toBirdScreen = (pt: { x: number; distBehindAxle: number }) => ({
      x: birdCenterX + pt.x * birdScale,
      y: birdRearAxleY + pt.distBehindAxle * birdScale,
    });

    for (let i = 0; i <= sampleSteps; i++) {
      const s = minS + (i / sampleSteps) * (maxS - minS);

      const pLO = getConcentricCirclePoint(s, leftOuter);
      const pLI = getConcentricCirclePoint(s, leftInner);
      const pLC = getConcentricCirclePoint(s, leftWheelCenter);

      const pRI = getConcentricCirclePoint(s, rightInner);
      const pRO = getConcentricCirclePoint(s, rightOuter);
      const pRC = getConcentricCirclePoint(s, rightWheelCenter);

      const pC = getConcentricCirclePoint(s, 0);

      // Rear Camera perspective projection (camera is 1.01m behind rear axle)
      const sLO = projectPoint(pLO.x, pLO.distBehindAxle - 1.01);
      const sLI = projectPoint(pLI.x, pLI.distBehindAxle - 1.01);
      const sLC = projectPoint(pLC.x, pLC.distBehindAxle - 1.01);

      const sRI = projectPoint(pRI.x, pRI.distBehindAxle - 1.01);
      const sRO = projectPoint(pRO.x, pRO.distBehindAxle - 1.01);
      const sRC = projectPoint(pRC.x, pRC.distBehindAxle - 1.01);

      const sC = projectPoint(pC.x, pC.distBehindAxle - 1.01);

      if (sLO && sLI && sLC) {
        leftOuterPts.push(sLO);
        leftInnerPts.push(sLI);
        leftCenterPts.push(sLC);
      }
      if (sRI && sRO && sRC) {
        rightInnerPts.push(sRI);
        rightOuterPts.push(sRO);
        rightCenterPts.push(sRC);
      }
      if (sC) {
        centerPts.push(sC);
      }

      // Bird's Eye top-down projection
      birdLeftOuterPts.push(toBirdScreen(pLO));
      birdLeftInnerPts.push(toBirdScreen(pLI));
      birdLeftCenterPts.push(toBirdScreen(pLC));

      birdRightInnerPts.push(toBirdScreen(pRI));
      birdRightOuterPts.push(toBirdScreen(pRO));
      birdRightCenterPts.push(toBirdScreen(pRC));

      birdCenterPts.push(toBirdScreen(pC));
    }

    const toPath = (pts: { x: number; y: number }[]) => {
      if (pts.length === 0) return '';
      return pts.reduce(
        (acc, pt, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`,
        ''
      );
    };

    const toPolygon = (outerPts: { x: number; y: number }[], innerPts: { x: number; y: number }[]) => {
      if (outerPts.length === 0 || innerPts.length === 0) return '';
      const forward = outerPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
      const reverse = innerPts.slice().reverse().map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
      return `${forward} ${reverse}`;
    };

    // Distance crossbars along concentric circles (distance behind bumper = sDist - 1.01m)
    const getMarkerLine = (distBehindBumper: number) => {
      const sTotal = distBehindBumper + 1.01;
      const pL = getConcentricCirclePoint(sTotal, leftOuter);
      const pR = getConcentricCirclePoint(sTotal, rightOuter);
      const sL = projectPoint(pL.x, distBehindBumper);
      const sR = projectPoint(pR.x, distBehindBumper);
      if (!sL || !sR) return null;
      return { x1: sL.x, y1: sL.y, x2: sR.x, y2: sR.y };
    };

    const getBirdMarkerLine = (distBehindBumper: number) => {
      const sTotal = distBehindBumper + 1.01;
      const pL = getConcentricCirclePoint(sTotal, leftOuter);
      const pR = getConcentricCirclePoint(sTotal, rightOuter);
      const bL = toBirdScreen(pL);
      const bR = toBirdScreen(pR);
      return { x1: bL.x, y1: bL.y, x2: bR.x, y2: bR.y };
    };

    // Current rear wheel ground contact footprint (at rear axle s = 0 to 0.5m)
    const pLF1 = getConcentricCirclePoint(0.1, leftOuter);
    const pLF2 = getConcentricCirclePoint(0.1, leftInner);
    const pLF3 = getConcentricCirclePoint(0.5, leftInner);
    const pLF4 = getConcentricCirclePoint(0.5, leftOuter);

    const pRF1 = getConcentricCirclePoint(0.1, rightInner);
    const pRF2 = getConcentricCirclePoint(0.1, rightOuter);
    const pRF3 = getConcentricCirclePoint(0.5, rightOuter);
    const pRF4 = getConcentricCirclePoint(0.5, rightInner);

    const bLF1 = toBirdScreen(pLF1);
    const bLF2 = toBirdScreen(pLF2);
    const bLF3 = toBirdScreen(pLF3);
    const bLF4 = toBirdScreen(pLF4);

    const bRF1 = toBirdScreen(pRF1);
    const bRF2 = toBirdScreen(pRF2);
    const bRF3 = toBirdScreen(pRF3);
    const bRF4 = toBirdScreen(pRF4);

    // Rear camera footprints (starting at bumper sTotal = 1.05m to 1.45m)
    const cLF1 = projectPoint(getConcentricCirclePoint(1.05, leftOuter).x, 0.04);
    const cLF2 = projectPoint(getConcentricCirclePoint(1.05, leftInner).x, 0.04);
    const cLF3 = projectPoint(getConcentricCirclePoint(1.45, leftInner).x, 0.44);
    const cLF4 = projectPoint(getConcentricCirclePoint(1.45, leftOuter).x, 0.44);

    const cRF1 = projectPoint(getConcentricCirclePoint(1.05, rightInner).x, 0.04);
    const cRF2 = projectPoint(getConcentricCirclePoint(1.05, rightOuter).x, 0.04);
    const cRF3 = projectPoint(getConcentricCirclePoint(1.45, rightOuter).x, 0.44);
    const cRF4 = projectPoint(getConcentricCirclePoint(1.45, rightInner).x, 0.44);

    return {
      leftCenterPath: toPath(leftCenterPts),
      rightCenterPath: toPath(rightCenterPts),
      centerPath: toPath(centerPts),
      leftTrackPolygon: toPolygon(leftOuterPts, leftInnerPts),
      rightTrackPolygon: toPolygon(rightInnerPts, rightOuterPts),
      leftFootprint:
        cLF1 && cLF2 && cLF3 && cLF4
          ? `${cLF1.x.toFixed(1)},${cLF1.y.toFixed(1)} ${cLF2.x.toFixed(1)},${cLF2.y.toFixed(1)} ${cLF3.x.toFixed(1)},${cLF3.y.toFixed(1)} ${cLF4.x.toFixed(1)},${cLF4.y.toFixed(1)}`
          : '',
      rightFootprint:
        cRF1 && cRF2 && cRF3 && cRF4
          ? `${cRF1.x.toFixed(1)},${cRF1.y.toFixed(1)} ${cRF2.x.toFixed(1)},${cRF2.y.toFixed(1)} ${cRF3.x.toFixed(1)},${cRF3.y.toFixed(1)} ${cRF4.x.toFixed(1)},${cRF4.y.toFixed(1)}`
          : '',
      redMarker: getMarkerLine(0.55),     // 0.55m bumper critical stop
      yellowMarker1: getMarkerLine(1.25), // 1.25m caution
      yellowMarker2: getMarkerLine(2.2),  // 2.2m intermediate
      greenMarker: getMarkerLine(3.4),    // 3.4m safe entry
      birdsEye: {
        leftCenterPath: toPath(birdLeftCenterPts),
        rightCenterPath: toPath(birdRightCenterPts),
        centerPath: toPath(birdCenterPts),
        leftTrackPolygon: toPolygon(birdLeftOuterPts, birdLeftInnerPts),
        rightTrackPolygon: toPolygon(birdRightInnerPts, birdRightOuterPts),
        leftFootprint: `${bLF1.x.toFixed(1)},${bLF1.y.toFixed(1)} ${bLF2.x.toFixed(1)},${bLF2.y.toFixed(1)} ${bLF3.x.toFixed(1)},${bLF3.y.toFixed(1)} ${bLF4.x.toFixed(1)},${bLF4.y.toFixed(1)}`,
        rightFootprint: `${bRF1.x.toFixed(1)},${bRF1.y.toFixed(1)} ${bRF2.x.toFixed(1)},${bRF2.y.toFixed(1)} ${bRF3.x.toFixed(1)},${bRF3.y.toFixed(1)} ${bRF4.x.toFixed(1)},${bRF4.y.toFixed(1)}`,
        redMarker: getBirdMarkerLine(0.55),
        yellowMarker1: getBirdMarkerLine(1.25),
        yellowMarker2: getBirdMarkerLine(2.2),
        greenMarker: getBirdMarkerLine(3.4),
      },
    };
  }, [state.steeringAngle]);

  const isReverse = state.gear === 'R';

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto select-none">
      {/* Automotive Center Console Frame (100% transparent screen cutout so WebGL shines through) */}
      <div className="w-[340px] sm:w-[560px] md:w-[680px] p-2 bg-transparent rounded-2xl border-2 border-neutral-700/90 shadow-2xl">
        {/* Top Infotainment Header Bar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-950/90 rounded-t-xl border border-white/15 text-[11px] font-mono text-neutral-300">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isReverse ? 'bg-red-500 animate-pulse' : 'bg-emerald-400'
              }`}
            />
            <span className="font-semibold text-white tracking-wider">
              {isReverse ? 'PARKING ASSIST (REAR ACTIVE)' : 'COCKPIT PARKING RADAR'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-neutral-400">
              MIN DIST: <strong className="text-white font-mono">{sonar.closestDistance < 4 ? `${sonar.closestDistance.toFixed(2)}m` : '> 4.0m'}</strong>
            </span>
            <button
              onClick={onToggleGuidelines}
              className={`px-2 py-0.5 rounded text-[10px] transition-colors border ${
                showGuidelines
                  ? 'bg-blue-600/40 border-blue-400 text-blue-200'
                  : 'bg-neutral-800 border-neutral-700 text-neutral-400'
              }`}
            >
              TRAJECTORY {showGuidelines ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Dual Screen Display: 3D Bird's Eye View (Left) + Mirror Backup Camera (Right) */}
        {/* CRITICAL: Must be completely transparent with no background color so WebGL canvas is 100% visible! */}
        <div className="grid grid-cols-12 gap-2 mt-1.5 h-44 sm:h-52 bg-transparent rounded-b-xl overflow-hidden border border-white/15 relative">
          {/* LEFT: Live 3D Bird's Eye Camera with Dynamic Backwards Projection */}
          <div className="col-span-5 relative bg-transparent border-r border-white/15 flex flex-col justify-between overflow-hidden">
            {/* 3D Viewport Target for Live Bird's Eye Camera */}
            <div id="birds-eye-viewport" className="absolute inset-0 w-full h-full bg-transparent" />

            {/* Backwards Projection Lines & Car Body Color Accent in Bird's Eye View */}
            {showGuidelines && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-md z-10"
                viewBox="0 0 240 200"
                preserveAspectRatio="none"
              >
                {/* Subtle dashed clearance boundary allowing 3D car color to shine through */}
                <rect
                  x={120 - 10.4}
                  y={100 - 25.2}
                  width={20.8}
                  height={50.4}
                  rx={4.5}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.0"
                  strokeDasharray="3 3"
                  opacity="0.5"
                />

                {/* Left Rear Wheel Track Polygon */}
                {trajectoryData.birdsEye.leftTrackPolygon && (
                  <polygon
                    points={trajectoryData.birdsEye.leftTrackPolygon}
                    fill="rgba(56, 189, 248, 0.22)"
                    stroke="#38bdf8"
                    strokeWidth="1.0"
                  />
                )}
                {/* Right Rear Wheel Track Polygon */}
                {trajectoryData.birdsEye.rightTrackPolygon && (
                  <polygon
                    points={trajectoryData.birdsEye.rightTrackPolygon}
                    fill="rgba(56, 189, 248, 0.22)"
                    stroke="#38bdf8"
                    strokeWidth="1.0"
                  />
                )}

                {/* Wheel Centerlines */}
                <path
                  d={trajectoryData.birdsEye.leftCenterPath}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.0"
                  strokeDasharray="4 2"
                  opacity="0.9"
                />
                <path
                  d={trajectoryData.birdsEye.rightCenterPath}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.0"
                  strokeDasharray="4 2"
                  opacity="0.9"
                />

                {/* Center path guide */}
                <path
                  d={trajectoryData.birdsEye.centerPath}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.0"
                  strokeDasharray="3 3"
                  opacity="0.5"
                />

                {/* Current Tire Footprints */}
                <polygon
                  points={trajectoryData.birdsEye.leftFootprint}
                  fill="rgba(14, 165, 233, 0.65)"
                  stroke="#38bdf8"
                  strokeWidth="1.4"
                />
                <polygon
                  points={trajectoryData.birdsEye.rightFootprint}
                  fill="rgba(14, 165, 233, 0.65)"
                  stroke="#38bdf8"
                  strokeWidth="1.4"
                />

                {/* Distance Markers: Green (3.4m), Yellow (2.2m, 1.25m), Red (0.55m) */}
                {trajectoryData.birdsEye.greenMarker && (
                  <line
                    x1={trajectoryData.birdsEye.greenMarker.x1}
                    y1={trajectoryData.birdsEye.greenMarker.y1}
                    x2={trajectoryData.birdsEye.greenMarker.x2}
                    y2={trajectoryData.birdsEye.greenMarker.y2}
                    stroke="#22c55e"
                    strokeWidth="2.0"
                    strokeDasharray="4 2"
                  />
                )}
                {trajectoryData.birdsEye.yellowMarker2 && (
                  <line
                    x1={trajectoryData.birdsEye.yellowMarker2.x1}
                    y1={trajectoryData.birdsEye.yellowMarker2.y1}
                    x2={trajectoryData.birdsEye.yellowMarker2.x2}
                    y2={trajectoryData.birdsEye.yellowMarker2.y2}
                    stroke="#facc15"
                    strokeWidth="2.2"
                    strokeDasharray="4 2"
                  />
                )}
                {trajectoryData.birdsEye.yellowMarker1 && (
                  <line
                    x1={trajectoryData.birdsEye.yellowMarker1.x1}
                    y1={trajectoryData.birdsEye.yellowMarker1.y1}
                    x2={trajectoryData.birdsEye.yellowMarker1.x2}
                    y2={trajectoryData.birdsEye.yellowMarker1.y2}
                    stroke="#eab308"
                    strokeWidth="2.6"
                  />
                )}
                {trajectoryData.birdsEye.redMarker && (
                  <line
                    x1={trajectoryData.birdsEye.redMarker.x1}
                    y1={trajectoryData.birdsEye.redMarker.y1}
                    x2={trajectoryData.birdsEye.redMarker.x2}
                    y2={trajectoryData.birdsEye.redMarker.y2}
                    stroke="#ef4444"
                    strokeWidth="3.2"
                  />
                )}
              </svg>
            )}

            {/* Header Badge */}
            <div className="relative z-10 m-2 flex items-center gap-1.5 text-[9px] font-mono text-neutral-100 bg-neutral-950/80 px-2 py-0.5 rounded backdrop-blur-xs w-max border border-white/10">
              <Eye size={11} className="text-blue-400" />
              <span>3D BIRD'S EYE VIEW</span>
            </div>

            {/* Bottom Sonar Distance Badge */}
            <div className="relative z-10 m-2 self-start text-[9px] font-mono bg-neutral-950/80 px-2 py-0.5 rounded text-neutral-200 border border-white/10">
              REAR: <strong className={sonar.rearCenter < 0.5 ? 'text-red-400' : 'text-emerald-400'}>{sonar.rearCenter.toFixed(2)}m</strong>
            </div>
          </div>

          {/* RIGHT: Live 3D Backup Camera with Accurate Perspective-Curved Trajectory */}
          <div className="col-span-7 relative bg-transparent flex flex-col justify-end overflow-hidden">
            {/* 3D Viewport Target for Backup Camera */}
            <div id="backup-cam-viewport" className="absolute inset-0 w-full h-full bg-transparent" />

            {/* Curving, Perspective-Narrowed Predictive Rear Wheel Ground Contact Tracks */}
            {showGuidelines && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-md"
                viewBox="0 0 320 220"
                preserveAspectRatio="none"
              >
                {/* 1. Left Rear Wheel Ground Contact Track (24cm wide tire tread on asphalt) */}
                {trajectoryData.leftTrackPolygon && (
                  <polygon
                    points={trajectoryData.leftTrackPolygon}
                    fill="rgba(56, 189, 248, 0.22)"
                    stroke="#38bdf8"
                    strokeWidth="1.2"
                  />
                )}

                {/* 2. Right Rear Wheel Ground Contact Track (24cm wide tire tread on asphalt) */}
                {trajectoryData.rightTrackPolygon && (
                  <polygon
                    points={trajectoryData.rightTrackPolygon}
                    fill="rgba(56, 189, 248, 0.22)"
                    stroke="#38bdf8"
                    strokeWidth="1.2"
                  />
                )}

                {/* Left Tire Centerline */}
                <path
                  d={trajectoryData.leftCenterPath}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.4"
                  strokeDasharray="5 3"
                  opacity="0.9"
                />

                {/* Right Tire Centerline */}
                <path
                  d={trajectoryData.rightCenterPath}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.4"
                  strokeDasharray="5 3"
                  opacity="0.9"
                />

                {/* Center path guide (thin dashed line) */}
                <path
                  d={trajectoryData.centerPath}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  opacity="0.5"
                />

                {/* Current Rear Wheel Ground Footprints (where tires currently contact pavement) */}
                {trajectoryData.leftFootprint && (
                  <polygon
                    points={trajectoryData.leftFootprint}
                    fill="rgba(14, 165, 233, 0.6)"
                    stroke="#38bdf8"
                    strokeWidth="1.8"
                  />
                )}
                {trajectoryData.rightFootprint && (
                  <polygon
                    points={trajectoryData.rightFootprint}
                    fill="rgba(14, 165, 233, 0.6)"
                    stroke="#38bdf8"
                    strokeWidth="1.8"
                  />
                )}

                {/* Green Marker: ~3.4m safe entry (furthest away, narrowest) */}
                {trajectoryData.greenMarker && (
                  <line
                    x1={trajectoryData.greenMarker.x1}
                    y1={trajectoryData.greenMarker.y1}
                    x2={trajectoryData.greenMarker.x2}
                    y2={trajectoryData.greenMarker.y2}
                    stroke="#22c55e"
                    strokeWidth="2.5"
                    strokeDasharray="5 3"
                  />
                )}

                {/* Yellow Marker 2: ~2.2m intermediate */}
                {trajectoryData.yellowMarker2 && (
                  <line
                    x1={trajectoryData.yellowMarker2.x1}
                    y1={trajectoryData.yellowMarker2.y1}
                    x2={trajectoryData.yellowMarker2.x2}
                    y2={trajectoryData.yellowMarker2.y2}
                    stroke="#facc15"
                    strokeWidth="2.8"
                    strokeDasharray="6 3"
                  />
                )}

                {/* Yellow Marker 1: ~1.25m caution zone */}
                {trajectoryData.yellowMarker1 && (
                  <line
                    x1={trajectoryData.yellowMarker1.x1}
                    y1={trajectoryData.yellowMarker1.y1}
                    x2={trajectoryData.yellowMarker1.x2}
                    y2={trajectoryData.yellowMarker1.y2}
                    stroke="#eab308"
                    strokeWidth="3.2"
                  />
                )}

                {/* Red Marker: ~0.55m bumper critical stop (widest, closest to car) */}
                {trajectoryData.redMarker && (
                  <line
                    x1={trajectoryData.redMarker.x1}
                    y1={trajectoryData.redMarker.y1}
                    x2={trajectoryData.redMarker.x2}
                    y2={trajectoryData.redMarker.y2}
                    stroke="#ef4444"
                    strokeWidth="4.0"
                  />
                )}
              </svg>
            )}

            {/* Rear Bumper Reference Line at bottom */}
            <div className="absolute bottom-0 inset-x-0 h-4 bg-gradient-to-t from-neutral-950/80 to-transparent flex items-center justify-center">
              <span className="text-[8px] font-mono text-neutral-300 uppercase tracking-widest">
                Rear Bumper Reference
              </span>
            </div>

            {/* Top Camera Header */}
            <div className="absolute top-2 left-2 flex items-center gap-1.5 text-[9px] font-mono text-neutral-100 bg-neutral-950/80 px-2 py-0.5 rounded backdrop-blur-xs border border-white/10">
              <Camera size={11} className="text-red-400" />
              <span>REAR CAM</span>
            </div>

            {/* Real-time Guidance Message */}
            <div className="absolute bottom-5 inset-x-2 bg-neutral-950/90 backdrop-blur-xs border border-white/10 rounded px-2.5 py-1 flex items-center justify-between text-[10px] text-neutral-200">
              <span className="flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="truncate">{guidanceMessage}</span>
              </span>
              <span className="font-mono text-neutral-300 shrink-0 ml-1">
                STEER: {Math.round((state.steeringAngle * 180) / Math.PI)}°
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
