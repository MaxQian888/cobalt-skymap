import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getZustandStorage } from '@/lib/storage';
import type {
  MountInfo,
  ProfileInfo,
  MountConnectionConfig,
  MountCapabilities,
  MountActionAvailability,
  MountBlockedReasonMap,
  MountCapabilitySnapshot,
  MountCommandFailure,
  MountTargetAction,
  SupportedMountDevice,
} from '@/lib/core/types';
import {
  type MountSafetyConfig,
  DEFAULT_MOUNT_SAFETY_CONFIG,
} from '@/lib/astronomy/mount-safety';
import {
  BUILT_IN_SIMULATOR_MOUNT_ID,
  createMountActionAvailability,
  createMountActionBlockReasons,
  createSimulatorMountDevice,
} from '@/lib/core/mount-support';

export const DEFAULT_CONNECTION_CONFIG: MountConnectionConfig = {
  protocol: 'simulator',
  host: 'localhost',
  port: 11111,
  deviceId: 0,
  selectedDeviceId: BUILT_IN_SIMULATOR_MOUNT_ID,
};

const DEFAULT_CAPABILITIES: MountCapabilities = {
  canSlew: false,
  canSlewAsync: false,
  canSync: false,
  canPark: false,
  canUnpark: false,
  canSetTracking: false,
  canMoveAxis: false,
  canPulseGuide: false,
  alignmentMode: '',
  equatorialSystem: '',
};

const DEFAULT_MOUNT_INFO: MountInfo = {
  Connected: false,
  Coordinates: {
    RADegrees: 0,
    Dec: 0,
  },
};

function buildMountOperationFeedback(input: {
  mountInfo: MountInfo;
  capabilities: MountCapabilities;
}): {
  actionAvailability: MountActionAvailability;
  blockedActionReasons: MountBlockedReasonMap;
} {
  return {
    actionAvailability: createMountActionAvailability({
      connected: input.mountInfo.Connected,
      capabilities: input.capabilities,
      parked: input.mountInfo.Parked,
      slewing: input.mountInfo.Slewing,
    }),
    blockedActionReasons: createMountActionBlockReasons({
      connected: input.mountInfo.Connected,
      capabilities: input.capabilities,
      tracking: input.mountInfo.Tracking,
      parked: input.mountInfo.Parked,
      slewing: input.mountInfo.Slewing,
    }),
  };
}

interface MountStoreState {
  mountInfo: MountInfo;
  profileInfo: ProfileInfo;
  sequenceRunning: boolean;
  currentTab: string;
  safetyConfig: MountSafetyConfig;
  selectedDevice: SupportedMountDevice | null;
  capabilitySnapshot: MountCapabilitySnapshot | null;
  actionAvailability: MountActionAvailability;
  blockedActionReasons: MountBlockedReasonMap;
  activeTargetAction: MountTargetAction | null;
  latestCommandFailure: MountCommandFailure | null;

  // Connection & capabilities
  connectionConfig: MountConnectionConfig;
  capabilities: MountCapabilities;

  // Actions
  setMountInfo: (info: Partial<MountInfo>) => void;
  setMountCoordinates: (ra: number, dec: number) => void;
  setMountConnected: (connected: boolean) => void;
  setProfileInfo: (info: Partial<ProfileInfo>) => void;
  setSequenceRunning: (running: boolean) => void;
  setCurrentTab: (tab: string) => void;
  setSafetyConfig: (config: Partial<MountSafetyConfig>) => void;
  resetSafetyConfig: () => void;

  // New actions
  setConnectionConfig: (config: Partial<MountConnectionConfig>) => void;
  setCapabilities: (caps: MountCapabilities) => void;
  setSelectedDevice: (device: SupportedMountDevice | null) => void;
  setCapabilitySnapshot: (snapshot: MountCapabilitySnapshot | null) => void;
  setActiveTargetAction: (action: Omit<MountTargetAction, 'requestedAt'>) => void;
  clearActiveTargetAction: () => void;
  setLatestCommandFailure: (failure: MountCommandFailure | null) => void;
  clearLatestCommandFailure: () => void;

