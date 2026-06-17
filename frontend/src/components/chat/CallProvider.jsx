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
const callLog = (message, details = null) => {
  if (details === null || details === undefined) {
    console.log(`[Call] ${message}`);
    return;
  }
  console.log(`[Call] ${message}`, details);
};

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
  bundlePolicy: "max-bundle",
  iceCandidatePoolSize: 8,
  iceTransportPolicy: import.meta.env.VITE_ICE_TRANSPORT_POLICY || "all",
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

const RemoteMedia = ({ stream, muted, onVideoStateChange }) => {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    const updateHasVideo = () => {
      const nextHasVideo = Boolean(
        stream?.getVideoTracks().some((track) => track.readyState === "live" && !track.muted)
      );
      setHasVideo(nextHasVideo);
      onVideoStateChange?.(nextHasVideo);
    };

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play?.().catch(() => {});
        updateHasVideo();
      };
      videoRef.current.play?.().catch(() => {});
    }
    if (audioRef.current) {
      audioRef.current.srcObject = stream;
      audioRef.current.muted = muted;
      audioRef.current.play?.().catch(() => {});
    }
    const watchedTracks = stream?.getVideoTracks() || [];
    watchedTracks.forEach((track) => {
      track.onmute = updateHasVideo;
      track.onunmute = updateHasVideo;
      track.onended = updateHasVideo;
    });
    updateHasVideo();
    stream?.addEventListener?.("addtrack", updateHasVideo);
    stream?.addEventListener?.("removetrack", updateHasVideo);

    return () => {
      watchedTracks.forEach((track) => {
        track.onmute = null;
        track.onunmute = null;
        track.onended = null;
      });
      stream?.removeEventListener?.("addtrack", updateHasVideo);
      stream?.removeEventListener?.("removetrack", updateHasVideo);
    };
  }, [muted, onVideoStateChange, stream]);

  return (
    <>
      {!hasVideo ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-800 text-xs font-bold text-white/45">
          Connecting video
        </div>
      ) : null}
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
      videoRef.current.play?.().catch(() => {});
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

