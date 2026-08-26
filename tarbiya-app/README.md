# Tarbiya

AI-assisted Islamic Education lesson planning for teachers. The AI routes and
generates invisibly, but it is never permitted to invent religious content --
every quiz, activity, or project idea is assembled and adapted from a
pre-vetted content library, never freely generated from the model's general
knowledge. Independent of The Majlis Academy -- no shared brand, content, or
crossover.

**Current scope**: all 18 Grade 3, Volume 1 lessons (Units 1-3), each built
end-to-end through all 7 steps of the Learning Journey, on real production
architecture, plus lesson-plan (.docx) and presentation (.pptx) export. See
[`docs/architecture.md`](docs/architecture.md) for what that means concretely
and what's deliberately not built yet (Volume 2, the teacher dashboard, the
LI/SC checker, rosters/auth, and more).

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in keys as you have them -- see below
npm run dev
```

Open http://localhost:3000 to see the lesson picker, grouped by unit.

### Running without any keys

The app works out of the box with no `.env.local` at all:

- **No `ANTHROPIC_API_KEY`**: generation calls run on a deterministic mock
  adapter (`lib/ai-adapters/mock-text-adapter.ts`) so the whole 7-step flow,
  UI, and persistence are testable. Set the key to switch to real Claude
  generation -- no code changes needed.
- **No `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`**: lesson sessions are kept
  in memory and reset on server restart. Create a Supabase project, run
  `supabase/schema.sql` against it, and add the env vars to persist real data.

## Project layout

```
content/lessons/        Layer 1/2/3 content for all 18 lessons (types.ts has the shared shape)
lib/grounding-engine.ts  Safety/Grounding Engine -- builds every AI prompt, enforces the core safety distinction
lib/ai-router.ts         AI Router -- picks the adapter per task, validates responses against zod schemas
lib/ai-adapters/         Provider adapters (Anthropic, mock, template SVG image renderer)
lib/db.ts                Persistence (Supabase or in-memory fallback)
lib/insight.ts           Before/after 4D-dimension scoring
lib/export/              Lesson-plan (.docx) and presentation (.pptx) builders
app/api/generate/*       One route per generation task -- thin, delegate to the grounding engine + router
app/api/lesson-session/  Session CRUD + the two export routes
app/lesson/[lessonId]/   The 7-step lesson workspace, one dynamic route for every lesson
docs/architecture.md     Why it's built this way
```
