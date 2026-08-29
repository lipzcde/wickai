import { User, ChatSession, ChatMessage } from '../types.ts';

const CHATS_STORAGE_KEY = 'wickai_chat_sessions_v1';

const GUEST_USER: User = {
  id: 'guest_user',
  username: 'Guest User',
  createdAt: new Date().toISOString(),
};

function getLocalChats(): ChatSession[] {
  try {
    const raw = localStorage.getItem(CHATS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalChats(chats: ChatSession[]): void {
  try {
    localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(chats));
  } catch (err) {
    console.error('Failed to save chats to localStorage:', err);
  }
}

export const authApi = {
  async register(_username: string, _password: string): Promise<{ user: User; token: string }> {
    return { user: GUEST_USER, token: 'guest_token' };
  },

  async login(_username: string, _password: string): Promise<{ user: User; token: string }> {
    return { user: GUEST_USER, token: 'guest_token' };
  },

  async getMe(): Promise<User | null> {
    return GUEST_USER;
  },

  async logout(): Promise<void> {
    // No-op for guest mode
  },
};

export const chatApi = {
  async getChats(): Promise<ChatSession[]> {
    let chats = getLocalChats();
    if (chats.length === 0) {
      const initialChat: ChatSession = {
        id: 'chat_' + Math.random().toString(36).substring(2, 9),
        userId: GUEST_USER.id,
        title: 'New Conversation',
        model: 'wick-master-200b-v2',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
      };
      chats = [initialChat];
      saveLocalChats(chats);
    }
    return chats;
  },

  async createChat(title?: string, model?: string): Promise<ChatSession> {
    const chats = getLocalChats();
    const newChat: ChatSession = {
      id: 'chat_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      userId: GUEST_USER.id,
      title: title || 'New Conversation',
      model: model || 'wick-master-200b-v2',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    const updated = [newChat, ...chats];
    saveLocalChats(updated);
    return newChat;
  },

  async getChat(chatId: string): Promise<ChatSession> {
    const chats = getLocalChats();
    const found = chats.find((c) => c.id === chatId);
    if (!found) {
      throw new Error('Chat session not found');
    }
    return found;
  },

  async deleteChat(chatId: string): Promise<void> {
    const chats = getLocalChats();
    const filtered = chats.filter((c) => c.id !== chatId);
    saveLocalChats(filtered);
  },

  async clearChatContext(chatId: string): Promise<ChatSession> {
    const chats = getLocalChats();
    let updatedChat: ChatSession | null = null;
    const newChats = chats.map((c) => {
      if (c.id === chatId) {
        updatedChat = { ...c, messages: [], updatedAt: new Date().toISOString() };
        return updatedChat;
      }
      return c;
    });
    if (!updatedChat) {
      throw new Error('Chat session not found');
    }
    saveLocalChats(newChats);
    return updatedChat;
  },

  async streamChat(
    model: string,
    messages: Array<{ role: string; content: string } & Partial<ChatMessage>>,
    chatId: string,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, chatId }),
      signal,
    });

    if (!res.ok) {
      const errorText = await res.text();
      try {
        const parsed = JSON.parse(errorText);
        throw new Error(parsed.error || 'Chat request failed.');
      } catch {
        throw new Error(`Chat error (${res.status}): ${errorText}`);
      }
    }

    if (!res.body) {
      throw new Error('No stream body received from server.');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed === 'data: [DONE]') {
          return;
        }

        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.substring(6));
            if (data.error) {
              throw new Error(data.error);
            }
            if (data.content) {
              onChunk(data.content);
            }
          } catch (err: any) {
            if (err.message && !err.message.includes('JSON')) {
              throw err;
            }
          }
        }
      }
    }

    // After streaming completes, persist messages to local storage chat session
    const chats = getLocalChats();
    const sanitizedMessages: ChatMessage[] = messages.map((m, idx) => ({
      id: m.id || `msg_${idx}_${Date.now()}`,
      role: (m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user') as 'user' | 'assistant' | 'system',
      content: m.content,
      createdAt: m.createdAt || new Date().toISOString(),
      model: m.model,
    }));

    const updatedChats = chats.map((c) => {
      if (c.id === chatId) {
        // Auto-title chat based on first user message if title is still default
        let chatTitle = c.title;
        if (chatTitle === 'New Conversation' && sanitizedMessages.length > 0) {
          const firstUserMsg = sanitizedMessages.find((m) => m.role === 'user');
          if (firstUserMsg) {
            chatTitle = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '');
          }
        }
        return {
          ...c,
          title: chatTitle,
          messages: sanitizedMessages,
          updatedAt: new Date().toISOString(),
        };
      }
      return c;
    });
    saveLocalChats(updatedChats);
  },
};