const getPeerUiStatus = (state = "") => {
  if (["connected", "completed"].includes(state)) {
    return "Connected";
  }

  if (["disconnected", "failed"].includes(state)) {
    return "Reconnecting";
  }

  return "Connecting";
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
  const [screenSharers, setScreenSharers] = useState({});
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [peerStatuses, setPeerStatuses] = useState({});
  const peersRef = useRef(new Map());
  const pendingCandidatesRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const cameraTrackRef = useRef(null);
  const outboundVideoTrackRef = useRef(null);
  const stopRingtoneRef = useRef(null);
  const activeCallRef = useRef(null);
  const screenRef = useRef(null);
  const stageRef = useRef(null);
  const negotiatingPeersRef = useRef(new Set());

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
    setPeerStatuses((current) => {
      const next = { ...current };
      delete next[userId];
      return next;
    });
    setRemoteStreams((current) => {
      const next = { ...current };
      delete next[userId];
      return next;
    });
    negotiatingPeersRef.current.delete(userId);
  }, []);

  const cleanupAllPeers = useCallback(() => {
    peersRef.current.forEach((peer) => peer.close());
    peersRef.current.clear();
    pendingCandidatesRef.current.clear();
    setRemoteStreams({});
    setPeerStatuses({});
  }, []);

  const stopStreams = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    cameraTrackRef.current = null;
    outboundVideoTrackRef.current = null;
    screenRef.current = null;
    setLocalStream(null);
    setIsScreenSharing(false);
    setScreenSharers({});
  }, []);

  const negotiatePeer = useCallback(
    async (targetUserId, options = {}) => {
      const currentCall = activeCallRef.current;
      const peer = peersRef.current.get(String(targetUserId));

      if (!currentCall?.callId || !peer || peer.connectionState === "closed") {
        return;
      }

      if (peer.signalingState !== "stable" || negotiatingPeersRef.current.has(String(targetUserId))) {
        callLog("skipping negotiation while peer is not stable", {
          targetUserId,
          signalingState: peer.signalingState,
        });
        return;
      }

      negotiatingPeersRef.current.add(String(targetUserId));
      try {
        const offer = await peer.createOffer(options);
        callLog(options.iceRestart ? "offer created for ICE restart" : "offer created", {
          targetUserId,
          signalingState: peer.signalingState,
        });
        await peer.setLocalDescription(offer);
        getChatSocket(token)?.emit("call:offer", {
          callId: currentCall.callId,
          targetUserId: String(targetUserId),
          description: peer.localDescription || offer,
          iceRestart: Boolean(options.iceRestart),
        });
      } catch (error) {
        callLog("offer negotiation failed", { targetUserId, error });
      } finally {
        negotiatingPeersRef.current.delete(String(targetUserId));
      }
    },
    [token]
  );

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
      callLog("requesting local media", { callType });
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video:
          callType === "video"
            ? {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 24, max: 30 },
              }
            : false,
      });
      localStreamRef.current = stream;
      cameraTrackRef.current = stream.getVideoTracks()[0] || null;
      outboundVideoTrackRef.current = cameraTrackRef.current;
      stream.getTracks().forEach((track) => {
        callLog("local media track acquired", {
          kind: track.kind,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          label: track.label,
        });
        track.onended = () => {
          callLog("local media track ended", { kind: track.kind, label: track.label });
          if (track.kind === "video" && outboundVideoTrackRef.current === track) {
            setIsCameraOff(true);
          }
        };
      });
      setLocalStream(stream);
      return stream;
    } catch (mediaError) {
      callLog("local media request failed", mediaError);
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
        callLog("reusing existing peer connection", { targetUserId: normalizedTargetId });
        return peersRef.current.get(normalizedTargetId);
      }

      callLog("creating peer connection", { callId, targetUserId: normalizedTargetId });
      const peer = new RTCPeerConnection(rtcConfig);
      const nextRemoteStream = new MediaStream();
      updateRemoteStream(normalizedTargetId, nextRemoteStream);
      stream.getTracks().forEach((track) => {
        const outboundTrack =
          track.kind === "video" ? outboundVideoTrackRef.current || track : track;
        callLog("adding local track to peer", {
          targetUserId: normalizedTargetId,
          kind: outboundTrack.kind,
          readyState: outboundTrack.readyState,
          enabled: outboundTrack.enabled,
        });
        peer.addTrack(outboundTrack, stream);
      });
      peer.ontrack = (event) => {
        callLog("track received", {
          fromUserId: normalizedTargetId,
          kind: event.track?.kind,
          streams: event.streams?.length || 0,
          readyState: event.track?.readyState,
        });
        const incomingTracks = event.streams?.[0]?.getTracks()?.length
          ? event.streams[0].getTracks()
          : [event.track].filter(Boolean);
        incomingTracks.forEach((track) => {
          if (!nextRemoteStream.getTracks().some((item) => item.id === track.id)) {
            nextRemoteStream.addTrack(track);
          }
          track.onunmute = () => {
            callLog("remote track unmuted", { fromUserId: normalizedTargetId, kind: track.kind });
            updateRemoteStream(normalizedTargetId, nextRemoteStream);
          };
          track.onmute = () => {
            callLog("remote track muted", { fromUserId: normalizedTargetId, kind: track.kind });
          };
          track.onended = () => {
            callLog("remote track ended", { fromUserId: normalizedTargetId, kind: track.kind });
            if (track.kind === "video") {
              window.setTimeout(() => {
                const stillMissing = !nextRemoteStream
                  .getVideoTracks()
                  .some((item) => item.readyState === "live" && !item.muted);
                if (stillMissing && peer.connectionState !== "closed") {
                  negotiatePeer(normalizedTargetId, { iceRestart: true });
                }
              }, 800);
            }
          };
        });
        updateRemoteStream(normalizedTargetId, nextRemoteStream);
      };
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          callLog("ICE candidate sent", {
            targetUserId: normalizedTargetId,
            candidateType: event.candidate.type,
            protocol: event.candidate.protocol,
          });
          getChatSocket(token)?.emit("call:ice-candidate", {
            callId,
            targetUserId: normalizedTargetId,
            candidate: event.candidate,
          });
        }
      };
      const restartIce = async () => {
        const currentCall = activeCallRef.current;

        if (
          !currentCall?.callId ||
          peer.signalingState !== "stable" ||
          peer.connectionState === "closed"
        ) {
          return;
        }

        try {
          peer.restartIce?.();
          await negotiatePeer(normalizedTargetId, { iceRestart: true });
        } catch {
          cleanupPeer(normalizedTargetId);
        }
      };
      peer.onsignalingstatechange = () => {
        callLog("signalingState changed", {
          targetUserId: normalizedTargetId,
          signalingState: peer.signalingState,
        });
      };
      peer.oniceconnectionstatechange = () => {
        const state = peer.iceConnectionState;
        callLog("iceConnectionState changed", {
          targetUserId: normalizedTargetId,
          iceConnectionState: state,
        });
        setPeerStatuses((current) => ({
          ...current,
          [normalizedTargetId]: state,
        }));

        if (state === "failed") {
          restartIce();
        }
      };
      peer.onconnectionstatechange = () => {
        const state = peer.connectionState;
        callLog("connectionState changed", {
          targetUserId: normalizedTargetId,
          connectionState: state,
          iceConnectionState: peer.iceConnectionState,
          signalingState: peer.signalingState,
        });
        setPeerStatuses((current) => ({
          ...current,
          [normalizedTargetId]: state,
        }));

        if (state === "failed") {
          restartIce();
        } else if (state === "disconnected") {
          window.setTimeout(() => {
            if (peer.connectionState === "disconnected") {
              restartIce();
            }
          }, 1200);
        } else if (state === "closed") {
          cleanupPeer(normalizedTargetId);
        }
      };
      setPeerStatuses((current) => ({
        ...current,
        [normalizedTargetId]: "connecting",
      }));
      peersRef.current.set(normalizedTargetId, peer);
      return peer;
    },
    [cleanupPeer, negotiatePeer, token, updateRemoteStream]
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

  const toggleCamera = useCallback(async () => {
    const nextOff = !isCameraOff;
    let cameraTrack = cameraTrackRef.current || localStreamRef.current?.getVideoTracks()[0];

    if (!cameraTrack && !nextOff) {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24, max: 30 },
        },
      });
      cameraTrack = cameraStream.getVideoTracks()[0] || null;
      if (cameraTrack) {
        cameraTrackRef.current = cameraTrack;
        outboundVideoTrackRef.current = cameraTrack;
        localStreamRef.current?.addTrack(cameraTrack);
        setLocalStream(new MediaStream(localStreamRef.current?.getTracks() || []));
        peersRef.current.forEach((peer, targetUserId) => {
          if (!peer.getSenders().some((sender) => sender.track?.kind === "video")) {
            peer.addTrack(cameraTrack, localStreamRef.current);
          }
          negotiatePeer(targetUserId);
        });
      }
    }

    if (cameraTrack) {
      cameraTrack.enabled = !nextOff;
    }
    setIsCameraOff(nextOff);
  }, [isCameraOff, negotiatePeer]);

  const stopScreenShare = useCallback(() => {
    const call = activeCallRef.current;
    const cameraTrack = cameraTrackRef.current || localStreamRef.current?.getVideoTracks()[0];

    screenRef.current?.getTracks().forEach((track) => track.stop());
    screenRef.current = null;
    setIsScreenSharing(false);

    if (cameraTrack) {
      outboundVideoTrackRef.current = cameraTrack;
      peersRef.current.forEach((peer, targetUserId) => {
        const sender = peer.getSenders().find((item) => item.track?.kind === "video");
        if (sender) {
          sender.replaceTrack(cameraTrack);
        } else {
          peer.addTrack(cameraTrack, localStreamRef.current);
        }
        negotiatePeer(targetUserId);
      });
    }

    if (call?.callId) {
      getChatSocket(token)?.emit("call:screen-share-stopped", { callId: call.callId });
    }
    callLog("screen share stopped");
  }, [negotiatePeer, token]);

  const shareScreen = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      return;
    }

    if (isScreenSharing) {
      stopScreenShare();
      return;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
          frameRate: { ideal: 15, max: 24 },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      const screenTrack = displayStream.getVideoTracks()[0];
      if (!screenTrack) {
        return;
      }

      screenRef.current = displayStream;
      outboundVideoTrackRef.current = screenTrack;
      setIsScreenSharing(true);
      callLog("screen share started", {
        label: screenTrack.label,
        readyState: screenTrack.readyState,
      });

      peersRef.current.forEach((peer, targetUserId) => {
        const sender = peer.getSenders().find((item) => item.track?.kind === "video");
        if (sender) {
          sender.replaceTrack(screenTrack);
        } else {
          peer.addTrack(screenTrack, localStreamRef.current || displayStream);
        }
        negotiatePeer(targetUserId);
      });

      const call = activeCallRef.current;
      if (call?.callId) {
        getChatSocket(token)?.emit("call:screen-share-started", { callId: call.callId });
      }

      screenTrack.onended = stopScreenShare;
    } catch (screenError) {
      callLog("screen share failed", screenError);
      setError("Screen sharing could not be started.");
    }
  }, [isScreenSharing, negotiatePeer, stopScreenShare, token]);

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
        const nextParticipants = payload.participants || [];
        const joinedIds = new Set(
          nextParticipants
            .filter((participant) => participant.status === "Joined")
            .map((participant) => getId(participant.user))
        );

        peersRef.current.forEach((_peer, userId) => {
          if (!joinedIds.has(userId)) {
            cleanupPeer(userId);
          }
        });
        setParticipants(nextParticipants);
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
      createPeer({ callId: payload.callId, targetUserId, stream });
      await negotiatePeer(targetUserId);
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
      window.setTimeout(async () => {
        const stream = localStreamRef.current || (await getMedia(currentCall.callType));
        (payload.existingParticipantIds || [])
          .map(String)
          .filter((participantId) => participantId && participantId !== getId(user))
          .forEach((participantId) => {
            if (!peersRef.current.has(participantId)) {
              createPeer({
                callId: payload.call.callId,
                targetUserId: participantId,
                stream,
              });
              negotiatePeer(participantId);
            }
          });
      }, 1500);
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
      createPeer({
        callId: currentCall.callId,
        targetUserId: joinedUserId,
        stream,
      });
      await negotiatePeer(joinedUserId);
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
      if (peer.signalingState !== "stable") {
        await Promise.all([
          peer.setLocalDescription({ type: "rollback" }).catch(() => {}),
        ]);
      }
      await peer.setRemoteDescription(payload.description);
      callLog("remote description set", {
        fromUserId,
        type: payload.description?.type,
        iceRestart: Boolean(payload.iceRestart),
      });
      const pendingCandidates = pendingCandidatesRef.current.get(fromUserId) || [];
      await Promise.all(
        pendingCandidates.map((candidate) => peer.addIceCandidate(candidate).catch(() => {}))
      );
      pendingCandidatesRef.current.delete(fromUserId);
      const answer = await peer.createAnswer();
      callLog("answer created", { targetUserId: fromUserId });
      await peer.setLocalDescription(answer);
      socket.emit("call:answer", {
        callId: payload.callId,
        targetUserId: fromUserId,
        description: peer.localDescription || answer,
      });
      setActiveCall({ ...currentCall, status: "connected", startedAt: payload.startTime });
    };
    const handleAnswer = async (payload) => {
      const fromUserId = String(payload.fromUserId);
      const peer = peersRef.current.get(fromUserId);
      if (peer && activeCallRef.current?.callId === payload.callId) {
        await peer.setRemoteDescription(payload.description);
        callLog("remote description set", {
          fromUserId,
          type: payload.description?.type,
        });
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
      callLog("ICE candidate received", {
        fromUserId,
        candidateType: payload.candidate?.type,
        protocol: payload.candidate?.protocol,
      });
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
    const handleScreenShareStarted = (payload = {}) => {
      setScreenSharers((current) => ({
        ...current,
        [String(payload.userId)]: true,
      }));
    };
    const handleScreenShareStopped = (payload = {}) => {
      setScreenSharers((current) => {
        const next = { ...current };
        delete next[String(payload.userId)];
        return next;
      });
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
    socket.on("call:screen-share-started", handleScreenShareStarted);
    socket.on("call:screen-share-stopped", handleScreenShareStopped);
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
      socket.off("call:screen-share-started", handleScreenShareStarted);
      socket.off("call:screen-share-stopped", handleScreenShareStopped);
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
    negotiatePeer,
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
  const joinedParticipantCount =
    participants.filter((item) => item.status === "Joined").length ||
    (remoteEntries.length + (activeCall ? 1 : 0));
  const stageTileCount = Math.max(1, remoteEntries.length || 1);
  const stageGridClass =
    stageTileCount === 1
      ? "grid-cols-1"
      : stageTileCount === 2
        ? "grid-cols-1 md:grid-cols-2"
        : stageTileCount <= 4
          ? "grid-cols-1 sm:grid-cols-2"
          : stageTileCount <= 9
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
  const getConnectionLabel = (userId) => {
    const status = peerStatuses[userId];
    if (["connected", "completed"].includes(status)) {
      return "Good";
    }
    if (["failed", "disconnected"].includes(status)) {
      return "Reconnecting";
    }
    return "Connecting";
  };

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

            <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden bg-slate-900">
              <div
                className={cn(
                  "relative grid h-full min-h-0 gap-2 overflow-y-auto p-2 sm:gap-3 sm:p-3",
                  remoteEntries.length ? stageGridClass : "grid-cols-1"
                )}
              >
                <div
                  className={cn(
                    "relative min-h-[240px] overflow-hidden rounded-lg border border-white/10 bg-slate-800",
                    !remoteEntries.length && "min-h-full",
                    remoteEntries.length &&
                      "absolute bottom-4 right-4 z-20 h-28 min-h-0 w-40 shadow-2xl sm:h-36 sm:w-56"
                  )}
                >
                  {localStream && !isCameraOff ? (
                    <LocalVideo stream={localStream} />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center">
                      <Avatar className="h-20 w-20 rounded-lg border border-white/15">
                        <AvatarFallback className="bg-blue-500 text-2xl text-white">
                          {getInitials(user?.name)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                  <span className="absolute bottom-3 left-3 max-w-[75%] truncate rounded-full bg-black/60 px-3 py-1 text-xs font-bold">
                    You {isMuted ? "· muted" : ""}
                  </span>
                  {isScreenSharing ? (
                    <span className="absolute right-2 top-2 rounded-full bg-emerald-400 px-2 py-1 text-[10px] font-black uppercase text-slate-950">
                      Sharing
                    </span>
                  ) : null}
                </div>

                {remoteEntries.length ? (
                  remoteEntries.map(([userId, stream]) => {
                    const participant = participantById.get(userId);
                    const userName =
                      participant?.user?.name ||
                      (!isGroupCall ? activeCall.peer?.name : "") ||
                      "Participant";

                    return (
                      <div
                        key={userId}
                        className={cn(
                          "relative min-h-[210px] overflow-hidden rounded-lg border bg-slate-800 shadow-lg",
                          stageTileCount === 1 && "min-h-full",
                          raisedHands[userId] ||
                            ["connected", "completed"].includes(peerStatuses[userId])
                            ? "border-emerald-300/70"
                            : "border-white/10"
                        )}
                      >
                        <RemoteMedia stream={stream} muted={isSpeakerOff} />
                        <div className="absolute bottom-3 left-3 flex max-w-[75%] items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-bold">
                          <span className="truncate">{userName}</span>
                          {screenSharers[userId] ? <MonitorUp className="h-3.5 w-3.5" /> : null}
                        </div>
                        <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-1 text-[10px] font-black uppercase text-white/70">
                          {getConnectionLabel(userId)}
                        </span>
                        {raisedHands[userId] ? (
                          <span className="absolute right-3 top-11 rounded-full bg-amber-400 px-2 py-1 text-xs font-black text-slate-950">
                            Hand
                          </span>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="hidden">
                    {isGroupCall ? "Waiting for participants to join" : "Waiting for remote media"}
                  </div>
                )}
              </div>

              {false && isGroupCall ? (
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
