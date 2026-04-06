"""
Redis Cache Service
Caches: tax calculations, chat history, vector search results, session data
Falls back gracefully to in-memory dict if Redis is unavailable
"""
import json
import hashlib
from typing import Any, Optional
from datetime import timedelta

# In-memory fallback when Redis not available
_memory_cache: dict = {}


def _make_key(prefix: str, data: Any) -> str:
    """Create a cache key from prefix + hashed data."""
    raw = json.dumps(data, sort_keys=True, default=str)
    h = hashlib.md5(raw.encode()).hexdigest()[:12]
    return f"itr:{prefix}:{h}"


class CacheService:
    """
    Redis cache with in-memory fallback.
    All methods are sync-safe and never raise — cache misses are silent.
    """

    def __init__(self):
        self._redis = None
        self._available = False
        self._try_connect()

    def _try_connect(self):
        try:
            import redis
            r = redis.Redis(host="localhost", port=6379, db=0,
                            socket_connect_timeout=1, decode_responses=True)
            r.ping()
            self._redis = r
            self._available = True
            print("✅ Redis connected — caching enabled")
        except Exception:
            self._available = False
            print("⚠️  Redis not available — using in-memory cache fallback")

    # ── Core get/set/delete ─────────────────────────────────────────

    def get(self, key: str) -> Optional[Any]:
        try:
            if self._available:
                val = self._redis.get(key)
                return json.loads(val) if val else None
            return _memory_cache.get(key)
        except Exception:
            return None

    def set(self, key: str, value: Any, ttl_seconds: int = 3600) -> bool:
        try:
            serialized = json.dumps(value, default=str)
            if self._available:
                self._redis.setex(key, timedelta(seconds=ttl_seconds), serialized)
            else:
                _memory_cache[key] = value
                # Memory cache size guard
                if len(_memory_cache) > 500:
                    oldest = list(_memory_cache.keys())[:100]
                    for k in oldest:
                        _memory_cache.pop(k, None)
            return True
        except Exception:
            return False

    def delete(self, key: str) -> bool:
        try:
            if self._available:
                self._redis.delete(key)
            else:
                _memory_cache.pop(key, None)
            return True
        except Exception:
            return False

    def delete_pattern(self, pattern: str):
        """Delete all keys matching a pattern (Redis only)."""
        try:
            if self._available:
                keys = self._redis.keys(pattern)
                if keys:
                    self._redis.delete(*keys)
            else:
                to_del = [k for k in _memory_cache if pattern.replace("*", "") in k]
                for k in to_del:
                    _memory_cache.pop(k, None)
        except Exception:
            pass

    def exists(self, key: str) -> bool:
        try:
            if self._available:
                return bool(self._redis.exists(key))
            return key in _memory_cache
        except Exception:
            return False

    def info(self) -> dict:
        try:
            if self._available:
                info = self._redis.info("memory")
                return {
                    "backend": "redis",
                    "connected": True,
                    "used_memory_human": info.get("used_memory_human", "N/A"),
                    "keys": self._redis.dbsize(),
                }
            return {
                "backend": "memory",
                "connected": False,
                "keys": len(_memory_cache),
            }
        except Exception:
            return {"backend": "unknown", "connected": False}

    # ── Domain-specific helpers ─────────────────────────────────────

    def cache_tax_calculation(self, request_data: dict, result: dict):
        """Cache a tax calculation result for 24 hours."""
        key = _make_key("calc", request_data)
        self.set(key, result, ttl_seconds=86400)
        return key

    def get_cached_calculation(self, request_data: dict) -> Optional[dict]:
        """Return cached tax result if available."""
        key = _make_key("calc", request_data)
        return self.get(key)

    def cache_vector_search(self, query: str, results: list):
        """Cache vector search results for 1 hour."""
        key = _make_key("vec", query)
        self.set(key, results, ttl_seconds=3600)

    def get_cached_vector_search(self, query: str) -> Optional[list]:
        key = _make_key("vec", query)
        return self.get(key)

    def cache_chat_history(self, session_id: str, messages: list):
        """Cache last 20 chat messages for 30 minutes."""
        key = f"itr:chat:{session_id}"
        self.set(key, messages[-20:], ttl_seconds=1800)

    def get_cached_chat_history(self, session_id: str) -> Optional[list]:
        key = f"itr:chat:{session_id}"
        return self.get(key)

    def invalidate_chat_cache(self, session_id: str):
        self.delete(f"itr:chat:{session_id}")

    def cache_session_profile(self, session_id: str, profile: dict):
        key = f"itr:profile:{session_id}"
        self.set(key, profile, ttl_seconds=7200)

    def get_cached_profile(self, session_id: str) -> Optional[dict]:
        key = f"itr:profile:{session_id}"
        return self.get(key)


# Singleton
cache = CacheService()
