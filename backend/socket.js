const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const CallLog = require("./models/CallLog.model");
const Conversation = require("./models/Conversation.model");
const User = require("./models/User");
const {
  CHAT_ACCESS_ROLES,
  createMessageDocument,
  createSystemMessageDocument,
  loadConversationForUser,
  markConversationSeen,
} = require("./controllers/chat.controller");
const { normalizeWorkspaceId } = require("./utils/workspace");

const onlineUsersByWorkspace = new Map();
const callPresenceByWorkspace = new Map();
const activeCalls = new Map();
const socketUsers = new Map();
let socketServer = null;

const getAllowedOrigins = () => {
  const configuredOrigins = [
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGIN,
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return configuredOrigins.length ? configuredOrigins : true;
};

const roomName = (conversationId) => `conversation:${objectIdString(conversationId)}`;
const userRoomName = (userId) => `user:${objectIdString(userId)}`;
const workspaceRoomName = (workspaceId) =>
  `workspace:${normalizeWorkspaceId(workspaceId)}`;

const objectIdString = (value) => String(value?._id || value?.id || value || "");

const addOnlineUser = (user, socketId) => {
  const workspaceId = normalizeWorkspaceId(user.workspaceId);
  const userId = String(user._id);
  const workspaceUsers =
    onlineUsersByWorkspace.get(workspaceId) || new Map();
  const userSockets = workspaceUsers.get(userId) || new Set();

  userSockets.add(socketId);
  workspaceUsers.set(userId, userSockets);
  onlineUsersByWorkspace.set(workspaceId, workspaceUsers);
  socketUsers.set(socketId, {
    userId,
    workspaceId,
  });
};

const removeOnlineUser = (socketId) => {
  const socketUser = socketUsers.get(socketId);

  if (!socketUser) {
    return;
  }

  const workspaceUsers = onlineUsersByWorkspace.get(socketUser.workspaceId);
  const userSockets = workspaceUsers?.get(socketUser.userId);

  userSockets?.delete(socketId);

  if (userSockets && userSockets.size === 0) {
    workspaceUsers.delete(socketUser.userId);
  }

  if (workspaceUsers && workspaceUsers.size === 0) {
    onlineUsersByWorkspace.delete(socketUser.workspaceId);
  }

  socketUsers.delete(socketId);
};

const getOnlineUsers = (workspaceId) =>
  Array.from(onlineUsersByWorkspace.get(normalizeWorkspaceId(workspaceId))?.keys() || []);

const getCallPresence = (workspaceId) =>
  Object.fromEntries(callPresenceByWorkspace.get(normalizeWorkspaceId(workspaceId)) || []);

const emitOnlineUsers = (io, workspaceId) => {
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
  const onlineUsers = getOnlineUsers(normalizedWorkspaceId);

  console.log(
    `[Socket] Broadcasting online users to workspace ${normalizedWorkspaceId}: ${onlineUsers.length} users`
  );

  io.to(workspaceRoomName(normalizedWorkspaceId)).emit("online_users", onlineUsers);
};

const setCallPresence = (io, workspaceId, userIds = [], status = "online") => {
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
  const workspacePresence =
    callPresenceByWorkspace.get(normalizedWorkspaceId) || new Map();

  userIds.filter(Boolean).forEach((userId) => {
    const normalizedUserId = objectIdString(userId);

    if (status === "online") {
      workspacePresence.delete(normalizedUserId);
    } else {
      workspacePresence.set(normalizedUserId, status);
    }
  });

  if (workspacePresence.size) {
    callPresenceByWorkspace.set(normalizedWorkspaceId, workspacePresence);
  } else {
    callPresenceByWorkspace.delete(normalizedWorkspaceId);
  }

  io.to(workspaceRoomName(normalizedWorkspaceId)).emit("call:presence", {
    presence: getCallPresence(normalizedWorkspaceId),
  });
};

const emitCallMessage = async ({ io, call, actor, message }) => {
  const createdMessage = await createSystemMessageDocument({
    conversationId: call.conversationId,
    sender: actor,
    message,
  });
  const conversation = await loadConversationForUser(call.conversationId, actor, {
    lean: true,
  });
  const participantRooms = (conversation?.participants || [])
    .map((participant) => userRoomName(objectIdString(participant)))
    .filter(Boolean);

  io.to([roomName(call.conversationId), ...participantRooms]).emit(
    "receive_message",
    {
      message: createdMessage,
      conversationId: objectIdString(call.conversationId),
      conversation,
    }
  );
};

const formatCallDuration = (seconds = 0) => {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  if (minutes <= 0) {
    return `${remainingSeconds}s`;
  }

  return `${minutes}m ${remainingSeconds}s`;
};

const serializeCall = (call, extras = {}) => ({
  callId: objectIdString(call._id),
  conversationId: objectIdString(call.conversationId),
  callerId: objectIdString(call.callerId),
  receiverId: objectIdString(call.receiverId),
  callType: call.callType,
  status: call.status,
  startTime: call.startTime,
  ...extras,
});

const authenticateSocket = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(" ")[1]?.trim();

    if (!token) {
      console.warn(`[Socket Auth] Missing token for socket: ${socket.id}`);
      throw new Error("Authentication token is required");
    }

    if (!process.env.JWT_SECRET) {
      console.error("[Socket Auth] JWT secret is not configured");
      throw new Error("JWT secret is not configured");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded?.id) {
      console.warn(`[Socket Auth] Invalid token for socket: ${socket.id}`);
      throw new Error("Invalid token");
    }

    const user = await User.findById(decoded.id).select("-password").lean();

    if (!user || !CHAT_ACCESS_ROLES.includes(user.role)) {
      console.warn(
        `[Socket Auth] Unauthorized role or user not found for socket: ${socket.id}`
      );
      throw new Error("Unauthorized");
    }

    socket.user = {
      ...decoded,
      ...user,
      id: String(user._id),
      _id: user._id,
      workspaceId: normalizeWorkspaceId(user.workspaceId || decoded.workspaceId),
    };

    console.log(
      `[Socket Auth] Authenticated user ${user.name} (${user.email}) for socket: ${socket.id}`
    );
    next();
  } catch (error) {
    console.error(`[Socket Auth] Error for socket ${socket.id}: ${error.message}`);
    next(new Error(error?.message || "Socket authentication failed"));
  }
};

