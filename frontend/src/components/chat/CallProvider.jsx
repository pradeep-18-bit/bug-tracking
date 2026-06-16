import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Camera,
  CameraOff,
  Maximize2,
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  PhoneOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { getChatSocket } from "@/lib/socket";
import { cn, getInitials } from "@/lib/utils";

const CallContext = createContext(null);
const getId = (value) => String(value?._id || value?.id || value || "");

const rtcConfig = {
  iceServers: [
    { urls: import.meta.env.VITE_STUN_URL || "stun:stun.l.google.com:19302" },
    ...(import.meta.env.VITE_TURN_URL
      ? [
          {
            urls: import.meta.env.VITE_TURN_URL,
            username: import.meta.env.VITE_TURN_USERNAME || "",
            credential: import.meta.env.VITE_TURN_CREDENTIAL || "",
          },
        ]
      : []),
  ],
};

const formatDuration = (seconds = 0) => {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
};

const playRingtone = () => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;

  if (!AudioContext) {
    return () => {};
  }

  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 880;
  gain.gain.value = 0.045;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  const intervalId = window.setInterval(() => {
    oscillator.frequency.value = oscillator.frequency.value === 880 ? 660 : 880;
  }, 450);

  return () => {
    window.clearInterval(intervalId);
    oscillator.stop();
    context.close();
  };
};

