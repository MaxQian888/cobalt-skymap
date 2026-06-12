/**
 * Plate Solver Store
 * Zustand store for managing plate solver state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createLogger } from '@/lib/logger';
import { getZustandStorage } from '@/lib/storage';
import { isTauri } from '@/lib/storage/platform';
import {
  createInitialOnlineSolveSessionState,
  deriveOnlineSolverReadiness,
  type OnlineSolveSessionState,
} from '@/lib/plate-solving/online-solve-contract';
import type {
  OnlineServiceStatus,
  OnlineSolverReadiness,
} from '@/lib/plate-solving/online-solve-types';
import { secretVaultApi } from '@/lib/tauri/secret-vault-api';
import type {
  SolverType,
  SolverInfo,
  SolverConfig,
  SolveResult,
  IndexInfo,
  DownloadableIndex,
  AstapDatabaseInfo,
  ImageAnalysisResult,
  OnlineSolveProgress,
} from '@/lib/tauri/plate-solver-api';
import type { SolveHistoryEntry } from '@/types/starmap/plate-solving';
import {
  detectPlateSolvers,
  loadSolverConfig,
  saveSolverConfig,
  getAvailableIndexes,
  getInstalledIndexes,
  getAstapDatabases,
  downloadAstapDatabase as downloadAstapDatabaseApi,
  analyseImage as analyseImageApi,
  DEFAULT_SOLVER_CONFIG,
} from '@/lib/tauri/plate-solver-api';

const MAX_HISTORY_ENTRIES = 50;
const logger = createLogger('plate-solver-store');

// ============================================================================
// Types
// ============================================================================

export type SolveStatus = 'idle' | 'preparing' | 'solving' | 'success' | 'failed';

export interface PlateSolverState {
  // Detected solvers
  detectedSolvers: SolverInfo[];
  isDetecting: boolean;
  detectionError: string | null;
  
  // Current configuration
  config: SolverConfig;
  
  // Online API key (for astrometry.net online)
  onlineApiKey: string;
  onlineServiceStatus: OnlineServiceStatus;
  
  // Solve state
  solveStatus: SolveStatus;
  solveProgress: number;
  solveMessage: string;
  lastResult: SolveResult | null;
  
  // Index management
  availableIndexes: DownloadableIndex[];
  installedIndexes: IndexInfo[];
  isLoadingIndexes: boolean;
  
  // Download state
  downloadingIndexes: Map<string, { progress: number; status: string }>;
  
  // ASTAP databases
  astapDatabases: AstapDatabaseInfo[];
  isLoadingAstapDatabases: boolean;
  
  // Image analysis
  imageAnalysis: ImageAnalysisResult | null;
  isAnalysingImage: boolean;
  
  // Online solve progress
  onlineSolveProgress: OnlineSolveProgress | null;
  onlineSession: OnlineSolveSessionState;
  
  // Solve history
  solveHistory: SolveHistoryEntry[];
  
  // Actions
  detectSolvers: () => Promise<void>;
  setConfig: (config: Partial<SolverConfig>) => void;
  saveConfig: () => Promise<void>;
  loadConfig: () => Promise<void>;
  setOnlineApiKey: (key: string) => void;
  setOnlineServiceStatus: (status: OnlineServiceStatus) => void;
  setSolveStatus: (status: SolveStatus, message?: string, progress?: number) => void;
  setLastResult: (result: SolveResult | null) => void;
  loadAvailableIndexes: (solverType: SolverType) => Promise<void>;
  loadInstalledIndexes: (solverType: SolverType, indexPath?: string) => Promise<void>;
  setDownloadProgress: (fileName: string, progress: number, status: string) => void;
  clearDownloadProgress: (fileName: string) => void;
  loadAstapDatabases: () => Promise<void>;
  downloadAstapDatabase: (database: AstapDatabaseInfo, destDir: string) => Promise<void>;
  analyseImage: (imagePath: string, snrMinimum?: number) => Promise<void>;
  setOnlineSolveProgress: (progress: OnlineSolveProgress | null) => void;
  setOnlineSession: (session: OnlineSolveSessionState | null) => void;
  clearImageAnalysis: () => void;
  addToHistory: (entry: Omit<SolveHistoryEntry, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  detectedSolvers: [] as SolverInfo[],
  isDetecting: false,
  detectionError: null as string | null,
  config: DEFAULT_SOLVER_CONFIG,
  onlineApiKey: '',
  onlineServiceStatus: {
    status: 'unknown',
    checkedAt: null,
    message: null,
  } as OnlineServiceStatus,
  solveStatus: 'idle' as SolveStatus,
  solveProgress: 0,
  solveMessage: '',
  lastResult: null as SolveResult | null,
  availableIndexes: [] as DownloadableIndex[],
  installedIndexes: [] as IndexInfo[],
  isLoadingIndexes: false,
  downloadingIndexes: new Map<string, { progress: number; status: string }>(),
  astapDatabases: [] as AstapDatabaseInfo[],
  isLoadingAstapDatabases: false,
  imageAnalysis: null as ImageAnalysisResult | null,
  isAnalysingImage: false,
  onlineSolveProgress: null as OnlineSolveProgress | null,
  onlineSession: createInitialOnlineSolveSessionState(),
  solveHistory: [] as SolveHistoryEntry[],
};

// ============================================================================
// Store
// ============================================================================

export const usePlateSolverStore = create<PlateSolverState>()(
  persist(
    (set, get) => ({
      ...initialState,

      detectSolvers: async () => {
        set({ isDetecting: true, detectionError: null });
        try {
          const solvers = await detectPlateSolvers();
          set({ detectedSolvers: solvers, isDetecting: false });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Detection failed';
          set({ detectionError: message, isDetecting: false });
        }
      },

      setConfig: (partialConfig) => {
        set((state) => ({
          config: { ...state.config, ...partialConfig },
        }));
      },

      saveConfig: async () => {
        const { config, onlineApiKey } = get();
        try {
          await saveSolverConfig(config);
          if (isTauri()) {
            const trimmedKey = onlineApiKey.trim();
            if (trimmedKey) {
              await secretVaultApi.setPlateSolverApiKey(trimmedKey);
            } else {
              await secretVaultApi.deletePlateSolverApiKey();
            }
          }
        } catch (error) {
          logger.error('Failed to save solver config', error);
        }
      },

      loadConfig: async () => {
        try {
          const config = await loadSolverConfig();
          const nextState: Partial<PlateSolverState> = {
            config: {
              ...DEFAULT_SOLVER_CONFIG,
              ...get().config,
              ...(config ?? DEFAULT_SOLVER_CONFIG),
            },
          };
          if (isTauri()) {
            const storedKey = await secretVaultApi.getPlateSolverApiKey();
            const legacyKey = get().onlineApiKey.trim();

            if (!storedKey && legacyKey) {
              await secretVaultApi.setPlateSolverApiKey(legacyKey);
              nextState.onlineApiKey = legacyKey;
            } else if (storedKey) {
              nextState.onlineApiKey = storedKey;
            }
          }

          set(nextState as Partial<PlateSolverState>);
        } catch (error) {
          logger.error('Failed to load solver config', error);
          // Use default config
          set({ config: DEFAULT_SOLVER_CONFIG });
        }
      },

      setOnlineApiKey: (key) => {
        set({ onlineApiKey: key });
      },

      setOnlineServiceStatus: (status) => {
        set({ onlineServiceStatus: status });
      },

      setSolveStatus: (status, message = '', progress = 0) => {
        set({ solveStatus: status, solveMessage: message, solveProgress: progress });
      },

      setLastResult: (result) => {
        set({ lastResult: result });
      },

      loadAvailableIndexes: async (solverType) => {
        set({ isLoadingIndexes: true });
        try {
          const indexes = await getAvailableIndexes(solverType);
          set({ availableIndexes: indexes, isLoadingIndexes: false });
        } catch (error) {
          logger.error('Failed to load available indexes', error);
          set({ isLoadingIndexes: false });
        }
      },

      loadInstalledIndexes: async (solverType, indexPath) => {
        set({ isLoadingIndexes: true });
        try {
          const indexes = await getInstalledIndexes(solverType, indexPath);
          set({ installedIndexes: indexes, isLoadingIndexes: false });
        } catch (error) {
          logger.error('Failed to load installed indexes', error);
          set({ isLoadingIndexes: false });
        }
      },

      setDownloadProgress: (fileName, progress, status) => {
        set((state) => {
          const newMap = new Map(state.downloadingIndexes);
          newMap.set(fileName, { progress, status });
          return { downloadingIndexes: newMap };
        });
      },

      clearDownloadProgress: (fileName) => {
        set((state) => {
          const newMap = new Map(state.downloadingIndexes);
          newMap.delete(fileName);
          return { downloadingIndexes: newMap };
        });
      },

      loadAstapDatabases: async () => {
        set({ isLoadingAstapDatabases: true });
        try {
          const databases = await getAstapDatabases();
          set({ astapDatabases: databases, isLoadingAstapDatabases: false });
        } catch (error) {
          logger.error('Failed to load ASTAP databases', error);
          set({ isLoadingAstapDatabases: false });
        }
      },

      downloadAstapDatabase: async (database, destDir) => {
        set((state) => {
          const m = new Map(state.downloadingIndexes);
          m.set(database.name, { progress: 0, status: 'downloading' });
          return { downloadingIndexes: m };
        });
        try {
          await downloadAstapDatabaseApi(database, destDir);
          await get().loadAstapDatabases();
        } catch (error) {
          logger.error('Failed to download ASTAP database', error);
          set((state) => {
            const m = new Map(state.downloadingIndexes);
            m.set(database.name, { progress: 0, status: 'error' });
            return { downloadingIndexes: m };
          });
          throw error;
        } finally {
          set((state) => {
            const m = new Map(state.downloadingIndexes);
            m.delete(database.name);
            return { downloadingIndexes: m };
          });
        }
      },

      analyseImage: async (imagePath, snrMinimum) => {
        set({ isAnalysingImage: true, imageAnalysis: null });
        try {
          const result = await analyseImageApi(imagePath, snrMinimum);
          set({ imageAnalysis: result, isAnalysingImage: false });
        } catch (error) {
          logger.error('Failed to analyse image', error);
          set({
            isAnalysingImage: false,
            imageAnalysis: {
              success: false,
              median_hfd: null,
              star_count: 0,
              background: null,
              noise: null,
              stars: [],
              error_message: error instanceof Error ? error.message : 'Analysis failed',
            },
          });
        }
      },

      setOnlineSolveProgress: (progress) => {
        set({ onlineSolveProgress: progress });
      },

      setOnlineSession: (session) => {
        set({ onlineSession: session ?? createInitialOnlineSolveSessionState() });
      },

      clearImageAnalysis: () => {
        set({ imageAnalysis: null });
      },

      addToHistory: (entry) => {
        set((state) => {
          const newEntry: SolveHistoryEntry = {
            ...entry,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now(),
          };
          const history = [newEntry, ...state.solveHistory].slice(0, MAX_HISTORY_ENTRIES);
          return { solveHistory: history };
        });
      },

      clearHistory: () => {
        set({ solveHistory: [] });
      },

      reset: () => {
        set({
          solveStatus: 'idle',
          solveProgress: 0,
          solveMessage: '',
          lastResult: null,
          imageAnalysis: null,
          onlineSolveProgress: null,
          onlineSession: createInitialOnlineSolveSessionState(),
        });
      },
    }),
    {
      name: 'plate-solver-storage',
      storage: getZustandStorage(),
      partialize: (state) => ({
        config: state.config,
        solveHistory: state.solveHistory,
      }),
    }
  )
);

if (typeof window !== 'undefined') {
  const state = usePlateSolverStore.getState();
  if (state.onlineApiKey) {
    void state.loadConfig();
  }
}

// ============================================================================
// Selectors
// ============================================================================

export const selectActiveSolver = (state: PlateSolverState): SolverInfo | undefined => {
  const solvers = selectDetectedSolversWithReadiness(state);
  const config = state.config ?? DEFAULT_SOLVER_CONFIG;
  return solvers.find(
    (solver) => solver.solver_type === config.solver_type
  );
};

export const selectOnlineSolverReadiness = (
  state: PlateSolverState
): OnlineSolverReadiness => deriveOnlineSolverReadiness({
  apiKey: state.onlineApiKey,
  networkAvailable: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  serviceStatus: state.onlineServiceStatus,
});

let cachedDetectedSolversInput: SolverInfo[] | null = null;
let cachedOnlineReadinessKey = '';
let cachedDetectedSolversWithReadiness: SolverInfo[] = [];

function getOnlineReadinessKey(readiness: OnlineSolverReadiness): string {
  return [
    readiness.state,
    readiness.reason,
    readiness.message ?? '',
    readiness.canStart ? '1' : '0',
  ].join('|');
}

export const selectDetectedSolversWithReadiness = (
  state: PlateSolverState
): SolverInfo[] => {
  const detectedSolvers = state.detectedSolvers ?? [];
  const readiness = selectOnlineSolverReadiness(state);
  const readinessKey = getOnlineReadinessKey(readiness);

  if (
    cachedDetectedSolversInput === detectedSolvers
    && cachedOnlineReadinessKey === readinessKey
  ) {
    return cachedDetectedSolversWithReadiness;
  }

  cachedDetectedSolversInput = detectedSolvers;
  cachedOnlineReadinessKey = readinessKey;
  cachedDetectedSolversWithReadiness = detectedSolvers.map((solver) => {
    if (solver.solver_type !== 'astrometry_net_online') {
      return solver;
    }

    const nextAvailabilityReason = readiness.state === 'ready' ? null : readiness.message;
    if (
      solver.is_available === readiness.canStart
      && (solver.availability_reason ?? null) === (nextAvailabilityReason ?? null)
    ) {
      return solver;
    }

    return {
      ...solver,
      is_available: readiness.canStart,
      availability_reason: nextAvailabilityReason,
    };
  });

  return cachedDetectedSolversWithReadiness;
};

export const selectIsLocalSolverAvailable = (state: PlateSolverState): boolean => {
  const activeSolver = selectActiveSolver(state);
  if (!activeSolver) return false;
  if (activeSolver.solver_type === 'astrometry_net_online') {
    return selectOnlineSolverReadiness(state).canStart;
  }
  return activeSolver.is_available;
};

export const selectCanSolve = (state: PlateSolverState): boolean => {
  const config = state.config ?? DEFAULT_SOLVER_CONFIG;
  if (config.solver_type === 'astrometry_net_online') {
    return selectOnlineSolverReadiness(state).canStart;
  }
  return selectIsLocalSolverAvailable(state);
};

export const selectOnlineSession = (state: PlateSolverState): OnlineSolveSessionState =>
  state.onlineSession;
