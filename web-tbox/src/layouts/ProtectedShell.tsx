import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { getAuthorizationHeader } from "../auth/session";

/** Ensures `Authorization` exists; otherwise redirects to `/login?redirect=`. */
export function ProtectedShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const authed = Boolean(getAuthorizationHeader());

  useEffect(() => {
    if (!authed) {
      const redirect = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?redirect=${redirect}`, { replace: true });
    }
  }, [authed, navigate, location.pathname, location.search]);

  if (!authed) {
    return (
      <div className="muted" style={{ padding: 24 }}>
        正在跳转登录…
      </div>
    );
  }

  return <Outlet />;
}
