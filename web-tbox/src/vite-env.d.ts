/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RAGFLOW_API_ORIGIN: string;
  /** e.g. `/v1/user/login` for RAGFlow v0.24 Docker image; omit for `/api/v1/auth/login` */
  readonly VITE_AUTH_LOGIN_PATH?: string;
  /** When `1`, treat failed `/v1/tbox/me` (non-401) as offline and grant fallback permissions. */
  readonly VITE_TBOX_OFFLINE_PERMISSIONS?: string;
  /** Email (case-insensitive) treated as superuser when login omits `is_superuser`. Default `admin@ragflow.io`. Set empty to disable. */
  readonly VITE_SUPERUSER_EMAIL?: string;
  /**
   * `1` / `true`：生产构建也开放 `/review` 页面确认索引（默认仅开发模式开放）。
   * `0` / `false`：即使在开发模式也关闭评审路由。
   */
  readonly VITE_REVIEW_PAGES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
