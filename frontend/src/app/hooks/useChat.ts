import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";

export interface Message {
  id: string;
  text: string;
  sender: "you" | "stranger" | "system";
  timestamp: Date;
}

export interface MediaState {
  audioEnabled: boolean;
  videoEnabled: boolean;
}

export type ChatMode = "text" | "video";

export type CallStatus =
  | "idle"
  | "searching"
  | "matched"
  | "connecting"
  | "connected"
  | "ended"
  | "error";

export type OutgoingSignalMessage =
  | { type: "webrtc-offer"; sdp: RTCSessionDescriptionInit }
  | { type: "webrtc-answer"; sdp: RTCSessionDescriptionInit }
  | { type: "webrtc-ice-candidate"; candidate: RTCIceCandidateInit }
  | { type: "call-end"; reason: "next" | "disconnect" | "stop" };

export type IncomingSignalMessage =
  | { type: "webrtc-offer"; sdp: RTCSessionDescriptionInit; fromUserId: string }
  | { type: "webrtc-answer"; sdp: RTCSessionDescriptionInit; fromUserId: string }
  | { type: "webrtc-ice-candidate"; candidate: RTCIceCandidateInit; fromUserId: string }
  | {
      type: "call-end";
      reason: "next" | "disconnect" | "stop";
      fromUserId: string;
    };

interface UseChatReturn {
  userId: string;
  messages: Message[];
  strangerTyping: boolean;
  strangerConnected: boolean;
  isSearching: boolean;
  matchedPartnerId: string | null;
  remoteMediaState: MediaState;
  pendingSignals: IncomingSignalMessage[];
  callStatus: CallStatus;
  connectionError: string | null;
  sendMessage: (text: string) => void;
  sendTyping: () => void;
  sendNext: () => void;
  sendSignalMessage: (message: OutgoingSignalMessage) => void;
  sendMediaState: (state: MediaState) => void;
  updateCallStatus: (status: CallStatus) => void;
  consumePendingSignal: () => void;
}

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:5050";
const MAX_INTERESTS = 3;
const DEFAULT_REMOTE_MEDIA_STATE: MediaState = {
  audioEnabled: true,
  videoEnabled: true,
};

function createMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Shared WebSocket realtime hook.
 * Handles text chat, matchmaking, and WebRTC signaling on the same socket.
 */
