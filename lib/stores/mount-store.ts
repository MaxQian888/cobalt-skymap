import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getZustandStorage } from '@/lib/storage';
import type {
  MountInfo,
  ProfileInfo,
  MountConnectionConfig,
  MountCapabilities,
  MountActionAvailability,
  MountCapabilitySnapshot,
  SupportedMountDevice,
} from '@/lib/core/types';
import {
  type MountSafetyConfig,
  DEFAULT_MOUNT_SAFETY_CONFIG,
} from '@/lib/astronomy/mount-safety';
import {
  BUILT_IN_SIMULATOR_MOUNT_ID,
  createMountActionAvailability,
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

interface MountStoreState {
  mountInfo: MountInfo;
  profileInfo: ProfileInfo;
  sequenceRunning: boolean;
  currentTab: string;
  safetyConfig: MountSafetyConfig;
  selectedDevice: SupportedMountDevice | null;
  capabilitySnapshot: MountCapabilitySnapshot | null;
  actionAvailability: MountActionAvailability;

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
      mountInfo: {
        Connected: false,
        Coordinates: {
          RADegrees: 0,
          Dec: 0,
        },
      },
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
      actionAvailability: createMountActionAvailability({
        connected: false,
        capabilities: DEFAULT_CAPABILITIES,
      }),
      connectionConfig: { ...DEFAULT_CONNECTION_CONFIG },
      capabilities: { ...DEFAULT_CAPABILITIES },
      
      setMountInfo: (info) => set((state) => ({
        mountInfo: { ...state.mountInfo, ...info }
      })),
      
      setMountCoordinates: (ra, dec) => set((state) => ({
        mountInfo: {
          ...state.mountInfo,
          Coordinates: { RADegrees: ra, Dec: dec }
        }
      })),
      
      setMountConnected: (Connected) => set((state) => ({
        mountInfo: { ...state.mountInfo, Connected }
      })),
      
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
        actionAvailability: createMountActionAvailability({
          connected: state.mountInfo.Connected,
          capabilities: caps,
          parked: state.mountInfo.Parked,
          slewing: state.mountInfo.Slewing,
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

      applyMountState: (s) => set((state) => ({
        mountInfo: {
          Connected: s.connected,
          Coordinates: { RADegrees: s.ra, Dec: s.dec },
          Tracking: s.tracking,
          TrackMode: s.trackingRate,
          Slewing: s.slewing,
          Parked: s.parked,
          AtHome: s.atHome,
          PierSide: s.pierSide,
          SlewRateIndex: s.slewRateIndex,
        },
        actionAvailability: createMountActionAvailability({
          connected: s.connected,
          capabilities: state.capabilities,
          parked: s.parked,
          slewing: s.slewing,
        }),
      })),

      resetMountInfo: () => set((state) => ({
        mountInfo: {
          Connected: false,
          Coordinates: { RADegrees: 0, Dec: 0 },
        },
        capabilities: { ...DEFAULT_CAPABILITIES },
        actionAvailability: createMountActionAvailability({
          connected: false,
          capabilities: DEFAULT_CAPABILITIES,
        }),
        selectedDevice: state.selectedDevice,
        capabilitySnapshot: state.capabilitySnapshot,
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
