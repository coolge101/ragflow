import { Authorization, Token, UserInfo } from "../constants/storageKeys";

export function getAuthorizationHeader(): string {
  return localStorage.getItem(Authorization) || "";
}

export function clearSession(): void {
  localStorage.removeItem(Authorization);
  localStorage.removeItem(Token);
  localStorage.removeItem(UserInfo);
}

export function saveLoginSession(params: {
  authorization: string;
  accessToken: string;
  userInfo: { avatar?: string; name?: string; email?: string };
}): void {
  localStorage.setItem(Authorization, params.authorization);
  localStorage.setItem(Token, params.accessToken);
  localStorage.setItem(UserInfo, JSON.stringify(params.userInfo));
}
