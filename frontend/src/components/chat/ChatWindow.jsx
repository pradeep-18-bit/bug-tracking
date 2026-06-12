import { memo, useEffect, useMemo, useRef } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import ChatHeader from "@/components/chat/ChatHeader";
import MessageBubble from "@/components/chat/MessageBubble";
import MessageInput from "@/components/chat/MessageInput";

const getId = (value) => String(value?._id || value?.id || value || "");

const formatDateSeparator = (value) => {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();

  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const ChatWindow = memo(
  ({
    conversation,
    currentUser,
    hasMore,
    isLoadingMessages,
    messages,
    onlineUsers,
    onLoadOlder,
    onSend,
    onToggleSidebar,
    typingUsers,
  }) => {
    const scrollRef = useRef(null);
    const currentUserId = getId(currentUser);

    useEffect(() => {
      const node = scrollRef.current;

      if (!node) {
        return;
      }

      node.scrollTop = node.scrollHeight;
    }, [conversation?._id, messages.length]);

    const messageRows = useMemo(() => {
      const rows = [];
      let previousDate = "";

      messages.forEach((message) => {
        const dateKey = new Date(message.createdAt).toDateString();

        if (dateKey !== previousDate) {
          rows.push({
            type: "date",
            id: `date-${dateKey}`,
            label: formatDateSeparator(message.createdAt),
          });
          previousDate = dateKey;
        }

        rows.push({
          type: "message",
          id: getId(message),
          message,
        });
      });

      return rows;
    }, [messages]);

    if (!conversation) {
      return (
        <section className="flex h-full flex-col items-center justify-center overflow-hidden rounded-[32px] border border-emerald-100 bg-[#f1faf2] shadow-[0_26px_70px_-45px_rgba(15,23,42,0.38)] backdrop-blur-sm">
          <div className="max-w-sm px-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[24px] border border-blue-100 bg-blue-50 text-blue-600">
              <MessageCircle className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-xl font-extrabold text-slate-950">
              Select a conversation
            </h1>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
              Search for a teammate or choose a project channel to start messaging.
            </p>
          </div>
        </section>
      );
    }

    return (
      <section className="flex h-full flex-col overflow-hidden rounded-[32px] border border-emerald-100/90 bg-[#e8f5e9] shadow-[0_28px_74px_-46px_rgba(15,23,42,0.42)] backdrop-blur-sm">
        <ChatHeader
          conversation={conversation}
          currentUserId={currentUserId}
          onlineUsers={onlineUsers}
          onToggleSidebar={onToggleSidebar}
        />

        <div
          ref={scrollRef}
          className="dashboard-scrollbar flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.74),transparent_34%),linear-gradient(180deg,_#eef8f0_0%,_#f1faf2_48%,_#e8f5e9_100%)] px-4 py-5 shadow-inner sm:px-6"
        >
          {hasMore ? (
            <div className="mb-4 flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onLoadOlder}
                disabled={isLoadingMessages}
              >
                Load older
              </Button>
            </div>
          ) : null}

          <div className="space-y-4">
            {messageRows.map((row) =>
              row.type === "date" ? (
                <div key={row.id} className="flex items-center justify-center">
                  <span className="rounded-full border border-emerald-100 bg-white/88 px-3 py-1 text-xs font-bold text-slate-500 shadow-sm">
                    {row.label}
                  </span>
                </div>
              ) : (
                <MessageBubble
                  key={row.id}
                  message={row.message}
                  currentUserId={currentUserId}
                />
              )
            )}
          </div>

          {typingUsers.length ? (
            <div className="mt-4 rounded-full border border-emerald-100 bg-white/88 px-4 py-2 text-xs font-semibold text-slate-500 shadow-sm">
              {typingUsers.map((user) => user.name).join(", ")} typing...
            </div>
          ) : null}
        </div>

        <MessageInput
          conversationId={getId(conversation)}
          currentUser={currentUser}
          onSend={onSend}
        />
      </section>
    );
  }
);

ChatWindow.displayName = "ChatWindow";

export default ChatWindow;
