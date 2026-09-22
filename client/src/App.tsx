import type { ReactNode } from "react";
import { Navigate, Route, Routes, Link } from "react-router-dom";
import PropertiesPage from "./pages/PropertiesPage";
import PropertyPage from "./pages/PropertyPage";
import AuthPage from "./pages/AuthPage";
import { AuthProvider, useAuth } from "./auth/AuthContext";

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Header() {
  const { user, logout } = useAuth();
  return (
    <header className="app-header">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        <Link to="/" className="brand">
          🏠 HomeDiary
        </Link>
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span className="muted">{user.email}</span>
            <button className="secondary" onClick={() => logout()}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <div className="app">
        <Header />
        <main className="app-main">
          <Routes>
            <Route path="/login" element={<AuthPage />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <PropertiesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/properties/:propertyId"
              element={
                <RequireAuth>
                  <PropertyPage />
                </RequireAuth>
              }
            />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  );
}
