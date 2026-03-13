/**
 * @jest-environment node
 */

import * as aggregator from '../aggregator';
import * as comet from '../comet';
import * as eclipse from '../eclipse';
import * as barrel from '../index';
import * as lunar from '../lunar';
import * as meteor from '../meteor';

describe('astro-events index barrel', () => {
  it('re-exports the runtime helpers from each submodule', () => {
    const runtimeExports = {
      ...lunar,
      ...meteor,
      ...eclipse,
      ...comet,
      ...aggregator,
    };

    for (const [name, value] of Object.entries(runtimeExports)) {
      expect(barrel).toHaveProperty(name, value);
    }
  });
});
