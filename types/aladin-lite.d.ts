/**
 * Type declarations for aladin-lite (v3.x)
 * Aladin Lite does not ship its own .d.ts — this file provides TypeScript types.
 * @see https://github.com/cds-astro/aladin-lite
 */

declare module 'aladin-lite' {
  interface AladinOptions {
    fov?: number;
    target?: string;
    cooFrame?: AladinCooFrame;
    survey?: string;
    projection?: string;
    showReticle?: boolean;
    showCooGrid?: boolean;
    showCooGridControl?: boolean;
    showProjectionControl?: boolean;
    showZoomControl?: boolean;
    showFullscreenControl?: boolean;
    showLayersControl?: boolean;
    showGotoControl?: boolean;
    showShareControl?: boolean;
    showSimbadPointerControl?: boolean;
    showContextMenu?: boolean;
    showFrame?: boolean;
    showSettingsControl?: boolean;
    showStatusBar?: boolean;
    showCatalog?: boolean;
    showTable?: boolean;
    reticleColor?: string;
    reticleSize?: number;
    fullScreen?: boolean;
    backgroundColor?: string;
    samp?: boolean;
  }

  type AladinCooFrame = 'ICRS' | 'ICRSd' | 'galactic' | 'j2000' | 'j2000d';

  interface AladinCooGridOptions {
    color?: string;
    opacity?: number;
    labelSize?: number;
    thickness?: number;
    showLabels?: boolean;
    enabled?: boolean;
  }

  interface AladinReticle {
    show: boolean;
    color: string;
    size: number;
    update(options: { show?: boolean; color?: string; size?: number }): void;
    setColor?(color: string): void;
    setSize?(size: number): void;
  }

  interface AladinViewDataURLOptions {
    format?: 'image/png' | 'image/jpeg' | string;
    quality?: number;
    transparent?: boolean;
    mediaType?: string;
  }

  interface AladinInstance {
    getRaDec(): [number, number];
    gotoRaDec(ra: number, dec: number): void;
    gotoObject(
      name: string,
      callbacks?: {
        success?: (raDec: [number, number]) => void;
        error?: () => void;
      }
    ): void;
    animateToRaDec(ra: number, dec: number, duration: number): void;

    // Official FoV methods
    getFoV(): number | [number, number];
    setFoV(fov: number): void;
    setFoVRange(min: number, max: number): void;

    // Backward-compatible aliases found in older integrations
    getFov?(): number | [number, number];
    setFov?(fov: number): void;
    setFovRange?(min: number, max: number): void;
    setFOVRange?(min: number, max: number): void;

    getSize(): [number, number];
    setProjection(proj: string): void;
    getFoVCorners?(nbSteps?: number): [number, number][];
    getFovCorners?(nbSteps?: number): [number, number][];
    increaseZoom(): void;
    decreaseZoom(): void;
    setFrame(frame: AladinCooFrame): void;

    pix2world(x: number, y: number): [number, number] | null;
    world2pix(ra: number, dec: number): [number, number] | null;

    setBaseImageLayer(survey: HpxImageSurvey | string): void;
    setOverlayImageLayer(survey: HpxImageSurvey | string, name?: string): void;
    getBaseImageLayer(): HpxImageSurvey;
    getOverlayImageLayer(name?: string): HpxImageSurvey | null;
    removeImageLayer(name: string): void;

    /** @deprecated Use removeImageLayer(name) */
    removeOverlayImageLayer?(name: string): void;

    newImageSurvey(urlOrId: string): HpxImageSurvey;
    addCatalog(catalog: AladinCatalog): void;
    addOverlay(overlay: AladinGraphicOverlay): void;
    addMOC(moc: AladinMOC): void;
    removeLayers(): void;
    remove?(): void;

    setCooGrid(options: AladinCooGridOptions): void;
    showCooGrid(show: boolean): void;

    displayFITS(
      urlOrBlob: string | Blob,
      options?: Record<string, unknown>,
      successCallback?: (ra: number, dec: number, fov: number) => void,
      errorCallback?: (error: unknown) => void
    ): void;

    select(
      mode: 'rect' | 'poly' | 'circle',
      callback: (selection: unknown) => void
    ): void;

    on(event: AladinEvent, callback: (...args: unknown[]) => void): void;

    showReticle(show: boolean): void;
    getReticle(): AladinReticle;
    setDefaultColor?(color: string): void;

    /** @deprecated Use getReticle().update({ color }) */
    setReticleColor?(color: string): void;

    /** @deprecated Use getReticle().update({ size }) */
    setReticleSize?(size: number): void;

    showPopup(ra: number, dec: number, title: string, content: string): void;
    hidePopup(): void;

    exportAsPNG(): void;
    getViewDataURL(options?: AladinViewDataURLOptions | string): Promise<string>;
    getViewImageBuffer?(): Uint8Array;
    getShareURL(): string;

    adjustFovForObject(name: string): void;
    stopAnimation(): void;
  }

  type AladinEvent =
    | 'objectClicked'
    | 'objectHovered'
    | 'objectHoveredStop'
    | 'objectsSelected'
    | 'footprintClicked'
    | 'footprintHovered'
    | 'positionChanged'
    | 'zoomChanged'
    | 'click'
    | 'rightClickMove'
    | 'mouseMove'
    | 'fullScreenToggled'
    | 'cooFrameChanged'
    | 'projectionChanged'
    | 'layerChanged'
    | 'resizeChanged';

  interface HpxImageSurvey {
    setOpacity(opacity: number): void;

    /** @deprecated Use setOpacity(opacity) */
    setAlpha?(alpha: number): void;

