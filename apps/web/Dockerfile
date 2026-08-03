# Development image for the Next.js frontend.
# Optimized for local Docker Compose usage (bind-mounted source + `next dev`), not production.
FROM node:20-slim

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json

RUN npm install

COPY packages/shared-types packages/shared-types
COPY apps/web apps/web

WORKDIR /workspace/apps/web

EXPOSE 3000

CMD ["npm", "run", "dev"]
