import logging
import logging.config
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from connection_manager import manager
from matchmaking import matchmaker
from redis_sessions import create_session, get_partner, remove_session
from redis_pubsub import start_listener

from database import engine, Base
from routes import auth_routes

# ---------------------------------------------------------------------------
# Logging configuration
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

WEBRTC_SIGNAL_TYPES = {
    "webrtc-offer",
    "webrtc-answer",
    "webrtc-ice-candidate",
    "media-state",
    "call-end",
}
VALID_CHAT_MODES = {"text", "video"}


async def notify_matched_users(user1: str, user2: str) -> None:
    """Send a match notification with partner IDs for WebRTC negotiation."""
    ws1 = manager.get(user1)
    ws2 = manager.get(user2)

    if ws1:
        await ws1.send_json({
            "type": "system",
            "message": "Matched with a stranger",
            "partnerId": user2,
        })

    if ws2:
        await ws2.send_json({
            "type": "system",
            "message": "Matched with a stranger",
            "partnerId": user1,
        })




# ---------------------------------------------------------------------------
# Application lifespan (replaces deprecated @app.on_event)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown logic for the FastAPI application."""
    # --- Startup ---
    logger.info("Application starting up...")
    start_listener()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables verified / created")
    logger.info("Application ready to accept requests")

    yield  # Application runs here

    # --- Shutdown ---
    logger.info("Application shutting down...")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Strangr API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(ws: WebSocket, user_id: str, mode: str = Query(default="text")):
    chat_mode = mode if mode in VALID_CHAT_MODES else "text"
    await manager.connect(user_id, ws)
    matchmaker.add_user(user_id, chat_mode)

    user1, user2 = matchmaker.match_users(chat_mode)
    if user1 and user2:
        create_session(user1, user2)
        await notify_matched_users(user1, user2)


    try:
        while True:
            data = await ws.receive_json()
            msg_type = data.get("type")

            # "next" should still work even if we no longer have a partner session
            # mapping (because the other side already clicked "next" and removed the mapping).
            if msg_type == "next":
                partner_id = get_partner(user_id)
                partner_ws = manager.get(partner_id) if partner_id else None

                # If we still have a partner connection, tell them we disconnected
                # before removing our session mapping.
                if partner_ws:
                    try:
                        await partner_ws.send_json({
                            "type": "call-end",
                            "reason": "next",
                            "fromUserId": user_id,
                        })
                        await partner_ws.send_json({
                            "type": "system",
                            "message": "Stranger disconnected",
                        })
                    except Exception:
                        pass


                remove_session(user_id)
                matchmaker.add_user(user_id, chat_mode)

                user1, user2 = matchmaker.match_users(chat_mode)
                if user1 and user2:
                    create_session(user1, user2)
                    await notify_matched_users(user1, user2)


            else:
                # For chat/typing we need a partner mapping.
                partner_id = get_partner(user_id)
                if not partner_id:
                    continue

                partner_ws = manager.get(partner_id)
                if not partner_ws:
                    continue

                if msg_type == "chat":
                    await partner_ws.send_json({
                        "type": "chat",
                        "message": data.get("message"),
                    })
                elif msg_type == "typing":
                    await partner_ws.send_json({"type": "typing"})
                elif msg_type in WEBRTC_SIGNAL_TYPES:
                    await partner_ws.send_json({
                        **data,
                        "fromUserId": user_id,
                    })
                else:
                    logger.warning(f"Unknown message type '{msg_type}' from user {user_id}")

    except WebSocketDisconnect:
        manager.disconnect(user_id)
        matchmaker.remove_user(user_id, chat_mode)
        partner_id = remove_session(user_id)

        if partner_id:
            partner_ws = manager.get(partner_id)
            if partner_ws:
                try:
                    await partner_ws.send_json({
                        "type": "call-end",
                        "reason": "disconnect",
                        "fromUserId": user_id,
                    })
                    await partner_ws.send_json({
                        "type": "system",
                        "message": "Stranger disconnected",
                    })
                except Exception:
                    pass  # Partner may have already disconnected


    except Exception as e:
        logger.error(f"Unexpected WebSocket error for user {user_id}: {e}")
        manager.disconnect(user_id)
        matchmaker.remove_user(user_id, chat_mode)
        partner_id = remove_session(user_id)
        if partner_id:
            partner_ws = manager.get(partner_id)
            if partner_ws:
                try:
                    await partner_ws.send_json({
                        "type": "call-end",
                        "reason": "disconnect",
                        "fromUserId": user_id,
                    })
                    await partner_ws.send_json({
                        "type": "system",
                        "message": "Stranger disconnected",
                    })
                except Exception:
                    pass
