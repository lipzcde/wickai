import React, { useState, useEffect, useRef } from 'react';
import { User, ChatSession, ChatMessage as ChatMessageType } from './types.ts';
import { authApi, chatApi } from './services/api.ts';
import { Header } from './components/Header.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { ChatMessage } from './components/ChatMessage.tsx';
import { ChatInput } from './components/ChatInput.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { Bot, Sparkles, Compass, Shield, Terminal, ArrowRight } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [currentModel, setCurrentModel] = useState<string>('gpt-4o-mini');
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Scroll to bottom helper
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Initial Auth check
  useEffect(() => {
    async function checkAuth() {
      try {
        const currentUser = await authApi.getMe();
        if (currentUser) {
          setUser(currentUser);
        }
      } catch (err) {
        console.error('Session check error:', err);
      } finally {
        setAuthLoading(false);
      }
    }
    checkAuth();
  }, []);

  // Fetch chats when user is authenticated
  useEffect(() => {
    if (!user) return;
    async function loadChats() {
      try {
        const userChats = await chatApi.getChats();
        setChats(userChats);
        if (userChats.length > 0) {
          setActiveChatId(userChats[0].id);
          setMessages(userChats[0].messages || []);
          if (userChats[0].model) {
            setCurrentModel(userChats[0].model);
          }
        } else {
          // Initialize a fresh new chat session
          createNewChat();
        }
      } catch (err) {
        console.error('Failed to load user chats:', err);
      }
    }
    loadChats();
  }, [user]);

  // When active chat changes, load its messages
  useEffect(() => {
    if (!activeChatId || !user) return;
    const currentChat = chats.find((c) => c.id === activeChatId);
    if (currentChat) {
      setMessages(currentChat.messages || []);
      if (currentChat.model) {
        setCurrentModel(currentChat.model);
      }
    }
  }, [activeChatId]);

  // Auto-scroll when messages update
  useEffect(() => {
    scrollToBottom(isStreaming ? 'auto' : 'smooth');
  }, [messages, isStreaming]);

  // Create new conversation
  const createNewChat = async () => {
    if (!user) return;
    try {
      const newChat = await chatApi.createChat('New Conversation', currentModel);
      setChats((prev) => [newChat, ...prev]);
      setActiveChatId(newChat.id);
      setMessages([]);
      setErrorBanner(null);
    } catch (err: any) {
      console.error('Error creating new chat:', err);
    }
  };

  // Select a chat session
  const handleSelectChat = (chatId: string) => {
    if (isStreaming) return;
    setActiveChatId(chatId);
    setErrorBanner(null);
  };

  // Delete chat
  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await chatApi.deleteChat(chatId);
      const remaining = chats.filter((c) => c.id !== chatId);
      setChats(remaining);
      if (activeChatId === chatId) {
        if (remaining.length > 0) {
          setActiveChatId(remaining[0].id);
          setMessages(remaining[0].messages || []);
        } else {
          createNewChat();
        }
      }
    } catch (err: any) {
      console.error('Failed to delete chat:', err);
    }
  };

  // Clear Context for active chat
  const handleClearContext = async () => {
    if (!activeChatId) return;
    try {
      await chatApi.clearChatContext(activeChatId);
      setMessages([]);
      setChats((prev) =>
        prev.map((c) => (c.id === activeChatId ? { ...c, messages: [] } : c))
      );
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to clear context.');
    }
  };

  // Stop Generation
  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  };

  // Send message and stream response
  const handleSendMessage = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isStreaming || !user) return;

    setErrorBanner(null);
    setInput('');

    // Ensure we have an active chat ID
    let currentChatId = activeChatId;
    if (!currentChatId) {
      const newChat = await chatApi.createChat(
        trimmedInput.slice(0, 30) + (trimmedInput.length > 30 ? '...' : ''),
        currentModel
      );
      setChats((prev) => [newChat, ...prev]);
      currentChatId = newChat.id;
      setActiveChatId(currentChatId);
    }

    const userMessage: ChatMessageType = {
      id: 'msg_u_' + Date.now().toString(36),
      role: 'user',
      content: trimmedInput,
      createdAt: new Date().toISOString(),
    };

    const assistantPlaceholderId = 'msg_a_' + Date.now().toString(36);
    const initialAssistantMessage: ChatMessageType = {
      id: assistantPlaceholderId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      model: currentModel,
      isStreaming: true,
    };

    const updatedMessagesWithUser = [...messages, userMessage];
    setMessages([...updatedMessagesWithUser, initialAssistantMessage]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let accumulatedContent = '';

    try {
      await chatApi.streamChat(
        currentModel,
        updatedMessagesWithUser.map((m) => ({ role: m.role, content: m.content })),
        currentChatId,
        (chunk: string) => {
          accumulatedContent += chunk;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantPlaceholderId
                ? { ...msg, content: accumulatedContent }
                : msg
            )
          );
        },
        controller.signal
      );

      // Stream successfully finished
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantPlaceholderId
            ? { ...msg, content: accumulatedContent, isStreaming: false }
            : msg
        )
      );

      // Refresh chats list to sync titles and history
      const refreshedChats = await chatApi.getChats();
      setChats(refreshedChats);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantPlaceholderId
              ? { ...msg, isStreaming: false }
              : msg
          )
        );
      } else {
        console.error('Chat stream error:', err);
        setErrorBanner(err.message || 'Error occurred while contacting WickAI model.');
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantPlaceholderId
              ? {
                  ...msg,
                  content:
                    accumulatedContent ||
                    'Error: Unable to complete response. Please check model connection.',
                  isStreaming: false,
                }
              : msg
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleLogout = async () => {
    await authApi.logout();
    setUser(null);
    setChats([]);
    setMessages([]);
    setActiveChatId(null);
  };

  if (authLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#FDFCF9]">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-[#E5E1DA] border-t-[#C05621] rounded-full animate-spin mb-3" />
          <p className="text-xs font-serif italic text-[#7A7066]">Loading WickAI...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#FDFCF9] text-[#2A2624]">
      {/* Auth Modal if unauthenticated */}
      {!user && <AuthModal onSuccess={(newUser) => setUser(newUser)} />}

      {/* Sidebar navigation */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={createNewChat}
        onDeleteChat={handleDeleteChat}
        currentUser={user}
        onLogout={handleLogout}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-[#FDFCF9]">
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          currentModel={currentModel}
          onSelectModel={(m) => setCurrentModel(m)}
          onClearContext={handleClearContext}
          isStreaming={isStreaming}
          hasMessages={messages.length > 0}
          user={user}
        />

        {/* Global error banner */}
        {errorBanner && (
          <div
            id="global-error-banner"
            className="px-4 py-2 bg-[#FDECE8] border-b border-[#F5C2B8] text-xs text-[#C05621] flex items-center justify-between"
          >
            <span>{errorBanner}</span>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="text-[#C05621] hover:text-[#8B4513] font-semibold text-xs ml-2 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Messages Stream Container */}
        <div
          id="messages-container"
          className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col justify-between"
        >
          {messages.length === 0 ? (
            <div className="max-w-2xl mx-auto my-auto px-6 py-12 text-center">
              <h2
                className="text-4xl font-normal text-[#8B4513] tracking-tight mb-3 italic"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                What would you like to explore?
              </h2>
              <p className="text-sm text-[#7A7066] max-w-md mx-auto mb-8 leading-relaxed font-serif italic">
                A minimal, editorial AI workspace powered by sliding context windows and fast serverless execution.
              </p>

              {/* Starter prompts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-lg mx-auto">
                <button
                  type="button"
                  onClick={() => {
                    setInput('Write a clean TypeScript debounce utility function with clear explanations.');
                  }}
                  className="p-4 rounded border border-[#E5E1DA] bg-[#F9F7F2] hover:bg-[#F0EDE4] transition-colors text-xs text-[#2A2624] flex flex-col gap-1 cursor-pointer text-left shadow-2xs"
                >
                  <span className="font-medium text-[#8B4513]">TypeScript Utility</span>
                  <span className="text-[#7A7066]">Write a typed debounce function</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setInput('Explain how sliding window context token optimization works in LLM chat apps.');
                  }}
                  className="p-4 rounded border border-[#E5E1DA] bg-[#F9F7F2] hover:bg-[#F0EDE4] transition-colors text-xs text-[#2A2624] flex flex-col gap-1 cursor-pointer text-left shadow-2xs"
                >
                  <span className="font-medium text-[#8B4513]">Context Optimization</span>
                  <span className="text-[#7A7066]">How token sliding windows work</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 py-4">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isStreaming={message.isStreaming}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Bottom Input Area */}
        <ChatInput
          input={input}
          setInput={setInput}
          onSend={handleSendMessage}
          onStop={handleStopGenerating}
          isStreaming={isStreaming}
          disabled={!user}
          modelName={currentModel}
        />
      </div>
    </div>
  );
}
