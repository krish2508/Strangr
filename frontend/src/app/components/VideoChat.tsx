import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router";
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

interface Message {
  id: string;
  text: string;
  sender: "you" | "stranger";
  timestamp: Date;
}

const STRANGER_RESPONSES = [
  "Hey! Nice to see you!",
  "Hello there!",
  "How are you doing?",
  "Cool setup!",
  "Where are you from?",
  "This is fun!",
  "What's up?",
  "Nice to meet you!",
  "How's your day going?",
  "What do you like to do?",
];

export function VideoChat() {
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [strangerConnected, setStrangerConnected] = useState(true);
  const [strangerVideo, setStrangerVideo] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Start local video stream
    const startVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.log("Camera access denied or not available - using placeholder");
      }
    };

    startVideo();

    // Initial stranger message
    const timer = setTimeout(() => {
      setMessages([
        {
          id: Date.now().toString(),
          text: "Stranger has joined the video chat!",
          sender: "stranger",
          timestamp: new Date(),
        },
      ]);
    }, 1000);

    return () => {
      clearTimeout(timer);
      // Cleanup video stream
      if (localVideoRef.current?.srcObject) {
        const stream = localVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    setTimeout(() => {
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
    }, 2000 + Math.random() * 2000);
  };

  const toggleMic = () => {
    setMicEnabled(!micEnabled);
    if (localVideoRef.current?.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !micEnabled;
      });
    }
  };

  const toggleVideo = () => {
    setVideoEnabled(!videoEnabled);
    if (localVideoRef.current?.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !videoEnabled;
      });
    }
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

    // Clean up video stream before navigating
    if (localVideoRef.current?.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }

    setTimeout(() => {
      navigate("/matching", { state: { ...location.state, mode: "video" } });
    }, 1500);
  };

  const handleStop = () => {
    if (localVideoRef.current?.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
    navigate("/landing");
  };

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

      {/* Video Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Stranger Video (Main) */}
        <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
          {strangerConnected && strangerVideo ? (
            <div className="w-full h-full relative bg-gradient-to-br from-purple-900 to-pink-900">
              {/* Simulated stranger video - you can replace with actual video element */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-32 h-32 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <span className="text-5xl">👤</span>
                  </div>
                  <p className="text-white text-xl font-medium">Stranger</p>
                  <p className="text-white/70 text-sm mt-2">
                    Video chat in progress...
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-white">
              <VideoOff className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-xl">
                {strangerConnected
                  ? "Stranger's camera is off"
                  : "Waiting for stranger..."}
              </p>
            </div>
          )}

          {/* Your Video (Picture-in-Picture) */}
          <motion.div
            drag
            dragMOmentum={false}
            className="absolute bottom-6 right-6 w-64 h-48 bg-gray-700 rounded-2xl overflow-hidden shadow-2xl cursor-move"
          >
            {videoEnabled ? (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
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
                    className={`flex ${
                      message.sender === "you" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        message.sender === "you"
                          ? "bg-purple-600 text-white"
                          : message.text.includes("joined") ||
                            message.text.includes("disconnected")
                          ? "bg-gray-200 text-gray-700 text-sm italic"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      <p className="text-sm">{message.text}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <div className="border-t p-4">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Type a message..."
                    disabled={!strangerConnected}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-600 disabled:bg-gray-100"
                  />
                  <button
                    type="submit"
                    disabled={!inputValue.trim() || !strangerConnected}
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
                micEnabled
                  ? "bg-gray-700 hover:bg-gray-600 text-white"
                  : "bg-red-500 hover:bg-red-600 text-white"
              }`}
            >
              {micEnabled ? (
                <Mic className="w-6 h-6" />
              ) : (
                <MicOff className="w-6 h-6" />
              )}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleVideo}
              className={`p-4 rounded-full transition-colors ${
                videoEnabled
                  ? "bg-gray-700 hover:bg-gray-600 text-white"
                  : "bg-red-500 hover:bg-red-600 text-white"
              }`}
            >
              {videoEnabled ? (
                <Video className="w-6 h-6" />
              ) : (
                <VideoOff className="w-6 h-6" />
              )}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowChat(!showChat)}
              className={`p-4 rounded-full transition-colors ${
                showChat
                  ? "bg-purple-600 text-white"
                  : "bg-gray-700 hover:bg-gray-600 text-white"
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
          <div className="w-32"></div>
        </div>
      </div>
    </div>
  );
}