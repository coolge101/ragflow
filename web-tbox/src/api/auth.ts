import { getAuthorizationHeader, inferSuperuserFromLoginField, saveLoginSession } from "../auth/session";
import { rsaEncryptPassword } from "../utils/rsaPassword";

import { readJsonBody } from "./readJsonBody";

/** RAGFlow ≥0.25 REST: `/api/v1/auth/login`. Older images (e.g. v0.24): `/v1/user/login`. Set `VITE_AUTH_LOGIN_PATH` in `web-tbox/.env`. */
const AUTH_LOGIN_PATH = import.meta.env.VITE_AUTH_LOGIN_PATH || "/api/v1/auth/login";

type LoginJson = {
  code: number;
  message?: string;
  data?: {
    access_token?: string;
    nickname?: string;
    email?: string;
    avatar?: string;
    is_superuser?: boolean | number | string;
  };
};

export async function loginWithEmailPassword(
  email: string,
  passwordPlain: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const password = rsaEncryptPassword(passwordPlain);
    const res = await fetch(AUTH_LOGIN_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await readJsonBody<LoginJson>(res);
    if (data.code === -1) {
      return { ok: false, message: data.message || "服务器返回了无效响应（非 JSON）" };
    }
    const authorization =
      res.headers.get("X-Ragflow-Authorization") ||
      res.headers.get("Authorization") ||
      res.headers.get("authorization") ||
      "";

    // JWT lives in response headers; JSON access_token is a fallback when headers are hidden.
    const accessToken = authorization || data.data?.access_token || "";

    if (data.code !== 0 || !accessToken) {
      const base = data.message || "登录失败";
      const httpNote = !res.ok ? `（HTTP ${res.status}）` : "";
      return {
        ok: false,
        message: base + httpNote,
      };
    }

    const is_superuser = inferSuperuserFromLoginField(data.data?.is_superuser, data.data?.email);

    saveLoginSession({
      authorization: authorization || accessToken,
      accessToken,
      userInfo: {
        avatar: data.data?.avatar,
        name: data.data?.nickname,
        email: data.data?.email,
        is_superuser,
      },
    });
    return { ok: true, message: data.message || "ok" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function logoutServer(): Promise<void> {
  const auth = getAuthorizationHeader();
  if (!auth) {
    return;
  }
  await fetch("/v1/tbox/logout", {
    method: "POST",
    headers: { Authorization: auth },
  }).catch(() => undefined);
}
