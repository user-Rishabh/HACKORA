import os
import time
import threading
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List

def mask_api_key(key: str) -> str:
    """
    Returns a masked representation of an API key, e.g. '••••••••••••3a2f'.
    Never reveals the secret characters.
    """
    if not key:
        return ""
    clean = key.strip()
    if len(clean) <= 6:
        return "••••••••"
    suffix = clean[-4:]
    return f"••••••••••••{suffix}"

class BaseCredentialStore(ABC):
    """
    Abstract credential storage contract for temporary AI provider API keys.
    Enables swapping Redis for AWS KMS / encrypted stores in future phases.
    """

    @abstractmethod
    def set_credential(
        self,
        user_id: str,
        session_id: str,
        provider: str,
        api_key: str,
        default_model: Optional[str] = None,
        ttl_seconds: int = 3600
    ) -> Dict[str, Any]:
        """Temporarily store credential with user and session isolation and TTL."""
        pass

    @abstractmethod
    def get_credential(self, user_id: str, session_id: str, provider: str) -> Optional[str]:
        """Retrieve raw API key for backend inference only. Never exposed to frontend or logged."""
        pass

    @abstractmethod
    def list_credentials(self, user_id: str, session_id: str) -> List[Dict[str, Any]]:
        """Return masked credentials list for UI display."""
        pass

    @abstractmethod
    def delete_credential(self, user_id: str, session_id: str, provider: str) -> bool:
        """Remove a single temporary credential."""
        pass

    @abstractmethod
    def clear_session(self, user_id: str, session_id: str) -> int:
        """Secure cleanup of all credentials for a user session (e.g. on logout)."""
        pass


class InMemoryCredentialStore(BaseCredentialStore):
    """
    In-memory temporary credential store.
    LIMITATION NOTICE (LOCAL DEVELOPMENT ONLY):
    - Single-process only: does not synchronize across multiple worker instances.
    - Volatile: all credentials are reset if the backend server restarts.
    - Not for production deployment without a centralized Redis cluster.
    """

    def __init__(self):
        self._lock = threading.Lock()
        # Structure: {(user_id, session_id, provider): {"key": str, "model": str, "expires_at": float}}
        self._store: Dict[tuple, Dict[str, Any]] = {}

    def _purge_expired(self):
        now = time.time()
        expired_keys = [k for k, v in self._store.items() if v["expires_at"] < now]
        for k in expired_keys:
            del self._store[k]

    def set_credential(
        self,
        user_id: str,
        session_id: str,
        provider: str,
        api_key: str,
        default_model: Optional[str] = None,
        ttl_seconds: int = 3600
    ) -> Dict[str, Any]:
        with self._lock:
            self._purge_expired()
            expires_at = time.time() + ttl_seconds
            k = (str(user_id), str(session_id), str(provider).lower())
            self._store[k] = {
                "key": api_key.strip(),
                "model": default_model or "",
                "expires_at": expires_at,
            }
            return {
                "provider": provider.lower(),
                "status": "connected",
                "key_preview": mask_api_key(api_key),
                "default_model": default_model,
                "expires_in": ttl_seconds,
            }

    def get_credential(self, user_id: str, session_id: str, provider: str) -> Optional[str]:
        with self._lock:
            self._purge_expired()
            k = (str(user_id), str(session_id), str(provider).lower())
            item = self._store.get(k)
            if not item:
                return None
            if item["expires_at"] < time.time():
                del self._store[k]
                return None
            return item["key"]

    def list_credentials(self, user_id: str, session_id: str) -> List[Dict[str, Any]]:
        with self._lock:
            self._purge_expired()
            results = []
            now = time.time()
            for (uid, sid, prov), item in self._store.items():
                if uid == str(user_id) and sid == str(session_id) and item["expires_at"] > now:
                    results.append({
                        "provider": prov,
                        "status": "connected",
                        "key_preview": mask_api_key(item["key"]),
                        "masked_key": mask_api_key(item["key"]),
                        "default_model": item.get("model") or None,
                        "expires_in": max(0, int(item["expires_at"] - now)),
                    })
            return results

    def delete_credential(self, user_id: str, session_id: str, provider: str) -> bool:
        with self._lock:
            k = (str(user_id), str(session_id), str(provider).lower())
            if k in self._store:
                del self._store[k]
                return True
            return False

    def clear_session(self, user_id: str, session_id: str) -> int:
        with self._lock:
            keys_to_delete = [
                k for k in self._store.keys()
                if k[0] == str(user_id) and k[1] == str(session_id)
            ]
            for k in keys_to_delete:
                del self._store[k]
            return len(keys_to_delete)


