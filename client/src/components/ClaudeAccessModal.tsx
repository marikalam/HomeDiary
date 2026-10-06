import { useEffect, useState } from "react";
import { createApiToken, deleteApiToken, getApiTokens } from "../api";
import type { ApiToken } from "../types";
import { formatDate } from "../dateUtil";
import Modal from "./Modal";

// Lets the user create a personal API token for Claude (or any other tool)
// to add events on their behalf, and revoke tokens they no longer use.
export default function ClaudeAccessModal({ onClose }: { onClose: () => void }) {
  const [tokens, setTokens] = useState<ApiToken[] | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getApiTokens()
      .then(setTokens)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load tokens"));
  }, []);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const { token, ...created } = await createApiToken("Claude");
      setNewToken(token);
      setCopied(false);
      setTokens((t) => [created, ...(t ?? [])]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create token");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revoke this token? Anything using it will stop working.")) return;
    await deleteApiToken(id);
    setTokens((t) => (t ?? []).filter((x) => x.id !== id));
  }

  async function handleCopy() {
    if (!newToken) return;
    await navigator.clipboard.writeText(newToken);
    setCopied(true);
  }

  return (
    <Modal title="Connect Claude" onClose={onClose}>
      <p>
        Create a token so Claude can add events, with photos, to your diary for you. Store it
        in your Claude environment's settings as <code>HOMEDIARY_API_TOKEN</code>, along with{" "}
        <code>HOMEDIARY_URL</code> = <code>{window.location.origin}</code>.
      </p>
      <p className="muted">
        A token can see and change everything in your account, so keep it private - never
        paste it into a chat. You can revoke it here at any time.
      </p>

      {newToken ? (
        <div className="card">
          <strong>Your new token - copy it now, it won't be shown again:</strong>
          <code style={{ display: "block", wordBreak: "break-all", margin: "0.5rem 0" }}>
            {newToken}
          </code>
          <button onClick={handleCopy}>{copied ? "Copied!" : "Copy token"}</button>
        </div>
      ) : (
        <button onClick={handleCreate} disabled={creating}>
          {creating ? "Creating..." : "Create token"}
        </button>
      )}

      {error && <div className="error">{error}</div>}

      {tokens && tokens.length > 0 && (
        <>
          <h4>Your tokens</h4>
          {tokens.map((t) => (
            <div key={t.id} className="item-header">
              <span>
                {t.name} · created {formatDate(t.createdAt, { month: "short", day: "numeric", year: "numeric" })}
                <span className="muted">
                  {" "}
                  · {t.lastUsedAt ? `last used ${formatDate(t.lastUsedAt, { month: "short", day: "numeric" })}` : "never used"}
                </span>
              </span>
              <button className="secondary" onClick={() => handleRevoke(t.id)}>
                Revoke
              </button>
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}
