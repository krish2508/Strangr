import logging
from redis_service import redis_client

logger = logging.getLogger(__name__)

SESSION_PREFIX = "session:"


def create_session(user1: str, user2: str) -> None:
    """Create a bidirectional session mapping between two users in Redis."""
    try:
        redis_client.set(SESSION_PREFIX + user1, user2)
        redis_client.set(SESSION_PREFIX + user2, user1)
        logger.info(f"Session created: {user1} <-> {user2}")
    except Exception as e:
        logger.error(f"Failed to create session for {user1} <-> {user2}: {e}")


def get_partner(user: str) -> str | None:
    """Return the partner's user_id for the given user, or None."""
    try:
        return redis_client.get(SESSION_PREFIX + user)
    except Exception as e:
        logger.error(f"Failed to get partner for {user}: {e}")
        return None


def remove_session(user: str) -> str | None:
    """Remove session for a user and their partner. Returns the partner's ID."""
    try:
        partner = redis_client.get(SESSION_PREFIX + user)
        if partner:
            redis_client.delete(SESSION_PREFIX + user)
            redis_client.delete(SESSION_PREFIX + partner)
            logger.info(f"Session removed: {user} <-> {partner}")
        return partner
    except Exception as e:
        logger.error(f"Failed to remove session for {user}: {e}")
        return None