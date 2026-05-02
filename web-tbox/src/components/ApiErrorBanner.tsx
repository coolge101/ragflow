import { type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";

const base: CSSProperties = {
  marginBottom: "0.75rem",
  padding: "0.65rem 0.9rem",
  borderRadius: 8,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "0.65rem",
};

export type ApiErrorBannerProps = {
  children: ReactNode;
  showLoginLink?: boolean;
  onRetry?: () => void;
  retryLabel?: string;
  retryDisabled?: boolean;
  retryBusy?: boolean;
  role?: "alert" | "status";
  style?: CSSProperties;
};

export function ApiErrorBanner({
  children,
  showLoginLink = true,
  onRetry,
  retryLabel = "重试",
  retryDisabled,
  retryBusy,
  role = "alert",
  style,
}: ApiErrorBannerProps) {
  const busy = Boolean(retryBusy);
  const disabled = Boolean(retryDisabled) || busy;
  return (
    <div style={{ ...base, ...style }} role={role}>
      <span style={{ color: "#991b1b", flex: "1 1 12rem" }}>
        {children}
        {showLoginLink ? (
          <>
            {" "}
            <Link to="/login">去登录</Link>
          </>
        ) : null}
      </span>
      {onRetry ? (
        <button type="button" disabled={disabled} onClick={() => onRetry()} style={{ cursor: disabled ? "wait" : "pointer" }}>
          {busy ? "重试中…" : retryLabel}
        </button>
      ) : null}
    </div>
  );
}
