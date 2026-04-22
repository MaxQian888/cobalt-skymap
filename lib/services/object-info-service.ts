/**
 * Object Information Service
 * Fetches detailed information about celestial objects from multiple sources.
 *
 * Supports: SIMBAD (TAP/ADQL), Wikipedia REST, JPL SBDB, VizieR (HyperLEDA),
 * NED (extragalactic), plus a local famous-objects database.
 */

import { smartFetch } from './http-fetch';
import {
  useObjectInfoConfigStore,
  getActiveImageSources,
  getActiveDataSources,
  generateImageUrl,
} from './object-info-config';
import { createLogger } from '@/lib/logger';
import { getConstellationFromCoords } from '@/lib/astronomy/constellation-boundaries';

const logger = createLogger('object-info-service');

// ============================================================================
// Types
// ============================================================================

export interface ObjectImage {
  url: string;
  thumbnailUrl?: string;
  source: string;
  credit: string;
  title?: string;
  width?: number;
  height?: number;
  availability?: 'available' | 'unavailable' | 'unsupported' | 'degraded';
  authorityLevel?: 'authoritative' | 'reference' | 'fallback-local';
}

export interface ObjectInfoSourceProvenance {
  acceptedSource: string;
  authorityLevel: 'authoritative' | 'reference' | 'fallback-local';
  contributors: string[];
}

export interface ObjectInfoDiagnostic {
  providerId: string;
  status: 'success' | 'unsupported' | 'empty' | 'error';
  fieldGroup: 'identity' | 'classification' | 'physical' | 'description' | 'images';
  message?: string;
}

export interface ObjectInfoProvenance {
  identity?: ObjectInfoSourceProvenance;
  classification?: ObjectInfoSourceProvenance;
  physical?: ObjectInfoSourceProvenance;
  description?: ObjectInfoSourceProvenance;
  images?: ObjectInfoSourceProvenance;
}

export interface ObjectDetailedInfo {
  // Basic info
  names: string[];
  type: string;
  typeCategory:
    | 'galaxy' | 'nebula' | 'cluster' | 'star'
    | 'planet' | 'moon' | 'comet' | 'asteroid'
    | 'artificial' | 'other';
  constellation?: string;

  // Astrometric data
  ra: number;
  dec: number;
  raString: string;
  decString: string;

  // Physical properties
  magnitude?: number;
  surfaceBrightness?: number;
  angularSize?: string; // e.g., "10.0' × 8.5'"
  angularSizeArcmin?: { width: number; height: number };
  distance?: string; // e.g., "2.5 Mly"
  distanceLy?: number;
  redshift?: number;

  // Additional info
  description?: string;
  morphologicalType?: string; // For galaxies: Sb, E0, etc.
  spectralType?: string;      // For stars: G2V, etc.
  discoverer?: string;
  discoveryYear?: number;
  radialVelocity?: number;    // km/s

  // External references
  simbadUrl?: string;
  wikipediaUrl?: string;

  // Images from various sources
  images: ObjectImage[];

  // Data sources used
  sources: string[];

  // Loading/error state
  isLoading?: boolean;
  error?: string;
  provenance: ObjectInfoProvenance;
  diagnostics: ObjectInfoDiagnostic[];
}

type ExternalDataSourceType = 'simbad' | 'wikipedia' | 'sbdb' | 'vizier' | 'ned';
type ObjectInfoFieldGroup = keyof ObjectInfoProvenance;

// Common DSO types mapping
const DSO_TYPE_MAP: Record<string, { type: string; category: ObjectDetailedInfo['typeCategory'] }> = {
  'G': { type: 'Galaxy', category: 'galaxy' },
  'Gx': { type: 'Galaxy', category: 'galaxy' },
  'GX': { type: 'Galaxy', category: 'galaxy' },
  'AGN': { type: 'Active Galactic Nucleus', category: 'galaxy' },
  'GAL': { type: 'Galaxy', category: 'galaxy' },
  'IG': { type: 'Interacting Galaxies', category: 'galaxy' },
  'GC': { type: 'Globular Cluster', category: 'cluster' },
  'Gb': { type: 'Globular Cluster', category: 'cluster' },
  'OC': { type: 'Open Cluster', category: 'cluster' },
  'OpC': { type: 'Open Cluster', category: 'cluster' },
  'C+N': { type: 'Cluster + Nebula', category: 'cluster' },
  'Cl': { type: 'Star Cluster', category: 'cluster' },
  'PN': { type: 'Planetary Nebula', category: 'nebula' },
  'Pl': { type: 'Planetary Nebula', category: 'nebula' },
  'HII': { type: 'HII Region', category: 'nebula' },
  'EN': { type: 'Emission Nebula', category: 'nebula' },
  'RN': { type: 'Reflection Nebula', category: 'nebula' },
  'DN': { type: 'Dark Nebula', category: 'nebula' },
  'SNR': { type: 'Supernova Remnant', category: 'nebula' },
  'Nb': { type: 'Nebula', category: 'nebula' },
  'Neb': { type: 'Nebula', category: 'nebula' },
  'Com': { type: 'Comet', category: 'comet' },
  'COM': { type: 'Comet', category: 'comet' },
  '*': { type: 'Star', category: 'star' },
  '**': { type: 'Double Star', category: 'star' },
  'V*': { type: 'Variable Star', category: 'star' },
  'QSO': { type: 'Quasar', category: 'galaxy' },
};

// ============================================================================
// Famous Objects Database
// ============================================================================

interface FamousObjectEntry {
  names: string[];
  description?: string;
  discoverer?: string;
  discoveryYear?: number;
  imageUrl?: string;
}

