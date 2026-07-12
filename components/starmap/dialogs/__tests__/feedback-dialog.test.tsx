/**
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FeedbackDialog } from '../feedback-dialog';
import { useFeedbackStore } from '@/lib/stores/feedback-store';
import { toast } from 'sonner';

const mockOpenExternalUrl = jest.fn();
const mockCollectDiagnostics = jest.fn();
const mockBuildGitHubIssueUrl = jest.fn();
const mockBuildIssueBodyMarkdown = jest.fn();
const mockExportDiagnosticsBundle = jest.fn();
const mockCopyTextWithFeedback = jest.fn();

jest.mock('@/lib/tauri/app-control-api', () => ({
  openExternalUrl: (url: string) => mockOpenExternalUrl(url),
}));

jest.mock('@/lib/feedback/feedback-utils', () => ({
  collectDiagnostics: (...args: unknown[]) => mockCollectDiagnostics(...args),
  buildGitHubIssueUrl: (...args: unknown[]) => mockBuildGitHubIssueUrl(...args),
  buildIssueBodyMarkdown: (...args: unknown[]) => mockBuildIssueBodyMarkdown(...args),
  exportDiagnosticsBundle: (...args: unknown[]) => mockExportDiagnosticsBundle(...args),
}));

jest.mock('@/lib/utils/clipboard-feedback', () => ({
  copyTextWithFeedback: (...args: unknown[]) => mockCopyTextWithFeedback(...args),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock('next/image', () => {
  const MockImage = (props: Record<string, unknown>) =>
    React.createElement('img', { ...props });
  MockImage.displayName = 'MockImage';
  return { __esModule: true, default: MockImage };
});

// Helper: fill all required bug fields
function fillBugFields() {
  fireEvent.change(screen.getByTestId('feedback-title-input'), { target: { value: 'Test bug title' } });
  fireEvent.change(screen.getByTestId('feedback-description-input'), { target: { value: 'Bug description' } });
  fireEvent.change(screen.getByTestId('feedback-steps-input'), { target: { value: '1. Step one' } });
  fireEvent.change(screen.getByTestId('feedback-expected-input'), { target: { value: 'Expected result' } });
}

describe('FeedbackDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useFeedbackStore.setState({
      draft: {
        type: 'bug',
        title: '',
        description: '',
        reproductionSteps: '',
        expectedBehavior: '',
        additionalContext: '',
        includeSystemInfo: false,
        includeLogs: false,
      },
      preferences: {
        includeSystemInfo: false,
        includeLogs: false,
      },
    });
    mockCollectDiagnostics.mockResolvedValue(null);
    mockBuildIssueBodyMarkdown.mockReturnValue('## Summary');
    mockBuildGitHubIssueUrl.mockReturnValue({
      url: 'https://github.com/AstroAir/skymap-test/issues/new?template=bug_report.yml',
      markdownBody: '## Summary',
      truncated: false,
      diagnosticsIncluded: false,
      estimatedLength: 120,
    });
    mockExportDiagnosticsBundle.mockResolvedValue('skymap-diagnostics.json');
    mockCopyTextWithFeedback.mockResolvedValue(true);
  });

  // ========================================================================
  // Basic rendering & controlled mode
  // ========================================================================

  it('requires required fields before submit', async () => {
    render(<FeedbackDialog open onOpenChange={jest.fn()} />);

    fireEvent.click(screen.getByTestId('feedback-submit-button'));

    await waitFor(() => {
      expect(mockOpenExternalUrl).not.toHaveBeenCalled();
    });
  });

  it('keeps diagnostics switches disabled by default', () => {
    render(<FeedbackDialog open onOpenChange={jest.fn()} />);

    expect(screen.getByTestId('feedback-include-system-switch')).toHaveAttribute('data-state', 'unchecked');
    expect(screen.getByTestId('feedback-include-logs-switch')).toHaveAttribute('data-state', 'unchecked');
  });

  it('collects diagnostics and opens GitHub issue URL on submit', async () => {
    render(<FeedbackDialog open onOpenChange={jest.fn()} />);

    fillBugFields();

    fireEvent.click(screen.getByTestId('feedback-include-system-switch'));
    fireEvent.click(screen.getByTestId('feedback-include-logs-switch'));

    mockCollectDiagnostics.mockResolvedValue({
      generatedAt: '2026-02-20T00:00:00.000Z',
      app: {
        name: 'Cobalt Skymap',
        version: '0.1.0',
        buildDate: '2026-02-20',
        environment: 'web',
      },
      logs: 'sample logs',
    });

    fireEvent.click(screen.getByTestId('feedback-submit-button'));

    await waitFor(() => {
      expect(mockCollectDiagnostics).toHaveBeenCalledWith({
        includeSystemInfo: true,
        includeLogs: true,
      });
      expect(mockBuildGitHubIssueUrl).toHaveBeenCalled();
      expect(mockOpenExternalUrl).toHaveBeenCalledWith(
        'https://github.com/AstroAir/skymap-test/issues/new?template=bug_report.yml'
      );
    });
  });

  it('exports diagnostics bundle when user clicks download', async () => {
    useFeedbackStore.setState((state) => ({
      draft: { ...state.draft, includeSystemInfo: true, includeLogs: false },
      preferences: { ...state.preferences, includeSystemInfo: true, includeLogs: false },
    }));

    render(<FeedbackDialog open onOpenChange={jest.fn()} />);
    mockCollectDiagnostics.mockResolvedValue({
      generatedAt: '2026-02-20T00:00:00.000Z',
      app: {
        name: 'Cobalt Skymap',
        version: '0.1.0',
        buildDate: '2026-02-20',
        environment: 'web',
      },
    });

    fireEvent.click(screen.getByTestId('feedback-download-button'));

    await waitFor(() => {
      expect(mockCollectDiagnostics).toHaveBeenCalledWith({
        includeSystemInfo: true,
        includeLogs: false,
      });
      expect(mockExportDiagnosticsBundle).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Uncontrolled mode & trigger
  // ========================================================================

  it('works in uncontrolled mode without open prop', () => {
    const { container } = render(<FeedbackDialog />);
    // Should render without crashing (uses internal state)
    expect(container).toBeInTheDocument();
  });

  it('renders custom trigger when provided', () => {
    const trigger = <button data-testid="custom-trigger">Report</button>;
    render(<FeedbackDialog trigger={trigger} />);
    expect(screen.getByTestId('custom-trigger')).toBeInTheDocument();
  });

  it('uses drawer container on narrow viewport', () => {
    // Dialogs follow the 900px shell decision, which reads viewport size
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500,
    });

    render(<FeedbackDialog open onOpenChange={jest.fn()} />);
    expect(document.querySelector('[data-slot="drawer-content"]')).toBeInTheDocument();

    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalWidth,
    });
  });

  // ========================================================================
  // validateDraft branches
  // ========================================================================

  it('shows error when title is empty on submit', async () => {
    render(<FeedbackDialog open onOpenChange={jest.fn()} />);

    fireEvent.change(screen.getByTestId('feedback-description-input'), { target: { value: 'desc' } });
    fireEvent.click(screen.getByTestId('feedback-submit-button'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('feedback.errors.titleRequired');
    });
  });

  it('shows error when description is empty on submit', async () => {
    render(<FeedbackDialog open onOpenChange={jest.fn()} />);

    fireEvent.change(screen.getByTestId('feedback-title-input'), { target: { value: 'title' } });
    fireEvent.click(screen.getByTestId('feedback-submit-button'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('feedback.errors.descriptionRequired');
    });
  });

  it('shows error when reproduction steps are empty for bug type', async () => {
    render(<FeedbackDialog open onOpenChange={jest.fn()} />);

    fireEvent.change(screen.getByTestId('feedback-title-input'), { target: { value: 'title' } });
    fireEvent.change(screen.getByTestId('feedback-description-input'), { target: { value: 'desc' } });
    fireEvent.click(screen.getByTestId('feedback-submit-button'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('feedback.errors.stepsRequired');
    });
  });

  it('shows error when expected behavior is empty for bug type', async () => {
    render(<FeedbackDialog open onOpenChange={jest.fn()} />);

    fireEvent.change(screen.getByTestId('feedback-title-input'), { target: { value: 'title' } });
    fireEvent.change(screen.getByTestId('feedback-description-input'), { target: { value: 'desc' } });
    fireEvent.change(screen.getByTestId('feedback-steps-input'), { target: { value: 'steps' } });
    fireEvent.click(screen.getByTestId('feedback-submit-button'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('feedback.errors.expectedRequired');
    });
  });

  it('does not require steps/expected for feature type', async () => {
    useFeedbackStore.setState((state) => ({
      draft: { ...state.draft, type: 'feature' },
    }));

    render(<FeedbackDialog open onOpenChange={jest.fn()} />);

    fireEvent.change(screen.getByTestId('feedback-title-input'), { target: { value: 'Feature idea' } });
    fireEvent.change(screen.getByTestId('feedback-description-input'), { target: { value: 'Feature desc' } });

    fireEvent.click(screen.getByTestId('feedback-submit-button'));

    await waitFor(() => {
      expect(mockOpenExternalUrl).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // handleCopyMarkdown
  // ========================================================================

  it('copies markdown to clipboard on valid form', async () => {
    render(<FeedbackDialog open onOpenChange={jest.fn()} />);
    fillBugFields();

    fireEvent.click(screen.getByTestId('feedback-copy-button'));

    await waitFor(() => {
      expect(mockBuildIssueBodyMarkdown).toHaveBeenCalled();
      expect(mockCopyTextWithFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: '## Summary',
          successMessage: 'feedback.toast.markdownCopied',
          errorMessage: 'feedback.toast.copyFailed',
        })
      );
    });
  });

  it('shows validation error on copy when title is empty', async () => {
    render(<FeedbackDialog open onOpenChange={jest.fn()} />);

    fireEvent.click(screen.getByTestId('feedback-copy-button'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('feedback.errors.titleRequired');
      expect(mockBuildIssueBodyMarkdown).not.toHaveBeenCalled();
    });
  });

  it('handles clipboard helper failure gracefully', async () => {
    mockCopyTextWithFeedback.mockResolvedValueOnce(false);

    render(<FeedbackDialog open onOpenChange={jest.fn()} />);
    fillBugFields();

    fireEvent.click(screen.getByTestId('feedback-copy-button'));

    await waitFor(() => {
      expect(mockCopyTextWithFeedback).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // handleDownloadDiagnostics
  // ========================================================================

  it('shows info toast when no diagnostics options are enabled', async () => {
    render(<FeedbackDialog open onOpenChange={jest.fn()} />);

    fireEvent.click(screen.getByTestId('feedback-download-button'));

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith('feedback.toast.enableDiagnosticsForExport');
      expect(mockCollectDiagnostics).not.toHaveBeenCalled();
    });
  });

  it('shows info toast when diagnostics collection returns null', async () => {
    useFeedbackStore.setState((state) => ({
      draft: { ...state.draft, includeSystemInfo: true },
      preferences: { ...state.preferences, includeSystemInfo: true },
    }));
    mockCollectDiagnostics.mockResolvedValue(null);

    render(<FeedbackDialog open onOpenChange={jest.fn()} />);
    fireEvent.click(screen.getByTestId('feedback-download-button'));

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith('feedback.toast.noDiagnosticsCollected');
    });
  });

  it('shows info toast when download is cancelled (export returns null)', async () => {
    useFeedbackStore.setState((state) => ({
      draft: { ...state.draft, includeSystemInfo: true },
      preferences: { ...state.preferences, includeSystemInfo: true },
    }));
    mockCollectDiagnostics.mockResolvedValue({ generatedAt: 'x', app: { name: 'S', version: '1', buildDate: 'd', environment: 'web' } });
    mockExportDiagnosticsBundle.mockResolvedValue(null);

    render(<FeedbackDialog open onOpenChange={jest.fn()} />);
    fireEvent.click(screen.getByTestId('feedback-download-button'));

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith('feedback.toast.downloadCancelled');
    });
  });

  it('handles export error gracefully', async () => {
    useFeedbackStore.setState((state) => ({
      draft: { ...state.draft, includeSystemInfo: true },
      preferences: { ...state.preferences, includeSystemInfo: true },
    }));
    mockCollectDiagnostics.mockResolvedValue({ generatedAt: 'x', app: { name: 'S', version: '1', buildDate: 'd', environment: 'web' } });
    mockExportDiagnosticsBundle.mockRejectedValue(new Error('fail'));

    render(<FeedbackDialog open onOpenChange={jest.fn()} />);
    fireEvent.click(screen.getByTestId('feedback-download-button'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('feedback.toast.exportFailed');
    });
  });

  // ========================================================================
  // handleSubmit edge cases
  // ========================================================================

  it('shows warning toast when URL is truncated', async () => {
    mockBuildGitHubIssueUrl.mockReturnValue({
      url: 'https://github.com/AstroAir/skymap-test/issues/new',
      markdownBody: '...',
      truncated: true,
      diagnosticsIncluded: false,
      estimatedLength: 9000,
    });

    render(<FeedbackDialog open onOpenChange={jest.fn()} />);
    fillBugFields();

    fireEvent.click(screen.getByTestId('feedback-submit-button'));

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith('feedback.toast.urlTruncated');
      expect(toast.success).toHaveBeenCalledWith('feedback.toast.openedInBrowser');
    });
  });

  it('shows error toast when submit fails', async () => {
    mockOpenExternalUrl.mockRejectedValue(new Error('network'));

    render(<FeedbackDialog open onOpenChange={jest.fn()} />);
    fillBugFields();

    fireEvent.click(screen.getByTestId('feedback-submit-button'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('feedback.toast.submitFailed');
    });
  });

  // ========================================================================
  // Form field interactions
  // ========================================================================

  it('updates additional context field', () => {
    render(<FeedbackDialog open onOpenChange={jest.fn()} />);

    fireEvent.change(screen.getByTestId('feedback-additional-input'), { target: { value: 'Extra info' } });

    expect(useFeedbackStore.getState().draft.additionalContext).toBe('Extra info');
  });

  it('calls onOpenChange when controlled dialog closes on submit', async () => {
    const onOpenChange = jest.fn();
    mockOpenExternalUrl.mockResolvedValue(undefined);

    render(<FeedbackDialog open onOpenChange={onOpenChange} />);
    fillBugFields();

    fireEvent.click(screen.getByTestId('feedback-submit-button'));

    await waitFor(() => {
      expect(mockOpenExternalUrl).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  // ========================================================================
  // Draft reset after submit
  // ========================================================================

  it('resets draft after successful submit', async () => {
    mockOpenExternalUrl.mockResolvedValue(undefined);

    render(<FeedbackDialog open onOpenChange={jest.fn()} />);
    fillBugFields();

    fireEvent.click(screen.getByTestId('feedback-submit-button'));

    await waitFor(() => {
      expect(mockOpenExternalUrl).toHaveBeenCalled();
    });

    const { draft } = useFeedbackStore.getState();
    expect(draft.title).toBe('');
    expect(draft.description).toBe('');
  });

  // ========================================================================
  // Reset button
  // ========================================================================

  it('resets form when reset button is clicked', () => {
    useFeedbackStore.setState((state) => ({
      draft: { ...state.draft, title: 'Some title', description: 'Some desc' },
    }));

    render(<FeedbackDialog open onOpenChange={jest.fn()} />);

    fireEvent.click(screen.getByTestId('feedback-reset-button'));
    fireEvent.click(screen.getByTestId('feedback-reset-confirm-button'));

    expect(toast.info).toHaveBeenCalledWith('feedback.toast.draftCleared');
    const { draft } = useFeedbackStore.getState();
    expect(draft.title).toBe('');
    expect(draft.description).toBe('');
  });

  // ========================================================================
  // Severity / Priority select
  // ========================================================================

  it('renders severity select for bug type', () => {
    render(<FeedbackDialog open onOpenChange={jest.fn()} />);
    expect(screen.getByTestId('feedback-severity-select')).toBeInTheDocument();
  });

  it('renders priority select for feature type', () => {
    useFeedbackStore.setState((state) => ({
      draft: { ...state.draft, type: 'feature' },
    }));

    render(<FeedbackDialog open onOpenChange={jest.fn()} />);
    expect(screen.getByTestId('feedback-priority-select')).toBeInTheDocument();
  });

  // ========================================================================
  // Keyboard shortcut (Ctrl+Enter)
  // ========================================================================

  it('submits on Ctrl+Enter when form is valid', async () => {
    mockOpenExternalUrl.mockResolvedValue(undefined);

    render(<FeedbackDialog open onOpenChange={jest.fn()} />);
    fillBugFields();

    const dialogContent = screen.getByTestId('feedback-submit-button').closest('[data-slot="dialog-content"]');
    expect(dialogContent).toBeTruthy();
    fireEvent.keyDown(dialogContent!, { key: 'Enter', ctrlKey: true });

    await waitFor(() => {
      expect(mockOpenExternalUrl).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Screenshot button
  // ========================================================================

  it('renders screenshot capture button', () => {
    render(<FeedbackDialog open onOpenChange={jest.fn()} />);
    expect(screen.getByTestId('feedback-screenshot-button')).toBeInTheDocument();
  });

  // ========================================================================
  // Preview toggle
  // ========================================================================

  it('renders preview toggle button', () => {
    render(<FeedbackDialog open onOpenChange={jest.fn()} />);
    expect(screen.getByTestId('feedback-preview-toggle')).toBeInTheDocument();
  });
});
