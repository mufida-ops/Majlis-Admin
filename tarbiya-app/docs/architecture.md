# Tarbiya -- Architecture

Phase 1 scope: one lesson (Surat al-Humazah, Grade 3), built end-to-end through
all 7 steps of the Learning Journey, on real architecture -- not a prototype
shortcut. See the Phase 1 brief for full context; this file documents what
was actually built and why, as the seams matter more than the lesson count.

Phase 2 (section 8) generalized that architecture to all 18 Grade 3 Volume 1
lessons (Units 1-3) and added lesson-plan/presentation export, without
changing anything described in sections 1-6 -- that's the point of having
built the seams first.

## 0. What's explicitly NOT built yet

- The Grade 3 Volume 2 lessons (Units 4-6)
- The teacher dashboard / class-level analytics beyond a single lesson run's before/after view
- The LI/SC checker tool, the year-long calendar tool, school-events-aware suggestions
- The teacher growth/coaching layer
- Multi-teacher accounts, rosters, or auth of any kind
- A second AI model actually wired in behind the router (the interface exists; only one adapter is live)
- A live third-party image/video generation provider (see section 4)
- Embedding the Connection step's illustration into the exported presentation (see section 8)

## 1. The core safety distinction

Two separate instructions are attached to **every** generation call, on purpose,
never merged into one blanket restriction:

1. **Religious claims are never invented.** An ayah, hadith, fiqh ruling,
   historical fact, or Islamic interpretation not present in the lesson's
   approved content may never be added.
2. **Pedagogy is freely creative**, as long as it introduces no new religious
   claim: activities, scenarios, role-plays, visual metaphors, discussion
   prompts are fair game.

This lives in `lib/grounding-engine.ts` as `RELIGIOUS_CLAIM_CONSTRAINT` and
`PEDAGOGICAL_FREEDOM_INSTRUCTION` -- the one place in the codebase that builds
these instructions. No route handler constructs a system prompt inline.

## 2. Content architecture (Layers 1-3)

See `content/lessons/types.ts` for the shared shape and `content/lessons/surat-al-humazah.ts` / `content/lessons/grade3-vol1.ts` for the data:

- **Layer 1 (raw source)**: the Qur'an or hadith text itself -- transliteration
  and translation always given (both extracted directly from the source
  PDF's own clean text), Arabic script included only where independently
  verified as correct (short, universally-known verses/hadith). Longer or
  less-common passages had garbled Arabic glyph encoding in the source PDF
  extraction, so their Arabic script is deliberately left out rather than
  risk reproducing it wrong -- see the comment on `RawSource.arabic` in
  `content/lessons/types.ts`. Quotable verbatim regardless; the grounding
  engine never asks the model to paraphrase or reinterpret it.
- **Layer 2 (approved pedagogical content)**: a short, human-preparable
  summary anchored to the MOE-certified textbook. This is what the AI is
  grounded in for actual generation. It carries a `reviewStatus` field
  (`"draft"` until a human reviewer approves it) surfaced in the UI via the
  "Grounding pending reviewer approval" badge on every generated block --
  the draft summary here has not yet been reviewer-approved.
- **Layer 3 (curriculum tags)**: grade/unit/lesson metadata, feeding the
  source tag shown on every output.

**Licensing**: the textbook itself is copyrighted, MOE-certified material.
Layer 2's `grounding` field is a short summary, not a verbatim reproduction
of textbook pages -- nothing from the copyrighted PDF pages is baked into
this repo.

## 3. AI Router

`Teacher -> Platform UI -> Safety/Grounding Engine -> AI Router -> adapter -> Validation -> Teacher`

- `lib/grounding-engine.ts` builds a `GroundedPrompt` (system + user prompt +
  source tag) per task. It never calls a provider itself.
- `lib/ai-router.ts` is the only place that knows which adapter serves which
  `GenerationTask`. `runGrounded()` calls the adapter, parses the JSON
  response, validates it against a zod schema (`lib/schemas.ts`), and retries
  once with a corrective instruction on failure. It never fabricates a
  fallback result -- callers get a clear `GenerationValidationError` instead.
- Swapping in a second provider for one task (e.g. a dedicated
  Arabic-pedagogy model) is a one-line change to `TEXT_TASK_PROVIDER` plus one
  new adapter class implementing `TextGenerationAdapter` -- no route handler
  changes.
- **Security**: `ANTHROPIC_API_KEY` is read server-side only
  (`lib/ai-adapters/anthropic-text-adapter.ts`). The browser never calls the
  provider directly and never sees the key.
- **Dev mode**: with no `ANTHROPIC_API_KEY` set, the router falls back to
  `MockTextAdapter`, which returns deterministic, schema-valid canned JSON per
  task. This is what makes the whole pipeline testable without a live key --
  it is not used once a real key is configured.

## 4. Image generation

No third-party image-generation provider is connected in Phase 1. Instead,
`lib/ai-adapters/template-svg-image-adapter.ts` renders a geometric,
non-figurative SVG illustration from the AI-generated scene description --
this satisfies the explicit visual constraints (no depiction of Allah,
prophets, or companions; modest imagery; non-figurative Islamic art style;
age-appropriate) *by construction*, since it never renders human figures at
all. The constraints themselves live in `IMAGE_VISUAL_CONSTRAINTS` in the
grounding engine, ready for a real image provider adapter later -- swapping
one in is implementing `ImageGenerationAdapter` and registering it, per the
router's design goal. Video generation is out of scope for Phase 1 (no
adapter exists yet); the "Create Video" affordance from the brief was not
built since there's no real capability behind it to demonstrate.