class RedisCredentialStore(BaseCredentialStore):
    """
    Production-ready Redis credential store with TTL-based automatic expiration.
    Keys are isolated by: hackora:cred:{user_id}:{session_id}:{provider}
    """

    def __init__(self, redis_url: str):
        try:
            import redis
            self._client = redis.Redis.from_url(redis_url, decode_responses=True)
            self._client.ping()
            print(f"[HACKORA Security] RedisCredentialStore connected successfully to {redis_url[:16]}...")
        except Exception as e:
            # Per security spec: Do NOT silently fall back to insecure storage if Redis is configured but fails
            raise RuntimeError(
                f"[HACKORA Security Error] REDIS_URL is configured, but failed to connect to Redis: {str(e)}. "
                "Refusing silent fallback to volatile in-memory storage in production mode."
            ) from e

    def _make_key(self, user_id: str, session_id: str, provider: str) -> str:
        return f"hackora:cred:{user_id}:{session_id}:{provider.lower()}"

    def set_credential(
        self,
        user_id: str,
        session_id: str,
        provider: str,
        api_key: str,
        default_model: Optional[str] = None,
        ttl_seconds: int = 3600
    ) -> Dict[str, Any]:
        key = self._make_key(user_id, session_id, provider)
        data = {
            "key": api_key.strip(),
            "model": default_model or "",
        }
        import json
        self._client.setex(key, ttl_seconds, json.dumps(data))
        return {
            "provider": provider.lower(),
            "status": "connected",
            "key_preview": mask_api_key(api_key),
            "default_model": default_model,
            "expires_in": ttl_seconds,
        }

    def get_credential(self, user_id: str, session_id: str, provider: str) -> Optional[str]:
        key = self._make_key(user_id, session_id, provider)
        raw = self._client.get(key)
        if not raw:
            return None
        import json
        try:
            parsed = json.loads(raw)
            return parsed.get("key")
        except Exception:
            return None

    def list_credentials(self, user_id: str, session_id: str) -> List[Dict[str, Any]]:
        pattern = f"hackora:cred:{user_id}:{session_id}:*"
        keys = self._client.keys(pattern)
        results = []
        import json
        for k in keys:
            prov = k.split(":")[-1]
            raw = self._client.get(k)
            ttl = self._client.ttl(k)
            if raw and ttl > 0:
                try:
                    parsed = json.loads(raw)
                    results.append({
                        "provider": prov,
                        "status": "connected",
                        "key_preview": mask_api_key(parsed.get("key", "")),
                        "masked_key": mask_api_key(parsed.get("key", "")),
                        "default_model": parsed.get("model") or None,
                        "expires_in": ttl,
                    })
                except Exception:
                    pass
        return results

    def delete_credential(self, user_id: str, session_id: str, provider: str) -> bool:
        key = self._make_key(user_id, session_id, provider)
        return bool(self._client.delete(key))

    def clear_session(self, user_id: str, session_id: str) -> int:
        pattern = f"hackora:cred:{user_id}:{session_id}:*"
        keys = self._client.keys(pattern)
        if keys:
            return self._client.delete(*keys)
        return 0


# Singleton Factory
_service_instance: Optional[BaseCredentialStore] = None

def get_credential_service() -> BaseCredentialStore:
    global _service_instance
    if _service_instance is None:
        redis_url = os.getenv("REDIS_URL")
        if redis_url:
            _service_instance = RedisCredentialStore(redis_url)
        else:
            print(
                "[HACKORA Security Notice] REDIS_URL not configured. "
                "Using InMemoryCredentialStore for local development. "
                "Credentials are isolated in memory and will expire after 1 hour."
            )
            _service_instance = InMemoryCredentialStore()
    return _service_instance
