# TO-DO

A personal task manager built with React, TypeScript, Vite, and Tailwind CSS. Tasks and settings are stored locally in IndexedDB. The app also supports offline use as an installable PWA.

## Run locally

**Requirements:** Node.js and npm.

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite (by default, <http://localhost:3000>).

## Deploy to Vercel

This is a static Vite app; no server-side runtime or environment variables are required.

1. Import this project folder or its Git repository into Vercel.
2. Keep the detected Vite settings, or use build command `npm run build` and output directory `dist`.
3. Deploy. `vercel.json` includes SPA fallback routing and cache rules for versioned assets and the service worker.

The app stores workspace data in each browser's local IndexedDB. Its sign-in is a device-local gate with a salted, PBKDF2 password hash; it is not a hosted identity system and does not sync accounts or data between devices. Clearing browser site data removes the local account and workspace. Use the built-in backup and restore tools to move workspace data between devices.

TaskFlow runs directly in modern browsers on phones, tablets, and computers; no app installation is required. After the first online visit, the service worker caches the app shell and static assets for offline use. Deploy it over HTTPS for service-worker support on other devices (`localhost` is supported for development). Workspace data and accounts are stored separately in each browser's local IndexedDB; use the built-in backup and restore tools to move data between devices. Features that depend on browser support (such as system notifications) fall back to in-app reminders.

## Project map

```text
src/
  App.tsx                 App state, persistence, and view routing
  main.tsx                React entry point
  components/             Screens and reusable UI
  data/seedData.ts        Default settings and starter workspace
  db/indexedDb.ts         Local workspace storage
  hooks/                  Browser and app hooks
  types/todo.ts           Shared task and workspace types
  utils/                  Dates, task rules, language, import/export, and sound
```

## How the app is organized

- `App.tsx` loads the workspace, owns shared task state, saves changes, and selects the active view.
- Screen components receive data and callbacks through props. Keep task mutations in `App.tsx` so every view stays in sync.
- `db/indexedDb.ts` is the storage boundary. Use `dbService` instead of accessing IndexedDB from UI components.
- `data/seedData.ts` defines starter data for a new or reset workspace.
- `utils/` holds logic that can be shared by screens without rendering UI.

## Available scripts

```powershell
npm run dev       # Start the local development server
npm run build     # Create the production build in dist/
npm run preview   # Preview the production build locally
npm run lint      # Check TypeScript types
```
