import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import {
  ADMIN_PANEL_ROLES,
  getDashboardPathByRole,
  ROLE_DEVELOPER,
  ROLE_TESTER,
} from "@/lib/roles";

const AuthPage = lazy(() => import("@/pages/AuthPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const DeveloperDashboardPage = lazy(() => import("@/pages/DeveloperDashboardPage"));
const DeveloperSettingsPage = lazy(() => import("@/pages/DeveloperSettingsPage"));
const TesterDashboardPage = lazy(() => import("@/pages/TesterDashboardPage"));
const ProjectsPage = lazy(() => import("@/pages/ProjectsPage"));
const BacklogPage = lazy(() => import("@/pages/BacklogPage"));
const IssuesPage = lazy(() => import("@/pages/IssuesPage"));
const TasksPage = lazy(() => import("@/pages/TasksPage"));
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));
const UserSettingsPage = lazy(() => import("@/pages/UserSettingsPage"));
const TeamsPage = lazy(() => import("@/pages/TeamsPage"));
const TeamCreatePage = lazy(() => import("@/pages/TeamCreatePage"));
const TeamDetailsPage = lazy(() => import("@/pages/TeamDetailsPage"));

const PublicRouteFallback = () => (
  <main className="flex min-h-screen items-center justify-center px-6 py-12">
    <div className="w-full max-w-6xl space-y-5">
      <Skeleton className="h-[220px] w-full rounded-[36px]" />
      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <Skeleton className="h-[520px] w-full rounded-[32px]" />
        <Skeleton className="h-[520px] w-full rounded-[32px]" />
      </div>
    </div>
  </main>
);

const ProtectedRoute = ({ children, roles }) => {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles?.length && !roles.includes(role)) {
    return <Navigate to={getDashboardPathByRole(role)} replace />;
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, role } = useAuth();

  if (isAuthenticated) {
    return <Navigate to={getDashboardPathByRole(role)} replace />;
  }

  return children;
};

const RootRoute = () => {
  const { isAuthenticated, role } = useAuth();

  return (
    <Navigate to={isAuthenticated ? getDashboardPathByRole(role) : "/login"} replace />
  );
};

const LegacyDashboardRedirect = () => {
  const { role } = useAuth();

  return <Navigate to={getDashboardPathByRole(role)} replace />;
};

const App = () => (
  <Routes>
    <Route path="/" element={<RootRoute />} />
    <Route
      path="/login"
      element={
        <PublicRoute>
          <Suspense fallback={<PublicRouteFallback />}>
            <AuthPage />
          </Suspense>
        </PublicRoute>
      }
    />
    <Route
      path="/admin"
      element={
        <PublicRoute>
          <Suspense fallback={<PublicRouteFallback />}>
            <AuthPage />
          </Suspense>
        </PublicRoute>
      }
    />
    <Route
      path="/auth"
      element={
        <PublicRoute>
          <Suspense fallback={<PublicRouteFallback />}>
            <AuthPage />
          </Suspense>
        </PublicRoute>
      }
    />
    <Route
      element={
        <ProtectedRoute>
          <AppShell />
        </ProtectedRoute>
      }
    >
      <Route path="/dashboard" element={<LegacyDashboardRedirect />} />
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute roles={ADMIN_PANEL_ROLES}>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dev/dashboard"
        element={
          <ProtectedRoute roles={[ROLE_DEVELOPER]}>
            <DeveloperDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dev/settings"
        element={
          <ProtectedRoute roles={[ROLE_DEVELOPER, ROLE_TESTER]}>
            <DeveloperSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tester/dashboard"
        element={
          <ProtectedRoute roles={[ROLE_TESTER]}>
            <TesterDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/backlog"
        element={
          <ProtectedRoute roles={ADMIN_PANEL_ROLES}>
            <BacklogPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects"
        element={
          <ProtectedRoute roles={ADMIN_PANEL_ROLES}>
            <ProjectsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teams"
        element={
          <ProtectedRoute roles={ADMIN_PANEL_ROLES}>
            <TeamsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teams/create"
        element={
          <ProtectedRoute roles={ADMIN_PANEL_ROLES}>
            <TeamCreatePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teams/:id"
        element={
          <ProtectedRoute roles={ADMIN_PANEL_ROLES}>
            <TeamDetailsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/users"
        element={
          <ProtectedRoute roles={ADMIN_PANEL_ROLES}>
            <UserSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route path="/issues" element={<IssuesPage />} />
      <Route
        path="/tasks"
        element={
          <ProtectedRoute roles={[ROLE_DEVELOPER, ROLE_TESTER]}>
            <TasksPage />
          </ProtectedRoute>
        }
      />
      <Route path="/reports" element={<ReportsPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default App;
