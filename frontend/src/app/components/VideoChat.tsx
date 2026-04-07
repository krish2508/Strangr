import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
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
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Matching } from "./Matching";
import { MediaState, useChat } from "../hooks/useChat";

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

function debugVideoChat(event: string, payload?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  if (payload) {
    console.info(`[video-chat] ${timestamp} ${event}`, payload);
    return;
  }

  console.info(`[video-chat] ${timestamp} ${event}`);
}

function getIceServers(): RTCIceServer[] {
  const raw = import.meta.env.VITE_WEBRTC_ICE_SERVERS;
  if (!raw) return DEFAULT_ICE_SERVERS;

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_ICE_SERVERS;
  } catch {
    console.warn("Invalid VITE_WEBRTC_ICE_SERVERS value. Falling back to default STUN server.");
    return DEFAULT_ICE_SERVERS;
  }
}

function remoteStatusLabel(
  remoteMediaState: MediaState,
  hasRemoteTracks: boolean,
  strangerConnected: boolean
): string {
  if (!strangerConnected) return "Waiting for stranger";
  if (!remoteMediaState.videoEnabled) return "Stranger's camera is off";
  if (!hasRemoteTracks) return "Connecting video call...";
  return "Video chat in progress...";
}

export function VideoChat() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showChat, setShowChat] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [isMediaReady, setIsMediaReady] = useState(false);
  const [hasRemoteTracks, setHasRemoteTracks] = useState(false);
  const [hasLocalVideoTrack, setHasLocalVideoTrack] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream>(new MediaStream());
  const remoteStreamRef = useRef<MediaStream>(new MediaStream());
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const activePartnerRef = useRef<string | null>(null);
  const audioSenderRef = useRef<RTCRtpSender | null>(null);
  const videoSenderRef = useRef<RTCRtpSender | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const isSettingRemoteAnswerPendingRef = useRef(false);

  const iceServers = useMemo(getIceServers, []);
  const interests = Array.isArray(location.state?.interests) ? location.state.interests : [];

  const {
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
  } = useChat("video", interests);

  const syncLocalVideoState = useCallback(() => {
    const hasActiveVideoTrack = localStreamRef.current
      .getVideoTracks()
      .some((track) => track.readyState === "live");
    setHasLocalVideoTrack(hasActiveVideoTrack);
  }, []);

  const syncRemoteVideoState = useCallback(() => {
    const hasActiveRemoteVideoTrack = remoteStreamRef.current
      .getVideoTracks()
      .some((track) => track.readyState === "live");
    setHasRemoteTracks(hasActiveRemoteVideoTrack);
  }, []);

  const attachStreamToVideo = useCallback(async (videoEl: HTMLVideoElement | null, stream: MediaStream) => {
    if (!videoEl) return;

    if (videoEl.srcObject !== stream) {
      videoEl.srcObject = stream;
    }

    try {
      await videoEl.play();
    } catch {
      // Autoplay can be deferred by the browser until the element is ready.
    }
  }, []);

  const attachLocalStream = useCallback(() => {
    void attachStreamToVideo(localVideoRef.current, localStreamRef.current);
  }, [attachStreamToVideo]);

  const attachRemoteStream = useCallback(() => {
    void attachStreamToVideo(remoteVideoRef.current, remoteStreamRef.current);
  }, [attachStreamToVideo]);

  const resetRemoteStream = useCallback(() => {
    remoteStreamRef.current.getTracks().forEach((track) => track.stop());
    remoteStreamRef.current = new MediaStream();
    setHasRemoteTracks(false);
    attachRemoteStream();
  }, [attachRemoteStream]);

  const stopLocalMedia = useCallback(() => {
    localStreamRef.current.getTracks().forEach((track) => track.stop());
    localStreamRef.current = new MediaStream();
    audioSenderRef.current = null;
    videoSenderRef.current = null;
    setIsMediaReady(false);
    setHasLocalVideoTrack(false);
    attachLocalStream();
  }, [attachLocalStream]);

  const cleanupPeerConnection = useCallback(() => {
    pendingIceCandidatesRef.current = [];
    makingOfferRef.current = false;
    ignoreOfferRef.current = false;
    isSettingRemoteAnswerPendingRef.current = false;

    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.onnegotiationneeded = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    activePartnerRef.current = null;
    audioSenderRef.current = null;
    videoSenderRef.current = null;
    resetRemoteStream();
  }, [resetRemoteStream]);

  const initializeLocalMedia = useCallback(async () => {
    try {
      stopLocalMedia();
      setDeviceError(null);
      debugVideoChat("local-media:init:start");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      localStreamRef.current = stream;
      setMicEnabled(true);
      setVideoEnabled(true);
      setIsMediaReady(true);
      syncLocalVideoState();
      attachLocalStream();
      debugVideoChat("local-media:init:success", {
        audioTracks: stream.getAudioTracks().length,
        videoTracks: stream.getVideoTracks().length,
      });
    } catch {
      debugVideoChat("local-media:init:error");
      setDeviceError("Camera and microphone access is required to start video chat.");
      setMicEnabled(false);
      setVideoEnabled(false);
      setIsMediaReady(false);
      setHasLocalVideoTrack(false);
      updateCallStatus("error");
    }
  }, [attachLocalStream, stopLocalMedia, syncLocalVideoState, updateCallStatus]);

  const syncLocalTracksToPeer = useCallback((pc: RTCPeerConnection) => {
    audioSenderRef.current = null;
    videoSenderRef.current = null;

    localStreamRef.current.getTracks().forEach((track) => {
      const sender = pc.addTrack(track, localStreamRef.current);
      if (track.kind === "audio") {
        audioSenderRef.current = sender;
      } else if (track.kind === "video") {
        videoSenderRef.current = sender;
      }
    });
  }, []);

  const flushPendingIceCandidates = useCallback(async () => {
    if (!peerConnectionRef.current || !peerConnectionRef.current.remoteDescription) return;

    const queuedCandidates = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];

    for (const candidate of queuedCandidates) {
      try {
        await peerConnectionRef.current.addIceCandidate(candidate);
      } catch {
        console.warn("Failed to apply queued ICE candidate.");
      }
    }
  }, []);

  const sendSessionDescription = useCallback((description: RTCSessionDescriptionInit) => {
    sendSignalMessage({
      type: description.type === "answer" ? "webrtc-answer" : "webrtc-offer",
      sdp: {
        type: description.type,
        sdp: description.sdp ?? "",
      },
    });
  }, [sendSignalMessage]);

  const negotiatePeerConnection = useCallback(async (pc: RTCPeerConnection) => {
    if (peerConnectionRef.current !== pc || !activePartnerRef.current || pc.signalingState !== "stable") {
      return;
    }

    try {
      makingOfferRef.current = true;
      debugVideoChat("peer:negotiationneeded", {
        partnerId: activePartnerRef.current,
        signalingState: pc.signalingState,
      });
      await pc.setLocalDescription();

      if (pc.localDescription) {
        debugVideoChat("signal:send", {
          type: pc.localDescription.type,
          partnerId: activePartnerRef.current,
        });
        sendSessionDescription(pc.localDescription);
      }
    } finally {
      makingOfferRef.current = false;
    }
  }, [sendSessionDescription]);

  const createPeerConnection = useCallback((partnerId: string) => {
    const pc = new RTCPeerConnection({ iceServers });
    peerConnectionRef.current = pc;
    activePartnerRef.current = partnerId;
    pendingIceCandidatesRef.current = [];
    resetRemoteStream();
    debugVideoChat("peer:create", {
      partnerId,
      iceServers: iceServers.map((server) => server.urls),
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        debugVideoChat("ice-candidate:send", {
          partnerId,
          candidate: event.candidate.candidate,
          address: event.candidate.address,
          port: event.candidate.port,
          protocol: event.candidate.protocol,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          type: event.candidate.type,
        });
        sendSignalMessage({
          type: "webrtc-ice-candidate",
          candidate: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            usernameFragment: event.candidate.usernameFragment ?? undefined,
          },
        });
      }
    };

    pc.onnegotiationneeded = () => {
      void negotiatePeerConnection(pc);
    };

    pc.oniceconnectionstatechange = () => {
      debugVideoChat("peer:ice-connection-state", {
        partnerId,
        state: pc.iceConnectionState,
      });
    };

    pc.onicegatheringstatechange = () => {
      debugVideoChat("peer:ice-gathering-state", {
        partnerId,
        state: pc.iceGatheringState,
      });
    };

    pc.onsignalingstatechange = () => {
      debugVideoChat("peer:signaling-state", {
        partnerId,
        state: pc.signalingState,
      });
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;

      if (stream) {
        stream.getTracks().forEach((track) => {
          const exists = remoteStreamRef.current.getTracks().some((remoteTrack) => remoteTrack.id === track.id);
          if (!exists) {
            remoteStreamRef.current.addTrack(track);
          }
        });
      } else {
        const exists = remoteStreamRef.current.getTracks().some((track) => track.id === event.track.id);
        if (!exists) {
          remoteStreamRef.current.addTrack(event.track);
        }
      }

      syncRemoteVideoState();
      attachRemoteStream();
      debugVideoChat("peer:remote-track", {
        partnerId,
        kind: event.track.kind,
        streamCount: event.streams.length,
        remoteTrackCount: remoteStreamRef.current.getTracks().length,
      });
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      debugVideoChat("peer:connection-state", {
        partnerId,
        state,
      });

      if (state === "connected") {
        updateCallStatus("connected");
      } else if (state === "connecting") {
        updateCallStatus("connecting");
      } else if (state === "disconnected" || state === "failed" || state === "closed") {
        updateCallStatus("ended");
        setHasRemoteTracks(false);
      }
    };

    syncLocalTracksToPeer(pc);

    return pc;
  }, [
    attachRemoteStream,
    iceServers,
    negotiatePeerConnection,
    resetRemoteStream,
    sendSignalMessage,
    syncLocalTracksToPeer,
    syncRemoteVideoState,
    updateCallStatus,
  ]);

  const ensurePeerConnection = useCallback((partnerId: string) => {
    if (peerConnectionRef.current && activePartnerRef.current === partnerId) {
      return peerConnectionRef.current;
    }

    cleanupPeerConnection();
    return createPeerConnection(partnerId);
  }, [cleanupPeerConnection, createPeerConnection]);

  const startNegotiationIfReady = useCallback(async () => {
    if (!matchedPartnerId || isSearching || !strangerConnected) return;

    if (!isMediaReady || deviceError) {
      debugVideoChat("peer:start-skipped", {
        matchedPartnerId,
        isMediaReady,
        hasDeviceError: Boolean(deviceError),
      });
      updateCallStatus("error");
      return;
    }

    ensurePeerConnection(matchedPartnerId);
    debugVideoChat("peer:start", {
      matchedPartnerId,
      micEnabled,
      videoEnabled,
    });
    updateCallStatus("connecting");
    sendMediaState({
      audioEnabled: micEnabled,
      videoEnabled,
    });
  }, [
    matchedPartnerId,
    isSearching,
    strangerConnected,
    isMediaReady,
    deviceError,
    ensurePeerConnection,
    updateCallStatus,
    sendMediaState,
    micEnabled,
    videoEnabled,
  ]);

  useEffect(() => {
    attachLocalStream();
    attachRemoteStream();
  }, [attachLocalStream, attachRemoteStream]);

  useEffect(() => {
    if (!isSearching) {
      attachLocalStream();
      attachRemoteStream();
    }
  }, [attachLocalStream, attachRemoteStream, isSearching]);

  useEffect(() => {
    void initializeLocalMedia();

    return () => {
      cleanupPeerConnection();
      stopLocalMedia();
    };
  }, [cleanupPeerConnection, initializeLocalMedia, stopLocalMedia]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, strangerTyping]);

  useEffect(() => {
    if (!matchedPartnerId) {
      cleanupPeerConnection();
      return;
    }

    void startNegotiationIfReady();
  }, [cleanupPeerConnection, matchedPartnerId, startNegotiationIfReady]);

  useEffect(() => {
    if (!matchedPartnerId || !strangerConnected || !isMediaReady) return;

    sendMediaState({
      audioEnabled: micEnabled,
      videoEnabled,
    });
  }, [matchedPartnerId, strangerConnected, isMediaReady, micEnabled, videoEnabled, sendMediaState]);

  useEffect(() => {
    const latestSignal = pendingSignals[0];

    if (!latestSignal || !matchedPartnerId || latestSignal.fromUserId !== matchedPartnerId) {
      return;
    }

    const handleSignal = async () => {
      if (latestSignal.type === "call-end") {
        debugVideoChat("signal:received", {
          type: latestSignal.type,
          fromUserId: latestSignal.fromUserId,
        });
        cleanupPeerConnection();
        setHasRemoteTracks(false);
        updateCallStatus("ended");
        consumePendingSignal();
        return;
      }

      const pc = ensurePeerConnection(matchedPartnerId);
      debugVideoChat("signal:received", {
        type: latestSignal.type,
        fromUserId: latestSignal.fromUserId,
      });

      if (latestSignal.type === "webrtc-offer") {
        const readyForOffer =
          !makingOfferRef.current &&
          (pc.signalingState === "stable" || isSettingRemoteAnswerPendingRef.current);
        const offerCollision = !readyForOffer;
        const polite = userId.localeCompare(matchedPartnerId) > 0;

        ignoreOfferRef.current = !polite && offerCollision;
        if (ignoreOfferRef.current) {
          debugVideoChat("signal:offer-ignored", {
            fromUserId: latestSignal.fromUserId,
            polite,
          });
          consumePendingSignal();
          return;
        }

        await pc.setRemoteDescription(new RTCSessionDescription(latestSignal.sdp));
        await flushPendingIceCandidates();
        await pc.setLocalDescription();

        if (pc.localDescription) {
          debugVideoChat("signal:send", {
            type: pc.localDescription.type,
            partnerId: matchedPartnerId,
          });
          sendSessionDescription(pc.localDescription);
        }
      } else if (latestSignal.type === "webrtc-answer") {
        if (pc.signalingState === "stable") {
          debugVideoChat("signal:answer-ignored", {
            fromUserId: latestSignal.fromUserId,
            signalingState: pc.signalingState,
          });
          consumePendingSignal();
          return;
        }

        try {
          isSettingRemoteAnswerPendingRef.current = true;
          await pc.setRemoteDescription(new RTCSessionDescription(latestSignal.sdp));
          await flushPendingIceCandidates();
        } finally {
          isSettingRemoteAnswerPendingRef.current = false;
        }
      } else if (latestSignal.type === "webrtc-ice-candidate") {
        try {
          if (pc.remoteDescription) {
            debugVideoChat("ice-candidate:apply", {
              candidate: latestSignal.candidate.candidate,
              fromUserId: latestSignal.fromUserId,
            });
            await pc.addIceCandidate(new RTCIceCandidate(latestSignal.candidate));
          } else {
            debugVideoChat("ice-candidate:queue", {
              candidate: latestSignal.candidate.candidate,
              fromUserId: latestSignal.fromUserId,
            });
            pendingIceCandidatesRef.current.push(latestSignal.candidate);
          }
        } catch {
          if (!ignoreOfferRef.current) {
            console.warn("Failed to apply ICE candidate.");
          }
        }
      }

      consumePendingSignal();
    };

    void handleSignal();
  }, [
    consumePendingSignal,
    cleanupPeerConnection,
    ensurePeerConnection,
    flushPendingIceCandidates,
    matchedPartnerId,
    pendingSignals,
    sendSessionDescription,
    updateCallStatus,
    userId,
  ]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (!strangerConnected) return;

    sendTyping();
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!strangerConnected) return;

    const text = inputValue.trim();
    if (!text) return;

    sendMessage(text);
    setInputValue("");
  };

  const toggleMic = () => {
    const nextEnabled = !micEnabled;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });
    setMicEnabled(nextEnabled);
    debugVideoChat("local-media:toggle-mic", {
      enabled: nextEnabled,
    });

    if (matchedPartnerId) {
      sendMediaState({
        audioEnabled: nextEnabled,
        videoEnabled,
      });
    }
  };

  const toggleVideo = async () => {
    if (!matchedPartnerId && !isMediaReady && !videoEnabled) {
      await initializeLocalMedia();
      return;
    }

    if (videoEnabled) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        localStreamRef.current.removeTrack(track);
        track.stop();
      });

      if (videoSenderRef.current) {
        await videoSenderRef.current.replaceTrack(null);
      }

      setVideoEnabled(false);
      setHasLocalVideoTrack(false);
      debugVideoChat("local-media:toggle-video", {
        enabled: false,
      });

      sendMediaState({
        audioEnabled: micEnabled,
        videoEnabled: false,
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const [newTrack] = stream.getVideoTracks();

      if (!newTrack) {
        throw new Error("No video track available");
      }

      localStreamRef.current.addTrack(newTrack);
      syncLocalVideoState();

      if (peerConnectionRef.current) {
        if (videoSenderRef.current) {
          await videoSenderRef.current.replaceTrack(newTrack);
        } else {
          videoSenderRef.current = peerConnectionRef.current.addTrack(newTrack, localStreamRef.current);
        }
      }

      attachLocalStream();
      setVideoEnabled(true);
      setDeviceError(null);
      debugVideoChat("local-media:toggle-video", {
        enabled: true,
      });

      sendMediaState({
        audioEnabled: micEnabled,
        videoEnabled: true,
      });
    } catch {
      setDeviceError("Camera could not be turned back on. Check browser permissions and device access.");
      setVideoEnabled(false);
      setHasLocalVideoTrack(false);
    }
  };

  const handleSkip = async () => {
    cleanupPeerConnection();
    stopLocalMedia();
    sendNext();
    await initializeLocalMedia();
  };

  const handleStop = () => {
    sendSignalMessage({ type: "call-end", reason: "stop" });
    cleanupPeerConnection();
    stopLocalMedia();
    navigate("/landing");
  };

  if (isSearching) {
    return <Matching onCancel={handleStop} />;
  }

  const headerStatus = strangerConnected ? "Connected" : "Waiting to reconnect";
  const activeError = deviceError || connectionError;
  const remoteVideoVisible = remoteMediaState.videoEnabled && hasRemoteTracks;
  const localVideoVisible = videoEnabled && hasLocalVideoTrack;

  return (
    <div className="h-screen flex flex-col bg-gray-900">
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
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium">{headerStatus}</p>
              <p className="text-xs text-white/80 capitalize">{callStatus}</p>
            </div>
            <div className="flex items-center gap-2">
              <Circle
                className={`w-3 h-3 ${strangerConnected ? "text-green-400" : "text-yellow-300"}`}
                fill="currentColor"
              />
              <span className="text-sm">{strangerConnected ? "Live" : "Standby"}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-gray-800">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`absolute inset-0 h-full w-full object-cover ${remoteVideoVisible ? "opacity-100" : "opacity-0"}`}
          />

          {!remoteVideoVisible && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-950 via-gray-900 to-pink-950">
              <div className="text-center px-6">
                <div className="w-24 h-24 bg-white/10 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <VideoOff className="w-10 h-10 text-gray-300" />
                </div>
                <p className="text-white text-xl font-medium">
                  {remoteStatusLabel(remoteMediaState, hasRemoteTracks, strangerConnected)}
                </p>
                <p className="text-white/70 text-sm mt-2">
                  {remoteMediaState.audioEnabled ? "Audio can still continue while video is off." : "Remote microphone is muted."}
                </p>
              </div>
            </div>
          )}

          {activeError && (
            <div className="absolute top-4 left-4 right-4 mx-auto max-w-2xl rounded-2xl border border-amber-400/40 bg-black/60 p-4 text-white backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-300 mt-0.5" />
                <div>
                  <p className="font-medium">Device or connection issue</p>
                  <p className="text-sm text-white/80">{activeError}</p>
                </div>
              </div>
            </div>
          )}

          <motion.div
            drag
            dragMomentum={false}
            className="absolute bottom-6 right-6 w-64 h-48 bg-gray-700 rounded-2xl overflow-hidden shadow-2xl cursor-move"
          >
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover ${localVideoVisible ? "opacity-100" : "opacity-0"}`}
            />

            {!localVideoVisible && (
              <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-800">
                <div className="text-center">
                  <VideoOff className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-white text-sm">{videoEnabled ? "Starting camera..." : "Camera Off"}</p>
                </div>
              </div>
            )}

            <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm px-2 py-1 rounded text-white text-xs">
              You
            </div>
          </motion.div>
        </div>

        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 20 }}
              className="absolute right-0 top-0 bottom-0 w-96 bg-white shadow-2xl flex flex-col z-20"
            >
              <div className="bg-gradient-to-r from-purple-600 to-pink-500 text-white p-4 flex items-center justify-between">
                <h3 className="font-bold">Chat</h3>
                <button
                  onClick={() => setShowChat(false)}
                  className="hover:bg-white/20 p-2 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

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

      <div className="bg-gray-800 p-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleMic}
              disabled={!isMediaReady}
              className={`p-4 rounded-full transition-colors ${
                micEnabled
                  ? "bg-gray-700 hover:bg-gray-600 text-white"
                  : "bg-red-500 hover:bg-red-600 text-white"
              } disabled:bg-gray-600 disabled:text-gray-300`}
            >
              {micEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => void toggleVideo()}
              disabled={!isMediaReady && videoEnabled}
              className={`p-4 rounded-full transition-colors ${
                videoEnabled
                  ? "bg-gray-700 hover:bg-gray-600 text-white"
                  : "bg-red-500 hover:bg-red-600 text-white"
              } disabled:bg-gray-600 disabled:text-gray-300`}
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

          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => void handleSkip()}
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

          <div className="w-40 text-right text-xs text-gray-300">
            <p>Remote mic: {remoteMediaState.audioEnabled ? "on" : "off"}</p>
            <p>Remote cam: {remoteMediaState.videoEnabled ? "on" : "off"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
