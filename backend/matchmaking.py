from __future__ import annotations

import logging
import threading
from collections import deque
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class QueuedUser:
    user_id: str
    interests: frozenset[str]


class MatchmakingQueue:
    """Thread-safe queues for pairing users by chat mode and shared interests."""

    def __init__(self) -> None:
        self._queues: dict[str, deque[QueuedUser]] = {
            "text": deque(),
            "video": deque(),
        }
        self._lock = threading.Lock()

    def _get_queue(self, mode: str) -> deque[QueuedUser]:
        return self._queues.setdefault(mode, deque())

    def match_or_enqueue(
        self,
        user_id: str,
        mode: str,
        interests: set[str] | frozenset[str] | None = None,
    ) -> tuple[str | None, str | None]:
        """Match a user with the best waiting user, or enqueue if nobody is waiting."""
        with self._lock:
            queue = self._get_queue(mode)
            user_interests = frozenset(interests or set())

            for queued_user in queue:
                if queued_user.user_id == user_id:
                    logger.debug("User already waiting in %s matchmaking queue: %s", mode, user_id)
                    return None, None

            if not queue:
                queue.append(QueuedUser(user_id=user_id, interests=user_interests))
                logger.debug("User added to empty %s matchmaking queue: %s", mode, user_id)
                return None, None

            best_index = 0
            best_score = -1
            for index, queued_user in enumerate(queue):
                score = len(user_interests & queued_user.interests)
                if score > best_score:
                    best_index = index
                    best_score = score

            matched_user = queue[best_index]
            del queue[best_index]
            logger.info(
                "Matched %s users: %s <-> %s (shared interests: %s)",
                mode,
                user_id,
                matched_user.user_id,
                best_score,
            )
            return user_id, matched_user.user_id

    def remove_user(self, user_id: str, mode: str | None = None) -> None:
        """Remove a specific user from one queue or all queues."""
        with self._lock:
            queue_modes = [mode] if mode else list(self._queues.keys())
            for queue_mode in queue_modes:
                queue = self._get_queue(queue_mode)
                for queued_user in list(queue):
                    if queued_user.user_id == user_id:
                        queue.remove(queued_user)
                        logger.debug("User removed from %s matchmaking queue: %s", queue_mode, user_id)
                        break


matchmaker = MatchmakingQueue()
