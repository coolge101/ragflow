import { Authorization, Token, UserInfo } from "../constants/storageKeys";

export function getAuthorizationHeader(): string {
  return localStorage.getItem(Authorization) || "";
}

export function clearSession(): void {
  localStorage.removeItem(Authorization);
  localStorage.removeItem(Token);
  localStorage.removeItem(UserInfo);
}

export type StoredUserInfo = {
  avatar?: string;
  name?: string;
  email?: string;
  /** From login JSON; used when `/v1/tbox/me` is missing (e.g. stock RAGFlow image). */
  is_superuser?: boolean;
};

export function getStoredUserInfo(): StoredUserInfo | null {
  const raw = localStorage.getItem(UserInfo);
  if (!raw?.trim()) {
    return null;
  }
  try {
    return JSON.parse(raw) as StoredUserInfo;
  } catch {
    return null;
  }
}

function truthySuperuser(v: unknown): boolean {
  return v === true || v === 1 || v === "1" || v === "true";
}

/**
 * Bootstrap admin email treated as superuser when the login/`/me` payload omits or
 * mis-reports `is_superuser` (common with older RAGFlow JSON or NULL in DB).
 * Set to empty string in `.env` to disable this UI-side hint.
 */
export function trustedSuperuserFromEmail(email: string | undefined | null): boolean {
  const configured = (import.meta.env.VITE_SUPERUSER_EMAIL ?? "admin@ragflow.io").trim();
  if (!configured || !email?.trim()) {
    return false;
  }
  return email.trim().toLowerCase() === configured.toLowerCase();
}

/** Prefer explicit `is_superuser` from server; otherwise trust {@link trustedSuperuserFromEmail}. */
export function inferSuperuserFromLoginField(raw: unknown, email: string | undefined): boolean {
  if (truthySuperuser(raw)) {
    return true;
  }
  return trustedSuperuserFromEmail(email);
}

export function storedUserIsSuperuser(info: StoredUserInfo | null | undefined): boolean {
  if (!info) {
    return false;
  }
  if (truthySuperuser(info.is_superuser)) {
    return true;
  }
  return trustedSuperuserFromEmail(info.email);
}

export function saveLoginSession(params: {
  authorization: string;
  accessToken: string;
  userInfo: StoredUserInfo;
}): void {
  localStorage.setItem(Authorization, params.authorization);
  localStorage.setItem(Token, params.accessToken);
  localStorage.setItem(UserInfo, JSON.stringify(params.userInfo));
}
