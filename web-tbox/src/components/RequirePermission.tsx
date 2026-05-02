import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { TboxPermission } from "../constants/permissions";
import { hasPermission } from "../constants/permissions";
import { useAuth } from "../context/AuthContext";

export function RequirePermission({
  permission,
  children,
}: {
  permission: TboxPermission;
  children: ReactNode;
}) {
  const { permissions, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="muted" style={{ padding: 16 }}>
        加载权限…
      </div>
    );
  }

  if (!hasPermission(permissions, permission)) {
    return <Navigate to="/no-permission" replace state={{ from: location.pathname, required: permission }} />;
  }

  return <>{children}</>;
}
