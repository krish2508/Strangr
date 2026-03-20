import { useState, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router";
import { Send, SkipForward, X, Zap, Circle, Video, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useChat } from "../hooks/useChat";
import { Matching } from "./Matching";

export function Chat() {
  const navigate = useNavigate();
  const location = useLocation();
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMode = location.state?.mode || "text";

  const { messages, strangerTyping, strangerConnected, isSearching, sendMessage, sendTyping, sendNext } =
    useChat("text");

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Debounced typing indicator — fire once per keypress burst
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (!strangerConnected) return;
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      sendTyping();
    }, 300);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!strangerConnected) return;
    const text = inputValue.trim();
    if (!text) return;
    sendMessage(text);
    setInputValue("");
    setTimeout(scrollToBottom, 50);
  };

  const handleSkip = () => {
    sendNext();
  };

  const handleStop = () => {
    navigate("/landing");
  };

  if (isSearching) {
    return <Matching onCancel={handleStop} />;}

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-pink-500 text-white p-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6 text-yellow-300" fill="currentColor" />
            <h1 className="text-xl font-bold">Strangr</h1>
            <div className="flex items-center gap-2 ml-4">
              {chatMode === "video" ? (
                <Video className="w-4 h-4" />
              ) : (
                <MessageCircle className="w-4 h-4" />
              )}
              <span className="text-sm">
                {chatMode === "video" ? "Video Chat" : "Text Chat"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Circle
              className={`w-3 h-3 ${
                strangerConnected ? "text-green-400" : "text-yellow-300"
              }`}
              fill="currentColor"
            />
            <span className="text-sm">
              {strangerConnected ? "Connected" : "Finding stranger..."}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 max-w-4xl mx-auto w-full flex flex-col">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  onAnimationComplete={scrollToBottom}
                  className={`flex ${
                    message.sender === "you" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                      message.sender === "you"
                        ? "bg-purple-600 text-white"
                        : message.sender === "system"
                        ? "bg-gray-200 text-gray-600 text-sm italic"
                        : "bg-white text-gray-800 shadow-sm"
                    }`}
                  >
                    <p>{message.text}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing Indicator */}
            <AnimatePresence>
              {strangerTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-white text-gray-800 rounded-2xl px-4 py-3 shadow-sm">
                    <div className="flex gap-1">
                      {[0, 0.2, 0.4].map((delay) => (
                        <motion.div
                          key={delay}
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1, repeat: Infinity, delay }}
                          className="w-2 h-2 bg-gray-500 rounded-full"
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t bg-white p-4">
            <form onSubmit={handleSendMessage} className="flex gap-3 items-center">
              <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                disabled={!strangerConnected}
                placeholder="Type a message..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={!strangerConnected || !inputValue.trim()}
                className="bg-purple-600 text-white p-3 rounded-full hover:bg-purple-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </motion.button>
            </form>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSkip}
                className="flex-1 bg-cyan-500 text-white py-3 rounded-full font-medium hover:bg-cyan-600 transition-colors flex items-center justify-center gap-2"
              >
                <SkipForward className="w-5 h-5" />
                Next Stranger
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStop}
                className="flex-1 bg-red-500 text-white py-3 rounded-full font-medium hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
              >
                <X className="w-5 h-5" />
                Stop
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
