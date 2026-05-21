import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { journeyStepById } from "../review/journeySteps";
import { pathToJourneyStepId } from "../review/pathToJourneyStep";
import { reviewPagesEnabled } from "../review/reviewGate";
import { readChecklistForStep, readNoteForStep, writeChecklistItem, writeNoteForStep } from "../review/reviewStorage";

type PageReviewPanelProps = {
  /** 登录页等不在 `pathToJourneyStepId` 映射内时传入 */
  forcedStepId?: string;
};

/**
 * 在各业务页提供可展开的「本页验收」：勾选与备注与 `/review/step/:id` 使用同一套 localStorage 键。
 */
export function PageReviewPanel({ forcedStepId }: PageReviewPanelProps) {
  const { pathname } = useLocation();
  const stepId = forcedStepId ?? pathToJourneyStepId(pathname);
  const step = stepId ? journeyStepById(stepId) : undefined;
  const [open, setOpen] = useState(false);
  const [checks, setChecks] = useState<boolean[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!step) {
      return;
    }
    setChecks(readChecklistForStep(step));
    setNote(readNoteForStep(step.id));
  }, [step]);

  const toggleCheck = useCallback(
    (index: number) => {
      if (!step) {
        return;
      }
      const draft = [...checks];
      draft[index] = !draft[index];
      setChecks(draft);
      writeChecklistItem(step.id, index, draft[index]);
    },
    [step, checks],
  );

  const saveNote = useCallback(() => {
    if (!step) {
      return;
    }
    writeNoteForStep(step.id, note);
  }, [step, note]);

  if (!reviewPagesEnabled() || !stepId || !step) {
    return null;
  }

  return (
    <div style={{ position: "fixed", right: 12, bottom: 12, zIndex: 900, fontFamily: "inherit" }}>
      {open ? (
        <div
          role="dialog"
          aria-label="本页验收"
          style={{
            width: "min(360px, calc(100vw - 24px))",
            maxHeight: "min(72vh, 520px)",
            overflow: "auto",
            background: "#fff",
            border: "1px solid var(--border-subtle)",
            borderRadius: 10,
            boxShadow: "0 8px 28px rgba(15, 23, 42, 0.12)",
            padding: "0.75rem 0.9rem 1rem",
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>本页验收 · {step.title}</div>
              <div className="muted" style={{ fontSize: "0.78rem", marginTop: 2 }}>
                与 <code>/review/step/{step.id}</code> 数据互通
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="关闭验收面板" style={{ cursor: "pointer", flexShrink: 0 }}>
              ✕
            </button>
          </div>
          <p className="muted" style={{ fontSize: "0.82rem", margin: "0 0 0.6rem" }}>
            {step.summary}
          </p>
          <ul style={{ margin: "0 0 0.65rem", paddingLeft: 0, listStyle: "none" }}>
            {step.acceptance.map((line, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                <label style={{ display: "flex", gap: "0.45rem", alignItems: "flex-start", cursor: "pointer", fontSize: "0.86rem" }}>
                  <input type="checkbox" checked={Boolean(checks[i])} onChange={() => toggleCheck(i)} style={{ marginTop: 3 }} />
                  <span>{line}</span>
                </label>
              </li>
            ))}
          </ul>
          <label className="muted" style={{ fontSize: "0.78rem", display: "block", marginBottom: 4 }}>
            备注
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            style={{
              width: "100%",
              boxSizing: "border-box",
              fontSize: "0.85rem",
              padding: "0.35rem 0.45rem",
              marginBottom: 6,
            }}
          />
          <button type="button" onClick={saveNote} style={{ cursor: "pointer", fontSize: "0.85rem", marginBottom: 8 }}>
            保存备注
          </button>
          <div style={{ fontSize: "0.82rem", display: "flex", flexDirection: "column", gap: 6 }}>
            <Link to={`/review/step/${step.id}`}>打开完整确认页</Link>
            <Link to="/review">打开确认索引</Link>
            {stepId !== "shell" ? (
              <Link to="/review/step/shell" style={{ marginTop: 4 }}>
                工作台壳层验收 →
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          cursor: "pointer",
          padding: "0.45rem 0.75rem",
          borderRadius: 999,
          border: "1px solid var(--border-subtle)",
          background: "#fff",
          boxShadow: "0 2px 10px rgba(15, 23, 42, 0.08)",
          fontSize: "0.88rem",
          fontWeight: 600,
          color: "var(--color-primary)",
        }}
      >
        {open ? "收起验收" : "本页验收"}
      </button>
    </div>
  );
}
