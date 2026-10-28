import { VehicleState, ParkingBay, ParkingEvaluation } from '../types/simulation';

export class ParkingEvaluator {
  private bay: ParkingBay;
  private startTime: number;
  private prevGear: string = 'P';
  public gearShifts: number = 0;

  constructor(bay: ParkingBay) {
    this.bay = bay;
    this.startTime = performance.now();
  }

  public reset(bay?: ParkingBay) {
    if (bay) this.bay = bay;
    this.startTime = performance.now();
    this.gearShifts = 0;
    this.prevGear = 'P';
  }

  public evaluate(
    state: VehicleState,
    carCorners: { x: number; z: number }[],
    collisions: number
  ): ParkingEvaluation {
    const elapsedSeconds = Math.floor((performance.now() - this.startTime) / 1000);

    // Track gear shifts
    if (state.gear !== this.prevGear) {
      this.gearShifts++;
      this.prevGear = state.gear;
    }

    // 1. Target Slot Bounds
    // Bay center is at (targetX, targetZ). Width across X, Length along Z
    const halfW = this.bay.width / 2;
    const halfL = this.bay.length / 2;
    const minX = this.bay.targetX - halfW;
    const maxX = this.bay.targetX + halfW;
    const minZ = this.bay.targetZ - halfL;
    const maxZ = this.bay.targetZ + halfL;

    // 2. Corners inside bay check
    let insideCount = 0;
    for (const c of carCorners) {
      if (c.x >= minX && c.x <= maxX && c.z >= minZ && c.z <= maxZ) {
        insideCount++;
      }
    }
    const completionPercentage = (insideCount / 4) * 100;
    const isInsideBay = insideCount === 4;

    // 3. Lateral offset from center line (in cm)
    // Positive or negative distance from x = targetX
    const lateralOffsetCm = Math.abs(state.x - this.bay.targetX) * 100;

    // 4. Heading error in degrees
    // Target heading is this.bay.targetHeading (backing in, car heading should point along +Z or -Z)
    // Normalize angles between -PI and PI
    let angleDiff = state.heading - this.bay.targetHeading;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    const headingErrorDeg = Math.abs(angleDiff * (180 / Math.PI));

    // 5. Distance to curb / rear wheel stop
    // Car rear bumper Z position (when backed in with heading ~PI, rear bumper is along +Z):
    const rearBumperZ = state.z - 2.27 * Math.cos(state.heading);
    const distanceToCurbM = Math.max(0, this.bay.curbZ - rearBumperZ);

    // 6. Success check
    // Parked successfully when:
    // - Shifted to 'P'
    // - Speed is 0
    // - All 4 corners inside bay
    // - Heading error <= 4.0 degrees
    // - Lateral offset <= 30 cm
    // - Distance to curb <= 0.65m
    const isStationary = Math.abs(state.speed) < 0.05;
    const isParkedSuccessfully =
      state.gear === 'P' &&
      isStationary &&
      isInsideBay &&
      headingErrorDeg <= 4.5 &&
      lateralOffsetCm <= 35 &&
      distanceToCurbM <= 0.7;

    // 7. Calculate Precision Score (0 - 100)
    let score = 100;

    // Deduct for lateral offset (> 5cm deducts)
    const lateralPenalty = Math.min(25, Math.max(0, (lateralOffsetCm - 5) * 0.7));
    score -= lateralPenalty;

    // Deduct for angle deviation (> 1 deg deducts)
    const anglePenalty = Math.min(25, Math.max(0, (headingErrorDeg - 1.0) * 4));
    score -= anglePenalty;

    // Deduct for curb distance mismatch (ideal 0.25m - 0.45m)
    let curbPenalty = 0;
    if (distanceToCurbM > 0.45) {
      curbPenalty = Math.min(20, (distanceToCurbM - 0.45) * 30);
    } else if (distanceToCurbM < 0.15) {
      curbPenalty = Math.min(20, (0.15 - distanceToCurbM) * 50);
    }
    score -= curbPenalty;

    // Deduct for collisions
    score -= collisions * 30;

    // Deduct for excessive shifts (> 4 shifts)
    if (this.gearShifts > 4) {
      score -= (this.gearShifts - 4) * 3;
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    // 8. Rating
    let rating: ParkingEvaluation['rating'] = 'In Progress';
    if (collisions > 0) {
      rating = 'Failed';
    } else if (isParkedSuccessfully) {
      if (score >= 93) rating = 'S';
      else if (score >= 80) rating = 'A';
      else if (score >= 70) rating = 'B';
      else rating = 'C';
    }

    // 9. Real-time Coaching / Guidance Message
    let guidanceMessage = '';
    if (collisions > 0) {
      guidanceMessage = 'Collision detected with obstacle! Shift to D to pull away.';
    } else if (isParkedSuccessfully) {
      guidanceMessage = 'Perfect back-in park! Vehicle securely in bay.';
    } else if (state.gear === 'P') {
      guidanceMessage = 'Shift to D (Drive) to proceed down the aisle toward Bay #14.';
    } else if (state.gear === 'D') {
      if (state.x < this.bay.targetX - 2.5) {
        guidanceMessage = 'Drive down the right lane toward Bay #14 ahead on your left.';
      } else if (state.x <= this.bay.targetX + 3.5) {
        guidanceMessage = 'Pull ahead past Bay #14, stop, and shift to R (Reverse).';
      } else {
        guidanceMessage = 'Stop and shift to R (Reverse) to begin backing into Bay #14.';
      }
    } else if (state.gear === 'R') {
      if (completionPercentage < 20) {
        if (state.x < this.bay.targetX - 1.5) {
          guidanceMessage = 'Turn wheel RIGHT to swing rear into Bay #14.';
        } else if (state.x > this.bay.targetX + 1.5) {
          guidanceMessage = 'Turn wheel LEFT to angle into Bay #14.';
        } else {
          guidanceMessage = 'Approaching bay. Watch side mirrors for neighboring cars.';
        }
      } else if (completionPercentage < 80) {
        if (headingErrorDeg > 6) {
          guidanceMessage = 'Straighten the wheel to align parallel with bay lines.';
        } else {
          guidanceMessage = 'Great alignment! Keep backing up steadily.';
        }
      } else {
        if (distanceToCurbM > 0.6) {
          guidanceMessage = 'Back in deeper. Check backup camera distance markers.';
        } else if (distanceToCurbM > 0.25) {
          guidanceMessage = 'Target depth reached! Brake and shift to P (Park).';
        } else {
          guidanceMessage = 'Brake now! You are right at the wheel stop bumper.';
        }
      }
    } else {
      guidanceMessage = 'Use D / R and mirrors to maneuver into target stall.';
    }

    return {
      isInsideBay,
      completionPercentage,
      lateralOffsetCm,
      headingErrorDeg,
      distanceToCurbM,
      isParkedSuccessfully,
      score,
      rating,
      collisions,
      gearShifts: this.gearShifts,
      elapsedSeconds,
      guidanceMessage,
    };
  }
}
