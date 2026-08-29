import express from 'express';
import { streamChatCompletion, getLLMConfig } from '../server/llm.ts';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', name: 'WickAI' });
});

app.get('/config', (_req, res) => {
  const { defaultModel, baseUrl } = getLLMConfig();
  res.json({
    defaultModel,
    provider: 'openai',
    baseUrl,
    models: ['gpt-4o-mini', 'gpt-4o', 'o3-mini', 'gpt-3.5-turbo', 'llama-3.3-70b-instruct'],
  });
});

app.post('/chat', async (req, res) => {
  try {
    const { model, messages } = req.body || {};
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Messages array is required.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const selectedModel = model || 'gpt-4o-mini';

    await streamChatCompletion(selectedModel, messages, res);
  } catch (err: any) {
    console.error('Chat API error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message || 'Internal server error' });
    }
  }
});

export default app;
