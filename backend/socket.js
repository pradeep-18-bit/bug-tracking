const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const Conversation = require("./models/Conversation.model");
const User = require("./models/User");
const {
  CHAT_ACCESS_ROLES,
  createMessageDocument,
  loadConversationForUser,
  markConversationSeen,
} = require("./controllers/chat.controller");
const { normalizeWorkspaceId } = require("./utils/workspace");

const onlineUsersByWorkspace = new Map();
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

const roomName = (conversationId) => `conversation:${conversationId}`;
const userRoomName = (userId) => `user:${userId}`;
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

const emitOnlineUsers = (io, workspaceId) => {
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
  const onlineUsers = getOnlineUsers(normalizedWorkspaceId);

  io.sockets.sockets.forEach((socket) => {
    if (socket.user?.workspaceId === normalizedWorkspaceId) {
      socket.emit("online_users", onlineUsers);
    }
  });
};

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
    transports: ["websocket", "polling"],
  });
  socketServer = io;

  io.use((socket, next) => {
    console.log(`[Socket] Connection attempt: ${socket.id}`);
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

  const userIdStr = String(userId);
  let emitted = false;

  socketServer.sockets.sockets.forEach((socket) => {
    if (String(socket.user?._id || socket.user?.id) === userIdStr) {
      socket.emit(eventName, payload);
      emitted = true;
    }
  });

  return emitted;
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
