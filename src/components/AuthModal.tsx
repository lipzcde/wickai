import React, { useState } from 'react';
import { KeyRound, User, Lock, AlertCircle, Sparkles, ArrowRight } from 'lucide-react';
import { authApi } from '../services/api.ts';
import { User as UserType } from '../types.ts';

interface AuthModalProps {
  onSuccess: (user: UserType) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please fill in both username and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const res = await authApi.login(username.trim(), password);
        onSuccess(res.user);
      } else {
        const res = await authApi.register(username.trim(), password);
        onSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="auth-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E1916]/40 backdrop-blur-xs p-4 animate-in fade-in duration-200"
    >
      <div
        id="auth-modal-card"
        className="w-full max-w-md bg-[#FDFCF9] border border-[#E5E1DA] rounded p-6 sm:p-8 shadow-lg"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <h2
            className="text-3xl font-semibold text-[#8B4513] tracking-tight italic"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            WickAI
          </h2>
          <p className="text-xs text-[#7A7066] mt-2 font-serif italic">
            {isLogin ? 'Sign in to access your saved conversations' : 'Create an account to begin conversations'}
          </p>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 p-1 bg-[#F0EDE4] rounded mb-5 text-xs font-medium border border-[#E5E1DA]">
          <button
            id="tab-login"
            type="button"
            onClick={() => {
              setIsLogin(true);
              setError(null);
            }}
            className={`py-1.5 rounded transition-all cursor-pointer ${
              isLogin
                ? 'bg-[#FDFCF9] text-[#8B4513] font-semibold shadow-xs border border-[#E5E1DA]'
                : 'text-[#7A7066] hover:text-[#2A2624]'
            }`}
          >
            Sign In
          </button>
          <button
            id="tab-register"
            type="button"
            onClick={() => {
              setIsLogin(false);
              setError(null);
            }}
            className={`py-1.5 rounded transition-all cursor-pointer ${
              !isLogin
                ? 'bg-[#FDFCF9] text-[#8B4513] font-semibold shadow-xs border border-[#E5E1DA]'
                : 'text-[#7A7066] hover:text-[#2A2624]'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div
            id="auth-error-banner"
            className="mb-4 p-3 rounded bg-[#FDECE8] border border-[#F5C2B8] text-xs text-[#C05621] flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#7A7066] uppercase tracking-wider mb-1" htmlFor="auth-username">
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7A7066]">
                <User className="w-4 h-4" />
              </div>
              <input
                id="auth-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. alex"
                required
                className="w-full pl-9 pr-3 py-2 text-sm bg-[#FDFCF9] border border-[#E5E1DA] rounded text-[#2A2624] placeholder-[#7A7066]/60 focus:outline-none focus:border-[#C05621]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#7A7066] uppercase tracking-wider mb-1" htmlFor="auth-password">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7A7066]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-9 pr-3 py-2 text-sm bg-[#FDFCF9] border border-[#E5E1DA] rounded text-[#2A2624] placeholder-[#7A7066]/60 focus:outline-none focus:border-[#C05621]"
              />
            </div>
          </div>

          <button
            id="auth-submit-button"
            type="submit"
            disabled={loading}
            className="w-full mt-3 py-2.5 px-4 bg-[#C05621] hover:bg-[#8B4513] text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>{isLogin ? 'Sign In to WickAI' : 'Register & Enter'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-5 text-center text-[10px] text-[#7A7066] border-t border-[#E5E1DA] pt-4 font-mono">
          <span>Encrypted storage with bcrypt authentication</span>
        </div>
      </div>
    </div>
  );
};
