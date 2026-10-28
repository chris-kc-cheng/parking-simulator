import { VehicleInputs, VehicleState, SonarSensors, ObstacleBox } from '../types/simulation';

export class VehiclePhysics {
  // Physical parameters (in meters and seconds)
  public readonly wheelbase = 2.7; // m
  public readonly trackWidth = 1.6; // m
  public readonly carWidth = 1.86; // m
  public readonly carLength = 4.54; // m
  public readonly frontOverhang = 0.92; // m
  public readonly rearOverhang = 0.92; // m
  public readonly maxSteerAngle = 0.68; // ~39 degrees (agile automotive parking turning radius)

  // Dynamic limits
  private readonly maxForwardSpeed = 4.8; // ~17 km/h (parking speed limit)
  private readonly maxReverseSpeed = 3.4; // ~12 km/h
  private readonly forwardAccel = 2.4; // m/s^2
  private readonly reverseAccel = 2.0; // m/s^2
  private readonly autoBrakeDecel = 3.6; // m/s^2 smooth stop when key released
  private readonly steerRate = 2.5; // rad/s

  public state: VehicleState;
  public collisionCount: number = 0;
  public lastImpactTime: number = 0;
  public rearX: number = 0;
  public rearZ: number = 0;
  public sonar: SonarSensors = {
    rearLeft: 5.0,
    rearCenter: 5.0,
    rearRight: 5.0,
    frontLeft: 5.0,
    frontCenter: 5.0,
    frontRight: 5.0,
    closestDistance: 5.0,
  };

  constructor(initialX: number = 0, initialZ: number = 0, initialHeading: number = 0) {
    this.state = {
      x: initialX,
      z: initialZ,
      y: 0,
      heading: initialHeading,
      speed: 0,
      steeringAngle: 0,
      wheelRotation: 0,
      gear: 'P',
      brakeLight: false,
      reverseLight: false,
      engineRPM: 800,
      pitch: 0,
      roll: 0,
    };
    const halfL = this.wheelbase / 2;
    this.rearX = initialX - halfL * Math.sin(initialHeading);
    this.rearZ = initialZ - halfL * Math.cos(initialHeading);
  }

  public reset(x: number, z: number, heading: number) {
    this.state.x = x;
    this.state.z = z;
    this.state.y = 0;
    this.state.heading = heading;
    this.state.speed = 0;
    this.state.steeringAngle = 0;
    this.state.wheelRotation = 0;
    this.state.gear = 'P';
    this.state.brakeLight = false;
    this.state.reverseLight = false;
    this.state.engineRPM = 800;
    this.state.pitch = 0;
    this.state.roll = 0;
    this.collisionCount = 0;
    const halfL = this.wheelbase / 2;
    this.rearX = x - halfL * Math.sin(heading);
    this.rearZ = z - halfL * Math.cos(heading);
  }

