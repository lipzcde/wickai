# WickAI — Full-Stack AI Chat Application

WickAI is a full-stack AI web chat application featuring a warm, sophisticated Claude-inspired aesthetic, OpenAI-compatible LLM streaming (SSE), JWT authentication with bcrypt password hashing, JSON user & conversation storage, token-optimized sliding context windows, and deployment configurations for **Netlify** and **Vercel**.

---

## Environment Variables Configuration

Create a `.env` file in the root directory (or configure them in your Netlify/Vercel dashboard settings):

```env
# Upstream OpenAI-compatible LLM endpoint
LLM_BASE_URL="https://labor-buyer-cal-private.trycloudflare.com/v1"
LLM_API_KEY="sk-070098ecda5aea48-k93903-455d3c11"
LLM_DEFAULT_MODEL="kirocor"

# Session JWT Secret (Change to a strong random key in production)
JWT_SECRET="wickai_production_jwt_secret_key_2026"
```

> **Security Note:** All calls to the LLM are handled strictly through the backend Express / Serverless API routes (`/api/chat`). The API key is **never** exposed to the client or browser.

---

## Deploying to Vercel

1. Push this repository to GitHub or import it into Vercel.
2. In your Vercel Project Settings:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. Add Environment Variables:
   - `LLM_BASE_URL`: `https://labor-buyer-cal-private.trycloudflare.com/v1`
   - `LLM_API_KEY`: `sk-070098ecda5aea48-k93903-455d3c11`
   - `LLM_DEFAULT_MODEL`: `kirocor`
   - `JWT_SECRET`: (your secure secret string)
4. Click **Deploy**.

---

## Deploying to Netlify

1. Link your Git repository on Netlify.
2. Build Settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Set the Environment Variables under **Site configuration > Environment variables**:
   - `LLM_BASE_URL`
   - `LLM_API_KEY`
   - `LLM_DEFAULT_MODEL`
   - `JWT_SECRET`
4. Netlify will use `netlify.toml` automatically.

---

## Local Development

```bash
# Install dependencies
npm install

# Run the full-stack dev server (port 3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

---

## Key Features

- **Custom LLM Streaming**: Direct SSE (`text/event-stream`) streaming with real-time response chunks.
- **Model Selector**: Switch between models (`kirocor`, `llama-3.3-70b-instruct`, `gpt-4o-mini`, `deepseek-r1`) or enter custom model IDs.
- **Token Optimization**: Compact system prompt + sliding window (last 12 messages) + Clear Context button.
- **Bcrypt & JWT Auth**: User accounts registered with bcrypt hashing into `users.json`, chats saved into `chats/{userId}.json`.
- **Rendered Text Copy**: Copy buttons cleanly extract formatted rendered text without raw markdown symbols.
- **Warm Minimalist Aesthetic**: Serif typography, warm neutral palette, fine hairline borders, zero emojis.
