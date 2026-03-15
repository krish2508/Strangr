import asyncio
import json
import logging
import threading

import redis
from connection_manager import manager
from redis_service import redis_client

logger = logging.getLogger(__name__)

CHANNEL = "chat_messages"


def publish_message(data: dict) -> None:
    """Publish a chat message to the Redis pub/sub channel."""
    try:
        redis_client.publish(CHANNEL, json.dumps(data))
        logger.debug(f"Message published to channel '{CHANNEL}': type={data.get('type')}")
    except Exception as e:
        logger.error(f"Failed to publish message to Redis: {e}")


def _run_async_send(coro) -> None:
    """Run an async coroutine from a synchronous background thread safely."""
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(coro)
    except Exception as e:
        logger.error(f"Error sending WebSocket message from pub/sub listener: {e}")
    finally:
        loop.close()


def listen_for_messages() -> None:
    """Background thread: subscribe to Redis and forward messages to WebSocket clients."""
    try:
        pubsub = redis_client.pubsub()
        pubsub.subscribe(CHANNEL)
        logger.info(f"Redis pub/sub listener started on channel '{CHANNEL}'")

        for message in pubsub.listen():
            if message["type"] != "message":
                continue
            try:
                data = json.loads(message["data"])
                user_id = data.get("to")
                ws = manager.get(user_id)
                if ws:
                    _run_async_send(ws.send_json(data))
            except Exception as e:
                logger.error(f"Error processing pub/sub message: {e}")
    except redis.ConnectionError as e:
        logger.critical(f"Redis pub/sub connection lost: {e}")


def start_listener() -> None:
    """Start the Redis pub/sub listener in a daemon background thread."""
    thread = threading.Thread(target=listen_for_messages, daemon=True, name="redis-pubsub-listener")
    thread.start()
    logger.info("Redis pub/sub listener thread started")