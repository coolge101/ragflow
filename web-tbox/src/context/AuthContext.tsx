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
import {
  fetchTboxContract,
  fetchTboxMe,
  fallbackPermissions,
  isTboxMeUnavailable,
  type TboxMeResponse,
} from "../api/tbox";
import {
  clearSession,
  getAuthorizationHeader,
  getStoredUserInfo,
  storedUserIsSuperuser,
  trustedSuperuserFromEmail,
} from "../auth/session";
import { TBOX_API_CONTRACT_VERSION_EXPECTED } from "../constants/tboxContract";
import type { TboxPermission } from "../constants/permissions";

export type AuthSnapshot = {
  me: TboxMeResponse["data"] | null;
  permissions: TboxPermission[];
};

type AuthState = {
  me: TboxMeResponse["data"] | null;
  permissions: TboxPermission[];
  loading: boolean;
  error: string | null;
  /** Non-fatal: backend `TBOX_API_CONTRACT_VERSION` ≠ frontend expected build. */
  contractWarning: string | null;
  /** Resolves with the snapshot just applied (for post-login navigation). */
  refresh: () => Promise<AuthSnapshot>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [me, setMe] = useState<TboxMeResponse["data"] | null>(null);
  const [permissions, setPermissions] = useState<TboxPermission[]>([]);
  const [loading, setLoading] = useState(Boolean(getAuthorizationHeader()));
  const [error, setError] = useState<string | null>(null);
  const [contractWarning, setContractWarning] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<AuthSnapshot> => {
    const auth = getAuthorizationHeader();
    if (!auth) {
      setMe(null);
      setPermissions([]);
      setLoading(false);
      setError(null);
      setContractWarning(null);
      return { me: null, permissions: [] };
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
        return { me: null, permissions: [] };
      }
      if (body.code !== 0) {
        if (isTboxMeUnavailable(res, body)) {
          const stored = getStoredUserInfo();
          const su = storedUserIsSuperuser(stored);
          const nextMe = {
            email: stored?.email,
            nickname: stored?.name,
            is_superuser: su,
            tenants: [],
          };
          const nextPermissions = fallbackPermissions({ is_superuser: su });
          setMe(nextMe);
          setPermissions(nextPermissions);
          setError(null);
          setContractWarning(
            [
              "当前 API 未提供 TBOX（/v1/tbox/me 不可用），界面已按登录信息启用有限默认权限。",
              "处理方式：① 使用包含本仓库 `api/apps/tbox_app.py` 的后端（在仓库根目录 docker build -f Dockerfile -t ragflow-tbox:local .，docker/.env 设置 RAGFLOW_IMAGE=ragflow-tbox:local 后重启 compose）；② 开发时 export PYTHONPATH=<仓库根> 运行官方 launch 脚本；③ 若经 Nginx 反代，确认 location 包含 /v1 并转发到 API。",
              "自检：curl 或浏览器打开 /v1/tbox/health，应返回 JSON 且含 tbox_api_contract_version。",
            ].join("\n"),
          );
          return { me: nextMe, permissions: nextPermissions };
        }
        setError(body.message || `错误码 ${body.code}`);
        setMe(null);
        setPermissions([]);
        setContractWarning(null);
        return { me: null, permissions: [] };
      }
      const data = body.data || null;
      const nextPermissions = fallbackPermissions({
        ...data,
        is_superuser:
          Boolean(data?.is_superuser) || trustedSuperuserFromEmail(data?.email),
      });
      setMe(data);
      setPermissions(nextPermissions);

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
      return { me: data, permissions: nextPermissions };
    } catch (e) {
      const authAfter = getAuthorizationHeader();
      if (authAfter && import.meta.env.VITE_TBOX_OFFLINE_PERMISSIONS === "1") {
        const stored = getStoredUserInfo();
        const su = storedUserIsSuperuser(stored);
        const nextMe = {
          email: stored?.email,
          nickname: stored?.name,
          is_superuser: su,
          tenants: [],
        };
        const nextPermissions = fallbackPermissions({ is_superuser: su });
        setMe(nextMe);
        setPermissions(nextPermissions);
        setError(null);
        setContractWarning(
          "无法请求 TBOX「/v1/tbox/me」（网络或 CORS）。已启用 VITE_TBOX_OFFLINE_PERMISSIONS=1，按登录信息授予默认权限。",
        );
        return { me: nextMe, permissions: nextPermissions };
      }
      setError(e instanceof Error ? e.message : String(e));
      setMe(null);
      setPermissions([]);
      setContractWarning(null);
      return { me: null, permissions: [] };
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
