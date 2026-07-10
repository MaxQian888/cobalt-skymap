import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getZustandStorage } from '@/lib/storage';
import { isTauri } from '@/lib/storage/platform';
import {
  markersApi,
  type MarkersData as TauriMarkersData,
  type SkyMarker as TauriSkyMarker,
  type MarkerUpdateInput,
} from '@/lib/tauri/markers-api';
import { createLogger } from '@/lib/logger';

const logger = createLogger('marker-store');
const DEFAULT_GROUP = 'Default';
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

/** Maximum number of markers allowed */
export const MAX_MARKERS = 500;

/** Sort options for markers list */
export type MarkerSortBy = 'name' | 'date' | 'ra';

/**
 * Sky marker for annotating positions on the celestial sphere
 */
export interface SkyMarker {
  id: string;
  name: string;
  description?: string;
  ra: number; // degrees
  dec: number; // degrees
  raString: string;
  decString: string;
  // Visual properties
  color: string; // hex color
  icon: MarkerIcon;
  // Metadata
  createdAt: number;
  updatedAt: number;
  // Grouping
  group?: string;
  // Visual size (optional, overrides global)
  size?: number;
  // Visibility
  visible: boolean;
}

export type MarkerIcon =
  | 'star'
  | 'circle'
  | 'crosshair'
  | 'pin'
  | 'diamond'
  | 'triangle'
  | 'square'
  | 'flag';

export const MARKER_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#ffffff', // white
] as const;

export const MARKER_ICONS: MarkerIcon[] = [
  'star',
  'circle',
  'crosshair',
  'pin',
  'diamond',
  'triangle',
  'square',
  'flag',
];

/** Input type for adding a marker (without auto-generated fields) */
export type MarkerInput = Omit<SkyMarker, 'id' | 'createdAt' | 'updatedAt' | 'visible'> & {
  visible?: boolean;
};

/** Pending marker coordinates for context menu add */
export interface PendingMarkerCoords {
  ra: number;
  dec: number;
  raString: string;
  decString: string;
}

export type MarkerUpdate = Partial<Omit<SkyMarker, 'description'>> & {
  description?: string | null;
};

export interface MarkerImportResult {
  count: number;
  requested: number;
  truncated: boolean;
}

interface MarkerState {
  markers: SkyMarker[];
  groups: string[];
  groupVisibility: Record<string, boolean>;
  activeMarkerId: string | null;
  showMarkers: boolean;
  showMarkersUpdatedAt: number;
  showLabels: boolean;
  globalMarkerSize: number;
  sortBy: MarkerSortBy;
  pendingCoords: PendingMarkerCoords | null;
  editingMarkerId: string | null;
  /** Marker currently in explicit move mode (session-only, never persisted). */
  movingMarkerId: string | null;
  /** Persisted toggle: show edge chevrons pointing to off-screen markers. */
  showOffscreenIndicators: boolean;

  // CRUD operations
  addMarker: (marker: MarkerInput) => string | null;
  setPendingCoords: (coords: PendingMarkerCoords | null) => void;
  setEditingMarkerId: (id: string | null) => void;
  setMovingMarker: (id: string | null) => void;
  setShowOffscreenIndicators: (show: boolean) => void;
  removeMarker: (id: string) => void;
  updateMarker: (id: string, updates: MarkerUpdate) => void;
  setActiveMarker: (id: string | null) => void;
  selectMarkerForNavigation: (id: string | null) => SkyMarker | null;

  // Bulk operations
  removeMarkersByGroup: (group: string) => void;
  clearAllMarkers: () => void;

  // Visibility & display
  toggleMarkerVisibility: (id: string) => void;
  setAllMarkersVisible: (visible: boolean) => void;
  setShowMarkers: (show: boolean) => void;
  setGroupVisibility: (group: string, visible: boolean) => void;
  toggleGroupVisibility: (group: string) => void;
  setShowLabels: (show: boolean) => void;
  setGlobalMarkerSize: (size: number) => void;
  setSortBy: (sortBy: MarkerSortBy) => void;

