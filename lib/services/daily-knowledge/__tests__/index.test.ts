/**
 * @jest-environment node
 */

import * as barrel from '../index';
import * as constants from '../constants';
import * as service from '../service';
import * as sourceRegistry from '../source-registry';

describe('daily-knowledge index barrel', () => {
  it('re-exports the runtime values from the daily knowledge submodules', () => {
    const runtimeExports = {
      ...constants,
      ...service,
      ...sourceRegistry,
    };

    for (const [name, value] of Object.entries(runtimeExports)) {
      expect(barrel).toHaveProperty(name, value);
    }
  });
});
