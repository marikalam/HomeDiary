import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function AuthPage() {
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, firstName, lastName);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 380, margin: "3rem auto" }}>
      <h1 style={{ textAlign: "center" }}>🏠 HomeDiary</h1>
      <form className="card" onSubmit={handleSubmit}>
        <h2 style={{ marginTop: 0 }}>{mode === "login" ? "Sign in" : "Create an account"}</h2>
        {mode === "register" && (
          <div className="form-row">
            <div>
              <label htmlFor="firstName">First name</label>
              <input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="lastName">Last name</label>
              <input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>
        )}
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          required
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        {mode === "register" && (
          <p className="muted" style={{ marginTop: "0.5rem" }}>
            At least 8 characters.
          </p>
        )}
        {error && <div className="error">{error}</div>}
        <div className="form-actions">
          <button type="submit" disabled={submitting}>
            {submitting
              ? "Please wait..."
              : mode === "login"
              ? "Sign in"
              : "Create account"}
          </button>
        </div>
      </form>
      <p style={{ textAlign: "center" }}>
        {mode === "login" ? (
          <>
            Don't have an account?{" "}
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setError(null);
                setMode("register");
              }}
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setError(null);
                setMode("login");
              }}
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  );
}
