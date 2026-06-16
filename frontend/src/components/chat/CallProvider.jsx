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
  Hand,
  Maximize2,
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  PhoneOff,
  UsersRound,
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

const RemoteMedia = ({ stream, muted }) => {
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = stream;
      audioRef.current.muted = muted;
    }
  }, [muted, stream]);

  return (
    <>
      <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
      <audio ref={audioRef} autoPlay playsInline />
    </>
  );
};

const LocalVideo = ({ stream }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className="h-full w-full object-cover"
    />
  );
};

export const CallProvider = ({ children }) => {
  const { token, user } = useAuth();
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [channelCalls, setChannelCalls] = useState({});
  const [callPresence, setCallPresence] = useState({});
  const [participants, setParticipants] = useState([]);
  const [raisedHands, setRaisedHands] = useState({});
  const [error, setError] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeakerOff, setIsSpeakerOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const peersRef = useRef(new Map());
  const pendingCandidatesRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const stopRingtoneRef = useRef(null);
  const activeCallRef = useRef(null);
  const screenRef = useRef(null);
  const stageRef = useRef(null);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  const updateRemoteStream = useCallback((userId, stream) => {
    setRemoteStreams((current) => ({
      ...current,
      [userId]: stream,
    }));
  }, []);

  const cleanupPeer = useCallback((userId) => {
    const peer = peersRef.current.get(userId);
    peer?.close();
    peersRef.current.delete(userId);
    pendingCandidatesRef.current.delete(userId);
    setRemoteStreams((current) => {
      const next = { ...current };
      delete next[userId];
      return next;
    });
  }, []);

  const cleanupAllPeers = useCallback(() => {
    peersRef.current.forEach((peer) => peer.close());
    peersRef.current.clear();
    pendingCandidatesRef.current.clear();
    setRemoteStreams({});
  }, []);

  const stopStreams = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    screenRef.current = null;
    setLocalStream(null);
  }, []);

  const closeCallUi = useCallback(() => {
    stopRingtoneRef.current?.();
    stopRingtoneRef.current = null;
    cleanupAllPeers();
    stopStreams();
    setIncomingCall(null);
    setActiveCall(null);
    setParticipants([]);
    setRaisedHands({});
    setDuration(0);
    setIsMuted(false);
    setIsCameraOff(false);
    setIsSpeakerOff(false);
  }, [cleanupAllPeers, stopStreams]);

  const notifyIncomingCall = useCallback((call) => {
    if (!("Notification" in window)) {
      return;
    }

    const title =
      call.scope === "group"
        ? `${call.channelName || "Group channel"} call`
        : `${call.caller?.name || "Someone"} is calling`;
    const showNotification = () =>
      new Notification(title, {
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
      const normalizedTargetId = String(targetUserId);
      if (peersRef.current.has(normalizedTargetId)) {
        return peersRef.current.get(normalizedTargetId);
      }

      const peer = new RTCPeerConnection(rtcConfig);
      const nextRemoteStream = new MediaStream();
      updateRemoteStream(normalizedTargetId, nextRemoteStream);
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
            targetUserId: normalizedTargetId,
            candidate: event.candidate,
          });
        }
      };
      peer.onconnectionstatechange = () => {
        if (["closed", "failed", "disconnected"].includes(peer.connectionState)) {
          cleanupPeer(normalizedTargetId);
        }
      };
      peersRef.current.set(normalizedTargetId, peer);
      return peer;
    },
    [cleanupPeer, token, updateRemoteStream]
  );

  const startCall = useCallback(
    async ({ conversation, callType }) => {
      if (!conversation) {
        return;
      }

      const isGroup = conversation.type !== "direct";
      const receiver = (conversation.participants || []).find(
        (participant) => getId(participant) !== getId(user)
      );

      if (!isGroup && !receiver) {
        setError("A direct call needs another participant.");
        return;
      }

      setError("");
      await getMedia(callType);
      getChatSocket(token)?.emit(
        "call:start",
        {
          conversationId: getId(conversation),
          receiverId: isGroup ? undefined : getId(receiver),
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

  const joinCall = useCallback(
    async (call) => {
      if (!call?.callId) {
        return;
      }

      setError("");
      await getMedia(call.callType || "audio");
      setActiveCall({
        ...call,
        scope: "group",
        status: "lobby",
      });
      getChatSocket(token)?.emit("call:join", { callId: call.callId });
    },
    [getMedia, token]
  );

  const acceptCall = useCallback(async () => {
    if (!incomingCall) {
      return;
    }

    setError("");
    stopRingtoneRef.current?.();
    stopRingtoneRef.current = null;
    await getMedia(incomingCall.callType);
    const nextCall = {
      ...incomingCall,
      status: incomingCall.scope === "group" ? "lobby" : "connecting",
      peer: incomingCall.caller,
    };
    setActiveCall(nextCall);
    setIncomingCall(null);

    if (incomingCall.scope === "group") {
      getChatSocket(token)?.emit("call:join", { callId: incomingCall.callId });
      return;
    }

    createPeer({
      callId: incomingCall.callId,
      targetUserId: getId(incomingCall.caller),
      stream: localStreamRef.current,
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

  const leaveCall = useCallback(() => {
    const call = activeCallRef.current;

    if (!call) {
      return;
    }

    getChatSocket(token)?.emit(
      call.scope === "group" ? "call:leave" : "call:end",
      { callId: call.callId }
    );
    closeCallUi();
  }, [closeCallUi, token]);

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
    if (!navigator.mediaDevices?.getDisplayMedia) {
      return;
    }

    const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    screenRef.current = displayStream;
    const screenTrack = displayStream.getVideoTracks()[0];

    peersRef.current.forEach((peer) => {
      const sender = peer.getSenders().find((item) => item.track?.kind === "video");
      if (sender && screenTrack) {
        sender.replaceTrack(screenTrack);
      }
    });
    screenTrack.onended = () => {
      const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
      if (!cameraTrack) {
        return;
      }
      peersRef.current.forEach((peer) => {
        const sender = peer.getSenders().find((item) => item.track?.kind === "video");
        sender?.replaceTrack(cameraTrack);
      });
    };
  }, []);

  const toggleRaiseHand = useCallback(() => {
    const call = activeCallRef.current;
    const userId = getId(user);
    const raised = !raisedHands[userId];
    setRaisedHands((current) => ({
      ...current,
      [userId]: raised,
    }));
    if (call?.callId) {
      getChatSocket(token)?.emit("call:raise-hand", {
        callId: call.callId,
        raised,
      });
    }
  }, [raisedHands, token, user]);

  const enterFullscreen = useCallback(() => {
    stageRef.current?.requestFullscreen?.();
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
      setActiveCall({
        ...call,
        status: call.scope === "group" ? "connected" : "ringing",
        peer: call.receiver,
        startedAt: call.startTime || (call.scope === "group" ? new Date().toISOString() : null),
      });
      if (call.scope === "group") {
        setChannelCalls((current) => ({
          ...current,
          [call.conversationId]: call,
        }));
      }
    };
    const handleChannelActive = ({ call }) => {
      setChannelCalls((current) => ({
        ...current,
        [call.conversationId]: call,
      }));
    };
    const handlePresence = (payload = {}) => {
      setCallPresence(payload.presence || {});
    };
    const handleParticipants = (payload = {}) => {
      if (payload.call?.conversationId) {
        setChannelCalls((current) => ({
          ...current,
          [payload.call.conversationId]: payload.call,
        }));
      }
      if (payload.call?.callId === activeCallRef.current?.callId) {
        setParticipants(payload.participants || []);
      }
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
      const targetUserId = getId(currentCall.peer);
      const peer = createPeer({ callId: payload.callId, targetUserId, stream });
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit("call:offer", {
        callId: payload.callId,
        targetUserId,
        description: offer,
      });
      setActiveCall({ ...currentCall, status: "connected", startedAt: payload.startTime });
    };
    const handleJoined = (payload) => {
      const currentCall = activeCallRef.current;
      if (!currentCall || currentCall.callId !== payload.call?.callId) {
        return;
      }

      setActiveCall({
        ...currentCall,
        ...payload.call,
        status: "connected",
        startedAt: payload.call.startTime || currentCall.startedAt,
      });
    };
    const handleParticipantJoined = async (payload) => {
      const currentCall = activeCallRef.current;
      const joinedUserId = getId(payload.user);

      if (
        !currentCall ||
        currentCall.callId !== payload.call?.callId ||
        joinedUserId === getId(user)
      ) {
        return;
      }

      const stream = localStreamRef.current || (await getMedia(currentCall.callType));
      const peer = createPeer({
        callId: currentCall.callId,
        targetUserId: joinedUserId,
        stream,
      });
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit("call:offer", {
        callId: currentCall.callId,
        targetUserId: joinedUserId,
        description: offer,
      });
    };
    const handleParticipantLeft = (payload) => {
      cleanupPeer(String(payload.userId || ""));
    };
    const handleOffer = async (payload) => {
      const currentCall = activeCallRef.current;
      if (!currentCall || currentCall.callId !== payload.callId) {
        return;
      }

      const fromUserId = String(payload.fromUserId);
      const stream = localStreamRef.current || (await getMedia(currentCall.callType));
      const peer = createPeer({
        callId: payload.callId,
        targetUserId: fromUserId,
        stream,
      });
      await peer.setRemoteDescription(payload.description);
      const pendingCandidates = pendingCandidatesRef.current.get(fromUserId) || [];
      await Promise.all(
        pendingCandidates.map((candidate) => peer.addIceCandidate(candidate).catch(() => {}))
      );
      pendingCandidatesRef.current.delete(fromUserId);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit("call:answer", {
        callId: payload.callId,
        targetUserId: fromUserId,
        description: answer,
      });
      setActiveCall({ ...currentCall, status: "connected", startedAt: payload.startTime });
    };
    const handleAnswer = async (payload) => {
      const fromUserId = String(payload.fromUserId);
      const peer = peersRef.current.get(fromUserId);
      if (peer && activeCallRef.current?.callId === payload.callId) {
        await peer.setRemoteDescription(payload.description);
        const pendingCandidates = pendingCandidatesRef.current.get(fromUserId) || [];
        await Promise.all(
          pendingCandidates.map((candidate) => peer.addIceCandidate(candidate).catch(() => {}))
        );
        pendingCandidatesRef.current.delete(fromUserId);
      }
    };
    const handleCandidate = async (payload) => {
      const fromUserId = String(payload.fromUserId);
      const candidate = new RTCIceCandidate(payload.candidate);
      const peer = peersRef.current.get(fromUserId);
      if (peer?.remoteDescription) {
        await peer.addIceCandidate(candidate).catch(() => {});
      } else {
        pendingCandidatesRef.current.set(fromUserId, [
          ...(pendingCandidatesRef.current.get(fromUserId) || []),
          candidate,
        ]);
      }
    };
    const handleRaiseHand = (payload) => {
      setRaisedHands((current) => ({
        ...current,
        [String(payload.userId)]: Boolean(payload.raised),
      }));
    };
    const handleEnded = (payload = {}) => {
      if (payload.conversationId) {
        setChannelCalls((current) => {
          const next = { ...current };
          delete next[payload.conversationId];
          return next;
        });
      }
      closeCallUi();
    };
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
    socket.on("call:channel-active", handleChannelActive);
    socket.on("call:presence", handlePresence);
    socket.on("call:participants", handleParticipants);
    socket.on("call:accepted", handleAccepted);
    socket.on("call:joined", handleJoined);
    socket.on("call:participant-joined", handleParticipantJoined);
    socket.on("call:participant-left", handleParticipantLeft);
    socket.on("call:offer", handleOffer);
    socket.on("call:answer", handleAnswer);
    socket.on("call:ice-candidate", handleCandidate);
    socket.on("call:raise-hand", handleRaiseHand);
    socket.on("call:ended", handleEnded);
    socket.on("call:rejected", handleEnded);
    socket.on("call:missed", handleMissed);
    socket.on("call:left", handleEnded);

    return () => {
      socket.off("call:incoming", handleIncomingCall);
      socket.off("call:outgoing", handleOutgoingCall);
      socket.off("call:channel-active", handleChannelActive);
      socket.off("call:presence", handlePresence);
      socket.off("call:participants", handleParticipants);
      socket.off("call:accepted", handleAccepted);
      socket.off("call:joined", handleJoined);
      socket.off("call:participant-joined", handleParticipantJoined);
      socket.off("call:participant-left", handleParticipantLeft);
      socket.off("call:offer", handleOffer);
      socket.off("call:answer", handleAnswer);
      socket.off("call:ice-candidate", handleCandidate);
      socket.off("call:raise-hand", handleRaiseHand);
      socket.off("call:ended", handleEnded);
      socket.off("call:rejected", handleEnded);
      socket.off("call:missed", handleMissed);
      socket.off("call:left", handleEnded);
    };
  }, [
    cleanupPeer,
    closeCallUi,
    createPeer,
    getMedia,
    notifyIncomingCall,
    token,
    user,
  ]);

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
    peersRef.current.forEach((peer) => {
      const sender = peer.getSenders().find((item) => item.track?.kind === "audio");
      if (sender?.track) {
        sender.track.enabled = !isMuted;
      }
    });
  }, [isMuted]);

  const value = useMemo(
    () => ({
      activeCall,
      callPresence,
      channelCalls,
      error,
      startCall,
      joinCall,
    }),
    [activeCall, callPresence, channelCalls, error, joinCall, startCall]
  );

  const participantById = useMemo(
    () =>
      new Map(
        participants.map((participant) => [
          getId(participant.user),
          participant,
        ])
      ),
    [participants]
  );
  const remoteEntries = Object.entries(remoteStreams);
  const isGroupCall = activeCall?.scope === "group";
  const canEndForEveryone =
    activeCall &&
    (!isGroupCall ||
      getId(activeCall.createdBy || activeCall.callerId) === getId(user) ||
      ["Admin", "Manager"].includes(user?.role));

  return (
    <CallContext.Provider value={value}>
      {children}
      {incomingCall ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[28px] border border-white/70 bg-white p-6 text-center shadow-2xl">
            <Avatar className="mx-auto h-20 w-20 rounded-[28px] border border-blue-100">
              <AvatarFallback className="text-xl">
                {getInitials(incomingCall.caller?.name || incomingCall.channelName)}
              </AvatarFallback>
            </Avatar>
            <h2 className="mt-4 text-xl font-extrabold text-slate-950">
              {incomingCall.scope === "group"
                ? incomingCall.channelName || "Group call"
                : incomingCall.caller?.name || "Incoming call"}
            </h2>
            <p className="mt-1 text-sm font-semibold capitalize text-slate-500">
              Incoming {incomingCall.scope === "group" ? "group " : ""}
              {incomingCall.callType} call
            </p>
            {incomingCall.scope === "group" ? (
              <p className="mt-3 text-xs font-semibold text-slate-500">
                {(incomingCall.participants || []).length} invited
              </p>
            ) : null}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button type="button" variant="destructive" onClick={rejectCall}>
                <PhoneOff className="h-4 w-4" />
                Decline
              </Button>
              <Button type="button" onClick={acceptCall}>
                <Phone className="h-4 w-4" />
                {incomingCall.scope === "group" ? "Join" : "Accept"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {activeCall ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/88 p-3 text-white backdrop-blur-sm">
          <div className="flex h-full max-h-[820px] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-white/12 bg-slate-950 shadow-2xl">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-extrabold">
                  {isGroupCall
                    ? activeCall.channelName || "Group call"
                    : activeCall.peer?.name || "Call"}
                </h2>
                <p className="mt-0.5 text-xs font-semibold text-white/60">
                  {activeCall.status === "ringing" ? "Ringing..." : formatDuration(duration)}
                  {isGroupCall ? ` · ${participants.filter((item) => item.status === "Joined").length || 1} joined` : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="bg-white/10 text-white hover:bg-white/20 hover:text-white"
                onClick={enterFullscreen}
                title="Full screen"
                aria-label="Full screen"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>

            <div ref={stageRef} className="grid min-h-0 flex-1 bg-slate-900 lg:grid-cols-[1fr_260px]">
              <div
                className={cn(
                  "grid min-h-0 gap-3 p-3",
                  isGroupCall
                    ? "auto-rows-fr grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
                    : "grid-cols-1"
                )}
              >
                <div className="relative min-h-[180px] overflow-hidden rounded-2xl border border-white/10 bg-slate-800">
                  {localStream && activeCall.callType === "video" ? (
                    <LocalVideo stream={localStream} />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center">
                      <Avatar className="h-20 w-20 rounded-[28px] border border-white/15">
                        <AvatarFallback className="bg-blue-500 text-2xl text-white">
                          {getInitials(user?.name)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                  <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1 text-xs font-bold">
                    You {isMuted ? "· muted" : ""}
                  </span>
                </div>

                {remoteEntries.length ? (
                  remoteEntries.map(([userId, stream]) => {
                    const participant = participantById.get(userId);
                    const userName = participant?.user?.name || "Participant";

                    return (
                      <div
                        key={userId}
                        className={cn(
                          "relative min-h-[180px] overflow-hidden rounded-2xl border bg-slate-800",
                          raisedHands[userId] ? "border-amber-300" : "border-white/10"
                        )}
                      >
                        <RemoteMedia stream={stream} muted={isSpeakerOff} />
                        <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1 text-xs font-bold">
                          {userName}
                        </span>
                        {raisedHands[userId] ? (
                          <span className="absolute right-3 top-3 rounded-full bg-amber-400 px-2 py-1 text-xs font-black text-slate-950">
                            Hand
                          </span>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-white/15 bg-slate-800/70 px-6 text-center text-sm font-semibold text-white/55">
                    {isGroupCall ? "Waiting for participants to join" : "Waiting for remote media"}
                  </div>
                )}
              </div>

              {isGroupCall ? (
                <aside className="hidden border-l border-white/10 bg-slate-950/70 p-4 lg:block">
                  <div className="flex items-center gap-2 text-sm font-extrabold">
                    <UsersRound className="h-4 w-4" />
                    Participants
                  </div>
                  <div className="mt-4 space-y-2">
                    {participants.map((participant) => {
                      const participantId = getId(participant.user);
                      return (
                        <div
                          key={participantId}
                          className="flex items-center justify-between rounded-2xl bg-white/7 px-3 py-2"
                        >
                          <span className="truncate text-sm font-semibold">
                            {participant.user?.name || "Member"}
                          </span>
                          <span className="text-[11px] font-bold uppercase text-white/45">
                            {raisedHands[participantId] ? "Raised" : participant.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </aside>
              ) : null}
            </div>

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
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn("bg-white/10 text-white hover:bg-white/20 hover:text-white", isCameraOff && "bg-rose-500")}
                onClick={toggleCamera}
                title="Toggle camera"
                aria-label="Toggle camera"
                disabled={activeCall.callType !== "video"}
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
                disabled={activeCall.callType !== "video"}
              >
                <MonitorUp className="h-5 w-5" />
              </Button>
              {isGroupCall ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn("bg-white/10 text-white hover:bg-white/20 hover:text-white", raisedHands[getId(user)] && "bg-amber-400 text-slate-950")}
                  onClick={toggleRaiseHand}
                  title="Raise hand"
                  aria-label="Raise hand"
                >
                  <Hand className="h-5 w-5" />
                </Button>
              ) : null}
              {isGroupCall ? (
                <Button type="button" variant="secondary" onClick={leaveCall}>
                  Leave
                </Button>
              ) : null}
              {canEndForEveryone ? (
                <Button
                  type="button"
                  variant="destructive"
                  size={isGroupCall ? "default" : "icon"}
                  className={cn(!isGroupCall && "h-12 w-12 rounded-full")}
                  onClick={endCall}
                  title="End call"
                  aria-label="End call"
                >
                  <PhoneOff className="h-5 w-5" />
                  {isGroupCall ? "End for all" : null}
                </Button>
              ) : null}
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
