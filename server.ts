import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { storage, UserRecord, ChatSession, ChatMessage } from './server/storage.ts';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  requireAuth,
  optionalAuth,
  AuthenticatedRequest,
} from './server/auth.ts';
import { streamChatCompletion, getLLMConfig } from './server/llm.ts';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

// --- Health Check ---
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    name: 'WickAI',
    timestamp: new Date().toISOString(),
  });
});

// --- Config Info (Non-sensitive) ---
app.get('/api/config', (_req, res) => {
  const { defaultModel, baseUrl } = getLLMConfig();
  res.json({
    defaultModel,
    provider: 'openai',
    baseUrl,
    models: ['gpt-4o-mini', 'gpt-4o', 'o3-mini', 'gpt-3.5-turbo', 'llama-3.3-70b-instruct'],
  });
});

// --- Authentication Routes ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required.' });
      return;
    }

    const cleanUsername = String(username).trim();
    if (cleanUsername.length < 3) {
      res.status(400).json({ error: 'Username must be at least 3 characters long.' });
      return;
    }
    if (password.length < 4) {
      res.status(400).json({ error: 'Password must be at least 4 characters long.' });
      return;
    }

    const existing = await storage.findUserByUsername(cleanUsername);
    if (existing) {
      res.status(409).json({ error: 'Username is already taken. Please choose another.' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const newUser: UserRecord = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      username: cleanUsername,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    await storage.saveUser(newUser);

    const token = generateToken({
      id: newUser.id,
      username: newUser.username,
      createdAt: newUser.createdAt,
    });

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      user: {
        id: newUser.id,
        username: newUser.username,
        createdAt: newUser.createdAt,
      },
      token,
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required.' });
      return;
    }

    const user = await storage.findUserByUsername(String(username).trim());
    if (!user) {
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    const token = generateToken({
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
    });

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true, message: 'Logged out successfully.' });
});

// --- Chat Sessions Management ---
app.get('/api/chats', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const chats = await storage.getUserChats(userId);
    res.json({ chats });
  } catch (err: any) {
    console.error('Error fetching chats:', err);
    res.status(500).json({ error: 'Failed to retrieve chats.' });
  }
});

app.post('/api/chats', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { title, model } = req.body;
    const newChat: ChatSession = {
      id: 'chat_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      userId,
      title: title?.trim() || 'New Conversation',
      model: model || 'kirocor',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };

    await storage.saveChat(userId, newChat);
    res.status(201).json({ chat: newChat });
  } catch (err: any) {
    console.error('Error creating chat:', err);
    res.status(500).json({ error: 'Failed to create new chat session.' });
  }
});

app.get('/api/chats/:chatId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { chatId } = req.params;
    const chat = await storage.getChatById(userId, chatId);
    if (!chat) {
      res.status(404).json({ error: 'Chat not found.' });
      return;
    }
    res.json({ chat });
  } catch (err: any) {
    console.error('Error fetching chat:', err);
    res.status(500).json({ error: 'Failed to retrieve chat.' });
  }
});

app.delete('/api/chats/:chatId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { chatId } = req.params;
    const deleted = await storage.deleteChat(userId, chatId);
    if (!deleted) {
      res.status(404).json({ error: 'Chat session not found.' });
      return;
    }
    res.json({ success: true, message: 'Chat session deleted.' });
  } catch (err: any) {
    console.error('Error deleting chat:', err);
    res.status(500).json({ error: 'Failed to delete chat.' });
  }
});

// Clear context (reset conversation message history)
app.post('/api/chats/:chatId/clear', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { chatId } = req.params;
    const chat = await storage.getChatById(userId, chatId);
    if (!chat) {
      res.status(404).json({ error: 'Chat session not found.' });
      return;
    }

    chat.messages = [];
    chat.updatedAt = new Date().toISOString();
    await storage.saveChat(userId, chat);

    res.json({ success: true, message: 'Chat context cleared successfully.', chat });
  } catch (err: any) {
    console.error('Error clearing chat context:', err);
    res.status(500).json({ error: 'Failed to clear chat context.' });
  }
});

// --- Chat Completion Streaming Route (SSE) ---
app.post('/api/chat', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { model, messages, chatId } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Messages array is required.' });
      return;
    }

    // Set Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const selectedModel = model || 'kirocor';

    // Handle stream and persist state on completion if chatId is supplied
    await streamChatCompletion(
      selectedModel,
      messages,
      res,
      async (assistantReply: string) => {
        if (chatId && assistantReply.trim()) {
          try {
            let chat = await storage.getChatById(userId, chatId);
            if (!chat) {
              // Create chat if not exists
              const userPrompt = messages[messages.length - 1]?.content || 'Conversation';
              chat = {
                id: chatId,
                userId,
                title: userPrompt.slice(0, 32) + (userPrompt.length > 32 ? '...' : ''),
                model: selectedModel,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                messages: [],
              };
            }

            const lastUserMsg = messages[messages.length - 1];
            const updatedMessages: ChatMessage[] = [
              ...chat.messages,
              {
                id: 'msg_u_' + Date.now().toString(36),
                role: 'user',
                content: lastUserMsg?.content || '',
                createdAt: new Date().toISOString(),
              },
              {
                id: 'msg_a_' + (Date.now() + 1).toString(36),
                role: 'assistant',
                content: assistantReply,
                createdAt: new Date().toISOString(),
                model: selectedModel,
              },
            ];

            chat.messages = updatedMessages;
            chat.updatedAt = new Date().toISOString();
            if (chat.title === 'New Conversation' && lastUserMsg?.content) {
              chat.title = lastUserMsg.content.slice(0, 30) + (lastUserMsg.content.length > 30 ? '...' : '');
            }

            await storage.saveChat(userId, chat);
          } catch (storageErr) {
            console.error('Failed to auto-save chat history:', storageErr);
          }
        }
      }
    );
  } catch (err: any) {
    console.error('Chat endpoint error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Server error processing chat completion.' });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message || 'Stream connection broken.' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

// --- Server Lifecycle & Vite Middleware ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WickAI full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
export { app };
