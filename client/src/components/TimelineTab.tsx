import { useEffect, useState } from "react";
import { createEvent, deleteEvent, getEvents } from "../api";
import { EVENT_TYPES } from "../types";
import type { TimelineEvent } from "../types";
import AttachmentList from "./AttachmentList";
import { formatDate } from "../dateUtil";

export default function TimelineTab({ propertyId }: { propertyId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<string>("other");
  const [eventDate, setEventDate] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load();
  }, [propertyId]);

  function load() {
    setLoading(true);
    getEvents(propertyId)
      .then(setEvents)
      .finally(() => setLoading(false));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !eventDate) {
      setError("Title and date are required");
      return;
    }
    setSubmitting(true);
    try {
      await createEvent(
        propertyId,
        { title: title.trim(), eventType, eventDate, description: description.trim() },
        files
      );
      setTitle("");
      setEventType("other");
      setEventDate("");
      setDescription("");
      setFiles([]);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add event");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this timeline event and its attachments?")) return;
    await deleteEvent(propertyId, id);
    load();
  }

  const sorted = [...events].sort(
    (a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()
  );

  return (
    <div>
      <div className="item-header">
        <h2>Timeline</h2>
        <button onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ Add Event"}
        </button>
      </div>

      {showForm && (
        <form className="card" onSubmit={handleSubmit}>
          <label htmlFor="ev-title">What happened</label>
          <input
            id="ev-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Crack appeared in basement wall"
            autoFocus
          />
          <div className="form-row">
            <div>
              <label htmlFor="ev-type">Type</label>
              <select
                id="ev-type"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ev-date">Date</label>
              <input
                id="ev-date"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
          </div>
          <label htmlFor="ev-desc">Notes</label>
          <textarea
            id="ev-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Details about what happened..."
          />
          <label htmlFor="ev-files">Photos / documents</label>
          <input
            id="ev-files"
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
          {error && <div className="error">{error}</div>}
          <div className="form-actions">
            <button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save event"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="muted">Loading...</p>
      ) : sorted.length === 0 ? (
        <div className="empty-state">
          <p>No timeline events yet. Log the first thing that happened.</p>
        </div>
      ) : (
        <div className="timeline">
          {sorted.map((ev) => (
            <div key={ev.id} className="timeline-item">
              <div className="item-header">
                <div>
                  <div className="timeline-date">
                    {formatDate(ev.eventDate)} <span className="badge">{ev.eventType}</span>
                  </div>
                  <h3 style={{ margin: "0.25rem 0" }}>{ev.title}</h3>
                  {ev.description && <p className="muted">{ev.description}</p>}
                </div>
                <div className="item-actions">
                  <button className="danger" onClick={() => handleDelete(ev.id)}>
                    Delete
                  </button>
                </div>
              </div>
              <AttachmentList attachments={ev.attachments} onChange={load} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
