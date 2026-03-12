from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from connection_manager import manager
from matchmaking import matchmaker
from redis_sessions import create_session, get_partner, remove_session
from redis_pubsub import start_listener, publish_message
app = FastAPI()

@app.on_event("startup")
async def startup_event():
    start_listener()
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(ws: WebSocket, user_id: str):

    await manager.connect(user_id, ws)

    matchmaker.add_user(user_id)

    user1, user2 = matchmaker.match_users()

    if user1 and user2:
        create_session(user1, user2)

    try:

        while True:

            data = await ws.receive_json()
            msg_type = data.get("type")
            partner_id = get_partner(user_id)

            partner_ws = manager.get(partner_id)

            if not partner_ws:
               continue


            # CHAT MESSAGE
            if msg_type == "chat":

                await partner_ws.send_json({
                    "type": "chat",
                    "message": data.get("message")
                })


            # TYPING EVENT
            elif msg_type == "typing":

                await partner_ws.send_json({
                    "type": "typing"
                })


            # NEXT STRANGER
            elif msg_type == "next":

                remove_session(user_id)

                matchmaker.add_user(user_id)

                user1, user2 = matchmaker.match_users()

                if user1 and user2:
                    create_session(user1, user2)

    except WebSocketDisconnect:

        manager.disconnect(user_id)

        partner_id = remove_session(user_id)

        partner_ws = manager.get(partner_id)

        if partner_ws:

            await partner_ws.send_json({
                "type": "system",
                "message": "Stranger disconnected"
            })