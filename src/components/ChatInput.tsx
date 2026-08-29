import React, { useRef, useEffect } from 'react';
import { ArrowUp, Square, Sparkles } from 'lucide-react';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  modelName: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  onSend,
  onStop,
  isStreaming,
  disabled = false,
  modelName,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea according to scrollHeight
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 180);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && input.trim() && !disabled) {
        onSend();
      }
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-5">
      <div
        id="chat-input-wrapper"
        className="relative flex flex-col rounded border border-[#E5E1DA] bg-[#FDFCF9] shadow-xs focus-within:border-[#C05621] focus-within:ring-1 focus-within:ring-[#C05621]/20 transition-all"
      >
        <textarea
          id="chat-textarea"
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message WickAI (${modelName})...`}
          disabled={disabled}
          className="w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-sm text-[#2A2624] placeholder-[#7A7066]/70 focus:outline-none max-h-44 leading-relaxed font-normal"
        />

        <div className="flex items-center justify-between px-3.5 py-2 border-t border-[#E5E1DA] bg-[#F9F7F2] rounded-b">
          <div className="flex items-center gap-2 text-[10px] text-[#7A7066] font-mono">
            <span>Shift + Return for new line</span>
          </div>

          <div className="flex items-center gap-1.5">
            {isStreaming ? (
              <button
                id="stop-generating-button"
                type="button"
                onClick={onStop}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#2A2624] hover:bg-[#1A1816] text-white text-xs font-medium transition-colors cursor-pointer"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                id="send-message-button"
                type="button"
                onClick={onSend}
                disabled={!input.trim() || disabled}
                className="inline-flex items-center justify-center w-7 h-7 rounded bg-[#C05621] hover:bg-[#8B4513] text-white transition-all disabled:opacity-30 disabled:hover:bg-[#C05621] cursor-pointer disabled:cursor-not-allowed"
                title="Send message"
              >
                <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="mt-2 text-center text-[10px] text-[#7A7066] font-serif italic">
        <span>Sliding context window active for token efficiency.</span>
      </div>
    </div>
  );
};
