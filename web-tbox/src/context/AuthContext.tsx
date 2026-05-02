import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { fetchTboxMe, fallbackPermissions, type TboxMeResponse } from "../api/tbox";
import { clearSession, getAuthorizationHeader } from "../auth/session";
import type { TboxPermission } from "../constants/permissions";

type AuthState = {
  me: TboxMeResponse["data"] | null;
  permissions: TboxPermission[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [me, setMe] = useState<TboxMeResponse["data"] | null>(null);
  const [permissions, setPermissions] = useState<TboxPermission[]>([]);
  const [loading, setLoading] = useState(Boolean(getAuthorizationHeader()));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const auth = getAuthorizationHeader();
    if (!auth) {
      setMe(null);
      setPermissions([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { res, body } = await fetchTboxMe();
      if (res.status === 401 || body.code === 401) {
        clearSession();
        setMe(null);
        setPermissions([]);
        setError(null);
        navigate("/login", { replace: true });
        return;
      }
      if (body.code !== 0) {
        setError(body.message || `错误码 ${body.code}`);
        setMe(null);
        setPermissions([]);
        return;
      }
      const data = body.data || null;
      setMe(data);
      setPermissions(fallbackPermissions(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMe(null);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ me, permissions, loading, error, refresh }),
    [me, permissions, loading, error, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
