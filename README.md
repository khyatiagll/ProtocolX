# What Did I Miss? — Chat Catch-up

A beginner-friendly React + Vite project inspired by your published concept. This is a new implementation, not recovered original Lovable source code.

## Features
- Responsive layout and dark mode
- Paste chat text and load a built-in sample
- Local rule-based summary, important messages, decisions, action items, and questions
- Upload `.txt`, `.md`, `.csv`, and `.json` files
- Read screenshot text with browser-side OCR (Tesseract.js)
- Optional AI summary through a server endpoint; API key stays on the server
- Search extracted highlights and export a `.txt` summary

## Requirements
Install Node.js (LTS) from https://nodejs.org/ and a code editor such as VS Code.

## Run locally
1. Unzip the project and open its folder in a terminal.
2. Run `npm install`
3. Run `npm run dev`
4. Open the local client URL printed by Vite (usually `http://localhost:5173`).

The API server runs on `http://localhost:8787`.

## Enable AI mode (optional)
1. Copy `.env.example` to `.env`.
2. Put your own API key in `.env` as `OPENAI_API_KEY=...`.
3. Restart `npm run dev`.
4. Choose **AI summary** in the app.

Keep `.env` private. Never put a secret API key in React code or commit `.env` to GitHub. AI mode sends the chat text to the server and configured AI provider; only use it with text you are allowed to share. Local mode does not send chat text to the server.

## Build
Run `npm run build`. Vite creates the production files in `dist/`.

## Publish to GitHub
1. Create a new empty repository at https://github.com/new (for example `what-did-i-miss`).
2. In the project folder, run:

```bash
git init
git add .
git commit -m "Build What Did I Miss chat summarizer"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/what-did-i-miss.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub username.

## Important deployment note
GitHub Pages can host the static frontend, but it cannot run this Express API server. To use AI mode online, deploy the frontend and `server/` to a host that supports Node.js (or convert the API route to a serverless function), and configure `OPENAI_API_KEY` as a private environment variable in that host's settings. For a frontend-only GitHub Pages deployment, local mode works; AI mode will need a separately hosted API URL and a small configuration change.

## Current limitations
- The local summary is a heuristic, not an actual language model; check results for accuracy.
- Screenshot OCR may misread names or timestamps. Review extracted text before summarizing.
- The AI endpoint is optional and requires a valid API key, network access, and provider billing/access.
