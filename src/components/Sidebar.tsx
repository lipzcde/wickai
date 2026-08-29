import React from 'react';
import { Plus, MessageSquare, Trash2, X, Sparkles, User, LogOut } from 'lucide-react';
import { ChatSession, User as UserType } from '../types.ts';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  chats: ChatSession[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string, e: React.MouseEvent) => void;
  currentUser: UserType | null;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  currentUser,
  onLogout,
}) => {
  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          id="sidebar-backdrop"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-[#1E1916]/40 backdrop-blur-xs md:hidden"
        />
      )}

      <aside
        id="app-sidebar"
        className={`fixed md:static inset-y-0 left-0 z-40 w-72 flex flex-col bg-[#F9F7F2] border-r border-[#E5E1DA] transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Header / New Chat Button */}
        <div className="p-4 border-b border-[#E5E1DA] flex items-center justify-between gap-2">
          <button
            id="new-chat-button"
            type="button"
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 768) onClose();
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded bg-[#FDFCF9] hover:bg-[#F0EDE4] border border-[#E5E1DA] text-[#2A2624] text-xs font-medium transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#C05621]" />
            <span>New Chat</span>
          </button>

          <button
            id="close-sidebar-button"
            type="button"
            onClick={onClose}
            className="md:hidden p-1.5 rounded text-[#7A7066] hover:bg-[#F0EDE4] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chat History List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1" id="chat-history-list">
          <div className="px-2 py-1.5 text-[10px] font-bold text-[#7A7066] uppercase tracking-widest">
            Conversations
          </div>

          {chats.length === 0 ? (
            <div className="text-center py-8 px-4 text-xs text-[#7A7066]">
              <MessageSquare className="w-5 h-5 mx-auto mb-2 opacity-40 text-[#C05621]" />
              <span className="italic">No conversations yet.</span>
            </div>
          ) : (
            chats.map((chat) => {
              const isActive = chat.id === activeChatId;
              return (
                <div
                  key={chat.id}
                  id={`chat-item-${chat.id}`}
                  onClick={() => {
                    onSelectChat(chat.id);
                    if (window.innerWidth < 768) onClose();
                  }}
                  className={`group relative flex items-center justify-between px-3 py-2 rounded text-xs cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-[#F0EDE4] text-[#8B4513] font-medium border border-[#E5E1DA]'
                      : 'text-[#2A2624] hover:bg-[#F0EDE4]/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-1">
                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#C05621]' : 'text-[#7A7066]'}`} />
                    <span className="truncate">{chat.title || 'Untitled Conversation'}</span>
                  </div>

                  <button
                    id={`delete-chat-btn-${chat.id}`}
                    type="button"
                    title="Delete conversation"
                    onClick={(e) => onDeleteChat(chat.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-[#7A7066] hover:text-[#C05621] hover:bg-[#E5E1DA]/50 transition-opacity cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* User Footer */}
        {currentUser && (
          <div className="p-3.5 border-t border-[#E5E1DA] bg-[#F7F5F0] flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-[#E5E1DA] flex items-center justify-center text-[#2A2624] font-medium text-xs border border-[#D5CFC5]">
                <User className="w-3.5 h-3.5 text-[#5C5248]" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-[#2A2624] truncate">
                  {currentUser.username}
                </span>
                <span className="text-[10px] text-[#7A7066] font-mono">
                  Encrypted JSON
                </span>
              </div>
            </div>

            <button
              id="logout-button"
              type="button"
              onClick={onLogout}
              title="Sign out"
              className="p-1.5 rounded text-[#7A7066] hover:text-[#C05621] hover:bg-[#E5E1DA] transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </aside>
    </>
  );
};
