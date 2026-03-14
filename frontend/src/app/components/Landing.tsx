import { useNavigate } from "react-router";
import { MessageCircle, Video, Zap, Shield, Globe, Users, LogOut } from "lucide-react";
import { motion } from "motion/react";

export function Landing() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("strangr_token");
    localStorage.removeItem("strangr_user");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 flex flex-col">
      {/* Header */}
      <header className="p-6 flex justify-between items-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2"
        >
          <Zap className="w-8 h-8 text-yellow-300" fill="currentColor" />
          <h1 className="text-3xl font-bold text-white">Strangr</h1>
        </motion.div>
        
        <motion.button
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleLogout}
          className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-full font-medium backdrop-blur-sm transition-all shadow-sm"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </motion.button>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center max-w-2xl"
        >
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Meet New People
            <br />
            <span className="text-yellow-300">Instantly</span>
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Connect with random strangers from around the world. Chat anonymously and make new friends.
          </p>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/onboarding")}
            className="bg-white text-purple-600 px-12 py-4 rounded-full text-xl font-bold shadow-lg hover:shadow-xl transition-all"
          >
            Start Chatting
          </motion.button>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-4xl w-full"
        >
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
            <MessageCircle className="w-12 h-12 text-yellow-300 mx-auto mb-3" />
            <h3 className="text-white font-bold text-lg mb-2">Text Chat</h3>
            <p className="text-white/80 text-sm">
              Have conversations with strangers via instant messaging
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
            <Video className="w-12 h-12 text-yellow-300 mx-auto mb-3" />
            <h3 className="text-white font-bold text-lg mb-2">Video Chat</h3>
            <p className="text-white/80 text-sm">
              Face-to-face conversations with random people
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
            <Globe className="w-12 h-12 text-yellow-300 mx-auto mb-3" />
            <h3 className="text-white font-bold text-lg mb-2">Global Reach</h3>
            <p className="text-white/80 text-sm">
              Connect with people from every corner of the world
            </p>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center">
        <div className="flex items-center justify-center gap-4 text-white/70 text-sm">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            <span>Anonymous</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>Safe Community</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
