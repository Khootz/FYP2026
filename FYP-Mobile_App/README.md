# FYP Mobile App

React Native-style web app that helps users capture meal photos, review them instantly, and save them locally. A lightweight Express backend is included for future AI analysis experiments, but the camera workflow works fully offline.

- **Frontend** – Vite + React + shadcn-ui located at the repository root.
- **Backend (optional)** – Express + TypeScript API under `backend/` for receiving images if/when you add AI processing.

## Prerequisites

- Node.js 18+
- npm 10+

## Installation

```bash
# Frontend dependencies
npm install

# Backend dependencies
cd backend
npm install
```

## Environment variables

| Location   | Variable              | Default                | Description |
| ---------- | --------------------- | ---------------------- | ----------- |
| frontend   | `VITE_API_BASE_URL`   | `http://localhost:4000`| Only needed if you wire the UI back up to the Express API. |
| backend    | `PORT`                | `4000`                 | Port the API listens on. |
| backend    | `FRONTEND_ORIGIN`     | `http://localhost:5173`| Comma-separated list of allowed CORS origins. |

Create `.env` (frontend) and `.env.local` (backend) files if you need to override the defaults.

## Running in two terminals (optional)

```bash
# Terminal 1 – frontend
npm run dev
# Vite serves http://localhost:5173

# Terminal 2 – backend (only if you want to exercise the API)
cd backend
npm run dev
# Express serves http://localhost:4000
```

If you only need the camera + local-save experience, running the frontend alone is enough.

## API surface

| Method | Endpoint        | Description |
| ------ | --------------- | ----------- |
| GET    | `/health`       | Basic readiness probe. |
| POST   | `/api/analyze`  | Accepts `multipart/form-data` with a `file` field and returns a mock nutrition analysis payload. |

Replace the mock response inside `backend/src/index.ts` with calls to your real AI/ML pipeline when you re-enable backend analysis in the UI.

## Testing meal reminders

The camera page includes a "Send test reminder" button that uses the browser Notification API to emulate a wearable-triggered alert. Make sure to:

1. Serve the frontend over a secure origin (HTTPS or `http://localhost`).
2. Allow notifications when prompted by the browser.
3. Keep the tab open—background notifications may require a registered service worker depending on your browser.
