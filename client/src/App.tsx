import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import PropertiesPage from "./pages/PropertiesPage";
import PropertyPage from "./pages/PropertyPage";
import AuthPage from "./pages/AuthPage";
import Header from "./components/Header";
import { AuthProvider, useAuth } from "./auth/AuthContext";

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
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
