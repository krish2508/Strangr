import redis
import json
import threading

from connection_manager import manager

redis_client = redis.Redis(host="localhost", port=6379, decode_responses=True)

CHANNEL = "chat_messages"


def publish_message(data):

    redis_client.publish(CHANNEL, json.dumps(data))


def listen_for_messages():

    pubsub = redis_client.pubsub()

    pubsub.subscribe(CHANNEL)

    for message in pubsub.listen():

        if message["type"] == "message":

            data = json.loads(message["data"])

            user_id = data.get("to")

            ws = manager.get(user_id)

            if ws:

                import asyncio

                asyncio.run(ws.send_json(data))


def start_listener():

    thread = threading.Thread(target=listen_for_messages)

    thread.daemon = True
    thread.start()