import { useEffect, useState } from "react";
import { createEvent, getEvents, getGoogleEvents, getGoogleStatus, searchEvents } from "../api";
import { EVENT_TYPES } from "../types";
import type { GoogleCalendarEvent, TimelineEvent, TimelineEventSearchResult } from "../types";
import TimelineEventItem from "./TimelineEventItem";
import { todayISO } from "../dateUtil";
import Modal from "./Modal";

function toDateInputValue(iso: string) {
  return iso.slice(0, 10);
}

export default function TimelineTab({ propertyId }: { propertyId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<string>("other");
  const [eventDate, setEventDate] = useState(todayISO);
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [linkedGoogleEvent, setLinkedGoogleEvent] = useState<GoogleCalendarEvent | null>(null);

  const [googleConnected, setGoogleConnected] = useState(false);
  const [showGooglePicker, setShowGooglePicker] = useState(false);
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TimelineEventSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    load();
    getGoogleStatus()
      .then((s) => setGoogleConnected(s.connected))
      .catch(() => {});
  }, [propertyId]);

  // Debounced semantic search - "fridge technician" will also find an
  // event titled "Refrigerator repair", since matching is by meaning
  // rather than exact words.
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      searchEvents(propertyId, q)
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, propertyId]);

  function load() {
    setLoading(true);
    getEvents(propertyId)
      .then(setEvents)
      .finally(() => setLoading(false));
  }

  function openGooglePicker() {
    setShowGooglePicker(true);
    setGoogleLoading(true);
    setGoogleError(null);
    // A week back through two weeks ahead covers "today's" events plus
    // anything recent enough to still be worth linking after the fact.
    const start = new Date();
    start.setDate(start.getDate() - 7);
    const end = new Date();
    end.setDate(end.getDate() + 14);
    getGoogleEvents(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10))
      .then(setGoogleEvents)
      .catch((err) => setGoogleError(err instanceof Error ? err.message : "Failed to load Google Calendar events"))
      .finally(() => setGoogleLoading(false));
  }

  function chooseGoogleEvent(ge: GoogleCalendarEvent) {
    setTitle(ge.title);
    setEventDate(toDateInputValue(ge.start));
    setDescription(ge.description ?? "");
    setLinkedGoogleEvent(ge);
    setShowGooglePicker(false);
    setShowForm(true);
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
        {
          title: title.trim(),
          eventType,
          eventDate,
          description: description.trim(),
          cost: cost.trim(),
          googleEventId: linkedGoogleEvent?.id,
          googleCalendarId: linkedGoogleEvent ? "primary" : undefined,
          googleHtmlLink: linkedGoogleEvent?.htmlLink,
        },
        files
      );
      setTitle("");
      setEventType("other");
      setEventDate(todayISO());
      setDescription("");
      setCost("");
      setFiles([]);
      setLinkedGoogleEvent(null);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add event");
    } finally {
      setSubmitting(false);
    }
  }

  const sorted = [...events].sort(
    (a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()
  );

  return (
    <div>
      <div className="item-header">
        <h2>Timeline</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {googleConnected && (
            <button className="secondary" onClick={openGooglePicker}>
              📅 Import from Google Calendar
            </button>
          )}
          <button
            onClick={() => {
              if (showForm) setLinkedGoogleEvent(null);
              setShowForm((s) => !s);
            }}
          >
            {showForm ? "Cancel" : "+ Add Event"}
          </button>
        </div>
      </div>

      <div className="search-bar">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search events by what happened, e.g. 'fridge repair'"
          aria-label="Search timeline events"
        />
        {searching && <span className="muted search-status">Searching...</span>}
      </div>

      {showGooglePicker && (
        <Modal title="Import from Google Calendar" onClose={() => setShowGooglePicker(false)}>
          {googleLoading ? (
            <p className="muted">Loading your calendar...</p>
          ) : googleError ? (
            <div className="error">{googleError}</div>
          ) : googleEvents.length === 0 ? (
            <p className="muted">No events found in the next two weeks (or past week).</p>
          ) : (
            <div className="google-event-list">
              {googleEvents.map((ge) => (
                <button
                  key={ge.id}
                  type="button"
                  className="google-event-option"
                  onClick={() => chooseGoogleEvent(ge)}
                >
                  <span className="event-time">
                    {ge.allDay
                      ? new Date(ge.start).toLocaleDateString()
                      : new Date(ge.start).toLocaleString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                  </span>
                  {ge.title}
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}

      {showForm && (
        <form className="card" onSubmit={handleSubmit}>
          {linkedGoogleEvent && (
            <div className="google-status-banner" style={{ margin: "0 0 0.75rem" }}>
              📅 Linked to "{linkedGoogleEvent.title}" from Google Calendar
            </div>
          )}
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
          <label htmlFor="ev-cost">Cost</label>
          <input
            id="ev-cost"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="Optional, e.g. 450.00"
          />
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

      {searchResults !== null ? (
        searchResults.length === 0 ? (
          <div className="empty-state">
            <p>No events match "{searchQuery.trim()}".</p>
          </div>
        ) : (
          <div className="timeline">
            {searchResults.map((ev) => (
              <TimelineEventItem
                key={ev.id}
                event={ev}
                propertyId={propertyId}
                onChange={load}
              />
            ))}
          </div>
        )
      ) : loading ? (
        <p className="muted">Loading...</p>
      ) : sorted.length === 0 ? (
        <div className="empty-state">
          <p>No timeline events yet. Log the first thing that happened.</p>
        </div>
      ) : (
        <div className="timeline">
          {sorted.map((ev) => (
            <TimelineEventItem
              key={ev.id}
              event={ev}
              propertyId={propertyId}
              onChange={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}
