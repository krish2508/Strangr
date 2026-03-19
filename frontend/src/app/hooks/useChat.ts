import { useCallback, useEffect, useRef, useState } from "react";
import { useUserId } from "./useUserId";

export interface Message {
  id: string;
  text: string;
  sender: "you" | "stranger" | "system";
  timestamp: Date;
}

interface UseChatReturn {
  messages: Message[];
  strangerTyping: boolean;
  strangerConnected: boolean;
  isSearching: boolean;
  sendMessage: (text: string) => void;
  sendTyping: () => void;
  sendNext: () => void;
}

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:5050";

/**
 * Shared WebSocket chat hook.
 * Manages the full WebSocket lifecycle and exposes a clean API
 * for Chat and VideoChat to consume.
 */
export function useChat(): UseChatReturn {
  const userId = useUserId();
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [strangerTyping, setStrangerTyping] = useState(false);
  const [strangerConnected, setStrangerConnected] = useState(false);
  const [isSearching, setIsSearching] = useState(true);

  const addMessage = useCallback(
    (text: string, sender: Message["sender"]) => {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), text, sender, timestamp: new Date() },
      ]);
    },
    []
  );

  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/ws/${userId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setStrangerConnected(false); // will become true on match
      setIsSearching(true);
      addMessage("Looking for a stranger to chat with...", "system");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "chat") {
          setStrangerTyping(false);
          addMessage(data.message, "stranger");
          // Mark as connected when first real message arrives
          setStrangerConnected(true);
        } else if (data.type === "typing") {
          setStrangerConnected(true);
          setStrangerTyping(true);
          // Auto-clear the typing indicator after 3s of silence
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
            // Start fresh for a new match (prevents old "disconnected" from showing after match).
            setMessages([
              { id: crypto.randomUUID(), text: systemText, sender: "system", timestamp: new Date() },
            ]);
          } else if (isDisconnect) {
            setStrangerConnected(false);
            setIsSearching(false);
            setStrangerTyping(false);
            addMessage(systemText, "system");
          } else {
            // Other system messages (e.g. matched/unknown) mean the stranger is here.
            setStrangerConnected(true);
            setStrangerTyping(false);
            addMessage(systemText, "system");
          }
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setStrangerConnected(false);
    };

    ws.onerror = () => {
      addMessage("Connection error. Please refresh the page.", "system");
      setStrangerConnected(false);
    };

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      ws.close();
    };
  }, [userId, addMessage]);

  const sendMessage = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "chat", message: text }));
      // Add own message to local state immediately (backend only forwards to partner)
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
    setMessages([]);
    addMessage("Searching for a new stranger...", "system");
  }, [addMessage]);

  return { messages, strangerTyping, strangerConnected, isSearching, sendMessage, sendTyping, sendNext };
}
