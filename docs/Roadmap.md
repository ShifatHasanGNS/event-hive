# EventHive Implementation Roadmap

The following sequence shows how EventHive is assembled across the backend and frontend layers. Each entry links to the live file and briefly explains its role in the stack.

## Backend Flow

1. [src/index.js](../src/index.js) — Bun entrypoint that loads environment variables, builds the Express app, and starts the HTTP server.
2. [src/app.js](../src/app.js) — Factory that wires middleware, static asset hosting, health checks, and the AI query route onto the Express instance.
3. [src/routes/query.js](../src/routes/query.js) — REST handler that enriches prompts, calls Gemini, executes SQL safely, and returns results with notices and timing.
4. [src/lib/db.js](../src/lib/db.js) — Database adapter wrapping `pg` and Neon drivers, connection pooling, and guarded execution helpers.
5. [src/lib/gemini-client.js](../src/lib/gemini-client.js) — Client for Google Gemini 2.5 Flash with JSON-mode request/response handling and error normalization.
6. [src/config/schema-context.js](../src/config/schema-context.js) — Structured schema summary injected into prompts so Gemini can understand the database.
7. [db/schema.sql](../db/schema.sql) — PostgreSQL schema plus seed data that defines users, events, registrations, feedback, and tag relations.

## Frontend Flow

1. [public/index.html](../public/index.html) — SPA shell with layout, Tailwind classes, and wiring for the query console, notices feed, and results table.
2. [public/app.js](../public/app.js) — Browser logic that submits prompts, renders SQL and notices, paginates results, and handles UI interactions.
3. [public/styles.css](../public/styles.css) — Compiled Tailwind output providing the dark theme, typography, and utility classes used across the UI.
4. [src/styles/tailwind.css](../src/styles/tailwind.css) — Source stylesheet with Tailwind directives and custom component layers before compilation.
5. [public/schema.html](../public/schema.html) — Static helper page that exposes the database schema to users for quick reference while composing prompts.
6. [tailwind.config.js](../tailwind.config.js) — Tailwind build configuration that defines the color palette, content paths, and plugin setup for styling.
