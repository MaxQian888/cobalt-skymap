import type { ARRecoveryAction } from '@/lib/core/ar-session';

export interface ARRecoveryActionHandlers {
  onRetryCamera: () => void | Promise<void>;
  onSwitchCamera: () => void | Promise<void>;
  onRequestSensorPermission: () => void | Promise<void>;
  onCalibrateSensor: () => void | Promise<void>;
  onOpenCameraSettings: () => void | Promise<void>;
  onRevertLastKnownGoodProfile: () => void | Promise<void>;
  onDisableAr: () => void | Promise<void>;
}

export interface ExecuteARRecoveryActionOptions {
  onSuccess?: (action: ARRecoveryAction) => void;
  onError?: (action: ARRecoveryAction, error: unknown) => void;
}

export async function executeARRecoveryAction(
  action: ARRecoveryAction,
  handlers: ARRecoveryActionHandlers,
  options?: ExecuteARRecoveryActionOptions,
): Promise<boolean> {
  try {
    if (action === 'retry-camera') {
      await Promise.resolve(handlers.onRetryCamera());
      options?.onSuccess?.(action);
      return true;
    }
    if (action === 'switch-camera') {
      await Promise.resolve(handlers.onSwitchCamera());
      options?.onSuccess?.(action);
      return true;
    }
    if (action === 'request-sensor-permission') {
      await Promise.resolve(handlers.onRequestSensorPermission());
      options?.onSuccess?.(action);
      return true;
    }
    if (action === 'calibrate-sensor') {
      await Promise.resolve(handlers.onCalibrateSensor());
      options?.onSuccess?.(action);
      return true;
    }
    if (action === 'open-camera-settings') {
      await Promise.resolve(handlers.onOpenCameraSettings());
      options?.onSuccess?.(action);
      return true;
    }
    if (action === 'revert-last-known-good-profile') {
      await Promise.resolve(handlers.onRevertLastKnownGoodProfile());
      options?.onSuccess?.(action);
      return true;
    }
    await Promise.resolve(handlers.onDisableAr());
    options?.onSuccess?.(action);
    return true;
  } catch (error) {
    options?.onError?.(action, error);
    return false;
  }
}
