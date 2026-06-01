# Octavio Poultry Farm Frontend

React/Vite frontend for the Octavio Poultry Farm manager app.

## Setup

```bash
npm install
npm run build
npm run dev
```

## Environment

By default, the application is configured to support both local development and remote backend services:

- **Local Development**: Leave `VITE_API_BASE` blank. The Vite dev server will automatically proxy all `/api` requests to the local backend running on `http://localhost:5000` (configured via `server.proxy` in [vite.config.js](file:///c:/Users/Admin/Documents/farm-manager/vite.config.js)).
- **Remote / Staging / Production**: Set `VITE_API_BASE` to the deployed backend URL.
  ```txt
  VITE_API_BASE=https://octavio-poultry-farms.onrender.com
  ```

For Render Static Site deployment:

- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
