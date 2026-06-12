/**
 * Tests for plate-solver-store.ts
 */

import { act, renderHook } from '@testing-library/react';
import {
  usePlateSolverStore,
  selectActiveSolver,
  selectIsLocalSolverAvailable,
  selectCanSolve,
  selectDetectedSolversWithReadiness,
  selectOnlineSolverReadiness,
} from '../plate-solver-store';
import type { SolverInfo } from '@/lib/tauri/plate-solver-api';

// Mock Tauri API
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

// Mock the plate-solver-api module
jest.mock('@/lib/tauri/plate-solver-api', () => ({
  detectPlateSolvers: jest.fn(),
  loadSolverConfig: jest.fn(),
  saveSolverConfig: jest.fn(),
  getAvailableIndexes: jest.fn(),
  getInstalledIndexes: jest.fn(),
  getAstapDatabases: jest.fn(),
  downloadAstapDatabase: jest.fn(),
  analyseImage: jest.fn(),
  DEFAULT_SOLVER_CONFIG: {
    solver_type: 'astap',
    executable_path: null,
    index_path: null,
    timeout_seconds: 120,
    downsample: 0,
    search_radius: 30.0,
    use_sip: true,
    astap_database: null,
    astap_max_stars: 500,
    astap_tolerance: 0.007,
    astap_speed_mode: 'auto',
    astap_min_star_size: 1.5,
    astap_equalise_background: false,
    astrometry_scale_low: null,
    astrometry_scale_high: null,
    astrometry_scale_units: 'deg_width',
    astrometry_depth: null,
    astrometry_no_plots: true,
    astrometry_no_verify: false,
    astrometry_crpix_center: true,
    keep_wcs_file: true,
    auto_hints: true,
    retry_on_failure: false,
    max_retries: 2,
  },
}));

const mockDetectPlateSolvers = jest.requireMock('@/lib/tauri/plate-solver-api').detectPlateSolvers;
const mockLoadSolverConfig = jest.requireMock('@/lib/tauri/plate-solver-api').loadSolverConfig;
const mockSaveSolverConfig = jest.requireMock('@/lib/tauri/plate-solver-api').saveSolverConfig;
const mockGetAstapDatabases = jest.requireMock('@/lib/tauri/plate-solver-api').getAstapDatabases;
const mockDownloadAstapDatabase = jest.requireMock(
  '@/lib/tauri/plate-solver-api'
).downloadAstapDatabase;
const mockAnalyseImage = jest.requireMock('@/lib/tauri/plate-solver-api').analyseImage;

