/**
 * @jest-environment node
 */

import * as barrel from '../index';
import * as service from '../service';

describe('hips index barrel', () => {
  it('re-exports the runtime helpers from the service module', () => {
    for (const [name, value] of Object.entries(service)) {
      expect(barrel).toHaveProperty(name, value);
    }
  });
});
