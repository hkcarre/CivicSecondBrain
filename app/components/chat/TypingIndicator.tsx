import { Bot } from "lucide-react";

export function TypingIndicator() {
  return (
    <div className="flex gap-3 message-enter">
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-city-maroon/20 text-city-navy border border-city-maroon/30">
        <Bot size={16} />
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5 h-5">
          <span className="typing-dot w-2 h-2 bg-gray-400 rounded-full block" />
          <span className="typing-dot w-2 h-2 bg-gray-400 rounded-full block" />
          <span className="typing-dot w-2 h-2 bg-gray-400 rounded-full block" />
        </div>
      </div>
    </div>
  );
}
