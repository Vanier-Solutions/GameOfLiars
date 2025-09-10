Game Of Liars
=================

A fast‑paced, team‑versus‑team trivia game. Players join a lobby, form blue/red teams, pick captains, and play timed rounds. The server generates questions, enforces timers, validates answers, and broadcasts real‑time state to everyone.

Tech Stack
----------
- Frontend: React + TypeScript (Vite), Tailwind CSS, shadcn/ui, socket.io‑client
- Backend: Node.js, Express, Socket.IO, MongoDB (Mongoose), JWT
- AI: Google GenAI (Gemini) for question generation and answer checking
- Deployment: Frontend on Vercel; Backend on Render/Railway

Local Setup (development)
-------------------------
Prerequisites: Node 18+, npm, a MongoDB connection string, and a Gemini API key.

1) Install dependencies
```bash
# from repo root
cd server && npm install
cd ../frontend && npm install
```

2) Configure environment variables
```bash
# server/.env
PORT=5051
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=some_long_random_value
GEMINI_API_KEY=your_gemini_api_key
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```
```bash
# frontend/.env
VITE_API_BASE_URL=http://localhost:5051
```

3) Run dev servers (two terminals)
```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
cd frontend && npm run dev
```
Open http://localhost:5173

Notes
-----
- API base URL comes from `VITE_API_BASE_URL` (defaults to `https://gameofliars.com` if not set).
- The backend sets secure CORS for allowed origins and production security headers (HSTS in prod, X‑Frame‑Options, X‑Content‑Type‑Options, X‑XSS‑Protection, Referrer‑Policy).

Project Structure
-----------------
```
frontend/   React + Vite app (UI)
server/     Express + Socket.IO + Mongoose API and realtime server
```

