import { Navigate, Route, Routes, useLocation, useParams, useSearchParams } from "react-router-dom";
import { RequirePermission } from "./components/RequirePermission";
import { useRouteDocumentTitle } from "./hooks/useRouteDocumentTitle";
import { AdminLayout } from "./layouts/AdminLayout";
import { ProtectedShell } from "./layouts/ProtectedShell";
import { RequireAdmin } from "./layouts/RequireAdmin";
import { UserLayout } from "./layouts/UserLayout";
import { AdminHomePage } from "./pages/AdminHomePage";
import { AuditPage } from "./pages/AuditPage";
import { ChatAppEditPage } from "./pages/ChatAppEditPage";
import { ChatAppsPage } from "./pages/ChatAppsPage";
import { ChatPage } from "./pages/ChatPage";
import { CrawlGoalsPage } from "./pages/CrawlGoalsPage";
import { CrawlPage } from "./pages/CrawlPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { KbConfigPage } from "./pages/KbConfigPage";
import { LoginPage } from "./pages/LoginPage";
import { NoPermissionPage } from "./pages/NoPermissionPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { SearchPage } from "./pages/SearchPage";
import { ReviewGate } from "./pages/review/ReviewGate";
import { ReviewHubPage } from "./pages/review/ReviewHubPage";
import { ReviewStepPage } from "./pages/review/ReviewStepPage";
import { UsersPage } from "./pages/UsersPage";
import { canManageAnyWorkspaceTenant } from "./utils/tenantWorkspace";

function LegacyRedirect({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={`${to}${search}${hash}`} replace />;
}

function RedirectRagToSearch() {
  const [sp] = useSearchParams();
  const { hash } = useLocation();
  const q = sp.toString();
  return <Navigate to={q ? `/search?${q}${hash}` : `/search${hash}`} replace />;
}

function RedirectAppsId() {
  const { id } = useParams();
  const { search, hash } = useLocation();
  return <Navigate to={`/admin/apps/${id}${search}${hash}`} replace />;
}

export function App() {
  useRouteDocumentTitle();
  return (
    <Routes>
      <Route
        path="/review"
        element={
          <ReviewGate>
            <ReviewHubPage />
          </ReviewGate>
        }
      />
      <Route
        path="/review/step/:stepId"
        element={
          <ReviewGate>
            <ReviewStepPage />
          </ReviewGate>
        }
      />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedShell />}>
        <Route path="rag" element={<RedirectRagToSearch />} />
        <Route path="documents" element={<LegacyRedirect to="/admin/documents" />} />
        <Route path="kbs" element={<LegacyRedirect to="/admin/documents" />} />
        <Route path="crawl" element={<LegacyRedirect to="/admin/crawl" />} />
        <Route path="crawl/goals" element={<LegacyRedirect to="/admin/crawl/goals" />} />
        <Route path="kb" element={<LegacyRedirect to="/admin/kb" />} />
        <Route path="apps" element={<LegacyRedirect to="/admin/apps" />} />
        <Route path="apps/new" element={<LegacyRedirect to="/admin/apps/new" />} />
        <Route path="apps/:id" element={<RedirectAppsId />} />
        <Route path="audit" element={<LegacyRedirect to="/admin/audit" />} />
        <Route path="users" element={<LegacyRedirect to="/admin/users" />} />

        <Route element={<UserLayout />}>
          <Route path="no-permission" element={<NoPermissionPage />} />
          <Route
            index
            element={
              <RequirePermission permission="chat.use">
                <ChatPage />
              </RequirePermission>
            }
          />
          <Route
            path="search"
            element={
              <RequirePermission permission="search.use">
                <SearchPage />
              </RequirePermission>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route
          path="admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminHomePage />} />
          <Route
            path="crawl/goals"
            element={
              <RequirePermission permission="crawl.manage">
                <CrawlGoalsPage />
              </RequirePermission>
            }
          />
          <Route
            path="crawl"
            element={
              <RequirePermission permission="crawl.manage">
                <CrawlPage />
              </RequirePermission>
            }
          />
          <Route
            path="documents"
            element={
              <RequirePermission permission="doc.view">
                <DocumentsPage />
              </RequirePermission>
            }
          />
          <Route
            path="kb"
            element={
              <RequirePermission permission="kb.configure">
                <KbConfigPage />
              </RequirePermission>
            }
          />
          <Route
            path="apps"
            element={
              <RequirePermission permission="kb.configure">
                <ChatAppsPage />
              </RequirePermission>
            }
          />
          <Route
            path="apps/new"
            element={
              <RequirePermission permission="kb.configure">
                <ChatAppEditPage />
              </RequirePermission>
            }
          />
          <Route
            path="apps/:id"
            element={
              <RequirePermission permission="kb.configure">
                <ChatAppEditPage />
              </RequirePermission>
            }
          />
          <Route
            path="audit"
            element={
              <RequirePermission permission="audit.read">
                <AuditPage />
              </RequirePermission>
            }
          />
          <Route
            path="users"
            element={
              <RequirePermission permission="user.manage" alsoAllowIf={(m) => canManageAnyWorkspaceTenant(m)}>
                <UsersPage />
              </RequirePermission>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
