import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Header() {
  const { user, logout, updateProfile } = useAuth();
  const [editingName, setEditingName] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);

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
            <button className="secondary" onClick={() => logout()}>
              Sign out
            </button>
          </div>
        )}
      </div>
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
