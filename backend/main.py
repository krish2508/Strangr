import logging
import logging.config
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
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

# ---------------------------------------------------------------------------
# Debug instrumentation (NDJSON)
# ---------------------------------------------------------------------------
import json
import time

# Debug session log file (inside repo/workspace)
DEBUG_LOG_PATH = r"d:\coding stuff\strangr\debug-341329.log"


def _debug_ndjson(
    hypothesisId: str,
    location: str,
    message: str,
    data: dict | None = None,
) -> None:
    try:
        payload = {
            "sessionId": "341329",
            "runId": "pre-fix",
            "hypothesisId": hypothesisId,
            "location": location,
            "message": message,
            "data": data or {},
            "timestamp": int(time.time() * 1000),
        }
        log_id = f"log_{time.time_ns()}"
        payload["id"] = log_id
        with open(DEBUG_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=False) + "\n")
    except Exception:
        # Never break prod behavior due to debug logging.
        pass


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
async def websocket_endpoint(ws: WebSocket, user_id: str):
    await manager.connect(user_id, ws)
    matchmaker.add_user(user_id)

    user1, user2 = matchmaker.match_users()
    if user1 and user2:
        create_session(user1, user2)
        # Notify both matched users immediately.
        # Frontend uses system messages to flip `strangerConnected` to true.
        ws1 = manager.get(user1)
        ws2 = manager.get(user2)
        if ws1:
            await ws1.send_json({"type": "system", "message": "Matched with a stranger"})
        if ws2:
            await ws2.send_json({"type": "system", "message": "Matched with a stranger"})
        _debug_ndjson(
            hypothesisId="H1",
            location="backend/main.py:match_init_send_matched",
            message="matched_initial",
            data={"user1": user1, "user2": user2},
        )

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
                            "type": "system",
                            "message": "Stranger disconnected",
                        })
                    except Exception:
                        pass
                _debug_ndjson(
                    hypothesisId="H2",
                    location="backend/main.py:next_send_stranger_disconnected",
                    message="stranger_disconnected_to_partner",
                    data={"from_user": user_id, "partner_id": partner_id},
                )

                remove_session(user_id)
                matchmaker.add_user(user_id)

                user1, user2 = matchmaker.match_users()
                if user1 and user2:
                    create_session(user1, user2)
                    ws1 = manager.get(user1)
                    ws2 = manager.get(user2)
                    if ws1:
                        await ws1.send_json({"type": "system", "message": "Matched with a stranger"})
                    if ws2:
                        await ws2.send_json({"type": "system", "message": "Matched with a stranger"})
                    _debug_ndjson(
                        hypothesisId="H3",
                        location="backend/main.py:next_send_matched",
                        message="matched_after_next",
                        data={"user1": user1, "user2": user2, "trigger_user": user_id},
                    )

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
                else:
                    logger.warning(f"Unknown message type '{msg_type}' from user {user_id}")

    except WebSocketDisconnect:
        manager.disconnect(user_id)
        partner_id = remove_session(user_id)

        if partner_id:
            partner_ws = manager.get(partner_id)
            if partner_ws:
                try:
                    await partner_ws.send_json({
                        "type": "system",
                        "message": "Stranger disconnected",
                    })
                except Exception:
                    pass  # Partner may have already disconnected
                _debug_ndjson(
                    hypothesisId="H4",
                    location="backend/main.py:disconnect_send_stranger_disconnected",
                    message="stranger_disconnected_to_partner_on_disconnect",
                    data={"from_user": user_id, "partner_id": partner_id},
                )

    except Exception as e:
        logger.error(f"Unexpected WebSocket error for user {user_id}: {e}")
        manager.disconnect(user_id)
        remove_session(user_id)