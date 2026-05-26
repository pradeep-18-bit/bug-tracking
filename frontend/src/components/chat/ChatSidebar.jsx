import { memo, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Hash, MessageCircle, Search, UsersRound, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, getInitials } from "@/lib/utils";

const getId = (value) => String(value?._id || value?.id || value || "");

const getConversationName = (conversation, currentUserId) => {
  if (conversation.type === "direct") {
    const user = (conversation.participants || []).find(
      (participant) => getId(participant) !== String(currentUserId)
    );
    return user?.name || "Direct message";
  }

  return conversation.name || conversation.projectId?.name || conversation.teamId?.name || "Group chat";
};

const getConversationSubtitle = (conversation, currentUserId) => {
  if (conversation.type === "direct") {
    const user = (conversation.participants || []).find(
      (participant) => getId(participant) !== String(currentUserId)
    );
    return user?.role || user?.email || "Teammate";
  }

  if (conversation.channelType === "project") {
    return "Project channel";
  }

  if (conversation.channelType === "team") {
    return "Team channel";
  }

  return `${conversation.participants?.length || 0} participants`;
};

const ConversationButton = memo(
  ({ conversation, currentUserId, isActive, onlineUsers, onSelect }) => {
    const title = getConversationName(conversation, currentUserId);
    const subtitle = getConversationSubtitle(conversation, currentUserId);
    const directUser = (conversation.participants || []).find(
      (participant) => getId(participant) !== String(currentUserId)
    );
    const isOnline =
      conversation.type === "direct" && onlineUsers.includes(getId(directUser));

    return (
      <button
        type="button"
        onClick={() => onSelect(getId(conversation))}
        className={cn(
          "group flex w-full items-center gap-3 rounded-[22px] border px-3 py-3 text-left transition-all duration-200",
          isActive
            ? "border-blue-200/80 bg-gradient-to-r from-blue-500/90 to-sky-400/85 text-white shadow-[0_16px_36px_-24px_rgba(37,99,235,0.58)]"
            : "border-white/55 bg-white/48 text-slate-700 hover:-translate-y-0.5 hover:border-blue-200/80 hover:bg-white/78"
        )}
      >
        <div className="relative shrink-0">
          {conversation.type === "direct" ? (
            <Avatar className="h-11 w-11 rounded-2xl">
              <AvatarFallback className="text-xs">
                {getInitials(directUser?.name || title)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <span
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-2xl border",
                isActive
                  ? "border-white/40 bg-white/16"
                  : "border-blue-100 bg-blue-50 text-blue-600"
              )}
            >
              {conversation.channelType === "project" ? (
                <Hash className="h-4 w-4" />
              ) : (
                <UsersRound className="h-4 w-4" />
              )}
            </span>
          )}
          {conversation.type === "direct" ? (
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2",
                isActive ? "border-blue-500" : "border-white",
                isOnline ? "bg-emerald-500" : "bg-slate-300"
              )}
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-extrabold">{title}</p>
            {conversation.unreadCount ? (
              <span
                className={cn(
                  "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold",
                  isActive
                    ? "bg-white text-blue-600"
                    : "bg-blue-600 text-white"
                )}
              >
                {conversation.unreadCount}
              </span>
            ) : null}
          </div>
          <p
            className={cn(
              "mt-0.5 truncate text-xs font-medium",
              isActive ? "text-white/82" : "text-slate-500"
            )}
          >
            {conversation.lastMessage || subtitle}
          </p>
        </div>
      </button>
    );
  }
);

ConversationButton.displayName = "ConversationButton";

const Section = ({ title, items, children }) => (
  <section className="space-y-2">
    <div className="flex items-center justify-between px-1">
      <h2 className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-500">
        {title}
      </h2>
      <span className="text-xs font-bold text-slate-400">{items.length}</span>
    </div>
    <div className="space-y-2">{children}</div>
  </section>
);

