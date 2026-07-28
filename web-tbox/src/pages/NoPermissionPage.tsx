import { Link, useLocation, useNavigate } from "react-router-dom";

export function NoPermissionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { from?: string; required?: string } | undefined;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>无访问权限</h1>
      <p className="muted">
        当前账号缺少访问「{state?.from || "该功能"}」所需权限
        {state?.required ? (
          <>
            （<code>{state.required}</code>）
          </>
        ) : null}
        。请联系管理员分配角色，或使用左侧菜单进入有权限的模块。
      </p>
      <p style={{ marginTop: "1.5rem", display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
        <button type="button" onClick={() => navigate(-1)} style={{ cursor: "pointer" }}>
          返回上一页
        </button>
        <Link to="/">进入对话首页</Link>
      </p>
    </div>
  );
}
