/**
 * Tests for plate-solver-api.ts
 */

import {
  formatFileSize,
  getSolverDisplayName,
  isLocalSolver,
  convertToLegacyResult,
  DEFAULT_SOLVER_CONFIG,
  detectPlateSolvers,
  getSolverInfo,
  getAstapDatabases,
  recommendAstapDatabase,
  analyseImage,
  extractStars,
  cancelOnlineSolve,
  solveOnline,
} from '../plate-solver-api';
import type {
  SolveResult,
  SolverType,
  AstapDatabaseInfo,
  ImageAnalysisResult,
  OnlineSolveConfig,
  OnlineSolveResult,
  OnlineWcsResult,
  StarDetection,
  OnlineAnnotation,
} from '../plate-solver-api';

// Mock Tauri invoke
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

// Plate-solver commands are desktop-gated; simulate the desktop environment
jest.mock('@/lib/storage/platform', () => ({
  isTauri: () => true,
  isDesktop: () => true,
}));

describe('plate-solver-api', () => {
  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(500)).toBe('500 B');
    });

    it('should format kilobytes correctly', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(2048)).toBe('2.0 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should format megabytes correctly', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(formatFileSize(50 * 1024 * 1024)).toBe('50.0 MB');
      expect(formatFileSize(512 * 1024 * 1024)).toBe('512.0 MB');
    });

    it('should format gigabytes correctly', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.00 GB');
      expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe('2.50 GB');
    });

    it('should handle zero bytes', () => {
      expect(formatFileSize(0)).toBe('0 B');
    });
  });

  describe('getSolverDisplayName', () => {
    it('should return correct name for ASTAP', () => {
      expect(getSolverDisplayName('astap')).toBe('ASTAP');
    });

    it('should return correct name for local Astrometry.net', () => {
      expect(getSolverDisplayName('astrometry_net')).toBe('Astrometry.net (Local)');
    });

    it('should return correct name for online Astrometry.net', () => {
      expect(getSolverDisplayName('astrometry_net_online')).toBe('Astrometry.net (Online)');
    });

    it('should return the type itself for unknown types', () => {
      expect(getSolverDisplayName('unknown' as SolverType)).toBe('unknown');
    });
  });

  describe('isLocalSolver', () => {
    it('should return true for ASTAP', () => {
      expect(isLocalSolver('astap')).toBe(true);
    });

    it('should return true for local Astrometry.net', () => {
      expect(isLocalSolver('astrometry_net')).toBe(true);
    });

    it('should return false for online Astrometry.net', () => {
      expect(isLocalSolver('astrometry_net_online')).toBe(false);
    });
  });

  describe('convertToLegacyResult', () => {
    it('should convert successful result correctly', () => {
      const solveResult: SolveResult = {
        success: true,
        ra: 180.5,
        dec: 45.25,
        ra_hms: '12h02m00s',
        dec_dms: '+45°15\'00"',
        position_angle: 15.5,
        pixel_scale: 1.25,
        fov_width: 2.5,
        fov_height: 1.8,
        flipped: false,
        solver_name: 'ASTAP',
        solve_time_ms: 5000,
        error_message: null,
        wcs_file: '/path/to/file.wcs',
      };

      const legacy = convertToLegacyResult(solveResult);

      expect(legacy.success).toBe(true);
      expect(legacy.coordinates).toEqual({
        ra: 180.5,
        dec: 45.25,
        raHMS: '12h02m00s',
        decDMS: '+45°15\'00"',
      });
      expect(legacy.positionAngle).toBe(15.5);
      expect(legacy.pixelScale).toBe(1.25);
      expect(legacy.fov).toEqual({ width: 2.5, height: 1.8 });
      expect(legacy.flipped).toBe(false);
      expect(legacy.solverName).toBe('ASTAP');
      expect(legacy.solveTime).toBe(5000);
      expect(legacy.errorMessage).toBeUndefined();
    });

    it('should convert failed result correctly', () => {
      const solveResult: SolveResult = {
        success: false,
        ra: null,
        dec: null,
        ra_hms: null,
        dec_dms: null,
        position_angle: null,
        pixel_scale: null,
        fov_width: null,
        fov_height: null,
        flipped: null,
        solver_name: 'ASTAP',
        solve_time_ms: 1000,
        error_message: 'Not enough stars detected',
        wcs_file: null,
      };

      const legacy = convertToLegacyResult(solveResult);

      expect(legacy.success).toBe(false);
      expect(legacy.coordinates).toBeNull();
      expect(legacy.positionAngle).toBe(0);
      expect(legacy.pixelScale).toBe(0);
      expect(legacy.fov).toEqual({ width: 0, height: 0 });
      expect(legacy.flipped).toBe(false);
      expect(legacy.solverName).toBe('ASTAP');
      expect(legacy.solveTime).toBe(1000);
      expect(legacy.errorMessage).toBe('Not enough stars detected');
    });

    it('should handle null values in successful result', () => {
      const solveResult: SolveResult = {
        success: true,
        ra: 100.0,
        dec: -20.0,
        ra_hms: null,
        dec_dms: null,
        position_angle: null,
        pixel_scale: null,
        fov_width: null,
        fov_height: null,
        flipped: null,
        solver_name: 'Test',
        solve_time_ms: 0,
        error_message: null,
        wcs_file: null,
      };

      const legacy = convertToLegacyResult(solveResult);

      expect(legacy.success).toBe(true);
      expect(legacy.coordinates).toEqual({
        ra: 100.0,
        dec: -20.0,
        raHMS: '',
        decDMS: '',
      });
    });
  });

  describe('DEFAULT_SOLVER_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_SOLVER_CONFIG.solver_type).toBe('astap');
      expect(DEFAULT_SOLVER_CONFIG.executable_path).toBeNull();
      expect(DEFAULT_SOLVER_CONFIG.index_path).toBeNull();
      expect(DEFAULT_SOLVER_CONFIG.timeout_seconds).toBe(120);
      expect(DEFAULT_SOLVER_CONFIG.downsample).toBe(0);
      expect(DEFAULT_SOLVER_CONFIG.search_radius).toBe(30.0);
      expect(DEFAULT_SOLVER_CONFIG.use_sip).toBe(true);
    });

    it('should have correct ASTAP default values', () => {
      expect(DEFAULT_SOLVER_CONFIG.astap_database).toBeNull();
      expect(DEFAULT_SOLVER_CONFIG.astap_max_stars).toBe(500);
      expect(DEFAULT_SOLVER_CONFIG.astap_tolerance).toBe(0.007);
      expect(DEFAULT_SOLVER_CONFIG.astap_speed_mode).toBe('auto');
      expect(DEFAULT_SOLVER_CONFIG.astap_min_star_size).toBe(1.5);
      expect(DEFAULT_SOLVER_CONFIG.astap_equalise_background).toBe(false);
    });

    it('should have correct Astrometry.net default values', () => {
      expect(DEFAULT_SOLVER_CONFIG.astrometry_scale_low).toBeNull();
      expect(DEFAULT_SOLVER_CONFIG.astrometry_scale_high).toBeNull();
      expect(DEFAULT_SOLVER_CONFIG.astrometry_scale_units).toBe('deg_width');
      expect(DEFAULT_SOLVER_CONFIG.astrometry_depth).toBeNull();
      expect(DEFAULT_SOLVER_CONFIG.astrometry_no_plots).toBe(true);
      expect(DEFAULT_SOLVER_CONFIG.astrometry_no_verify).toBe(false);
      expect(DEFAULT_SOLVER_CONFIG.astrometry_crpix_center).toBe(true);
    });

    it('should have correct general default values', () => {
      expect(DEFAULT_SOLVER_CONFIG.keep_wcs_file).toBe(true);
      expect(DEFAULT_SOLVER_CONFIG.auto_hints).toBe(true);
      expect(DEFAULT_SOLVER_CONFIG.retry_on_failure).toBe(false);
      expect(DEFAULT_SOLVER_CONFIG.max_retries).toBe(2);
    });
  });

  describe('new API functions', () => {
    const mockInvoke = jest.requireMock('@tauri-apps/api/core').invoke;

    beforeEach(() => {
      mockInvoke.mockReset();
    });

    describe('getAstapDatabases', () => {
      it('should invoke get_astap_databases command', async () => {
        const mockDatabases: AstapDatabaseInfo[] = [
          {
            name: 'D50',
            abbreviation: 'd50',
            installed: true,
            path: '/path/to/d50',
            fov_min_deg: 0.3,
            fov_max_deg: 10,
            description: 'Medium star database',
            size_mb: 500,
            download_url: null,
          },
        ];
        mockInvoke.mockResolvedValueOnce(mockDatabases);

        const result = await getAstapDatabases();

        expect(mockInvoke).toHaveBeenCalledWith('get_astap_databases');
        expect(result).toEqual(mockDatabases);
      });
    });

    describe('recommendAstapDatabase', () => {
      it('should invoke recommend_astap_database with fovDegrees', async () => {
        mockInvoke.mockResolvedValueOnce([]);

        await recommendAstapDatabase(2.5);

        expect(mockInvoke).toHaveBeenCalledWith('recommend_astap_database', { fovDegrees: 2.5 });
      });
    });

    describe('analyseImage', () => {
      it('should invoke analyse_image with imagePath', async () => {
        const mockResult: ImageAnalysisResult = {
          success: true,
          median_hfd: 3.5,
          star_count: 150,
          background: 1200,
          noise: 45,
          stars: [],
          error_message: null,
        };
        mockInvoke.mockResolvedValueOnce(mockResult);

        const result = await analyseImage('/path/to/image.fits');

        expect(mockInvoke).toHaveBeenCalledWith('analyse_image', {
          imagePath: '/path/to/image.fits',
          snrMinimum: null,
        });
        expect(result).toEqual(mockResult);
      });

      it('should pass snrMinimum when provided', async () => {
        mockInvoke.mockResolvedValueOnce({ success: true, median_hfd: null, star_count: 0, background: null, noise: null, stars: [], error_message: null });

        await analyseImage('/path/to/image.fits', 10);

        expect(mockInvoke).toHaveBeenCalledWith('analyse_image', {
          imagePath: '/path/to/image.fits',
          snrMinimum: 10,
        });
      });
    });

    describe('extractStars', () => {
      it('should invoke extract_stars with correct params', async () => {
        mockInvoke.mockResolvedValueOnce({ success: true, median_hfd: null, star_count: 0, background: null, noise: null, stars: [], error_message: null });

        await extractStars('/path/to/image.fits', 5, true);

        expect(mockInvoke).toHaveBeenCalledWith('extract_stars', {
          imagePath: '/path/to/image.fits',
          snrMinimum: 5,
          includeCoordinates: true,
        });
      });

      it('should default includeCoordinates to false', async () => {
        mockInvoke.mockResolvedValueOnce({ success: true, median_hfd: null, star_count: 0, background: null, noise: null, stars: [], error_message: null });

        await extractStars('/path/to/image.fits');

        expect(mockInvoke).toHaveBeenCalledWith('extract_stars', {
          imagePath: '/path/to/image.fits',
          snrMinimum: null,
          includeCoordinates: false,
        });
      });
    });

    describe('solveOnline', () => {
      it('should invoke solve_online with config', async () => {
        const config: OnlineSolveConfig = {
          api_key: 'test-key',
          image_path: '/path/to/image.fits',
          ra_hint: 180.0,
          dec_hint: 45.0,
          radius: 5.0,
        };
        const mockResult: OnlineSolveResult = {
          success: true,
          operation_id: 'op-123',
          ra: 180.1,
          dec: 45.05,
          orientation: 12.5,
          pixscale: 1.2,
          radius: 1.5,
          parity: 1,
          fov_width: 2.5,
          fov_height: 1.8,
          objects_in_field: ['M31', 'NGC 224'],
          annotations: [],
          job_id: 12345,
          wcs: null,
          solve_time_ms: 30000,
          error_code: null,
          error_message: null,
        };
        mockInvoke.mockResolvedValueOnce(mockResult);

        const result = await solveOnline(config);

        expect(mockInvoke).toHaveBeenCalledWith('solve_online', { config });
        expect(result).toEqual(mockResult);
        expect(result.objects_in_field).toContain('M31');
      });
    });

    describe('cancelOnlineSolve', () => {
      it('should invoke cancel_online_solve with operation id when provided', async () => {
        mockInvoke.mockResolvedValueOnce(true);

        const result = await cancelOnlineSolve('op-123');

        expect(mockInvoke).toHaveBeenCalledWith('cancel_online_solve', { operationId: 'op-123' });
        expect(result).toBe(true);
      });

      it('should invoke cancel_online_solve without operation id', async () => {
        mockInvoke.mockResolvedValueOnce(false);

        const result = await cancelOnlineSolve();

        expect(mockInvoke).toHaveBeenCalledWith('cancel_online_solve', { operationId: null });
        expect(result).toBe(false);
      });
    });
  });

  describe('solver info normalization', () => {
    const mockInvoke = jest.requireMock('@tauri-apps/api/core').invoke;

    it('should normalize legacy backend detect payloads', async () => {
      mockInvoke.mockResolvedValueOnce([
        {
          solver_type: 'astrometry_net',
          name: 'Astrometry.net (Local)',
          version: '0.97',
          path: '/custom/solve-field',
          available: false,
          index_path: '/data/astrometry',
        },
      ]);

      await expect(detectPlateSolvers()).resolves.toEqual([
        expect.objectContaining({
          solver_type: 'astrometry_net',
          executable_path: '/custom/solve-field',
          is_available: false,
          installed_indexes: [],
          profile_id: null,
          availability_reason: null,
        }),
      ]);
    });

    it('should normalize legacy backend solver info payloads', async () => {
      mockInvoke.mockResolvedValueOnce({
        solver_type: 'astap',
        name: 'ASTAP',
        version: '2026.03.05',
        path: '/usr/bin/astap_cli',
        available: true,
        index_path: '/usr/share/astap/data',
      });

      await expect(getSolverInfo('astap')).resolves.toEqual(
        expect.objectContaining({
          executable_path: '/usr/bin/astap_cli',
          is_available: true,
          installed_indexes: [],
        })
      );
    });
  });

  describe('online solve types', () => {
    it('OnlineWcsResult should support SIP payload', () => {
      const wcs: OnlineWcsResult = {
        crpix1: 1500.5,
        crpix2: 1000.5,
        crval1: 83.633,
        crval2: 22.014,
        cdelt1: null,
        cdelt2: null,
        crota1: null,
        crota2: null,
        cd1_1: -0.00012,
        cd1_2: 0,
        cd2_1: 0,
        cd2_2: 0.00012,
        ctype1: 'RA---TAN-SIP',
        ctype2: 'DEC--TAN-SIP',
        naxis1: 3000,
        naxis2: 2000,
        sip: {
          a_order: 2,
          b_order: 2,
          ap_order: null,
          bp_order: null,
          a_coeffs: { A_0_2: 1e-5 },
          b_coeffs: { B_1_1: -2e-5 },
          ap_coeffs: {},
          bp_coeffs: {},
        },
      };

      expect(wcs.sip?.a_order).toBe(2);
      expect(wcs.naxis1).toBe(3000);
    });
  });

  describe('type structures', () => {
    it('StarDetection should have correct shape', () => {
      const star: StarDetection = {
        x: 100.5,
        y: 200.3,
        hfd: 3.5,
        flux: 50000,
        snr: 25.5,
        ra: 180.0,
        dec: 45.0,
        magnitude: 12.5,
      };
      expect(star.x).toBe(100.5);
      expect(star.ra).toBe(180.0);
    });

    it('OnlineAnnotation should have correct shape', () => {
      const annotation: OnlineAnnotation = {
        names: ['M31', 'Andromeda Galaxy'],
        annotation_type: 'galaxy',
        pixelx: 500,
        pixely: 600,
        radius: 120,
      };
      expect(annotation.names).toHaveLength(2);
      expect(annotation.annotation_type).toBe('galaxy');
    });

    it('AstapDatabaseInfo should have correct shape', () => {
      const db: AstapDatabaseInfo = {
        name: 'D50',
        abbreviation: 'd50',
        installed: false,
        path: null,
        fov_min_deg: 0.3,
        fov_max_deg: 10,
        description: 'Test',
        size_mb: 500,
        download_url: 'https://example.com/d50.zip',
      };
      expect(db.installed).toBe(false);
      expect(db.fov_min_deg).toBe(0.3);
    });
  });
});
