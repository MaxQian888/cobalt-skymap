import * as plateSolving from '../index';
import { AstrometryApiClient } from '../astrometry-api';
import { parseFITSHeader } from '../fits-parser';
import { compressImage } from '../image-utils';
import { createInitialOnlineSolveSessionState } from '../online-solve-contract';
import { getProgressText } from '../solve-utils';
import { createErrorResult } from '../types';
import { createWCSTransform } from '../wcs-transform';

describe('plate-solving index exports', () => {
  it('re-exports runtime APIs from each module', () => {
    expect(plateSolving.createErrorResult).toBe(createErrorResult);
    expect(plateSolving.AstrometryApiClient).toBe(AstrometryApiClient);
    expect(plateSolving.parseFITSHeader).toBe(parseFITSHeader);
    expect(plateSolving.compressImage).toBe(compressImage);
    expect(plateSolving.createInitialOnlineSolveSessionState).toBe(createInitialOnlineSolveSessionState);
    expect(plateSolving.getProgressText).toBe(getProgressText);
    expect(plateSolving.createWCSTransform).toBe(createWCSTransform);
  });
});
