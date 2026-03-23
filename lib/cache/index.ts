/**
 * Cache Module
 * Unified exports for all caching utilities
 */

// Configuration
export {
  CACHE_CONFIG,
  CACHEABLE_URL_PATTERNS,
  PREFETCH_RESOURCES,
  hoursToMs,
  daysToMs,
  formatBytes,
  formatDuration,
} from './config';

// Statistics
export {
  collectCacheStats,
  formatCacheStats,
  getCacheStatsSummary,
  cacheStats,
  type CacheStatsEntry,
  type AggregatedCacheStats,
} from './stats';

// Compression
export {
  isCompressionSupported,
  shouldCompress,
  compress,
  decompress,
  getCompressionRatio,
  formatCompressionSavings,
  type CompressedData,
} from './compression';

// Migration
export {
  getCacheVersion,
  isMigrationNeeded,
  runMigrations,
  resetAllCaches,
  initializeCacheSystem,
  type CacheVersion,
  type MigrationResult,
} from './migration';

// Integration policies and diagnostics
export {
  getCachePolicy,
  listCachePolicies,
  listCacheIntegrations,
  resolveCachePolicy,
  resolveCachePolicyForPrefetchResource,
  getCacheProviderDiagnostics,
  getCacheIntegrationDiagnostics,
  getCacheDiagnosticsSummary,
  getCacheCapabilityDiagnostics,
  type CachePolicyId,
  type CachePolicyDefinition,
  type CacheIntegrationDefinition,
  type CacheIntegrationDiagnostic,
  type CacheCapabilityDiagnostics,
  type CacheCapabilityStatus,
  type CacheIntegrationMode,
  type CacheIntegrationImplementation,
  type CacheIntegrationStatus,
  type CacheRuntimeEnvironment,
} from './integration-policy';
