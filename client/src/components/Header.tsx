import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { connectGoogleUrl, disconnectGoogle, getGoogleStatus } from "../api";
import type { GoogleCalendarStatus } from "../types";

export default function Header() {
  const { user, logout, updateProfile } = useAuth();
  const [editingName, setEditingName] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const [googleStatus, setGoogleStatus] = useState<GoogleCalendarStatus | null>(null);
  const [googleMessage, setGoogleMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getGoogleStatus().then(setGoogleStatus).catch(() => {});
  }, [user]);

  useEffect(() => {
    const result = searchParams.get("google");
    if (!result) return;
    setGoogleMessage(
      result === "connected"
        ? "Google Calendar connected!"
        : "Couldn't connect Google Calendar. Please try again."
    );
    if (result === "connected") getGoogleStatus().then(setGoogleStatus).catch(() => {});
    const next = new URLSearchParams(searchParams);
    next.delete("google");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  async function handleDisconnectGoogle() {
    await disconnectGoogle();
    setGoogleStatus((s) => (s ? { ...s, connected: false, googleEmail: null } : s));
  }

  function startEditName() {
    setFirstName(user?.firstName ?? "");
    setLastName(user?.lastName ?? "");
    setEditingName(true);
  }

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    setSaving(true);
    try {
      await updateProfile(firstName.trim(), lastName.trim());
      setEditingName(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link to="/" className="brand">
          🏠 HomeDiary
        </Link>
        {user && !editingName && (
          <div className="user-info">
            {user.firstName ? (
              <span className="user-name" title={`${user.firstName} ${user.lastName}`}>
                {user.firstName} {user.lastName}
              </span>
            ) : (
              <button className="secondary" onClick={startEditName}>
                Add your name
              </button>
            )}
            {googleStatus?.configured &&
              (googleStatus.connected ? (
                <button
                  className="secondary"
                  onClick={handleDisconnectGoogle}
                  title={googleStatus.googleEmail ?? undefined}
                >
                  📅 Google Calendar connected
                </button>
              ) : (
                <a className="secondary" href={connectGoogleUrl()}>
                  📅 Connect Google Calendar
                </a>
              ))}
            <button className="secondary" onClick={() => logout()}>
              Sign out
            </button>
          </div>
        )}
      </div>
      {googleMessage && (
        <div className="google-status-banner" onClick={() => setGoogleMessage(null)}>
          {googleMessage}
        </div>
      )}
      {user && editingName && (
        <form className="name-edit-form" onSubmit={handleSaveName}>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            autoFocus
          />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
          />
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
          <button type="button" className="secondary" onClick={() => setEditingName(false)}>
            Cancel
          </button>
        </form>
      )}
    </header>
  );
}
