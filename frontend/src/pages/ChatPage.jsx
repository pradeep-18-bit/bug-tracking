import { useCallback, useEffect, useMemo, useState } from "react";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatWindow from "@/components/chat/ChatWindow";
import { useAuth } from "@/hooks/use-auth";
import { useChatStore } from "@/lib/chatStore";
import { getChatSocket } from "@/lib/socket";

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
  const createGroupConversation = useChatStore(
    (state) => state.createGroupConversation
  );
  const deleteConversation = useChatStore((state) => state.deleteConversation);
  const loadMessages = useChatStore((state) => state.loadMessages);
  const searchUsers = useChatStore((state) => state.searchUsers);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);
  const setCurrentUserId = useChatStore((state) => state.setCurrentUserId);

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
    const socket = getChatSocket();

    if (!token || !socket || !activeConversationId) {
      return;
    }

    socket.emit("join_conversation", { conversationId: activeConversationId });
    socket.emit("mark_seen", { conversationId: activeConversationId });
  }, [activeConversationId, token]);

  const handleSelectConversation = useCallback(
    async (conversationId) => {
      await setActiveConversation(conversationId);
      setIsSidebarOpen(false);
    },
    [setActiveConversation]
  );

  return (
    <div className="flex h-full w-full overflow-hidden">
      <ChatSidebar
        activeConversationId={activeConversationId}
        conversations={conversations}
        currentUserId={getId(user)}
        isOpen={isSidebarOpen}
        onlineUsers={onlineUsers}
        onClose={() => setIsSidebarOpen(false)}
        onCreateDirect={createDirectConversation}
        onCreateGroup={createGroupConversation}
        onDelete={deleteConversation}
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
        onDelete={deleteConversation}
        onSend={sendMessage}
        onToggleSidebar={() => setIsSidebarOpen(true)}
        typingUsers={typingUsers}
      />
    </div>
  );
};

export default ChatPage;