describe('usePlateSolverStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    usePlateSolverStore.setState({
      detectedSolvers: [],
      isDetecting: false,
      detectionError: null,
      config: {
        solver_type: 'astap',
        executable_path: null,
        index_path: null,
        timeout_seconds: 120,
        downsample: 0,
        search_radius: 30.0,
        use_sip: true,
        astap_database: null,
        astap_max_stars: 500,
        astap_tolerance: 0.007,
        astap_speed_mode: 'auto',
        astap_min_star_size: 1.5,
        astap_equalise_background: false,
        astrometry_scale_low: null,
        astrometry_scale_high: null,
        astrometry_scale_units: 'deg_width',
        astrometry_depth: null,
        astrometry_no_plots: true,
        astrometry_no_verify: false,
        astrometry_crpix_center: true,
        keep_wcs_file: true,
        auto_hints: true,
        retry_on_failure: false,
        max_retries: 2,
      },
      onlineApiKey: '',
      solveStatus: 'idle',
      solveProgress: 0,
      solveMessage: '',
      lastResult: null,
      availableIndexes: [],
      installedIndexes: [],
      isLoadingIndexes: false,
      downloadingIndexes: new Map(),
      astapDatabases: [],
      isLoadingAstapDatabases: false,
      imageAnalysis: null,
      isAnalysingImage: false,
      onlineSolveProgress: null,
      onlineServiceStatus: {
        status: 'unknown',
        checkedAt: null,
        message: null,
      },
      solveHistory: [],
    });
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => usePlateSolverStore());

      expect(result.current.detectedSolvers).toEqual([]);
      expect(result.current.isDetecting).toBe(false);
      expect(result.current.detectionError).toBeNull();
      expect(result.current.config.solver_type).toBe('astap');
      expect(result.current.onlineApiKey).toBe('');
      expect(result.current.solveStatus).toBe('idle');
    });
  });

  describe('setConfig', () => {
    it('should update config partially', () => {
      const { result } = renderHook(() => usePlateSolverStore());

      act(() => {
        result.current.setConfig({ timeout_seconds: 180 });
      });

      expect(result.current.config.timeout_seconds).toBe(180);
      expect(result.current.config.solver_type).toBe('astap'); // unchanged
    });

    it('should update solver type', () => {
      const { result } = renderHook(() => usePlateSolverStore());

      act(() => {
        result.current.setConfig({ solver_type: 'astrometry_net' });
      });

      expect(result.current.config.solver_type).toBe('astrometry_net');
    });
  });

  describe('setOnlineApiKey', () => {
    it('should update API key', () => {
      const { result } = renderHook(() => usePlateSolverStore());

      act(() => {
        result.current.setOnlineApiKey('test-api-key');
      });

      expect(result.current.onlineApiKey).toBe('test-api-key');
    });
  });

  describe('persistence hardening', () => {
    it('should omit raw onlineApiKey from persisted state', () => {
      const partialize = usePlateSolverStore.persist.getOptions().partialize;

      if (!partialize) {
        throw new Error('persist partialize should be defined');
      }

      const persisted = partialize({
        ...usePlateSolverStore.getState(),
        onlineApiKey: 'persisted-secret',
      });

      expect(persisted).not.toHaveProperty('onlineApiKey');
    });
  });

  describe('setSolveStatus', () => {
    it('should update solve status', () => {
      const { result } = renderHook(() => usePlateSolverStore());

      act(() => {
        result.current.setSolveStatus('solving', 'Processing...', 50);
      });

      expect(result.current.solveStatus).toBe('solving');
      expect(result.current.solveMessage).toBe('Processing...');
      expect(result.current.solveProgress).toBe(50);
    });
  });

  describe('reset', () => {
    it('should reset solve state', () => {
      const { result } = renderHook(() => usePlateSolverStore());

      // Set some state first
      act(() => {
        result.current.setSolveStatus('success', 'Done', 100);
        result.current.setLastResult({
          success: true,
          ra: 180,
          dec: 45,
          ra_hms: '12h00m00s',
          dec_dms: '+45°00\'00"',
          position_angle: 0,
          pixel_scale: 1,
          fov_width: 2,
          fov_height: 1.5,
          flipped: false,
          solver_name: 'ASTAP',
          solve_time_ms: 5000,
          error_message: null,
          wcs_file: null,
        });
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.solveStatus).toBe('idle');
      expect(result.current.solveProgress).toBe(0);
      expect(result.current.solveMessage).toBe('');
      expect(result.current.lastResult).toBeNull();
    });
  });

  describe('detectSolvers', () => {
    it('should detect solvers successfully', async () => {
      const mockSolvers: SolverInfo[] = [
        {
          solver_type: 'astap',
          name: 'ASTAP',
          version: '1.0',
          executable_path: '/path/to/astap',
          is_available: true,
          index_path: '/path/to/indexes',
          installed_indexes: [],
        },
      ];
      mockDetectPlateSolvers.mockResolvedValueOnce(mockSolvers);

      const { result } = renderHook(() => usePlateSolverStore());

      await act(async () => {
        await result.current.detectSolvers();
      });

      expect(result.current.detectedSolvers).toEqual(mockSolvers);
      expect(result.current.isDetecting).toBe(false);
      expect(result.current.detectionError).toBeNull();
    });

    it('should handle detection error', async () => {
      mockDetectPlateSolvers.mockRejectedValueOnce(new Error('Detection failed'));

      const { result } = renderHook(() => usePlateSolverStore());

      await act(async () => {
        await result.current.detectSolvers();
      });

      expect(result.current.detectedSolvers).toEqual([]);
      expect(result.current.isDetecting).toBe(false);
      expect(result.current.detectionError).toBe('Detection failed');
    });
  });

  describe('saveConfig', () => {
    it('should save config', async () => {
      mockSaveSolverConfig.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => usePlateSolverStore());

      await act(async () => {
        await result.current.saveConfig();
      });

      expect(mockSaveSolverConfig).toHaveBeenCalledWith(result.current.config);
    });
  });

  describe('loadConfig', () => {
    it('should load config successfully', async () => {
      const mockConfig = {
        solver_type: 'astrometry_net' as const,
        executable_path: '/custom/path',
        index_path: '/index/path',
        timeout_seconds: 200,
        downsample: 2,
        search_radius: 45.0,
        use_sip: false,
      };
      mockLoadSolverConfig.mockResolvedValueOnce(mockConfig);

      const { result } = renderHook(() => usePlateSolverStore());

      await act(async () => {
        await result.current.loadConfig();
      });

      expect(result.current.config).toEqual(expect.objectContaining(mockConfig));
    });

    it('should use default config on load error', async () => {
      mockLoadSolverConfig.mockRejectedValueOnce(new Error('Load failed'));

      const { result } = renderHook(() => usePlateSolverStore());

      await act(async () => {
        await result.current.loadConfig();
      });

      expect(result.current.config.solver_type).toBe('astap');
    });
  });

  describe('loadAstapDatabases', () => {
    it('should load ASTAP databases successfully', async () => {
      const mockDatabases = [
        {
          name: 'D50',
          abbreviation: 'd50',
          installed: true,
          path: '/path/to/d50',
          fov_min_deg: 0.3,
          fov_max_deg: 10,
          description: 'Medium database',
          size_mb: 500,
          download_url: null,
        },
      ];
      mockGetAstapDatabases.mockResolvedValueOnce(mockDatabases);

      const { result } = renderHook(() => usePlateSolverStore());

      await act(async () => {
        await result.current.loadAstapDatabases();
      });

      expect(result.current.astapDatabases).toEqual(mockDatabases);
      expect(result.current.isLoadingAstapDatabases).toBe(false);
    });

    it('should handle load error', async () => {
      mockGetAstapDatabases.mockRejectedValueOnce(new Error('Load failed'));

      const { result } = renderHook(() => usePlateSolverStore());

      await act(async () => {
        await result.current.loadAstapDatabases();
      });

      expect(result.current.astapDatabases).toEqual([]);
      expect(result.current.isLoadingAstapDatabases).toBe(false);
    });
  });

  describe('downloadAstapDatabase', () => {
    const db = {
      name: 'D50',
      abbreviation: 'd50',
      installed: false,
      path: null,
      fov_min_deg: 0.3,
      fov_max_deg: 10,
      description: '',
      size_mb: 901,
      download_url: 'https://example/d50.zip/download',
    };

    it('invokes backend with database + destDir then reloads catalog', async () => {
      mockDownloadAstapDatabase.mockResolvedValueOnce(undefined);
      mockGetAstapDatabases.mockResolvedValueOnce([{ ...db, installed: true }]);

      const { result } = renderHook(() => usePlateSolverStore());
      await act(async () => {
        await result.current.downloadAstapDatabase(db, '/data');
      });

      expect(mockDownloadAstapDatabase).toHaveBeenCalledWith(db, '/data');
      // catalog refreshed after install
      expect(mockGetAstapDatabases).toHaveBeenCalled();
      // progress entry cleared on completion
      expect(result.current.downloadingIndexes.has('D50')).toBe(false);
    });

    it('marks error and rethrows on failure', async () => {
      mockDownloadAstapDatabase.mockRejectedValueOnce(new Error('boom'));

      const { result } = renderHook(() => usePlateSolverStore());
      await act(async () => {
        await expect(
          result.current.downloadAstapDatabase(db, '/data')
        ).rejects.toThrow('boom');
      });

      // progress entry cleared in finally even on error
      expect(result.current.downloadingIndexes.has('D50')).toBe(false);
    });
  });

  describe('analyseImage', () => {
    it('should analyse image successfully', async () => {
      const mockResult = {
        success: true,
        median_hfd: 3.5,
        star_count: 150,
        background: 1200,
        noise: 45,
        stars: [],
        error_message: null,
      };
      mockAnalyseImage.mockResolvedValueOnce(mockResult);

      const { result } = renderHook(() => usePlateSolverStore());

      await act(async () => {
        await result.current.analyseImage('/path/to/image.fits');
      });

      expect(result.current.imageAnalysis).toEqual(mockResult);
      expect(result.current.isAnalysingImage).toBe(false);
    });

    it('should handle analysis error', async () => {
      mockAnalyseImage.mockRejectedValueOnce(new Error('Analysis failed'));

      const { result } = renderHook(() => usePlateSolverStore());

      await act(async () => {
        await result.current.analyseImage('/path/to/image.fits');
      });

      expect(result.current.imageAnalysis).toBeDefined();
      expect(result.current.imageAnalysis?.success).toBe(false);
      expect(result.current.imageAnalysis?.error_message).toBe('Analysis failed');
      expect(result.current.isAnalysingImage).toBe(false);
    });
  });

  describe('setOnlineSolveProgress', () => {
    it('should update online solve progress', () => {
      const { result } = renderHook(() => usePlateSolverStore());

      const progress = {
        stage: 'solving',
        progress: 50,
        message: 'Processing...',
        sub_id: 123,
        job_id: 456,
        operation_id: 'op-1',
      };

      act(() => {
        result.current.setOnlineSolveProgress(progress);
      });

      expect(result.current.onlineSolveProgress).toEqual(progress);
    });

    it('should clear online solve progress', () => {
      const { result } = renderHook(() => usePlateSolverStore());

      act(() => {
        result.current.setOnlineSolveProgress({
          stage: 'solving',
          progress: 50,
          message: 'test',
          sub_id: null,
          job_id: null,
          operation_id: null,
        });
      });

      act(() => {
        result.current.setOnlineSolveProgress(null);
      });

      expect(result.current.onlineSolveProgress).toBeNull();
    });
  });

  describe('clearImageAnalysis', () => {
    it('should clear image analysis', () => {
      const { result } = renderHook(() => usePlateSolverStore());

      act(() => {
        usePlateSolverStore.setState({
          imageAnalysis: {
            success: true,
            median_hfd: 3.5,
            star_count: 150,
            background: null,
            noise: null,
            stars: [],
            error_message: null,
          },
        });
      });

      act(() => {
        result.current.clearImageAnalysis();
      });

      expect(result.current.imageAnalysis).toBeNull();
    });
  });

  describe('addToHistory', () => {
    it('should add entry to solve history', () => {
      const { result } = renderHook(() => usePlateSolverStore());

      act(() => {
        result.current.addToHistory({
          imageName: 'test.fits',
          solveMode: 'local',
          result: {
            success: true,
            coordinates: { ra: 180, dec: 45, raHMS: '12h00m00s', decDMS: '+45°00\'00"' },
            positionAngle: 0,
            pixelScale: 1,
            fov: { width: 2, height: 1.5 },
            flipped: false,
            solverName: 'ASTAP',
            solveTime: 5000,
          },
        });
      });

      expect(result.current.solveHistory).toHaveLength(1);
      expect(result.current.solveHistory[0].imageName).toBe('test.fits');
      expect(result.current.solveHistory[0].solveMode).toBe('local');
      expect(result.current.solveHistory[0].id).toBeDefined();
      expect(result.current.solveHistory[0].timestamp).toBeGreaterThan(0);
    });

    it('should prepend new entries (newest first)', () => {
      const { result } = renderHook(() => usePlateSolverStore());

      act(() => {
        result.current.addToHistory({
          imageName: 'first.fits',
          solveMode: 'local',
          result: { success: true, coordinates: null, positionAngle: 0, pixelScale: 0, fov: { width: 0, height: 0 }, flipped: false, solverName: 'ASTAP', solveTime: 1000 },
        });
      });

      act(() => {
        result.current.addToHistory({
          imageName: 'second.fits',
          solveMode: 'online',
          result: { success: false, coordinates: null, positionAngle: 0, pixelScale: 0, fov: { width: 0, height: 0 }, flipped: false, solverName: 'astrometry.net', solveTime: 2000, errorMessage: 'fail' },
        });
      });

      expect(result.current.solveHistory).toHaveLength(2);
      expect(result.current.solveHistory[0].imageName).toBe('second.fits');
      expect(result.current.solveHistory[1].imageName).toBe('first.fits');
    });

    it('should limit history to MAX_HISTORY_ENTRIES', () => {
      const { result } = renderHook(() => usePlateSolverStore());

      act(() => {
        for (let i = 0; i < 55; i++) {
          result.current.addToHistory({
            imageName: `image-${i}.fits`,
            solveMode: 'local',
            result: { success: true, coordinates: null, positionAngle: 0, pixelScale: 0, fov: { width: 0, height: 0 }, flipped: false, solverName: 'ASTAP', solveTime: 100 },
          });
        }
      });

      expect(result.current.solveHistory.length).toBeLessThanOrEqual(50);
    });
  });

  describe('clearHistory', () => {
    it('should clear all history entries', () => {
      const { result } = renderHook(() => usePlateSolverStore());

      act(() => {
        result.current.addToHistory({
          imageName: 'test.fits',
          solveMode: 'local',
          result: { success: true, coordinates: null, positionAngle: 0, pixelScale: 0, fov: { width: 0, height: 0 }, flipped: false, solverName: 'ASTAP', solveTime: 100 },
        });
      });

      expect(result.current.solveHistory).toHaveLength(1);

      act(() => {
        result.current.clearHistory();
      });

      expect(result.current.solveHistory).toHaveLength(0);
    });
  });

  describe('reset with new fields', () => {
    it('should reset image analysis and online progress', () => {
      const { result } = renderHook(() => usePlateSolverStore());

      act(() => {
        usePlateSolverStore.setState({
          solveStatus: 'success',
          imageAnalysis: {
            success: true,
            median_hfd: 3.5,
            star_count: 150,
            background: null,
            noise: null,
            stars: [],
            error_message: null,
          },
          onlineSolveProgress: {
            stage: 'complete',
            progress: 100,
            message: 'Done',
            sub_id: 1,
            job_id: 2,
            operation_id: 'op-2',
          },
        });
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.solveStatus).toBe('idle');
      expect(result.current.imageAnalysis).toBeNull();
      expect(result.current.onlineSolveProgress).toBeNull();
    });
  });
});

