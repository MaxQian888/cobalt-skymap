import * as barrel from '../index';
import * as celestrakService from '../celestrak-service';
import * as dataSources from '../data-sources';
import * as passes from '../passes';
import * as propagator from '../propagator';

describe('satellite index barrel', () => {
  it('re-exports the runtime helpers from each satellite submodule', () => {
    const runtimeExports = {
      ...propagator,
      ...dataSources,
      ...passes,
      ...celestrakService,
    };

    for (const [name, value] of Object.entries(runtimeExports)) {
      expect(barrel).toHaveProperty(name, value);
    }
  });
});
