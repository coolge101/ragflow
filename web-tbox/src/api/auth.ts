import { getAuthorizationHeader, saveLoginSession } from "../auth/session";
import { rsaEncryptPassword } from "../utils/rsaPassword";

type LoginJson = {
  code: number;
  message?: string;
  data?: {
    access_token?: string;
    nickname?: string;
    email?: string;
    avatar?: string;
  };
};

export async function loginWithEmailPassword(
  email: string,
  passwordPlain: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const password = rsaEncryptPassword(passwordPlain);
    const res = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    let data: LoginJson;
    try {
      data = (await res.json()) as LoginJson;
    } catch {
      return { ok: false, message: "服务器返回了无效响应（非 JSON）" };
    }
    const authorization =
      res.headers.get("Authorization") || res.headers.get("authorization") || "";

    if (data.code !== 0 || !data.data?.access_token || !authorization) {
      return {
        ok: false,
        message: data.message || "登录失败",
      };
    }

    saveLoginSession({
      authorization,
      accessToken: data.data.access_token,
      userInfo: {
        avatar: data.data.avatar,
        name: data.data.nickname,
        email: data.data.email,
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
