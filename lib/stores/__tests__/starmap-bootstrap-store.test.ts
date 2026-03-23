/**
 * @jest-environment jsdom
 */

import { useStarmapBootstrapStore } from '../starmap-bootstrap-store';

describe('useStarmapBootstrapStore', () => {
  beforeEach(() => {
    useStarmapBootstrapStore.getState().reset();
  });

  it('starts bootstrap session and keeps idempotent in-flight lock', () => {
    const firstSession = useStarmapBootstrapStore.getState().beginSession();
    const secondSession = useStarmapBootstrapStore.getState().beginSession();
    const state = useStarmapBootstrapStore.getState();

    expect(firstSession).toBeTruthy();
    expect(secondSession).toBe(firstSession);
    expect(state.outcome).toBe('bootstrapping');
    expect(state.inFlight).toBe(true);
    expect(state.resources.engine_core.state).toBe('pending');
    expect(state.resources.settings_snapshot.state).toBe('pending');
    expect(state.resources.cache_index.state).toBe('pending');
  });

  it('transitions to ready when all critical resources are ready', () => {
    const store = useStarmapBootstrapStore.getState();
    store.beginSession();
    store.markResourceReady('engine_core');
    store.markResourceReady('settings_snapshot');
    store.markResourceReady('cache_index');

    const state = useStarmapBootstrapStore.getState();
    expect(state.outcome).toBe('ready');
    expect(state.inFlight).toBe(false);
  });

  it('transitions to failed when a critical resource fails before any critical resource is ready', () => {
    const store = useStarmapBootstrapStore.getState();
    store.beginSession();
    store.markResourceFailed('engine_core', 'engine_init_failed');

    const state = useStarmapBootstrapStore.getState();
    expect(state.outcome).toBe('failed');
    expect(state.resources.engine_core.state).toBe('failed');
    expect(state.resources.engine_core.lastError).toBe('engine_init_failed');
  });

  it('transitions to degraded when at least one critical resource is ready and another critical resource fails', () => {
    const store = useStarmapBootstrapStore.getState();
    store.beginSession();
    store.markResourceReady('settings_snapshot');
    store.markResourceFailed('engine_core', 'engine_timeout');

    const state = useStarmapBootstrapStore.getState();
    expect(state.outcome).toBe('degraded');
    expect(state.resources.settings_snapshot.state).toBe('ready');
    expect(state.resources.engine_core.state).toBe('failed');
  });

  it('treats optional metadata failure as degraded after core readiness is reached', () => {
    const store = useStarmapBootstrapStore.getState();
    store.beginSession();
    store.markResourceReady('engine_core');
    store.markResourceReady('settings_snapshot');
    store.markResourceReady('cache_index');
    store.markResourceFailed('online_metadata', 'provider_timeout');

    const state = useStarmapBootstrapStore.getState();
    expect(state.outcome).toBe('degraded');
    expect(state.resources.online_metadata.state).toBe('failed');
    expect(state.inFlight).toBe(false);
  });

  it('records retry metadata and allows recovery request to restart unfinished resources', () => {
    const store = useStarmapBootstrapStore.getState();
    store.beginSession();
    store.markResourceLoading('engine_core');
    store.markResourceRetry('engine_core', 2, 'script_timeout');
    store.markResourceFailed('engine_core', 'script_timeout');

    const nonce = store.requestRecovery();
    const state = useStarmapBootstrapStore.getState();
    const retryDiagnostic = state.diagnostics.find((item) => item.event === 'resource_retry');

    expect(nonce).toBe(1);
    expect(state.recoveryNonce).toBe(1);
    expect(state.outcome).toBe('bootstrapping');
    expect(state.resources.engine_core.state).toBe('pending');
    expect(retryDiagnostic?.attempt).toBe(2);
    expect(retryDiagnostic?.reason).toBe('script_timeout');
  });
});
