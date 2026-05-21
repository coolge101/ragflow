import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { TboxMeResponse } from "../api/tbox";
import type { TboxPermission } from "../constants/permissions";
import { hasPermission } from "../constants/permissions";
import { useAuth } from "../context/AuthContext";

export function RequirePermission({
  permission,
  children,
  alsoAllowIf,
}: {
  permission: TboxPermission;
  children: ReactNode;
  /** Extra access (e.g. RAGFlow 空间所有者/管理员打开「用户与角色」页，与后端 managed-users 授权一致). */
  alsoAllowIf?: (me: TboxMeResponse["data"] | null) => boolean;
}) {
  const { permissions, loading, me } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="muted" style={{ padding: 16 }}>
        加载权限…
      </div>
    );
  }

  const allowed =
    hasPermission(permissions, permission) || (alsoAllowIf?.(me ?? null) ?? false);
  if (!allowed) {
    return <Navigate to="/no-permission" replace state={{ from: location.pathname, required: permission }} />;
  }

  return <>{children}</>;
}