## 5. Persistence

`lib/db.ts` defines `LessonSession` (one lesson run: every generated artifact
plus pre/post assessment tallies) and a `SessionStore` interface with two
implementations:

- `SupabaseSessionStore`, used when `SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY` are set. Schema: `supabase/schema.sql`.
- `InMemorySessionStore`, the default until those env vars exist. Data lives
  for the process lifetime only -- a deliberate bootstrapping convenience,
  not a production path.

No auth, no multi-teacher accounts, no rosters -- one session represents one
lesson run for one class, matching Phase 1's explicit scope. Extending this
later (teacher_id, class_id columns) is additive, not a redesign.

## 6. The 4D insight

Each pre-assessment question is tagged by the model with one of the 4D
Assessment dimensions (`depthOfUnderstanding`, `demonstrationOfPractice`,
`degreeOfReflection`, `directionOfGrowth`) via `lib/schemas.ts`'s
`quizQuestionSchema`. `lib/insight.ts` aggregates per-question correct counts
(entered by the teacher for the whole class, not per-student -- no rosters in
Phase 1) into per-dimension before/after percentages. That numeric breakdown,
not the raw scores, is what the "growth-insight" generation call turns into
the plain-language narrative ("most students improved in X, but Y remains
weak") shown at the end of Step 7.

## 7. Known Phase 1 limitations, honestly

- Grounding text for Surat al-Humazah is AI-drafted from the licensed
  textbook and marked `reviewStatus: "draft"` -- it has not been reviewed by
  a human yet. The UI surfaces this; it should not be treated as
  production-ready content until reviewed.
- Validation of "no invented religious claim" relies on the prompt
  instruction and JSON-shape validation, not semantic fact-checking against
  Layer 1/2 content. A determined adversarial prompt could still get past
  this. Real semantic verification (e.g. a second model call to check the
  output only contains claims traceable to the grounding text) is future
  work, not built in Phase 1.
- Image generation is a template renderer, not real AI image generation --
  see section 4.
- Single lesson session at a time, no auth: fine for a Phase 1 demo, not
  for multiple teachers using the app concurrently against the same data.

## 8. Phase 2: generalizing beyond one lesson, and export

Phase 2 added the remaining 17 Grade 3 Volume 1 lessons
(`content/lessons/grade3-vol1.ts`) to confirm the architecture in sections
1-6 actually generalizes across lesson types (surah, hadith,
historical/biographical), not just the one lesson Phase 1 was built around.
No changes were needed to the grounding engine, router, schemas, or
persistence layer to support this -- every builder function already took a
`LessonContent` parameter rather than assuming Surat al-Humazah.

What did change:

- **Routing**: the hardcoded `/lesson/surat-al-humazah` page became a
  dynamic `/lesson/[lessonId]` route (`app/lesson/[lessonId]/page.tsx`, a
  server component that resolves lesson metadata and 404s on an unknown id)
  rendering a shared `components/LessonWorkspace.tsx` client component.
- **Home page**: rebuilt as a unit-grouped picker (`content/lessons/lessonsByUnit()`)
  instead of a single lesson link.
- **Mock adapter bug found and fixed**: the original `MockTextAdapter`
  returned literal Surat al-Humazah content (a gossip/wealth-hoarding quiz)
  regardless of which lesson was selected. Selecting e.g. "Belief in Angels"
  in dev mode showed that unrelated quiz -- exactly the kind of
  lesson/content mismatch the Safety/Grounding Engine exists to prevent, even
  as placeholder filler. The mock adapter now derives a topic snippet from
  whichever lesson's actual grounding text was sent and marks every field
  `(mock)`.

**Export** (`lib/export/`): a completed (or in-progress) lesson session's
already-structured data -- every step was JSON on the session record, not
prose baked into HTML -- gets formatted, not regenerated, into:

- `lesson-plan-docx.ts`: a printable Word document via the `docx` package,
  one section per step, carrying the source citation and draft-review badge
  through.
- `lesson-plan-pptx.ts`: a slide deck via `pptxgenjs`, one slide per step
  plus title/source slides. Text-only -- rendering the Connection step's
  generated SVG into the deck would need rasterizing it first, since pptx
  viewers don't reliably render inline SVG; that's a follow-up, not done here.

Both are served by `GET /api/lesson-session/[id]/export/{lesson-plan,presentation}`
and verified by actually unzipping the generated `.docx`/`.pptx` (both are
OOXML zip files) and checking the extracted `document.xml`/`slideN.xml`
content, not just that a file downloaded.

`pptxgenjs` pulls in a transitive `image-size` version with an open DoS
advisory for malicious ICNS/JXL/HEIF parsing (GHSA-w3rx-r6r6-pgpr). This app
never passes user-supplied images through it -- only our own generated text
and, in future, our own generated SVGs -- so that code path is unreachable
here. `npm audit fix --force`'s suggested remediation would downgrade
`pptxgenjs` to `1.1.5`, a real regression, to dodge a vector this usage
doesn't hit; that fix was deliberately not applied.

### Fixes from a self-review pass

A code review after Phase 2 (before any of this had been seen by a human
reviewer) found and fixed:

- Post-assessment correct-count inputs weren't clamped to class size
  client-side (only the pre-assessment ones were), and there was no
  server-side bound either -- an over-class-size entry could push the 4D
  insight past 100%. Both are now enforced, client- and server-side
  (`app/api/lesson-session/[id]/route.ts` validates `correctCounts` length
  and bounds on every `PATCH`).
- The lesson-session-creation effect in `LessonWorkspace` had no guard
  against an out-of-order response landing after a teacher had already
  navigated to a different lesson.
- `SupabaseSessionStore.update()` never refreshed `updated_at`, silently
  diverging from the in-memory dev store's behavior.
- `lib/ai-router.ts`'s JSON extraction used `lastIndexOf('}')`, which could
  grab past the real end of the JSON object if the model's response had any
  trailing text containing a `}`. Replaced with a proper brace-depth scan.

