export type Gear = 'P' | 'R' | 'N' | 'D';

export interface VehicleInputs {
  forward: boolean; // Up button / W / ArrowUp -> Accelerate forward
  reverse: boolean; // Down button / S / ArrowDown -> Accelerate in reverse
  steer: number; // -1 (full left) to +1 (full right)
  park: boolean; // P / Spacebar -> Handbrake / Park lock
  gear: Gear;
}

export interface VehicleState {
  x: number;
  z: number;
  y: number;
  heading: number; // in radians, 0 is pointing along -Z or +Z
  speed: number; // m/s (positive forward, negative reverse)
  steeringAngle: number; // radians (-0.62 to +0.62)
  wheelRotation: number; // radians for rolling wheels
  gear: Gear;
  brakeLight: boolean;
  reverseLight: boolean;
  engineRPM: number;
  pitch: number; // nose dive/rise
  roll: number; // body roll in turn
}

export interface SonarSensors {
  rearLeft: number; // distance in meters
  rearCenter: number;
  rearRight: number;
  frontLeft: number;
  frontCenter: number;
  frontRight: number;
  closestDistance: number;
}

export interface ParkingBay {
  id: string;
  number: number;
  targetX: number;
  targetZ: number;
  targetHeading: number; // radians (PI for backing in)
  width: number;
  length: number;
  curbZ: number;
}

export interface ParkingEvaluation {
  isInsideBay: boolean;
  completionPercentage: number;
  lateralOffsetCm: number;
  headingErrorDeg: number;
  distanceToCurbM: number;
  isParkedSuccessfully: boolean;
  score: number;
  rating: 'S' | 'A' | 'B' | 'C' | 'Failed' | 'In Progress';
  collisions: number;
  gearShifts: number;
  elapsedSeconds: number;
  guidanceMessage: string;
}

export type CameraViewMode = 'cockpit' | 'exterior';
export type LookGlance = 'center' | 'left-mirror' | 'right-mirror' | 'rearview' | 'over-shoulder-left' | 'over-shoulder-right';

export interface ObstacleBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
  name: string;
}
