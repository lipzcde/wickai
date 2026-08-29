import { User, ChatSession, ChatMessage } from '../types.ts';

const TOKEN_STORAGE_KEY = 'wickai_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function removeStoredToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

function getAuthHeaders(): HeadersInit {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseResponse<T>(res: Response, fallbackErrorMsg: string): Promise<T> {
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // If not JSON, it's HTML or plain text from server/proxy
    if (!res.ok) {
      if (text.includes('<html') || text.includes('A server error') || text.includes('FUNCTION_INVOCATION_FAILED')) {
        throw new Error(`Server Error (${res.status}): The server encountered an issue. Check deployment logs.`);
      }
      throw new Error(text || `Server Error (${res.status})`);
    }
    throw new Error(`Unexpected server response format (${res.status})`);
  }

  if (!res.ok) {
    throw new Error(data?.error || fallbackErrorMsg);
  }
  return data as T;
}

export const authApi = {
  async register(username: string, password: string): Promise<{ user: User; token: string }> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await parseResponse<{ user: User; token: string }>(res, 'Registration failed.');
    if (data.token) {
      setStoredToken(data.token);
    }
    return data;
  },

  async login(username: string, password: string): Promise<{ user: User; token: string }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await parseResponse<{ user: User; token: string }>(res, 'Login failed.');
    if (data.token) {
      setStoredToken(data.token);
    }
    return data;
  },

  async getMe(): Promise<User | null> {
    const token = getStoredToken();
    if (!token) return null;
    try {
      const res = await fetch('/api/auth/me', {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        removeStoredToken();
        return null;
      }
      const data = await parseResponse<{ user: User }>(res, 'Failed to fetch user.');
      return data.user || null;
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
    } catch {
      // ignore
    } finally {
      removeStoredToken();
    }
  },
};

export const chatApi = {
  async getChats(): Promise<ChatSession[]> {
    const res = await fetch('/api/chats', {
      headers: getAuthHeaders(),
    });
    const data = await parseResponse<{ chats: ChatSession[] }>(res, 'Failed to load chats.');
    return data.chats || [];
  },

  async createChat(title?: string, model?: string): Promise<ChatSession> {
    const res = await fetch('/api/chats', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, model }),
    });
    const data = await parseResponse<{ chat: ChatSession }>(res, 'Failed to create chat.');
    return data.chat;
  },

  async getChat(chatId: string): Promise<ChatSession> {
    const res = await fetch(`/api/chats/${chatId}`, {
      headers: getAuthHeaders(),
    });
    const data = await parseResponse<{ chat: ChatSession }>(res, 'Failed to load chat.');
    return data.chat;
  },

  async deleteChat(chatId: string): Promise<void> {
    const res = await fetch(`/api/chats/${chatId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    await parseResponse<{ success: boolean }>(res, 'Failed to delete chat.');
  },

  async clearChatContext(chatId: string): Promise<ChatSession> {
    const res = await fetch(`/api/chats/${chatId}/clear`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    const data = await parseResponse<{ chat: ChatSession }>(res, 'Failed to clear context.');
    return data.chat;
  },

  async streamChat(
    model: string,
    messages: Array<{ role: string; content: string }>,
    chatId: string,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: getAuthHeaders(),
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
  },
};
