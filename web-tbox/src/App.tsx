import { Navigate, Route, Routes } from "react-router-dom";
import { RequirePermission } from "./components/RequirePermission";
import { useRouteDocumentTitle } from "./hooks/useRouteDocumentTitle";
import { MainLayout } from "./layouts/MainLayout";
import { ProtectedShell } from "./layouts/ProtectedShell";
import { AuditPage } from "./pages/AuditPage";
import { ChatPage } from "./pages/ChatPage";
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
        <Route element={<MainLayout />}>
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
          <Route
            path="documents"
            element={
              <RequirePermission permission="doc.view">
                <DocumentsPage />
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
            path="kb"
            element={
              <RequirePermission permission="kb.configure">
                <KbConfigPage />
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
          <Route path="kbs" element={<Navigate to="/documents" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