  /** Batch-update mount info from a polling state snapshot */
  applyMountState: (state: {
    connected: boolean;
    ra: number;
    dec: number;
    tracking: boolean;
    trackingRate: 'sidereal' | 'lunar' | 'solar' | 'stopped';
    slewing: boolean;
    parked: boolean;
    atHome: boolean;
    pierSide: 'east' | 'west' | 'unknown';
    slewRateIndex: number;
  }) => void;

  /** Reset mount info to disconnected defaults */
  resetMountInfo: () => void;
}

export const useMountStore = create<MountStoreState>()(
  persist(
    (set) => ({
      mountInfo: { ...DEFAULT_MOUNT_INFO },
      profileInfo: {
        AstrometrySettings: {
          Latitude: 0,
          Longitude: 0,
          Elevation: 0,
        },
      },
      sequenceRunning: false,
      currentTab: 'showSlew',
      safetyConfig: { ...DEFAULT_MOUNT_SAFETY_CONFIG },
      selectedDevice: createSimulatorMountDevice(),
      capabilitySnapshot: null,
      ...buildMountOperationFeedback({
        mountInfo: DEFAULT_MOUNT_INFO,
        capabilities: DEFAULT_CAPABILITIES,
      }),
      activeTargetAction: null,
      latestCommandFailure: null,
      connectionConfig: { ...DEFAULT_CONNECTION_CONFIG },
      capabilities: { ...DEFAULT_CAPABILITIES },
      
      setMountInfo: (info) => set((state) => {
        const mountInfo = { ...state.mountInfo, ...info };
        return {
          mountInfo,
          ...buildMountOperationFeedback({
            mountInfo,
            capabilities: state.capabilities,
          }),
        };
      }),
      
      setMountCoordinates: (ra, dec) => set((state) => {
        const mountInfo = {
          ...state.mountInfo,
          Coordinates: { RADegrees: ra, Dec: dec },
        };
        return { mountInfo };
      }),
      
      setMountConnected: (Connected) => set((state) => {
        const mountInfo = { ...state.mountInfo, Connected };
        return {
          mountInfo,
          ...buildMountOperationFeedback({
            mountInfo,
            capabilities: state.capabilities,
          }),
        };
      }),
      
      setProfileInfo: (info) => set((state) => ({
        profileInfo: { ...state.profileInfo, ...info }
      })),
      
      setSequenceRunning: (sequenceRunning) => set({ sequenceRunning }),
      setCurrentTab: (currentTab) => set({ currentTab }),
      
      setSafetyConfig: (config) => set((state) => ({
        safetyConfig: {
          ...state.safetyConfig,
          ...config,
          meridianFlip: {
            ...state.safetyConfig.meridianFlip,
            ...(config.meridianFlip ?? {}),
          },
        },
      })),
      
      resetSafetyConfig: () => set({
        safetyConfig: { ...DEFAULT_MOUNT_SAFETY_CONFIG },
      }),

      setConnectionConfig: (config) => set((state) => ({
        connectionConfig: { ...state.connectionConfig, ...config },
      })),

      setCapabilities: (caps) => set((state) => ({
        capabilities: caps,
        capabilitySnapshot: {
          ...caps,
          capturedAt: new Date().toISOString(),
        },
        ...buildMountOperationFeedback({
          mountInfo: state.mountInfo,
          capabilities: caps,
        }),
      })),

      setSelectedDevice: (selectedDevice) => set((state) => ({
        selectedDevice,
        connectionConfig: {
          ...state.connectionConfig,
          selectedDeviceId: selectedDevice?.id ?? null,
        },
      })),

      setCapabilitySnapshot: (capabilitySnapshot) => set({ capabilitySnapshot }),

      setActiveTargetAction: (action) => set({
        activeTargetAction: {
          ...action,
          requestedAt: new Date().toISOString(),
        },
      }),

      clearActiveTargetAction: () => set({ activeTargetAction: null }),

      setLatestCommandFailure: (latestCommandFailure) => set({ latestCommandFailure }),

      clearLatestCommandFailure: () => set({ latestCommandFailure: null }),

      applyMountState: (s) => set((state) => {
        // Short-circuit value-equal polls so an idle connected mount doesn't
        // rebuild mountInfo + the operation-feedback maps (and re-render every
        // subscriber) on every poll tick. Returning the SAME state reference
        // makes Zustand's Object.is check skip the update entirely. Capability
        // changes are handled by setCapabilities, so feedback can't go stale.
        const prev = state.mountInfo;
        if (
          prev.Connected === s.connected &&
          prev.Coordinates.RADegrees === s.ra &&
          prev.Coordinates.Dec === s.dec &&
          prev.Tracking === s.tracking &&
          prev.TrackMode === s.trackingRate &&
          prev.Slewing === s.slewing &&
          prev.Parked === s.parked &&
          prev.AtHome === s.atHome &&
          prev.PierSide === s.pierSide &&
          prev.SlewRateIndex === s.slewRateIndex
        ) {
          return state;
        }
        const mountInfo = {
          Connected: s.connected,
          Coordinates: { RADegrees: s.ra, Dec: s.dec },
          Tracking: s.tracking,
          TrackMode: s.trackingRate,
          Slewing: s.slewing,
          Parked: s.parked,
          AtHome: s.atHome,
          PierSide: s.pierSide,
          SlewRateIndex: s.slewRateIndex,
        };
        return {
          mountInfo,
          ...buildMountOperationFeedback({
            mountInfo,
            capabilities: state.capabilities,
          }),
        };
      }),

      resetMountInfo: () => set((state) => ({
        mountInfo: { ...DEFAULT_MOUNT_INFO },
        capabilities: { ...DEFAULT_CAPABILITIES },
        ...buildMountOperationFeedback({
          mountInfo: DEFAULT_MOUNT_INFO,
          capabilities: DEFAULT_CAPABILITIES,
        }),
        selectedDevice: state.selectedDevice,
        capabilitySnapshot: state.capabilitySnapshot,
        activeTargetAction: null,
        latestCommandFailure: null,
      })),
    }),
    {
      name: 'starmap-mount',
      storage: getZustandStorage(),
      version: 2, // v1: persist profileInfo, v2: persist supported mount metadata
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<MountStoreState>;
        if (version < 1) {
          // profileInfo was not persisted before v1; keep whatever was loaded
          // (or defaults) so the bootstrap in useObserverSync can handle migration.
          return { ...state };
        }
        if (version < 2) {
          return {
            ...state,
            connectionConfig: {
              ...DEFAULT_CONNECTION_CONFIG,
              ...state.connectionConfig,
              selectedDeviceId: state.connectionConfig?.selectedDeviceId ?? BUILT_IN_SIMULATOR_MOUNT_ID,
            },
            selectedDevice: state.selectedDevice ?? createSimulatorMountDevice(),
            capabilitySnapshot: state.capabilitySnapshot ?? null,
            actionAvailability: state.actionAvailability ?? createMountActionAvailability({
              connected: false,
              capabilities: DEFAULT_CAPABILITIES,
            }),
          } as MountStoreState;
        }
        return state as MountStoreState;
      },
      partialize: (state) => ({
        profileInfo: state.profileInfo,
        safetyConfig: state.safetyConfig,
        connectionConfig: state.connectionConfig,
        selectedDevice: state.selectedDevice,
        capabilitySnapshot: state.capabilitySnapshot,
        actionAvailability: state.actionAvailability,
      }),
    }
  )
);
