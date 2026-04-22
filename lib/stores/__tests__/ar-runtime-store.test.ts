import { useARRuntimeStore } from '../ar-runtime-store';
import { DEFAULT_AR_SENSOR_RUNTIME_STATE } from '@/lib/core/ar-session';

describe('useARRuntimeStore', () => {
  beforeEach(() => {
    useARRuntimeStore.setState({
      sensor: DEFAULT_AR_SENSOR_RUNTIME_STATE,
    });
  });

  it('keeps the sensor slice stable when runtime values do not change', () => {
    const before = useARRuntimeStore.getState().sensor;

    useARRuntimeStore.getState().setSensorRuntime({
      isSupported: before.isSupported,
      isPermissionGranted: before.isPermissionGranted,
      status: before.status,
      calibrationRequired: before.calibrationRequired,
      degradedReason: before.degradedReason,
      source: before.source,
      accuracyDeg: before.accuracyDeg,
      error: before.error,
    });

    const after = useARRuntimeStore.getState().sensor;

    expect(after).toBe(before);
  });
});
