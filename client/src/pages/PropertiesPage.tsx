import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createProperty, getProperties } from "../api";
import type { Property } from "../types";

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    getProperties()
      .then(setProperties)
      .finally(() => setLoading(false));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Property name is required");
      return;
    }
    setSubmitting(true);
    try {
      await createProperty({
        name: name.trim(),
        address: address.trim() || undefined,
        purchaseDate: purchaseDate || undefined,
      });
      setName("");
      setAddress("");
      setPurchaseDate("");
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create property");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="item-header">
        <h1>Your Properties</h1>
        <button onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ Add Property"}
        </button>
      </div>

      {showForm && (
        <form className="card" onSubmit={handleSubmit}>
          <label htmlFor="name">Property name</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. 42 Maple Street"
            autoFocus
          />
          <label htmlFor="address">Address</label>
          <input
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Optional"
          />
          <label htmlFor="purchaseDate">Purchase date</label>
          <input
            id="purchaseDate"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
          />
          {error && <div className="error">{error}</div>}
          <div className="form-actions">
            <button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save property"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="muted">Loading...</p>
      ) : properties.length === 0 ? (
        <div className="empty-state">
          <p>No properties yet. Add your first one to start your diary.</p>
        </div>
      ) : (
        <div className="property-list">
          {properties.map((p) => (
            <Link key={p.id} to={`/properties/${p.id}`} className="property-card card">
              <h3>{p.name}</h3>
              {p.address && <p className="muted">{p.address}</p>}
              <p className="muted">
                {p._count?.events ?? 0} timeline events &middot;{" "}
                {p._count?.documents ?? 0} documents
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
