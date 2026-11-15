"""Per-user rate limits for expensive endpoints (page fetching, Gemini calls).

In-memory sliding window: correct for a single server process (how ClipNest runs on
Render). With several instances/workers each one would count separately, so the
effective limit would multiply; move the counters to Redis if that ever happens.
"""
import math
import os
import time
from collections import defaultdict, deque

from fastapi import Depends, HTTPException, status

from app.core.auth import get_current_user


class RateLimit:
    """FastAPI dependency: ``current_user: str = Depends(RateLimit("save", 30, 60))``.
    Authenticates like get_current_user, then allows ``limit`` calls per ``window`` seconds
    per user. Set RATE_LIMITS_DISABLED=1 to turn all limits off (e.g. local testing)."""

    def __init__(self, name: str, limit: int, window_seconds: int = 60):
        self.name, self.limit, self.window = name, limit, window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def hit(self, user_id: str, now: float | None = None) -> None:
        """Record a call, or raise 429 if the user is over the limit."""
        if os.getenv("RATE_LIMITS_DISABLED") == "1":
            return
        now = time.monotonic() if now is None else now
        hits = self._hits[user_id]
        while hits and hits[0] <= now - self.window:
            hits.popleft()
        if len(hits) >= self.limit:
            retry_after = max(1, math.ceil(hits[0] + self.window - now))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many requests ({self.name}). Please wait {retry_after}s and try again.",
                headers={"Retry-After": str(retry_after)},
            )
        hits.append(now)
        if len(self._hits) > 10_000:  # drop idle users so memory stays bounded
            for uid in [u for u, h in self._hits.items() if not h or h[-1] <= now - self.window]:
                del self._hits[uid]

    async def __call__(self, current_user: str = Depends(get_current_user)) -> str:
        self.hit(current_user)
        return current_user


# Limits per user per minute.
limit_save = RateLimit("saving bookmarks", 30)
limit_pdf = RateLimit("PDF uploads", 10)
limit_metadata = RateLimit("link previews", 30)
limit_ai_search = RateLimit("AI search", 20)
limit_ai_refresh = RateLimit("AI regeneration", 20)
limit_highlights = RateLimit("saving highlights", 60)
