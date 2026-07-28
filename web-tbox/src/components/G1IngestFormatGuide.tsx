import { useState } from "react";

import { G1_FORMAT_ROWS } from "../utils/g1IngestFormatGuide";

type Props = {
  /** 嵌入创建弹窗等窄区域时为 true */
  compact?: boolean;
};

export function G1IngestFormatGuide({ compact = false }: Props) {
  const [open, setOpen] = useState(!compact);

  return (
    <section
      style={{
        marginTop: compact ? "0.75rem" : "1rem",
        marginBottom: compact ? 0 : "0.5rem",
        maxWidth: compact ? undefined : 960,
        padding: compact ? "0.65rem 0.75rem" : "0.85rem 1rem",
        background: "#f8fafc",
        border: "1px solid var(--border-subtle)",
        borderRadius: 8,
        fontSize: "0.85rem",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          fontWeight: 600,
          cursor: "pointer",
          color: "inherit",
          textAlign: "left",
          width: "100%",
        }}
      >
        {open ? "▾" : "▸"} G1 多格式入库向导（PDF / Word / Excel / 图片）
      </button>
      {open ? (
        <>
          <p className="muted" style={{ margin: "0.5rem 0 0.65rem", lineHeight: 1.45 }}>
            上传 → <strong>开始解析</strong> → <strong>/search</strong> 检索验证。Excel 须<strong>表头 + 数据行</strong>；图片库请用{" "}
            <code>picture</code> 分块。
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border-subtle)" }}>
                  <th style={{ padding: "0.35rem 0.5rem" }}>格式</th>
                  <th style={{ padding: "0.35rem 0.5rem" }}>后缀</th>
                  <th style={{ padding: "0.35rem 0.5rem" }}>建议分块</th>
                  <th style={{ padding: "0.35rem 0.5rem" }}>说明</th>
                </tr>
              </thead>
              <tbody>
                {G1_FORMAT_ROWS.map((row) => (
                  <tr key={row.kind} style={{ borderBottom: "1px solid #eef2f7" }}>
                    <td style={{ padding: "0.35rem 0.5rem", whiteSpace: "nowrap" }}>{row.label}</td>
                    <td style={{ padding: "0.35rem 0.5rem" }}>
                      <code>{row.extensions}</code>
                    </td>
                    <td style={{ padding: "0.35rem 0.5rem" }}>
                      <code>{row.chunkMethod}</code>
                    </td>
                    <td style={{ padding: "0.35rem 0.5rem" }}>{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
