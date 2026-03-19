import { useEffect, useState } from "react";
import { Loader2, Zap, Users } from "lucide-react";
import { motion } from "motion/react";

interface MatchingProps {
  onCancel: () => void;
}

export function Matching({ onCancel }: MatchingProps) {
  const [dots, setDots] = useState("");
  const [status, setStatus] = useState("Looking for strangers");

  useEffect(() => {
    // Animate dots
    const dotsInterval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? "" : prev + "."));
    }, 500);

    const statuses = [
      "Looking for strangers",
      "Finding online users",
      "Matching based on interests"
    ];

    let currentIndex = 0;
    const statusInterval = setInterval(() => {
      currentIndex++;
      if (currentIndex < statuses.length) {
        setStatus(statuses[currentIndex]);
      } else {
        currentIndex = 0;
        setStatus(statuses[currentIndex]);
      }
    }, 2000);

    return () => {
      clearInterval(dotsInterval);
      clearInterval(statusInterval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Zap className="w-12 h-12 text-yellow-300" fill="currentColor" />
          <h1 className="text-4xl font-bold text-white">Strangr</h1>
        </div>

        {/* Animated Loader */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="mb-8"
        >
          <Loader2 className="w-24 h-24 text-white mx-auto" />
        </motion.div>

        {/* Status */}
        <motion.h2
          key={status}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold text-white mb-4"
        >
          {status}{dots}
        </motion.h2>

        {/* Users Icon Animation */}
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="mb-8"
        >
          <Users className="w-16 h-16 text-yellow-300 mx-auto" />
        </motion.div>

        {/* Info */}
        <p className="text-white/80 text-lg">
          This usually takes just a few seconds
        </p>

        {/* Cancel Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onCancel}
          className="mt-8 bg-white/20 text-white px-8 py-3 rounded-full font-medium hover:bg-white/30 transition-all"
        >
          Cancel
        </motion.button>
      </motion.div>
    </div>
  );
}