# EventHive

EventHive is an AI-assisted event database explorer for the Database Systems Lab project. It pairs Google Gemini Flash with a richly constrained PostgreSQL dataset so you can ask natural-language questions and instantly see the generated SQL, PostgreSQL notices (including `RAISE NOTICE` output), and result tables—all in a single-page dark UI.

## ✨ Features

- **Natural language to SQL/PL/pgSQL** via Gemini Flash with schema awareness and JSON-structured responses.
- **Safe execution pipeline** that validates statements, rejects destructive commands, captures execution timings, and surfaces PostgreSQL notices.
- **Neon-ready connection support** via `@neondatabase/serverless` (set `DATABASE_CLIENT=neon`).
- **Modern dark UI** (Slate base palette) built with Tailwind CDN + vanilla JS: query composer, example chips, SQL viewer with copy, system message feed, and responsive multi-table results.
- **PostgreSQL starter schema and seed data** (`db/schema.sql`) covering users, events, registrations, feedback, and tags with indexes and constraints from the project plan.

## 🧱 Tech Stack

- **Backend:** Node.js, Express, `pg`, `dotenv`
- **Database:** PostgreSQL (tested with Neon free tier)
- **AI:** Google Gemini 2.5 Flash REST API
- **Frontend:** Static HTML, Tailwind CSS (CDN), vanilla JavaScript

## 🚀 Getting Started

### 1. Prerequisites

- Bun 1.0+ (bundled Node-compatible runtime)
- PostgreSQL database (local or hosted). NeonDB works great.
- Google Gemini API key (free tier works). Sign up at [ai.google.dev](https://ai.google.dev/).

### 2. Install dependencies

```bash
bun install
```

### 3. Configure environment

Create a `.env` file in the project root (you can copy `.env.example`).

```
PORT=4000
DATABASE_URL=postgres://<user>:<password>@<host>:<port>/<database>
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.5-flash
DATABASE_CLIENT=pg # use "neon" when connecting with @neondatabase/serverless
```

If you are connecting to a local Postgres without SSL, add `DATABASE_SSL=false`.

When using Neon, set `DATABASE_CLIENT=neon` and keep the `postgresql://...` connection string provided by Neon (which already includes `sslmode=require`).

> **Note:** Neon\'s serverless driver does not currently emit `NOTICE` events, so the System Messages panel will only show Gemini notes when running in that mode.

### 4. Bootstrap the database

Run the provided schema + seed script against your database:

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

### 5. Start the server

```bash
bun run dev
```

Visit `http://localhost:4000` to load the EventHive interface.

## 🧠 Prompt Workflow

1. You enter a natural language question.
2. The backend enriches the prompt with the schema context and asks Gemini Flash to respond **strictly** in JSON (title, statements array, notes, expectation).
3. Each returned SQL/PL/pgSQL statement is validated, executed sequentially, and timed. PostgreSQL `NOTICE` messages are captured via the `pg` client.
4. The UI renders the generated SQL, Gemini notes, database notices, result tables, and execution statistics.

Destructive statements such as `DROP`, `TRUNCATE`, or `ALTER DATABASE` are proactively blocked.

## 📚 Helpful Prompts

- `Show upcoming technology events in December with organizer and ticket price.`
- `Calculate revenue and capacity utilization for AI & Machine Learning Summit 2025.`
- `List attendees who registered for more than two events along with total spend.`
- `Find events with average feedback rating above 4 and include their tags.`

## 🛠 Project Structure

```.
├── db/
│   └── schema.sql            # Full schema + seed data from the project plan
├── public/
│   ├── index.html            # Tailwind dark-mode single page
│   ├── app.js                # Frontend logic (fetch, rendering)
│   └── styles.css            # Extra theming + utilities
├── src/
│   ├── app.js                # Express app factory + static hosting
│   ├── index.js              # Local server entrypoint
│   ├── config/
│   │   └── schema-context.js # Schema summary injected into prompts
│   ├── lib/
│   │   ├── db.js             # pg Pool configuration
│   │   └── gemini-client.js  # Gemini Flash JSON response helper
│   └── routes/
│       └── query.js          # AI generation + PostgreSQL execution pipeline
├── .env.example
├── EventHive_Project_Plan.md
├── package.json
└── README.md
```

## ✅ Health Checks

- `GET /health` → `{ "status": "ok" }`
- `POST /api/query` → `{ prompt, plan, notices, results, executionTimeMs }`
