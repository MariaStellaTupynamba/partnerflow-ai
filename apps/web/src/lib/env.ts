/**
 * Centralized access to environment variables used by the frontend.
 * Falls back to local-dev defaults so `npm run dev` works without an `.env` file,
 * but any deployment should set NEXT_PUBLIC_API_URL explicitly.
 */
export const env = {
  // Used by the browser (client components). Must be reachable from wherever the user's
  // browser runs — in Docker Compose that's the host machine, via the published port.
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",

  // Used by server-side code (Server Components, `server-api.ts`). In Docker Compose the
  // Next.js server runs *inside* a container, where `localhost` refers to that container,
  // not the `api` service — it needs the Compose service name instead. Falls back to the
  // public URL, which is correct everywhere else (local `next dev`, and production where
  // the frontend and backend are separate public hosts with no "internal" address).
  internalApiUrl:
    process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
};
