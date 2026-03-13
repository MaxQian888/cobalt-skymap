import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getZustandStorage } from '@/lib/storage';
import { createLogger } from '@/lib/logger';
import {
  DEFAULT_CONNECTION_REQUIRED_DEVICE_TYPES,
  DEFAULT_REQUIRED_SESSION_DEVICE_TYPES,
  evaluateDeviceReadiness,
  type EvaluateDeviceReadinessInput,
} from '@/lib/core/device-readiness';
import {
  normalizeLegacyEquipmentProfiles,
  normalizePersistedDeviceProfiles,
} from '@/lib/core/device-profile-normalize';
import {
  validateDeviceProfile,
  type DeviceProfileValidationIssue,
} from '@/lib/core/device-profile-validation';
import type {
  DeviceProfile,
  DeviceType,
  DeviceConnectionState,
  DeviceConnectionLifecycle,
  DeviceConnectionTrigger,
  DeviceConnectionError,
  DeviceConnectionEvent,
  DeviceReadiness,
  DeviceProfileSource,
} from '@/lib/core/types/device';
import type {
  MountActionAvailability,
  MountCapabilitySnapshot,
  SupportedMountDevice,
} from '@/lib/core/types';
import {
  getAllCameras,
  getAllTelescopes,
  useEquipmentStore,
  type CameraPreset,
  type TelescopePreset,
} from '@/lib/stores/equipment-store';
import { useMountStore } from '@/lib/stores/mount-store';

const logger = createLogger('device-store');

const MAX_DIAGNOSTICS_PER_DEVICE = 100;
export const PRIMARY_MOUNT_DEVICE_PROFILE_ID = 'mount-primary';

interface TransitionContext {
  trigger: DeviceConnectionTrigger;
  error?: DeviceConnectionError;
  context?: string;
}

type TransitionMap = Record<DeviceConnectionLifecycle, DeviceConnectionLifecycle[]>;

const CONNECTION_TRANSITIONS: TransitionMap = {
  idle: ['connecting', 'connected', 'degraded', 'failed'],
  connecting: ['connected', 'degraded', 'failed', 'idle'],
  connected: ['degraded', 'failed', 'idle'],
  degraded: ['connected', 'failed', 'idle', 'connecting'],
  failed: ['connecting', 'idle'],
};

export interface DeviceEquipmentSnapshot {
  activeCameraId: string | null;
  activeTelescopeId: string | null;
  sensorWidth: number;
  sensorHeight: number;
  pixelSize: number;
  focalLength: number;
  aperture: number;
  customCameras: CameraPreset[];
  customTelescopes: TelescopePreset[];
}

export interface DeviceMountSnapshot {
  connected: boolean;
  protocol: 'alpaca' | 'simulator';
  host: string;
  port: number;
  deviceId: number;
  selectedDeviceId?: string | null;
  selectedDevice?: SupportedMountDevice;
  capabilitySnapshot?: Partial<MountCapabilitySnapshot>;
  actionAvailability?: Partial<MountActionAvailability>;
}

export interface DeviceProfileDraftInput {
  id?: string;
  name: string;
  type: DeviceType;
  source?: DeviceProfileSource;
  enabled?: boolean;
  linkedEntityId?: string;
  metadata: DeviceProfile['metadata'];
}

export interface DeviceStoreState {
  profiles: DeviceProfile[];
  connections: Record<string, DeviceConnectionState>;
  diagnostics: Record<string, DeviceConnectionEvent[]>;
  readiness: DeviceReadiness;
  requiredSessionDeviceTypes: DeviceType[];
  activeSessionProfileIds: string[];
  diagnosticsLimitPerProfile: number;

  createProfile: (input: DeviceProfileDraftInput) => {
    success: boolean;
    profile?: DeviceProfile;
    issues?: DeviceProfileValidationIssue[];
    error?: string;
  };
  updateProfile: (
    profileId: string,
    updates: Partial<Omit<DeviceProfile, 'id' | 'createdAt'>>,
  ) => {
    success: boolean;
    profile?: DeviceProfile;
    issues?: DeviceProfileValidationIssue[];
    error?: string;
  };
  setProfileEnabled: (profileId: string, enabled: boolean) => void;
  deleteProfile: (profileId: string, options?: { force?: boolean }) => {
    success: boolean;
    error?: string;
  };
  setActiveSessionProfileIds: (profileIds: string[]) => void;
  setRequiredSessionDeviceTypes: (types: DeviceType[]) => void;

