import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getZustandStorage } from '@/lib/storage';

export type CatalogSourceType = 'simbad' | 'vizier' | 'ned';

export interface AladinCatalogLayer {
  id: string;
  type: CatalogSourceType;
  name: string;
  enabled: boolean;
  color: string;
  radius: number;
  limit: number;
  vizierCatId?: string;
}

export interface AladinImageOverlayLayer {
  id: string;
  name: string;
  surveyId: string;
  surveyUrl?: string;
  enabled: boolean;
  opacity: number;
  additive: boolean;
}

export interface AladinMOCLayer {
  id: string;
  name: string;
  url?: string;
  json?: Record<string, number[]>;
  color: string;
  opacity: number;
  lineWidth: number;
  visible: boolean;
}

export type AladinFitsMode = 'base' | 'overlay';

export interface AladinFitsLayer {
  id: string;
  name: string;
  url: string;
  mode: AladinFitsMode;
  enabled: boolean;
  opacity: number;
  /** Colormap name applied to the FITS pixels ('native' / undefined = engine default). */
  colormap?: string;
  /** Stretch function for the colormap: linear | log | sqrt | asinh | pow. */
  stretch?: string;
  /** Pixel-value cut range for the stretch. */
  minCut?: number;
  maxCut?: number;
}

interface AddCatalogLayerInput extends Omit<AladinCatalogLayer, 'id'> {
  id?: string;
}

interface AddOverlayLayerInput extends Omit<AladinImageOverlayLayer, 'id'> {
  id?: string;
}

interface AddMocLayerInput extends Omit<AladinMOCLayer, 'id'> {
  id?: string;
}

interface AddFitsLayerInput extends Omit<AladinFitsLayer, 'id'> {
  id?: string;
}

interface AladinState {
  catalogLayers: AladinCatalogLayer[];
  imageOverlayLayers: AladinImageOverlayLayer[];
  mocLayers: AladinMOCLayer[];
  fitsLayers: AladinFitsLayer[];

  setCatalogLayers: (layers: AladinCatalogLayer[]) => void;
  upsertCatalogLayer: (layer: AddCatalogLayerInput) => void;
  updateCatalogLayer: (id: string, patch: Partial<AladinCatalogLayer>) => void;
  toggleCatalogLayer: (id: string) => void;
  removeCatalogLayer: (id: string) => void;

  addImageOverlayLayer: (layer: AddOverlayLayerInput) => string;
  updateImageOverlayLayer: (id: string, patch: Partial<AladinImageOverlayLayer>) => void;
  toggleImageOverlayLayer: (id: string) => void;
  removeImageOverlayLayer: (id: string) => void;

  addMocLayer: (layer: AddMocLayerInput) => string;
  updateMocLayer: (id: string, patch: Partial<AladinMOCLayer>) => void;
  toggleMocLayer: (id: string) => void;
  removeMocLayer: (id: string) => void;

  addFitsLayer: (layer: AddFitsLayerInput) => string;
  updateFitsLayer: (id: string, patch: Partial<AladinFitsLayer>) => void;
  toggleFitsLayer: (id: string) => void;
  removeFitsLayer: (id: string) => void;

  resetAladinLayers: () => void;
}

const DEFAULT_CATALOG_LAYERS: AladinCatalogLayer[] = [
  {
    id: 'simbad',
    type: 'simbad',
    name: 'SIMBAD',
    enabled: false,
    color: '#ff9800',
    radius: 0.5,
    limit: 1000,
  },
  {
    id: 'ned',
    type: 'ned',
    name: 'NED',
    enabled: false,
    color: '#4caf50',
    radius: 0.5,
    limit: 500,
  },
  {
    id: 'vizier-tycho2',
    type: 'vizier',
    name: 'Tycho-2',
    enabled: false,
    color: '#2196f3',
    vizierCatId: 'I/259/tyc2',
    radius: 0.25,
    limit: 5000,
  },
  {
    id: 'vizier-ucac4',
    type: 'vizier',
    name: 'UCAC4',
    enabled: false,
    color: '#9c27b0',
    vizierCatId: 'I/322A/out',
    radius: 0.1,
    limit: 5000,
  },
];