/** Curated famous objects with known metadata and Wikipedia images. */
const FAMOUS_OBJECTS_DB: FamousObjectEntry[] = [
  {
    names: ['M31', 'NGC 224', 'Andromeda Galaxy'],
    description: 'The Andromeda Galaxy is a barred spiral galaxy and the nearest large galaxy to the Milky Way. It is approximately 2.5 million light-years away and is the most distant object visible to the naked eye.',
    discoverer: 'Simon Marius',
    discoveryYear: 1612,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Andromeda_Galaxy_%28with_h-alpha%29.jpg/1280px-Andromeda_Galaxy_%28with_h-alpha%29.jpg',
  },
  {
    names: ['M42', 'NGC 1976', 'Orion Nebula', 'Great Orion Nebula'],
    description: 'The Orion Nebula is a diffuse emission nebula in the constellation Orion. At roughly 1,344 light-years away, it is one of the brightest nebulae and is visible to the naked eye.',
    discoverer: 'Nicolas-Claude Fabri de Peiresc',
    discoveryYear: 1610,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Orion_Nebula_-_Hubble_2006_mosaic_18000.jpg/1280px-Orion_Nebula_-_Hubble_2006_mosaic_18000.jpg',
  },
  {
    names: ['M45', 'Pleiades', 'Seven Sisters', 'Subaru'],
    description: 'The Pleiades is an open star cluster in the constellation of Taurus. It is among the star clusters nearest to Earth and is the cluster most obvious to the naked eye in the night sky.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Pleiades_large.jpg/1280px-Pleiades_large.jpg',
  },
  {
    names: ['M51', 'NGC 5194', 'Whirlpool Galaxy'],
    description: 'The Whirlpool Galaxy is an interacting grand-design spiral galaxy in the constellation Canes Venatici. It was the first galaxy to be classified as a spiral galaxy.',
    discoverer: 'Charles Messier',
    discoveryYear: 1773,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Messier51_sRGB.jpg/1280px-Messier51_sRGB.jpg',
  },
  {
    names: ['M57', 'NGC 6720', 'Ring Nebula'],
    description: 'The Ring Nebula is a planetary nebula in the constellation Lyra. It is one of the most prominent examples of a planetary nebula and a popular target for amateur astronomers.',
    discoverer: 'Antoine Darquier de Pellepoix',
    discoveryYear: 1779,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/M57_The_Ring_Nebula.JPG/1280px-M57_The_Ring_Nebula.JPG',
  },
  {
    names: ['M104', 'NGC 4594', 'Sombrero Galaxy'],
    description: 'The Sombrero Galaxy is a peculiar galaxy in the constellation Virgo. It has a bright nucleus, an unusually large central bulge, and a prominent dust lane in its outer disk.',
    discoverer: 'Pierre Méchain',
    discoveryYear: 1781,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/M104_ngc4594_sombrero_galaxy_hi-res.jpg/1280px-M104_ngc4594_sombrero_galaxy_hi-res.jpg',
  },
  {
    names: ['NGC 7000', 'North America Nebula', 'Caldwell 20'],
    description: 'The North America Nebula is a large emission nebula in the constellation Cygnus, close to Deneb. Its shape resembles the continent of North America.',
    discoverer: 'William Herschel',
    discoveryYear: 1786,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/North_America_nebula_4X.jpg/1280px-North_America_nebula_4X.jpg',
  },
  {
    names: ['NGC 7293', 'Helix Nebula', 'Caldwell 63'],
    description: 'The Helix Nebula is the nearest planetary nebula to Earth at approximately 650 light-years away in the constellation Aquarius. It is sometimes called the "Eye of God".',
    discoverer: 'Karl Ludwig Harding',
    discoveryYear: 1824,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/NGC7293_%282004%29.jpg/1280px-NGC7293_%282004%29.jpg',
  },
  {
    names: ['M1', 'NGC 1952', 'Crab Nebula', 'Taurus A'],
    description: 'The Crab Nebula is a supernova remnant in the constellation Taurus, corresponding to a bright supernova recorded by Chinese astronomers in 1054. It is powered by the Crab Pulsar at its center.',
    discoverer: 'John Bevis',
    discoveryYear: 1731,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Crab_Nebula.jpg/1280px-Crab_Nebula.jpg',
  },
  {
    names: ['M13', 'NGC 6205', 'Hercules Cluster', 'Great Globular Cluster in Hercules'],
    description: 'M13 is a globular cluster in the constellation Hercules, one of the brightest and best-known globular clusters in the northern sky. It contains several hundred thousand stars.',
    discoverer: 'Edmond Halley',
    discoveryYear: 1714,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Messier_13_%28Hubble%29.jpg/1280px-Messier_13_%28Hubble%29.jpg',
  },
  {
    names: ['M81', 'NGC 3031', "Bode's Galaxy"],
    description: "Bode's Galaxy is a grand design spiral galaxy in the constellation Ursa Major, approximately 12 million light-years away. It contains an active galactic nucleus.",
    discoverer: 'Johann Elert Bode',
    discoveryYear: 1774,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/Messier_81_HST.jpg/1280px-Messier_81_HST.jpg',
  },
  {
    names: ['M101', 'NGC 5457', 'Pinwheel Galaxy'],
    description: 'The Pinwheel Galaxy is a face-on spiral galaxy in the constellation Ursa Major, approximately 21 million light-years away. It is roughly 70% larger than the Milky Way.',
    discoverer: 'Pierre Méchain',
    discoveryYear: 1781,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/M101_hires_STScI-PRC2006-10a.jpg/1280px-M101_hires_STScI-PRC2006-10a.jpg',
  },
  {
    names: ['M27', 'NGC 6853', 'Dumbbell Nebula'],
    description: 'The Dumbbell Nebula is a planetary nebula in the constellation Vulpecula. It was the first planetary nebula to be discovered, by Charles Messier in 1764.',
    discoverer: 'Charles Messier',
    discoveryYear: 1764,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/M27_-_Dumbbell_Nebula.jpg/1280px-M27_-_Dumbbell_Nebula.jpg',
  },
  {
    names: ['M8', 'NGC 6523', 'Lagoon Nebula'],
    description: 'The Lagoon Nebula is a giant interstellar cloud and emission nebula in the constellation Sagittarius. It is one of only two star-forming nebulae visible to the naked eye from mid-northern latitudes.',
    discoverer: 'Giovanni Battista Hodierna',
    discoveryYear: 1654,
  },
  {
    names: ['M20', 'NGC 6514', 'Trifid Nebula'],
    description: 'The Trifid Nebula is an H II region in the constellation Sagittarius. The name means "divided into three lobes", referring to the dark lanes that trisect the bright core.',
    discoverer: 'Charles Messier',
    discoveryYear: 1764,
  },
  {
    names: ['M33', 'NGC 598', 'Triangulum Galaxy'],
    description: 'The Triangulum Galaxy is the third-largest member of the Local Group of galaxies, after the Milky Way and Andromeda. It is approximately 2.73 million light-years away.',
    discoverer: 'Giovanni Battista Hodierna',
    discoveryYear: 1654,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Messier33_-_NRAO-VLA.jpg/1280px-Messier33_-_NRAO-VLA.jpg',
  },
];

