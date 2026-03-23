/**
 * Tests for fits-metadata-panel.tsx
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FitsMetadataPanel } from '../fits-metadata-panel';
import type { ImageMetadata } from '@/types/starmap/plate-solving';

// Mock next-intl
const mockTranslate = jest.fn((key: string) => key);

jest.mock('next-intl', () => ({
  useTranslations: () => mockTranslate,
}));

// Mock plate-solver-api formatFileSize
jest.mock('@/lib/tauri/plate-solver-api', () => ({
  formatFileSize: jest.fn((bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }),
}));

// Mock plate-solving formatters
jest.mock('@/lib/plate-solving', () => ({
  formatRA: jest.fn((ra: number) => `${(ra / 15).toFixed(0)}h`),
  formatDec: jest.fn((dec: number) => `+${dec.toFixed(0)}°`),
  formatPixelScale: jest.fn((scale: number) => `${scale.toFixed(2)}"/px`),
  formatExposure: jest.fn((exp: number) => `${exp}s`),
}));

describe('FitsMetadataPanel', () => {
  const basicMetadata: ImageMetadata = {
    name: 'test.jpg',
    width: 1920,
    height: 1080,
    size: 2 * 1024 * 1024,
    type: 'image/jpeg',
  };

  const fitsMetadata: ImageMetadata = {
    name: 'M42.fits',
    width: 4096,
    height: 4096,
    size: 32 * 1024 * 1024,
    type: 'application/fits',
    isFits: true,
    fitsData: {
      header: {},
      rawCards: [],
      wcs: {
        referenceCoordinates: { ra: 83.82, dec: -5.39 },
        pixelScale: 1.05,
        rotation: 12.5,
        projectionType: 'TAN',
        referencePixel: { x: 2048, y: 2048 },
        cdMatrix: { cd1_1: 0, cd1_2: 0, cd2_1: 0, cd2_2: 0 },
      },
      observation: {
        object: 'M42',
        dateObs: '2024-01-15T22:30:00',
        exptime: 120,
        filter: 'L',
        telescope: 'Celestron C8',
        instrument: 'ASI294MC',
      },
      image: {
        width: 4096,
        height: 4096,
        bitpix: 16,
        naxis: 2,
        bzero: 0,
        bscale: 1,
      },
    } as ImageMetadata['fitsData'],
  };

  beforeEach(() => {
    mockTranslate.mockImplementation((key: string) => key);
  });

  it('should render file name and dimensions', () => {
    render(<FitsMetadataPanel metadata={basicMetadata} />);
    expect(screen.getByText('test.jpg')).toBeInTheDocument();
    expect(screen.getByText('1920 × 1080')).toBeInTheDocument();
  });

  it('should render file size', () => {
    render(<FitsMetadataPanel metadata={basicMetadata} />);
    expect(screen.getByText('2.0 MB')).toBeInTheDocument();
  });

  it('should show FITS badge for FITS files', () => {
    render(<FitsMetadataPanel metadata={fitsMetadata} />);
    expect(screen.getByText('FITS')).toBeInTheDocument();
  });

  it('should not show FITS badge for non-FITS files', () => {
    render(<FitsMetadataPanel metadata={basicMetadata} />);
    expect(screen.queryByText('FITS')).not.toBeInTheDocument();
  });

  it('should show FITS metadata collapsible for FITS files', () => {
    render(<FitsMetadataPanel metadata={fitsMetadata} />);
    expect(screen.getByText('plateSolving.fitsMetadata')).toBeInTheDocument();
  });

  it('should not show FITS metadata for non-FITS files', () => {
    render(<FitsMetadataPanel metadata={basicMetadata} />);
    expect(screen.queryByText('plateSolving.fitsMetadata')).not.toBeInTheDocument();
  });

  it('should expand to show WCS info on click', () => {
    render(<FitsMetadataPanel metadata={fitsMetadata} />);

    const trigger = screen.getByText('plateSolving.fitsMetadata');
    fireEvent.click(trigger);

    expect(screen.getByText('plateSolving.wcsInfo')).toBeInTheDocument();
    expect(screen.getByText(/coordinates\.ra/)).toBeInTheDocument();
    expect(screen.getByText(/coordinates\.dec/)).toBeInTheDocument();
  });

  it('should show observation info when expanded', () => {
    render(<FitsMetadataPanel metadata={fitsMetadata} />);

    const trigger = screen.getByText('plateSolving.fitsMetadata');
    fireEvent.click(trigger);

    expect(screen.getByText('plateSolving.observationInfo')).toBeInTheDocument();
    expect(screen.getByText('M42')).toBeInTheDocument();
    expect(screen.getByText('Celestron C8')).toBeInTheDocument();
    expect(screen.getByText('ASI294MC')).toBeInTheDocument();
  });

  it('should show image info when expanded', () => {
    render(<FitsMetadataPanel metadata={fitsMetadata} />);

    const trigger = screen.getByText('plateSolving.fitsMetadata');
    fireEvent.click(trigger);

    expect(screen.getByText('plateSolving.imageInfo')).toBeInTheDocument();
    // 4096 × 4096 appears in both the summary bar and the image info section
    expect(screen.getAllByText('4096 × 4096').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('16-bit')).toBeInTheDocument();
  });

  it('should hide dimensions when width is 0', () => {
    const metadata: ImageMetadata = {
      ...basicMetadata,
      width: 0,
      height: 0,
    };
    render(<FitsMetadataPanel metadata={metadata} />);
    expect(screen.queryByText('0 × 0')).not.toBeInTheDocument();
  });

  it('should render fitsData without wcs section', () => {
    const metadata: ImageMetadata = {
      ...fitsMetadata,
      fitsData: {
        header: {},
        rawCards: [],
        observation: fitsMetadata.fitsData!.observation,
        image: fitsMetadata.fitsData!.image,
      } as ImageMetadata['fitsData'],
    };
    render(<FitsMetadataPanel metadata={metadata} />);

    const trigger = screen.getByText('plateSolving.fitsMetadata');
    fireEvent.click(trigger);

    expect(screen.queryByText('plateSolving.wcsInfo')).not.toBeInTheDocument();
    expect(screen.getByText('plateSolving.observationInfo')).toBeInTheDocument();
    expect(screen.getByText('plateSolving.imageInfo')).toBeInTheDocument();
  });

  it('should render fitsData without observation section', () => {
    const metadata: ImageMetadata = {
      ...fitsMetadata,
      fitsData: {
        header: {},
        rawCards: [],
        wcs: fitsMetadata.fitsData!.wcs,
        image: fitsMetadata.fitsData!.image,
      } as ImageMetadata['fitsData'],
    };
    render(<FitsMetadataPanel metadata={metadata} />);

    const trigger = screen.getByText('plateSolving.fitsMetadata');
    fireEvent.click(trigger);

    expect(screen.getByText('plateSolving.wcsInfo')).toBeInTheDocument();
    expect(screen.queryByText('plateSolving.observationInfo')).not.toBeInTheDocument();
  });

  it('should render fitsData without image section', () => {
    const metadata: ImageMetadata = {
      ...fitsMetadata,
      fitsData: {
        header: {},
        rawCards: [],
        wcs: fitsMetadata.fitsData!.wcs,
        observation: fitsMetadata.fitsData!.observation,
      } as ImageMetadata['fitsData'],
    };
    render(<FitsMetadataPanel metadata={metadata} />);

    const trigger = screen.getByText('plateSolving.fitsMetadata');
    fireEvent.click(trigger);

    expect(screen.queryByText('plateSolving.imageInfo')).not.toBeInTheDocument();
  });

  it('should render observation with only partial fields', () => {
    const metadata: ImageMetadata = {
      ...fitsMetadata,
      fitsData: {
        header: {},
        rawCards: [],
        observation: {
          object: 'NGC7000',
        },
      } as ImageMetadata['fitsData'],
    };
    render(<FitsMetadataPanel metadata={metadata} />);

    const trigger = screen.getByText('plateSolving.fitsMetadata');
    fireEvent.click(trigger);

    expect(screen.getByText('NGC7000')).toBeInTheDocument();
    expect(screen.queryByText('plateSolving.dateObs')).not.toBeInTheDocument();
    expect(screen.queryByText('plateSolving.exposure')).not.toBeInTheDocument();
    expect(screen.queryByText('plateSolving.filter')).not.toBeInTheDocument();
    expect(screen.queryByText('plateSolving.telescope')).not.toBeInTheDocument();
    expect(screen.queryByText('plateSolving.instrument')).not.toBeInTheDocument();
  });

  it('should render WCS without projectionType', () => {
    const metadata: ImageMetadata = {
      ...fitsMetadata,
      fitsData: {
        header: {},
        rawCards: [],
        wcs: {
          referenceCoordinates: { ra: 83.82, dec: -5.39 },
          pixelScale: 1.05,
          rotation: 12.5,
          referencePixel: { x: 2048, y: 2048 },
          cdMatrix: { cd1_1: 0, cd1_2: 0, cd2_1: 0, cd2_2: 0 },
        },
      } as ImageMetadata['fitsData'],
    };
    render(<FitsMetadataPanel metadata={metadata} />);

    const trigger = screen.getByText('plateSolving.fitsMetadata');
    fireEvent.click(trigger);

    expect(screen.getByText('plateSolving.wcsInfo')).toBeInTheDocument();
    expect(screen.queryByText('plateSolving.projection')).not.toBeInTheDocument();
  });

  it('should render observation with dateObs and exptime but no object', () => {
    const metadata: ImageMetadata = {
      ...fitsMetadata,
      fitsData: {
        header: {},
        rawCards: [],
        observation: {
          dateObs: '2024-06-15T01:00:00',
          exptime: 300,
          filter: 'Ha',
        },
      } as ImageMetadata['fitsData'],
    };
    render(<FitsMetadataPanel metadata={metadata} />);

    const trigger = screen.getByText('plateSolving.fitsMetadata');
    fireEvent.click(trigger);

    expect(screen.queryByText('plateSolving.object')).not.toBeInTheDocument();
    expect(screen.getByText('2024-06-15T01:00:00')).toBeInTheDocument();
    expect(screen.getByText('300s')).toBeInTheDocument();
    expect(screen.getByText('Ha')).toBeInTheDocument();
  });

  it('should use fallback English labels when translations are missing', () => {
    mockTranslate.mockImplementation(() => '');

    render(<FitsMetadataPanel metadata={fitsMetadata} />);

    fireEvent.click(screen.getByText('FITS Metadata'));

    expect(screen.getByText('WCS Coordinates')).toBeInTheDocument();
    expect(screen.getByText('Observation Info')).toBeInTheDocument();
    expect(screen.getByText('Image Info')).toBeInTheDocument();
    expect(screen.getByText(/Projection/)).toBeInTheDocument();
    expect(screen.getByText(/Exposure/)).toBeInTheDocument();
    expect(screen.getByText(/Bit Depth/)).toBeInTheDocument();
  });
});