const DEFAULT_STATE = {
  catalogLayers: DEFAULT_CATALOG_LAYERS,
  imageOverlayLayers: [] as AladinImageOverlayLayer[],
  mocLayers: [] as AladinMOCLayer[],
  fitsLayers: [] as AladinFitsLayer[],
};

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function upsertById<T extends { id: string }>(items: T[], next: T): T[] {
  const idx = items.findIndex((item) => item.id === next.id);
  if (idx === -1) {
    return [...items, next];
  }
  const clone = [...items];
  clone[idx] = next;
  return clone;
}

export const useAladinStore = create<AladinState>()(
  persist(
    (set) => ({
      ...DEFAULT_STATE,

      setCatalogLayers: (layers) => set({ catalogLayers: layers }),
      upsertCatalogLayer: (layer) => set((state) => {
        const nextLayer: AladinCatalogLayer = {
          ...layer,
          id: layer.id ?? makeId('catalog'),
        };
        return { catalogLayers: upsertById(state.catalogLayers, nextLayer) };
      }),
      updateCatalogLayer: (id, patch) => set((state) => ({
        catalogLayers: state.catalogLayers.map((layer) =>
          layer.id === id ? { ...layer, ...patch } : layer
        ),
      })),
      toggleCatalogLayer: (id) => set((state) => ({
        catalogLayers: state.catalogLayers.map((layer) =>
          layer.id === id ? { ...layer, enabled: !layer.enabled } : layer
        ),
      })),
      removeCatalogLayer: (id) => set((state) => ({
        catalogLayers: state.catalogLayers.filter((layer) => layer.id !== id),
      })),

      addImageOverlayLayer: (layer) => {
        const id = layer.id ?? makeId('overlay');
        set((state) => ({
          imageOverlayLayers: [
            ...state.imageOverlayLayers,
            {
              ...layer,
              id,
            },
          ],
        }));
        return id;
      },
      updateImageOverlayLayer: (id, patch) => set((state) => ({
        imageOverlayLayers: state.imageOverlayLayers.map((layer) =>
          layer.id === id ? { ...layer, ...patch } : layer
        ),
      })),
      toggleImageOverlayLayer: (id) => set((state) => ({
        imageOverlayLayers: state.imageOverlayLayers.map((layer) =>
          layer.id === id ? { ...layer, enabled: !layer.enabled } : layer
        ),
      })),
      removeImageOverlayLayer: (id) => set((state) => ({
        imageOverlayLayers: state.imageOverlayLayers.filter((layer) => layer.id !== id),
      })),

      addMocLayer: (layer) => {
        const id = layer.id ?? makeId('moc');
        set((state) => ({
          mocLayers: [
            ...state.mocLayers,
            {
              ...layer,
              id,
            },
          ],
        }));
        return id;
      },
      updateMocLayer: (id, patch) => set((state) => ({
        mocLayers: state.mocLayers.map((layer) =>
          layer.id === id ? { ...layer, ...patch } : layer
        ),
      })),
      toggleMocLayer: (id) => set((state) => ({
        mocLayers: state.mocLayers.map((layer) =>
          layer.id === id ? { ...layer, visible: !layer.visible } : layer
        ),
      })),
      removeMocLayer: (id) => set((state) => ({
        mocLayers: state.mocLayers.filter((layer) => layer.id !== id),
      })),

      addFitsLayer: (layer) => {
        const id = layer.id ?? makeId('fits');
        set((state) => ({
          fitsLayers: [
            ...state.fitsLayers,
            {
              ...layer,
              id,
            },
          ],
        }));
        return id;
      },
      updateFitsLayer: (id, patch) => set((state) => ({
        fitsLayers: state.fitsLayers.map((layer) =>
          layer.id === id ? { ...layer, ...patch } : layer
        ),
      })),
      toggleFitsLayer: (id) => set((state) => ({
        fitsLayers: state.fitsLayers.map((layer) =>
          layer.id === id ? { ...layer, enabled: !layer.enabled } : layer
        ),
      })),
      removeFitsLayer: (id) => set((state) => ({
        fitsLayers: state.fitsLayers.filter((layer) => layer.id !== id),
      })),

      resetAladinLayers: () => set(DEFAULT_STATE),
    }),
    {
      name: 'aladin-layers-store',
      storage: getZustandStorage(),
      version: 1,
      partialize: (state) => ({
        catalogLayers: state.catalogLayers,
        imageOverlayLayers: state.imageOverlayLayers,
        mocLayers: state.mocLayers,
        fitsLayers: state.fitsLayers,
      }),
    }
  )
);
