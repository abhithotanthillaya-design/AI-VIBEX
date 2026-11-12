"""Cryptographic password hashing, session token helpers, and login throttling."""

from collections import defaultdict, deque
import hashlib
import secrets
import threading
import time

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

# Argon2id with default argon2-cffi parameters (time_cost=3, memory_cost=65536 KiB, parallelism=4).
_PASSWORD_HASHER = PasswordHasher()


def hash_password(plain_password: str) -> str:
    """Hash a plaintext password using Argon2id."""
    return _PASSWORD_HASHER.hash(plain_password)


def verify_password(stored_hash: str, plain_password: str) -> tuple[bool, bool]:
    """Verify a plaintext password against a stored Argon2id hash.

    Returns `(is_valid, needs_rehash)`. Never raises on mismatch or malformed hash.
    """
    try:
        valid = _PASSWORD_HASHER.verify(stored_hash, plain_password)
        if not valid:
            return False, False
        return True, _PASSWORD_HASHER.check_needs_rehash(stored_hash)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False, False


def hash_session_token(raw_token: str) -> str:
    """Compute SHA-256 hex digest for storing and looking up session tokens."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_session_and_csrf_tokens() -> tuple[str, str, str]:
    """Return `(raw_session_token, session_token_hash, csrf_token)`."""
    raw_session = f"qls_{secrets.token_urlsafe(32)}"
    token_hash = hash_session_token(raw_session)
    csrf_token = secrets.token_urlsafe(24)
    return raw_session, token_hash, csrf_token


class LoginRateLimiter:
    """In-process sliding-window brute-force guard keyed by `(client_ip, email)`.

    Prototype limitation: state lives in memory for a single FastAPI worker process;
    horizontal multi-worker production deployments must replace this with shared storage (e.g. Redis).
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._failures: dict[tuple[str, str], deque[float]] = defaultdict(deque)

    def _prune(self, bucket: deque[float], now_ts: float, window_seconds: int) -> None:
        cutoff = now_ts - max(1, window_seconds)
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()

    def is_blocked(
        self,
        client_ip: str,
        email: str,
        *,
        max_attempts: int,
        window_seconds: int,
    ) -> int:
        """Return remaining cooldown seconds if blocked, else `0`."""
        key = (client_ip, email.lower())
        now_ts = time.monotonic()
        with self._lock:
            bucket = self._failures.get(key)
            if not bucket:
                return 0
            self._prune(bucket, now_ts, window_seconds)
            if len(bucket) >= max_attempts:
                retry_after = int(max(1.0, (bucket[0] + window_seconds) - now_ts))
                return retry_after
            return 0

    def record_failure(
        self,
        client_ip: str,
        email: str,
        *,
        window_seconds: int,
    ) -> None:
        """Record a failed login attempt timestamp."""
        key = (client_ip, email.lower())
        now_ts = time.monotonic()
        with self._lock:
            bucket = self._failures[key]
            self._prune(bucket, now_ts, window_seconds)
            bucket.append(now_ts)

    def reset(self, client_ip: str, email: str) -> None:
        """Clear recorded failures on successful login."""
        key = (client_ip, email.lower())
        with self._lock:
            self._failures.pop(key, None)

    def clear_all(self) -> None:
        """Clear all rate-limit state (primarily for isolated tests)."""
        with self._lock:
            self._failures.clear()


LOGIN_RATE_LIMITER = LoginRateLimiter()

