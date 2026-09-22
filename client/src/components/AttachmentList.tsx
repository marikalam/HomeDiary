import { attachmentUrl, deleteAttachment } from "../api";
import type { Attachment } from "../types";

function isImage(mimeType: string) {
  return mimeType.startsWith("image/");
}

export default function AttachmentList({
  attachments,
  onChange,
}: {
  attachments: Attachment[];
  onChange: () => void;
}) {
  if (attachments.length === 0) return null;

  async function handleRemove(id: string) {
    if (!confirm("Remove this file?")) return;
    await deleteAttachment(id);
    onChange();
  }

  return (
    <div className="attachment-list">
      {attachments.map((a) => (
        <a
          key={a.id}
          className="attachment-chip"
          href={attachmentUrl(a.id)}
          target="_blank"
          rel="noreferrer"
        >
          {isImage(a.mimeType) ? "🖼️" : "📄"} {a.filename}
          <span
            className="remove"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleRemove(a.id);
            }}
          >
            ×
          </span>
        </a>
      ))}
    </div>
  );
}
