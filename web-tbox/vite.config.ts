import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_RAGFLOW_API_ORIGIN || "http://127.0.0.1:9380";
  return {
    plugins: [react()],
    server: {
      host: true, // listen on 0.0.0.0 — use VM/LAN IP from another machine, not only 127.0.0.1 on that machine
      port: 5174,
      proxy: {
        "/v1": { target, changeOrigin: true },
        "/api": { target, changeOrigin: true },
      },
    },
  };
});
