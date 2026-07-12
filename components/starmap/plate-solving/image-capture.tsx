'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { 
  Camera, 
  Upload, 
  RotateCcw, 
  Check, 
  FileImage, 
  AlertCircle,
  Loader2,
  ImageIcon,
  ChevronDown,
  SwitchCamera,
  Flashlight,
  ZoomIn,
  Smartphone,
  Monitor,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SwitchItem } from '@/components/ui/switch-item';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  parseFITSHeader, 
  isFITSFile,
  readFITSPixelData,
  generatePreviewImageData,
  getImageDimensions,
  compressImage,
  DEFAULT_MAX_FILE_SIZE_MB,
  DEFAULT_ACCEPTED_FORMATS,
  COMPRESSION_QUALITY,
  MAX_DIMENSION_FOR_PREVIEW,
} from '@/lib/plate-solving';
import { formatFileSize } from '@/lib/tauri/plate-solver-api';
import { useCamera } from '@/lib/hooks/use-camera';
import { isMobile } from '@/lib/storage/platform';
import { useMobileShell } from '@/components/starmap/view/use-mobile-shell';
import { FitsMetadataPanel } from './fits-metadata-panel';
import type { ImageMetadata, ImageCaptureProps } from '@/types/starmap/plate-solving';

// Re-export types for backward compatibility
export type { ImageMetadata, ImageCaptureProps } from '@/types/starmap/plate-solving';

// ============================================================================
// Helpers
// ============================================================================

function getCameraErrorMessage(
  errorType: string | null,
  errorMsg: string | null,
  t: (key: string) => string,
): string {
  switch (errorType) {
    case 'permission-denied':
      return t('plateSolving.permissionDenied') || 'Camera permission denied. Please enable in browser settings.';
    case 'not-found':
      return t('plateSolving.noCamera') || 'No camera detected';
    case 'in-use':
      return t('plateSolving.cameraInUse') || 'Camera is in use by another application';
    case 'not-supported':
      return t('plateSolving.cameraError') || 'Camera not supported';
    default:
      return errorMsg || t('plateSolving.cameraError') || 'Failed to access camera';
  }
}

// ============================================================================
// Component
// ============================================================================

