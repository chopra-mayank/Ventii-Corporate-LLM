import { config } from '../config/config.js';
import { logger } from './logger.js';

class SimpleCache {
  constructor() {
    this.cache = new Map();
    this.maxSize = config.maxCacheSize;
    this.defaultTTL = config.cacheExpiryMinutes * 60 * 1000; // Convert to milliseconds
    
    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      clears: 0
    };

    // Cleanup interval (every 5 minutes)
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);

    logger.debug('Cache initialized', {
      maxSize: this.maxSize,
      defaultTTLMinutes: config.cacheExpiryMinutes
    });
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or null if not found/expired
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      logger.logCache('miss', key);
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.deletes++;
      logger.logCache('miss', key, { reason: 'expired' });
      return null;
    }

    this.stats.hits++;
    logger.logCache('hit', key);
    return entry.value;
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttlMinutes - Time to live in minutes (optional)
   * @returns {boolean} True if set successfully
   */
  set(key, value, ttlMinutes = null) {
    try {
      // Use provided TTL or default
      const ttl = ttlMinutes ? ttlMinutes * 60 * 1000 : this.defaultTTL;
      const expires = Date.now() + ttl;

      // Remove oldest entries if cache is full
      if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
        this.evictOldest();
      }

      this.cache.set(key, {
        value,
        expires,
        created: Date.now()
      });

      this.stats.sets++;
      logger.logCache('set', key, { 
        ttlMinutes: ttlMinutes || config.cacheExpiryMinutes,
        size: this.cache.size 
      });
      
      return true;
    } catch (error) {
      logger.error('Cache set failed:', error.message);
      return false;
    }
  }

  /**
   * Check if key exists in cache (and not expired)
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists and not expired
   */
  has(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      this.stats.deletes++;
      return false;
    }

    return true;
  }

  /**
   * Delete specific key from cache
   * @param {string} key - Cache key
   * @returns {boolean} True if key was deleted
   */
  delete(key) {
    const existed = this.cache.delete(key);
    
    if (existed) {
      this.stats.deletes++;
      logger.logCache('delete', key);
    }
    
    return existed;
  }

  /**
   * Clear entire cache
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.clears++;
    
    logger.logCache('clear', '', { entriesCleared: size });
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.stats.hits > 0 ? 
        ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(2) + '%' : 
        '0%',
      defaultTTLMinutes: config.cacheExpiryMinutes
    };
  }

  /**
   * Get all cache keys (for debugging)
   * @returns {Array} Array of cache keys
   */
  getKeys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache entry info
   * @param {string} key - Cache key
   * @returns {Object|null} Entry info or null if not found
   */
  getEntryInfo(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    return {
      key,
      created: new Date(entry.created).toISOString(),
      expires: new Date(entry.expires).toISOString(),
      isExpired: now > entry.expires,
      remainingTTL: Math.max(0, entry.expires - now),
      valueType: typeof entry.value,
      valueSize: JSON.stringify(entry.value).length
    };
  }

  /**
   * Clean up expired entries
   * @returns {number} Number of entries removed
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.stats.deletes += removed;
      logger.debug(`🧹 Cache cleanup removed ${removed} expired entries`);
    }

    return removed;
  }

  /**
   * Evict oldest entry to make room
   * @returns {string|null} Key of evicted entry or null
   */
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.created < oldestTime) {
        oldestTime = entry.created;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.deletes++;
      logger.debug(`🗑️  Evicted oldest cache entry: ${oldestKey}`);
    }

    return oldestKey;
  }

  /**
   * Get or set pattern - get value from cache, or compute and cache it
   * @param {string} key - Cache key
   * @param {Function} computeFn - Function to compute value if not cached
   * @param {number} ttlMinutes - TTL in minutes
   * @returns {*} Cached or computed value
   */
  async getOrSet(key, computeFn, ttlMinutes = null) {
    const cached = this.get(key);
    
    if (cached !== null) {
      return cached;
    }

    try {
      const computed = await computeFn();
      this.set(key, computed, ttlMinutes);
      return computed;
    } catch (error) {
      logger.error(`Cache getOrSet failed for key ${key}:`, error.message);
      throw error;
    }
  }

  /**
   * Destroy cache and cleanup
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.clear();
    logger.debug('Cache destroyed');
  }
}

// Create singleton cache instance
export const cache = new SimpleCache();

// Cleanup on process exit
process.on('exit', () => {
  cache.destroy();
});

process.on('SIGINT', () => {
  cache.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cache.destroy();
  process.exit(0);
});