## 9. Planned: richer content types, a per-strand presentation style system, and enforced child-friendly language (not yet built)

Prompted by comparing tarbiya's output against several real teachers' own
Islamic Education decks and a real rubric/unit-plan document (Grade 1-5,
UAE MOE curriculum) shared during a design discussion. Two conclusions
came out of that comparison, plus one architectural reframe. None of this
is built yet -- it's recorded here so it isn't lost before implementation.

### 9.1 What the real examples revealed tarbiya's content model is missing

- **Vocabulary step** -- shipped already (`lib/schemas.ts` `vocabularySchema`,
  `buildVocabularyRequest`, `/api/generate/vocabulary`, Step 3 in
  `LessonWorkspace`, a slide per word in the pptx export, a citation
  slide/section using `lesson.layer1` which existed but was never shown to
  students). Every real example had an explicit vocabulary slide (icon/word +
  one-line definition, sometimes just proper nouns like angel names) --
  tarbiya had no equivalent step at all before this.
- **Success Criteria as a repeated student-facing checkpoint, not a
  teacher-only artifact** -- real decks show the same 4-part Success
  Criteria slide (matching tarbiya's own 4D dimensions almost exactly:
  Understanding / Application / Use of Islamic texts / Connection to real
  life) two to three times across one lesson (start, middle, end), in plain
  language with numbered icons (01-04). The current pptx export
  (`lib/export/lesson-plan-pptx.ts`) collapses Learning Intentions to a
  single plain sentence and drops the 4-part breakdown as "teacher-only
  jargon" -- that assumption turned out wrong for this specific piece;
  real classes do see it, repeatedly, just phrased simply. Reinstating it
  as a recurring simplified checkpoint slide (not raw dimension keys, not
  percentages) is a planned fix, distinct from the Post-Assessment insight
  slide (which correctly stays percentage/analytics-free for students).
