import type {
  AuthUser,
  GoogleCalendarEvent,
  GoogleCalendarStatus,
  HomeDocument,
  Property,
  TimelineEvent,
  TimelineEventSearchResult,
} from "./types";

function apiFetch(input: string, init: RequestInit = {}) {
  return fetch(input, { ...init, credentials: "include" });
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Auth
export const getMe = () => apiFetch("/api/auth/me").then((r) => handle<AuthUser>(r));

export const register = (
  email: string,
  password: string,
  firstName: string,
  lastName: string
) =>
  apiFetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, firstName, lastName }),
  }).then((r) => handle<AuthUser>(r));

export const login = (email: string, password: string) =>
  apiFetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).then((r) => handle<AuthUser>(r));

export const logout = () =>
  apiFetch("/api/auth/logout", { method: "POST" }).then((r) => handle<void>(r));

export const updateMe = (firstName: string, lastName: string) =>
  apiFetch("/api/auth/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ firstName, lastName }),
  }).then((r) => handle<AuthUser>(r));

// Properties
export const getProperties = () =>
  apiFetch("/api/properties").then((r) => handle<Property[]>(r));

export const getProperty = (id: string) =>
  apiFetch(`/api/properties/${id}`).then((r) => handle<Property>(r));

export const createProperty = (data: {
  name: string;
  address?: string;
  purchaseDate?: string;
  notes?: string;
}) =>
  apiFetch("/api/properties", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((r) => handle<Property>(r));

export const updateProperty = (
  id: string,
  data: Partial<{
    name: string;
    address: string;
    purchaseDate: string;
    notes: string;
  }>
) =>
  apiFetch(`/api/properties/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((r) => handle<Property>(r));

export const deleteProperty = (id: string) =>
  apiFetch(`/api/properties/${id}`, { method: "DELETE" }).then((r) => handle<void>(r));

// Timeline events
export const getEvents = (propertyId: string) =>
  apiFetch(`/api/properties/${propertyId}/events`).then((r) =>
    handle<TimelineEvent[]>(r)
  );

export const searchEvents = (propertyId: string, q: string) =>
  apiFetch(`/api/properties/${propertyId}/events/search?q=${encodeURIComponent(q)}`).then((r) =>
    handle<TimelineEventSearchResult[]>(r)
  );

export const createEvent = (
  propertyId: string,
  data: {
    title: string;
    eventType: string;
    eventDate: string;
    description?: string;
    cost?: string;
    googleEventId?: string;
    googleCalendarId?: string;
    googleHtmlLink?: string;
  },
  files: File[]
) => {
  const form = new FormData();
  form.append("title", data.title);
  form.append("eventType", data.eventType);
  form.append("eventDate", data.eventDate);
  if (data.description) form.append("description", data.description);
  if (data.cost) form.append("cost", data.cost);
  if (data.googleEventId) form.append("googleEventId", data.googleEventId);
  if (data.googleCalendarId) form.append("googleCalendarId", data.googleCalendarId);
  if (data.googleHtmlLink) form.append("googleHtmlLink", data.googleHtmlLink);
  files.forEach((f) => form.append("files", f));
  return apiFetch(`/api/properties/${propertyId}/events`, {
    method: "POST",
    body: form,
  }).then((r) => handle<TimelineEvent>(r));
};

export const updateEvent = (
  propertyId: string,
  eventId: string,
  data: Partial<{
    title: string;
    eventType: string;
    eventDate: string;
    description: string;
    cost: string;
  }>
) =>
  apiFetch(`/api/properties/${propertyId}/events/${eventId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((r) => handle<TimelineEvent>(r));

export const deleteEvent = (propertyId: string, eventId: string) =>
  apiFetch(`/api/properties/${propertyId}/events/${eventId}`, {
    method: "DELETE",
  }).then((r) => handle<void>(r));

export const addEventAttachments = (
  propertyId: string,
  eventId: string,
  files: File[]
) => {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  return apiFetch(`/api/properties/${propertyId}/events/${eventId}/attachments`, {
    method: "POST",
    body: form,
  }).then((r) => handle(r));
};

// Documents
export const getDocuments = (propertyId: string) =>
  apiFetch(`/api/properties/${propertyId}/documents`).then((r) =>
    handle<HomeDocument[]>(r)
  );

export const createDocument = (
  propertyId: string,
  data: {
    title: string;
    category: string;
    documentDate?: string;
    notes?: string;
  },
  files: File[]
) => {
  const form = new FormData();
  form.append("title", data.title);
  form.append("category", data.category);
  if (data.documentDate) form.append("documentDate", data.documentDate);
  if (data.notes) form.append("notes", data.notes);
  files.forEach((f) => form.append("files", f));
  return apiFetch(`/api/properties/${propertyId}/documents`, {
    method: "POST",
    body: form,
  }).then((r) => handle<HomeDocument>(r));
};

export const updateDocument = (
  propertyId: string,
  documentId: string,
  data: Partial<{
    title: string;
    category: string;
    documentDate: string;
    notes: string;
  }>
) =>
  apiFetch(`/api/properties/${propertyId}/documents/${documentId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((r) => handle<HomeDocument>(r));

export const deleteDocument = (propertyId: string, documentId: string) =>
  apiFetch(`/api/properties/${propertyId}/documents/${documentId}`, {
    method: "DELETE",
  }).then((r) => handle<void>(r));

export const addDocumentAttachments = (
  propertyId: string,
  documentId: string,
  files: File[]
) => {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  return apiFetch(`/api/properties/${propertyId}/documents/${documentId}/attachments`, {
    method: "POST",
    body: form,
  }).then((r) => handle(r));
};

// Attachments
export const deleteAttachment = (attachmentId: string) =>
  apiFetch(`/api/attachments/${attachmentId}`, { method: "DELETE" }).then((r) =>
    handle<void>(r)
  );

export const attachmentUrl = (attachmentId: string) =>
  `/api/attachments/${attachmentId}/file`;

// Google Calendar
export const getGoogleStatus = () =>
  apiFetch("/api/google/status").then((r) => handle<GoogleCalendarStatus>(r));

export const connectGoogleUrl = () => "/api/google/connect";

export const disconnectGoogle = () =>
  apiFetch("/api/google/disconnect", { method: "POST" }).then((r) => handle<void>(r));

export const getGoogleEvents = (start: string, end: string) =>
  apiFetch(`/api/google/events?start=${start}&end=${end}`).then((r) =>
    handle<GoogleCalendarEvent[]>(r)
  );
