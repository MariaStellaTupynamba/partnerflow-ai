/**
 * Centralized access to environment variables used by the frontend.
 * Falls back to local-dev defaults so `npm run dev` works without an `.env` file,
 * but any deployment should set NEXT_PUBLIC_API_URL explicitly.
 */
export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
};
