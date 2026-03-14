import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router";
import { Send, SkipForward, X, Zap, Circle, Video, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Message {
  id: string;
  text: string;
  sender: "you" | "stranger";
  timestamp: Date;
}

// Simulated stranger responses
const STRANGER_RESPONSES = [
  "Hey! How's it going?",
  "Nice to meet you!",
  "Where are you from?",
  "What do you like to do for fun?",
  "That's interesting!",
  "Tell me more about that",
  "I agree!",
  "Haha that's funny",
  "What kind of music do you like?",
  "Do you have any hobbies?",
  "That's cool!",
  "I've never thought about it that way",
  "What's your favorite movie?",
  "Same here!",
  "Really? That's amazing!",
  "I love that too!",
  "What brings you here?",
  "This is fun!",
  "You seem interesting",
  "Got any plans for the weekend?"
];

export function Chat() {
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [strangerTyping, setStrangerTyping] = useState(false);
  const [strangerConnected, setStrangerConnected] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMode = location.state?.mode || "text";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initial stranger message
    const timer = setTimeout(() => {
      setStrangerTyping(true);
      setTimeout(() => {
        setStrangerTyping(false);
        setMessages([
          {
            id: Date.now().toString(),
            text: "You're now chatting with a random stranger. Say hi!",
            sender: "stranger",
            timestamp: new Date(),
          },
        ]);
      }, 1500);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const simulateStrangerResponse = () => {
    // Random delay between 2-5 seconds
    const delay = Math.random() * 3000 + 2000;

    setTimeout(() => {
      setStrangerTyping(true);

      // Random typing duration 1-3 seconds
      const typingDuration = Math.random() * 2000 + 1000;

      setTimeout(() => {
        setStrangerTyping(false);
        const response =
          STRANGER_RESPONSES[
            Math.floor(Math.random() * STRANGER_RESPONSES.length)
          ];

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            text: response,
            sender: "stranger",
            timestamp: new Date(),
          },
        ]);
      }, typingDuration);
    }, delay);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !strangerConnected) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: "you",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputValue("");

    // Simulate stranger response
    simulateStrangerResponse();
  };

  const handleSkip = () => {
    setStrangerConnected(false);
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        text: "Stranger has disconnected.",
        sender: "stranger",
        timestamp: new Date(),
      },
    ]);

    setTimeout(() => {
      navigate("/matching", { state: location.state });
    }, 1500);
  };

  const handleStop = () => {
    navigate("/");
  };

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
                strangerConnected ? "text-green-400" : "text-red-400"
              }`}
              fill="currentColor"
            />
            <span className="text-sm">
              {strangerConnected ? "Connected" : "Disconnected"}
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
                  className={`flex ${
                    message.sender === "you" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                      message.sender === "you"
                        ? "bg-purple-600 text-white"
                        : message.text.includes("disconnected") ||
                          message.text.includes("chatting with")
                        ? "bg-gray-300 text-gray-700 text-sm italic"
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
                      <motion.div
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          delay: 0,
                        }}
                        className="w-2 h-2 bg-gray-500 rounded-full"
                      />
                      <motion.div
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          delay: 0.2,
                        }}
                        className="w-2 h-2 bg-gray-500 rounded-full"
                      />
                      <motion.div
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          delay: 0.4,
                        }}
                        className="w-2 h-2 bg-gray-500 rounded-full"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t bg-white p-4">
            <form
              onSubmit={handleSendMessage}
              className="flex gap-3 items-center"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  strangerConnected
                    ? "Type a message..."
                    : "Stranger disconnected"
                }
                disabled={!strangerConnected}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-600 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={!inputValue.trim() || !strangerConnected}
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