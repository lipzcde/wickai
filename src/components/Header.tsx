import React, { useState } from 'react';
import { Menu, RotateCcw, Sparkles, Shield, AlertTriangle } from 'lucide-react';
import { ModelSelector } from './ModelSelector.tsx';
import { User as UserType } from '../types.ts';

interface HeaderProps {
  onToggleSidebar: () => void;
  currentModel: string;
  onSelectModel: (model: string) => void;
  onClearContext: () => void;
  isStreaming: boolean;
  hasMessages: boolean;
  user: UserType | null;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  currentModel,
  onSelectModel,
  onClearContext,
  isStreaming,
  hasMessages,
  user,
}) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  return (
    <header
      id="app-header"
      className="h-16 border-b border-[#E5E1DA] flex items-center justify-between px-4 sm:px-8 bg-[#FDFCF9] z-10 sticky top-0"
    >
      <div className="flex items-center gap-3 sm:gap-6">
        <button
          id="toggle-sidebar-button"
          type="button"
          onClick={onToggleSidebar}
          className="p-1.5 rounded text-[#5C5248] hover:bg-[#F7F5F0] transition-colors cursor-pointer"
          title="Toggle conversation list"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-4 sm:gap-6">
          <h1
            className="text-2xl font-semibold text-[#8B4513] tracking-tight italic"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            WickAI
          </h1>
          <div className="hidden sm:block h-6 w-[1px] bg-[#E5E1DA]"></div>
        </div>

        {/* Model Selector container */}
        <ModelSelector
          currentModel={currentModel}
          onSelectModel={onSelectModel}
          disabled={isStreaming}
        />
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Clear Context button */}
        {hasMessages && (
          <div className="relative">
            <button
              id="clear-context-button"
              type="button"
              onClick={() => setShowClearConfirm(true)}
              disabled={isStreaming}
              title="Reset conversation context"
              className="text-xs font-medium px-3 sm:px-4 py-2 hover:bg-[#F7F5F0] text-[#2A2624] border border-transparent hover:border-[#E5E1DA] transition-colors disabled:opacity-50 cursor-pointer rounded"
            >
              <span className="flex items-center gap-1.5">
                <RotateCcw className="w-3 h-3 text-[#C05621]" />
                <span className="hidden sm:inline">Clear Context</span>
              </span>
            </button>

            {/* Confirm Context Reset Popover */}
            {showClearConfirm && (
              <div
                id="clear-context-confirm-dialog"
                className="absolute right-0 mt-1.5 w-64 p-3.5 bg-[#FDFCF9] border border-[#E5E1DA] rounded shadow-md z-50 animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="flex items-start gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-[#C05621] shrink-0 mt-0.5" />
                  <p className="text-xs text-[#2A2624]">
                    Reset message history for this conversation?
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="px-2.5 py-1 text-xs text-[#7A7066] hover:text-[#2A2624] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    id="confirm-clear-context-button"
                    type="button"
                    onClick={() => {
                      onClearContext();
                      setShowClearConfirm(false);
                    }}
                    className="px-3 py-1 text-xs font-medium bg-[#C05621] text-white rounded hover:bg-[#8B4513] cursor-pointer transition-colors"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* User initials badge */}
        {user && (
          <div
            id="user-badge"
            className="w-8 h-8 rounded-full bg-[#E5E1DA] text-[#2A2624] flex items-center justify-center text-[11px] font-bold uppercase tracking-wider shrink-0 border border-[#D5CFC5]"
            title={user.username}
          >
            {user.username.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
    </header>
  );
};