  // Group management
  addGroup: (group: string) => void;
  removeGroup: (group: string) => void;
  renameGroup: (oldName: string, newName: string) => void;

  // Getters
  getMarkersByGroup: (group?: string) => SkyMarker[];
  getVisibleMarkers: () => SkyMarker[];
  getVisibleMarkersByGroup: (group: string) => SkyMarker[];
  isGroupVisible: (group?: string) => boolean;
  isMarkerEffectivelyVisible: (marker: SkyMarker) => boolean;

  // Import/Export
  exportMarkers: () => string;
  importMarkers: (json: string) => MarkerImportResult;

  // Tauri sync
  syncWithTauri: () => Promise<void>;
  _tauriInitialized: boolean;
}

interface MarkerSnapshot {
  markers: SkyMarker[];
  groups: string[];
  groupVisibility: Record<string, boolean>;
  showMarkers: boolean;
  showMarkersUpdatedAt: number;
}

interface ImportPayload {
  version?: number;
  markers?: unknown[];
  groups?: unknown[];
  groupVisibility?: Record<string, unknown>;
  group_visibility?: Record<string, unknown>;
  showMarkers?: boolean;
  showMarkersUpdatedAt?: number;
  show_markers?: boolean;
  show_markers_updated_at?: number;
}

// Helper to generate unique ID
const generateId = () => `marker-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const toFiniteNumber = (value: unknown): number | undefined => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const normalizeRa = (ra: unknown): number => {
  const value = toFiniteNumber(ra) ?? 0;
  return ((value % 360) + 360) % 360;
};

const normalizeDec = (dec: unknown): number => {
  const value = toFiniteNumber(dec) ?? 0;
  return Math.max(-90, Math.min(90, value));
};

const normalizeColor = (value: unknown, fallback = '#3b82f6'): string => {
  if (typeof value === 'string' && HEX_COLOR_RE.test(value)) return value;
  return fallback;
};

const normalizeIcon = (value: unknown): MarkerIcon => {
  if (typeof value === 'string' && MARKER_ICONS.includes(value as MarkerIcon)) {
    return value as MarkerIcon;
  }
  return 'pin';
};

const normalizeGroup = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeMarker = (marker: SkyMarker): SkyMarker => {
  return {
    ...marker,
    name: marker.name?.trim() || 'Untitled Marker',
    description: marker.description?.trim() || undefined,
    ra: normalizeRa(marker.ra),
    dec: normalizeDec(marker.dec),
    raString: typeof marker.raString === 'string' ? marker.raString : '',
    decString: typeof marker.decString === 'string' ? marker.decString : '',
    color: normalizeColor(marker.color),
    icon: normalizeIcon(marker.icon),
    createdAt: toFiniteNumber(marker.createdAt) ?? Date.now(),
    updatedAt: toFiniteNumber(marker.updatedAt) ?? Date.now(),
    group: normalizeGroup(marker.group),
    size: toFiniteNumber(marker.size),
    visible: Boolean(marker.visible),
  };
};

const ensureGroups = (groups: string[], markers: SkyMarker[]): string[] => {
  const out = new Set<string>();
  out.add(DEFAULT_GROUP);

  for (const group of groups) {
    const normalized = normalizeGroup(group);
    if (normalized) out.add(normalized);
  }

  for (const marker of markers) {
    const normalized = normalizeGroup(marker.group);
    if (normalized) out.add(normalized);
  }

  return [...out];
};

const normalizeGroupVisibilityInput = (value: unknown): Record<string, boolean> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const out: Record<string, boolean> = {};
  for (const [rawGroup, rawVisible] of Object.entries(value)) {
    const normalized = normalizeGroup(rawGroup);
    if (!normalized) continue;
    out[normalized] = typeof rawVisible === 'boolean' ? rawVisible : true;
  }
  return out;
};

const ensureGroupVisibility = (
  groups: string[],
  groupVisibility: Record<string, boolean> = {},
): Record<string, boolean> => {
  const out: Record<string, boolean> = {};

  for (const group of groups) {
    out[group] = true;
  }

  for (const [rawGroup, rawVisible] of Object.entries(groupVisibility)) {
    const normalized = normalizeGroup(rawGroup);
    if (!normalized) continue;
    out[normalized] = typeof rawVisible === 'boolean' ? rawVisible : true;
  }

  out[DEFAULT_GROUP] = out[DEFAULT_GROUP] ?? true;
  return out;
};

const markerGroup = (marker: Pick<SkyMarker, 'group'>): string => normalizeGroup(marker.group) ?? DEFAULT_GROUP;

const isEffectivelyVisible = (
  marker: SkyMarker,
  showMarkers: boolean,
  groupVisibility: Record<string, boolean>,
): boolean => {
  if (!showMarkers || !marker.visible) return false;
  const group = markerGroup(marker);
  return groupVisibility[group] ?? true;
};

const toFrontendMarker = (marker: TauriSkyMarker): SkyMarker => {
  return normalizeMarker({
    id: marker.id,
    name: marker.name,
    description: marker.description ?? undefined,
    ra: marker.ra,
    dec: marker.dec,
    raString: marker.ra_string,
    decString: marker.dec_string,
    color: marker.color,
    icon: marker.icon,
    createdAt: marker.created_at,
    updatedAt: marker.updated_at,
    group: marker.group,
    visible: marker.visible,
  });
};

const toTauriMarker = (marker: SkyMarker): TauriSkyMarker => {
  const normalized = normalizeMarker(marker);
  return {
    id: normalized.id,
    name: normalized.name,
    description: normalized.description ?? null,
    ra: normalized.ra,
    dec: normalized.dec,
    ra_string: normalized.raString,
    dec_string: normalized.decString,
    color: normalized.color,
    icon: normalized.icon,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
    group: normalized.group,
    visible: normalized.visible,
  };
};

const mergeMarkerVersions = (local: SkyMarker, remote: SkyMarker): SkyMarker => {
  const localTs = toFiniteNumber(local.updatedAt) ?? 0;
  const remoteTs = toFiniteNumber(remote.updatedAt) ?? 0;
  const remotePreferred = remoteTs >= localTs; // tie -> Rust/remote wins
  const newer = remotePreferred ? remote : local;
  const older = remotePreferred ? local : remote;

  const createdCandidates = [toFiniteNumber(local.createdAt), toFiniteNumber(remote.createdAt)]
    .filter((v): v is number => typeof v === 'number' && v > 0);

  return normalizeMarker({
    id: newer.id || older.id,
    name: newer.name || older.name,
    description: newer.description !== undefined ? newer.description : older.description,
    ra: Number.isFinite(newer.ra) ? newer.ra : older.ra,
    dec: Number.isFinite(newer.dec) ? newer.dec : older.dec,
    raString: newer.raString || older.raString || '',
    decString: newer.decString || older.decString || '',
    color: newer.color || older.color,
    icon: newer.icon || older.icon,
    createdAt: createdCandidates.length > 0 ? Math.min(...createdCandidates) : Date.now(),
    updatedAt: Math.max(localTs, remoteTs),
    group: newer.group !== undefined ? newer.group : older.group,
    size: newer.size ?? older.size,
    visible: newer.visible ?? older.visible,
  });
};

const mergeMarkerSnapshots = (local: MarkerSnapshot, remote: TauriMarkersData): MarkerSnapshot => {
  const remoteMarkers = (remote.markers ?? []).map(toFrontendMarker);
  const localById = new Map(local.markers.map((m) => [m.id, normalizeMarker(m)]));
  const remoteById = new Map(remoteMarkers.map((m) => [m.id, normalizeMarker(m)]));

  const orderedIds = [
    ...local.markers.map((m) => m.id),
    ...remoteMarkers.map((m) => m.id).filter((id) => !localById.has(id)),
  ];

  const mergedMarkers: SkyMarker[] = [];
  for (const id of orderedIds) {
    const localMarker = localById.get(id);
    const remoteMarker = remoteById.get(id);
    if (localMarker && remoteMarker) {
      mergedMarkers.push(mergeMarkerVersions(localMarker, remoteMarker));
    } else if (remoteMarker) {
      mergedMarkers.push(remoteMarker);
    } else if (localMarker) {
      mergedMarkers.push(localMarker);
    }
  }

  const localShowTs = toFiniteNumber(local.showMarkersUpdatedAt) ?? 0;
  const remoteShowTs = toFiniteNumber(remote.show_markers_updated_at) ?? 0;
  const showMarkers = remoteShowTs >= localShowTs ? Boolean(remote.show_markers) : Boolean(local.showMarkers);
  const groups = ensureGroups(remote.groups ?? local.groups, mergedMarkers);

  return {
    markers: mergedMarkers,
    groups,
    groupVisibility: ensureGroupVisibility(groups, local.groupVisibility),
    showMarkers,
    showMarkersUpdatedAt: Math.max(localShowTs, remoteShowTs),
  };
};

const toTauriSnapshot = (snapshot: MarkerSnapshot): TauriMarkersData => {
  return {
    markers: snapshot.markers.map(toTauriMarker),
    groups: ensureGroups(snapshot.groups, snapshot.markers),
    show_markers: snapshot.showMarkers,
    show_markers_updated_at: snapshot.showMarkersUpdatedAt,
  };
};

const getLocalSnapshot = (state: MarkerState): MarkerSnapshot => {
  const groups = ensureGroups(state.groups, state.markers);
  return {
    markers: state.markers.map(normalizeMarker),
    groups,
    groupVisibility: ensureGroupVisibility(groups, state.groupVisibility),
    showMarkers: state.showMarkers,
    showMarkersUpdatedAt: toFiniteNumber(state.showMarkersUpdatedAt) ?? 0,
  };
};

const parseImportedMarker = (raw: unknown, index: number, now: number): SkyMarker => {
  const marker = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
  const createdAt = toFiniteNumber(marker.createdAt ?? marker.created_at) ?? now;

  return normalizeMarker({
    id: generateId(),
    name: typeof marker.name === 'string' ? marker.name : `Imported Marker ${index + 1}`,
    description: typeof marker.description === 'string' ? marker.description : undefined,
    ra: normalizeRa(marker.ra),
    dec: normalizeDec(marker.dec),
    raString: typeof marker.raString === 'string'
      ? marker.raString
      : (typeof marker.ra_string === 'string' ? marker.ra_string : ''),
    decString: typeof marker.decString === 'string'
      ? marker.decString
      : (typeof marker.dec_string === 'string' ? marker.dec_string : ''),
    color: normalizeColor(marker.color),
    icon: normalizeIcon(marker.icon),
    createdAt,
    updatedAt: now,
    group: normalizeGroup(marker.group) ?? DEFAULT_GROUP,
    size: toFiniteNumber(marker.size),
    visible: typeof marker.visible === 'boolean' ? marker.visible : true,
  });
};

export const useMarkerStore = create<MarkerState>()(
  persist(
    (set, get) => {
      const applySnapshot = (snapshot: MarkerSnapshot): void => {
        set({
          markers: snapshot.markers,
          groups: snapshot.groups,
          groupVisibility: ensureGroupVisibility(snapshot.groups, snapshot.groupVisibility),
          showMarkers: snapshot.showMarkers,
          showMarkersUpdatedAt: snapshot.showMarkersUpdatedAt,
        });
      };

      const reconcileRemote = async (remoteData: TauriMarkersData): Promise<void> => {
        const localSnapshot = getLocalSnapshot(get());
        const merged = mergeMarkerSnapshots(localSnapshot, remoteData);
        applySnapshot(merged);

        try {
          await markersApi.save(toTauriSnapshot(merged));
        } catch (error) {
          logger.error('Failed to persist merged marker snapshot to Tauri', error);
        }
      };

      return {
        markers: [],
        groups: [DEFAULT_GROUP],
        groupVisibility: { [DEFAULT_GROUP]: true },
        activeMarkerId: null,
        showMarkers: true,
        showMarkersUpdatedAt: 0,
        showLabels: true,
        globalMarkerSize: 20,
        sortBy: 'date' as MarkerSortBy,
        pendingCoords: null,
        editingMarkerId: null,
        movingMarkerId: null,
        showOffscreenIndicators: false,

        // ========== CRUD operations ==========
        setPendingCoords: (coords) => set({ pendingCoords: coords }),
        setEditingMarkerId: (id) => set({ editingMarkerId: id }),
        setMovingMarker: (id) => set({ movingMarkerId: id }),
        setShowOffscreenIndicators: (show) => set({ showOffscreenIndicators: show }),

        addMarker: (marker) => {
          if (get().markers.length >= MAX_MARKERS) {
            logger.warn(`Maximum marker count reached (${MAX_MARKERS})`);
            return null;
          }

          const now = Date.now();
          const newMarker = normalizeMarker({
            ...marker,
            id: generateId(),
            group: normalizeGroup(marker.group) ?? DEFAULT_GROUP,
            createdAt: now,
            updatedAt: now,
            visible: marker.visible ?? true,
          });

          set((state) => {
            const markers = [...state.markers, newMarker];
            const groups = ensureGroups(state.groups, markers);
            return {
              markers,
              groups,
              groupVisibility: ensureGroupVisibility(groups, state.groupVisibility),
            };
          });

          if (isTauri()) {
            void markersApi.addMarker({
              id: newMarker.id,
              name: newMarker.name,
              description: newMarker.description ?? null,
              ra: newMarker.ra,
              dec: newMarker.dec,
              ra_string: newMarker.raString,
              dec_string: newMarker.decString,
              color: newMarker.color,
              icon: newMarker.icon,
              group: newMarker.group,
              visible: newMarker.visible,
              created_at: newMarker.createdAt,
              updated_at: newMarker.updatedAt,
            }).then(reconcileRemote).catch((err) => logger.error('Failed to add marker to Tauri', err));
          }

          return newMarker.id;
        },

        removeMarker: (id) => {
          set((state) => ({
            markers: state.markers.filter((m) => m.id !== id),
            activeMarkerId: state.activeMarkerId === id ? null : state.activeMarkerId,
          }));

          if (isTauri()) {
            void markersApi.removeMarker(id).then(reconcileRemote).catch((err) => logger.error('Failed to remove marker from Tauri', err));
          }
        },

        updateMarker: (id, updates) => {
          const now = Date.now();
          const normalizedGroup = updates.group !== undefined ? normalizeGroup(updates.group) : undefined;
          const hasDescriptionUpdate = updates.description !== undefined;
          const normalizedDescription = updates.description === null ? undefined : updates.description;

          set((state) => {
            const markers = state.markers.map((marker) => {
              if (marker.id !== id) return marker;
              return normalizeMarker({
                ...marker,
                ...updates,
                description: hasDescriptionUpdate ? normalizedDescription : marker.description,
                group: normalizedGroup !== undefined ? normalizedGroup : marker.group,
                updatedAt: now,
              });
            });
            const groups = ensureGroups(state.groups, markers);

            return {
              markers,
              groups,
              groupVisibility: ensureGroupVisibility(groups, state.groupVisibility),
            };
          });

          if (isTauri()) {
            const tauriUpdates: MarkerUpdateInput = {};
            if (updates.name !== undefined) tauriUpdates.name = updates.name;
            if (updates.description !== undefined) tauriUpdates.description = updates.description ?? null;
            if (updates.ra !== undefined) tauriUpdates.ra = normalizeRa(updates.ra);
            if (updates.dec !== undefined) tauriUpdates.dec = normalizeDec(updates.dec);
            if (updates.raString !== undefined) tauriUpdates.ra_string = updates.raString;
            if (updates.decString !== undefined) tauriUpdates.dec_string = updates.decString;
            if (updates.color !== undefined) tauriUpdates.color = normalizeColor(updates.color, '#3b82f6');
            if (updates.icon !== undefined) tauriUpdates.icon = normalizeIcon(updates.icon);
            if (updates.group !== undefined) tauriUpdates.group = normalizedGroup ?? null;
            if (updates.visible !== undefined) tauriUpdates.visible = updates.visible;

            void markersApi.updateMarker(id, tauriUpdates).then(reconcileRemote).catch((err) => logger.error('Failed to update marker in Tauri', err));
          }
        },

        setActiveMarker: (id) => set({ activeMarkerId: id }),
        selectMarkerForNavigation: (id) => {
          if (!id) {
            set({ activeMarkerId: null });
            return null;
          }

          const marker = get().markers.find((m) => m.id === id) ?? null;
          set({ activeMarkerId: marker?.id ?? null });
          return marker;
        },

        // ========== Bulk operations ==========
        removeMarkersByGroup: (group) => {
          const normalizedGroup = normalizeGroup(group);
          if (!normalizedGroup) return;

          set((state) => ({
            markers: state.markers.filter((m) => m.group !== normalizedGroup),
            activeMarkerId: state.markers.find((m) => m.id === state.activeMarkerId)?.group === normalizedGroup
              ? null
              : state.activeMarkerId,
          }));

          if (isTauri()) {
            void markersApi.removeMarkersByGroup(normalizedGroup).then(reconcileRemote).catch((err) => logger.error('Failed to remove markers by group in Tauri', err));
          }
        },

        clearAllMarkers: () => {
          set({
            markers: [],
            activeMarkerId: null,
            groups: [DEFAULT_GROUP],
            groupVisibility: { [DEFAULT_GROUP]: true },
          });

          if (isTauri()) {
            void markersApi.clearAll().then(reconcileRemote).catch((err) => logger.error('Failed to clear all markers in Tauri', err));
          }
        },

        // ========== Visibility ==========
        toggleMarkerVisibility: (id) => {
          const now = Date.now();
          set((state) => ({
            markers: state.markers.map((m) =>
              m.id === id ? { ...m, visible: !m.visible, updatedAt: now } : m
            ),
          }));

          if (isTauri()) {
            void markersApi.toggleVisibility(id).then(reconcileRemote).catch((err) => logger.error('Failed to toggle marker visibility in Tauri', err));
          }
        },

        setAllMarkersVisible: (visible) => {
          const now = Date.now();
          set((state) => ({
            markers: state.markers.map((m) => ({ ...m, visible, updatedAt: now })),
          }));

          if (isTauri()) {
            void markersApi.setAllVisible(visible).then(reconcileRemote).catch((err) => logger.error('Failed to set all markers visible in Tauri', err));
          }
        },

        setShowMarkers: (show) => {
          const now = Date.now();
          set({ showMarkers: show, showMarkersUpdatedAt: now });

          if (isTauri()) {
            void markersApi.setShowMarkers(show).then(reconcileRemote).catch((err) => logger.error('Failed to set show markers in Tauri', err));
          }
        },

        setGroupVisibility: (group, visible) => {
          const normalized = normalizeGroup(group);
          if (!normalized) return;

          set((state) => {
            const groups = ensureGroups([...state.groups, normalized], state.markers);
            const groupVisibility = ensureGroupVisibility(groups, state.groupVisibility);
            groupVisibility[normalized] = visible;
            return { groups, groupVisibility };
          });
        },

        toggleGroupVisibility: (group) => {
          const normalized = normalizeGroup(group);
          if (!normalized) return;
          const visible = get().isGroupVisible(normalized);
          get().setGroupVisibility(normalized, !visible);
        },

        setShowLabels: (show) => set({ showLabels: show }),
        setGlobalMarkerSize: (size) => set({ globalMarkerSize: Math.max(8, Math.min(48, size)) }),
        setSortBy: (sortBy) => set({ sortBy }),

        // ========== Group management ==========
        addGroup: (group) => {
          const normalized = normalizeGroup(group);
          if (!normalized) return;

          set((state) => {
            const groups = ensureGroups([...state.groups, normalized], state.markers);
            const groupVisibility = ensureGroupVisibility(groups, state.groupVisibility);
            groupVisibility[normalized] = groupVisibility[normalized] ?? true;
            return { groups, groupVisibility };
          });

          if (isTauri()) {
            void markersApi.addGroup(normalized).then(reconcileRemote).catch((err) => logger.error('Failed to add group in Tauri', err));
          }
        },

        removeGroup: (group) => {
          const normalized = normalizeGroup(group);
          if (!normalized || normalized === DEFAULT_GROUP) return;

          set((state) => {
            const markers = state.markers.map((m) =>
              m.group === normalized ? { ...m, group: DEFAULT_GROUP } : m
            );
            const groups = ensureGroups(state.groups.filter((g) => g !== normalized), markers);
            const groupVisibility = ensureGroupVisibility(
              groups,
              Object.fromEntries(Object.entries(state.groupVisibility).filter(([groupName]) => groupName !== normalized)),
            );
            return {
              groups,
              groupVisibility,
              markers,
            };
          });

          if (isTauri()) {
            void markersApi.removeGroup(normalized).then(reconcileRemote).catch((err) => logger.error('Failed to remove group in Tauri', err));
          }
        },

        renameGroup: (oldName, newName) => {
          const oldNormalized = normalizeGroup(oldName);
          const newNormalized = normalizeGroup(newName);
          if (!oldNormalized || !newNormalized || oldNormalized === newNormalized) return;

          set((state) => {
            const markers = state.markers.map((m) =>
              m.group === oldNormalized ? { ...m, group: newNormalized } : m
            );
            const groups = ensureGroups(state.groups.map((g) => (g === oldNormalized ? newNormalized : g)), markers);
            const groupVisibility = ensureGroupVisibility(groups, state.groupVisibility);
            const previousVisibility = state.groupVisibility[oldNormalized];
            if (typeof previousVisibility === 'boolean') {
              groupVisibility[newNormalized] = previousVisibility;
            }
            delete groupVisibility[oldNormalized];
            return {
              groups,
              groupVisibility,
              markers,
            };
          });

          if (isTauri()) {
            void markersApi.renameGroup(oldNormalized, newNormalized).then(reconcileRemote).catch((err) => logger.error('Failed to rename group in Tauri', err));
          }
        },

        // ========== Tauri sync ==========
        _tauriInitialized: false,

        syncWithTauri: async () => {
          if (!isTauri() || get()._tauriInitialized) return;

          try {
            const remote = await markersApi.load();
            const localSnapshot = getLocalSnapshot(get());
            const merged = mergeMarkerSnapshots(localSnapshot, remote);
            applySnapshot(merged);
            set({ _tauriInitialized: true });

            await markersApi.save(toTauriSnapshot(merged));
          } catch (error) {
            logger.error('Failed to sync markers with Tauri', error);
          }
        },

        // ========== Getters ==========
        getMarkersByGroup: (group) => {
          const state = get();
          if (!group) return state.markers;
          return state.markers.filter((m) => m.group === group);
        },

        getVisibleMarkers: () => {
          const state = get();
          return state.markers.filter((m) => isEffectivelyVisible(m, state.showMarkers, state.groupVisibility));
        },

        getVisibleMarkersByGroup: (group) => {
          const state = get();
          const normalized = normalizeGroup(group);
          if (!normalized) return [];
          return state.markers.filter((m) => markerGroup(m) === normalized && isEffectivelyVisible(m, state.showMarkers, state.groupVisibility));
        },

        isGroupVisible: (group) => {
          const normalized = normalizeGroup(group) ?? DEFAULT_GROUP;
          return get().groupVisibility[normalized] ?? true;
        },

        isMarkerEffectivelyVisible: (marker) => {
          const state = get();
          return isEffectivelyVisible(marker, state.showMarkers, state.groupVisibility);
        },

        // ========== Import/Export ==========
        exportMarkers: () => {
          const state = get();
          const groups = ensureGroups(state.groups, state.markers);
          const data = {
            version: 3,
            markers: state.markers.map(normalizeMarker),
            groups,
            groupVisibility: ensureGroupVisibility(groups, state.groupVisibility),
            showMarkers: state.showMarkers,
            showMarkersUpdatedAt: state.showMarkersUpdatedAt,
          };
          return JSON.stringify(data, null, 2);
        },

        importMarkers: (json) => {
          try {
            let parsed: ImportPayload | unknown[];
            try {
              parsed = JSON.parse(json) as ImportPayload | unknown[];
            } catch {
              throw new Error('Invalid marker import JSON');
            }

            const payload: ImportPayload = Array.isArray(parsed) ? { markers: parsed, version: 1 } : parsed;
            const sourceMarkers = Array.isArray(payload.markers) ? payload.markers : [];

            if (sourceMarkers.length === 0) {
              throw new Error('No markers found in import data');
            }

            const now = Date.now();
            const state = get();
            const requested = sourceMarkers.length;
            const remaining = Math.max(0, MAX_MARKERS - state.markers.length);
            const imported = sourceMarkers.slice(0, remaining).map((m, i) => parseImportedMarker(m, i, now));
            const importedGroups = Array.isArray(payload.groups)
              ? payload.groups.map(normalizeGroup).filter((g): g is string => Boolean(g))
              : [];
            const importedGroupVisibility = normalizeGroupVisibilityInput(payload.groupVisibility ?? payload.group_visibility);
            const visibilityGroups = Object.keys(importedGroupVisibility);

            const importedShowMarkers =
              typeof payload.showMarkers === 'boolean'
                ? payload.showMarkers
                : (typeof payload.show_markers === 'boolean' ? payload.show_markers : undefined);
            const importedShowTs =
              toFiniteNumber(payload.showMarkersUpdatedAt)
              ?? toFiniteNumber(payload.show_markers_updated_at)
              ?? now;

            const nextMarkers = [...state.markers, ...imported];
            const nextGroups = ensureGroups(
              [...state.groups, ...importedGroups, ...visibilityGroups],
              nextMarkers,
            );
            const nextGroupVisibility = ensureGroupVisibility(nextGroups, {
              ...state.groupVisibility,
              ...importedGroupVisibility,
            });

            const nextSnapshot: MarkerSnapshot = {
              markers: nextMarkers,
              groups: nextGroups,
              groupVisibility: nextGroupVisibility,
              showMarkers: importedShowMarkers ?? state.showMarkers,
              showMarkersUpdatedAt: importedShowMarkers !== undefined ? importedShowTs : state.showMarkersUpdatedAt,
            };

            applySnapshot(nextSnapshot);

            if (isTauri()) {
              void markersApi.save(toTauriSnapshot(nextSnapshot)).catch((error) =>
                logger.error('Failed to persist imported markers to Tauri', error)
              );
            }

            return {
              count: imported.length,
              requested,
              truncated: imported.length < requested,
            };
          } catch (error) {
            logger.error('Failed to import markers', error);
            if (error instanceof Error) throw error;
            throw new Error('Failed to import markers');
          }
        },
      };
    },
    {
      name: 'starmap-markers',
      storage: getZustandStorage(),
      partialize: (state) => ({
        markers: state.markers,
        groups: state.groups,
        groupVisibility: state.groupVisibility,
        showMarkers: state.showMarkers,
        showMarkersUpdatedAt: state.showMarkersUpdatedAt,
        showLabels: state.showLabels,
        globalMarkerSize: state.globalMarkerSize,
        sortBy: state.sortBy,
        showOffscreenIndicators: state.showOffscreenIndicators,
        // movingMarkerId is deliberately session-only.
      }),
    }
  )
);