const setupChatSocket = (server) => {
  console.log("[Socket] Initializing Socket.IO server...");
  const io = new Server(server, {
    cors: {
      origin: getAllowedOrigins(),
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 45000,
    allowEIO3: true,
  });
  socketServer = io;

  io.use((socket, next) => {
    console.log(
      `[Socket] Connection attempt: ${socket.id} (Transport: ${socket.conn.transport.name})`
    );
    authenticateSocket(socket, next);
  });

  io.on("connection", async (socket) => {
    console.log(`[Socket] Client connected: ${socket.id} (User: ${socket.user?.name})`);
    addOnlineUser(socket.user, socket.id);
    socket.join(userRoomName(socket.user._id));
    socket.join(workspaceRoomName(socket.user.workspaceId));
    emitOnlineUsers(io, socket.user.workspaceId);

    const joinConversation = async (conversationId, callback) => {
      const conversation = await loadConversationForUser(conversationId, socket.user, {
        lean: true,
      });

      if (!conversation) {
        callback?.({
          ok: false,
          error: "Conversation not found or inaccessible",
        });
        return null;
      }

      socket.join(roomName(conversation._id));
      callback?.({
        ok: true,
        conversationId: String(conversation._id),
      });
      return conversation;
    };

    socket.on("join_conversation", async (payload = {}, callback) => {
      try {
        await joinConversation(payload.conversationId || payload, callback);
      } catch (error) {
        callback?.({
          ok: false,
          error: error?.message || "Unable to join conversation",
        });
      }
    });

    socket.on("send_message", async (payload = {}, callback) => {
      try {
        const conversation = await joinConversation(payload.conversationId);

        if (!conversation) {
          throw new Error("Conversation not found or inaccessible");
        }

        const message = await createMessageDocument({
          conversationId: conversation._id,
          sender: socket.user,
          message: payload.message,
          attachments: payload.attachments,
        });
        const eventPayload = {
          message,
          conversationId: String(conversation._id),
          conversation,
          tempId: payload.tempId || null,
        };
        const participantRooms = (conversation.participants || [])
          .map((participant) => userRoomName(objectIdString(participant)))
          .filter(Boolean);

        io.to([roomName(conversation._id), ...participantRooms]).emit(
          "receive_message",
          eventPayload
        );
        callback?.({
          ok: true,
          ...eventPayload,
        });
      } catch (error) {
        callback?.({
          ok: false,
          tempId: payload.tempId || null,
          error: error?.message || "Unable to send message",
        });
      }
    });

    socket.on("typing", async (payload = {}) => {
      const conversation = await Conversation.findOne({
        _id: payload.conversationId,
        workspaceId: socket.user.workspaceId,
        participants: socket.user._id,
      })
        .select("_id")
        .lean();

      if (!conversation) {
        return;
      }

      socket.to(roomName(conversation._id)).emit("user_typing", {
        conversationId: String(conversation._id),
        userId: String(socket.user._id),
        user: {
          _id: socket.user._id,
          name: socket.user.name,
          email: socket.user.email,
          role: socket.user.role,
        },
      });
    });

    socket.on("stop_typing", async (payload = {}) => {
      const conversation = await Conversation.findOne({
        _id: payload.conversationId,
        workspaceId: socket.user.workspaceId,
        participants: socket.user._id,
      })
        .select("_id")
        .lean();

      if (!conversation) {
        return;
      }

      socket.to(roomName(conversation._id)).emit("user_typing", {
        conversationId: String(conversation._id),
        userId: String(socket.user._id),
        user: {
          _id: socket.user._id,
          name: socket.user.name,
          email: socket.user.email,
          role: socket.user.role,
        },
        stopped: true,
      });
    });

    socket.on("mark_seen", async (payload = {}, callback) => {
      try {
        const conversationId = payload.conversationId || payload;
        const result = await markConversationSeen({
          conversationId,
          user: socket.user,
        });

        if (!result.matched) {
          throw new Error("Conversation not found or inaccessible");
        }

        io.to(roomName(conversationId)).emit("message_seen", {
          conversationId: String(conversationId),
          userId: String(socket.user._id),
          seenAt: new Date().toISOString(),
        });
        callback?.({
          ok: true,
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        callback?.({
          ok: false,
          error: error?.message || "Unable to mark messages as seen",
        });
      }
    });

    socket.on("call:start", async (payload = {}, callback) => {
      try {
        const callType = payload.callType === "video" ? "video" : "audio";
        const conversation = await loadConversationForUser(
          payload.conversationId,
          socket.user,
          { lean: true }
        );

        if (!conversation || conversation.type !== "direct") {
          throw new Error("Calls are available for direct conversations");
        }

        const receiverId = objectIdString(payload.receiverId);
        const participantIds = (conversation.participants || []).map(objectIdString);

        if (
          !receiverId ||
          receiverId === objectIdString(socket.user._id) ||
          !participantIds.includes(receiverId)
        ) {
          throw new Error("Call receiver is not part of this conversation");
        }

        const receiver = (conversation.participants || []).find(
          (participant) => objectIdString(participant) === receiverId
        );
        const call = await CallLog.create({
          conversationId: conversation._id,
          callerId: socket.user._id,
          receiverId,
          participants: [socket.user._id, receiverId],
          workspaceId: socket.user.workspaceId,
          callType,
          status: "Ringing",
        });
        const timeoutId = setTimeout(async () => {
          const currentCall = activeCalls.get(objectIdString(call._id));

          if (!currentCall || currentCall.status !== "Ringing") {
            return;
          }

          const endedAt = new Date();
          const missedCall = await CallLog.findByIdAndUpdate(
            call._id,
            {
              status: "Missed",
              endTime: endedAt,
              duration: 0,
            },
            { new: true }
          ).lean();

          activeCalls.delete(objectIdString(call._id));
          setCallPresence(io, socket.user.workspaceId, [socket.user._id, receiverId], "online");
          io.to([userRoomName(socket.user._id), userRoomName(receiverId)]).emit(
            "call:missed",
            serializeCall(missedCall)
          );
          await emitCallMessage({
            io,
            call: missedCall,
            actor: socket.user,
            message: `${callType === "video" ? "Video" : "Audio"} missed call`,
          });
        }, 30000);

        activeCalls.set(objectIdString(call._id), {
          callerId: objectIdString(socket.user._id),
          receiverId,
          workspaceId: socket.user.workspaceId,
          status: "Ringing",
          timeoutId,
        });
        setCallPresence(io, socket.user.workspaceId, [socket.user._id], "ringing");
        setCallPresence(io, socket.user.workspaceId, [receiverId], "ringing");

        const caller = {
          _id: socket.user._id,
          name: socket.user.name,
          email: socket.user.email,
          role: socket.user.role,
        };
        const basePayload = serializeCall(call, {
          caller,
          receiver,
          createdAt: call.createdAt,
        });

        io.to(userRoomName(receiverId)).emit("call:incoming", basePayload);
        io.to(userRoomName(socket.user._id)).emit("call:outgoing", basePayload);
        await emitCallMessage({
          io,
          call,
          actor: socket.user,
          message: `${callType === "video" ? "Video" : "Audio"} call started`,
        });
        callback?.({ ok: true, call: basePayload });
      } catch (error) {
        callback?.({
          ok: false,
          error: error?.message || "Unable to start call",
        });
      }
    });

    socket.on("call:accept", async (payload = {}, callback) => {
      try {
        const call = await CallLog.findOne({
          _id: payload.callId,
          receiverId: socket.user._id,
          workspaceId: socket.user.workspaceId,
          status: "Ringing",
        });

        if (!call) {
          throw new Error("Call is no longer available");
        }

        const activeCall = activeCalls.get(objectIdString(call._id));
        clearTimeout(activeCall?.timeoutId);
        const startTime = new Date();
        call.status = "Answered";
        call.startTime = startTime;
        await call.save();
        activeCalls.set(objectIdString(call._id), {
          ...(activeCall || {}),
          callerId: objectIdString(call.callerId),
          receiverId: objectIdString(call.receiverId),
          workspaceId: call.workspaceId,
          status: "Answered",
        });
        setCallPresence(io, call.workspaceId, [call.callerId, call.receiverId], "in-call");
        io.to([userRoomName(call.callerId), userRoomName(call.receiverId)]).emit(
          "call:accepted",
          serializeCall(call, { startTime })
        );
        callback?.({ ok: true, call: serializeCall(call, { startTime }) });
      } catch (error) {
        callback?.({
          ok: false,
          error: error?.message || "Unable to accept call",
        });
      }
    });

    socket.on("call:reject", async (payload = {}, callback) => {
      try {
        const call = await CallLog.findOne({
          _id: payload.callId,
          receiverId: socket.user._id,
          workspaceId: socket.user.workspaceId,
          status: "Ringing",
        });

        if (!call) {
          return callback?.({ ok: false, error: "Call is no longer available" });
        }

        const activeCall = activeCalls.get(objectIdString(call._id));
        clearTimeout(activeCall?.timeoutId);
        call.status = "Rejected";
        call.endTime = new Date();
        call.duration = 0;
        await call.save();
        activeCalls.delete(objectIdString(call._id));
        setCallPresence(io, call.workspaceId, [call.callerId, call.receiverId], "online");
        io.to([userRoomName(call.callerId), userRoomName(call.receiverId)]).emit(
          "call:rejected",
          serializeCall(call)
        );
        await emitCallMessage({
          io,
          call,
          actor: socket.user,
          message: `${call.callType === "video" ? "Video" : "Audio"} call rejected`,
        });
        callback?.({ ok: true });
      } catch (error) {
        callback?.({ ok: false, error: error?.message || "Unable to reject call" });
      }
    });

    socket.on("call:end", async (payload = {}, callback) => {
      try {
        const call = await CallLog.findOne({
          _id: payload.callId,
          workspaceId: socket.user.workspaceId,
          participants: socket.user._id,
        });

        if (!call) {
          return callback?.({ ok: false, error: "Call not found" });
        }

        const activeCall = activeCalls.get(objectIdString(call._id));
        clearTimeout(activeCall?.timeoutId);
        const endTime = new Date();
        const startTime = call.startTime || call.createdAt;
        const duration =
          call.status === "Answered"
            ? Math.max(1, Math.round((endTime - startTime) / 1000))
            : 0;
        call.endTime = endTime;
        call.duration = duration;
        call.status = call.status === "Answered" ? "Ended" : "Missed";
        await call.save();
        activeCalls.delete(objectIdString(call._id));
        setCallPresence(io, call.workspaceId, [call.callerId, call.receiverId], "online");
        io.to([userRoomName(call.callerId), userRoomName(call.receiverId)]).emit(
          "call:ended",
          serializeCall(call, { duration })
        );
        await emitCallMessage({
          io,
          call,
          actor: socket.user,
          message:
            call.status === "Ended"
              ? `${call.callType === "video" ? "Video" : "Audio"} call ended - ${formatCallDuration(duration)}`
              : `${call.callType === "video" ? "Video" : "Audio"} missed call`,
        });
        callback?.({ ok: true, call: serializeCall(call, { duration }) });
      } catch (error) {
        callback?.({ ok: false, error: error?.message || "Unable to end call" });
      }
    });

    ["offer", "answer", "ice-candidate"].forEach((eventName) => {
      socket.on(`call:${eventName}`, async (payload = {}) => {
        const call = await CallLog.findOne({
          _id: payload.callId,
          workspaceId: socket.user.workspaceId,
          participants: socket.user._id,
        })
          .select("_id participants workspaceId startTime")
          .lean();

        if (!call) {
          return;
        }

        const targetUserId = objectIdString(payload.targetUserId);
        const participantIds = (call.participants || []).map(objectIdString);

        if (!participantIds.includes(targetUserId)) {
          return;
        }

        socket.to(userRoomName(targetUserId)).emit(`call:${eventName}`, {
          ...payload,
          fromUserId: objectIdString(socket.user._id),
          startTime: call.startTime,
        });
      });
    });

    socket.on("disconnect", (reason) => {
      console.log(`[Socket] Client disconnected: ${socket.id} (Reason: ${reason})`);
      removeOnlineUser(socket.id);
      emitOnlineUsers(io, socket.user.workspaceId);
    });
  });

  return io;
};

const emitWorkspaceEvent = (workspaceId, eventName, payload = {}) => {
  if (!socketServer || !workspaceId || !eventName) {
    return false;
  }

  socketServer.to(workspaceRoomName(workspaceId)).emit(eventName, payload);
  return true;
};

const emitToUser = (userId, eventName, payload = {}) => {
  if (!socketServer || !userId || !eventName) {
    return false;
  }

  const targetRoom = userRoomName(userId);
  const socketsInRoom = socketServer.sockets.adapter.rooms.get(targetRoom);
  const isOnline = socketsInRoom && socketsInRoom.size > 0;

  console.log(
    `[Socket] Emitting event "${eventName}" to user: ${objectIdString(
      userId
    )} (Online: ${Boolean(isOnline)})`
  );

  socketServer.to(targetRoom).emit(eventName, payload);

  return Boolean(isOnline);
};

const emitBugWorkflowEvent = ({
  workspaceId,
  eventName = "BugUpdated",
  bug = null,
  issue = null,
  action = "",
  actor = null,
  meta = {},
}) =>
  emitWorkspaceEvent(workspaceId, eventName, {
    action,
    bug: bug || issue || null,
    issue: issue || bug || null,
    actor: actor
      ? {
          _id: actor._id || actor.id || null,
          name: actor.name || "",
          email: actor.email || "",
          role: actor.role || "",
        }
      : null,
    meta,
    emittedAt: new Date().toISOString(),
  });

module.exports = {
  emitBugWorkflowEvent,
  emitWorkspaceEvent,
  emitToUser,
  getOnlineUsers,
  setupChatSocket,
};
