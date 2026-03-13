/**
 * @jest-environment node
 */

import * as core from '../index';
import * as constants from '../constants';
import { normalizeCameras, normalizeTelescopes } from '../equipment-normalize';
import {
  validateCameraForm,
  validateLocationForm,
  validateTelescopeForm,
} from '../management-validators';
import { getCanonicalResultId, getLegacyResultId, getResultId } from '../search-utils';
import { buildSelectionData } from '../selection-utils';

describe('core index barrel', () => {
  it('re-exports the shared runtime helpers', () => {
    expect(core.normalizeTelescopes).toBe(normalizeTelescopes);
    expect(core.normalizeCameras).toBe(normalizeCameras);
    expect(core.validateTelescopeForm).toBe(validateTelescopeForm);
    expect(core.validateCameraForm).toBe(validateCameraForm);
    expect(core.validateLocationForm).toBe(validateLocationForm);
    expect(core.getResultId).toBe(getResultId);
    expect(core.getCanonicalResultId).toBe(getCanonicalResultId);
    expect(core.getLegacyResultId).toBe(getLegacyResultId);
    expect(core.buildSelectionData).toBe(buildSelectionData);
  });

  it('re-exports the constants barrel through the root core entrypoint', () => {
    expect(core.BORTLE_SCALE).toBe(constants.BORTLE_SCALE);
    expect(core.DEFAULT_FOV).toBe(constants.DEFAULT_FOV);
    expect(core.getDefaultSurvey).toBe(constants.getDefaultSurvey);
    expect(core.MAX_RETRY_COUNT).toBe(constants.MAX_RETRY_COUNT);
  });
});