  beginConnection: (profileId: string, trigger?: DeviceConnectionTrigger, context?: string) => void;
  markConnected: (profileId: string, trigger?: DeviceConnectionTrigger, context?: string) => void;
  markDegraded: (
    profileId: string,
    error: DeviceConnectionError,
    trigger?: DeviceConnectionTrigger,
    context?: string,
  ) => void;
  markFailed: (
    profileId: string,
    error: DeviceConnectionError,
    trigger?: DeviceConnectionTrigger,
    context?: string,
  ) => void;
  disconnectConnection: (profileId: string, trigger?: DeviceConnectionTrigger, context?: string) => void;
  retryConnection: (profileId: string, context?: string) => void;
  clearDiagnostics: (profileId?: string) => void;

  syncFromEquipmentStore: (snapshot?: DeviceEquipmentSnapshot) => void;
  syncFromMountStore: (snapshot?: DeviceMountSnapshot) => void;
  recomputeReadiness: (input?: Partial<Omit<EvaluateDeviceReadinessInput, 'profiles' | 'connections'>>) => DeviceReadiness;
  getSessionReadiness: (
    input?: Partial<Omit<EvaluateDeviceReadinessInput, 'profiles' | 'connections'>>,
  ) => DeviceReadiness;

  getProfilesByType: (type: DeviceType) => DeviceProfile[];
  getConnectionState: (profileId: string) => DeviceConnectionState | undefined;
  getLatestDiagnostics: (profileId: string, limit?: number) => DeviceConnectionEvent[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function toEventId(profileId: string): string {
  return `${profileId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function canTransition(from: DeviceConnectionLifecycle, to: DeviceConnectionLifecycle): boolean {
  return from === to || CONNECTION_TRANSITIONS[from].includes(to);
}

function buildInitialReadiness(): DeviceReadiness {
  return {
    state: 'blocked',
    issues: [],
    requiredTypes: [...DEFAULT_REQUIRED_SESSION_DEVICE_TYPES],
    checkedAt: nowIso(),
  };
}

function upsertProfiles(existing: DeviceProfile[], incoming: DeviceProfile[]): DeviceProfile[] {
  const map = new Map<string, DeviceProfile>();
  for (const profile of existing) {
    map.set(profile.id, profile);
  }
  for (const profile of incoming) {
    const previous = map.get(profile.id);
    map.set(profile.id, {
      ...(previous ?? profile),
      ...profile,
      createdAt: previous?.createdAt ?? profile.createdAt,
      updatedAt: profile.updatedAt,
    });
  }
  return Array.from(map.values());
}

function removeProfilesByPredicate(
  profiles: DeviceProfile[],
  predicate: (profile: DeviceProfile) => boolean,
): DeviceProfile[] {
  return profiles.filter((profile) => !predicate(profile));
}

function upsertConnectionTransition(
  state: DeviceStoreState,
  profileId: string,
  to: DeviceConnectionLifecycle,
  transition: TransitionContext,
): Pick<DeviceStoreState, 'connections' | 'diagnostics'> {
  const current = state.connections[profileId] ?? {
    profileId,
    state: 'idle',
    updatedAt: nowIso(),
    attempts: 0,
  };

  if (!canTransition(current.state, to)) {
    logger.warn('Rejected invalid device connection transition', {
      profileId,
      from: current.state,
      to,
      trigger: transition.trigger,
    });
    return {
      connections: state.connections,
      diagnostics: state.diagnostics,
    };
  }

  const timestamp = nowIso();
  const attempts = (
    to === 'connecting' && transition.trigger === 'user_retry'
      ? current.attempts + 1
      : current.attempts
  );

  const nextConnection: DeviceConnectionState = {
    ...current,
    profileId,
    state: to,
    attempts,
    updatedAt: timestamp,
    lastConnectedAt: to === 'connected' ? timestamp : current.lastConnectedAt,
    lastError: (to === 'failed' || to === 'degraded') ? transition.error : undefined,
    transition: {
      from: current.state,
      to,
      at: timestamp,
      trigger: transition.trigger,
    },
  };

  const nextEvents = [
    ...(state.diagnostics[profileId] ?? []),
    {
      id: toEventId(profileId),
      profileId,
      at: timestamp,
      from: current.state,
      to,
      trigger: transition.trigger,
      errorMessage: transition.error?.message,
      context: transition.context,
    } satisfies DeviceConnectionEvent,
  ];

  const diagnosticsLimit = state.diagnosticsLimitPerProfile > 0
    ? state.diagnosticsLimitPerProfile
    : MAX_DIAGNOSTICS_PER_DEVICE;

  return {
    connections: {
      ...state.connections,
      [profileId]: nextConnection,
    },
    diagnostics: {
      ...state.diagnostics,
      [profileId]: nextEvents.slice(-diagnosticsLimit),
    },
  };
}

function buildEquipmentSnapshotFromStore(): DeviceEquipmentSnapshot {
  const equipment = useEquipmentStore.getState();
  return {
    activeCameraId: equipment.activeCameraId,
    activeTelescopeId: equipment.activeTelescopeId,
    sensorWidth: equipment.sensorWidth,
    sensorHeight: equipment.sensorHeight,
    pixelSize: equipment.pixelSize,
    focalLength: equipment.focalLength,
    aperture: equipment.aperture,
    customCameras: equipment.customCameras,
    customTelescopes: equipment.customTelescopes,
  };
}

function buildMountSnapshotFromStore(): DeviceMountSnapshot {
  const mount = useMountStore.getState();
  return {
    connected: mount.mountInfo.Connected ?? false,
    protocol: mount.connectionConfig.protocol,
    host: mount.connectionConfig.host,
    port: mount.connectionConfig.port,
    deviceId: mount.connectionConfig.deviceId,
  };
}

function toCameraProfile(
  id: string,
  name: string,
  metadata: {
    sensorWidth: number;
    sensorHeight: number;
    pixelSize: number;
  },
  linkedEntityId?: string,
): DeviceProfile<'camera'> {
  const timestamp = nowIso();
  return {
    id,
    type: 'camera',
    name,
    source: 'equipment-store',
    enabled: true,
    linkedEntityId,
    metadata: {
      sensorWidth: metadata.sensorWidth,
      sensorHeight: metadata.sensorHeight,
      pixelSize: metadata.pixelSize,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    lastValidatedAt: timestamp,
    validationIssues: [],
  };
}

function toTelescopeProfile(
  id: string,
  name: string,
  metadata: {
    focalLength: number;
    aperture: number;
    design?: string;
  },
  linkedEntityId?: string,
): DeviceProfile<'telescope'> {
  const timestamp = nowIso();
  return {
    id,
    type: 'telescope',
    name,
    source: 'equipment-store',
    enabled: true,
    linkedEntityId,
    metadata: {
      focalLength: metadata.focalLength,
      aperture: metadata.aperture,
      design: metadata.design,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    lastValidatedAt: timestamp,
    validationIssues: [],
  };
}

function computeReadinessFromState(
  state: Pick<DeviceStoreState, 'profiles' | 'connections' | 'requiredSessionDeviceTypes'>,
  input?: Partial<Omit<EvaluateDeviceReadinessInput, 'profiles' | 'connections'>>,
): DeviceReadiness {
  return evaluateDeviceReadiness({
    profiles: state.profiles,
    connections: state.connections,
    requiredTypes: input?.requiredTypes ?? state.requiredSessionDeviceTypes,
    connectionRequiredTypes: input?.connectionRequiredTypes ?? DEFAULT_CONNECTION_REQUIRED_DEVICE_TYPES,
  });
}

export const useDeviceStore = create<DeviceStoreState>()(
  persist(
    (set, get) => ({
      profiles: [],
      connections: {},
      diagnostics: {},
      readiness: buildInitialReadiness(),
      requiredSessionDeviceTypes: [...DEFAULT_REQUIRED_SESSION_DEVICE_TYPES],
      activeSessionProfileIds: [],
      diagnosticsLimitPerProfile: MAX_DIAGNOSTICS_PER_DEVICE,

      createProfile: (input) => {
        const profileId = input.id ?? `${input.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const timestamp = nowIso();
        const draft: DeviceProfile = {
          id: profileId,
          name: input.name,
          type: input.type,
          source: input.source ?? 'manual',
          enabled: input.enabled ?? true,
          linkedEntityId: input.linkedEntityId,
          metadata: input.metadata,
          createdAt: timestamp,
          updatedAt: timestamp,
          lastValidatedAt: timestamp,
          validationIssues: [],
        };
        const validation = validateDeviceProfile(draft);
        if (!validation.valid) {
          return {
            success: false,
            issues: validation.issues,
            error: 'Device profile validation failed.',
          };
        }

        set((state) => {
          const profiles = upsertProfiles(state.profiles, [draft]);
          return {
            ...state,
            profiles,
            readiness: computeReadinessFromState({ ...state, profiles }),
          };
        });

        return {
          success: true,
          profile: draft,
        };
      },

      updateProfile: (profileId, updates) => {
        const existing = get().profiles.find((profile) => profile.id === profileId);
        if (!existing) {
          return {
            success: false,
            error: 'Profile not found.',
          };
        }

        const draft: DeviceProfile = {
          ...existing,
          ...updates,
          id: profileId,
          updatedAt: nowIso(),
          createdAt: existing.createdAt,
          metadata: (updates.metadata ?? existing.metadata) as DeviceProfile['metadata'],
        };
        const validation = validateDeviceProfile(draft);
        if (!validation.valid) {
          return {
            success: false,
            issues: validation.issues,
            error: 'Device profile validation failed.',
          };
        }

        set((state) => {
          const profiles = state.profiles.map((profile) => (
            profile.id === profileId
              ? {
                ...draft,
                lastValidatedAt: nowIso(),
                validationIssues: [],
              }
              : profile
          ));
          return {
            ...state,
            profiles,
            readiness: computeReadinessFromState({ ...state, profiles }),
          };
        });

        return {
          success: true,
          profile: draft,
        };
      },

      setProfileEnabled: (profileId, enabled) => {
        set((state) => {
          const profiles = state.profiles.map((profile) => (
            profile.id === profileId
              ? {
                ...profile,
                enabled,
                updatedAt: nowIso(),
              }
              : profile
          ));
          return {
            ...state,
            profiles,
            readiness: computeReadinessFromState({ ...state, profiles }),
          };
        });
      },

      deleteProfile: (profileId, options = {}) => {
        const { force = false } = options;
        const state = get();
        if (!force && state.activeSessionProfileIds.includes(profileId)) {
          return {
            success: false,
            error: 'Profile is referenced by an active session plan.',
          };
        }

        set((current) => {
          const profiles = current.profiles.filter((profile) => profile.id !== profileId);
          const { [profileId]: _removedConnection, ...connections } = current.connections;
          const { [profileId]: _removedDiagnostics, ...diagnostics } = current.diagnostics;
          const activeSessionProfileIds = current.activeSessionProfileIds.filter((id) => id !== profileId);
          return {
            ...current,
            profiles,
            connections,
            diagnostics,
            activeSessionProfileIds,
            readiness: computeReadinessFromState({ ...current, profiles, connections }),
          };
        });

        return { success: true };
      },

      setActiveSessionProfileIds: (profileIds) => {
        set({
          activeSessionProfileIds: Array.from(new Set(profileIds)),
        });
      },

      setRequiredSessionDeviceTypes: (types) => {
        set((state) => ({
          ...state,
          requiredSessionDeviceTypes: [...types],
          readiness: computeReadinessFromState({
            ...state,
            requiredSessionDeviceTypes: [...types],
          }),
        }));
      },

      beginConnection: (profileId, trigger = 'user_connect', context) => {
        set((state) => {
          const { connections, diagnostics } = upsertConnectionTransition(
            state,
            profileId,
            'connecting',
            { trigger, context },
          );
          return {
            ...state,
            connections,
            diagnostics,
            readiness: computeReadinessFromState({ ...state, connections }),
          };
        });
      },

      markConnected: (profileId, trigger = 'sync', context) => {
        set((state) => {
          const { connections, diagnostics } = upsertConnectionTransition(
            state,
            profileId,
            'connected',
            { trigger, context },
          );
          return {
            ...state,
            connections,
            diagnostics,
            readiness: computeReadinessFromState({ ...state, connections }),
          };
        });
      },

      markDegraded: (profileId, error, trigger = 'health_check', context) => {
        set((state) => {
          const { connections, diagnostics } = upsertConnectionTransition(
            state,
            profileId,
            'degraded',
            { trigger, context, error },
          );
          return {
            ...state,
            connections,
            diagnostics,
            readiness: computeReadinessFromState({ ...state, connections }),
          };
        });
      },

      markFailed: (profileId, error, trigger = 'health_check', context) => {
        set((state) => {
          const { connections, diagnostics } = upsertConnectionTransition(
            state,
            profileId,
            'failed',
            { trigger, context, error },
          );
          return {
            ...state,
            connections,
            diagnostics,
            readiness: computeReadinessFromState({ ...state, connections }),
          };
        });
      },

      disconnectConnection: (profileId, trigger = 'user_disconnect', context) => {
        set((state) => {
          const { connections, diagnostics } = upsertConnectionTransition(
            state,
            profileId,
            'idle',
            { trigger, context },
          );
          return {
            ...state,
            connections,
            diagnostics,
            readiness: computeReadinessFromState({ ...state, connections }),
          };
        });
      },

      retryConnection: (profileId, context) => {
        set((state) => {
          const { connections, diagnostics } = upsertConnectionTransition(
            state,
            profileId,
            'connecting',
            { trigger: 'user_retry', context },
          );
          return {
            ...state,
            connections,
            diagnostics,
            readiness: computeReadinessFromState({ ...state, connections }),
          };
        });
      },

      clearDiagnostics: (profileId) => {
        if (!profileId) {
          set({ diagnostics: {} });
          return;
        }
        set((state) => {
          const { [profileId]: _removed, ...diagnostics } = state.diagnostics;
          return { diagnostics };
        });
      },

      syncFromEquipmentStore: (snapshot) => {
        const resolved = snapshot ?? buildEquipmentSnapshotFromStore();
        const timestamp = nowIso();

        const camerasById = new Map<string, CameraPreset>(
          getAllCameras().map((camera) => [camera.id, camera]),
        );
        const telescopesById = new Map<string, TelescopePreset>(
          getAllTelescopes().map((scope) => [scope.id, scope]),
        );

        const incomingProfiles: DeviceProfile[] = [];

        if (resolved.activeCameraId) {
          const activeCamera = camerasById.get(resolved.activeCameraId);
          incomingProfiles.push(toCameraProfile(
            `camera-${resolved.activeCameraId}`,
            activeCamera?.name ?? `Camera (${resolved.activeCameraId})`,
            {
              sensorWidth: activeCamera?.sensorWidth ?? resolved.sensorWidth,
              sensorHeight: activeCamera?.sensorHeight ?? resolved.sensorHeight,
              pixelSize: activeCamera?.pixelSize ?? resolved.pixelSize,
            },
            resolved.activeCameraId,
          ));
        } else {
          incomingProfiles.push(toCameraProfile(
            'camera-manual',
            'Manual Camera',
            {
              sensorWidth: resolved.sensorWidth,
              sensorHeight: resolved.sensorHeight,
              pixelSize: resolved.pixelSize,
            },
          ));
        }

        if (resolved.activeTelescopeId) {
          const activeTelescope = telescopesById.get(resolved.activeTelescopeId);
          incomingProfiles.push(toTelescopeProfile(
            `telescope-${resolved.activeTelescopeId}`,
            activeTelescope?.name ?? `Telescope (${resolved.activeTelescopeId})`,
            {
              focalLength: activeTelescope?.focalLength ?? resolved.focalLength,
              aperture: activeTelescope?.aperture ?? resolved.aperture,
              design: activeTelescope?.type,
            },
            resolved.activeTelescopeId,
          ));
        } else {
          incomingProfiles.push(toTelescopeProfile(
            'telescope-manual',
            'Manual Telescope',
            {
              focalLength: resolved.focalLength,
              aperture: resolved.aperture,
            },
          ));
        }

        for (const camera of resolved.customCameras) {
          incomingProfiles.push(toCameraProfile(
            `camera-${camera.id}`,
            camera.name,
            {
              sensorWidth: camera.sensorWidth,
              sensorHeight: camera.sensorHeight,
              pixelSize: camera.pixelSize,
            },
            camera.id,
          ));
        }
        for (const telescope of resolved.customTelescopes) {
          incomingProfiles.push(toTelescopeProfile(
            `telescope-${telescope.id}`,
            telescope.name,
            {
              focalLength: telescope.focalLength,
              aperture: telescope.aperture,
              design: telescope.type,
            },
            telescope.id,
          ));
        }

        set((state) => {
          const filtered = removeProfilesByPredicate(
            state.profiles,
            (profile) => (
              profile.source === 'equipment-store'
              && (profile.type === 'camera' || profile.type === 'telescope')
            ),
          );
          const incomingUnique = Array.from(
            new Map(incomingProfiles.map((profile) => [profile.id, {
              ...profile,
              updatedAt: timestamp,
            }])).values(),
          );
          const profiles = upsertProfiles(filtered, incomingUnique);
          return {
            ...state,
            profiles,
            readiness: computeReadinessFromState({ ...state, profiles }),
          };
        });
      },

      syncFromMountStore: (snapshot) => {
        const resolved = snapshot ?? buildMountSnapshotFromStore();
        const timestamp = nowIso();
        const incomingMountProfile: DeviceProfile<'mount'> = {
          id: PRIMARY_MOUNT_DEVICE_PROFILE_ID,
          type: 'mount',
          name: 'Primary Mount',
          source: 'mount-store',
          enabled: true,
          metadata: {
            protocol: resolved.protocol,
            host: resolved.host,
            port: resolved.port,
            deviceId: resolved.deviceId,
            selectedDeviceId: resolved.selectedDeviceId,
            selectedDevice: resolved.selectedDevice,
            capabilitySnapshot: resolved.capabilitySnapshot,
            actionAvailability: resolved.actionAvailability,
          },
          createdAt: timestamp,
          updatedAt: timestamp,
          lastValidatedAt: timestamp,
          validationIssues: [],
        };

        set((state) => {
          const filtered = removeProfilesByPredicate(
            state.profiles,
            (profile) => profile.source === 'mount-store' && profile.type === 'mount',
          );
          const profiles = upsertProfiles(filtered, [incomingMountProfile]);

          let { connections, diagnostics } = state;
          const mountConnection = state.connections[PRIMARY_MOUNT_DEVICE_PROFILE_ID];
          if (resolved.connected) {
            ({ connections, diagnostics } = upsertConnectionTransition(
              { ...state, connections, diagnostics },
              PRIMARY_MOUNT_DEVICE_PROFILE_ID,
              'connected',
              { trigger: 'sync', context: 'mount-store-sync' },
            ));
          } else if (mountConnection && mountConnection.state !== 'idle') {
            ({ connections, diagnostics } = upsertConnectionTransition(
              { ...state, connections, diagnostics },
              PRIMARY_MOUNT_DEVICE_PROFILE_ID,
              'idle',
              { trigger: 'sync', context: 'mount-store-sync' },
            ));
          } else if (!mountConnection) {
            connections = {
              ...connections,
              [PRIMARY_MOUNT_DEVICE_PROFILE_ID]: {
                profileId: PRIMARY_MOUNT_DEVICE_PROFILE_ID,
                state: 'idle',
                updatedAt: timestamp,
                attempts: 0,
              },
            };
          }

          return {
            ...state,
            profiles,
            connections,
            diagnostics,
            readiness: computeReadinessFromState({ ...state, profiles, connections }),
          };
        });
      },

      recomputeReadiness: (input) => {
        const nextReadiness = computeReadinessFromState(get(), input);
        set({ readiness: nextReadiness });
        return nextReadiness;
      },

      getSessionReadiness: (input) => {
        return computeReadinessFromState(get(), input);
      },

      getProfilesByType: (type) => {
        return get().profiles.filter((profile) => profile.type === type);
      },

      getConnectionState: (profileId) => {
        return get().connections[profileId];
      },

      getLatestDiagnostics: (profileId, limit = 10) => {
        const events = get().diagnostics[profileId] ?? [];
        return events.slice(-Math.max(1, limit));
      },
    }),
    {
      name: 'starmap-devices',
      storage: getZustandStorage(),
      version: 1,
      migrate: (persistedState) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return persistedState;
        }

