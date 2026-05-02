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
import { fetchTboxContract, fetchTboxMe, fallbackPermissions, type TboxMeResponse } from "../api/tbox";
import { clearSession, getAuthorizationHeader } from "../auth/session";
import { TBOX_API_CONTRACT_VERSION_EXPECTED } from "../constants/tboxContract";
import type { TboxPermission } from "../constants/permissions";

type AuthState = {
  me: TboxMeResponse["data"] | null;
  permissions: TboxPermission[];
  loading: boolean;
  error: string | null;
  /** Non-fatal: backend `TBOX_API_CONTRACT_VERSION` ≠ frontend expected build. */
  contractWarning: string | null;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [me, setMe] = useState<TboxMeResponse["data"] | null>(null);
  const [permissions, setPermissions] = useState<TboxPermission[]>([]);
  const [loading, setLoading] = useState(Boolean(getAuthorizationHeader()));
  const [error, setError] = useState<string | null>(null);
  const [contractWarning, setContractWarning] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const auth = getAuthorizationHeader();
    if (!auth) {
      setMe(null);
      setPermissions([]);
      setLoading(false);
      setError(null);
      setContractWarning(null);
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
        setContractWarning(null);
        navigate("/login", { replace: true });
        return;
      }
      if (body.code !== 0) {
        setError(body.message || `错误码 ${body.code}`);
        setMe(null);
        setPermissions([]);
        setContractWarning(null);
        return;
      }
      const data = body.data || null;
      setMe(data);
      setPermissions(fallbackPermissions(data));

      try {
        const c = await fetchTboxContract();
        if (c.res.ok && c.body.code === 0 && c.body.data?.tbox_api_contract_version != null) {
          const v = c.body.data.tbox_api_contract_version;
          if (v !== TBOX_API_CONTRACT_VERSION_EXPECTED) {
            setContractWarning(
              `后端 API 契约版本为 ${v}，本控制台按 ${TBOX_API_CONTRACT_VERSION_EXPECTED} 构建，部分字段或权限可能与服务器不一致。`,
            );
          } else {
            setContractWarning(null);
          }
        } else {
          setContractWarning(null);
        }
      } catch {
        setContractWarning(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMe(null);
      setPermissions([]);
      setContractWarning(null);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ me, permissions, loading, error, contractWarning, refresh }),
    [me, permissions, loading, error, contractWarning, refresh],
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
