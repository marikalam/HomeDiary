import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteProperty, getProperty, updateProperty } from "../api";
import type { Property } from "../types";
import TimelineTab from "../components/TimelineTab";
import DocumentsTab from "../components/DocumentsTab";
import { formatDate } from "../dateUtil";

export default function PropertyPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  const [property, setProperty] = useState<Property | null>(null);
  const [tab, setTab] = useState<"timeline" | "documents">("timeline");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!propertyId) return;
    getProperty(propertyId).then((p) => {
      setProperty(p);
      setName(p.name);
      setAddress(p.address || "");
      setPurchaseDate(p.purchaseDate ? p.purchaseDate.slice(0, 10) : "");
      setNotes(p.notes || "");
    });
  }, [propertyId]);

  if (!propertyId) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const updated = await updateProperty(propertyId!, {
      name,
      address,
      purchaseDate: purchaseDate || undefined,
      notes,
    });
    setProperty(updated);
    setEditing(false);
  }

  async function handleDelete() {
    if (!confirm(`Delete "${property?.name}" and everything in it? This cannot be undone.`))
      return;
    await deleteProperty(propertyId!);
    navigate("/");
  }

  if (!property) return <p className="muted">Loading...</p>;

  return (
    <div>
      <Link to="/" className="back-link">
        &larr; All properties
      </Link>

      {editing ? (
        <form className="card" onSubmit={handleSave}>
          <label htmlFor="p-name">Name</label>
          <input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
          <label htmlFor="p-address">Address</label>
          <input
            id="p-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <label htmlFor="p-date">Purchase date</label>
          <input
            id="p-date"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
          />
          <label htmlFor="p-notes">Notes</label>
          <textarea
            id="p-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="form-actions">
            <button type="submit">Save</button>
            <button
              type="button"
              className="secondary"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="item-header">
          <div>
            <h1 style={{ marginBottom: 0 }}>{property.name}</h1>
            {property.address && <p className="muted">{property.address}</p>}
            {property.purchaseDate && (
              <p className="muted">Purchased {formatDate(property.purchaseDate)}</p>
            )}
            {property.notes && <p className="muted">{property.notes}</p>}
          </div>
          <div className="item-actions">
            <button className="secondary" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button className="danger" onClick={handleDelete}>
              Delete
            </button>
          </div>
        </div>
      )}

      <div className="tabs">
        <button
          className={`tab ${tab === "timeline" ? "active" : ""}`}
          onClick={() => setTab("timeline")}
        >
          Timeline
        </button>
        <button
          className={`tab ${tab === "documents" ? "active" : ""}`}
          onClick={() => setTab("documents")}
        >
          Documents
        </button>
      </div>

      {tab === "timeline" ? (
        <TimelineTab propertyId={propertyId} />
      ) : (
        <DocumentsTab propertyId={propertyId} />
      )}
    </div>
  );
}