- **Group Activity Worksheet** -- a new content type. Real lessons project a
  fill-in table for small-group work (e.g. "Angel's name / What do they
  do?", "Similarities and differences") that students complete live in
  class. Needs: a new schema (task instruction + column headers + row
  count), a grounding-engine prompt, a session field, and a pptx slide kind
  that renders an empty table for projection. Tarbiya has nothing like this.
- **Rubric-based Project Task** -- a new, different assessment type from the
  existing Yes/No quiz. Real practice uses a 4-level rubric --
  **Approaching (1) -> Developing (2) -> Achieving (3) -> Mastering (4)** --
  each level with its own "I can..." descriptor, paired with an open-ended
  performance-task prompt (e.g. "create a timeline of Prophet Muhammad using
  crafts/keynote/video and teach your family"). This is for creative/project
  work, not comprehension checking -- it would sit alongside
  `quizSchema`/`insightSchema`, not replace them, since binary pre/post
  comprehension checks and open-ended project grading answer different
  questions.
- **UAE MOE curriculum strands** -- confirmed via the framework itself
  (not assumed): six strands, not seven -- **Divine Revelation, Creed,
  Islamic Values and Morals, Islamic Rulings and Purposes (Fiqh), Biography
  of the Prophet (Seerah), Islamic Identity**. Corroborated by the Surah
  al-Humazah source material's own first line ("Pivot 1: Divine
  Revelation"). `LessonContent` (`content/lessons/types.ts`) currently has
  no strand field -- only grade/volume/unit -- and would need one for 9.2
  below.

### 9.2 Presentation design: structure vs. style as two separate layers

Explicit design principle from this discussion: **the structure stays
fixed; only the style varies, and the variety should be meaningful, not
random.** Concretely, two layers:

- **Content structure (fixed)**: the ordered list of slide *kinds* a lesson
  produces (title, citation, big-idea, vocabulary-card, group-activity-table,
  success-criteria-checkpoint, rubric-level, closing) and what data goes on
  each. This is what `lib/export/lesson-plan-pptx.ts` currently hardcodes
  directly into slide-drawing calls.
- **Style (varies)**: a small set of theme modules, one per UAE MOE strand
  (six, per 9.1), each implementing the *same* rendering interface for every
  slide kind (`renderTitle`, `renderBigIdea`, `renderVocabCard`,
  `renderGroupActivity`, `renderRubricLevel`, `renderClosing`, ...) with
  different palettes/fonts/motifs per strand (e.g. Seerah -> warm
  storytelling/timeline treatment; Divine Revelation -> calligraphic/
  geometric, serene; Fiqh -> clean/practical). A lesson's strand tag picks
  its theme. Adding a theme later is additive -- one new file, nothing else
  changes -- because every theme must cover every slide kind.
- **The planned refactor**: split today's one big `buildLessonPlanPptx`
  function into (a) a content-plan builder that turns a `LessonSession` into
  an ordered list of `{kind, data}` slide specs, independent of any theme,
  and (b) a theme module that knows how to draw each `kind`. This is a
  reshaping of existing logic, not new generation capability.
- **Section labels are a style-layer concern, not structure.** The eyebrow
  captions on today's slides ("Let's imagine...", "New word", "Think about
  this") signal which slide-kind something is, but that signal doesn't have
  to be on-screen text -- a theme could use an icon, a color-coded corner,
  or nothing at all instead. Whether/how a slide-kind is labeled is a
  per-theme choice, same as color and font.

### 9.3 Enforcing child-friendly language, not just requesting it

Every generation prompt already asks for "Grade 3" / "age-appropriate"
language, but nothing currently verifies the result -- a response could be
schema-valid and still be a 30-word compound sentence no 8-year-old would
parse. `lib/ai-router.ts`'s `runGrounded()` already has the right pattern
for a different problem: it validates against a zod schema and
automatically retries once with a corrective instruction on failure. Planned
extension: after schema validation succeeds, run a cheap readability check
(e.g. average words-per-sentence / word length, not a heavy NLP dependency)
against a Grade-3 threshold on the relevant text fields, and if it fails,
issue the same kind of corrective retry already built for shape failures
("too complex for an 8-year-old -- shorter sentences, simpler words,
rewrite it"). This makes child-friendliness an enforced, checked property
of generation output, consistent with how the religious-content safety
constraint and JSON-shape correctness are already enforced rather than
merely requested.