    getAlpha?(): number;
    toggle?(): void;
    setColormap(name: string, opts?: { stretch?: string; reversed?: boolean }): void;
    setCuts?(low: number, high: number): void;
    setImageFormat?(format: 'jpeg' | 'png' | 'fits'): void;
    setBlendingConfig(additive: boolean): void;
    setGamma(gamma: number): void;
    setSaturation(sat: number): void;
    setContrast(contrast: number): void;
    setBrightness(brightness: number): void;
    name?: string;
    url?: string;
  }

  interface AladinCatalogOptions {
    name?: string;
    color?: string;
    sourceSize?: number;
    shape?:
      | 'circle'
      | 'plus'
      | 'rhomb'
      | 'cross'
      | 'triangle'
      | 'square'
      | HTMLCanvasElement
      | HTMLImageElement;
    limit?: number;
    selectionColor?: string;
    hoverColor?: string;
    onClick?: 'showTable' | 'showPopup' | ((source: AladinSource) => void);
    filter?: (source: AladinSource) => boolean;
    raField?: string;
    decField?: string;
  }

  interface AladinCatalog {
    addSources(sources: AladinSource[]): void;
    removeSources(sources: AladinSource[]): void;
    removeAll(): void;
    show(): void;
    hide(): void;
    isShowing: boolean;
    name?: string;
    sources: AladinSource[];
  }

  interface AladinSource {
    ra: number;
    dec: number;
    data?: Record<string, unknown>;
    catalog?: AladinCatalog;
  }

  interface AladinGraphicOverlay {
    add(shape: AladinShape): void;
    addFootprints(shapes: AladinShape[]): void;
    removeAll(): void;
    show(): void;
    hide(): void;
    isShowing: boolean;
    name?: string;
  }

  interface AladinShape {
    setColor(color: string): void;
    setLineWidth(width: number): void;
    overlay?: AladinGraphicOverlay;
  }

  interface AladinMOC {
    show(): void;
    hide(): void;
    isShowing: boolean;
    opacity: number;
    color: string;
    lineWidth: number;
    name?: string;

    /** @deprecated MOC style is property-driven in v3 */
    toggle?(): void;

    /** @deprecated MOC style is property-driven in v3 */
    setOpacity?(opacity: number): void;

    /** @deprecated MOC style is property-driven in v3 */
    setColor?(color: string): void;

    /** @deprecated MOC style is property-driven in v3 */
    setLineWidth?(width: number): void;
  }

  interface AladinMOCOptions {
    name?: string;
    color?: string;
    opacity?: number;
    lineWidth?: number;
    adaptativeDisplay?: boolean;
    perimeter?: boolean;
  }

  interface AladinStatic {
    init: Promise<void>;
    aladin(selector: string | HTMLElement, options?: AladinOptions): AladinInstance;

    catalog(options?: AladinCatalogOptions): AladinCatalog;
    source(
      ra: number,
      dec: number,
      data?: Record<string, unknown>,
      options?: Record<string, unknown>
    ): AladinSource;
    marker(
      ra: number,
      dec: number,
      options?: {
        popupTitle?: string;
        popupDesc?: string;
        useMarkerDefaultIcon?: boolean;
      }
    ): AladinSource;

    catalogHiPS(
      url: string,
      options?: AladinCatalogOptions & { filter?: (source: AladinSource) => boolean }
    ): AladinCatalog;

    imageHiPS(
      urlOrId: string,
      options?: {
        name?: string;
        imgFormat?: 'jpeg' | 'png' | 'fits';
        cooFrame?: AladinCooFrame;
        longitudeReversed?: boolean;
      }
    ): HpxImageSurvey;

    graphicOverlay(options?: { color?: string; lineWidth?: number; name?: string }): AladinGraphicOverlay;
    circle(ra: number, dec: number, radius: number, options?: { color?: string; lineWidth?: number }): AladinShape;
    ellipse(
      ra: number,
      dec: number,
      rRa: number,
      rDec: number,
      rot: number,
      options?: { color?: string; lineWidth?: number }
    ): AladinShape;
    polygon(vertices: [number, number][], options?: { color?: string; lineWidth?: number }): AladinShape;
    polyline(vertices: [number, number][], options?: { color?: string; lineWidth?: number }): AladinShape;

    catalogFromSimbad(
      target: string | { ra: number; dec: number },
      radius: number,
      options?: AladinCatalogOptions
    ): AladinCatalog;

    /** @deprecated Use catalogFromSimbad */
    catalogFromSIMBAD?(
      target: string | { ra: number; dec: number },
      radius: number,
      options?: AladinCatalogOptions
    ): AladinCatalog;

    catalogFromVizieR(
      catId: string,
      target: string | { ra: number; dec: number },
      radius: number,
      options?: AladinCatalogOptions
    ): AladinCatalog;
    catalogFromNED(
      target: string | { ra: number; dec: number },
      radius: number,
      options?: AladinCatalogOptions
    ): AladinCatalog;

    MOCFromURL(url: string, options?: AladinMOCOptions): AladinMOC;
    MOCFromJSON(json: Record<string, number[]>, options?: AladinMOCOptions): AladinMOC;
    MOCFromCone(circle: { ra: number; dec: number; radius: number }, options?: AladinMOCOptions): AladinMOC;
    MOCFromPolygon(polygon: { ra: number[]; dec: number[] }, options?: AladinMOCOptions): AladinMOC;

    getAvailableListOfColormaps(): string[];
    Utils: AladinUtils;
  }

  interface AladinUtils {
    radecToViewXy(ra: number, dec: number): [number, number] | null;
  }

  const A: AladinStatic;
  export default A;
}
