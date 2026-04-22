const EARTH_RADIUS_KM = 6371;
const DEFAULT_ALTITUDE_KM = 420;
const DEFAULT_VELOCITY_KM_S = 7.66;
const DEFAULT_INCLINATION_RAD = 51.6 * Math.PI / 180;

function degreesToRadians(degrees) {
  return degrees * Math.PI / 180;
}

function radiansToDegrees(radians) {
  return radians * 180 / Math.PI;
}

function normalizeAngle(angle) {
  const tau = Math.PI * 2;
  const normalized = angle % tau;
  return normalized < 0 ? normalized + tau : normalized;
}

function twoline2satrec(line1, line2) {
  const satnum = /^1\s+(\d+)/.exec(line1)?.[1] ?? '00000';
  const meanMotionRaw = Number.parseFloat(line2.slice(52, 63));

  return {
    satnum,
    no: Number.isFinite(meanMotionRaw) ? meanMotionRaw : Number.NaN,
    line1,
    line2,
    error: 0,
  };
}

function gstime(date) {
  const dayFraction = ((date.getUTCHours() * 3600) + (date.getUTCMinutes() * 60) + date.getUTCSeconds()) / 86400;
  return normalizeAngle(dayFraction * Math.PI * 2);
}

function propagate(satrec, date) {
  if (!satrec || Number.isNaN(satrec.no)) {
    return {
      position: { x: Number.NaN, y: Number.NaN, z: Number.NaN },
      velocity: { x: Number.NaN, y: Number.NaN, z: Number.NaN },
    };
  }

  const minutes = date.getTime() / 60000;
  const orbitalRate = (satrec.no || 15) * Math.PI * 2 / 1440;
  const angle = normalizeAngle(minutes * orbitalRate);
  const orbitalRadius = EARTH_RADIUS_KM + DEFAULT_ALTITUDE_KM;

  const position = {
    x: orbitalRadius * Math.cos(angle),
    y: orbitalRadius * Math.sin(angle) * Math.cos(DEFAULT_INCLINATION_RAD),
    z: orbitalRadius * Math.sin(angle) * Math.sin(DEFAULT_INCLINATION_RAD),
  };

  const velocity = {
    x: -DEFAULT_VELOCITY_KM_S * Math.sin(angle),
    y: DEFAULT_VELOCITY_KM_S * Math.cos(angle) * Math.cos(DEFAULT_INCLINATION_RAD),
    z: DEFAULT_VELOCITY_KM_S * Math.cos(angle) * Math.sin(DEFAULT_INCLINATION_RAD),
  };

  return { position, velocity };
}

function eciToEcf(position, gmst) {
  const cosGmst = Math.cos(gmst);
  const sinGmst = Math.sin(gmst);

  return {
    x: position.x * cosGmst + position.y * sinGmst,
    y: -position.x * sinGmst + position.y * cosGmst,
    z: position.z,
  };
}

function eciToGeodetic(position, gmst) {
  const ecf = eciToEcf(position, gmst);
  const longitude = normalizeAngle(Math.atan2(ecf.y, ecf.x) + Math.PI) - Math.PI;
  const radius = Math.sqrt(ecf.x ** 2 + ecf.y ** 2);
  const latitude = Math.atan2(ecf.z, radius);
  const height = Math.sqrt(ecf.x ** 2 + ecf.y ** 2 + ecf.z ** 2) - EARTH_RADIUS_KM;

  return {
    longitude,
    latitude,
    height,
  };
}

function ecfToLookAngles(observerGd, positionEcf) {
  const observerRadius = EARTH_RADIUS_KM + (observerGd.height ?? 0);
  const cosLat = Math.cos(observerGd.latitude);
  const sinLat = Math.sin(observerGd.latitude);
  const cosLon = Math.cos(observerGd.longitude);
  const sinLon = Math.sin(observerGd.longitude);

  const observerEcf = {
    x: observerRadius * cosLat * cosLon,
    y: observerRadius * cosLat * sinLon,
    z: observerRadius * sinLat,
  };

  const dx = positionEcf.x - observerEcf.x;
  const dy = positionEcf.y - observerEcf.y;
  const dz = positionEcf.z - observerEcf.z;

  const east = -sinLon * dx + cosLon * dy;
  const north = -sinLat * cosLon * dx - sinLat * sinLon * dy + cosLat * dz;
  const up = cosLat * cosLon * dx + cosLat * sinLon * dy + sinLat * dz;
  const rangeSat = Math.sqrt(dx ** 2 + dy ** 2 + dz ** 2);

  return {
    azimuth: normalizeAngle(Math.atan2(east, north)),
    elevation: Math.asin(up / Math.max(rangeSat, 1)),
    rangeSat,
  };
}

module.exports = {
  twoline2satrec,
  json2satrec: twoline2satrec,
  propagate,
  sgp4: propagate,
  gstime,
  eciToGeodetic,
  degreesToRadians,
  radiansToDegrees,
  degreesLat: radiansToDegrees,
  degreesLong: radiansToDegrees,
  radiansLat: degreesToRadians,
  radiansLong: degreesToRadians,
  geodeticToEcf: () => ({ x: 0, y: 0, z: 0 }),
  eciToEcf,
  ecfToEci: (value) => value,
  ecfToLookAngles,
  SatRecError: {
    None: 0,
    Decayed: 6,
  },
};
