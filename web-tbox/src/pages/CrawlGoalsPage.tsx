import { FormEvent, useCallback, useEffect, useState } from "react";
import { ApiErrorBanner } from "../components/ApiErrorBanner";
import {
  listCrawlGoals,
  listGoalRuns,
  planCrawlGoal,
  triggerGoalOptimize,
  type GoalCard,
  type GoalRow,
  type GoalRunRow,
} from "../api/crawlGoals";

const DOMAIN_OPTS = [
  { value: "", label: "自动推断" },
  { value: "MA", label: "市场 MA" },
  { value: "TD", label: "技术 TD" },
  { value: "RS", label: "法规 RS" },
  { value: "COMP", label: "竞品 COMP" },
];

export function CrawlGoalsPage() {
  const [text, setText] = useState(
    "我想要 TBOX 的销售/出货数据、主要供应商及份额，以及相关整车销量等公开市场资料",
  );
  const [domain, setDomain] = useState("");
  const [card, setCard] = useState<GoalCard | null>(null);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [runs, setRuns] = useState<GoalRunRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const refreshGoals = useCallback(async () => {
    const { res, body } = await listCrawlGoals({ limit: 30 });
    if (res.status === 401 || body.code === 401) {
      setError("未授权");
      return;
    }
    if (body.code !== 0) {
      setError(body.message || `错误码 ${body.code}`);
      return;
    }
    setGoals(body.data?.items || []);
  }, []);

  const refreshRuns = useCallback(async (id: string) => {
    const { body } = await listGoalRuns(id, 10);
    if (body.code === 0) {
      setRuns(body.data?.items || []);
    }
  }, []);

  useEffect(() => {
    void refreshGoals();
  }, [refreshGoals]);

  async function onPlan(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const { res, body } = await planCrawlGoal({
        text: text.trim(),
        domain: domain || undefined,
        confirm: false,
      });
      if (res.status === 401 || body.code === 401) {
        setError("未授权");
        return;
      }
      if (body.code !== 0 || !body.data) {
        setError(body.message || "解析失败");
        return;
      }
      setCard(body.data);
      setGoalId(null);
      setInfo("已解析为目标卡（尚未确认）。可编辑检索词后确认启动。");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onConfirmAndStart(dryRun: boolean) {
    if (!card && !goalId) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      let id = goalId;
      if (!id) {
        const { res, body } = await planCrawlGoal({
          text: text.trim(),
          domain: (card?.domain || domain || undefined) as string | undefined,
          confirm: true,
        });
        if (res.status === 401 || body.code === 401) {
          setError("未授权");
          return;
        }
        if (body.code !== 0 || !body.data?.goal_id) {
          setError(body.message || "确认失败");
          return;
        }
        // Prefer edited queries from UI card if present
        id = body.data.goal_id;
        setCard(body.data);
        setGoalId(id);
      }
      const { body } = await triggerGoalOptimize(id!, { dry_run: dryRun });
      if (body.code !== 0) {
        setError(body.message || "启动失败");
        return;
      }
      setInfo(
        dryRun
          ? `已启动 dry-run（pid=${body.data?.pid}），仅同步词表`
          : `已启动优化轮次（pid=${body.data?.pid}），完成后刷新报告`,
      );
      await refreshGoals();
      await refreshRuns(id!);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function updateQueries(value: string) {
    if (!card) return;
    const queries = value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    setCard({ ...card, search_queries: queries });
  }

  return (
    <div style={{ maxWidth: 960 }}>
      <h1 style={{ fontSize: "1.35rem", marginBottom: "0.35rem" }}>采集目标</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        用自然语言描述你要的公开资料。系统会拆成目标卡，确认后自主优化检索词并跑一轮发现/爬取（不违法、不绕付费墙）。
      </p>

      {error ? (
        <ApiErrorBanner style={{ marginBottom: "0.75rem" }} onRetry={() => setError(null)}>
          {error}
        </ApiErrorBanner>
      ) : null}
      {info ? (
        <p style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "0.5rem 0.75rem", borderRadius: 6 }}>
          {info}
        </p>
      ) : null}

      <form onSubmit={onPlan} style={{ display: "grid", gap: "0.65rem", marginBottom: "1.25rem" }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span>采集需求</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            style={{ width: "100%", font: "inherit", padding: "0.5rem" }}
            required
          />
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span>域</span>
          <select value={domain} onChange={(e) => setDomain(e.target.value)}>
            {DOMAIN_OPTS.map((o) => (
              <option key={o.value || "auto"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="submit" disabled={busy || !text.trim()}>
            {busy ? "处理中…" : "解析目标"}
          </button>
          <button
            type="button"
            disabled={busy || (!card && !goalId)}
            onClick={() => void onConfirmAndStart(true)}
          >
            确认并 dry-run
          </button>
          <button
            type="button"
            disabled={busy || (!card && !goalId)}
            onClick={() => void onConfirmAndStart(false)}
          >
            确认并启动一轮
          </button>
          <button
            type="button"
            disabled={busy || !goalId}
            onClick={() => goalId && void refreshRuns(goalId)}
          >
            刷新报告
          </button>
        </div>
      </form>

      {card ? (
        <section
          style={{
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            padding: "0.85rem 1rem",
            marginBottom: "1.25rem",
            background: "#fff",
          }}
        >
          <h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>目标卡预览</h2>
          <p>
            <strong>域：</strong>
            {card.domain} · <strong>解析：</strong>
            {card.parser || "rule"}
          </p>
          <p>
            <strong>必含要素：</strong>
            {(card.must_have_facets || []).join(", ") || "—"}
          </p>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            {card.legal_constraints}
          </p>
          <label style={{ display: "grid", gap: 4 }}>
            <span>检索词（每行一条，确认时以解析结果入库；后续可再优化）</span>
            <textarea
              value={(card.search_queries || []).join("\n")}
              onChange={(e) => updateQueries(e.target.value)}
              rows={6}
              style={{ width: "100%", font: "inherit", padding: "0.5rem" }}
            />
          </label>
          {goalId ? (
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              goal_id: {goalId}
            </p>
          ) : null}
        </section>
      ) : null}

      {runs.length > 0 ? (
        <section style={{ marginBottom: "1.25rem" }}>
          <h2 style={{ fontSize: "1.05rem" }}>最近轮次报告</h2>
          {runs.map((r) => (
            <pre
              key={r.id}
              style={{
                background: "#0f172a",
                color: "#e2e8f0",
                padding: "0.75rem",
                borderRadius: 8,
                overflow: "auto",
                fontSize: "0.78rem",
              }}
            >
              {JSON.stringify(
                {
                  id: r.id,
                  status: r.status,
                  created_at: r.created_at,
                  finished_at: r.finished_at,
                  report: r.report_json,
                },
                null,
                2,
              )}
            </pre>
          ))}
        </section>
      ) : null}

      <section>
        <h2 style={{ fontSize: "1.05rem" }}>历史目标</h2>
        <ul style={{ paddingLeft: "1.1rem" }}>
          {goals.map((g) => (
            <li key={g.id} style={{ marginBottom: 6 }}>
              <button
                type="button"
                style={{ marginRight: 8 }}
                onClick={() => {
                  setGoalId(g.id);
                  setCard(g.card_json);
                  setText(g.nl_text || g.title);
                  void refreshRuns(g.id);
                }}
              >
                载入
              </button>
              <strong>{g.domain}</strong> · {g.status} · {g.title}
            </li>
          ))}
          {goals.length === 0 ? <li className="muted">暂无</li> : null}
        </ul>
      </section>
    </div>
  );
}
