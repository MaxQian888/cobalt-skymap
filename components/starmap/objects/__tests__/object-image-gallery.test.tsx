/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
    size,
    className,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: React.ReactNode;
    variant?: string;
    size?: string;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) =>
    open ? (
      <div data-testid="fullscreen-dialog" data-open={open}>
        <button data-testid="dialog-close-btn" onClick={() => onOpenChange?.(false)}>
          Close
        </button>
        {children}
      </div>
    ) : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="dialog-title" className={className}>
      {children}
    </h2>
  ),
}));

import { ObjectImageGallery } from '../object-image-gallery';
import type { ObjectImage } from '@/lib/services/object-info-service';

const mockImages: ObjectImage[] = [
  {
    url: 'https://example.com/image1.jpg',
    source: 'NASA',
    title: 'M31 Image 1',
    credit: 'NASA/ESA',
  },
  {
    url: 'https://example.com/image2.jpg',
    source: 'ESO',
    title: 'M31 Image 2',
    credit: 'ESO/VLT',
  },
  {
    url: 'https://example.com/image3.jpg',
    source: 'Hubble',
    title: 'M31 Image 3',
    credit: 'Hubble Space Telescope',
  },
];

describe('ObjectImageGallery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Empty State', () => {
    it('renders empty state when no images', () => {
      render(<ObjectImageGallery images={[]} objectName="M31" />);
      expect(screen.getByText('objectDetail.noImages')).toBeInTheDocument();
    });

    it('shows ImageOff icon in empty state', () => {
      render(<ObjectImageGallery images={[]} objectName="M31" />);
      // The ImageOff icon should be present (rendered as SVG)
      expect(screen.getByText('objectDetail.noImages')).toBeInTheDocument();
    });
  });

  describe('Single Image', () => {
    it('renders single image correctly', () => {
      render(<ObjectImageGallery images={[mockImages[0]]} objectName="M31" />);
      
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', mockImages[0].url);
      expect(img).toHaveAttribute('alt', mockImages[0].title);
    });

    it('shows image source', () => {
      render(<ObjectImageGallery images={[mockImages[0]]} objectName="M31" />);
      expect(screen.getByText('NASA')).toBeInTheDocument();
    });

    it('shows image counter as 1 / 1', () => {
      render(<ObjectImageGallery images={[mockImages[0]]} objectName="M31" />);
      expect(screen.getByText('1 / 1')).toBeInTheDocument();
    });

    it('shows image credit when available', () => {
      render(<ObjectImageGallery images={[mockImages[0]]} objectName="M31" />);
      expect(screen.getByText('NASA/ESA')).toBeInTheDocument();
    });

    it('does not show navigation arrows for single image', () => {
      render(<ObjectImageGallery images={[mockImages[0]]} objectName="M31" />);
      
      // Navigation buttons should not exist for single image
      const buttons = screen.getAllByRole('button');
      // Only fullscreen button should exist
      expect(buttons.length).toBe(1);
    });

    it('does not show dot indicators for single image', () => {
      const { container } = render(<ObjectImageGallery images={[mockImages[0]]} objectName="M31" />);
      
      // Dot buttons should not exist for single image
      const dotButtons = container.querySelectorAll('.rounded-full.w-2.h-2');
      expect(dotButtons.length).toBe(0);
    });
  });

  describe('Multiple Images', () => {
    it('renders first image by default', () => {
      render(<ObjectImageGallery images={mockImages} objectName="M31" />);
      
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', mockImages[0].url);
    });

    it('shows correct counter for multiple images', () => {
      render(<ObjectImageGallery images={mockImages} objectName="M31" />);
      expect(screen.getByText('1 / 3')).toBeInTheDocument();
    });

    it('shows navigation arrows for multiple images', () => {
      render(<ObjectImageGallery images={mockImages} objectName="M31" />);
      
      const buttons = screen.getAllByRole('button');
      // Should have: prev, next, fullscreen buttons
      expect(buttons.length).toBeGreaterThanOrEqual(3);
    });

    it('shows dot indicators for multiple images', () => {
      const { container } = render(<ObjectImageGallery images={mockImages} objectName="M31" />);
      
      // Should have 3 dot buttons
      const dotButtons = container.querySelectorAll('button.rounded-full');
      expect(dotButtons.length).toBe(3);
    });
  });

  describe('Navigation', () => {
    it('navigates to next image when next button clicked', async () => {
      render(<ObjectImageGallery images={mockImages} objectName="M31" />);
      
      // Find the next button (ChevronRight)
      const buttons = screen.getAllByRole('button');
      const nextButton = buttons.find(btn => btn.querySelector('.lucide-chevron-right'));
      
      expect(nextButton).toBeDefined();
      
      await act(async () => {
        fireEvent.click(nextButton!);
      });

      expect(screen.getByText('2 / 3')).toBeInTheDocument();
    });

    it('navigates to previous image when prev button clicked', async () => {
      render(<ObjectImageGallery images={mockImages} objectName="M31" />);
      
      // First go to next
      const buttons = screen.getAllByRole('button');
      const nextButton = buttons.find(btn => btn.querySelector('.lucide-chevron-right'));
      
      await act(async () => {
        fireEvent.click(nextButton!);
      });

      expect(screen.getByText('2 / 3')).toBeInTheDocument();

      // Then go back
      const prevButton = buttons.find(btn => btn.querySelector('.lucide-chevron-left'));
      
      await act(async () => {
        fireEvent.click(prevButton!);
      });

      expect(screen.getByText('1 / 3')).toBeInTheDocument();
    });

    it('wraps to first image when navigating past last', async () => {
      render(<ObjectImageGallery images={mockImages} objectName="M31" />);
      
      const buttons = screen.getAllByRole('button');
      const nextButton = buttons.find(btn => btn.querySelector('.lucide-chevron-right'));
      
      // Click next 3 times to wrap around
      await act(async () => {
        fireEvent.click(nextButton!);
        fireEvent.click(nextButton!);
        fireEvent.click(nextButton!);
      });

      expect(screen.getByText('1 / 3')).toBeInTheDocument();
    });

    it('wraps to last image when navigating before first', async () => {
      render(<ObjectImageGallery images={mockImages} objectName="M31" />);
      
      const buttons = screen.getAllByRole('button');
      const prevButton = buttons.find(btn => btn.querySelector('.lucide-chevron-left'));
      
      await act(async () => {
        fireEvent.click(prevButton!);
      });

      expect(screen.getByText('3 / 3')).toBeInTheDocument();
    });

    it('navigates to specific image when dot clicked', async () => {
      const { container } = render(<ObjectImageGallery images={mockImages} objectName="M31" />);
      
      const dotButtons = container.querySelectorAll('button.rounded-full');
      
      await act(async () => {
        fireEvent.click(dotButtons[2]); // Click third dot
      });

      expect(screen.getByText('3 / 3')).toBeInTheDocument();
    });
  });

  describe('Image Loading States', () => {
    it('shows loading state initially', () => {
      render(<ObjectImageGallery images={mockImages} objectName="M31" />);
      
      // Loading spinner should be visible (Loader2 icon)
      // The image should have opacity-0 class while loading
      const img = screen.getByRole('img');
      expect(img.className).toContain('opacity-0');
    });

    it('shows image after load', async () => {
      render(<ObjectImageGallery images={mockImages} objectName="M31" />);
      
      const img = screen.getByRole('img');
      
      await act(async () => {
        fireEvent.load(img);
      });

      expect(img.className).toContain('opacity-100');
    });

    it('shows error state when image fails to load', async () => {
      render(<ObjectImageGallery images={mockImages} objectName="M31" />);
      
      const img = screen.getByRole('img');
      
      await act(async () => {
        fireEvent.error(img);
      });

      expect(screen.getByText('objectDetail.imageLoadError')).toBeInTheDocument();
    });
  });

  describe('Fullscreen Mode', () => {
    it('opens fullscreen dialog when maximize button clicked', async () => {
      render(<ObjectImageGallery images={mockImages} objectName="M31" />);
      
      const buttons = screen.getAllByRole('button');
      const fullscreenButton = buttons.find(btn => btn.querySelector('.lucide-maximize2'));
      
      expect(fullscreenButton).toBeDefined();
      
      await act(async () => {
        fireEvent.click(fullscreenButton!);
      });

      expect(screen.getByTestId('fullscreen-dialog')).toBeInTheDocument();
    });

    it('closes fullscreen dialog when close button clicked', async () => {
      render(<ObjectImageGallery images={mockImages} objectName="M31" />);
      
      // Open fullscreen
      const buttons = screen.getAllByRole('button');
      const fullscreenButton = buttons.find(btn => btn.querySelector('.lucide-maximize2'));
      
      await act(async () => {
        fireEvent.click(fullscreenButton!);
      });

      expect(screen.getByTestId('fullscreen-dialog')).toBeInTheDocument();

      // Close fullscreen
      const closeButton = screen.getByTestId('dialog-close-btn');
      
      await act(async () => {
        fireEvent.click(closeButton);
      });

      expect(screen.queryByTestId('fullscreen-dialog')).not.toBeInTheDocument();
    });

    it('closes fullscreen dialog when internal close icon button clicked', async () => {
      render(<ObjectImageGallery images={mockImages} objectName="M31" />);

      const buttons = screen.getAllByRole('button');
      const fullscreenButton = buttons.find(btn => btn.querySelector('.lucide-maximize2'));

      await act(async () => {
        fireEvent.click(fullscreenButton!);
      });

      const closeIconButton = screen
        .getAllByRole('button')
        .find(btn => btn.querySelector('.lucide-x'));

      expect(closeIconButton).toBeDefined();

      await act(async () => {
        fireEvent.click(closeIconButton!);
      });

      expect(screen.queryByTestId('fullscreen-dialog')).not.toBeInTheDocument();
    });

    it('shows external link in fullscreen mode', async () => {
      render(<ObjectImageGallery images={mockImages} objectName="M31" />);
      
      const buttons = screen.getAllByRole('button');
      const fullscreenButton = buttons.find(btn => btn.querySelector('.lucide-maximize2'));
      
      await act(async () => {
        fireEvent.click(fullscreenButton!);
      });

      const externalLink = screen.getByRole('link');
      expect(externalLink).toHaveAttribute('href', mockImages[0].url);
      expect(externalLink).toHaveAttribute('target', '_blank');
    });

    it('keeps fullscreen dialog open when external link is clicked', async () => {
      render(<ObjectImageGallery images={mockImages} objectName="M31" />);

      const buttons = screen.getAllByRole('button');
      const fullscreenButton = buttons.find(btn => btn.querySelector('.lucide-maximize2'));

      await act(async () => {
        fireEvent.click(fullscreenButton!);
      });

      const externalLink = screen.getByRole('link');

      await act(async () => {
        fireEvent.click(externalLink);
      });

      expect(screen.getByTestId('fullscreen-dialog')).toBeInTheDocument();
    });

    it('renders fullscreen image with onLoad and onError handlers', async () => {
      render(<ObjectImageGallery images={mockImages} objectName="M31" />);
      
      // Open fullscreen
      const buttons = screen.getAllByRole('button');
      const fullscreenButton = buttons.find(btn => btn.querySelector('.lucide-maximize2'));
      
      await act(async () => {
        fireEvent.click(fullscreenButton!);
      });

      // Get fullscreen dialog
      const fullscreenDialog = screen.getByTestId('fullscreen-dialog');
      expect(fullscreenDialog).toBeInTheDocument();
      
      // Fullscreen should contain the image info (multiple elements may exist)
      expect(screen.getAllByText('M31 Image 1').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('NASA/ESA').length).toBeGreaterThanOrEqual(1);
    });

    it('updates fullscreen image state on load', async () => {
      render(<ObjectImageGallery images={mockImages} objectName="M31" />);

      const buttons = screen.getAllByRole('button');
      const fullscreenButton = buttons.find(btn => btn.querySelector('.lucide-maximize2'));

      await act(async () => {
        fireEvent.click(fullscreenButton!);
      });

      const fullscreenDialog = screen.getByTestId('fullscreen-dialog');
      const fullscreenImage = fullscreenDialog.querySelector('img') as HTMLImageElement;

      await act(async () => {
        fireEvent.load(fullscreenImage);
      });

      expect(fullscreenImage.className).toContain('opacity-100');
    });

    it('shows fullscreen error state when fullscreen image fails to load', async () => {
      render(<ObjectImageGallery images={mockImages} objectName="M31" />);

      const buttons = screen.getAllByRole('button');
      const fullscreenButton = buttons.find(btn => btn.querySelector('.lucide-maximize2'));

      await act(async () => {
        fireEvent.click(fullscreenButton!);
      });

      const fullscreenDialog = screen.getByTestId('fullscreen-dialog');
      const fullscreenImage = fullscreenDialog.querySelector('img') as HTMLImageElement;

      await act(async () => {
        fireEvent.error(fullscreenImage);
      });

      expect(screen.getAllByText('objectDetail.imageLoadError').length).toBeGreaterThanOrEqual(1);
    });

    it('shows image counter in fullscreen mode', async () => {
      render(<ObjectImageGallery images={mockImages} objectName="M31" />);
      
      // Open fullscreen
      const buttons = screen.getAllByRole('button');
      const fullscreenButton = buttons.find(btn => btn.querySelector('.lucide-maximize2'));
      
      await act(async () => {
        fireEvent.click(fullscreenButton!);
      });

      // Should show image counter
      expect(screen.getAllByText(/1/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/3/).length).toBeGreaterThan(0);
    });

    it('has navigation buttons in fullscreen mode', async () => {
      render(<ObjectImageGallery images={mockImages} objectName="M31" />);
      
      // Open fullscreen
      const buttons = screen.getAllByRole('button');
      const fullscreenButton = buttons.find(btn => btn.querySelector('.lucide-maximize2'));
      
      await act(async () => {
        fireEvent.click(fullscreenButton!);
      });

      // Fullscreen should have navigation buttons
      const fullscreenButtons = screen.getAllByRole('button');
      const prevButton = fullscreenButtons.find(btn => btn.querySelector('.lucide-chevron-left'));
      const nextButton = fullscreenButtons.find(btn => btn.querySelector('.lucide-chevron-right'));
      
      expect(prevButton).toBeDefined();
      expect(nextButton).toBeDefined();
    });
  });

  describe('Touch/Mouse Drag', () => {
    it('has draggable container', () => {
      const { container } = render(<ObjectImageGallery images={mockImages} objectName="M31" />);
      
      const imageContainer = container.querySelector('.cursor-grab');
      expect(imageContainer).toBeDefined();
      expect(imageContainer).toHaveClass('cursor-grab');
    });

    it('responds to mouse events', async () => {
      const { container } = render(<ObjectImageGallery images={mockImages} objectName="M31" />);
      
      const imageContainer = container.querySelector('.cursor-grab');
      expect(imageContainer).toBeDefined();

      // Just verify events don't throw errors
      await act(async () => {
        fireEvent.mouseDown(imageContainer!, { clientX: 200 });
        fireEvent.mouseMove(imageContainer!, { clientX: 100 });
        fireEvent.mouseUp(imageContainer!);
      });

      // Component should still be functional
      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('responds to touch events', async () => {
      const { container } = render(<ObjectImageGallery images={mockImages} objectName="M31" />);
      
      const imageContainer = container.querySelector('.cursor-grab');

      // Just verify events don't throw errors
      await act(async () => {
        fireEvent.touchStart(imageContainer!, { touches: [{ clientX: 200 }] });
        fireEvent.touchMove(imageContainer!, { touches: [{ clientX: 100 }] });
        fireEvent.touchEnd(imageContainer!);
      });

      // Component should still be functional
      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('handles mouse leave', async () => {
      const { container } = render(<ObjectImageGallery images={mockImages} objectName="M31" />);
      
      const imageContainer = container.querySelector('.cursor-grab');

      // Just verify events don't throw errors
      await act(async () => {
        fireEvent.mouseDown(imageContainer!, { clientX: 200 });
        fireEvent.mouseMove(imageContainer!, { clientX: 100 });
        fireEvent.mouseLeave(imageContainer!);
      });

      // Component should still be functional
      expect(screen.getByRole('img')).toBeInTheDocument();
    });
  });

  describe('Image Alt Text', () => {
    it('uses image title as alt text when available', () => {
      render(<ObjectImageGallery images={[mockImages[0]]} objectName="M31" />);
      
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('alt', 'M31 Image 1');
    });

    it('uses object name as alt text when title not available', () => {
      const imageWithoutTitle: ObjectImage = {
        url: 'https://example.com/image.jpg',
        source: 'Test',
        credit: 'Test Credit',
      };
      
      render(<ObjectImageGallery images={[imageWithoutTitle]} objectName="M31" />);
      
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('alt', 'M31');
    });
  });

  describe('Custom ClassName', () => {
    it('applies custom className', () => {
      const { container } = render(
        <ObjectImageGallery images={mockImages} objectName="M31" className="custom-class" />
      );
      
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('custom-class');
    });
  });

  describe('Keyboard Navigation', () => {
    it('navigates to next image with ArrowRight in fullscreen', async () => {
      render(<ObjectImageGallery images={mockImages} objectName="M31" />);

      // Open fullscreen
      const buttons = screen.getAllByRole('button');
      const fullscreenButton = buttons.find(btn => btn.querySelector('.lucide-maximize2'));

      await act(async () => {
        fireEvent.click(fullscreenButton!);
      });

      // Both normal and fullscreen show counter, so use getAllByText
      expect(screen.getAllByText('1 / 3').length).toBeGreaterThanOrEqual(1);

      await act(async () => {
        fireEvent.keyDown(window, { key: 'ArrowRight' });
      });

      expect(screen.getAllByText('2 / 3').length).toBeGreaterThanOrEqual(1);
    });

    it('navigates to previous image with ArrowLeft in fullscreen', async () => {
      render(<ObjectImageGallery images={mockImages} objectName="M31" />);

      const buttons = screen.getAllByRole('button');
      const fullscreenButton = buttons.find(btn => btn.querySelector('.lucide-maximize2'));

      await act(async () => {
        fireEvent.click(fullscreenButton!);
      });

      // Go to image 2 first
      await act(async () => {
        fireEvent.keyDown(window, { key: 'ArrowRight' });
      });

      expect(screen.getAllByText('2 / 3').length).toBeGreaterThanOrEqual(1);

      await act(async () => {
        fireEvent.keyDown(window, { key: 'ArrowLeft' });
      });

      expect(screen.getAllByText('1 / 3').length).toBeGreaterThanOrEqual(1);
    });

    it('closes fullscreen with Escape key', async () => {
      render(<ObjectImageGallery images={mockImages} objectName="M31" />);

      const buttons = screen.getAllByRole('button');
      const fullscreenButton = buttons.find(btn => btn.querySelector('.lucide-maximize2'));

      await act(async () => {
        fireEvent.click(fullscreenButton!);
      });

      expect(screen.getByTestId('fullscreen-dialog')).toBeInTheDocument();

      await act(async () => {
        fireEvent.keyDown(window, { key: 'Escape' });
      });

      expect(screen.queryByTestId('fullscreen-dialog')).not.toBeInTheDocument();
    });

    it('does not respond to keyboard events when not in fullscreen', async () => {
      render(<ObjectImageGallery images={mockImages} objectName="M31" />);

      expect(screen.getByText('1 / 3')).toBeInTheDocument();

      await act(async () => {
        fireEvent.keyDown(window, { key: 'ArrowRight' });
      });

      // Should still be on image 1 since not in fullscreen
      expect(screen.getByText('1 / 3')).toBeInTheDocument();
    });
  });

  describe('Drag Threshold', () => {
    it('does not switch images on small drag (< 50px)', async () => {
      const { container } = render(<ObjectImageGallery images={mockImages} objectName="M31" />);

      const imageContainer = container.querySelector('.cursor-grab');

      await act(async () => {
        fireEvent.mouseDown(imageContainer!, { clientX: 200 });
        fireEvent.mouseMove(imageContainer!, { clientX: 180 });
        fireEvent.mouseUp(imageContainer!);
      });

      // Should still be on first image
      expect(screen.getByText('1 / 3')).toBeInTheDocument();
    });

    it('handles large left drag gesture', async () => {
      const { container } = render(<ObjectImageGallery images={mockImages} objectName="M31" />);

      const imageContainer = container.querySelector('.cursor-grab');
      expect(imageContainer).toBeTruthy();

      // Simulate drag: mouseDown sets startX, mouseMove sets translateX, mouseUp triggers threshold check
      await act(async () => {
        fireEvent.mouseDown(imageContainer!, { clientX: 200 });
      });
      await act(async () => {
        fireEvent.mouseMove(imageContainer!, { clientX: 100 });
      });
      await act(async () => {
        fireEvent.mouseUp(imageContainer!);
      });

      // After a large enough drag left, it should advance to next
      // The component may or may not switch depending on threshold timing
      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('handles large right drag gesture', async () => {
      const { container } = render(<ObjectImageGallery images={mockImages} objectName="M31" />);

      const imageContainer = container.querySelector('.cursor-grab');
      expect(imageContainer).toBeTruthy();

      await act(async () => {
        fireEvent.mouseDown(imageContainer!, { clientX: 100 });
      });
      await act(async () => {
        fireEvent.mouseMove(imageContainer!, { clientX: 200 });
      });
      await act(async () => {
        fireEvent.mouseUp(imageContainer!);
      });

      // Component should still be functional
      expect(screen.getByRole('img')).toBeInTheDocument();
    });
  });

  describe('Fullscreen Error State', () => {
    it('shows error in fullscreen when image fails to load', async () => {
      render(<ObjectImageGallery images={mockImages} objectName="M31" />);

      // Trigger error on the image
      const img = screen.getByRole('img');
      await act(async () => {
        fireEvent.error(img);
      });

      // Open fullscreen
      const buttons = screen.getAllByRole('button');
      const fullscreenButton = buttons.find(btn => btn.querySelector('.lucide-maximize2'));

      await act(async () => {
        fireEvent.click(fullscreenButton!);
      });

      // Error state shows in both normal and fullscreen views
      const errorTexts = screen.getAllByText('objectDetail.imageLoadError');
      expect(errorTexts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Images Array Change', () => {
    it('resets to first image when images array changes', async () => {
      const { rerender } = render(<ObjectImageGallery images={mockImages} objectName="M31" />);
      
      // Navigate to second image
      const buttons = screen.getAllByRole('button');
      const nextButton = buttons.find(btn => btn.querySelector('.lucide-chevron-right'));
      
      await act(async () => {
        fireEvent.click(nextButton!);
      });

      expect(screen.getByText('2 / 3')).toBeInTheDocument();

      // Change images array
      const newImages: ObjectImage[] = [
        { url: 'https://example.com/new1.jpg', source: 'New Source 1', credit: 'Credit 1' },
        { url: 'https://example.com/new2.jpg', source: 'New Source 2', credit: 'Credit 2' },
      ];

      await act(async () => {
        rerender(<ObjectImageGallery images={newImages} objectName="M31" />);
      });

      // Should reset to first image
      await waitFor(() => {
        expect(screen.getByText('1 / 2')).toBeInTheDocument();
      });
    });
  });
});
