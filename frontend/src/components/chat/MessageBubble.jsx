import { memo } from "react";
import { motion } from "framer-motion";
import { CheckCheck, Clock3, Paperclip } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";

const formatTime = (value) =>
  value
    ? new Intl.DateTimeFormat("en", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "";

const getId = (value) => String(value?._id || value?.id || value || "");

const MessageBubble = memo(({ message, currentUserId }) => {
  const sender = message?.senderId || {};
  const isOwn = getId(sender) === String(currentUserId);
  const seenCount = Array.isArray(message?.seenBy) ? message.seenBy.length : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cn("flex w-full gap-3", isOwn ? "justify-end" : "justify-start")}
    >
      {!isOwn ? (
        <Avatar className="mt-1 h-9 w-9 rounded-2xl">
          <AvatarFallback className="text-xs">{getInitials(sender?.name)}</AvatarFallback>
        </Avatar>
      ) : null}

      <div
        className={cn(
          "max-w-[82%] space-y-1 sm:max-w-[68%]",
          isOwn ? "items-end text-right" : "items-start text-left"
        )}
      >
        {!isOwn ? (
          <div className="flex flex-wrap items-center gap-2 px-1 text-xs">
            <span className="font-semibold text-slate-800">{sender?.name}</span>
            <span className="rounded-full border border-white/60 bg-white/70 px-2 py-0.5 font-medium text-slate-500">
              {sender?.role || "Member"}
            </span>
          </div>
        ) : null}

        <div
          className={cn(
            "rounded-[22px] border px-4 py-3 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.42)] backdrop-blur-xl",
            isOwn
              ? "border-blue-300/70 bg-gradient-to-r from-blue-600 to-sky-500 text-white"
              : "border-white/70 bg-white/78 text-slate-800"
          )}
        >
          {message?.message ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-6">
              {message.message}
            </p>
          ) : null}

          {Array.isArray(message?.attachments) && message.attachments.length ? (
            <div className="mt-3 space-y-2">
              {message.attachments.map((attachment, index) => (
                <div
                  key={`${attachment.name}-${index}`}
                  className={cn(
                    "flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs",
                    isOwn
                      ? "border-white/25 bg-white/14 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                  )}
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  <span className="truncate">{attachment.name || "Attachment"}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            "flex items-center gap-1.5 px-1 text-[11px] font-medium text-slate-500",
            isOwn ? "justify-end" : "justify-start"
          )}
        >
          <span>{formatTime(message?.createdAt)}</span>
          {isOwn && message?.pending ? <Clock3 className="h-3 w-3" /> : null}
          {isOwn && !message?.pending ? (
            <CheckCheck className={cn("h-3.5 w-3.5", seenCount > 1 && "text-blue-500")} />
          ) : null}
          {message?.failed ? <span className="text-rose-500">Failed</span> : null}
        </div>
      </div>
    </motion.div>
  );
});

MessageBubble.displayName = "MessageBubble";

export default MessageBubble;