export function ImageCapture({ 
  onImageCapture, 
  trigger, 
  className,
  maxFileSizeMB = DEFAULT_MAX_FILE_SIZE_MB,
  enableCompression = true,
  acceptedFormats = DEFAULT_ACCEPTED_FORMATS
}: ImageCaptureProps) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'camera' | 'upload'>('upload');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const [imageMetadata, setImageMetadata] = useState<ImageMetadata | null>(null);
  const [compressionEnabled, setCompressionEnabled] = useState(enableCompression);
  const [compressionQuality, setCompressionQuality] = useState(85);
  const [useNativeCapture, setUseNativeCapture] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nativeCaptureRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Device capability (native capture input) is UA-based; layout follows the
  // reactive shell breakpoint so resize/rotation re-evaluates it.
  const mobileDevice = useMemo(() => isMobile(), []);
  const { isMobileShell } = useMobileShell();
  const mobile = mobileDevice || isMobileShell;
  const camera = useCamera({ facingMode: 'environment' });

  const maxFileSizeBytes = useMemo(() => maxFileSizeMB * 1024 * 1024, [maxFileSizeMB]);

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > maxFileSizeBytes) {
      return t('plateSolving.fileTooLarge') || `File too large. Maximum size is ${maxFileSizeMB}MB`;
    }
    
    const isFits = isFITSFile(file);
    if (!isFits && !acceptedFormats.includes(file.type) && !file.type.startsWith('image/')) {
      return t('plateSolving.unsupportedFormat') || 'Unsupported file format';
    }
    
    return null;
  }, [maxFileSizeBytes, maxFileSizeMB, acceptedFormats, t]);

  const processFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setLoadingProgress(0);
    setFileError(null);
    
    try {
      const validationError = validateFile(file);
      if (validationError) {
        setFileError(validationError);
        setIsLoading(false);
        return;
      }
      
      setLoadingProgress(20);
      
      const isFits = isFITSFile(file);
      const metadata: ImageMetadata = {
        width: 0,
        height: 0,
        size: file.size,
        type: file.type || (isFits ? 'image/fits' : 'unknown'),
        name: file.name,
        isFits,
      };
      
      if (isFits) {
        try {
          const fitsData = await parseFITSHeader(file);
          metadata.fitsData = fitsData;
          if (fitsData.image) {
            metadata.width = fitsData.image.width;
            metadata.height = fitsData.image.height;
          }
        } catch {
          // Continue without FITS metadata if parsing fails
        }
      } else {
        try {
          const dims = await getImageDimensions(file);
          metadata.width = dims.width;
          metadata.height = dims.height;
        } catch {
          // Continue without dimensions for non-standard formats
        }
      }
      
      setLoadingProgress(50);
      
      let processedFile = file;
      
      if (compressionEnabled && !isFits && file.size > 2 * 1024 * 1024) {
        try {
          processedFile = await compressImage(
            file,
            MAX_DIMENSION_FOR_PREVIEW,
            compressionQuality / 100
          );
          metadata.size = processedFile.size;
        } catch {
          // Use original if compression fails
        }
      }
      
      setLoadingProgress(80);
      
      setCapturedFile(processedFile);
      setImageMetadata(metadata);
      
      if (!isFits) {
        const reader = new FileReader();
        reader.onprogress = (e) => {
          if (e.lengthComputable) {
            setLoadingProgress(80 + (e.loaded / e.total) * 20);
          }
        };
        reader.onload = (event) => {
          setCapturedImage(event.target?.result as string);
          setLoadingProgress(100);
          setIsLoading(false);
        };
        reader.onerror = () => {
          setFileError(t('plateSolving.readError') || 'Failed to read file');
          setIsLoading(false);
        };
        reader.readAsDataURL(processedFile);
      } else {
        // Generate FITS preview from pixel data (limit to files < 100MB)
        if (file.size < 100 * 1024 * 1024) {
          try {
            const pixelData = await readFITSPixelData(file);
            if (pixelData) {
              const imageData = generatePreviewImageData(pixelData, 'asinh');
              const canvas = document.createElement('canvas');
              canvas.width = imageData.width;
              canvas.height = imageData.height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.putImageData(imageData, 0, 0);
                setCapturedImage(canvas.toDataURL('image/png'));
              }
            }
          } catch {
            // Preview generation failed — continue without preview
          }
        }
        setLoadingProgress(100);
        setIsLoading(false);
      }
    } catch (error) {
      setFileError(
        error instanceof Error 
          ? error.message 
          : t('plateSolving.processingError') || 'Failed to process image'
      );
      setIsLoading(false);
    }
  }, [validateFile, compressionEnabled, compressionQuality, t]);

  // Attach stream to video element when camera starts
  useEffect(() => {
    if (camera.stream && videoRef.current) {
      videoRef.current.srcObject = camera.stream;
      videoRef.current.play().catch(() => {
        // Autoplay may be blocked
      });
    }
  }, [camera.stream]);

  const resetState = useCallback(() => {
    setCapturedImage(null);
    setCapturedFile(null);
    setFileError(null);
    setImageMetadata(null);
    setLoadingProgress(0);
    camera.stop();
  }, [camera]);

  const capturePhoto = useCallback(() => {
    const result = camera.capture(videoRef, canvasRef, COMPRESSION_QUALITY);
    if (result) {
      setCapturedFile(result.file);
      setCapturedImage(result.dataUrl);
      setImageMetadata({
        width: result.width,
        height: result.height,
        size: result.file.size,
        type: 'image/jpeg',
        name: result.file.name,
      });
      camera.stop();
    }
  }, [camera]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    if (e.target) {
      e.target.value = '';
    }
  }, [processFile]);

  // Handle native camera capture on mobile
  const handleNativeCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    if (e.target) {
      e.target.value = '';
    }
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleConfirm = useCallback(() => {
    if (capturedFile) {
      onImageCapture(capturedFile, imageMetadata || undefined);
      setOpen(false);
      resetState();
    }
  }, [capturedFile, imageMetadata, onImageCapture, resetState]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      resetState();
    }
  }, [resetState]);

  const switchToCamera = useCallback(() => {
    setMode('camera');
    resetState();
    if (mobileDevice && useNativeCapture) {
      // For native capture, just trigger the input
      nativeCaptureRef.current?.click();
    } else {
      camera.start();
    }
  }, [camera, resetState, mobileDevice, useNativeCapture]);

  const switchToUpload = useCallback(() => {
    setMode('upload');
    resetState();
  }, [resetState]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className={className}>
            <Camera className="h-4 w-4 mr-2" />
            {t('plateSolving.captureImage') || 'Capture Image'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className={mobile ? 'max-w-full h-full sm:max-w-full' : 'sm:max-w-[540px]'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            {t('plateSolving.imageCapture') || 'Image Capture'}
          </DialogTitle>
          <DialogDescription>
            {t('plateSolving.imageCaptureDesc') || 'Upload an image or take a photo for plate solving'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 flex flex-col">
          <Tabs value={mode} onValueChange={(v) => v === 'camera' ? switchToCamera() : switchToUpload()} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload" disabled={isLoading || camera.isLoading}>
                <Upload className="h-4 w-4 mr-2" />
                {t('plateSolving.uploadFile') || 'Upload File'}
              </TabsTrigger>
              <TabsTrigger value="camera" disabled={isLoading || camera.isLoading}>
                <Camera className="h-4 w-4 mr-2" />
                {t('plateSolving.useCamera') || 'Use Camera'}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Mobile: native vs browser camera toggle */}
          {mobileDevice && mode === 'camera' && !capturedImage && (
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {useNativeCapture ? (
                  <Smartphone className="h-4 w-4" />
                ) : (
                  <Monitor className="h-4 w-4" />
                )}
                <span>
                  {useNativeCapture
                    ? (t('plateSolving.nativeCapture') || 'Native Camera')
                    : (t('plateSolving.browserCamera') || 'Browser Camera')}
                </span>
              </div>
              <Switch
                checked={useNativeCapture}
                onCheckedChange={(checked) => {
                  setUseNativeCapture(checked);
                  if (checked) {
                    camera.stop();
                  } else {
                    camera.start();
                  }
                }}
                aria-label={t('plateSolving.nativeCapture') || 'Native Camera'}
              />
            </div>
          )}

          <div 
            ref={dropZoneRef}
            className={`relative bg-muted rounded-lg overflow-hidden border-2 transition-colors ${
              mobile && mode === 'camera' ? 'flex-1 min-h-[240px]' : 'aspect-video'
            } ${
              isDragging 
                ? 'border-primary border-dashed bg-primary/5' 
                : 'border-transparent'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            role="region"
            aria-label={t('plateSolving.dropZone') || 'Image drop zone'}
          >
            {mode === 'camera' && !capturedImage && !useNativeCapture && (
              <>
                <video
                  ref={videoRef}
                  className={`w-full h-full object-cover ${
                    camera.facingMode === 'user' ? 'scale-x-[-1]' : ''
                  }`}
                  playsInline
                  muted
                  aria-label={t('plateSolving.cameraPreview') || 'Camera preview'}
                />

                {/* Camera toolbar overlay */}
                {camera.stream && (
                  <div className="absolute top-2 right-2 flex gap-1.5">
                    {camera.hasMultipleCameras && (
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8 rounded-full bg-background/60 backdrop-blur-sm"
                        onClick={() => camera.switchCamera()}
                        aria-label={t('plateSolving.switchCamera') || 'Switch Camera'}
                      >
                        <SwitchCamera className="h-4 w-4" />
                      </Button>
                    )}
                    {camera.capabilities.torch && (
                      <Button
                        variant={camera.torchOn ? 'default' : 'secondary'}
                        size="icon"
                        className="h-8 w-8 rounded-full bg-background/60 backdrop-blur-sm"
                        onClick={() => camera.toggleTorch()}
                        aria-label={t('plateSolving.torch') || 'Flashlight'}
                      >
                        <Flashlight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}

                {/* Zoom slider overlay */}
                {camera.stream && camera.capabilities.zoom && camera.capabilities.zoom.max > 1 && (
                  <div className="absolute bottom-2 left-4 right-4 flex items-center gap-2">
                    <ZoomIn className="h-3.5 w-3.5 text-white/70" />
                    <Slider
                      value={[camera.zoomLevel]}
                      onValueChange={([v]) => camera.setZoom(v)}
                      min={camera.capabilities.zoom.min}
                      max={camera.capabilities.zoom.max}
                      step={camera.capabilities.zoom.step}
                      className="flex-1"
                    />
                    <span className="text-xs text-white/70 min-w-[2rem] text-right">
                      {camera.zoomLevel.toFixed(1)}x
                    </span>
                  </div>
                )}

                {camera.error && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 gap-2 p-4">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                    <p className="text-destructive text-center px-4 text-sm">
                      {getCameraErrorMessage(camera.errorType, camera.error, t)}
                    </p>
                    {camera.errorType !== 'not-found' && (
                      <Button variant="outline" size="sm" onClick={() => camera.start()}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        {t('common.retry') || 'Retry'}
                      </Button>
                    )}
                    {camera.errorType === 'not-found' && (
                      <Button variant="outline" size="sm" onClick={switchToUpload}>
                        <Upload className="h-4 w-4 mr-2" />
                        {t('plateSolving.uploadFile') || 'Upload File'}
                      </Button>
                    )}
                  </div>
                )}
                {camera.isLoading && !camera.stream && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}
              </>
            )}

            {/* Mobile native capture: show prompt */}
            {mode === 'camera' && !capturedImage && useNativeCapture && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={() => nativeCaptureRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label={t('plateSolving.takePhoto') || 'Take Photo'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    nativeCaptureRef.current?.click();
                  }
                }}
              >
                <Smartphone className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {t('plateSolving.nativeCaptureHint') || "Opens your device's built-in camera app"}
                </p>
                <Button variant="outline" className="mt-3">
                  <Camera className="h-4 w-4 mr-2" />
                  {t('plateSolving.takePhoto') || 'Take Photo'}
                </Button>
                <input
                  ref={nativeCaptureRef}
                  type="file"
                  accept="image/*"
                  capture={camera.facingMode === 'user' ? 'user' : 'environment'}
                  className="hidden"
                  onChange={handleNativeCapture}
                  aria-hidden="true"
                />
              </div>
            )}

            {mode === 'upload' && !capturedImage && !isLoading && (
              <div
                className={`absolute inset-0 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                  isDragging ? 'bg-primary/10' : 'hover:bg-muted/80'
                }`}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label={t('plateSolving.clickToUpload') || 'Click to upload'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    fileInputRef.current?.click();
                  }
                }}
              >
                {isDragging ? (
                  <>
                    <ImageIcon className="h-12 w-12 text-primary mb-2" />
                    <p className="text-sm font-medium text-primary">
                      {t('plateSolving.dropHere') || 'Drop image here'}
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="h-12 w-12 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {t('plateSolving.clickOrDrag') || 'Click or drag image here'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('plateSolving.supportedFormats') || 'JPEG, PNG, FITS'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('plateSolving.maxSize') || `Max ${maxFileSizeMB}MB`}
                    </p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.fits,.fit,.fts"
                  className="hidden"
                  onChange={handleFileSelect}
                  aria-hidden="true"
                />
              </div>
            )}

            {isLoading && mode === 'upload' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="w-48">
                  <Progress value={loadingProgress} className="h-2" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('plateSolving.processing') || 'Processing'}... {Math.round(loadingProgress)}%
                </p>
              </div>
            )}

            {fileError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 gap-2 p-4">
                <Alert variant="destructive" className="max-w-sm">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{fileError}</AlertDescription>
                </Alert>
                <Button variant="outline" size="sm" onClick={resetState}>
                  {t('common.retry') || 'Try Again'}
                </Button>
              </div>
            )}

            {capturedImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={capturedImage}
                alt={t('plateSolving.capturedImage') || 'Captured image'}
                className="w-full h-full object-contain"
              />
            )}

            {capturedFile && !capturedImage && imageMetadata?.isFits && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <FileImage className="h-16 w-16 text-muted-foreground" />
                <p className="text-sm font-medium">{imageMetadata.name}</p>
                <p className="text-xs text-muted-foreground">
                  FITS - {formatFileSize(imageMetadata.size)}
                </p>
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
          </div>

          {imageMetadata && !fileError && (
            <FitsMetadataPanel metadata={imageMetadata} />
          )}

          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span>{t('plateSolving.advancedOptions') || 'Advanced Options'}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-3 p-3 bg-muted/30 rounded-lg mt-2">
                <SwitchItem
                  id="compression"
                  label={t('plateSolving.enableCompression') || 'Enable Compression'}
                  checked={compressionEnabled}
                  onCheckedChange={setCompressionEnabled}
                />
                {compressionEnabled && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">
                        {t('plateSolving.quality') || 'Quality'}: {compressionQuality}%
                      </Label>
                    </div>
                    <Slider
                      value={[compressionQuality]}
                      onValueChange={([v]) => setCompressionQuality(v)}
                      min={50}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Action buttons */}
          <div className="flex gap-2">
            {mode === 'camera' && !capturedImage && camera.stream && !useNativeCapture && (
              <Button
                onClick={capturePhoto}
                className={`flex-1 ${mobile ? 'h-14 text-base' : ''}`}
                disabled={isLoading || camera.isLoading}
              >
                <Camera className={mobile ? 'h-6 w-6 mr-2' : 'h-4 w-4 mr-2'} />
                {t('plateSolving.takePhoto') || 'Take Photo'}
              </Button>
            )}

            {(capturedImage || (capturedFile && imageMetadata?.isFits)) && (
              <>
                <Button variant="outline" onClick={resetState} className="flex-1">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {t('plateSolving.retake') || 'Retake'}
                </Button>
                <Button onClick={handleConfirm} className="flex-1">
                  <Check className="h-4 w-4 mr-2" />
                  {t('plateSolving.useImage') || 'Use This Image'}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
