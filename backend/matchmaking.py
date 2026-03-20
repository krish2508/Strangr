import logging
import threading
from collections import deque

logger = logging.getLogger(__name__)


class MatchmakingQueue:
    """Thread-safe FIFO queues for pairing users by chat mode."""

    def __init__(self) -> None:
        self._queues: dict[str, deque[str]] = {
            "text": deque(),
            "video": deque(),
        }
        self._lock = threading.Lock()

    def _get_queue(self, mode: str) -> deque[str]:
        return self._queues.setdefault(mode, deque())

    def add_user(self, user_id: str, mode: str) -> None:
        """Add a user to the mode-specific queue if not already present."""
        with self._lock:
            queue = self._get_queue(mode)
            if user_id not in queue:
                queue.append(user_id)
                logger.debug(
                    "User added to %s matchmaking queue: %s (queue size: %s)",
                    mode,
                    user_id,
                    len(queue),
                )

    def remove_user(self, user_id: str, mode: str | None = None) -> None:
        """Remove a specific user from one queue or all queues."""
        with self._lock:
            queue_modes = [mode] if mode else list(self._queues.keys())
            for queue_mode in queue_modes:
                queue = self._get_queue(queue_mode)
                try:
                    queue.remove(user_id)
                    logger.debug("User removed from %s matchmaking queue: %s", queue_mode, user_id)
                except ValueError:
                    pass  # user wasn't in queue, that's fine

    def match_users(self, mode: str) -> tuple[str | None, str | None]:
        """Dequeue and return two users from the same mode queue, or (None, None)."""
        with self._lock:
            queue = self._get_queue(mode)
            if len(queue) >= 2:
                user1 = queue.popleft()
                user2 = queue.popleft()
                logger.info("Matched %s users: %s <-> %s", mode, user1, user2)
                return user1, user2
        return None, None


matchmaker = MatchmakingQueue()
