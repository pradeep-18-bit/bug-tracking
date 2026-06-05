import { useCallback, useEffect, useMemo, useState } from "react";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatWindow from "@/components/chat/ChatWindow";
import { useAuth } from "@/hooks/use-auth";
import { useChatStore } from "@/lib/chatStore";
import { disconnectChatSocket, getChatSocket } from "@/lib/socket";

const getId = (value) => String(value?._id || value?.id || value || "");

const ChatPage = () => {
  const { token, user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const conversations = useChatStore((state) => state.conversations);
  const hasMoreByConversation = useChatStore((state) => state.hasMoreByConversation);
  const isLoadingMessages = useChatStore((state) => state.isLoadingMessages);
  const messagesByConversation = useChatStore((state) => state.messagesByConversation);
  const onlineUsers = useChatStore((state) => state.onlineUsers);
  const searchResults = useChatStore((state) => state.searchResults);
  const typingByConversation = useChatStore((state) => state.typingByConversation);
  const createDirectConversation = useChatStore(
    (state) => state.createDirectConversation
  );
  const loadConversations = useChatStore((state) => state.loadConversations);
  const loadMessages = useChatStore((state) => state.loadMessages);
  const receiveMessage = useChatStore((state) => state.receiveMessage);
  const searchUsers = useChatStore((state) => state.searchUsers);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);
  const setCurrentUserId = useChatStore((state) => state.setCurrentUserId);
  const setOnlineUsers = useChatStore((state) => state.setOnlineUsers);
  const setTyping = useChatStore((state) => state.setTyping);
  const markSeenLocal = useChatStore((state) => state.markSeenLocal);

  const activeConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => getId(conversation) === activeConversationId
      ) || null,
    [activeConversationId, conversations]
  );
  const activeMessages = activeConversationId
    ? messagesByConversation[activeConversationId] || []
    : [];
  const typingUsers = useMemo(() => {
    const typing = typingByConversation[activeConversationId] || {};
    const currentUserId = getId(user);

    return Object.values(typing).filter(
      (typingUser) =>
        getId(typingUser) !== currentUserId &&
        Date.now() - Number(typingUser.lastTypedAt || 0) < 4500
    );
  }, [activeConversationId, typingByConversation, user]);

  useEffect(() => {
    setCurrentUserId(getId(user));
  }, [setCurrentUserId, user]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    loadConversations({ force: true });

    const socket = getChatSocket(token);

    if (!socket) {
      return undefined;
    }

    const handleReceiveMessage = (payload) => receiveMessage(payload);
    const handleOnlineUsers = (users) => setOnlineUsers(users);
    const handleTyping = (payload) =>
      setTyping({
        conversationId: payload.conversationId,
        user: payload.user,
        stopped: payload.stopped,
      });
    const handleMessageSeen = (payload) => markSeenLocal(payload);
    const handleConnect = () => {
      const currentConversationId = useChatStore.getState().activeConversationId;

      if (currentConversationId) {
        socket.emit("join_conversation", { conversationId: currentConversationId });
        socket.emit("mark_seen", { conversationId: currentConversationId });
      }
    };

    socket.on("receive_message", handleReceiveMessage);
    socket.on("online_users", handleOnlineUsers);
    socket.on("user_typing", handleTyping);
    socket.on("message_seen", handleMessageSeen);
    socket.on("connect", handleConnect);
    socket.connect();

    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("online_users", handleOnlineUsers);
      socket.off("user_typing", handleTyping);
      socket.off("message_seen", handleMessageSeen);
      socket.off("connect", handleConnect);
      disconnectChatSocket();
    };
  }, [
    loadConversations,
    markSeenLocal,
    receiveMessage,
    setOnlineUsers,
    setTyping,
    token,
  ]);

  useEffect(() => {
    const socket = getChatSocket();

    if (!socket || !activeConversationId) {
      return;
    }

    socket.emit("join_conversation", { conversationId: activeConversationId });
    socket.emit("mark_seen", { conversationId: activeConversationId });
  }, [activeConversationId]);

  const handleSelectConversation = useCallback(
    async (conversationId) => {
      await setActiveConversation(conversationId);
      setIsSidebarOpen(false);
    },
    [setActiveConversation]
  );

  return (
    <div className="mx-auto grid h-[calc(100vh-7rem)] min-h-[660px] w-full max-w-screen-2xl gap-4 overflow-hidden lg:grid-cols-[360px_minmax(0,1fr)]">
      <ChatSidebar
        activeConversationId={activeConversationId}
        conversations={conversations}
        currentUserId={getId(user)}
        isOpen={isSidebarOpen}
        onlineUsers={onlineUsers}
        onClose={() => setIsSidebarOpen(false)}
        onCreateDirect={createDirectConversation}
        onSearch={searchUsers}
        onSelect={handleSelectConversation}
        searchResults={searchResults}
      />
      <ChatWindow
        conversation={activeConversation}
        currentUser={user}
        hasMore={Boolean(hasMoreByConversation[activeConversationId])}
        isLoadingMessages={isLoadingMessages}
        messages={activeMessages}
        onlineUsers={onlineUsers}
        onLoadOlder={() =>
          activeConversationId &&
          loadMessages(activeConversationId, {
            older: true,
          })
        }
        onSend={sendMessage}
        onToggleSidebar={() => setIsSidebarOpen(true)}
        typingUsers={typingUsers}
      />
    </div>
  );
};

export default ChatPage;
