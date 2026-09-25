import { useEffect, useMemo, useState } from "react";
import { createDocument, deleteDocument, getDocuments } from "../api";
import { DOCUMENT_CATEGORIES } from "../types";
import type { HomeDocument } from "../types";
import AttachmentsButton from "./AttachmentsButton";
import { formatDate, todayISO } from "../dateUtil";

export default function DocumentsTab({ propertyId }: { propertyId: string }) {
  const [documents, setDocuments] = useState<HomeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("other");
  const [documentDate, setDocumentDate] = useState(todayISO);
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load();
  }, [propertyId]);

  function load() {
    setLoading(true);
    getDocuments(propertyId)
      .then(setDocuments)
      .finally(() => setLoading(false));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setSubmitting(true);
    try {
      await createDocument(
        propertyId,
        {
          title: title.trim(),
          category,
          documentDate: documentDate || undefined,
          notes: notes.trim() || undefined,
        },
        files
      );
      setTitle("");
      setCategory("other");
      setDocumentDate(todayISO());
      setNotes("");
      setFiles([]);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add document");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this document and its files?")) return;
    await deleteDocument(propertyId, id);
    load();
  }

  const filtered = useMemo(
    () =>
      categoryFilter === "all"
        ? documents
        : documents.filter((d) => d.category === categoryFilter),
    [documents, categoryFilter]
  );

  return (
    <div>
      <div className="item-header">
        <h2>Documents</h2>
        <button onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ Add Document"}
        </button>
      </div>

      {showForm && (
        <form className="card" onSubmit={handleSubmit}>
          <label htmlFor="doc-title">Title</label>
          <input
            id="doc-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Homeowners insurance policy 2026"
            autoFocus
          />
          <div className="form-row">
            <div>
              <label htmlFor="doc-category">Category</label>
              <select
                id="doc-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="doc-date">Date</label>
              <input
                id="doc-date"
                type="date"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
              />
            </div>
          </div>
          <label htmlFor="doc-notes">Notes</label>
          <textarea
            id="doc-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes about this document..."
          />
          <label htmlFor="doc-files">Files</label>
          <input
            id="doc-files"
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
          {error && <div className="error">{error}</div>}
          <div className="form-actions">
            <button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save document"}
            </button>
          </div>
        </form>
      )}

      {documents.length > 0 && (
        <div className="filter-bar">
          <button
            className={`filter-chip ${categoryFilter === "all" ? "active" : ""}`}
            onClick={() => setCategoryFilter("all")}
          >
            All
          </button>
          {DOCUMENT_CATEGORIES.map((c) => (
            <button
              key={c}
              className={`filter-chip ${categoryFilter === c ? "active" : ""}`}
              onClick={() => setCategoryFilter(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="muted">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>No documents in this category yet.</p>
        </div>
      ) : (
        <div className="property-list">
          {filtered.map((doc) => (
            <div key={doc.id} className="card">
              <div className="item-header">
                <div>
                  <span className="badge">{doc.category}</span>
                  <h3 style={{ margin: "0.25rem 0" }}>{doc.title}</h3>
                  {doc.documentDate && (
                    <div className="timeline-date">{formatDate(doc.documentDate)}</div>
                  )}
                  {doc.notes && <p className="muted">{doc.notes}</p>}
                </div>
                <div className="item-actions">
                  <button className="danger" onClick={() => handleDelete(doc.id)}>
                    Delete
                  </button>
                </div>
              </div>
              <AttachmentsButton attachments={doc.attachments} onChange={load} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
