import { io } from "socket.io-client";
import { readStoredSession } from "@/lib/session";

let socket;

const resolveSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "";

  if (/^https?:\/\//i.test(apiBaseUrl)) {
    return apiBaseUrl.replace(/\/api\/?$/, "");
  }

  return window.location.origin;
};

export const getChatSocket = (token) => {
  const session = readStoredSession();
  const authToken = token || session?.token;

  if (!authToken) {
    return null;
  }

  if (socket) {
    if (socket.auth?.token !== authToken) {
      socket.auth = {
        token: authToken,
      };

      if (socket.connected) {
        socket.disconnect().connect();
      }
    }

    return socket;
  }

  socket = io(resolveSocketUrl(), {
    auth: {
      token: authToken,
    },
    autoConnect: false,
    transports: ["websocket", "polling"],
    upgrade: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 300,
    reconnectionDelayMax: 2500,
    randomizationFactor: 0.25,
    timeout: 12000,
    withCredentials: true,
  });

  return socket;
};

export const disconnectChatSocket = () => {
  if (!socket) {
    return;
  }

  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
};
