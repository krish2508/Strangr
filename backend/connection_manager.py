import logging
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages active WebSocket connections keyed by user_id."""

    def __init__(self) -> None:
        self.connections: dict[str, WebSocket] = {}

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        """Accept and register a new WebSocket connection."""
        await websocket.accept()
        self.connections[user_id] = websocket
        logger.info(f"WebSocket connected: {user_id} (total active: {len(self.connections)})")

    def disconnect(self, user_id: str) -> None:
        """Remove a WebSocket connection."""
        self.connections.pop(user_id, None)
        logger.info(f"WebSocket disconnected: {user_id} (total active: {len(self.connections)})")

    def get(self, user_id: str) -> WebSocket | None:
        """Return the WebSocket for a user, or None if not connected."""
        return self.connections.get(user_id)


manager = ConnectionManager()