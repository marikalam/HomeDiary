import { useState } from "react";
import { addEventAttachments, deleteEvent, updateEvent } from "../api";
import { EVENT_TYPES } from "../types";
import type { TimelineEvent } from "../types";
import AttachmentsButton from "./AttachmentsButton";
import { formatDate } from "../dateUtil";

export default function TimelineEventItem({
  event,
  propertyId,
  onChange,
}: {
  event: TimelineEvent;
  propertyId: string;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [eventType, setEventType] = useState(event.eventType);
  const [eventDate, setEventDate] = useState(event.eventDate.slice(0, 10));
  const [cost, setCost] = useState(event.cost ?? "");
  const [description, setDescription] = useState(event.description ?? "");
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function startEdit() {
    setTitle(event.title);
    setEventType(event.eventType);
    setEventDate(event.eventDate.slice(0, 10));
    setCost(event.cost ?? "");
    setDescription(event.description ?? "");
    setNewFiles([]);
    setError(null);
    setEditing(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !eventDate) {
      setError("Title and date are required");
      return;
    }
    setSubmitting(true);
    try {
      await updateEvent(propertyId, event.id, {
        title: title.trim(),
        eventType,
        eventDate,
        description: description.trim(),
        cost: cost.trim(),
      });
      if (newFiles.length > 0) {
        await addEventAttachments(propertyId, event.id, newFiles);
      }
      setEditing(false);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this timeline event and its attachments?")) return;
    await deleteEvent(propertyId, event.id);
    onChange();
  }

  if (editing) {
    return (
      <div className="timeline-item">
        <form className="card" onSubmit={handleSave}>
          <label htmlFor={`ev-title-${event.id}`}>What happened</label>
          <input
            id={`ev-title-${event.id}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <div className="form-row">
            <div>
              <label htmlFor={`ev-type-${event.id}`}>Type</label>
              <select
                id={`ev-type-${event.id}`}
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
              <label htmlFor={`ev-date-${event.id}`}>Date</label>
              <input
                id={`ev-date-${event.id}`}
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
          </div>
          <label htmlFor={`ev-cost-${event.id}`}>Cost</label>
          <input
            id={`ev-cost-${event.id}`}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="Optional, e.g. 450.00"
          />
          <label htmlFor={`ev-desc-${event.id}`}>Notes</label>
          <textarea
            id={`ev-desc-${event.id}`}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <label htmlFor={`ev-files-${event.id}`}>Add more photos / documents</label>
          <input
            id={`ev-files-${event.id}`}
            type="file"
            multiple
            onChange={(e) => setNewFiles(Array.from(e.target.files || []))}
          />
          <AttachmentsButton
            attachments={event.attachments}
            onChange={onChange}
            label="Existing files"
          />
          {error && <div className="error">{error}</div>}
          <div className="form-actions">
            <button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save changes"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setEditing(false)}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="timeline-item">
      <div className="item-header">
        <div>
          <div className="timeline-date">
            {formatDate(event.eventDate)} <span className="badge">{event.eventType}</span>
          </div>
          <h3 style={{ margin: "0.25rem 0" }}>{event.title}</h3>
          {event.cost && (
            <p className="muted" style={{ fontWeight: 600 }}>
              {Number(event.cost).toLocaleString(undefined, {
                style: "currency",
                currency: "USD",
              })}
            </p>
          )}
          {event.description && <p className="muted">{event.description}</p>}
        </div>
        <div className="item-actions">
          <button className="secondary" onClick={startEdit}>
            Edit
          </button>
          <button className="danger" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>
      <AttachmentsButton attachments={event.attachments} onChange={onChange} />
    </div>
  );
}
