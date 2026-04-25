import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: string;
  isUser: boolean;
  isStreaming?: boolean;
}

const ChatMessage = ({ message, isUser, isStreaming }: ChatMessageProps) => {
  return (
    <div
      className={cn(
        "flex w-full animate-fade-in",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-6 py-4 shadow-sm transition-all duration-200",
          isUser
            ? "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg"
            : "bg-card text-card-foreground border border-border"
        )}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {message}
          {isStreaming && (
            <span className="inline-block w-1 h-4 ml-1 bg-current animate-pulse" />
          )}
        </p>
      </div>
    </div>
  );
};

export default ChatMessage;