export function useChat(mode: ChatMode = "text", interests: string[] = []): UseChatReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authRecoveryAttemptedRef = useRef(false);
  const interestParam = interests
    .map((interest) => interest.trim())
    .filter(Boolean)
    .slice(0, MAX_INTERESTS)
    .join(",");

  const [messages, setMessages] = useState<Message[]>([]);
  const [userId, setUserId] = useState("");
  const [strangerTyping, setStrangerTyping] = useState(false);
  const [strangerConnected, setStrangerConnected] = useState(false);
  const [isSearching, setIsSearching] = useState(true);
  const [matchedPartnerId, setMatchedPartnerId] = useState<string | null>(null);
  const [remoteMediaState, setRemoteMediaState] = useState<MediaState>(DEFAULT_REMOTE_MEDIA_STATE);
  const [pendingSignals, setPendingSignals] = useState<IncomingSignalMessage[]>([]);
  const [callStatus, setCallStatus] = useState<CallStatus>("searching");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [wsConnectNonce, setWsConnectNonce] = useState(0);

  const addMessage = useCallback((text: string, sender: Message["sender"]) => {
    setMessages((prev) => [
      ...prev,
      { id: createMessageId(), text, sender, timestamp: new Date() },
    ]);
  }, []);

  const resetPeerState = useCallback((nextStatus: CallStatus) => {
    setMatchedPartnerId(null);
    setRemoteMediaState(DEFAULT_REMOTE_MEDIA_STATE);
    setPendingSignals([]);
    setCallStatus(nextStatus);
  }, []);

  useEffect(() => {
    let isMounted = true;
    let ws: WebSocket | null = null;

    const connect = async () => {
      try {
        await api.getCurrentUser();
      } catch {
        if (isMounted) {
          setConnectionError("Session expired. Please log in again.");
          resetPeerState("error");
        }
        return;
      }

      const params = new URLSearchParams({ mode });
      if (interestParam) {
        params.set("interests", interestParam);
      }
      ws = new WebSocket(`${WS_URL}/ws?${params.toString()}`);
      wsRef.current = ws;

      console.info("[realtime] ws:connect", {
        mode,
        interestParam,
      });

      ws.onopen = () => {
        authRecoveryAttemptedRef.current = false;
        console.info("[realtime] ws:open", {
          mode,
        });
        setConnectionError(null);
        setStrangerConnected(false);
        setIsSearching(true);
        resetPeerState("searching");
        addMessage("Looking for a stranger to chat with...", "system");
      };

      ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as
          | {
              type: "chat";
              message: string;
            }
          | { type: "session"; userId: string }
          | { type: "typing" }
          | { type: "system"; message: string; partnerId?: string }
          | { type: "media-state"; audioEnabled: boolean; videoEnabled: boolean }
          | IncomingSignalMessage;

        if (
          data.type === "webrtc-offer" ||
          data.type === "webrtc-answer" ||
          data.type === "webrtc-ice-candidate" ||
          data.type === "call-end"
        ) {
          console.info("[realtime] ws:onmessage", {
            type: data.type,
            fromUserId: "fromUserId" in data ? data.fromUserId : undefined,
            signalCountBefore: pendingSignals.length,
          });
        }

        if (data.type === "session") {
          setUserId(data.userId);
        } else if (data.type === "chat") {
          setStrangerTyping(false);
          addMessage(data.message, "stranger");
          setStrangerConnected(true);
        } else if (data.type === "typing") {
          setStrangerConnected(true);
          setStrangerTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setStrangerTyping(false);
          }, 3000);
        } else if (data.type === "system") {
          const systemText =
            typeof data.message === "string" ? data.message : String(data.message ?? "");
          const lower = systemText.toLowerCase();
          const isDisconnect = lower.includes("disconnected");
          const isMatched = lower.includes("matched");

          console.info("[realtime] ws:system", {
            message: systemText,
            partnerId: "partnerId" in data ? data.partnerId : undefined,
            isDisconnect,
            isMatched,
          });

          if (isMatched) {
            setStrangerConnected(true);
            setIsSearching(false);
            setStrangerTyping(false);
            setMatchedPartnerId(data.partnerId ?? null);
            setRemoteMediaState(DEFAULT_REMOTE_MEDIA_STATE);
            setPendingSignals([]);
            setCallStatus("matched");
            setMessages([
              { id: createMessageId(), text: systemText, sender: "system", timestamp: new Date() },
            ]);
          } else if (isDisconnect) {
            setStrangerConnected(false);
            setIsSearching(false);
            setStrangerTyping(false);
            resetPeerState("ended");
            addMessage(systemText, "system");
          } else {
            setStrangerConnected(true);
            setStrangerTyping(false);
            addMessage(systemText, "system");
          }
        } else if (data.type === "media-state") {
          setRemoteMediaState({
            audioEnabled: Boolean(data.audioEnabled),
            videoEnabled: Boolean(data.videoEnabled),
          });
        } else {
          setPendingSignals((prev) => [
            ...prev,
            {
              ...data,
              fromUserId: data.fromUserId,
            },
          ]);

          if (data.type === "call-end") {
            setStrangerConnected(false);
            setStrangerTyping(false);
            setCallStatus("ended");
          } else {
            setCallStatus("connecting");
          }
        }
      } catch {
        // Ignore malformed realtime payloads.
      }
      };

      ws.onclose = async (event) => {
        console.info("[realtime] ws:close", {
          mode,
          code: event.code,
        });
        wsRef.current = null;
        setStrangerConnected(false);
        resetPeerState("ended");

        if (event.code === 1008 && isMounted && !authRecoveryAttemptedRef.current) {
          authRecoveryAttemptedRef.current = true;
          try {
            await api.getCurrentUser();
            if (isMounted) {
              setWsConnectNonce((prev) => prev + 1);
            }
            return;
          } catch {
            // Fall through to surfaced session error.
          }
        }

        setConnectionError("Connection closed. Please refresh the page.");
      };

      ws.onerror = () => {
        console.info("[realtime] ws:error", {
          mode,
        });
        addMessage("Connection error. Please refresh the page.", "system");
        setStrangerConnected(false);
        setConnectionError("Connection error. Please refresh the page.");
        resetPeerState("error");
      };
    };

    void connect();

    return () => {
      isMounted = false;
      console.info("[realtime] ws:cleanup", {
        mode,
      });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      ws?.close();
    };
  }, [mode, interestParam, addMessage, resetPeerState, wsConnectNonce]);

  const sendMessage = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "chat", message: text }));
      addMessage(text, "you");
    }
  }, [addMessage]);

  const sendTyping = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing" }));
    }
  }, []);

  const sendNext = useCallback(() => {
    console.info("[realtime] ws:send", {
      type: "next",
    });
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "next" }));
    }

    setStrangerConnected(false);
    setIsSearching(true);
    setStrangerTyping(false);
    resetPeerState("searching");
    setMessages([]);
    addMessage("Searching for a new stranger...", "system");
  }, [addMessage, resetPeerState]);

  const sendSignalMessage = useCallback((message: OutgoingSignalMessage) => {
    console.info("[realtime] ws:send", {
      type: message.type,
      reason: "reason" in message ? message.reason : undefined,
    });
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const sendMediaState = useCallback((state: MediaState) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "media-state",
        audioEnabled: state.audioEnabled,
        videoEnabled: state.videoEnabled,
      }));
    }
  }, []);

  const updateCallStatus = useCallback((status: CallStatus) => {
    setCallStatus(status);
  }, []);

  const consumePendingSignal = useCallback(() => {
    setPendingSignals((prev) => prev.slice(1));
  }, []);

  return {
    userId,
    messages,
    strangerTyping,
    strangerConnected,
    isSearching,
    matchedPartnerId,
    remoteMediaState,
    pendingSignals,
    callStatus,
    connectionError,
    sendMessage,
    sendTyping,
    sendNext,
    sendSignalMessage,
    sendMediaState,
    updateCallStatus,
    consumePendingSignal,
  };
}
