import { memo, useEffect, useRef, useState } from "react";
import { Paperclip, Send, SmilePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getChatSocket } from "@/lib/socket";

const MessageInput = memo(({ conversationId, currentUser, onSend }) => {
  const [value, setValue] = useState("");
  const typingTimeoutRef = useRef(null);

  useEffect(
    () => () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    },
    []
  );

  const stopTypingSoon = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      getChatSocket()?.emit("stop_typing", { conversationId });
    }, 850);
  };

  const handleChange = (event) => {
    setValue(event.target.value);
    getChatSocket()?.emit("typing", { conversationId });
    stopTypingSoon();
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const message = value.trim();

    if (!message) {
      return;
    }

    onSend({
      conversationId,
      message,
      currentUser,
    });
    setValue("");
    getChatSocket()?.emit("stop_typing", { conversationId });
  };

  return (
    <form
      className="border-t border-white/55 bg-white/58 px-4 py-3 backdrop-blur-2xl sm:px-5"
      onSubmit={handleSubmit}
    >
      <div className="flex items-end gap-2 rounded-[24px] border border-white/70 bg-white/78 p-2 shadow-[0_18px_38px_-30px_rgba(15,23,42,0.34)]">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Attach file"
          title="Attach file"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Textarea
          value={value}
          onChange={handleChange}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSubmit(event);
            }
          }}
          className="max-h-36 min-h-[44px] resize-none border-0 bg-transparent px-2 py-3 shadow-none focus-visible:ring-0"
          placeholder="Message the team"
          rows={1}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Add emoji"
          title="Add emoji"
        >
          <SmilePlus className="h-4 w-4" />
        </Button>
        <Button type="submit" size="icon" aria-label="Send message" title="Send">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
});

MessageInput.displayName = "MessageInput";

export default MessageInput;