describe('selectors', () => {
  beforeEach(() => {
    usePlateSolverStore.setState({
      detectedSolvers: [],
      config: {
        solver_type: 'astap',
        executable_path: null,
        index_path: null,
        timeout_seconds: 120,
        downsample: 0,
        search_radius: 30.0,
        use_sip: true,
        astap_database: null,
        astap_max_stars: 500,
        astap_tolerance: 0.007,
        astap_speed_mode: 'auto',
        astap_min_star_size: 1.5,
        astap_equalise_background: false,
        astrometry_scale_low: null,
        astrometry_scale_high: null,
        astrometry_scale_units: 'deg_width',
        astrometry_depth: null,
        astrometry_no_plots: true,
        astrometry_no_verify: false,
        astrometry_crpix_center: true,
        keep_wcs_file: true,
        auto_hints: true,
        retry_on_failure: false,
        max_retries: 2,
      },
      onlineApiKey: '',
    });
  });

  describe('selectActiveSolver', () => {
    it('should return undefined when no solvers detected', () => {
      const state = usePlateSolverStore.getState();
      expect(selectActiveSolver(state)).toBeUndefined();
    });

    it('should return matching solver', () => {
      const mockSolver: SolverInfo = {
        solver_type: 'astap',
        name: 'ASTAP',
        version: '1.0',
        executable_path: '/path/to/astap',
        is_available: true,
        index_path: '/path/to/indexes',
        installed_indexes: [],
      };

      usePlateSolverStore.setState({ detectedSolvers: [mockSolver] });

      const state = usePlateSolverStore.getState();
      expect(selectActiveSolver(state)).toEqual(mockSolver);
    });
  });

  describe('selectIsLocalSolverAvailable', () => {
    it('should return false when no solver detected', () => {
      const state = usePlateSolverStore.getState();
      expect(selectIsLocalSolverAvailable(state)).toBe(false);
    });

    it('should return true when solver is available', () => {
      const mockSolver: SolverInfo = {
        solver_type: 'astap',
        name: 'ASTAP',
        version: '1.0',
        executable_path: '/path/to/astap',
        is_available: true,
        index_path: '/path/to/indexes',
        installed_indexes: [
          { name: 'D50', file_name: 'D50', path: '/path/to/D50', size_bytes: 500000000, scale_range: { min_arcmin: 18, max_arcmin: 600 }, description: 'Large database' },
        ],
      };

      usePlateSolverStore.setState({ detectedSolvers: [mockSolver] });

      const state = usePlateSolverStore.getState();
      expect(selectIsLocalSolverAvailable(state)).toBe(true);
    });

    it('should return false when solver is not available', () => {
      const mockSolver: SolverInfo = {
        solver_type: 'astap',
        name: 'ASTAP',
        version: null,
        executable_path: '',
        is_available: false,
        index_path: null,
        installed_indexes: [],
      };

      usePlateSolverStore.setState({ detectedSolvers: [mockSolver] });

      const state = usePlateSolverStore.getState();
      expect(selectIsLocalSolverAvailable(state)).toBe(false);
    });

    it('should return true for online solver', () => {
      const mockSolver: SolverInfo = {
        solver_type: 'astrometry_net_online',
        name: 'Astrometry.net (Online)',
        version: 'nova.astrometry.net',
        executable_path: '',
        is_available: true,
        index_path: null,
        installed_indexes: [],
      };

      usePlateSolverStore.setState({
        detectedSolvers: [mockSolver],
        config: { ...usePlateSolverStore.getState().config, solver_type: 'astrometry_net_online' },
        onlineApiKey: 'test-api-key',
        onlineServiceStatus: {
          status: 'reachable',
          checkedAt: Date.now(),
          message: null,
        },
      });

      const state = usePlateSolverStore.getState();
      expect(selectIsLocalSolverAvailable(state)).toBe(true);
    });

    it('should trust solver availability metadata instead of raw index count', () => {
      const mockSolver: SolverInfo = {
        solver_type: 'astap',
        name: 'ASTAP',
        version: '2026.03.05',
        executable_path: '/path/to/astap_cli',
        is_available: true,
        index_path: '/path/to/indexes',
        installed_indexes: [],
        profile_id: 'astap_cli',
        profile_name: 'ASTAP CLI',
        availability_reason: null,
        uses_custom_executable: true,
      } as SolverInfo;

      usePlateSolverStore.setState({ detectedSolvers: [mockSolver] });

      const state = usePlateSolverStore.getState();
      expect(selectIsLocalSolverAvailable(state)).toBe(true);
    });
  });

  describe('selectCanSolve', () => {
    it('should return false for local solver marked unavailable', () => {
      const mockSolver: SolverInfo = {
        solver_type: 'astap',
        name: 'ASTAP',
        version: '1.0',
        executable_path: '/path/to/astap',
        is_available: false,
        index_path: '/path/to/indexes',
        installed_indexes: [],
        availability_reason: 'No ASTAP database found',
      };

      usePlateSolverStore.setState({ detectedSolvers: [mockSolver] });

      const state = usePlateSolverStore.getState();
      expect(selectCanSolve(state)).toBe(false);
    });

    it('should return true for local solver with indexes', () => {
      const mockSolver: SolverInfo = {
        solver_type: 'astap',
        name: 'ASTAP',
        version: '1.0',
        executable_path: '/path/to/astap',
        is_available: true,
        index_path: '/path/to/indexes',
        installed_indexes: [
          {
            name: 'D50',
            file_name: 'D50',
            path: '/path/to/D50',
            size_bytes: 500000000,
            scale_range: null,
            description: null,
          },
        ],
      };

      usePlateSolverStore.setState({ detectedSolvers: [mockSolver] });

      const state = usePlateSolverStore.getState();
      expect(selectCanSolve(state)).toBe(true);
    });

    it('should return false for online solver without API key', () => {
      usePlateSolverStore.setState({
        config: { ...usePlateSolverStore.getState().config, solver_type: 'astrometry_net_online' },
        onlineApiKey: '',
      });

      const state = usePlateSolverStore.getState();
      expect(selectCanSolve(state)).toBe(false);
    });

    it('should return true for online solver with API key', () => {
      usePlateSolverStore.setState({
        config: { ...usePlateSolverStore.getState().config, solver_type: 'astrometry_net_online' },
        onlineApiKey: 'test-api-key',
        onlineServiceStatus: {
          status: 'reachable',
          checkedAt: Date.now(),
          message: null,
        },
      });

      const state = usePlateSolverStore.getState();
      expect(selectCanSolve(state)).toBe(true);
    });

    it('should return false for online solver when service is unreachable', () => {
      usePlateSolverStore.setState({
        config: { ...usePlateSolverStore.getState().config, solver_type: 'astrometry_net_online' },
        onlineApiKey: 'test-api-key',
        onlineServiceStatus: {
          status: 'unreachable',
          checkedAt: Date.now(),
          message: 'Astrometry.net probe failed',
        },
      });

      const state = usePlateSolverStore.getState();
      expect(selectCanSolve(state)).toBe(false);
    });
  });

  describe('online solver readiness selectors', () => {
    it('returns degraded readiness while service health is still unknown', () => {
      usePlateSolverStore.setState({
        onlineApiKey: 'test-api-key',
        onlineServiceStatus: {
          status: 'unknown',
          checkedAt: null,
          message: null,
        },
      });

      const readiness = selectOnlineSolverReadiness(usePlateSolverStore.getState());
      expect(readiness.state).toBe('degraded');
      expect(readiness.reason).toBe('checking');
      expect(readiness.canStart).toBe(true);
    });

    it('enriches the online solver metadata with blocked availability reason', () => {
      const mockSolver: SolverInfo = {
        solver_type: 'astrometry_net_online',
        name: 'Astrometry.net (Online)',
        version: 'nova.astrometry.net',
        executable_path: '',
        is_available: true,
        index_path: null,
        installed_indexes: [],
      };

      usePlateSolverStore.setState({
        detectedSolvers: [mockSolver],
        config: { ...usePlateSolverStore.getState().config, solver_type: 'astrometry_net_online' },
        onlineApiKey: '',
        onlineServiceStatus: {
          status: 'unknown',
          checkedAt: null,
          message: null,
        },
      });

      const [displaySolver] = selectDetectedSolversWithReadiness(usePlateSolverStore.getState());
      expect(displaySolver?.is_available).toBe(false);
      expect(displaySolver?.availability_reason).toContain('API key');
    });

    it('keeps the derived online solver reference stable when inputs do not change', () => {
      const mockSolver: SolverInfo = {
        solver_type: 'astrometry_net_online',
        name: 'Astrometry.net (Online)',
        version: 'nova.astrometry.net',
        executable_path: '',
        is_available: true,
        index_path: null,
        installed_indexes: [],
      };

      usePlateSolverStore.setState({
        detectedSolvers: [mockSolver],
        config: { ...usePlateSolverStore.getState().config, solver_type: 'astrometry_net_online' },
        onlineApiKey: '',
        onlineServiceStatus: {
          status: 'unknown',
          checkedAt: null,
          message: null,
        },
      });

      const [firstSolver] = selectDetectedSolversWithReadiness(usePlateSolverStore.getState());
      const [secondSolver] = selectDetectedSolversWithReadiness(usePlateSolverStore.getState());

      expect(firstSolver).toBe(secondSolver);
    });
  });
});
