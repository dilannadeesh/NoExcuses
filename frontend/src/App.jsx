import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { identify, trackPage } from "./lib/analytics";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import GroupsPage from "./pages/GroupsPage";
import GroupDetailPage from "./pages/GroupDetailPage";
import GroupMembersPage from "./pages/GroupMembersPage";
import LogGamePage from "./pages/LogGamePage";
import SchedulePage from "./pages/SchedulePage";
import LandingPage from "./pages/LandingPage";
import ProfilePage from "./pages/ProfilePage";
import TournamentDetailPage from "./pages/TournamentDetailPage";
import PublicTournamentPage from "./pages/PublicTournamentPage";
import AdminPage from "./pages/AdminPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import { PrivacyPage, DeleteAccountPage } from "./pages/LegalPages";

function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-lime/20 border-t-lime" />
    </div>
  );
}

// Logged-in shell. `nav` shows the floating tab bar (top-level screens);
// detail screens pass `back` instead and pin their own primary action.
function AppShell({ children, title, back, nav = false, wide = false }) {
  return (
    <div className="min-h-screen">
      <Header title={title} back={back} wide={wide} />
      {children}
      {nav && <BottomNav />}
    </div>
  );
}

function ProtectedLayout({ children, adminOnly, ...shell }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (adminOnly && !user.isAdmin) return <Navigate to="/" replace />;
  return <AppShell {...shell}>{children}</AppShell>;
}

// "/" is the public marketing page for anyone not logged in, and the
// dashboard for anyone who is -- so a signed-in bookmark still works,
// but a fresh visitor sees the pitch instead of a bare login form.
function HomeRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <LandingPage />;
  return (
    <AppShell nav>
      <GroupsPage />
    </AppShell>
  );
}

// Sends a page_view on every route change (the SPA never reloads) and tells GA
// who is signed in (internal id only) once the session is known.
function AnalyticsTracker() {
  const location = useLocation();
  const { user, loading } = useAuth();

  useEffect(() => {
    trackPage(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    if (!loading) identify(user);
  }, [user, loading]);

  return null;
}

const toGroup = (p) => `/groups/${p.groupId}`;

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/delete-account" element={<DeleteAccountPage />} />
      <Route path="/" element={<HomeRoute />} />
      <Route
        path="/groups/:groupId"
        element={
          <ProtectedLayout title="Group" back="/">
            <GroupDetailPage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/groups/:groupId/log/:gameId?"
        element={
          <ProtectedLayout title="Log a game" back={toGroup}>
            <LogGamePage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/groups/:groupId/schedule"
        element={
          <ProtectedLayout title="Today's games" back={toGroup}>
            <SchedulePage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/groups/:groupId/members"
        element={
          <ProtectedLayout title="Members" back={toGroup}>
            <GroupMembersPage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedLayout title="Profile" nav>
            <ProfilePage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/tournaments/:tournamentId"
        element={
          <ProtectedLayout title="Tournament" back>
            <TournamentDetailPage />
          </ProtectedLayout>
        }
      />
      {/* Public, no login required -- this is the shareable link */}
      <Route path="/t/:slug" element={<PublicTournamentPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedLayout title="Admin" nav wide adminOnly>
            <AdminPage />
          </ProtectedLayout>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AnalyticsTracker />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