        const state = persistedState as Partial<DeviceStoreState> & {
          customCameras?: unknown;
          customTelescopes?: unknown;
        };
        const normalizedProfilesReport = normalizePersistedDeviceProfiles(state.profiles);
        const legacyProfiles = normalizeLegacyEquipmentProfiles(
          state.customCameras,
          state.customTelescopes,
        );
        const profiles = upsertProfiles(
          normalizedProfilesReport.profiles,
          legacyProfiles,
        );

        if (normalizedProfilesReport.skippedCount > 0) {
          logger.warn('Skipped corrupted device profiles during migration', {
            skippedCount: normalizedProfilesReport.skippedCount,
          });
        }

        const baseState: DeviceStoreState = {
          profiles,
          connections: state.connections ?? {},
          diagnostics: state.diagnostics ?? {},
          requiredSessionDeviceTypes: state.requiredSessionDeviceTypes ?? [...DEFAULT_REQUIRED_SESSION_DEVICE_TYPES],
          activeSessionProfileIds: state.activeSessionProfileIds ?? [],
          diagnosticsLimitPerProfile: state.diagnosticsLimitPerProfile ?? MAX_DIAGNOSTICS_PER_DEVICE,
          readiness: buildInitialReadiness(),
          createProfile: () => ({ success: false, error: 'Not available in migration state.' }),
          updateProfile: () => ({ success: false, error: 'Not available in migration state.' }),
          setProfileEnabled: () => {},
          deleteProfile: () => ({ success: false, error: 'Not available in migration state.' }),
          setActiveSessionProfileIds: () => {},
          setRequiredSessionDeviceTypes: () => {},
          beginConnection: () => {},
          markConnected: () => {},
          markDegraded: () => {},
          markFailed: () => {},
          disconnectConnection: () => {},
          retryConnection: () => {},
          clearDiagnostics: () => {},
          syncFromEquipmentStore: () => {},
          syncFromMountStore: () => {},
          recomputeReadiness: () => buildInitialReadiness(),
          getSessionReadiness: () => buildInitialReadiness(),
          getProfilesByType: () => [],
          getConnectionState: () => undefined,
          getLatestDiagnostics: () => [],
        };
        baseState.readiness = computeReadinessFromState(baseState);

        return {
          ...state,
          profiles,
          connections: baseState.connections,
          diagnostics: baseState.diagnostics,
          requiredSessionDeviceTypes: baseState.requiredSessionDeviceTypes,
          activeSessionProfileIds: baseState.activeSessionProfileIds,
          diagnosticsLimitPerProfile: baseState.diagnosticsLimitPerProfile,
          readiness: baseState.readiness,
        } satisfies Partial<DeviceStoreState>;
      },
      partialize: (state) => ({
        profiles: state.profiles,
        connections: state.connections,
        diagnostics: state.diagnostics,
        requiredSessionDeviceTypes: state.requiredSessionDeviceTypes,
        activeSessionProfileIds: state.activeSessionProfileIds,
        diagnosticsLimitPerProfile: state.diagnosticsLimitPerProfile,
      }),
    },
  ),
);
