import { memo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCheck, Clock3, Download, FileText, ImageIcon, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { resolveApiAssetUrl } from "@/lib/api";
import { cn, getInitials } from "@/lib/utils";

const formatTime = (value) =>
  value
    ? new Intl.DateTimeFormat("en", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "";

const formatFileSize = (size = 0) => {
  if (!size) {
    return "";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const getId = (value) => String(value?._id || value?.id || value || "");
const getAttachmentName = (attachment = {}) =>
  attachment.fileName || attachment.name || "Attachment";
const getAttachmentUrl = (attachment = {}) =>
  attachment.fileUrl || attachment.url || "";
const getAttachmentType = (attachment = {}) =>
  attachment.fileType || attachment.type || "";
const isImageAttachment = (attachment = {}) =>
  getAttachmentType(attachment).startsWith("image/");

const AttachmentCard = ({ attachment, isOwn, onPreview }) => {
  const fileName = getAttachmentName(attachment);
  const fileUrl = resolveApiAssetUrl(getAttachmentUrl(attachment));
  const fileType = getAttachmentType(attachment);

  if (isImageAttachment(attachment)) {
    return (
      <button
        type="button"
        className="group block overflow-hidden rounded-[18px] border border-white/35 bg-white/16 text-left shadow-sm"
        onClick={() => onPreview({ fileName, fileUrl })}
      >
        <img
          src={fileUrl}
          alt={fileName}
          loading="lazy"
          className="max-h-64 w-full min-w-44 object-cover transition duration-200 group-hover:scale-[1.015]"
        />
        <span
          className={cn(
            "flex items-center gap-2 px-3 py-2 text-xs font-semibold",
            isOwn ? "text-white/90" : "text-slate-600"
          )}
        >
          <ImageIcon className="h-3.5 w-3.5" />
          <span className="truncate">{fileName}</span>
        </span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-[18px] border px-3 py-3 text-left shadow-sm",
        isOwn
          ? "border-white/25 bg-white/14 text-white"
          : "border-emerald-100 bg-[#f1faf2] text-slate-700"
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
          isOwn ? "bg-white/18" : "bg-white text-emerald-700"
        )}
      >
        <FileText className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{fileName}</p>
        <p className={cn("mt-0.5 truncate text-xs", isOwn ? "text-white/74" : "text-slate-500")}>
          {fileType || "Document"} {formatFileSize(attachment.size)}
        </p>
      </div>
      <a
        href={fileUrl}
        download={fileName}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition",
          isOwn
            ? "bg-white/15 text-white hover:bg-white/25"
            : "bg-white text-emerald-700 hover:bg-emerald-50"
        )}
        aria-label={`Download ${fileName}`}
        title="Download"
      >
        <Download className="h-4 w-4" />
      </a>
    </div>
  );
};

const MessageBubble = memo(({ message, currentUserId }) => {
  const [previewImage, setPreviewImage] = useState(null);
  const sender = message?.senderId || {};
  const isOwn = getId(sender) === String(currentUserId);
  const seenCount = Array.isArray(message?.seenBy) ? message.seenBy.length : 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className={cn("flex w-full gap-3", isOwn ? "justify-end" : "justify-start")}
      >
        {!isOwn ? (
          <Avatar className="mt-1 h-9 w-9 rounded-2xl border-emerald-100">
            <AvatarFallback className="text-xs">{getInitials(sender?.name)}</AvatarFallback>
          </Avatar>
        ) : null}

        <div
          className={cn(
            "max-w-[86%] space-y-1 sm:max-w-[68%]",
            isOwn ? "items-end text-right" : "items-start text-left"
          )}
        >
          {!isOwn ? (
            <div className="flex flex-wrap items-center gap-2 px-1 text-xs">
              <span className="font-semibold text-slate-800">{sender?.name}</span>
              <span className="rounded-full border border-emerald-100 bg-white/82 px-2 py-0.5 font-medium text-slate-500">
                {sender?.role || "Member"}
              </span>
            </div>
          ) : null}

          <div
            className={cn(
              "rounded-[22px] border px-4 py-3 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.36)] backdrop-blur-sm",
              isOwn
                ? "border-blue-300/70 bg-gradient-to-r from-blue-600 to-sky-500 text-white"
                : "border-emerald-100 bg-white/92 text-slate-800"
            )}
          >
            {message?.message ? (
              <p className="whitespace-pre-wrap break-words text-sm leading-6">
                {message.message}
              </p>
            ) : null}

            {Array.isArray(message?.attachments) && message.attachments.length ? (
              <div className={cn("space-y-2", message?.message && "mt-3")}>
                {message.attachments.map((attachment, index) => (
                  <AttachmentCard
                    key={`${getAttachmentName(attachment)}-${index}`}
                    attachment={attachment}
                    isOwn={isOwn}
                    onPreview={setPreviewImage}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div
            className={cn(
              "flex items-center gap-1.5 px-1 text-[11px] font-semibold text-slate-500",
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

      {previewImage ? (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-5xl overflow-hidden rounded-[24px] border border-white/20 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 z-10 bg-white/90 hover:bg-white"
              onClick={() => setPreviewImage(null)}
              aria-label="Close preview"
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
            <img
              src={previewImage.fileUrl}
              alt={previewImage.fileName}
              className="max-h-[90vh] w-full object-contain"
            />
          </div>
        </div>
      ) : null}
    </>
  );
});

MessageBubble.displayName = "MessageBubble";

export default MessageBubble;