/** Look up a famous object by any of its names (case-insensitive). */
function findFamousObjectEntry(names: string[]): FamousObjectEntry | undefined {
  for (const name of names) {
    const lower = name.toLowerCase().trim();
    const match = FAMOUS_OBJECTS_DB.find(obj =>
      obj.names.some(n => n.toLowerCase() === lower)
    );
    if (match) return match;
  }
  return undefined;
}

function addContributor(
  provenance: ObjectInfoSourceProvenance | undefined,
  source: string
): ObjectInfoSourceProvenance | undefined {
  if (!provenance) return provenance;

  return {
    ...provenance,
    contributors: provenance.contributors.includes(source)
      ? provenance.contributors
      : [...provenance.contributors, source],
  };
}

function updateFieldProvenance(
  base: ObjectDetailedInfo,
  group: ObjectInfoFieldGroup,
  source: string,
  authorityLevel: 'authoritative' | 'reference' | 'fallback-local',
  accepted: boolean
): ObjectInfoProvenance {
  const current = base.provenance[group];
  if (!current) {
    return {
      ...base.provenance,
      [group]: {
        acceptedSource: source,
        authorityLevel,
        contributors: [source],
      },
    };
  }

  return {
    ...base.provenance,
    [group]: accepted
      ? {
          acceptedSource: source,
          authorityLevel,
          contributors: current.contributors.includes(source)
            ? current.contributors
            : [...current.contributors, source],
        }
      : addContributor(current, source),
  };
}

function resolveTargetClasses(category: ObjectDetailedInfo['typeCategory']): string[] {
  switch (category) {
    case 'galaxy':
      return ['deep-sky', 'extragalactic', 'generic'];
    case 'nebula':
    case 'cluster':
      return ['deep-sky', 'generic'];
    case 'star':
      return ['star', 'generic'];
    case 'planet':
    case 'moon':
      return ['planetary', 'generic'];
    case 'comet':
    case 'asteroid':
      return ['small-body', 'generic'];
    default:
      return ['generic'];
  }
}

function isSourceEligibleForObject(
  info: ObjectDetailedInfo,
  source: ReturnType<typeof getActiveDataSources>[number]
): boolean {
  const supportedClasses = source.targetClasses ?? ['generic'];
  return resolveTargetClasses(info.typeCategory).some((targetClass) => supportedClasses.includes(targetClass as never));
}

function createDiagnostic(
  providerId: string,
  status: ObjectInfoDiagnostic['status'],
  fieldGroup: ObjectInfoDiagnostic['fieldGroup'],
  message?: string
): ObjectInfoDiagnostic {
  return { providerId, status, fieldGroup, message };
}

function appendDiagnostic(
  diagnostics: ObjectInfoDiagnostic[],
  diagnostic: ObjectInfoDiagnostic
): ObjectInfoDiagnostic[] {
  return diagnostics.some(
    (item) =>
      item.providerId === diagnostic.providerId &&
      item.status === diagnostic.status &&
      item.fieldGroup === diagnostic.fieldGroup
  )
    ? diagnostics
    : [...diagnostics, diagnostic];
}

// ============================================================================
// Image URL Generators
// ============================================================================

/**
 * Generate DSS (Digitized Sky Survey) image URL
 */
export function getDSSImageUrl(ra: number, dec: number, size: number = 15): string {
  // Use STScI DSS server
  const raHours = ra / 15;
  const h = Math.floor(raHours);
  const m = Math.floor((raHours - h) * 60);
  const s = ((raHours - h) * 60 - m) * 60;
  
  const decSign = dec >= 0 ? '%2B' : '-';
  const decAbs = Math.abs(dec);
  const d = Math.floor(decAbs);
  const dm = Math.floor((decAbs - d) * 60);
  const ds = ((decAbs - d) * 60 - dm) * 60;
  
  const raStr = `${h.toString().padStart(2, '0')}+${m.toString().padStart(2, '0')}+${s.toFixed(1).padStart(4, '0')}`;
  const decStr = `${decSign}${d.toString().padStart(2, '0')}+${dm.toString().padStart(2, '0')}+${ds.toFixed(0).padStart(2, '0')}`;
  
  return `https://archive.stsci.edu/cgi-bin/dss_search?v=poss2ukstu_red&r=${raStr}&d=${decStr}&e=J2000&h=${size}&w=${size}&f=gif&c=none`;
}

/**
 * Generate SkyView image URL (NASA)
 */
export function getSkyViewImageUrl(ra: number, dec: number, survey: string = 'DSS2 Red', size: number = 0.25): string {
  return `https://skyview.gsfc.nasa.gov/current/cgi/runquery.pl?Position=${ra},${dec}&Survey=${encodeURIComponent(survey)}&Coordinates=J2000&Size=${size}&Pixels=500&Return=GIF`;
}

/**
 * Generate Aladin Lite preview URL
 */
export function getAladinPreviewUrl(ra: number, dec: number, fov: number = 0.25): string {
  return `https://alasky.cds.unistra.fr/hips-image-services/hips2fits?hips=CDS/P/DSS2/color&ra=${ra}&dec=${dec}&fov=${fov}&width=500&height=500&format=jpg`;
}

/**
 * Generate ESO image search URL (for reference, not direct image)
 */
export function getESOSearchUrl(objectName: string): string {
  return `https://archive.eso.org/scienceportal/home?search=${encodeURIComponent(objectName)}`;
}

/**
 * Generate Wikipedia search URL
 */