const ChatSidebar = memo(
  ({
    activeConversationId,
    conversations,
    currentUserId,
    isOpen,
    onlineUsers,
    onClose,
    onCreateDirect,
    onSearch,
    onSelect,
    searchResults,
  }) => {
    const [query, setQuery] = useState("");

    useEffect(() => {
      const timer = setTimeout(() => onSearch(query), 260);
      return () => clearTimeout(timer);
    }, [onSearch, query]);

    const groupedConversations = useMemo(
      () => ({
        direct: conversations.filter((conversation) => conversation.type === "direct"),
        projects: conversations.filter(
          (conversation) => conversation.channelType === "project"
        ),
        groups: conversations.filter(
          (conversation) =>
            conversation.type !== "direct" && conversation.channelType !== "project"
        ),
      }),
      [conversations]
    );

    const sidebarContent = (
      <aside className="flex h-full w-full flex-col overflow-hidden rounded-[30px] border border-white/65 bg-white/50 shadow-[0_26px_70px_-45px_rgba(15,23,42,0.45)] backdrop-blur-2xl lg:rounded-[32px]">
        <div className="flex items-center justify-between border-b border-white/60 px-4 py-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-600">
              Realtime
            </p>
            <h1 className="mt-1 text-xl font-extrabold text-slate-950">Chat</h1>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="border-b border-white/60 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="bg-white/78 pl-10"
              placeholder="Search teammates"
            />
          </div>
          <AnimatePresence>
            {query.trim().length >= 2 && searchResults.length ? (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mt-3 space-y-1 rounded-[22px] border border-white/70 bg-white/85 p-2 shadow-lg"
              >
                {searchResults.map((user) => (
                  <button
                    key={getId(user)}
                    type="button"
                    onClick={() => {
                      onCreateDirect(getId(user));
                      setQuery("");
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm transition hover:bg-blue-50"
                  >
                    <Avatar className="h-9 w-9 rounded-2xl">
                      <AvatarFallback className="text-xs">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-slate-800">
                        {user.name}
                      </span>
                      <span className="block truncate text-xs font-medium text-slate-500">
                        {user.role}
                      </span>
                    </span>
                  </button>
                ))}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="dashboard-scrollbar flex-1 space-y-5 overflow-y-auto p-4">
          <Section title="Direct Messages" items={groupedConversations.direct}>
            {groupedConversations.direct.map((conversation) => (
              <ConversationButton
                key={getId(conversation)}
                conversation={conversation}
                currentUserId={currentUserId}
                isActive={activeConversationId === getId(conversation)}
                onlineUsers={onlineUsers}
                onSelect={onSelect}
              />
            ))}
          </Section>

          <Section title="Project Teams" items={groupedConversations.projects}>
            {groupedConversations.projects.map((conversation) => (
              <ConversationButton
                key={getId(conversation)}
                conversation={conversation}
                currentUserId={currentUserId}
                isActive={activeConversationId === getId(conversation)}
                onlineUsers={onlineUsers}
                onSelect={onSelect}
              />
            ))}
          </Section>

          <Section title="Group Channels" items={groupedConversations.groups}>
            {groupedConversations.groups.map((conversation) => (
              <ConversationButton
                key={getId(conversation)}
                conversation={conversation}
                currentUserId={currentUserId}
                isActive={activeConversationId === getId(conversation)}
                onlineUsers={onlineUsers}
                onSelect={onSelect}
              />
            ))}
          </Section>

          {!conversations.length ? (
            <div className="rounded-[24px] border border-white/70 bg-white/58 px-4 py-8 text-center">
              <MessageCircle className="mx-auto h-8 w-8 text-blue-500" />
              <p className="mt-3 text-sm font-bold text-slate-800">
                No conversations yet
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Search for a teammate to start a direct chat.
              </p>
            </div>
          ) : null}
        </div>
      </aside>
    );

    return (
      <>
        <div className="hidden h-full lg:block">{sidebarContent}</div>
        <AnimatePresence>
          {isOpen ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-slate-950/30 p-3 backdrop-blur-sm lg:hidden"
              onClick={onClose}
            >
              <motion.div
                initial={{ x: -24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -24, opacity: 0 }}
                className="h-full max-w-[360px]"
                onClick={(event) => event.stopPropagation()}
              >
                {sidebarContent}
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </>
    );
  }
);

ChatSidebar.displayName = "ChatSidebar";

export default ChatSidebar;
