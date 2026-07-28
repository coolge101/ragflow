import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { canAccessAdmin } from "../constants/adminAccess";
import { useAuth } from "../context/AuthContext";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { me, permissions, loading } = useAuth();
  if (loading) return <div className="muted">同步用户信息…</div>;
  if (!canAccessAdmin(permissions, me)) {
    return <Navigate to="/no-permission" replace />;
  }
  return <>{children}</>;
}
