import { toast } from 'sonner';
import { clipboardService } from '@/lib/services/clipboard-service';
import { copyTextWithFeedback } from '../clipboard-feedback';

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/services/clipboard-service', () => ({
  clipboardService: {
    writeText: jest.fn(),
  },
}));

const mockToast = toast as jest.Mocked<typeof toast>;
const mockClipboardService = clipboardService as jest.Mocked<typeof clipboardService>;

describe('clipboard-feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('copies text, shows a success toast, and calls onSuccess', async () => {
    const onSuccess = jest.fn();
    mockClipboardService.writeText.mockResolvedValueOnce();

    const result = await copyTextWithFeedback({
      text: 'M42',
      successMessage: 'Copied',
      successDescription: 'Target copied to clipboard',
      errorMessage: 'Failed',
      onSuccess,
    });

    expect(result).toBe(true);
    expect(mockClipboardService.writeText).toHaveBeenCalledWith('M42');
    expect(mockToast.success).toHaveBeenCalledWith('Copied', {
      description: 'Target copied to clipboard',
    });
    expect(mockToast.error).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('shows an error toast, calls onError, and returns false when copy fails', async () => {
    const error = new Error('clipboard denied');
    const onError = jest.fn();
    mockClipboardService.writeText.mockRejectedValueOnce(error);

    const result = await copyTextWithFeedback({
      text: 'M31',
      successMessage: 'Copied',
      errorMessage: 'Failed',
      errorDescription: 'Clipboard unavailable',
      onError,
    });

    expect(result).toBe(false);
    expect(mockClipboardService.writeText).toHaveBeenCalledWith('M31');
    expect(mockToast.success).not.toHaveBeenCalled();
    expect(mockToast.error).toHaveBeenCalledWith('Failed', {
      description: 'Clipboard unavailable',
    });
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('omits optional callbacks and descriptions when they are not provided', async () => {
    mockClipboardService.writeText.mockResolvedValueOnce();

    await expect(
      copyTextWithFeedback({
        text: 'NGC 7000',
        successMessage: 'Copied',
        errorMessage: 'Failed',
      })
    ).resolves.toBe(true);

    expect(mockToast.success).toHaveBeenCalledWith('Copied', {
      description: undefined,
    });
  });
});
