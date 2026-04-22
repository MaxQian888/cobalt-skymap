/**
 * Tests for solve-result-card.tsx
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SolveResultCard } from '../solve-result-card';
import type { SolveResultConsumptionSummary } from '@/lib/plate-solving';

// Mock next-intl
const mockTranslate = jest.fn((key: string) => key);

jest.mock('next-intl', () => ({
  useTranslations: () => mockTranslate,
}));

// Mock clipboard API
const mockWriteText = jest.fn().mockResolvedValue(undefined);
Object.assign(navigator, {
  clipboard: { writeText: mockWriteText },
});

describe('SolveResultCard', () => {
  const richConsumption: SolveResultConsumptionSummary = {
    success: true,
    objects: {
      count: 2,
      previewNames: ['M31', 'NGC 224'],
    },
    artifacts: {
      annotationCount: 1,
      annotationsState: 'complete',
      wcsState: 'missing',
      issueMessages: ['WCS unavailable'],
    },
    annotations: [
      {
        names: ['M31'],
        annotationType: 'galaxy',
        radius: 30,
        derivedCoordinates: {
          ra: 10.6847083,
          dec: 41.26875,
        },
        actionability: {
          canNavigate: true,
          canCreateMarker: true,
          disabledReason: null,
        },
      },
    ],
    analysis: {
      available: true,
      success: true,
      starCount: 124,
      medianHfd: 2.3,
      background: 1200,
      noise: 45,
      errorMessage: null,
    },
  };

  const successResult = {
    success: true,
    coordinates: {
      ra: 180.5,
      dec: 45.25,
      raHMS: '12h02m00s',
      decDMS: '+45°15\'00"',
    },
    positionAngle: 15.5,
    pixelScale: 1.25,
    fov: { width: 2.5, height: 1.8 },
    flipped: false,
    solverName: 'ASTAP',
    solveTime: 5000,
  };

  const failedResult = {
    success: false,
    coordinates: null,
    positionAngle: 0,
    pixelScale: 0,
    fov: { width: 0, height: 0 },
    flipped: false,
    solverName: 'ASTAP',
    solveTime: 3000,
    errorMessage: 'No solution found',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockTranslate.mockImplementation((key: string) => key);
  });

  describe('success result', () => {
    it('should show success message', () => {
      render(<SolveResultCard result={successResult} />);
      expect(screen.getByText('plateSolving.solveSuccess')).toBeInTheDocument();
    });

    it('should display coordinates', () => {
      render(<SolveResultCard result={successResult} />);
      expect(screen.getByText(/12h02m00s/)).toBeInTheDocument();
      expect(screen.getByText(/\+45°15'00"/)).toBeInTheDocument();
    });

    it('should display rotation, scale, and FOV', () => {
      render(<SolveResultCard result={successResult} />);
      expect(screen.getByText(/15\.50°/)).toBeInTheDocument();
      expect(screen.getByText(/1\.25/)).toBeInTheDocument();
      expect(screen.getByText(/2\.50°/)).toBeInTheDocument();
    });

    it('should display solve time and solver name', () => {
      render(<SolveResultCard result={successResult} />);
      expect(screen.getByText(/5\.0s/)).toBeInTheDocument();
      expect(screen.getByText(/ASTAP/)).toBeInTheDocument();
    });

    it('should show go to button when onGoTo provided', () => {
      const onGoTo = jest.fn();
      render(<SolveResultCard result={successResult} onGoTo={onGoTo} />);
      const goToButton = screen.getByText('plateSolving.goToPosition');
      expect(goToButton).toBeInTheDocument();
      fireEvent.click(goToButton);
      expect(onGoTo).toHaveBeenCalled();
    });

    it('should not show go to button when onGoTo not provided', () => {
      render(<SolveResultCard result={successResult} />);
      expect(screen.queryByText('plateSolving.goToPosition')).not.toBeInTheDocument();
    });

    it('should preserve successful online solve presentation when artifact metadata exists', () => {
      render(<SolveResultCard result={{
        ...successResult,
        solverName: 'Astrometry.net (Online)',
        onlineSolve: {
          runtime: 'web',
          operationId: null,
          submissionId: 42,
          jobId: 77,
          objectsInField: ['M31', 'NGC 224'],
          annotations: [{ names: ['M31'], annotationType: 'galaxy', pixelX: 100, pixelY: 200, radius: 30 }],
          wcs: null,
          frameSize: { width: 3000, height: 2000 },
          diagnostics: {
            annotations: 'complete',
            wcs: 'missing',
            issues: [],
          },
          errorCode: null,
          errorMessage: null,
        },
      }} />);

      expect(screen.getByText('plateSolving.solveSuccess')).toBeInTheDocument();
      expect(screen.getByText(/Astrometry\.net \(Online\)/i)).toBeInTheDocument();
      expect(screen.getByText(/12h02m00s/)).toBeInTheDocument();
    });

    it('renders consolidated artifact and analysis details when result-consumption summary is provided', () => {
      render(
        <SolveResultCard
          result={successResult}
          consumption={richConsumption}
        />
      );

      expect(screen.getAllByText('plateSolving.detectedObjects').length).toBeGreaterThan(0);
      expect(screen.getByText('M31')).toBeInTheDocument();
      expect(screen.getByText('NGC 224')).toBeInTheDocument();
      expect(screen.getByText('plateSolving.annotationCount')).toBeInTheDocument();
      expect(screen.getByText('plateSolving.analysisSummary')).toBeInTheDocument();
      expect(screen.getByText(/124/)).toBeInTheDocument();
      expect(screen.getByText(/2\.3/)).toBeInTheDocument();
      expect(screen.getByText('plateSolving.wcsMissing')).toBeInTheDocument();
    });

    it('shows disabled reason for non-actionable annotations', () => {
      render(
        <SolveResultCard
          result={successResult}
          consumption={{
            ...richConsumption,
            annotations: [
              {
                ...richConsumption.annotations[0],
                derivedCoordinates: null,
                actionability: {
                  canNavigate: false,
                  canCreateMarker: false,
                  disabledReason: 'missing_wcs',
                },
              },
            ],
          }}
        />
      );

      expect(screen.getByText('plateSolving.annotationActionDisabled.missing_wcs')).toBeInTheDocument();
    });

    it('triggers object and annotation follow-up callbacks when provided', () => {
      const onSelectObject = jest.fn();
      const onNavigateAnnotation = jest.fn();
      const onCreateMarkerFromAnnotation = jest.fn();

      render(
        <SolveResultCard
          result={successResult}
          consumption={richConsumption}
          onSelectObject={onSelectObject}
          onNavigateAnnotation={onNavigateAnnotation}
          onCreateMarkerFromAnnotation={onCreateMarkerFromAnnotation}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'M31' }));
      fireEvent.click(screen.getByRole('button', { name: 'plateSolving.goToAnnotation' }));
      fireEvent.click(screen.getByRole('button', { name: 'plateSolving.addAnnotationMarker' }));

      expect(onSelectObject).toHaveBeenCalledWith('M31');
      expect(onNavigateAnnotation).toHaveBeenCalledWith({ ra: 10.6847083, dec: 41.26875 });
      expect(onCreateMarkerFromAnnotation).toHaveBeenCalledWith({ ra: 10.6847083, dec: 41.26875, name: 'M31' });
    });
  });

  describe('failed result', () => {
    it('should show failed message', () => {
      render(<SolveResultCard result={failedResult} />);
      expect(screen.getByText('plateSolving.solveFailed')).toBeInTheDocument();
    });

    it('should show error message', () => {
      render(<SolveResultCard result={failedResult} />);
      expect(screen.getByText('No solution found')).toBeInTheDocument();
    });

    it('should use fallback error labels and parse retry attempts when translations are missing', () => {
      mockTranslate.mockImplementation(() => '');

      render(
        <SolveResultCard
          result={{
            ...failedResult,
            errorMessage: '[network] Network down (Attempt 1/3)',
          }}
        />
      );

      expect(screen.getByText('Plate Solve Failed')).toBeInTheDocument();
      expect(screen.getByText('Network down')).toBeInTheDocument();
      expect(screen.getByText('(network)')).toBeInTheDocument();
      expect(screen.getByText('Retry 1/3')).toBeInTheDocument();
      expect(screen.getByText(/Solve time: 3\.0s/)).toBeInTheDocument();
    });
  });

  describe('copy coordinates', () => {
    it('should copy coordinates to clipboard on button click', async () => {
      render(<SolveResultCard result={successResult} />);

      // Find and click the copy button (icon-only when no onGoTo)
      const buttons = screen.getAllByRole('button');
      const copyButton = buttons.find(btn => btn.textContent?.includes('common.copy'));
      expect(copyButton).toBeDefined();
      fireEvent.click(copyButton!);

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(
          expect.stringContaining('12h02m00s')
        );
        expect(mockWriteText).toHaveBeenCalledWith(
          expect.stringContaining('+45°15\'00"')
        );
      });
    });

    it('should show copied state after clicking copy', async () => {
      render(<SolveResultCard result={successResult} />);

      const buttons = screen.getAllByRole('button');
      const copyButton = buttons.find(btn => btn.textContent?.includes('common.copy'));
      fireEvent.click(copyButton!);

      await waitFor(() => {
        expect(screen.getByText('common.copied')).toBeInTheDocument();
      });
    });

    it('should render copy as icon button when onGoTo is provided', () => {
      const onGoTo = jest.fn();
      render(<SolveResultCard result={successResult} onGoTo={onGoTo} />);

      // Should have go-to button and copy icon button
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBe(2);
    });

    it('should not crash when clipboard writeText fails', async () => {
      mockWriteText.mockRejectedValueOnce(new Error('Clipboard not available'));
      render(<SolveResultCard result={successResult} />);

      const buttons = screen.getAllByRole('button');
      const copyButton = buttons.find(btn => btn.textContent?.includes('common.copy'));
      fireEvent.click(copyButton!);

      // Should not throw, component stays rendered
      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalled();
      });
      expect(screen.getByText('plateSolving.solveSuccess')).toBeInTheDocument();
    });

    it('should use fallback success labels when translations are missing', async () => {
      mockTranslate.mockImplementation(() => '');

      render(<SolveResultCard result={successResult} />);

      expect(screen.getByText('Plate Solve Successful!')).toBeInTheDocument();
      expect(screen.getByText(/Rotation: 15\.50°/)).toBeInTheDocument();
      expect(screen.getByText(/Scale: 1\.25/)).toBeInTheDocument();
      expect(screen.getByText(/FOV: 2\.50° × 1\.80°/)).toBeInTheDocument();

      fireEvent.click(screen.getByText('Copy'));

      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });
    });
  });

  describe('edge cases', () => {
    it('should render failed result without errorMessage', () => {
      const resultNoError = {
        ...failedResult,
        errorMessage: undefined,
      };
      render(<SolveResultCard result={resultNoError} />);
      expect(screen.getByText('plateSolving.solveFailed')).toBeInTheDocument();
      // Should not render error alert
      expect(screen.queryByText('No solution found')).not.toBeInTheDocument();
    });

    it('should not call onImageCapture when copy clicked on failed result', () => {
      render(<SolveResultCard result={failedResult} />);
      // No copy button for failed results (no coordinates)
      const buttons = screen.queryAllByRole('button');
      const copyButton = buttons.find(btn => btn.textContent?.includes('common.copy'));
      expect(copyButton).toBeUndefined();
    });

    it('should display solve time for failed results', () => {
      render(<SolveResultCard result={failedResult} />);
      expect(screen.getByText(/3\.0s/)).toBeInTheDocument();
      expect(screen.getByText(/ASTAP/)).toBeInTheDocument();
    });
  });
});
