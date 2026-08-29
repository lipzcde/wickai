import fs from 'fs';
import path from 'path';

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  model?: string;
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

export interface UserChatsData {
  userId: string;
  chats: ChatSession[];
  updatedAt: string;
}

// Storage paths for JSON files
const DATA_DIR = path.resolve(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CHATS_DIR = path.join(DATA_DIR, 'chats');

function ensureDataDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(CHATS_DIR)) {
    fs.mkdirSync(CHATS_DIR, { recursive: true });
  }
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

// Adaptive storage implementation: uses local json files by default,
// or integrates with cloud blob storage if configured.
export class StorageService {
  constructor() {
    ensureDataDirectories();
  }

  // --- Users Storage (users.json) ---
  async getAllUsers(): Promise<UserRecord[]> {
    try {
      ensureDataDirectories();
      if (!fs.existsSync(USERS_FILE)) {
        return [];
      }
      const raw = fs.readFileSync(USERS_FILE, 'utf-8');
      return JSON.parse(raw) as UserRecord[];
    } catch (err) {
      console.error('Error reading users.json:', err);
      return [];
    }
  }

  async findUserByUsername(username: string): Promise<UserRecord | null> {
    const users = await this.getAllUsers();
    return users.find((u) => u.username.toLowerCase() === username.toLowerCase()) || null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    const users = await this.getAllUsers();
    return users.find((u) => u.id === id) || null;
  }

  async saveUser(user: UserRecord): Promise<void> {
    ensureDataDirectories();
    const users = await this.getAllUsers();
    const existingIndex = users.findIndex((u) => u.id === user.id);
    if (existingIndex >= 0) {
      users[existingIndex] = user;
    } else {
      users.push(user);
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  }

  // --- Chats Storage (chats/{userId}.json) ---
  private getUserChatsFilePath(userId: string): string {
    return path.join(CHATS_DIR, `${userId}.json`);
  }

  async getUserChats(userId: string): Promise<ChatSession[]> {
    try {
      ensureDataDirectories();
      const filePath = this.getUserChatsFilePath(userId);
      if (!fs.existsSync(filePath)) {
        return [];
      }
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data: UserChatsData = JSON.parse(raw);
      return data.chats || [];
    } catch (err) {
      console.error(`Error reading chats for user ${userId}:`, err);
      return [];
    }
  }

  async saveUserChats(userId: string, chats: ChatSession[]): Promise<void> {
    try {
      ensureDataDirectories();
      const filePath = this.getUserChatsFilePath(userId);
      const data: UserChatsData = {
        userId,
        chats,
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error(`Error saving chats for user ${userId}:`, err);
      throw err;
    }
  }

  async getChatById(userId: string, chatId: string): Promise<ChatSession | null> {
    const chats = await this.getUserChats(userId);
    return chats.find((c) => c.id === chatId) || null;
  }

  async saveChat(userId: string, chat: ChatSession): Promise<void> {
    const chats = await this.getUserChats(userId);
    const existingIdx = chats.findIndex((c) => c.id === chat.id);
    if (existingIdx >= 0) {
      chats[existingIdx] = chat;
    } else {
      chats.unshift(chat);
    }
    await this.saveUserChats(userId, chats);
  }

  async deleteChat(userId: string, chatId: string): Promise<boolean> {
    const chats = await this.getUserChats(userId);
    const filtered = chats.filter((c) => c.id !== chatId);
    if (filtered.length !== chats.length) {
      await this.saveUserChats(userId, filtered);
      return true;
    }
    return false;
  }
}

export const storage = new StorageService();
