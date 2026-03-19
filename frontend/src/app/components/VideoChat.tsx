import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  SkipForward,
  X,
  Zap,
  Circle,
  MessageSquare,
  Send,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useChat } from "../hooks/useChat";
import { Matching } from "./Matching";

export function VideoChat() {
  const navigate = useNavigate();
  const [showChat, setShowChat] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [strangerVideo] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  const { messages, strangerTyping, strangerConnected, isSearching, sendMessage, sendTyping, sendNext } =
    useChat();

  // Debounced typing indicator
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (!strangerConnected) return;
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      sendTyping();
    }, 300);
  };

  // Start local video on mount
  useEffect(() => {
    const startVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch {
        console.log("Camera access denied or not available");
      }
    };
    startVideo();

    return () => {
      if (localVideoRef.current?.srcObject) {
        const stream = localVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!strangerConnected) return;
    const text = inputValue.trim();
    if (!text) return;
    sendMessage(text);
    setInputValue("");
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const toggleMic = () => {
    setMicEnabled((prev) => {
      if (localVideoRef.current?.srcObject) {
        const stream = localVideoRef.current.srcObject as MediaStream;
        stream.getAudioTracks().forEach((t) => (t.enabled = prev));
      }
      return !prev;
    });
  };

  const toggleVideo = () => {
    setVideoEnabled((prev) => {
      if (localVideoRef.current?.srcObject) {
        const stream = localVideoRef.current.srcObject as MediaStream;
        stream.getVideoTracks().forEach((t) => (t.enabled = prev));
      }
      return !prev;
    });
  };

  const handleSkip = () => {
    sendNext();
    if (localVideoRef.current?.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  const handleStop = () => {
    if (localVideoRef.current?.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
    navigate("/landing");
  };

  if (isSearching) {
    return <Matching onCancel={handleStop} />;}

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-pink-500 text-white p-4 shadow-lg z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6 text-yellow-300" fill="currentColor" />
            <h1 className="text-xl font-bold">Strangr</h1>
            <div className="flex items-center gap-2 ml-4">
              <Video className="w-4 h-4" />
              <span className="text-sm">Video Chat</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Circle
              className={`w-3 h-3 ${strangerConnected ? "text-green-400" : "text-yellow-300"}`}
              fill="currentColor"
            />
            <span className="text-sm">
              {strangerConnected ? "Connected" : "Finding stranger..."}
            </span>
          </div>
        </div>
      </header>

      {/* Video Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Stranger Video (Main) */}
        <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
          {strangerConnected && strangerVideo ? (
            <div className="w-full h-full relative bg-gradient-to-br from-purple-900 to-pink-900">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-32 h-32 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <span className="text-5xl">👤</span>
                  </div>
                  <p className="text-white text-xl font-medium">Stranger</p>
                  <p className="text-white/70 text-sm mt-2">Video chat in progress...</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-white">
              <VideoOff className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-xl">
                Stranger's camera is off
              </p>
            </div>
          )}

          {/* Your Video (Picture-in-Picture) */}
          <motion.div
            drag
            dragMomentum={false}
            className="absolute bottom-6 right-6 w-64 h-48 bg-gray-700 rounded-2xl overflow-hidden shadow-2xl cursor-move"
          >
            {videoEnabled ? (
              <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-800">
                <div className="text-center">
                  <VideoOff className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-white text-sm">Camera Off</p>
                </div>
              </div>
            )}
            <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm px-2 py-1 rounded text-white text-xs">
              You
            </div>
          </motion.div>
        </div>

        {/* Chat Sidebar */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 20 }}
              className="absolute right-0 top-0 bottom-0 w-96 bg-white shadow-2xl flex flex-col z-20"
            >
              {/* Chat Header */}
              <div className="bg-gradient-to-r from-purple-600 to-pink-500 text-white p-4 flex items-center justify-between">
                <h3 className="font-bold">Chat</h3>
                <button
                  onClick={() => setShowChat(false)}
                  className="hover:bg-white/20 p-2 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === "you" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        message.sender === "you"
                          ? "bg-purple-600 text-white"
                          : message.sender === "system"
                          ? "bg-gray-200 text-gray-600 text-sm italic"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      <p className="text-sm">{message.text}</p>
                    </div>
                  </div>
                ))}

                {/* Typing Indicator */}
                <AnimatePresence>
                  {strangerTyping && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex justify-start"
                    >
                      <div className="bg-gray-100 rounded-2xl px-4 py-2">
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

              {/* Chat Input */}
              <div className="border-t p-4">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    disabled={!strangerConnected}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                  <button
                    type="submit"
                    disabled={!strangerConnected || !inputValue.trim()}
                    className="bg-purple-600 text-white p-2 rounded-full hover:bg-purple-700 transition-colors disabled:bg-gray-300"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls Footer */}
      <div className="bg-gray-800 p-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {/* Left Controls */}
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleMic}
              className={`p-4 rounded-full transition-colors ${
                micEnabled ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-red-500 hover:bg-red-600 text-white"
              }`}
            >
              {micEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleVideo}
              className={`p-4 rounded-full transition-colors ${
                videoEnabled ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-red-500 hover:bg-red-600 text-white"
              }`}
            >
              {videoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowChat(!showChat)}
              className={`p-4 rounded-full transition-colors ${
                showChat ? "bg-purple-600 text-white" : "bg-gray-700 hover:bg-gray-600 text-white"
              }`}
            >
              <MessageSquare className="w-6 h-6" />
            </motion.button>
          </div>

          {/* Center Controls */}
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSkip}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-full font-medium flex items-center gap-2 transition-colors"
            >
              <SkipForward className="w-5 h-5" />
              Next
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleStop}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-full font-medium flex items-center gap-2 transition-colors"
            >
              <X className="w-5 h-5" />
              Stop
            </motion.button>
          </div>

          {/* Right Spacer */}
          <div className="w-32" />
        </div>
      </div>
    </div>
  );
}