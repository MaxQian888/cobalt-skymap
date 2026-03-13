import { executeARRecoveryAction, type ARRecoveryActionHandlers } from '../ar-recovery-actions';

describe('executeARRecoveryAction', () => {
  function createHandlers(overrides: Partial<ARRecoveryActionHandlers> = {}): ARRecoveryActionHandlers {
    return {
      onRetryCamera: jest.fn(),
      onSwitchCamera: jest.fn(),
      onRequestSensorPermission: jest.fn(),
      onCalibrateSensor: jest.fn(),
      onOpenCameraSettings: jest.fn(),
      onRevertLastKnownGoodProfile: jest.fn(),
      onDisableAr: jest.fn(),
      ...overrides,
    };
  }

  it('executes matching handler and calls onSuccess', async () => {
    const handlers = createHandlers();
    const onSuccess = jest.fn();

    const ok = await executeARRecoveryAction('retry-camera', handlers, { onSuccess });

    expect(ok).toBe(true);
    expect(handlers.onRetryCamera).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith('retry-camera');
  });

  it('awaits async handlers before returning', async () => {
    const handlers = createHandlers({
      onRequestSensorPermission: jest.fn().mockResolvedValue(undefined),
    });

    const ok = await executeARRecoveryAction('request-sensor-permission', handlers);

    expect(ok).toBe(true);
    expect(handlers.onRequestSensorPermission).toHaveBeenCalledTimes(1);
  });

  it('returns false and calls onError when handler throws', async () => {
    const handlers = createHandlers({
      onCalibrateSensor: jest.fn(() => {
        throw new Error('boom');
      }),
    });
    const onError = jest.fn();

    const ok = await executeARRecoveryAction('calibrate-sensor', handlers, { onError });

    expect(ok).toBe(false);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBe('calibrate-sensor');
  });
});
