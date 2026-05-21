import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  buildSingleStepOnePagerHtml,
  downloadHtmlFile,
  exportFilenameDatePrefix,
  printHtmlInNewWindow,
} from "../../review/exportReviewOnePager";
import { JOURNEY_STEPS, journeyStepById, type JourneyStep } from "../../review/journeySteps";
import { readChecklistForStep, readNoteForStep, writeChecklistItem, writeNoteForStep } from "../../review/reviewStorage";

export function ReviewStepPage() {
  const { stepId = "" } = useParams();
  const step = useMemo(() => journeyStepById(stepId), [stepId]);
  const ordered = useMemo(() => [...JOURNEY_STEPS].sort((a, b) => a.order - b.order), []);
  const stepIndex = step ? ordered.findIndex((s) => s.id === step.id) : -1;
  const prevStep: JourneyStep | undefined =
    step && stepIndex > 0 ? ordered[stepIndex - 1] : undefined;
  const nextStep: JourneyStep | undefined =
    step && stepIndex >= 0 && stepIndex < ordered.length - 1 ? ordered[stepIndex + 1] : undefined;
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

  const onDownloadHtml = useCallback(() => {
    if (!step) {
      return;
    }
    const html = buildSingleStepOnePagerHtml({ step, checklist: checks, note });
    const name = `tbox-review-${step.id}-${exportFilenameDatePrefix()}.html`;
    downloadHtmlFile(name, html);
  }, [step, checks, note]);

  const onPrint = useCallback(() => {
    if (!step) {
      return;
    }
    const html = buildSingleStepOnePagerHtml({ step, checklist: checks, note });
    if (!printHtmlInNewWindow(html)) {
      window.alert("无法打开新窗口，请允许弹出窗口后使用「打印 / 存 PDF」。");
    }
  }, [step, checks, note]);

  if (!stepId || !step) {
    return <Navigate to="/review" replace />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)", padding: "1.5rem 1.25rem 2.5rem" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <p style={{ marginTop: 0, marginBottom: "0.75rem" }}>
          <Link to="/review">← 返回确认索引</Link>
        </p>
        <header
          style={{
            background: "#fff",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            padding: "1rem 1.25rem",
            marginBottom: "1rem",
          }}
        >
          <div className="muted" style={{ fontSize: "0.85rem", marginBottom: 6 }}>
            动线 {step.order}
          </div>
          <h1 style={{ margin: 0, fontSize: "1.35rem" }}>{step.title}</h1>
          <p className="muted" style={{ marginBottom: 0, marginTop: "0.65rem" }}>
            {step.summary}
          </p>
        </header>

        <section
          style={{
            background: "#fff",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            padding: "1rem 1.25rem",
            marginBottom: "1rem",
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>验收要点（本机勾选）</h2>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {step.acceptance.map((line, i) => (
              <li key={i} style={{ listStyle: "none", marginLeft: "-1.1rem" }}>
                <label style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(checks[i])}
                    onChange={() => toggleCheck(i)}
                    style={{ marginTop: 3 }}
                  />
                  <span>{line}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section
          style={{
            background: "#fff",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            padding: "1rem 1.25rem",
            marginBottom: "1rem",
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>打开真实业务页</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            以下链接进入产品实际路由（可能需已登录与对应权限）。在真实页右下角「本页验收」打勾与这里<strong>同步</strong>。
          </p>
          <p style={{ marginBottom: 0 }}>
            <Link to={step.targetPath} style={{ fontWeight: 600 }}>
              {step.targetPath}
            </Link>
            {" · "}
            <a href={step.targetPath} target="_blank" rel="noreferrer">
              新标签打开
            </a>
          </p>
        </section>

        <section
          style={{
            background: "#fff",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            padding: "1rem 1.25rem",
            marginBottom: "1rem",
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>确认备注（本机）</h2>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            style={{ width: "100%", boxSizing: "border-box", padding: "0.5rem", fontFamily: "inherit", fontSize: "0.9rem" }}
            placeholder="记录评审结论、问题单号、待后端字段等…"
          />
          <p style={{ marginTop: "0.65rem", marginBottom: 0 }}>
            <button type="button" onClick={saveNote} style={{ cursor: "pointer" }}>
              保存备注
            </button>
          </p>
        </section>

        <section
          style={{
            background: "#fff",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            padding: "1rem 1.25rem",
            marginBottom: "1rem",
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>导出评审一页纸</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: "0.9rem" }}>
            HTML 可离线打开或归档。<strong>PDF</strong>：点「打印…」后在系统对话框中选择「另存为 PDF」（名称因浏览器而异）。导出内容包含当前页<strong>验收勾选与备注框内文字</strong>（与是否点击「保存备注」无关）。
          </p>
          <p style={{ marginBottom: 0, display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <button type="button" onClick={onDownloadHtml} style={{ cursor: "pointer" }}>
              下载本步 HTML
            </button>
            <button type="button" onClick={onPrint} style={{ cursor: "pointer" }}>
              打印 / 存 PDF…
            </button>
          </p>
        </section>

        <nav style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
          {prevStep ? (
            <Link to={`/review/step/${prevStep.id}`}>上一步：{prevStep.title}</Link>
          ) : (
            <span className="muted">无上一步</span>
          )}
          <span className="muted">|</span>
          {nextStep ? (
            <Link to={`/review/step/${nextStep.id}`}>下一步：{nextStep.title}</Link>
          ) : (
            <span className="muted">无下一步</span>
          )}
        </nav>
      </div>
    </div>
  );
}