export function getWikipediaUrl(objectName: string): string {
  // Clean up the name for Wikipedia
  const cleanName = objectName
    .replace(/^(M|NGC|IC|Caldwell|C)\s*/, '$1 ')
    .replace(/\s+/g, '_');
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(cleanName)}`;
}

/**
 * Generate SIMBAD URL
 */
export function getSimbadUrl(objectName: string): string {
  return `https://simbad.u-strasbg.fr/simbad/sim-basic?Ident=${encodeURIComponent(objectName)}&submit=SIMBAD+search`;
}

// ============================================================================
// Object Info Fetchers
// ============================================================================

/**
 * Parse object type from various formats
 */
export function parseObjectType(typeStr?: string): { type: string; category: ObjectDetailedInfo['typeCategory'] } {
  if (!typeStr) return { type: 'Unknown', category: 'other' };
  
  const normalized = typeStr.trim().toUpperCase();
  
  // Check direct mapping
  for (const [key, value] of Object.entries(DSO_TYPE_MAP)) {
    if (normalized === key.toUpperCase() || normalized.startsWith(key.toUpperCase())) {
      return value;
    }
  }
  
  // Check if contains known keywords
  if (normalized.includes('GALAX')) return { type: 'Galaxy', category: 'galaxy' };
  if (normalized.includes('NEBULA') || normalized.includes('NEB')) return { type: 'Nebula', category: 'nebula' };
  if (normalized.includes('CLUSTER') || normalized.includes('CL')) return { type: 'Star Cluster', category: 'cluster' };
  if (normalized.includes('STAR') || normalized === '*') return { type: 'Star', category: 'star' };
  if (normalized.includes('PLANET')) return { type: 'Planet', category: 'planet' };
  if (normalized.includes('COMET')) return { type: 'Comet', category: 'comet' };
  
  return { type: typeStr, category: 'other' };
}

/**
 * Get constellation from RA/Dec using IAU boundary lookup
 * @param ra - Right ascension in degrees
 * @param dec - Declination in degrees
 */
export function getConstellation(ra: number, dec: number): string {
  return getConstellationFromCoords(ra, dec);
}

/**
 * Format angular size string
 */
export function formatAngularSize(widthArcmin?: number, heightArcmin?: number): string | undefined {
  if (!widthArcmin) return undefined;
  
  if (!heightArcmin || widthArcmin === heightArcmin) {
    if (widthArcmin < 1) {
      return `${(widthArcmin * 60).toFixed(1)}"`;
    }
    return `${widthArcmin.toFixed(1)}'`;
  }
  
  if (widthArcmin < 1 && heightArcmin < 1) {
    return `${(widthArcmin * 60).toFixed(1)}" × ${(heightArcmin * 60).toFixed(1)}"`;
  }
  return `${widthArcmin.toFixed(1)}' × ${heightArcmin.toFixed(1)}'`;
}

/**
 * Generate images for an object from configured sources
 */
export function generateObjectImages(
  ra: number,
  dec: number,
  names: string[],
  angularSizeArcmin?: number
): ObjectImage[] {
  const images: ObjectImage[] = [];
  const primaryName = names[0] || 'Object';
  const settings = useObjectInfoConfigStore.getState().settings;
  
  // Determine appropriate image size based on object size
  const imageSizeArcmin = angularSizeArcmin 
    ? Math.max(angularSizeArcmin * 2, 10) 
    : settings.defaultImageSize;
  
  // Get active image sources sorted by priority
  const activeSources = getActiveImageSources();
  
  for (const source of activeSources) {
    // Skip SDSS for southern sky
    if (source.id.includes('sdss') && dec < -10) continue;
    
    images.push({
      url: generateImageUrl(source, ra, dec, imageSizeArcmin),
      source: source.name,
      credit: source.credit,
      title: `${primaryName} - ${source.name}`,
    });
  }
  
  // Fallback to hardcoded sources if no active sources
  if (images.length === 0) {
    const imageSizeDeg = imageSizeArcmin / 60;
    images.push({
      url: getAladinPreviewUrl(ra, dec, imageSizeDeg),
      source: 'CDS/Aladin',
      credit: 'CDS Aladin Sky Atlas - DSS2 Color',
      title: `${primaryName} - DSS2 Color`,
    });
  }
  
  return images;
}

/**
 * Fetch object info from SIMBAD via TAP
 */
