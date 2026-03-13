/**
 * @jest-environment node
 */

import * as engineTypes from '../types';

describe('engine types runtime module', () => {
  it('stays value-empty because it only provides TypeScript contracts', () => {
    expect(engineTypes).toEqual({});
  });
});
