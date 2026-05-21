import { useCallback } from "react";
import { Link } from "react-router-dom";
import {
  buildFullJourneyOnePagerHtml,
  downloadHtmlFile,
  exportFilenameDatePrefix,
  printHtmlInNewWindow,
} from "../../review/exportReviewOnePager";
import { JOURNEY_STEPS } from "../../review/journeySteps";

export function ReviewHubPage() {
  const sorted = [...JOURNEY_STEPS].sort((a, b) => a.order - b.order);

  const onDownloadFullHtml = useCallback(() => {
    const html = buildFullJourneyOnePagerHtml();
    downloadHtmlFile(`tbox-review-all-${exportFilenameDatePrefix()}.html`, html);
  }, []);

  const onPrintFull = useCallback(() => {
    const html = buildFullJourneyOnePagerHtml();
    if (!printHtmlInNewWindow(html)) {
      window.alert("无法打开新窗口，请允许弹出窗口后使用「打印 / 存 PDF」。");
    }
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)", padding: "1.5rem 1.25rem 2.5rem" }}>
      <header style={{ maxWidth: 900, margin: "0 auto 1.5rem" }}>
        <h1 style={{ marginTop: 0 }}>TBOX 页面确认</h1>
        <p className="muted" style={{ marginBottom: "0.75rem" }}>
          每一步对应<strong>一个实际 URL</strong>（<code>/review/step/…</code>），内附验收要点与打开真实业务页的链接，便于评审时逐页确认。勾选与备注仅存于本机浏览器。
        </p>
        <p className="muted" style={{ marginBottom: "0.75rem", fontSize: "0.9rem" }}>
          在<strong>真实业务页</strong>（如 <code>/search</code>、<code>/documents</code>）右下角有「<strong>本页验收</strong>」按钮，勾选与备注与上表<strong>同一套数据</strong>，可边操作边打勾。
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            alignItems: "center",
            marginBottom: "0.25rem",
          }}
        >
          <button type="button" onClick={onDownloadFullHtml} style={{ cursor: "pointer" }}>
            下载全部 HTML（一页）
          </button>
          <button type="button" onClick={onPrintFull} style={{ cursor: "pointer" }}>
            打印全部 / 存 PDF…
          </button>
        </div>
        <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
          「全部」导出：勾选随点随存；备注以各步是否点击「保存备注」为准。若备注未保存，可到该步用「下载本步 HTML」导出当前输入框内容。
        </p>
      </header>
      <div style={{ maxWidth: 900, margin: "0 auto", overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            background: "#fff",
            border: "1px solid var(--border-subtle)",
            fontSize: "0.95rem",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border-subtle)", textAlign: "left" }}>
              <th style={{ padding: "0.55rem 0.65rem" }}>#</th>
              <th style={{ padding: "0.55rem 0.65rem" }}>动线</th>
              <th style={{ padding: "0.55rem 0.65rem" }}>确认页</th>
              <th style={{ padding: "0.55rem 0.65rem" }}>点验目标（真实路由）</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.id} style={{ borderBottom: "1px solid var(--border-subtle)", verticalAlign: "top" }}>
                <td style={{ padding: "0.55rem 0.65rem", whiteSpace: "nowrap" }}>{s.order}</td>
                <td style={{ padding: "0.55rem 0.65rem" }}>{s.title}</td>
                <td style={{ padding: "0.55rem 0.65rem" }}>
                  <Link to={`/review/step/${s.id}`}>打开确认页</Link>
                </td>
                <td style={{ padding: "0.55rem 0.65rem" }}>
                  <Link to={s.targetPath}>{s.targetPath}</Link>
                  <div className="muted" style={{ fontSize: "0.85rem", marginTop: 4 }}>
                    {s.summary}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
