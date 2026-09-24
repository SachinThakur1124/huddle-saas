# --- deps: install once, reused by build and (via cache) not shipped ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- build: compile TypeScript ---
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
# swagger-jsdoc reads route source files at runtime (see
# docs/superpowers/specs Known Limitations) — carry src/routes into the
# runtime image so /api/docs still resolves annotations from a built image.
RUN mkdir -p dist-src && cp -r src/routes dist-src/routes

# --- runtime: production deps only + compiled output ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-src/routes ./src/routes
RUN mkdir -p uploads
EXPOSE 4000
CMD ["node", "dist/server.js"]
