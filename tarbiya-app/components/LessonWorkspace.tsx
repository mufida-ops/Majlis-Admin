"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StepCard, btnStyle, btnGhostStyle, errorStyle } from "@/components/StepCard";
import { SourceTag } from "@/components/SourceTag";
import type { ActiveLearningMode } from "@/lib/schemas";
import { activeLearningModes, fourDDimensions } from "@/lib/schemas";
import type { LessonSession } from "@/lib/db";
import type { SourceTag as SourceTagShape } from "@/lib/grounding-engine";
import type { RawSource } from "@/content/lessons/types";
import { colors, fonts, shadows } from "@/lib/theme";
import { starPatternBackground } from "@/lib/patterns";

interface LessonMeta {
  id: string;
  title: string;
  unit: string;
  unitTitle: string;
  layer1: RawSource;
}

const dimensionLabels: Record<string, string> = {
  depthOfUnderstanding: "Depth of Understanding",
  demonstrationOfPractice: "Demonstration of Practice",
  degreeOfReflection: "Degree of Reflection",
  directionOfGrowth: "Direction of Growth",
};

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

async function patchJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export function LessonWorkspace({ meta }: { meta: LessonMeta }) {
  const [session, setSession] = useState<LessonSession | null>(null);
  const [meta_, setMeta] = useState<Record<string, { sourceTag: SourceTagShape; provider: string }>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [classSizeInput, setClassSizeInput] = useState(20);
  const [numQuestions, setNumQuestions] = useState(6);
  const [preCorrect, setPreCorrect] = useState<number[]>([]);
  const [postCorrect, setPostCorrect] = useState<number[]>([]);
  const [liDraft, setLiDraft] = useState<LessonSession["learningIntentions"]>(null);
  const [activeMode, setActiveMode] = useState<ActiveLearningMode>("discussion");

  useEffect(() => {
    setSession(null);
    setMeta({});
    setErrors({});
    setPreCorrect([]);
    setPostCorrect([]);
    setLiDraft(null);

    let stale = false;
    postJSON<{ session: LessonSession }>("/api/lesson-session", { lessonId: meta.id })
      .then((data) => {
        // Guards against an out-of-order response from a previous lesson
        // landing after the teacher has already navigated to a new one.
        if (!stale) setSession(data.session);
      })
      .catch((e) => {
        if (!stale) setErrors((s) => ({ ...s, init: e.message }));
      });
    return () => {
      stale = true;
    };
  }, [meta.id]);

  function withLoading<A extends unknown[]>(key: string, fn: (...args: A) => Promise<void>) {
    return async (...args: A) => {
      setLoading((s) => ({ ...s, [key]: true }));
      setErrors((s) => ({ ...s, [key]: "" }));
      try {
        await fn(...args);
      } catch (e) {
        setErrors((s) => ({ ...s, [key]: e instanceof Error ? e.message : "Something went wrong" }));
      } finally {
        setLoading((s) => ({ ...s, [key]: false }));
      }
    };
  }

  const generateConnection = withLoading("connection", async () => {
    if (!session) return;
    const data = await postJSON<{ connection: LessonSession["connection"]; sourceTag: SourceTagShape; provider: string }>(
      "/api/generate/connection-image",
      { sessionId: session.id },
    );
    setSession((s) => (s ? { ...s, connection: data.connection } : s));
    setMeta((m) => ({ ...m, connection: { sourceTag: data.sourceTag, provider: data.provider } }));
  });

  const generateAPK = withLoading("apk", async () => {
    if (!session) return;
    const data = await postJSON<{
      activatingPriorKnowledge: LessonSession["activatingPriorKnowledge"];
      sourceTag: SourceTagShape;
      provider: string;
    }>("/api/generate/activating-prior-knowledge", { sessionId: session.id });
    setSession((s) => (s ? { ...s, activatingPriorKnowledge: data.activatingPriorKnowledge } : s));
    setMeta((m) => ({ ...m, apk: { sourceTag: data.sourceTag, provider: data.provider } }));
  });

  const generateVocabulary = withLoading("vocabulary", async () => {
    if (!session) return;
    const data = await postJSON<{ vocabulary: LessonSession["vocabulary"]; sourceTag: SourceTagShape; provider: string }>(
      "/api/generate/vocabulary",
      { sessionId: session.id },
    );
    setSession((s) => (s ? { ...s, vocabulary: data.vocabulary } : s));
    setMeta((m) => ({ ...m, vocabulary: { sourceTag: data.sourceTag, provider: data.provider } }));
  });

  const generateQuiz = withLoading("quiz", async () => {
    if (!session) return;
    const data = await postJSON<{ preAssessment: LessonSession["preAssessment"]; sourceTag: SourceTagShape; provider: string }>(
      "/api/generate/pre-assessment",
      { sessionId: session.id, numQuestions },
    );
    setSession((s) => (s ? { ...s, preAssessment: data.preAssessment, preAssessmentResults: null, postAssessmentResults: null, insight: null } : s));
    setMeta((m) => ({ ...m, quiz: { sourceTag: data.sourceTag, provider: data.provider } }));
    setPreCorrect(new Array(data.preAssessment?.questions.length ?? 0).fill(0));
    setPostCorrect(new Array(data.preAssessment?.questions.length ?? 0).fill(0));
  });

  const savePreResults = withLoading("preResults", async () => {
    if (!session) return;
    const data = await patchJSON<{ session: LessonSession }>(`/api/lesson-session/${session.id}`, {
      classSize: classSizeInput,
      preAssessmentResults: { correctCounts: preCorrect },
    });
    setSession(data.session);
  });

  const generateLI = withLoading("li", async () => {
    if (!session) return;
    const data = await postJSON<{ learningIntentions: LessonSession["learningIntentions"]; sourceTag: SourceTagShape; provider: string }>(
      "/api/generate/learning-intentions",
      { sessionId: session.id },
    );
    setSession((s) => (s ? { ...s, learningIntentions: data.learningIntentions } : s));
    setLiDraft(data.learningIntentions);
    setMeta((m) => ({ ...m, li: { sourceTag: data.sourceTag, provider: data.provider } }));
  });

  const saveLI = withLoading("liSave", async () => {
    if (!session || !liDraft) return;
    const data = await patchJSON<{ session: LessonSession }>(`/api/lesson-session/${session.id}`, {
      learningIntentions: liDraft,
    });
    setSession(data.session);
  });

  const generateActiveLearning = withLoading("activeLearning", async () => {
    if (!session) return;
    const data = await postJSON<{ activeLearning: LessonSession["activeLearning"]; sourceTag: SourceTagShape; provider: string }>(
      "/api/generate/active-learning",
      { sessionId: session.id, mode: activeMode },
    );
    setSession((s) => (s ? { ...s, activeLearning: data.activeLearning } : s));
    setMeta((m) => ({ ...m, activeLearning: { sourceTag: data.sourceTag, provider: data.provider } }));
  });

  const generateGroupActivity = withLoading("groupActivity", async () => {
    if (!session) return;
    const data = await postJSON<{ groupActivity: LessonSession["groupActivity"]; sourceTag: SourceTagShape; provider: string }>(
      "/api/generate/group-activity",
      { sessionId: session.id },
    );
    setSession((s) => (s ? { ...s, groupActivity: data.groupActivity } : s));
    setMeta((m) => ({ ...m, groupActivity: { sourceTag: data.sourceTag, provider: data.provider } }));
  });

  const generateConsolidation = withLoading("consolidation", async () => {
    if (!session) return;
    const data = await postJSON<{ consolidation: LessonSession["consolidation"]; sourceTag: SourceTagShape; provider: string }>(
      "/api/generate/consolidation",
      { sessionId: session.id },
    );
    setSession((s) => (s ? { ...s, consolidation: data.consolidation } : s));
    setMeta((m) => ({ ...m, consolidation: { sourceTag: data.sourceTag, provider: data.provider } }));
  });

  const savePostResults = withLoading("postResults", async () => {
    if (!session) return;
    const data = await patchJSON<{ session: LessonSession }>(`/api/lesson-session/${session.id}`, {
      postAssessmentResults: { correctCounts: postCorrect },
    });
    setSession(data.session);
  });

  const generateInsight = withLoading("insight", async () => {
    if (!session) return;
    const data = await postJSON<{ insight: LessonSession["insight"]; sourceTag: SourceTagShape; provider: string }>(
      "/api/generate/insight",
      { sessionId: session.id },
    );
    setSession((s) => (s ? { ...s, insight: data.insight } : s));
    setMeta((m) => ({ ...m, insight: { sourceTag: data.sourceTag, provider: data.provider } }));
  });

  const generateRubricProject = withLoading("rubricProject", async () => {
    if (!session) return;
    const data = await postJSON<{ rubricProject: LessonSession["rubricProject"]; sourceTag: SourceTagShape; provider: string }>(
      "/api/generate/rubric-project",
      { sessionId: session.id },
    );
    setSession((s) => (s ? { ...s, rubricProject: data.rubricProject } : s));
    setMeta((m) => ({ ...m, rubricProject: { sourceTag: data.sourceTag, provider: data.provider } }));
  });

  if (errors.init) {
    return <p style={{ ...errorStyle, padding: 24 }}>Could not start lesson session: {errors.init}</p>;
  }
  if (!session) {
    return <p style={{ padding: 24, fontFamily: fonts.ui }}>Starting lesson session…</p>;
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <div
        style={{
          background: colors.ink,
          backgroundImage: starPatternBackground(colors.gold, 0.1),
          color: colors.onInk,
          padding: "36px 24px 28px",
          borderBottom: `4px solid ${colors.gold}`,
        }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <Link href="/" style={{ color: colors.onInkMuted, fontFamily: fonts.ui, fontSize: 12.5, textDecoration: "none" }}>
            &larr; All lessons
          </Link>
          <p
            style={{
              fontFamily: fonts.ui,
              fontSize: 12,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: colors.onInkMuted,
              margin: "10px 0 0",
            }}
          >
            Grade 3 &middot; {meta.unit}: {meta.unitTitle}
          </p>
          <h1 style={{ margin: "6px 0 0", fontSize: 32, fontWeight: 600, fontFamily: fonts.display }}>{meta.title}</h1>
          <div style={{ marginTop: 14, fontFamily: fonts.body }}>
            {meta.layer1.arabic && (
              <p dir="rtl" style={{ fontSize: 20, margin: "0 0 6px", color: colors.onInk }}>
                {meta.layer1.arabic}
              </p>
            )}
            <p style={{ fontSize: 14.5, fontStyle: "italic", color: colors.onInkMuted, margin: "0 0 4px" }}>
              &ldquo;{meta.layer1.translation}&rdquo;
            </p>
            <p style={{ fontFamily: fonts.ui, fontSize: 11.5, color: colors.onInkMuted, margin: 0 }}>{meta.layer1.reference}</p>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
            <a
              href={`/api/lesson-session/${session.id}/export/lesson-plan`}
              style={{ color: colors.onInkMuted, fontFamily: fonts.ui, fontSize: 12.5 }}
            >
              Download lesson plan (.docx)
            </a>
            <a
              href={`/api/lesson-session/${session.id}/export/presentation`}
              style={{ color: colors.onInkMuted, fontFamily: fonts.ui, fontSize: 12.5 }}
            >
              Download presentation (.pptx)
            </a>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: 24 }}>
        <StepCard step={1} title="Connection">
          <button style={btnStyle} onClick={generateConnection} disabled={loading.connection}>
            {loading.connection ? "Generating…" : "Create provocation image"}
          </button>
          {errors.connection && <p style={errorStyle}>{errors.connection}</p>}
          {session.connection && (
            <div style={{ marginTop: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- locally generated svg data: URI, not a remote asset next/image can optimize */}
              <img
                src={session.connection.imageDataUri}
                alt={session.connection.sceneDescription}
                style={{ width: "100%", maxWidth: 360, borderRadius: 12, display: "block" }}
              />
              <p style={{ fontSize: 14, marginTop: 10, color: colors.textMuted }}>{session.connection.sceneDescription}</p>
              {meta_.connection && <SourceTag tag={meta_.connection.sourceTag} provider={meta_.connection.provider} />}
            </div>
          )}
        </StepCard>

        <StepCard step={2} title="Activating Prior Knowledge">
          <button style={btnStyle} onClick={generateAPK} disabled={loading.apk}>
            {loading.apk ? "Generating…" : "Generate discussion prompt"}
          </button>
          {errors.apk && <p style={errorStyle}>{errors.apk}</p>}
          {session.activatingPriorKnowledge && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 15, fontWeight: 600 }}>{session.activatingPriorKnowledge.prompt}</p>
              <ul style={{ fontSize: 14, color: colors.textMuted }}>
                {session.activatingPriorKnowledge.followUpQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
              {meta_.apk && <SourceTag tag={meta_.apk.sourceTag} provider={meta_.apk.provider} />}
            </div>
          )}
        </StepCard>

        <StepCard step={3} title="Vocabulary">
          <button style={btnStyle} onClick={generateVocabulary} disabled={loading.vocabulary}>
            {loading.vocabulary ? "Generating…" : "Generate key vocabulary"}
          </button>
          {errors.vocabulary && <p style={errorStyle}>{errors.vocabulary}</p>}
          {session.vocabulary && (
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {session.vocabulary.words.map((w, i) => (
                <div key={i} style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 10 }}>
                  <strong style={{ fontSize: 14, color: colors.goldText }}>{w.term}</strong>
                  <p style={{ fontSize: 13, margin: "4px 0 0" }}>{w.definition}</p>
                </div>
              ))}
              {meta_.vocabulary && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <SourceTag tag={meta_.vocabulary.sourceTag} provider={meta_.vocabulary.provider} />
                </div>
              )}
            </div>
          )}
        </StepCard>

        <StepCard step={4} title="Pre-Assessment">
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontFamily: fonts.ui, fontSize: 13.5, marginRight: 8 }}>Number of questions</label>
            <input
              type="number"
              min={3}
              max={10}
              value={numQuestions}
              onChange={(e) => setNumQuestions(Math.max(3, Math.min(10, Number(e.target.value) || 6)))}
              style={{ width: 46, fontSize: 14, padding: "6px 8px", borderRadius: 6, border: `1px solid ${colors.border}`, marginRight: 10 }}
            />
            <button style={btnStyle} onClick={generateQuiz} disabled={loading.quiz}>
              {loading.quiz ? "Generating…" : "Generate pre-assessment quiz"}
            </button>
          </div>
          {errors.quiz && <p style={errorStyle}>{errors.quiz}</p>}

          {session.preAssessment && (
            <div>
              <label style={{ fontFamily: fonts.ui, fontSize: 13.5 }}>
                Class size:{" "}
                <input
                  type="number"
                  min={1}
                  value={classSizeInput}
                  onChange={(e) => setClassSizeInput(Math.max(1, Number(e.target.value) || 1))}
                  style={{ width: 60, fontSize: 14, padding: "4px 6px", borderRadius: 6, border: `1px solid ${colors.border}` }}
                />
              </label>

              {session.preAssessment.questions.map((q, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${colors.border}` }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 14 }}>
                      {i + 1}. {q.q} <em style={{ color: colors.textFaint }}>({q.answer})</em>
                    </span>
                    <div style={{ fontFamily: fonts.ui, fontSize: 11, color: colors.goldText }}>{dimensionLabels[q.dimension]}</div>
                  </div>
                  <label style={{ fontFamily: fonts.ui, fontSize: 13 }}>
                    # correct:{" "}
                    <input
                      type="number"
                      min={0}
                      max={classSizeInput}
                      value={preCorrect[i] ?? 0}
                      onChange={(e) => {
                        const next = [...preCorrect];
                        next[i] = Math.max(0, Math.min(classSizeInput, Number(e.target.value) || 0));
                        setPreCorrect(next);
                      }}
                      style={{ width: 50, fontSize: 13, padding: "4px 6px", borderRadius: 6, border: `1px solid ${colors.border}` }}
                    />
                  </label>
                </div>
              ))}
              <button style={{ ...btnGhostStyle, marginTop: 14 }} onClick={savePreResults} disabled={loading.preResults}>
                {loading.preResults ? "Saving…" : "Save pre-assessment results"}
              </button>
              {errors.preResults && <p style={errorStyle}>{errors.preResults}</p>}
              {meta_.quiz && <SourceTag tag={meta_.quiz.sourceTag} provider={meta_.quiz.provider} />}
            </div>
          )}
        </StepCard>

        <StepCard step={5} title="Learning Intentions & Success Criteria">
          <button style={btnStyle} onClick={generateLI} disabled={loading.li}>
            {loading.li ? "Generating…" : "Draft learning intentions"}
          </button>
          {errors.li && <p style={errorStyle}>{errors.li}</p>}
          {liDraft && (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {(["understanding", "application", "referencingText", "connectionToRealLife"] as const).map((field) => (
                <label key={field} style={{ fontFamily: fonts.ui, fontSize: 12.5 }}>
                  {field}
                  <textarea
                    value={liDraft[field]}
                    onChange={(e) => setLiDraft((d) => (d ? { ...d, [field]: e.target.value } : d))}
                    style={{ width: "100%", fontSize: 14, padding: 8, borderRadius: 6, border: `1px solid ${colors.border}`, marginTop: 4 }}
                    rows={2}
                  />
                </label>
              ))}
              <div style={{ fontFamily: fonts.ui, fontSize: 12.5 }}>
                Success criteria:
                <ul>
                  {liDraft.successCriteria.map((c, i) => (
                    <li key={i} style={{ fontSize: 14 }}>{c}</li>
                  ))}
                </ul>
              </div>
              <button style={btnGhostStyle} onClick={saveLI} disabled={loading.liSave}>
                {loading.liSave ? "Saving…" : "Save edits"}
              </button>
              {meta_.li && <SourceTag tag={meta_.li.sourceTag} provider={meta_.li.provider} />}
            </div>
          )}
        </StepCard>

        <StepCard step={6} title="Active Learning">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {activeLearningModes.map((mode) => (
              <button key={mode} onClick={() => setActiveMode(mode)} style={mode === activeMode ? btnStyle : btnGhostStyle}>
                {mode}
              </button>
            ))}
          </div>
          <button style={btnStyle} onClick={generateActiveLearning} disabled={loading.activeLearning}>
            {loading.activeLearning ? "Generating…" : `Generate ${activeMode} activity`}
          </button>
          {errors.activeLearning && <p style={errorStyle}>{errors.activeLearning}</p>}
          {session.activeLearning && (
            <div style={{ marginTop: 16 }}>
              <strong>{session.activeLearning.title}</strong>
              <p style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{session.activeLearning.instructions}</p>
              {session.activeLearning.materials.length > 0 && (
                <p style={{ fontSize: 13, color: colors.textMuted }}>Materials: {session.activeLearning.materials.join(", ")}</p>
              )}
              {meta_.activeLearning && <SourceTag tag={meta_.activeLearning.sourceTag} provider={meta_.activeLearning.provider} />}
            </div>
          )}
        </StepCard>

        <StepCard step={7} title="Group Activity">
          <button style={btnStyle} onClick={generateGroupActivity} disabled={loading.groupActivity}>
            {loading.groupActivity ? "Generating…" : "Generate group activity worksheet"}
          </button>
          {errors.groupActivity && <p style={errorStyle}>{errors.groupActivity}</p>}
          {session.groupActivity && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 600 }}>{session.groupActivity.taskPrompt}</p>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
                <thead>
                  <tr>
                    {session.groupActivity.columnHeaders.map((h, i) => (
                      <th key={i} style={{ textAlign: "left", fontFamily: fonts.ui, fontSize: 12.5, borderBottom: `2px solid ${colors.border}`, padding: "6px 8px" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: session.groupActivity.rowCount }).map((_, r) => (
                    <tr key={r}>
                      {session.groupActivity!.columnHeaders.map((_, c) => (
                        <td key={c} style={{ borderBottom: `1px solid ${colors.border}`, padding: "8px", height: 20 }} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {meta_.groupActivity && <SourceTag tag={meta_.groupActivity.sourceTag} provider={meta_.groupActivity.provider} />}
            </div>
          )}
        </StepCard>

        <StepCard step={8} title="Consolidation">
          <button style={btnStyle} onClick={generateConsolidation} disabled={loading.consolidation}>
            {loading.consolidation ? "Generating…" : "Generate consolidation"}
          </button>
          {errors.consolidation && <p style={errorStyle}>{errors.consolidation}</p>}
          {session.consolidation && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 14 }}>{session.consolidation.summary}</p>
              <p style={{ fontSize: 14, fontWeight: 600 }}>{session.consolidation.discussionPrompt}</p>
              {meta_.consolidation && <SourceTag tag={meta_.consolidation.sourceTag} provider={meta_.consolidation.provider} />}
            </div>
          )}
        </StepCard>

        <StepCard step={9} title="Post-Assessment">
          {!session.preAssessment ? (
            <p style={{ fontStyle: "italic", color: colors.rust, fontFamily: fonts.ui, fontSize: 13.5 }}>
              Generate the pre-assessment quiz in Step 4 first -- the same questions are reused here.
            </p>
          ) : (
            <div>
              {session.preAssessment.questions.map((q, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${colors.border}` }}>
                  <span style={{ fontSize: 14, flex: 1 }}>
                    {i + 1}. {q.q} <em style={{ color: colors.textFaint }}>({q.answer})</em>
                  </span>
                  <label style={{ fontFamily: fonts.ui, fontSize: 13 }}>
                    # correct:{" "}
                    <input
                      type="number"
                      min={0}
                      max={session.classSize ?? classSizeInput}
                      value={postCorrect[i] ?? 0}
                      onChange={(e) => {
                        const cap = session.classSize ?? classSizeInput;
                        const next = [...postCorrect];
                        next[i] = Math.max(0, Math.min(cap, Number(e.target.value) || 0));
                        setPostCorrect(next);
                      }}
                      style={{ width: 50, fontSize: 13, padding: "4px 6px", borderRadius: 6, border: `1px solid ${colors.border}` }}
                    />
                  </label>
                </div>
              ))}
              <button style={{ ...btnGhostStyle, marginTop: 14 }} onClick={savePostResults} disabled={loading.postResults}>
                {loading.postResults ? "Saving…" : "Save post-assessment results"}
              </button>
              {errors.postResults && <p style={errorStyle}>{errors.postResults}</p>}

              <div style={{ marginTop: 18 }}>
                <button style={btnStyle} onClick={generateInsight} disabled={loading.insight}>
                  {loading.insight ? "Generating…" : "Generate before/after insight"}
                </button>
                {errors.insight && <p style={errorStyle}>{errors.insight}</p>}
              </div>

              {session.insight && (
                <div
                  style={{
                    marginTop: 20,
                    background: colors.ink,
                    backgroundImage: starPatternBackground(colors.gold, 0.08),
                    color: colors.onInk,
                    boxShadow: shadows.hero,
                    borderRadius: 14,
                    padding: 22,
                  }}
                >
                  <div style={{ fontSize: 26, fontWeight: 600, marginBottom: 10, fontFamily: fonts.display }}>
                    Before: {session.insight.beforePct}% &rarr; <span style={{ color: colors.gold }}>After: {session.insight.afterPct}%</span>
                  </div>
                  <p style={{ fontSize: 14, fontStyle: "italic", color: colors.onInkMuted }}>&ldquo;{session.insight.narrative}&rdquo;</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12, fontFamily: fonts.ui, fontSize: 12.5 }}>
                    {fourDDimensions.map((dim) => {
                      const d = session.insight!.dimensionBreakdown[dim];
                      return (
                        <div key={dim} style={{ background: colors.card, borderRadius: 8, padding: 10 }}>
                          <span style={{ fontWeight: 700, display: "block", marginBottom: 3, color: colors.goldText }}>
                            {dimensionLabels[dim]}
                            {dim === session.insight!.strongestDimension && " ↑"}
                            {dim === session.insight!.weakestDimension && " ↓"}
                          </span>
                          <span style={{ color: colors.textPrimary }}>
                            {d.beforePct}% &rarr; {d.afterPct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {session.insight && meta_.insight && (
                <SourceTag tag={meta_.insight.sourceTag} provider={meta_.insight.provider} />
              )}
            </div>
          )}
        </StepCard>

        <StepCard step={10} title="Rubric Project (optional)">
          <p style={{ fontSize: 13, color: colors.textMuted, marginBottom: 10 }}>
            An open-ended project task, graded on a 4-level rubric instead of the Yes/No quiz above -- for when a
            creative or take-home task fits the lesson better than a comprehension check.
          </p>
          <button style={btnStyle} onClick={generateRubricProject} disabled={loading.rubricProject}>
            {loading.rubricProject ? "Generating…" : "Generate rubric project"}
          </button>
          {errors.rubricProject && <p style={errorStyle}>{errors.rubricProject}</p>}
          {session.rubricProject && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 600 }}>{session.rubricProject.taskPrompt}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                {session.rubricProject.levels.map((lvl, i) => (
                  <div key={i} style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 10 }}>
                    <strong style={{ fontSize: 12.5, fontFamily: fonts.ui, textTransform: "capitalize", color: colors.goldText }}>
                      {i + 1}. {lvl.level}
                    </strong>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                      {lvl.descriptors.map((d, j) => (
                        <li key={j} style={{ fontSize: 13 }}>{d}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {meta_.rubricProject && <SourceTag tag={meta_.rubricProject.sourceTag} provider={meta_.rubricProject.provider} />}
            </div>
          )}
        </StepCard>
      </div>
    </div>
  );
}
