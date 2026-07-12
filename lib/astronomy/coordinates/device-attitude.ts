/**
 * Device attitude conversion utilities.
 *
 * Converts W3C deviceorientation Euler angles (Z-X'-Y'') to
 * sky horizontal coordinates (Az/Alt) using an Earth frame where:
 * - x: East
 * - y: North
 * - z: Up
 */

import { deg2rad, rad2deg } from './conversions';

export interface DeviceEulerAngles {
  alphaDeg: number;
  betaDeg: number;
  gammaDeg: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface SkyDirection {
  azimuth: number;
  altitude: number;
}

export type CameraFacing = 'environment' | 'user';

// Rear camera looks out of the back of the device (device-frame -Z);
// front camera looks out of the screen (device-frame +Z).
const DEVICE_CAMERA_FORWARD: Vector3 = { x: 0, y: 0, z: -1 };
const DEVICE_FRONT_CAMERA_FORWARD: Vector3 = { x: 0, y: 0, z: 1 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeAngle360(angleDeg: number): number {
  return ((angleDeg % 360) + 360) % 360;
}

export function normalizeAngleSigned180(angleDeg: number): number {
  let angle = normalizeAngle360(angleDeg);
  if (angle > 180) angle -= 360;
  return angle;
}

export function createQuaternionFromEulerZXY({
  alphaDeg,
  betaDeg,
  gammaDeg,
}: DeviceEulerAngles): Quaternion {
  const alpha = deg2rad(alphaDeg);
  const beta = deg2rad(betaDeg);
  const gamma = deg2rad(gammaDeg);

  const cosZ = Math.cos(0.5 * alpha);
  const sinZ = Math.sin(0.5 * alpha);
  const cosX = Math.cos(0.5 * beta);
  const sinX = Math.sin(0.5 * beta);
  const cosY = Math.cos(0.5 * gamma);
  const sinY = Math.sin(0.5 * gamma);

  return {
    x: sinX * cosY * cosZ - cosX * sinY * sinZ,
    y: cosX * sinY * cosZ + sinX * cosY * sinZ,
    z: cosX * cosY * sinZ + sinX * sinY * cosZ,
    w: cosX * cosY * cosZ - sinX * sinY * sinZ,
  };
}

function multiplyQuaternion(a: Quaternion, b: Quaternion): Quaternion {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

function conjugateQuaternion(q: Quaternion): Quaternion {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

export function rotateVectorByQuaternion(vector: Vector3, q: Quaternion): Vector3 {
  const vq = { x: vector.x, y: vector.y, z: vector.z, w: 0 };
  const rotated = multiplyQuaternion(multiplyQuaternion(q, vq), conjugateQuaternion(q));
  return { x: rotated.x, y: rotated.y, z: rotated.z };
}

export function applyScreenOrientationCompensation(
  vector: Vector3,
  screenAngleDeg: number
): Vector3 {
  const angle = deg2rad(screenAngleDeg);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // Equivalent to a rotation around Z by -screenAngle
  return {
    x: vector.x * cos + vector.y * sin,
    y: -vector.x * sin + vector.y * cos,
    z: vector.z,
  };
}

export function deviceEulerToForwardVector(
  euler: DeviceEulerAngles,
  screenAngleDeg: number,
  cameraFacing: CameraFacing = 'environment'
): Vector3 {
  const orientation = createQuaternionFromEulerZXY(euler);
  const deviceForward = cameraFacing === 'user'
    ? DEVICE_FRONT_CAMERA_FORWARD
    : DEVICE_CAMERA_FORWARD;
  const forward = rotateVectorByQuaternion(deviceForward, orientation);
  return applyScreenOrientationCompensation(forward, screenAngleDeg);
}

export function forwardVectorToSkyDirection(vector: Vector3): SkyDirection {
  const z = clamp(vector.z, -1, 1);
  const altitude = rad2deg(Math.asin(-z));
  const azimuth = normalizeAngle360(rad2deg(Math.atan2(vector.x, vector.y)));
  return { azimuth, altitude };
}

export function deviceEulerToSkyDirection(
  euler: DeviceEulerAngles,
  screenAngleDeg: number,
  cameraFacing: CameraFacing = 'environment'
): SkyDirection {
  const vector = deviceEulerToForwardVector(euler, screenAngleDeg, cameraFacing);
  return forwardVectorToSkyDirection(vector);
}

