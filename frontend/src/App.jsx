import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Header from "./components/Header";
import GroupsPage from "./pages/GroupsPage";
import GroupDetailPage from "./pages/GroupDetailPage";
import LandingPage from "./pages/LandingPage";
import ProfilePage from "./pages/ProfilePage";
import TournamentDetailPage from "./pages/TournamentDetailPage";
import PublicTournamentPage from "./pages/PublicTournamentPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

function ProtectedLayout({ children, crumb }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate">Loading…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return (
    <div className="min-h-screen">
      <Header crumb={crumb} />
      {children}
    </div>
  );
}

// "/" is the public marketing page for anyone not logged in, and the
// dashboard for anyone who is -- so a signed-in bookmark still works,
// but a fresh visitor sees the pitch instead of a bare login form.
function HomeRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate">Loading…</div>;
  }
  if (!user) return <LandingPage />;
  return (
    <div className="min-h-screen">
      <Header />
      <GroupsPage />
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/" element={<HomeRoute />} />
      <Route
        path="/groups/:groupId"
        element={
          <ProtectedLayout crumb="Group">
            <GroupDetailPage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedLayout crumb="Your stats">
            <ProfilePage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/tournaments/:tournamentId"
        element={
          <ProtectedLayout crumb="Tournament">
            <TournamentDetailPage />
          </ProtectedLayout>
        }
      />
      {/* Public, no login required -- this is the shareable link */}
      <Route path="/t/:slug" element={<PublicTournamentPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
