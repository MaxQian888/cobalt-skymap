type SatelliteJsRuntime = {
  twoline2satrec: typeof import('../../node_modules/satellite.js/dist/io.js').twoline2satrec;
  json2satrec: typeof import('../../node_modules/satellite.js/dist/io.js').json2satrec;
  propagate: typeof import('../../node_modules/satellite.js/dist/propagation.js').propagate;
  sgp4: typeof import('../../node_modules/satellite.js/dist/propagation.js').sgp4;
  gstime: typeof import('../../node_modules/satellite.js/dist/propagation.js').gstime;
  radiansToDegrees: typeof import('../../node_modules/satellite.js/dist/transforms.js').radiansToDegrees;
  degreesToRadians: typeof import('../../node_modules/satellite.js/dist/transforms.js').degreesToRadians;
  degreesLat: typeof import('../../node_modules/satellite.js/dist/transforms.js').degreesLat;
  degreesLong: typeof import('../../node_modules/satellite.js/dist/transforms.js').degreesLong;
  radiansLat: typeof import('../../node_modules/satellite.js/dist/transforms.js').radiansLat;
  radiansLong: typeof import('../../node_modules/satellite.js/dist/transforms.js').radiansLong;
  geodeticToEcf: typeof import('../../node_modules/satellite.js/dist/transforms.js').geodeticToEcf;
  eciToGeodetic: typeof import('../../node_modules/satellite.js/dist/transforms.js').eciToGeodetic;
  eciToEcf: typeof import('../../node_modules/satellite.js/dist/transforms.js').eciToEcf;
  ecfToEci: typeof import('../../node_modules/satellite.js/dist/transforms.js').ecfToEci;
  ecfToLookAngles: typeof import('../../node_modules/satellite.js/dist/transforms.js').ecfToLookAngles;
  SatRecError: typeof import('../../node_modules/satellite.js/dist/propagation/SatRec.js').SatRecError;
};

function loadRuntime(): SatelliteJsRuntime {
  if (process.env.JEST_WORKER_ID) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../../__mocks__/satellite-js-v7.js') as SatelliteJsRuntime;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const io = require('../../node_modules/satellite.js/dist/io.js') as typeof import('../../node_modules/satellite.js/dist/io.js');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const propagation = require('../../node_modules/satellite.js/dist/propagation.js') as typeof import('../../node_modules/satellite.js/dist/propagation.js');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const transforms = require('../../node_modules/satellite.js/dist/transforms.js') as typeof import('../../node_modules/satellite.js/dist/transforms.js');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const satRec = require('../../node_modules/satellite.js/dist/propagation/SatRec.js') as typeof import('../../node_modules/satellite.js/dist/propagation/SatRec.js');

  return {
    ...io,
    ...propagation,
    ...transforms,
    ...satRec,
  };
}

const runtime = loadRuntime();

export const {
  twoline2satrec,
  json2satrec,
  propagate,
  sgp4,
  gstime,
  radiansToDegrees,
  degreesToRadians,
  degreesLat,
  degreesLong,
  radiansLat,
  radiansLong,
  geodeticToEcf,
  eciToGeodetic,
  eciToEcf,
  ecfToEci,
  ecfToLookAngles,
  SatRecError,
} = runtime;

export type {
  EciVec3,
  GeodeticLocation,
  LookAngles,
  PositionAndVelocity,
} from '../../node_modules/satellite.js/dist/common-types.js';
export type { SatRec } from '../../node_modules/satellite.js/dist/propagation/SatRec.js';