  public update(inputs: VehicleInputs, dt: number, obstacles: ObstacleBox[]): { hadCollision: boolean } {
    // 1. Update Steering Angle smoothly
    const targetSteer = inputs.steer * this.maxSteerAngle;
    const steerDiff = targetSteer - this.state.steeringAngle;
    const maxSteerDelta = this.steerRate * dt;

    if (Math.abs(steerDiff) <= maxSteerDelta) {
      this.state.steeringAngle = targetSteer;
    } else {
      this.state.steeringAngle += Math.sign(steerDiff) * maxSteerDelta;
    }

    // 2. Simplified Driving Control:
    // - Up button (inputs.forward): Accelerate forward (gear = D)
    // - Down button (inputs.reverse): Accelerate reverse (gear = R)
    // - Releasing: Smooth auto-braking to stop
    // - Park (inputs.park): Locked in P
    if (inputs.park) {
      this.state.gear = 'P';
      this.state.speed = 0;
      this.state.brakeLight = true;
      this.state.reverseLight = false;
    } else if (inputs.forward && !inputs.reverse) {
      this.state.gear = 'D';
      this.state.reverseLight = false;
      this.state.brakeLight = false;

      // If moving backward, apply quick braking first
      if (this.state.speed < 0) {
        this.state.speed = Math.min(0, this.state.speed + 6.0 * dt);
      } else {
        // Accelerate forward
        this.state.speed = Math.min(this.maxForwardSpeed, this.state.speed + this.forwardAccel * dt);
      }
    } else if (inputs.reverse && !inputs.forward) {
      this.state.gear = 'R';
      this.state.reverseLight = true;
      this.state.brakeLight = false;

      // If moving forward, apply quick braking first
      if (this.state.speed > 0) {
        this.state.speed = Math.max(0, this.state.speed - 6.0 * dt);
      } else {
        // Accelerate backward (negative speed)
        this.state.speed = Math.max(-this.maxReverseSpeed, this.state.speed - this.reverseAccel * dt);
      }
    } else {
      // Key released: Smooth auto-brake to halt
      this.state.brakeLight = Math.abs(this.state.speed) > 0.1;
      this.state.reverseLight = this.state.gear === 'R';

      if (Math.abs(this.state.speed) > 0.05) {
        const sign = Math.sign(this.state.speed);
        this.state.speed -= sign * this.autoBrakeDecel * dt;
        if (Math.sign(this.state.speed) !== sign) {
          this.state.speed = 0;
        }
      } else {
        this.state.speed = 0;
      }
    }

    // 3. Exact Kinematic Bicycle Motion Update (Non-holonomic Rear Axle)
    // Turning circle direction strictly matches steering wheel:
    const angularVelocity = -(this.state.speed / this.wheelbase) * Math.tan(this.state.steeringAngle);
    const newHeading = this.state.heading + angularVelocity * dt;
    const midHeading = (this.state.heading + newHeading) / 2;

    // Movement of rear axle along vehicle heading (strictly 0 lateral slip):
    const dxRear = this.state.speed * Math.sin(midHeading) * dt;
    const dzRear = this.state.speed * Math.cos(midHeading) * dt;

    const prevX = this.state.x;
    const prevZ = this.state.z;
    const prevHeading = this.state.heading;
    const prevRearX = this.rearX;
    const prevRearZ = this.rearZ;

    this.rearX += dxRear;
    this.rearZ += dzRear;
    this.state.heading = newHeading;

    // Center of car body (wheelbase / 2 forward of rear axle):
    const halfL = this.wheelbase / 2;
    this.state.x = this.rearX + halfL * Math.sin(newHeading);
    this.state.z = this.rearZ + halfL * Math.cos(newHeading);

    // Wheel rolling rotation
    const wheelRadius = 0.33;
    this.state.wheelRotation += (this.state.speed / wheelRadius) * dt;

    // Engine RPM calculation for sound and dashboard gauge
    const baseRPM = 800;
    const speedFactor = Math.abs(this.state.speed) * 400;
    const driveFactor = (inputs.forward || inputs.reverse) ? 700 : 0;
    this.state.engineRPM = Math.round(baseRPM + speedFactor + driveFactor);

    // Keep the body level fore/aft while accelerating or reversing.
    this.state.pitch = 0;
    const targetRoll = -this.state.steeringAngle * Math.min(1, Math.abs(this.state.speed) / 2) * 0.03;
    this.state.roll += (targetRoll - this.state.roll) * 8 * dt;

    // 4. Collision Detection & Resolution
    let hadCollision = false;
    const corners = this.getCarCorners();

    for (const obs of obstacles) {
      if (this.checkCollisionWithObstacle(corners, obs)) {
        hadCollision = true;
        this.collisionCount++;
        this.lastImpactTime = performance.now();

        // Halt and restore pre-collision position
        this.state.x = prevX;
        this.state.z = prevZ;
        this.state.heading = prevHeading;
        this.rearX = prevRearX;
        this.rearZ = prevRearZ;
        this.state.speed = -this.state.speed * 0.2;
        break;
      }
    }

    // 5. Update Ultrasonic Sonar Sensors
    this.updateSonarSensors(obstacles);

    return { hadCollision };
  }

  public getCarCorners(): { x: number; z: number }[] {
    const halfW = this.carWidth / 2;
    const frontDist = this.carLength / 2;
    const rearDist = this.carLength / 2;

    const cosH = Math.cos(this.state.heading);
    const sinH = Math.sin(this.state.heading);

    const corners = [
      // Front-Left
      {
        x: this.state.x + frontDist * sinH - halfW * cosH,
        z: this.state.z + frontDist * cosH + halfW * sinH,
      },
      // Front-Right
      {
        x: this.state.x + frontDist * sinH + halfW * cosH,
        z: this.state.z + frontDist * cosH - halfW * sinH,
      },
      // Rear-Right
      {
        x: this.state.x - rearDist * sinH + halfW * cosH,
        z: this.state.z - rearDist * cosH - halfW * sinH,
      },
      // Rear-Left
      {
        x: this.state.x - rearDist * sinH - halfW * cosH,
        z: this.state.z - rearDist * cosH + halfW * sinH,
      },
    ];

    return corners;
  }

