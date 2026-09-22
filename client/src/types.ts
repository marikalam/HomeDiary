export interface AuthUser {
  id: string;
  email: string;
}

export interface Attachment {
  id: string;
  filename: string;
  storedName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  eventId: string | null;
  documentId: string | null;
}

export interface Property {
  id: string;
  name: string;
  address: string | null;
  purchaseDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { events: number; documents: number };
}

export const EVENT_TYPES = [
  "purchase",
  "damage",
  "repair",
  "inspection",
  "maintenance",
  "renovation",
  "other",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface TimelineEvent {
  id: string;
  propertyId: string;
  title: string;
  eventType: string;
  eventDate: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: Attachment[];
}

export const DOCUMENT_CATEGORIES = [
  "purchase",
  "insurance",
  "warranty",
  "tax",
  "mortgage",
  "other",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export interface HomeDocument {
  id: string;
  propertyId: string;
  title: string;
  category: string;
  documentDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: Attachment[];
}
