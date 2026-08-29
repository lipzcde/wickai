export interface User {
  id: string;
  username: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  model?: string;
  isStreaming?: boolean;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface StreamEvent {
  content?: string;
  error?: string;
}