export async function fetchSimbadInfo(
  objectName: string,
  signal?: AbortSignal,
): Promise<Partial<ObjectDetailedInfo> | null> {
  // Check if SIMBAD is enabled in config
  const dataSources = getActiveDataSources();
  const simbadSource = dataSources.find(s => s.type === 'simbad');
  
  if (!simbadSource) {
    return null; // SIMBAD is disabled
  }
  
  try {
    const query = `
      SELECT TOP 1 
        main_id, ra, dec, otype_txt, sp_type, flux_v as mag_v,
        galdim_majaxis, galdim_minaxis, morph_type, rvz_radvel
      FROM basic
      WHERE main_id = '${objectName.replace(/'/g, "''")}'
         OR ident.id = '${objectName.replace(/'/g, "''")}'
    `;
    
    const response = await smartFetch(
      `${simbadSource.baseUrl}${simbadSource.apiEndpoint}?request=doQuery&lang=adql&format=json&query=${encodeURIComponent(query)}`,
      { 
        timeout: simbadSource.timeout,
        headers: { 'Accept': 'application/json' },
        signal,
      }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json<{ data?: (string | number | null)[][] }>();
    if (!data.data || data.data.length === 0) return null;
    
    const row = data.data[0];
    const typeInfo = parseObjectType(row[3] as string | undefined);
    
    return {
      names: [row[0] as string],
      type: typeInfo.type,
      typeCategory: typeInfo.category,
      ra: row[1] as number,
      dec: row[2] as number,
      spectralType: row[4] as string | undefined,
      magnitude: row[5] as number | undefined,
      angularSizeArcmin: row[6] && row[7] 
        ? { width: row[6] as number, height: row[7] as number }
        : row[6] 
          ? { width: row[6] as number, height: row[6] as number }
          : undefined,
      morphologicalType: row[8] as string | undefined,
      radialVelocity: typeof row[9] === 'number' ? row[9] : undefined,
      sources: ['SIMBAD'],
    };
  } catch (error) {
    logger.warn('Failed to fetch SIMBAD info', error);
    // Update source status to offline
    useObjectInfoConfigStore.getState().setDataSourceStatus(simbadSource.id, 'error');
    return null;
  }
}

async function fetchWikipediaInfo(
  objectName: string,
  signal?: AbortSignal,
): Promise<Partial<ObjectDetailedInfo> | null> {
  const dataSources = getActiveDataSources();
  const wikipediaSource = dataSources.find(s => s.type === 'wikipedia');

  if (!wikipediaSource) {
    return null;
  }

  try {
    const response = await smartFetch(
      `${wikipediaSource.baseUrl}${wikipediaSource.apiEndpoint}/${encodeURIComponent(objectName)}`,
      {
        timeout: wikipediaSource.timeout,
        headers: { Accept: 'application/json' },
        signal,
      }
    );

    if (!response.ok) return null;

    const data = await response.json<{ extract?: string; thumbnail?: { source?: string } }>();
    if (!data.extract && !data.thumbnail?.source) return null;

    return {
      description: data.extract,
      sources: ['Wikipedia'],
      images: data.thumbnail?.source
        ? [{
            url: data.thumbnail.source,
            thumbnailUrl: data.thumbnail.source,
            source: 'Wikipedia',
            credit: 'Wikipedia',
            title: `${objectName} - Wikipedia`,
          }]
        : undefined,
    };
  } catch (error) {
    logger.warn('Failed to fetch Wikipedia info', error);
    useObjectInfoConfigStore.getState().setDataSourceStatus(wikipediaSource.id, 'error');
    return null;
  }
}

async function fetchSbdbInfo(
  objectName: string,
  signal?: AbortSignal,
): Promise<Partial<ObjectDetailedInfo> | null> {
  const dataSources = getActiveDataSources();
  const sbdbSource = dataSources.find(s => s.type === 'sbdb');

  if (!sbdbSource) {
    return null;
  }

  try {
    const response = await smartFetch(
      `${sbdbSource.baseUrl}${sbdbSource.apiEndpoint}?sstr=${encodeURIComponent(objectName)}&phys-par=1`,
      {
        timeout: sbdbSource.timeout,
        headers: { Accept: 'application/json' },
        signal,
      }
    );

    if (!response.ok) return null;

    const data = await response.json<Record<string, unknown>>();
    const object = (data.object as Record<string, unknown> | undefined) ?? {};
    const phys = (data.phys_par as Record<string, unknown> | undefined) ?? {};
    const orbitClass = (object.orbit_class as Record<string, unknown> | undefined)?.name;
    const diameterRaw = phys.diameter ?? phys.dia;
    const diameter = typeof diameterRaw === 'number'
      ? diameterRaw
      : typeof diameterRaw === 'string'
        ? Number.parseFloat(diameterRaw)
        : undefined;

    const names = [
      object.fullname,
      object.shortname,
      object.pdes,
      object.des,
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    if (names.length === 0 && !orbitClass && !Number.isFinite(diameter)) {
      return null;
    }

    const category = /comet/i.test(String(orbitClass ?? objectName)) ? 'comet' : 'asteroid';
    return {
      names: names.length > 0 ? names : undefined,
      type: category === 'comet' ? 'Comet' : 'Asteroid',
      typeCategory: category,
      angularSize: Number.isFinite(diameter) ? `${diameter!.toFixed(1)} km` : undefined,
      description: typeof orbitClass === 'string' ? orbitClass : undefined,
      sources: ['SBDB'],
    };
  } catch (error) {
    logger.warn('Failed to fetch SBDB info', error);
    useObjectInfoConfigStore.getState().setDataSourceStatus(sbdbSource.id, 'error');
    return null;
  }
}

function mergeEnhancedInfo(
  base: ObjectDetailedInfo,
  patch: Partial<ObjectDetailedInfo>,
  sourceName: string,
  authorityLevel: 'authoritative' | 'reference' | 'fallback-local'
): ObjectDetailedInfo {
  const mergedImages = patch.images && patch.images.length > 0
    ? [...base.images, ...patch.images.filter((image) => !base.images.some((existing) => existing.url === image.url))]
    : base.images;

  const mergedSources = [...new Set([...(base.sources ?? []), ...(patch.sources ?? [])])];
  const patchAngularSize = patch.angularSizeArcmin
    ? formatAngularSize(patch.angularSizeArcmin.width, patch.angularSizeArcmin.height)
    : patch.angularSize;
  const acceptedIdentity = Boolean(patch.names?.length && patch.names[0] && patch.names[0] !== base.names[0]);
  const acceptedClassification = Boolean((patch.type && patch.type !== base.type) || (patch.typeCategory && patch.typeCategory !== base.typeCategory));
  const acceptedPhysical = Boolean(
    patch.magnitude != null ||
    patch.surfaceBrightness != null ||
    patch.angularSizeArcmin != null ||
    patch.angularSize != null ||
    patch.distance != null ||
    patch.distanceLy != null ||
    patch.redshift != null ||
    patch.radialVelocity != null ||
    patch.morphologicalType != null ||
    patch.spectralType != null
  );
  const acceptedDescription = Boolean(!base.description && patch.description);
  const acceptedImages = Boolean(patch.images && patch.images.length > 0);

  let provenance = base.provenance;
  if (patch.names?.length) {
    provenance = updateFieldProvenance({ ...base, provenance }, 'identity', sourceName, authorityLevel, acceptedIdentity);
  }
  if (patch.type || patch.typeCategory) {
    provenance = updateFieldProvenance({ ...base, provenance }, 'classification', sourceName, authorityLevel, acceptedClassification);
  }
  if (acceptedPhysical) {
    provenance = updateFieldProvenance({ ...base, provenance }, 'physical', sourceName, authorityLevel, true);
  }
  if (patch.description) {
    provenance = updateFieldProvenance({ ...base, provenance }, 'description', sourceName, authorityLevel, acceptedDescription);
  }
  if (patch.images?.length) {
    provenance = updateFieldProvenance({ ...base, provenance }, 'images', sourceName, authorityLevel, acceptedImages);
  }

  return {
    ...base,
    names: patch.names && patch.names.length > 0 ? [...new Set([...patch.names, ...base.names])] : base.names,
    type: patch.type || base.type,
    typeCategory: patch.typeCategory || base.typeCategory,
    magnitude: patch.magnitude ?? base.magnitude,
    surfaceBrightness: patch.surfaceBrightness ?? base.surfaceBrightness,
    angularSizeArcmin: patch.angularSizeArcmin || base.angularSizeArcmin,
    angularSize: patchAngularSize || base.angularSize,
    distance: patch.distance || base.distance,
    distanceLy: patch.distanceLy ?? base.distanceLy,
    redshift: patch.redshift ?? base.redshift,
    radialVelocity: patch.radialVelocity ?? base.radialVelocity,
    description: base.description || patch.description,
    morphologicalType: patch.morphologicalType || base.morphologicalType,
    spectralType: patch.spectralType || base.spectralType,
    discoverer: patch.discoverer || base.discoverer,
    discoveryYear: patch.discoveryYear ?? base.discoveryYear,
    constellation: patch.constellation || base.constellation,
    simbadUrl: patch.simbadUrl || base.simbadUrl,
    wikipediaUrl: patch.wikipediaUrl || base.wikipediaUrl,
    images: mergedImages,
    sources: mergedSources,
    provenance,
    diagnostics: appendDiagnostic(
      base.diagnostics,
      createDiagnostic(sourceName.toLowerCase(), 'success', patch.images?.length ? 'images' : patch.description ? 'description' : 'physical')
    ),
  };
}

// ============================================================================
// VizieR Fetcher (HyperLEDA / VII/237)
// ============================================================================

/**
 * Fetch galaxy/cluster physical data from VizieR HyperLEDA catalog.
 * Returns redshift, radial velocity, morphological type, and distance.
 */
async function fetchVizierInfo(
  objectName: string,
  signal?: AbortSignal,
): Promise<Partial<ObjectDetailedInfo> | null> {
  const dataSources = getActiveDataSources();
  const vizierSource = dataSources.find(s => s.type === 'vizier');

  if (!vizierSource) return null;

  try {
    // Query HyperLEDA via VizieR TAP
    const response = await smartFetch(
      `${vizierSource.baseUrl}/viz-bin/votable?-source=VII/237/pgc&-c=${encodeURIComponent(objectName)}&-c.rs=5&-out=objname,type,v,vdis,modz,logd25,logr25,bt,it,m21&-out.max=1`,
      {
        timeout: vizierSource.timeout,
        headers: { Accept: 'application/json' },
        signal,
      }
    );

    if (!response.ok) return null;

    // VizieR returns VOTable; try to parse as text and extract values
    const text = await response.text();
    if (!text || text.length < 50) return null;

    // Try to parse VOTable XML for field values
    const result: Partial<ObjectDetailedInfo> = { sources: ['VizieR/HyperLEDA'] };

    // Extract radial velocity (v field, km/s)
    const vMatch = text.match(/<TD[^>]*>([\d.+-]+)<\/TD>/g);
    if (vMatch && vMatch.length >= 3) {
      // Parse velocity from the third field (index 2)
      const velStr = vMatch[2]?.match(/>([^<]+)</)?.[1];
      if (velStr && !isNaN(Number(velStr))) {
        result.radialVelocity = Number(velStr);
        // Estimate redshift from velocity
        const c = 299792.458; // km/s
        result.redshift = Number(velStr) / c;
      }
    }

    // Extract morphological type if available
    const typeMatch = text.match(/type[^<]*<TD[^>]*>([^<]+)<\/TD>/i);
    if (typeMatch?.[1]?.trim()) {
      result.morphologicalType = typeMatch[1].trim();
    }

    // Extract distance modulus → distance in Mly
    const modzMatch = text.match(/modz[^<]*<TD[^>]*>([\d.]+)<\/TD>/i);
    if (modzMatch?.[1]) {
      const modz = Number(modzMatch[1]);
      if (!isNaN(modz) && modz > 0) {
        const distPc = Math.pow(10, (modz + 5) / 5);
        const distLy = distPc * 3.26156;
        result.distanceLy = distLy;
        if (distLy > 1e6) {
          result.distance = `${(distLy / 1e6).toFixed(1)} Mly`;
        } else if (distLy > 1000) {
          result.distance = `${(distLy / 1000).toFixed(1)} kly`;
        } else {
          result.distance = `${distLy.toFixed(0)} ly`;
        }
      }
    }

    // Only return if we got meaningful data
    if (result.radialVelocity != null || result.morphologicalType || result.distance) {
      return result;
    }
    return null;
  } catch (error) {
    if (signal?.aborted) return null;
    logger.warn('Failed to fetch VizieR info', error);
    useObjectInfoConfigStore.getState().setDataSourceStatus(vizierSource.id, 'error');
    return null;
  }
}

// ============================================================================
// NED Fetcher (Extragalactic Database)
// ============================================================================

/**
 * Fetch extragalactic data from NASA/IPAC NED.
 * Returns redshift, distance, radial velocity, and classification.
 */
async function fetchNedInfo(
  objectName: string,
  signal?: AbortSignal,
): Promise<Partial<ObjectDetailedInfo> | null> {
  const dataSources = getActiveDataSources();
  const nedSource = dataSources.find(s => s.type === 'ned');

  if (!nedSource) return null;

  try {
    // NED object search — request JSON output via of=json_basic
    const url = `${nedSource.baseUrl}/cgi-bin/objsearch?objname=${encodeURIComponent(objectName)}&extend=no&hconst=67.8&omegam=0.308&omegav=0.692&corr_z=1&out_csys=Equatorial&out_equinox=J2000.0&obj_sort=RA+or+Longitude&of=xml_main&zv_breaker=30000.0&list_limit=1&img_stamp=NO`;

    const response = await smartFetch(url, {
      timeout: nedSource.timeout,
      headers: { Accept: 'text/xml, application/xml' },
      signal,
    });

    if (!response.ok) return null;

    const text = await response.text();
    if (!text || text.length < 100) return null;

    const result: Partial<ObjectDetailedInfo> = { sources: ['NED'] };

    // Extract redshift from NED XML
    const zMatch = text.match(/<Velocity[^>]*>([\d.eE+-]+)<\/Velocity>/i)
      || text.match(/<Redshift[^>]*>([\d.eE+-]+)<\/Redshift>/i);
    if (zMatch?.[1]) {
      const val = Number(zMatch[1]);
      if (!isNaN(val)) {
        // If value > 100 it's velocity in km/s, else redshift
        if (val > 100) {
          result.radialVelocity = val;
          result.redshift = val / 299792.458;
        } else {
          result.redshift = val;
          result.radialVelocity = val * 299792.458;
        }
      }
    }

    // Extract object type
    const typeMatch = text.match(/<ObjType[^>]*>([^<]+)<\/ObjType>/i);
    if (typeMatch?.[1]?.trim()) {
      const parsed = parseObjectType(typeMatch[1].trim());
      if (parsed.category !== 'other') {
        result.type = parsed.type;
        result.typeCategory = parsed.category;
      }
    }

    // Only return if we got meaningful data
    if (result.redshift != null || result.type) {
      return result;
    }
    return null;
  } catch (error) {
    if (signal?.aborted) return null;
    logger.warn('Failed to fetch NED info', error);
    useObjectInfoConfigStore.getState().setDataSourceStatus(nedSource.id, 'error');
    return null;
  }
}

/**
 * Get a brief description based on object type and metadata
 */
export function getObjectDescription(
  type: string, 
  category: ObjectDetailedInfo['typeCategory'],
  names: string[],
  opts?: {
    magnitude?: number;
    distance?: string;
    morphologicalType?: string;
    redshift?: number;
    discoverer?: string;
    discoveryYear?: number;
  },
): string {
  const primaryName = names[0] || 'This object';
  const mag = opts?.magnitude;
  const dist = opts?.distance;
  const morph = opts?.morphologicalType;
  const z = opts?.redshift;
  const disc = opts?.discoverer;
  const year = opts?.discoveryYear;
  
  let base: string;
  switch (category) {
    case 'galaxy':
      base = `${primaryName} is a ${morph ? morph + ' type ' : ''}galaxy${dist ? ` located approximately ${dist} away` : ''}.`;
      if (z != null && z > 0.001) base += ` Redshift z = ${z.toFixed(4)}.`;
      break;
    case 'nebula':
      base = `${primaryName} is a ${type.toLowerCase()}${dist ? ` located approximately ${dist} away` : ''}.`;
      break;
    case 'cluster':
      base = `${primaryName} is a ${type.toLowerCase()}${dist ? ` located approximately ${dist} away` : ''}.`;
      break;
    case 'star':
      base = `${primaryName} is a star${mag != null ? ` with an apparent magnitude of ${mag.toFixed(1)}` : ''}.`;
      break;
    case 'planet':
      base = `${primaryName} is a planet in our solar system.`;
      break;
    case 'moon':
      base = `${primaryName} is a natural satellite.`;
      break;
    case 'comet':
      base = `${primaryName} is a comet.`;
      break;
    case 'asteroid':
      base = `${primaryName} is a minor planet or asteroid.`;
      break;
    case 'artificial':
      base = `${primaryName} is an artificial satellite.`;
      break;
    default:
      base = `${primaryName}.`;
      break;
  }

  if (mag != null && category !== 'star') {
    base += ` It has an apparent magnitude of ${mag.toFixed(1)}.`;
  }

  if (disc || year) {
    const parts: string[] = [];
    if (disc) parts.push(`by ${disc}`);
    if (year) parts.push(`in ${year}`);
    base += ` Discovered ${parts.join(' ')}.`;
  }
  
  return base;
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Build complete object info from available data
 */
export async function getObjectDetailedInfo(
  names: string[],
  ra: number,
  dec: number,
  raString: string,
  decString: string,
  existingData?: {
    type?: string;
    magnitude?: number;
    size?: string;
    constellation?: string;
  }
): Promise<ObjectDetailedInfo> {
  const primaryName = names[0] || 'Unknown Object';
  
  // Parse existing type info
  const typeInfo = parseObjectType(existingData?.type);
  
  // Parse angular size if provided
  let angularSizeArcmin: { width: number; height: number } | undefined;
  if (existingData?.size) {
    const sizeMatch = existingData.size.match(/([\d.]+)['"′]?\s*[×x]?\s*([\d.]+)?['"′]?/);
    if (sizeMatch) {
      const w = parseFloat(sizeMatch[1]);
      const h = sizeMatch[2] ? parseFloat(sizeMatch[2]) : w;
      angularSizeArcmin = { width: w, height: h };
    }
  }
  
  // Generate images
  const images = generateObjectImages(
    ra, 
    dec, 
    names,
    angularSizeArcmin?.width
  );

  // Resolve constellation: prefer Stellarium-provided, then compute from coords
  const constellation = existingData?.constellation || getConstellation(ra, dec);

  // Famous objects enrichment
  const famous = findFamousObjectEntry(names);
  if (famous?.imageUrl) {
    const exists = images.some(img => img.url === famous.imageUrl);
    if (!exists) {
      images.unshift({
        url: famous.imageUrl!,
        source: 'Wikipedia',
        credit: 'Wikimedia Commons',
        title: `${primaryName} - Featured Image`,
        availability: 'degraded',
        authorityLevel: 'fallback-local',
      });
    }
  }
  
  // Build base info
  const info: ObjectDetailedInfo = {
    names: famous
      ? [...new Set([...names, ...famous.names])]
      : names,
    type: typeInfo.type,
    typeCategory: typeInfo.category,
    constellation,
    ra,
    dec,
    raString,
    decString,
    magnitude: existingData?.magnitude,
    angularSize: existingData?.size || formatAngularSize(angularSizeArcmin?.width, angularSizeArcmin?.height),
    angularSizeArcmin,
    discoverer: famous?.discoverer,
    discoveryYear: famous?.discoveryYear,
    images,
    simbadUrl: getSimbadUrl(primaryName),
    wikipediaUrl: getWikipediaUrl(primaryName),
    sources: ['Local'],
    provenance: {
      identity: {
        acceptedSource: 'Local',
        authorityLevel: 'fallback-local',
        contributors: ['Local'],
      },
      classification: {
        acceptedSource: 'Local',
        authorityLevel: 'fallback-local',
        contributors: ['Local'],
      },
      physical: {
        acceptedSource: 'Local',
        authorityLevel: 'fallback-local',
        contributors: ['Local'],
      },
      images: {
        acceptedSource: 'Local',
        authorityLevel: 'fallback-local',
        contributors: ['Local'],
      },
    },
    diagnostics: [],
  };

  // Use famous description when available, otherwise generate
  info.description = famous?.description || getObjectDescription(
    info.type,
    info.typeCategory,
    names,
    {
      magnitude: info.magnitude,
      distance: info.distance,
      morphologicalType: info.morphologicalType,
      discoverer: info.discoverer,
      discoveryYear: info.discoveryYear,
    },
  );
  info.provenance.description = {
    acceptedSource: 'Local',
    authorityLevel: 'fallback-local',
    contributors: ['Local'],
  };
  
  return info;
}

/**
 * Fetch additional info from external sources (async enhancement).
 * Supports AbortSignal for cancellation.
 */
export async function enhanceObjectInfo(
  info: ObjectDetailedInfo,
  signal?: AbortSignal,
): Promise<ObjectDetailedInfo> {
  try {
    const dataSources = getActiveDataSources();
    let enhanced = { ...info };

    for (const source of dataSources) {
      if (signal?.aborted) break;

      if (!isSourceEligibleForObject(enhanced, source)) {
        enhanced = {
          ...enhanced,
          diagnostics: appendDiagnostic(
            enhanced.diagnostics,
            createDiagnostic(source.id, 'unsupported', source.type === 'wikipedia' ? 'description' : 'physical')
          ),
        };
        continue;
      }

      let patch: Partial<ObjectDetailedInfo> | null = null;

      switch (source.type as ExternalDataSourceType) {
        case 'simbad':
          patch = await fetchSimbadInfo(info.names[0], signal);
          break;
        case 'wikipedia':
          patch = await fetchWikipediaInfo(info.names[0], signal);
          break;
        case 'sbdb':
          if (info.typeCategory === 'comet' || info.typeCategory === 'asteroid' || info.typeCategory === 'other') {
            patch = await fetchSbdbInfo(info.names[0], signal);
          }
          break;
        case 'vizier':
          if (info.typeCategory === 'galaxy' || info.typeCategory === 'cluster' || info.typeCategory === 'other') {
            patch = await fetchVizierInfo(info.names[0], signal);
          }
          break;
        case 'ned':
          if (info.typeCategory === 'galaxy' || info.typeCategory === 'other') {
            patch = await fetchNedInfo(info.names[0], signal);
          }
          break;
      }

      if (patch) {
        enhanced = mergeEnhancedInfo(
          enhanced,
          patch,
          source.name,
          source.authorityLevel
        );
      } else {
        enhanced = {
          ...enhanced,
          diagnostics: appendDiagnostic(
            enhanced.diagnostics,
            createDiagnostic(
              source.id,
              'empty',
              source.type === 'wikipedia' ? 'description' : source.type === 'sbdb' ? 'physical' : 'physical'
            )
          ),
        };
      }
    }

    if (!enhanced.description) {
      enhanced.description = getObjectDescription(
        enhanced.type,
        enhanced.typeCategory,
        enhanced.names,
        {
          magnitude: enhanced.magnitude,
          distance: enhanced.distance,
          morphologicalType: enhanced.morphologicalType,
          redshift: enhanced.redshift,
          discoverer: enhanced.discoverer,
          discoveryYear: enhanced.discoveryYear,
        },
      );
    }

    return enhanced;
  } catch (error) {
    if (signal?.aborted) return info;
    logger.warn('Failed to enhance object info', error);
  }
  
  return info;
}

// ============================================================================
// LRU Cache with TTL
// ============================================================================

const CACHE_MAX_SIZE = 200;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CacheEntry {
  info: ObjectDetailedInfo;
  timestamp: number;
}

/** Simple LRU cache backed by a Map (insertion-order iteration). */
const objectInfoCache = new Map<string, CacheEntry>();

function cacheGet(key: string): ObjectDetailedInfo | undefined {
  const entry = objectInfoCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    objectInfoCache.delete(key);
    return undefined;
  }
  // Move to end (most recently used)
  objectInfoCache.delete(key);
  objectInfoCache.set(key, entry);
  return entry.info;
}

function cacheSet(key: string, info: ObjectDetailedInfo): void {
  // Evict oldest if at capacity
  if (objectInfoCache.size >= CACHE_MAX_SIZE) {
    const oldest = objectInfoCache.keys().next().value;
    if (oldest != null) objectInfoCache.delete(oldest);
  }
  objectInfoCache.set(key, { info, timestamp: Date.now() });
}

/**
 * Get cached or fetch object info
 */
export async function getCachedObjectInfo(
  names: string[],
  ra: number,
  dec: number,
  raString: string,
  decString: string,
  existingData?: {
    type?: string;
    magnitude?: number;
    size?: string;
    constellation?: string;
  }
): Promise<ObjectDetailedInfo> {
  const cacheKey = names[0] || `${ra.toFixed(4)}_${dec.toFixed(4)}`;
  
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  
  const info = await getObjectDetailedInfo(names, ra, dec, raString, decString, existingData);
  cacheSet(cacheKey, info);
  
  return info;
}

/**
 * Update a cache entry after enhancement
 */
export function updateCachedObjectInfo(info: ObjectDetailedInfo): void {
  const cacheKey = info.names[0] || `${info.ra.toFixed(4)}_${info.dec.toFixed(4)}`;
  cacheSet(cacheKey, info);
}

/**
 * Clear the cache
 */
export function clearObjectInfoCache(): void {
  objectInfoCache.clear();
}
