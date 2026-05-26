import { memo } from "react";
import { Hash, Menu, UsersRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, getInitials } from "@/lib/utils";

const getId = (value) => String(value?._id || value?.id || value || "");

const getConversationName = (conversation, currentUserId) => {
  if (!conversation) {
    return "Chat";
  }

  if (conversation.type === "direct") {
    const teammate = (conversation.participants || []).find(
      (participant) => getId(participant) !== String(currentUserId)
    );
    return teammate?.name || "Direct message";
  }

  return conversation.name || conversation.projectId?.name || conversation.teamId?.name || "Group chat";
};

const ChatHeader = memo(({ conversation, currentUserId, onlineUsers, onToggleSidebar }) => {
  const participants = conversation?.participants || [];
  const title = getConversationName(conversation, currentUserId);
  const directUser = participants.find(
    (participant) => getId(participant) !== String(currentUserId)
  );
  const isOnline =
    conversation?.type === "direct" && onlineUsers.includes(getId(directUser));

  return (
    <header className="flex min-h-[76px] items-center gap-3 border-b border-white/55 bg-white/52 px-4 py-3 backdrop-blur-2xl sm:px-5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onToggleSidebar}
      >
        <Menu className="h-4 w-4" />
      </Button>

      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/70 bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 shadow-sm">
        {conversation?.type === "direct" ? (
          <Avatar className="h-11 w-11">
            <AvatarFallback>{getInitials(directUser?.name || title)}</AvatarFallback>
          </Avatar>
        ) : (
          <Hash className="h-5 w-5" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="truncate text-base font-extrabold text-slate-950 sm:text-lg">
            {title}
          </h1>
          <Badge
            variant={conversation?.type === "direct" ? "success" : "default"}
            className="shrink-0"
          >
            {conversation?.type === "direct" ? "Direct" : conversation?.channelType || "Group"}
          </Badge>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                isOnline ? "bg-emerald-500" : "bg-slate-300"
              )}
            />
            {conversation?.type === "direct"
              ? isOnline
                ? "Online"
                : "Offline"
              : `${participants.length} participants`}
          </span>
          {conversation?.type !== "direct" ? (
            <span className="inline-flex items-center gap-1">
              <UsersRound className="h-3.5 w-3.5" />
              Workspace channel
            </span>
          ) : null}
        </div>
      </div>

      <div className="hidden items-center -space-x-2 sm:flex">
        {participants.slice(0, 4).map((participant) => (
          <Avatar
            key={getId(participant)}
            className="h-9 w-9 rounded-2xl border-2 border-white"
          >
            <AvatarFallback className="text-[11px]">
              {getInitials(participant.name)}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
    </header>
  );
});

ChatHeader.displayName = "ChatHeader";

export default ChatHeader;
