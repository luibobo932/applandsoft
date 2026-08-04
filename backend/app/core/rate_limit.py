"""Rate limiter sliding-window trong bo nho, dung chong brute-force o /auth/login.

Du cho 1 instance (Render free plan). Neu chay nhieu worker/instance thi moi tien trinh
giu bo dem rieng; khi can chinh xac tuyet doi nen chuyen sang Redis, nhung o quy mo hien tai
gioi han theo tien trinh da du de chan do mat khau.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque


class SlidingWindowRateLimiter:
    def __init__(self, max_attempts: int, window_seconds: float) -> None:
        self.max_attempts = max(int(max_attempts), 1)
        self.window_seconds = float(window_seconds)
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def hit(self, key: str) -> float | None:
        """Ghi nhan mot lan thu cho `key`.

        Tra ve None neu con trong han muc (da ghi nhan), hoac so giay can cho neu vuot han muc
        (khong ghi them lan nay).
        """
        now = time.monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] <= cutoff:
                hits.popleft()
            if len(hits) >= self.max_attempts:
                retry_after = self.window_seconds - (now - hits[0])
                return max(retry_after, 0.0)
            hits.append(now)
            return None

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()