  private checkCollisionWithObstacle(corners: { x: number; z: number }[], obs: ObstacleBox): boolean {
    const minCarX = Math.min(...corners.map((c) => c.x));
    const maxCarX = Math.max(...corners.map((c) => c.x));
    const minCarZ = Math.min(...corners.map((c) => c.z));
    const maxCarZ = Math.max(...corners.map((c) => c.z));

    if (maxCarX < obs.minX || minCarX > obs.maxX || maxCarZ < obs.minZ || minCarZ > obs.maxZ) {
      return false;
    }

    for (const c of corners) {
      if (c.x >= obs.minX && c.x <= obs.maxX && c.z >= obs.minZ && c.z <= obs.maxZ) {
        return true;
      }
    }

    const obsCorners = [
      { x: obs.minX, z: obs.minZ },
      { x: obs.maxX, z: obs.minZ },
      { x: obs.maxX, z: obs.maxZ },
      { x: obs.minX, z: obs.maxZ },
    ];

    for (const oc of obsCorners) {
      if (this.isPointInPolygon(oc, corners)) {
        return true;
      }
    }

    return false;
  }

  private isPointInPolygon(point: { x: number; z: number }, poly: { x: number; z: number }[]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, zi = poly[i].z;
      const xj = poly[j].x, zj = poly[j].z;

      const intersect = ((zi > point.z) !== (zj > point.z)) &&
        (point.x < ((xj - xi) * (point.z - zi)) / (zj - zi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private updateSonarSensors(obstacles: ObstacleBox[]) {
    const sinH = Math.sin(this.state.heading);
    const cosH = Math.cos(this.state.heading);
    const rightX = cosH;
    const rightZ = -sinH;

    const halfW = this.carWidth / 2;
    const rearDist = this.carLength / 2;
    const frontDist = this.carLength / 2;

    const rearCenterPos = {
      x: this.state.x - rearDist * sinH,
      z: this.state.z - rearDist * cosH,
    };
    const rearLeftPos = {
      x: rearCenterPos.x - (halfW * 0.75) * rightX,
      z: rearCenterPos.z - (halfW * 0.75) * rightZ,
    };
    const rearRightPos = {
      x: rearCenterPos.x + (halfW * 0.75) * rightX,
      z: rearCenterPos.z + (halfW * 0.75) * rightZ,
    };

    const frontCenterPos = {
      x: this.state.x + frontDist * sinH,
      z: this.state.z + frontDist * cosH,
    };
    const frontLeftPos = {
      x: frontCenterPos.x - (halfW * 0.75) * rightX,
      z: frontCenterPos.z - (halfW * 0.75) * rightZ,
    };
    const frontRightPos = {
      x: frontCenterPos.x + (halfW * 0.75) * rightX,
      z: frontCenterPos.z + (halfW * 0.75) * rightZ,
    };

    const maxRay = 5.0;

    const castRay = (origin: { x: number; z: number }, dirX: number, dirZ: number): number => {
      let minD = maxRay;
      for (const obs of obstacles) {
        for (let d = 0.1; d < minD; d += 0.08) {
          const px = origin.x + dirX * d;
          const pz = origin.z + dirZ * d;
          if (px >= obs.minX && px <= obs.maxX && pz >= obs.minZ && pz <= obs.maxZ) {
            minD = d;
            break;
          }
        }
      }
      return minD;
    };

    this.sonar.rearCenter = castRay(rearCenterPos, -sinH, -cosH);
    this.sonar.rearLeft = castRay(rearLeftPos, -sinH - 0.25 * rightX, -cosH - 0.25 * rightZ);
    this.sonar.rearRight = castRay(rearRightPos, -sinH + 0.25 * rightX, -cosH + 0.25 * rightZ);

    this.sonar.frontCenter = castRay(frontCenterPos, sinH, cosH);
    this.sonar.frontLeft = castRay(frontLeftPos, sinH - 0.25 * rightX, cosH - 0.25 * rightZ);
    this.sonar.frontRight = castRay(frontRightPos, sinH + 0.25 * rightX, cosH + 0.25 * rightZ);

    this.sonar.closestDistance = Math.min(
      this.sonar.rearLeft,
      this.sonar.rearCenter,
      this.sonar.rearRight,
      this.sonar.frontLeft,
      this.sonar.frontCenter,
      this.sonar.frontRight
    );
  }
}
