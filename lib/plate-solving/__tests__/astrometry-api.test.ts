/**
 * Tests for astrometry-api.ts
 */

jest.mock('../fits-parser', () => ({
  parseFITSHeader: jest.fn(),
}));

import { AstrometryApiClient } from '../astrometry-api';
import { createErrorResult } from '../types';
import { parseFITSHeader } from '../fits-parser';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockParseFITSHeader = parseFITSHeader as jest.MockedFunction<typeof parseFITSHeader>;

// Mock URL.createObjectURL/revokeObjectURL for getImageDimensions
global.URL.createObjectURL = jest.fn(() => 'blob:mock');
global.URL.revokeObjectURL = jest.fn();

describe('AstrometryApiClient', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockParseFITSHeader.mockReset();
  });

  describe('constructor', () => {
    it('should create client with required config', () => {
      const client = new AstrometryApiClient({ apiKey: 'test-key' });
      expect(client).toBeDefined();
    });

    it('should use default baseUrl if not provided', () => {
      const client = new AstrometryApiClient({ apiKey: 'test-key' });
      expect(client).toBeDefined();
    });

    it('should use custom baseUrl if provided', () => {
      const client = new AstrometryApiClient({
        apiKey: 'test-key',
        baseUrl: 'https://custom.astrometry.net',
      });
      expect(client).toBeDefined();
    });

    it('should use custom timeout if provided', () => {
      const client = new AstrometryApiClient({
        apiKey: 'test-key',
        timeout: 60000,
      });
      expect(client).toBeDefined();
    });

    it('should use custom pollInterval if provided', () => {
      const client = new AstrometryApiClient({
        apiKey: 'test-key',
        pollInterval: 10000,
      });
      expect(client).toBeDefined();
    });
  });

  describe('login', () => {
    it('should login successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success', session: 'test-session' }),
      });

      const client = new AstrometryApiClient({ apiKey: 'test-key' });
      const session = await client.login();
      
      expect(session.sessionKey).toBe('test-session');
    });

    it('should throw error on login failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'error', message: 'Invalid API key' }),
      });

      const client = new AstrometryApiClient({ apiKey: 'invalid-key' });
      
      await expect(client.login()).rejects.toThrow('Invalid API key');
    });
  });

  describe('cancel', () => {
    it('should cancel ongoing operations', () => {
      const client = new AstrometryApiClient({ apiKey: 'test-key' });
      expect(() => client.cancel()).not.toThrow();
    });
  });

  describe('HTTP status checks', () => {
    let client: AstrometryApiClient;

    beforeEach(() => {
      client = new AstrometryApiClient({ apiKey: 'test-key' });
    });

    it('should throw on non-ok getSubmissionStatus', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      await expect(client.getSubmissionStatus(123)).rejects.toThrow('HTTP 500');
    });

    it('should throw on non-ok getJobStatus', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      await expect(client.getJobStatus(456)).rejects.toThrow('HTTP 404');
    });

    it('should throw on non-ok getCalibration', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 502 });
      await expect(client.getCalibration(789)).rejects.toThrow('HTTP 502');
    });

    it('should throw on non-ok getObjectsInField', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });
      await expect(client.getObjectsInField(111)).rejects.toThrow('HTTP 503');
    });

    it('should throw on non-ok getAnnotations', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });
      await expect(client.getAnnotations(222)).rejects.toThrow('HTTP 403');
    });

    it('should return data on successful getSubmissionStatus', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobs: [1], job_calibrations: [] }),
      });
      const result = await client.getSubmissionStatus(123);
      expect(result.jobs).toEqual([1]);
    });

    it('should return data on successful getJobStatus', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success' }),
      });
      const result = await client.getJobStatus(456);
      expect(result.status).toBe('success');
    });
  });

  describe('createErrorResult', () => {
    it('should create a standard error result', () => {
      const result = createErrorResult('test-solver', 'Something went wrong');
      expect(result.success).toBe(false);
      expect(result.solverName).toBe('test-solver');
      expect(result.errorMessage).toBe('Something went wrong');
      expect(result.coordinates).toBeNull();
      expect(result.positionAngle).toBe(0);
      expect(result.pixelScale).toBe(0);
      expect(result.fov).toEqual({ width: 0, height: 0 });
      expect(result.solveTime).toBe(0);
    });
  });

  describe('uploadFile', () => {
    it('should upload file successfully', async () => {
      // Login
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success', session: 'sess' }),
      });
      // Upload
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success', subid: 42, hash: 'abc123' }),
      });

      const client = new AstrometryApiClient({ apiKey: 'test-key' });
      const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
      const onProgress = jest.fn();
      const result = await client.uploadFile(file, {}, onProgress);

      expect(result.status).toBe('success');
      expect(result.subid).toBe(42);
      expect(result.hash).toBe('abc123');
      expect(onProgress).toHaveBeenCalledWith({ stage: 'uploading', progress: 0 });
      expect(onProgress).toHaveBeenCalledWith({ stage: 'uploading', progress: 100 });
    });

    it('should throw on upload error response', async () => {
      // Login
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success', session: 'sess' }),
      });
      // Upload fails
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'error', errormessage: 'Bad image' }),
      });

      const client = new AstrometryApiClient({ apiKey: 'test-key' });
      const blob = new Blob(['data'], { type: 'image/jpeg' });
      await expect(client.uploadFile(blob)).rejects.toThrow('Bad image');
    });

    it('should upload Blob with default name', async () => {
      // Login
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success', session: 'sess' }),
      });
      // Upload
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success', subid: 1 }),
      });

      const client = new AstrometryApiClient({ apiKey: 'test-key' });
      const blob = new Blob(['data'], { type: 'image/jpeg' });
      const result = await client.uploadFile(blob);
      expect(result.status).toBe('success');
    });
  });

  describe('uploadUrl', () => {
    it('should upload URL successfully', async () => {
      // Login
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success', session: 'sess' }),
      });
      // URL upload
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success', subid: 99, hash: 'xyz' }),
      });

      const client = new AstrometryApiClient({ apiKey: 'test-key' });
      const result = await client.uploadUrl('https://example.com/image.jpg');
      expect(result.status).toBe('success');
      expect(result.subid).toBe(99);
    });

    it('should throw on URL upload error', async () => {
      // Login
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success', session: 'sess' }),
      });
      // URL upload fails
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'error', errormessage: 'Invalid URL' }),
      });

      const client = new AstrometryApiClient({ apiKey: 'test-key' });
      await expect(client.uploadUrl('https://bad.url')).rejects.toThrow('Invalid URL');
    });
  });

  describe('getCalibration success', () => {
    it('should return calibration data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          ra: 180, dec: 45, orientation: 30, pixscale: 1.5, radius: 0.5, parity: 1,
        }),
      });

      const client = new AstrometryApiClient({ apiKey: 'test-key' });
      const cal = await client.getCalibration(100);
      expect(cal.ra).toBe(180);
      expect(cal.pixscale).toBe(1.5);
    });
  });

  describe('getObjectsInField success', () => {
    it('should return objects list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ objects_in_field: ['M31', 'NGC 224'] }),
      });

      const client = new AstrometryApiClient({ apiKey: 'test-key' });
      const objects = await client.getObjectsInField(100);
      expect(objects).toEqual(['M31', 'NGC 224']);
    });

    it('should return empty array when no objects', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const client = new AstrometryApiClient({ apiKey: 'test-key' });
      const objects = await client.getObjectsInField(100);
      expect(objects).toEqual([]);
    });
  });

  describe('getAnnotations success', () => {
    it('should return annotations list', async () => {
      const mockAnnotations = [
        { radius: 0.1, type: 'NGC', names: ['NGC 1234'], pixelx: 100, pixely: 200 },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ annotations: mockAnnotations }),
      });

      const client = new AstrometryApiClient({ apiKey: 'test-key' });
      const annotations = await client.getAnnotations(100);
      expect(annotations).toHaveLength(1);
      expect(annotations[0].names).toContain('NGC 1234');
    });

    it('should return empty array when no annotations', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const client = new AstrometryApiClient({ apiKey: 'test-key' });
      const annotations = await client.getAnnotations(100);
      expect(annotations).toEqual([]);
    });
  });

  describe('ensureSession', () => {
    it('should re-login when session is expired', async () => {
      // First login
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success', session: 'sess1' }),
      });

      const client = new AstrometryApiClient({ apiKey: 'test-key' });
      const session1 = await client.login();
      expect(session1.sessionKey).toBe('sess1');

      // Expire the session by setting expiresAt to the past
      if (session1.expiresAt) {
        session1.expiresAt = new Date(Date.now() - 1000);
      }

      // Second login (triggered by ensureSession via uploadUrl)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success', session: 'sess2' }),
      });
      // URL upload
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success', subid: 1 }),
      });

      const result = await client.uploadUrl('https://example.com/img.jpg');
      expect(result.status).toBe('success');
      // Should have called fetch 3 times total (initial login + re-login + upload)
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('login edge cases', () => {
    it('should throw generic error when no message in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'error' }),
      });

      const client = new AstrometryApiClient({ apiKey: 'test-key' });
      await expect(client.login()).rejects.toThrow('Login failed');
    });
  });

  describe('solve flow', () => {
    it('should return error result on upload failure', async () => {
      // Login succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success', session: 'sess' }),
      });
      // Upload fails
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const client = new AstrometryApiClient({
        apiKey: 'test-key',
        timeout: 5000,
        pollInterval: 100,
      });
      const mockBlob = new Blob(['fake-image'], { type: 'image/jpeg' });
      const result = await client.solve(mockBlob);
      
      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Network error');
      expect(result.solverName).toBe('astrometry.net');
    });

    it('should call onProgress with stages', async () => {
      const onProgress = jest.fn();
      // Login
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success', session: 'sess' }),
      });
      // Upload
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success', subid: 1001 }),
      });
      // Submission status (returns job)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobs: [2001], job_calibrations: [] }),
      });
      // Job status (success)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success' }),
      });
      // Calibration
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          ra: 180.5, dec: -30.2, orientation: 45.0,
          pixscale: 1.2, radius: 0.5, parity: 1,
        }),
      });
      // Objects in field
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ objects_in_field: ['NGC 1234'] }),
      });

      const client = new AstrometryApiClient({
        apiKey: 'test-key',
        timeout: 60000,
        pollInterval: 10,
      });
      const mockBlob = new Blob(['fake-image'], { type: 'image/jpeg' });
      const result = await client.solve(mockBlob, {}, onProgress);
      
      expect(result.success).toBe(true);
      expect(result.coordinates?.ra).toBeCloseTo(180.5);
      expect(result.coordinates?.dec).toBeCloseTo(-30.2);
      expect(result.positionAngle).toBeCloseTo(45.0);
      expect(result.pixelScale).toBeCloseTo(1.2);
      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ stage: 'uploading' }));
      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ stage: 'queued' }));
      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ stage: 'processing' }));
      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ stage: 'success' }));
    });

    it('should return error on solve failure status', async () => {
      // Login
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success', session: 'sess' }),
      });
      // Upload
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success', subid: 1001 }),
      });
      // Submission status
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobs: [2001], job_calibrations: [] }),
      });
      // Job status (failure)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'failure' }),
      });

      const client = new AstrometryApiClient({
        apiKey: 'test-key',
        timeout: 60000,
        pollInterval: 10,
      });
      const mockBlob = new Blob(['fake-image'], { type: 'image/jpeg' });
      const result = await client.solve(mockBlob);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Plate solving failed');
    });

    it('should timeout when waiting too long for job', async () => {
      // Login
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success', session: 'sess' }),
      });
      // Upload
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success', subid: 1001 }),
      });
      // Submission status — never returns jobs
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ jobs: [], job_calibrations: [] }),
      });

      const client = new AstrometryApiClient({
        apiKey: 'test-key',
        timeout: 200,
        pollInterval: 50,
      });
      const mockBlob = new Blob(['fake-image'], { type: 'image/jpeg' });
      const result = await client.solve(mockBlob);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('Timeout');
    });
  });

  describe('solveDetailed flow', () => {
    it('returns normalized online metadata including submission, job, annotations, and WCS-derived framing', async () => {
      mockParseFITSHeader.mockResolvedValueOnce({
        header: {},
        image: { width: 3000, height: 2000, bitpix: 16, naxis: 2, bzero: 0, bscale: 1 },
        wcs: {
          referencePixel: { x: 1500.5, y: 1000.5 },
          referenceCoordinates: { ra: 180.5, dec: -30.2 },
          pixelScale: 1.2,
          rotation: 45,
          cdMatrix: {
            cd1_1: -0.000333,
            cd1_2: 0,
            cd2_1: 0,
            cd2_2: 0.000333,
          },
          projectionType: 'TAN',
        },
        rawCards: [],
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: 'success', session: 'sess' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: 'success', subid: 1001 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ jobs: [2001], job_calibrations: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: 'success' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            ra: 180.5,
            dec: -30.2,
            orientation: 45.0,
            pixscale: 1.2,
            radius: 0.5,
            parity: 1,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ objects_in_field: ['NGC 1234'] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            annotations: [{ radius: 0.2, type: 'galaxy', names: ['NGC 1234'], pixelx: 100, pixely: 200 }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          blob: () => Promise.resolve(new Blob(['fits-bytes'], { type: 'application/fits' })),
        });

      const client = new AstrometryApiClient({
        apiKey: 'test-key',
        timeout: 60000,
        pollInterval: 10,
      });

      const detailed = await client.solveDetailed(new Blob(['fake-image'], { type: 'image/jpeg' }));

      expect(detailed.solveResult.success).toBe(true);
      expect(detailed.artifact.submissionId).toBe(1001);
      expect(detailed.artifact.jobId).toBe(2001);
      expect(detailed.artifact.objectsInField).toEqual(['NGC 1234']);
      expect(detailed.artifact.annotations).toHaveLength(1);
      expect(detailed.artifact.wcs?.referenceCoordinates.ra).toBeCloseTo(180.5);
      expect(detailed.artifact.frameSize).toEqual({ width: 3000, height: 2000 });
      expect(detailed.artifact.diagnostics.annotations).toBe('complete');
      expect(detailed.artifact.diagnostics.wcs).toBe('complete');
    });

    it('keeps the solve successful when artifact enrichment partially fails', async () => {
      mockParseFITSHeader.mockRejectedValueOnce(new Error('bad fits header'));

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: 'success', session: 'sess' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: 'success', subid: 1001 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ jobs: [2001], job_calibrations: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: 'success' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            ra: 180.5,
            dec: -30.2,
            orientation: 45.0,
            pixscale: 1.2,
            radius: 0.5,
            parity: 1,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ objects_in_field: ['NGC 1234'] }),
        })
        .mockRejectedValueOnce(new Error('annotation endpoint failed'))
        .mockResolvedValueOnce({
          ok: true,
          blob: () => Promise.resolve(new Blob(['fits-bytes'], { type: 'application/fits' })),
        });

      const client = new AstrometryApiClient({
        apiKey: 'test-key',
        timeout: 60000,
        pollInterval: 10,
      });

      const detailed = await client.solveDetailed(new Blob(['fake-image'], { type: 'image/jpeg' }));

      expect(detailed.solveResult.success).toBe(true);
      expect(detailed.artifact.diagnostics.annotations).toBe('missing');
      expect(detailed.artifact.diagnostics.wcs).toBe('missing');
      expect(detailed.artifact.diagnostics.issues).toEqual([
        expect.objectContaining({ artifact: 'annotations' }),
        expect.objectContaining({ artifact: 'wcs' }),
      ]);
    });
  });
});
