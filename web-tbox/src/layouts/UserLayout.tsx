import { Link } from "react-router-dom";
import {
  USER_NAV_ITEMS,
  canAccessAdmin,
  filterNavItems,
} from "../constants/adminAccess";
import { useAuth } from "../context/AuthContext";
import { ShellChrome } from "./ShellChrome";

export function UserLayout() {
  const { me, permissions } = useAuth();
  const navItems = filterNavItems(USER_NAV_ITEMS, permissions, me);
  const showAdminEntry = canAccessAdmin(permissions, me);

  return (
    <ShellChrome
      brandSubtitle="使用端"
      navItems={navItems}
      headerExtra={
        showAdminEntry ? (
          <Link
            to="/admin"
            style={{
              fontSize: "0.9rem",
              color: "var(--color-primary)",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            进入管理
          </Link>
        ) : undefined
      }
    />
  );
}
