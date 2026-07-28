import { Link } from "react-router-dom";
import {
  ADMIN_NAV_ITEMS,
  filterNavItems,
  resolveUserHomePath,
} from "../constants/adminAccess";
import { useAuth } from "../context/AuthContext";
import { ShellChrome } from "./ShellChrome";

export function AdminLayout() {
  const { me, permissions } = useAuth();
  const navItems = filterNavItems(ADMIN_NAV_ITEMS, permissions, me);
  const userHome = resolveUserHomePath(permissions, me);

  return (
    <ShellChrome
      brandSubtitle="管理端"
      navItems={navItems}
      headerExtra={
        <Link
          to={userHome}
          style={{
            fontSize: "0.9rem",
            color: "var(--color-primary)",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          返回使用
        </Link>
      }
    />
  );
}
