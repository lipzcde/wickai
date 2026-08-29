import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, User as UserIcon, Bot, Terminal } from 'lucide-react';
import { ChatMessage as ChatMessageType } from '../types.ts';

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isStreaming = false }) => {
  const [copiedMessage, setCopiedMessage] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const isUser = message.role === 'user';

  const handleCopyMessage = async () => {
    try {
      let textToCopy = '';
      if (contentRef.current) {
        // Extract rendered readable text without raw markdown symbols
        textToCopy = contentRef.current.innerText || contentRef.current.textContent || '';
      } else {
        textToCopy = message.content;
      }
      await navigator.clipboard.writeText(textToCopy.trim());
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <div
      id={`message-${message.id}`}
      className={`w-full py-6 px-4 md:px-8 transition-colors ${
        isUser ? 'bg-transparent' : 'bg-[#F9F7F2]/70 border-y border-[#E5E1DA]'
      }`}
    >
      <div className="max-w-3xl mx-auto flex gap-4">
        {/* Avatar */}
        <div className="shrink-0 pt-0.5">
          {isUser ? (
            <div
              id={`avatar-user-${message.id}`}
              className="w-7 h-7 rounded-full bg-[#E5E1DA] border border-[#D5CFC5] flex items-center justify-center text-[#2A2624]"
            >
              <UserIcon className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div
              id={`avatar-ai-${message.id}`}
              className="w-7 h-7 rounded-full bg-[#C05621] border border-[#8B4513] flex items-center justify-center text-[#FDFCF9] shadow-xs"
            >
              <Bot className="w-3.5 h-3.5" />
            </div>
          )}
        </div>

        {/* Message Content & Actions */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#8B4513] tracking-wide">
                {isUser ? 'You' : 'WickAI'}
              </span>
              {!isUser && message.model && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#F0EDE4] text-[#7A7066] border border-[#E5E1DA]">
                  {message.model}
                </span>
              )}
            </div>

            {/* AI message copy button */}
            {!isUser && (
              <button
                id={`copy-btn-${message.id}`}
                type="button"
                onClick={handleCopyMessage}
                title="Copy rendered message"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-[#7A7066] hover:text-[#2A2624] hover:bg-[#F0EDE4] transition-colors cursor-pointer border border-transparent hover:border-[#E5E1DA]"
              >
                {copiedMessage ? (
                  <>
                    <Check className="w-3 h-3 text-[#2E7D32]" />
                    <span className="text-[#2E7D32] font-medium">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Body Content */}
          <div ref={contentRef} className="prose-wick">
            {isUser ? (
              <p className="whitespace-pre-wrap leading-relaxed text-[#2A2624] font-normal">
                {message.content}
              </p>
            ) : (
              <div>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      const codeString = String(children).replace(/\n$/, '');
                      const isInline = !match && !codeString.includes('\n');

                      if (isInline) {
                        return (
                          <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-[#F0EDE4] text-[#8B4513] border border-[#E5E1DA]" {...props}>
                            {children}
                          </code>
                        );
                      }

                      return (
                        <CodeBlock language={match ? match[1] : 'text'} code={codeString} />
                      );
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>

                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 ml-1 bg-[#C05621] animate-pulse align-middle" />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Specialized Code Block with syntax aesthetic and isolated copy button
const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy code:', e);
    }
  };

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-[#DCD3C5] bg-[#231E1B] shadow-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1B1715] border-b border-[#352D29] text-[11px] text-[#A6998C]">
        <div className="flex items-center gap-1.5 font-mono">
          <Terminal className="w-3 h-3 text-[#C85A32]" />
          <span>{language}</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-[#C4B7A9] hover:text-[#FFF5EB] hover:bg-[#382F2A] transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-[#4CAF50]" />
              <span className="text-[#4CAF50]">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 text-xs font-mono text-[#EFE7DE] overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
};
