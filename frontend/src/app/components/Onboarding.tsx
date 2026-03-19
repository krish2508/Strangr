import { useState } from "react";
import { useNavigate } from "react-router";
import { MessageCircle, Video, Zap, ArrowRight, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const INTERESTS = [
  "Music", "Gaming", "Sports", "Movies", "Art", "Technology",
  "Travel", "Food", "Fashion", "Photography", "Books", "Fitness",
  "Coding", "Anime", "Science", "Dancing", "Cooking", "Pets"
];

export function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [chatMode, setChatMode] = useState<"text" | "video" | null>(null);

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const handleStart = () => {
    const route = chatMode === "video" ? "/video-chat" : "/chat";
    navigate(route, { state: { interests: selectedInterests, mode: chatMode } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 flex flex-col">
      {/* Header */}
      <header className="p-6">
        <div className="flex items-center gap-2">
          <Zap className="w-8 h-8 text-yellow-300" fill="currentColor" />
          <h1 className="text-3xl font-bold text-white">Strangr</h1>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="px-6 mb-8">
        <div className="max-w-md mx-auto bg-white/20 rounded-full h-2 overflow-hidden">
          <motion.div
            className="bg-yellow-300 h-full"
            initial={{ width: 0 }}
            animate={{ width: step === 1 ? "33%" : step === 2 ? "66%" : "100%" }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 pb-12">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full max-w-2xl"
            >
              <h2 className="text-4xl font-bold text-white mb-4 text-center">
                Select Your Interests
              </h2>
              <p className="text-white/90 text-center mb-8">
                Choose topics you'd like to talk about (optional)
              </p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
                {INTERESTS.map((interest) => (
                  <motion.button
                    key={interest}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleInterest(interest)}
                    className={`py-3 px-4 rounded-xl font-medium transition-all ${
                      selectedInterests.includes(interest)
                        ? "bg-yellow-300 text-purple-700"
                        : "bg-white/20 text-white hover:bg-white/30"
                    }`}
                  >
                    {interest}
                  </motion.button>
                ))}
              </div>

              <div className="flex gap-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate("/")}
                  className="flex-1 bg-white/20 text-white py-4 rounded-full font-bold hover:bg-white/30 transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setStep(2)}
                  className="flex-1 bg-white text-purple-600 py-4 rounded-full font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full max-w-2xl"
            >
              <h2 className="text-4xl font-bold text-white mb-4 text-center">
                Choose Chat Mode
              </h2>
              <p className="text-white/90 text-center mb-8">
                How would you like to connect?
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setChatMode("text")}
                  className={`p-8 rounded-2xl transition-all ${
                    chatMode === "text"
                      ? "bg-yellow-300 text-purple-700"
                      : "bg-white/20 text-white hover:bg-white/30"
                  }`}
                >
                  <MessageCircle className="w-16 h-16 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold mb-2">Text Chat</h3>
                  <p className={chatMode === "text" ? "text-purple-700/80" : "text-white/80"}>
                    Anonymous messaging with strangers
                  </p>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setChatMode("video")}
                  className={`p-8 rounded-2xl transition-all ${
                    chatMode === "video"
                      ? "bg-yellow-300 text-purple-700"
                      : "bg-white/20 text-white hover:bg-white/30"
                  }`}
                >
                  <Video className="w-16 h-16 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold mb-2">Video Chat</h3>
                  <p className={chatMode === "video" ? "text-purple-700/80" : "text-white/80"}>
                    Face-to-face conversations
                  </p>
                </motion.button>
              </div>

              <div className="flex gap-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setStep(1)}
                  className="flex-1 bg-white/20 text-white py-4 rounded-full font-bold hover:bg-white/30 transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setStep(3)}
                  disabled={!chatMode}
                  className={`flex-1 py-4 rounded-full font-bold transition-all flex items-center justify-center gap-2 ${
                    chatMode
                      ? "bg-white text-purple-600 hover:shadow-lg"
                      : "bg-white/10 text-white/50 cursor-not-allowed"
                  }`}
                >
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full max-w-2xl"
            >
              <h2 className="text-4xl font-bold text-white mb-4 text-center">
                Community Guidelines
              </h2>
              <p className="text-white/90 text-center mb-8">
                Please read and agree to our guidelines
              </p>

              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 mb-8">
                <ul className="space-y-4 text-white">
                  <li className="flex gap-3">
                    <span className="text-yellow-300 font-bold">1.</span>
                    <span>Be respectful and kind to all users</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-yellow-300 font-bold">2.</span>
                    <span>No inappropriate content or behavior</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-yellow-300 font-bold">3.</span>
                    <span>No sharing of personal information</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-yellow-300 font-bold">4.</span>
                    <span>You must be 18+ to use this service</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-yellow-300 font-bold">5.</span>
                    <span>Report any violations immediately</span>
                  </li>
                </ul>
              </div>

              <div className="flex gap-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setStep(2)}
                  className="flex-1 bg-white/20 text-white py-4 rounded-full font-bold hover:bg-white/30 transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleStart}
                  className="flex-1 bg-yellow-300 text-purple-700 py-4 rounded-full font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  I Agree - Start Chatting
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