export const CallProvider = ({ children }) => {
  const { token, user } = useAuth();
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callPresence, setCallPresence] = useState({});
  const [error, setError] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeakerOff, setIsSpeakerOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const stopRingtoneRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const activeCallRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  const stopStreams = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  const cleanupPeer = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    pendingCandidatesRef.current = [];
  }, []);

  const closeCallUi = useCallback(() => {
    stopRingtoneRef.current?.();
    stopRingtoneRef.current = null;
    cleanupPeer();
    stopStreams();
    setIncomingCall(null);
    setActiveCall(null);
    setDuration(0);
    setIsMuted(false);
    setIsCameraOff(false);
    setIsSpeakerOff(false);
  }, [cleanupPeer, stopStreams]);

  const notifyIncomingCall = useCallback((call) => {
    if (!("Notification" in window)) {
      return;
    }

    const showNotification = () =>
      new Notification(`${call.caller?.name || "Someone"} is calling`, {
        body: `${call.callType === "video" ? "Video" : "Audio"} call`,
      });

    if (Notification.permission === "granted") {
      showNotification();
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          showNotification();
        }
      });
    }
  }, []);

  const getMedia = useCallback(async (callType) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (mediaError) {
      setError(
        callType === "video"
          ? "Camera or microphone permission was denied."
          : "Microphone permission was denied."
      );
      throw mediaError;
    }
  }, []);

  const createPeer = useCallback(
    ({ callId, targetUserId, stream }) => {
      cleanupPeer();
      const peer = new RTCPeerConnection(rtcConfig);
      const nextRemoteStream = new MediaStream();
      setRemoteStream(nextRemoteStream);

      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      peer.ontrack = (event) => {
        event.streams?.[0]?.getTracks().forEach((track) => {
          nextRemoteStream.addTrack(track);
        });
      };
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          getChatSocket(token)?.emit("call:ice-candidate", {
            callId,
            targetUserId,
            candidate: event.candidate,
          });
        }
      };
      peerRef.current = peer;
      return peer;
    },
    [cleanupPeer, token]
  );

  const startCall = useCallback(
    async ({ conversation, callType }) => {
      const participants = conversation?.participants || [];
      const receiver = participants.find((participant) => getId(participant) !== getId(user));

      if (!receiver || conversation?.type !== "direct") {
        setError("Calls are available for direct chats right now.");
        return;
      }

      setError("");
      await getMedia(callType);
      getChatSocket(token)?.emit(
        "call:start",
        {
          conversationId: getId(conversation),
          receiverId: getId(receiver),
          callType,
        },
        (response) => {
          if (!response?.ok) {
            stopStreams();
            setError(response?.error || "Unable to start call.");
          }
        }
      );
    },
    [getMedia, stopStreams, token, user]
  );

  const acceptCall = useCallback(async () => {
    if (!incomingCall) {
      return;
    }

    setError("");
    stopRingtoneRef.current?.();
    stopRingtoneRef.current = null;
    const stream = await getMedia(incomingCall.callType);
    setActiveCall({ ...incomingCall, status: "connecting", peer: incomingCall.caller });
    setIncomingCall(null);
    createPeer({
      callId: incomingCall.callId,
      targetUserId: getId(incomingCall.caller),
      stream,
    });
    getChatSocket(token)?.emit("call:accept", { callId: incomingCall.callId });
  }, [createPeer, getMedia, incomingCall, token]);

  const rejectCall = useCallback(() => {
    if (!incomingCall) {
      return;
    }

    getChatSocket(token)?.emit("call:reject", { callId: incomingCall.callId });
    closeCallUi();
  }, [closeCallUi, incomingCall, token]);

  const endCall = useCallback(() => {
    const callId = activeCallRef.current?.callId || incomingCall?.callId;
    if (callId) {
      getChatSocket(token)?.emit("call:end", { callId });
    }
    closeCallUi();
  }, [closeCallUi, incomingCall, token]);

  const toggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    const nextOff = !isCameraOff;
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !nextOff;
    });
    setIsCameraOff(nextOff);
  }, [isCameraOff]);

  const shareScreen = useCallback(async () => {
    if (!peerRef.current || !navigator.mediaDevices?.getDisplayMedia) {
      return;
    }

    const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const screenTrack = displayStream.getVideoTracks()[0];
    const sender = peerRef.current
      .getSenders()
      .find((item) => item.track?.kind === "video");

    if (sender && screenTrack) {
      sender.replaceTrack(screenTrack);
      screenTrack.onended = () => {
        const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
        if (cameraTrack) {
          sender.replaceTrack(cameraTrack);
        }
      };
    }
  }, []);

  const enterFullscreen = useCallback(() => {
    remoteVideoRef.current?.requestFullscreen?.();
  }, []);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const socket = getChatSocket(token);
    if (!socket) {
      return undefined;
    }

    const handleIncomingCall = (call) => {
      setIncomingCall(call);
      stopRingtoneRef.current?.();
      stopRingtoneRef.current = playRingtone();
      notifyIncomingCall(call);
    };
    const handleOutgoingCall = (call) => {
      setActiveCall({ ...call, status: "ringing", peer: call.receiver });
    };
    const handlePresence = (payload = {}) => {
      setCallPresence(payload.presence || {});
    };
    const handleAccepted = async (payload) => {
      const currentCall = activeCallRef.current;
      if (
        !currentCall ||
        currentCall.callId !== payload.callId ||
        String(payload.callerId) !== getId(user)
      ) {
        return;
      }

      const stream = localStreamRef.current || (await getMedia(currentCall.callType));
      const peer = createPeer({
        callId: payload.callId,
        targetUserId: getId(currentCall.peer),
        stream,
      });
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit("call:offer", {
        callId: payload.callId,
        targetUserId: getId(currentCall.peer),
        description: offer,
      });
      setActiveCall({ ...currentCall, status: "connected", startedAt: payload.startTime });
    };
    const handleOffer = async (payload) => {
      const currentCall = activeCallRef.current;
      if (!currentCall || currentCall.callId !== payload.callId || !peerRef.current) {
        return;
      }

      await peerRef.current.setRemoteDescription(payload.description);
      await Promise.all(
        pendingCandidatesRef.current.map((candidate) =>
          peerRef.current.addIceCandidate(candidate).catch(() => {})
        )
      );
      pendingCandidatesRef.current = [];
      const answer = await peerRef.current.createAnswer();
      await peerRef.current.setLocalDescription(answer);
      socket.emit("call:answer", {
        callId: payload.callId,
        targetUserId: payload.fromUserId,
        description: answer,
      });
      setActiveCall({ ...currentCall, status: "connected", startedAt: payload.startTime });
    };
    const handleAnswer = async (payload) => {
      if (peerRef.current && activeCallRef.current?.callId === payload.callId) {
        await peerRef.current.setRemoteDescription(payload.description);
        await Promise.all(
          pendingCandidatesRef.current.map((candidate) =>
            peerRef.current.addIceCandidate(candidate).catch(() => {})
          )
        );
        pendingCandidatesRef.current = [];
      }
    };
    const handleCandidate = async (payload) => {
      const candidate = new RTCIceCandidate(payload.candidate);
      if (peerRef.current?.remoteDescription) {
        await peerRef.current.addIceCandidate(candidate).catch(() => {});
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    };
    const handleEnded = () => closeCallUi();
    const handleMissed = (payload) => {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Missed call", {
          body: `${payload.callType === "video" ? "Video" : "Audio"} call was not answered`,
        });
      }
      closeCallUi();
    };

    socket.on("call:incoming", handleIncomingCall);
    socket.on("call:outgoing", handleOutgoingCall);
    socket.on("call:presence", handlePresence);
    socket.on("call:accepted", handleAccepted);
    socket.on("call:offer", handleOffer);
    socket.on("call:answer", handleAnswer);
    socket.on("call:ice-candidate", handleCandidate);
    socket.on("call:ended", handleEnded);
    socket.on("call:rejected", handleEnded);
    socket.on("call:missed", handleMissed);

    return () => {
      socket.off("call:incoming", handleIncomingCall);
      socket.off("call:outgoing", handleOutgoingCall);
      socket.off("call:presence", handlePresence);
      socket.off("call:accepted", handleAccepted);
      socket.off("call:offer", handleOffer);
      socket.off("call:answer", handleAnswer);
      socket.off("call:ice-candidate", handleCandidate);
      socket.off("call:ended", handleEnded);
      socket.off("call:rejected", handleEnded);
      socket.off("call:missed", handleMissed);
    };
  }, [closeCallUi, createPeer, getMedia, notifyIncomingCall, token, user]);

  useEffect(() => {
    if (!activeCall?.startedAt && activeCall?.status !== "connected") {
      return undefined;
    }

    const startedAt = activeCall.startedAt ? new Date(activeCall.startedAt).getTime() : Date.now();
    const intervalId = window.setInterval(() => {
      setDuration(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [activeCall?.startedAt, activeCall?.status]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }

    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = isSpeakerOff;
    }
  }, [isSpeakerOff]);

  const value = useMemo(
    () => ({
      activeCall,
      callPresence,
      error,
      startCall,
    }),
    [activeCall, callPresence, error, startCall]
  );

  return (
    <CallContext.Provider value={value}>
      {children}
      {incomingCall ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[28px] border border-white/70 bg-white p-6 text-center shadow-2xl">
            <Avatar className="mx-auto h-20 w-20 rounded-[28px] border border-blue-100">
              <AvatarFallback className="text-xl">
                {getInitials(incomingCall.caller?.name)}
              </AvatarFallback>
            </Avatar>
            <h2 className="mt-4 text-xl font-extrabold text-slate-950">
              {incomingCall.caller?.name || "Incoming call"}
            </h2>
            <p className="mt-1 text-sm font-semibold capitalize text-slate-500">
              Incoming {incomingCall.callType} call
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button type="button" variant="destructive" onClick={rejectCall}>
                <PhoneOff className="h-4 w-4" />
                Reject
              </Button>
              <Button type="button" onClick={acceptCall}>
                <Phone className="h-4 w-4" />
                Accept
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {activeCall ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/88 p-3 text-white backdrop-blur-sm">
          <div className="flex h-full max-h-[760px] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/12 bg-slate-950 shadow-2xl">
            {activeCall.callType === "video" ? (
              <div className="relative min-h-0 flex-1 bg-black">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="h-full w-full object-contain"
                />
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="absolute bottom-4 right-4 h-28 w-40 rounded-2xl border border-white/20 bg-slate-900 object-cover shadow-xl sm:h-40 sm:w-56"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-4 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                  onClick={enterFullscreen}
                  title="Full screen"
                  aria-label="Full screen"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-slate-900 px-6 text-center">
                <audio ref={remoteAudioRef} autoPlay playsInline />
                <Avatar className="h-28 w-28 rounded-[36px] border border-white/15">
                  <AvatarFallback className="bg-blue-500 text-3xl text-white">
                    {getInitials(activeCall.peer?.name)}
                  </AvatarFallback>
                </Avatar>
                <h2 className="mt-5 text-2xl font-extrabold">
                  {activeCall.peer?.name || "Audio call"}
                </h2>
                <p className="mt-2 font-mono text-lg text-white/70">
                  {activeCall.status === "ringing" ? "Ringing..." : formatDuration(duration)}
                </p>
              </div>
            )}
            <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 border-t border-white/10 bg-slate-950 px-4 py-4">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn("bg-white/10 text-white hover:bg-white/20 hover:text-white", isMuted && "bg-rose-500")}
                onClick={toggleMute}
                title="Mute microphone"
                aria-label="Mute microphone"
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              {activeCall.callType === "audio" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn("bg-white/10 text-white hover:bg-white/20 hover:text-white", isSpeakerOff && "bg-white/5")}
                  onClick={() => setIsSpeakerOff((value) => !value)}
                  title="Speaker"
                  aria-label="Speaker"
                >
                  {isSpeakerOff ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn("bg-white/10 text-white hover:bg-white/20 hover:text-white", isCameraOff && "bg-rose-500")}
                    onClick={toggleCamera}
                    title="Toggle camera"
                    aria-label="Toggle camera"
                  >
                    {isCameraOff ? <CameraOff className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="bg-white/10 text-white hover:bg-white/20 hover:text-white"
                    onClick={shareScreen}
                    title="Share screen"
                    aria-label="Share screen"
                  >
                    <MonitorUp className="h-5 w-5" />
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={endCall}
                title="End call"
                aria-label="End call"
              >
                <PhoneOff className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {error ? (
        <div className="fixed bottom-5 left-1/2 z-[90] -translate-x-1/2 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-600 shadow-xl">
          {error}
        </div>
      ) : null}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);

  if (!context) {
    throw new Error("useCall must be used within CallProvider");
  }

  return context;
};
