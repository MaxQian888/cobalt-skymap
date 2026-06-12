/**
 * Mock for aladin-lite module (loaded via CDN at runtime).
 * Keeps parity with the subset of API used by the application.
 */
const mockReticle = {
  show: false,
  color: '#ff0000',
  size: 22,
  update: jest.fn((options = {}) => {
    if (typeof options.show === 'boolean') {
      mockReticle.show = options.show;
    }
    if (typeof options.color === 'string') {
      mockReticle.color = options.color;
    }
    if (typeof options.size === 'number') {
      mockReticle.size = options.size;
    }
  }),
};

const mockBaseLayer = {
  setColormap: jest.fn(),
  setBrightness: jest.fn(),
  setContrast: jest.fn(),
  setSaturation: jest.fn(),
  setGamma: jest.fn(),
};

const mockInstance = {
  getRaDec: jest.fn(() => [0, 0]),
  gotoRaDec: jest.fn(),
  gotoObject: jest.fn(),
  animateToRaDec: jest.fn(),
  getFoV: jest.fn(() => [60, 60]),
  setFoV: jest.fn(),
  setFoVRange: jest.fn(),
  getFov: jest.fn(() => [60, 60]),
  setFov: jest.fn(),
  setFovRange: jest.fn(),
  setFOVRange: jest.fn(),
  getSize: jest.fn(() => [800, 600]),
  setProjection: jest.fn(),
  pix2world: jest.fn(() => [0, 0]),
  world2pix: jest.fn(() => [400, 300]),
  setBaseImageLayer: jest.fn(),
  setOverlayImageLayer: jest.fn(),
  getBaseImageLayer: jest.fn(() => mockBaseLayer),
  getOverlayImageLayer: jest.fn(() => null),
  removeImageLayer: jest.fn(),
  removeOverlayImageLayer: jest.fn(),
  newImageSurvey: jest.fn(() => mockBaseLayer),
  addCatalog: jest.fn(),
  addOverlay: jest.fn(),
  addMOC: jest.fn(),
  removeLayers: jest.fn(),
  remove: jest.fn(),
  setCooGrid: jest.fn(),
  showCooGrid: jest.fn(),
  displayFITS: jest.fn(),
  setFrame: jest.fn(),
  on: jest.fn(),
  adjustFovForObject: jest.fn(),
  getViewDataURL: jest.fn(async () => 'data:image/png;base64,mock'),
  showPopup: jest.fn(),
  hidePopup: jest.fn(),
  exportAsPNG: jest.fn(),
  showReticle: jest.fn(),
  getReticle: jest.fn(() => mockReticle),
  setDefaultColor: jest.fn(),
  getFoVCorners: jest.fn(() => []),
  getFovCorners: jest.fn(() => []),
  getShareURL: jest.fn(() => ''),
};

function createCatalog(name) {
  return {
    name,
    addSources: jest.fn(),
    removeSources: jest.fn(),
    removeAll: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    isShowing: true,
    sources: [],
  };
}

function createHiPS(name) {
  return {
    name,
    setOpacity: jest.fn(),
    setAlpha: jest.fn(),
    setBlendingConfig: jest.fn(),
    setColormap: jest.fn(),
    setCuts: jest.fn(),
    setGamma: jest.fn(),
    setSaturation: jest.fn(),
    setContrast: jest.fn(),
    setBrightness: jest.fn(),
  };
}

function createMOC() {
  return {
    isShowing: true,
    opacity: 0.3,
    color: '#3b82f6',
    lineWidth: 1,
    show: jest.fn(),
    hide: jest.fn(),
    toggle: jest.fn(),
    setOpacity: jest.fn(),
    setColor: jest.fn(),
    setLineWidth: jest.fn(),
  };
}

const A = {
  init: Promise.resolve(),
  aladin: jest.fn(() => mockInstance),
  catalog: jest.fn(() => createCatalog('mock-catalog')),
  catalogFromVizieR: jest.fn(() => createCatalog('vizier-catalog')),
  catalogFromSimbad: jest.fn(() => createCatalog('simbad-catalog')),
  catalogFromSIMBAD: jest.fn(() => createCatalog('simbad-catalog')),
  catalogFromNED: jest.fn(() => createCatalog('ned-catalog')),
  catalogHiPS: jest.fn(() => createCatalog('catalog-hips')),
  graphicOverlay: jest.fn(() => ({
    name: 'mock-overlay',
    add: jest.fn(),
    addFootprints: jest.fn(),
    removeAll: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    isShowing: true,
  })),
  circle: jest.fn(() => ({ type: 'circle', setColor: jest.fn(), setLineWidth: jest.fn() })),
  marker: jest.fn(() => ({ type: 'marker' })),
  polyline: jest.fn(() => ({ type: 'polyline', setColor: jest.fn(), setLineWidth: jest.fn() })),
  imageHiPS: jest.fn((id) => createHiPS(id)),
  MOCFromURL: jest.fn(() => createMOC()),
  MOCFromJSON: jest.fn(() => createMOC()),
  source: jest.fn(() => ({ type: 'source' })),
};

module.exports = A;
module.exports.default = A;
