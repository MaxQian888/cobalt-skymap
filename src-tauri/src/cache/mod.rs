//! Cache module
//! Provides caching functionality for tiles and network resources
//!
//! Submodules:
//! - `offline`: Offline tile caching for sky surveys
//! - `unified`: Unified network resource caching

pub mod offline;
pub mod unified;

// Re-export types and commands from offline cache
pub use offline::{
    clear_all_cache, clear_survey_cache, create_cache_region, delete_cache_region,
    get_cache_directory, get_cache_stats, is_tile_cached, list_cache_regions, load_cached_tile,
    save_cached_tile, update_cache_region, CacheData, CacheRegion, CacheStats, CacheStatus,
    CreateRegionArgs, SurveyCacheInfo, TileMetadata,
};

// Re-export types and commands from unified cache
pub use unified::{
    cleanup_unified_cache, clear_unified_cache, delete_unified_cache_entry, flush_unified_cache,
    get_unified_cache_entry, get_unified_cache_size, get_unified_cache_stats,
    list_unified_cache_keys, prefetch_url, prefetch_urls, put_unified_cache_entry, CacheEntryMeta,
    CacheIndex, PrefetchResult, UnifiedCacheResponse, UnifiedCacheStats,
};

#[cfg(test)]
pub(crate) mod test_support {
    use std::{
        path::PathBuf,
        sync::{Mutex, MutexGuard, OnceLock},
        time::{SystemTime, UNIX_EPOCH},
    };

    fn cache_test_mutex() -> &'static Mutex<()> {
        static CACHE_TEST_MUTEX: OnceLock<Mutex<()>> = OnceLock::new();
        CACHE_TEST_MUTEX.get_or_init(|| Mutex::new(()))
    }

    pub(crate) fn cache_test_lock() -> MutexGuard<'static, ()> {
        cache_test_mutex()
            .lock()
            .expect("cache test mutex should not be poisoned")
    }

    pub(crate) fn unique_temp_dir(prefix: &str) -> PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after Unix epoch")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "cobalt-skymap-cache-{prefix}-{}-{timestamp}",
            std::process::id()
        ))
    }
}
