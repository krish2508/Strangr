import logging
import threading
from collections import deque

logger = logging.getLogger(__name__)


class MatchmakingQueue:
    """Thread-safe FIFO queue for pairing users."""

    def __init__(self) -> None:
        self._queue: deque[str] = deque()
        self._lock = threading.Lock()

    def add_user(self, user_id: str) -> None:
        """Add a user to the queue if not already present."""
        with self._lock:
            if user_id not in self._queue:
                self._queue.append(user_id)
                logger.debug(f"User added to matchmaking queue: {user_id} (queue size: {len(self._queue)})")

    def remove_user(self, user_id: str) -> None:
        """Remove a specific user from the queue."""
        with self._lock:
            try:
                self._queue.remove(user_id)
                logger.debug(f"User removed from matchmaking queue: {user_id}")
            except ValueError:
                pass  # user wasn't in queue, that's fine

    def match_users(self) -> tuple[str | None, str | None]:
        """Dequeue and return two users to be matched, or (None, None)."""
        with self._lock:
            if len(self._queue) >= 2:
                user1 = self._queue.popleft()
                user2 = self._queue.popleft()
                logger.info(f"Matched users: {user1} <-> {user2}")
                return user1, user2
        return None, None


matchmaker = MatchmakingQueue()