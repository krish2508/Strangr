import { useCallback, useEffect, useRef, useState } from "react";
import { useUserId } from "./useUserId";

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
  latestSignal: IncomingSignalMessage | null;
  callStatus: CallStatus;
  connectionError: string | null;
  sendMessage: (text: string) => void;
  sendTyping: () => void;
  sendNext: () => void;
  sendSignalMessage: (message: OutgoingSignalMessage) => void;
  sendMediaState: (state: MediaState) => void;
  updateCallStatus: (status: CallStatus) => void;
}

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:5050";
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
export function useChat(mode: ChatMode = "text"): UseChatReturn {
  const userId = useUserId();
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [strangerTyping, setStrangerTyping] = useState(false);
  const [strangerConnected, setStrangerConnected] = useState(false);
  const [isSearching, setIsSearching] = useState(true);
  const [matchedPartnerId, setMatchedPartnerId] = useState<string | null>(null);
  const [remoteMediaState, setRemoteMediaState] = useState<MediaState>(DEFAULT_REMOTE_MEDIA_STATE);
  const [latestSignal, setLatestSignal] = useState<IncomingSignalMessage | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>("searching");
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const addMessage = useCallback((text: string, sender: Message["sender"]) => {
    setMessages((prev) => [
      ...prev,
      { id: createMessageId(), text, sender, timestamp: new Date() },
    ]);
  }, []);

  const resetPeerState = useCallback((nextStatus: CallStatus) => {
    setMatchedPartnerId(null);
    setRemoteMediaState(DEFAULT_REMOTE_MEDIA_STATE);
    setLatestSignal(null);
    setCallStatus(nextStatus);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ mode });
    const ws = new WebSocket(`${WS_URL}/ws/${userId}?${params.toString()}`);
    wsRef.current = ws;

    ws.onopen = () => {
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
          | { type: "typing" }
          | { type: "system"; message: string; partnerId?: string }
          | { type: "media-state"; audioEnabled: boolean; videoEnabled: boolean }
          | IncomingSignalMessage;

        if (data.type === "chat") {
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

          if (isMatched) {
            setStrangerConnected(true);
            setIsSearching(false);
            setStrangerTyping(false);
            setMatchedPartnerId(data.partnerId ?? null);
            setRemoteMediaState(DEFAULT_REMOTE_MEDIA_STATE);
            setLatestSignal(null);
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
          setLatestSignal({
            ...data,
            fromUserId: data.fromUserId,
          });

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

    ws.onclose = () => {
      setStrangerConnected(false);
      setConnectionError("Connection closed. Please refresh the page.");
      resetPeerState("ended");
    };

    ws.onerror = () => {
      addMessage("Connection error. Please refresh the page.", "system");
      setStrangerConnected(false);
      setConnectionError("Connection error. Please refresh the page.");
      resetPeerState("error");
    };

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      ws.close();
    };
  }, [userId, mode, addMessage, resetPeerState]);

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

  return {
    userId,
    messages,
    strangerTyping,
    strangerConnected,
    isSearching,
    matchedPartnerId,
    remoteMediaState,
    latestSignal,
    callStatus,
    connectionError,
    sendMessage,
    sendTyping,
    sendNext,
    sendSignalMessage,
    sendMediaState,
    updateCallStatus,
  };
}
