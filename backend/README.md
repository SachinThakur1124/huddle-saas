# Huddle Backend

Express + TypeScript API for Huddle. See the root README for the full
project overview, architecture diagram, and Docker instructions.

## Local dev (without Docker)

1. `cp .env.example .env` and adjust if needed.
2. Start MongoDB (as a single-node replica set, required for transactions)
   and Redis locally, or via the root `docker-compose.yml`.
3. `npm install`
4. `npm run dev`

## Tests

- `npm test` — full suite (44 tests)
- `npm run test:coverage` — with coverage report (60%+ gate on
  `src/services/**` and `src/middleware/**`)

## API docs

Once running, Swagger UI is at `http://localhost:4000/api/docs`.
