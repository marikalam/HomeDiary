import { attachmentUrl, deleteAttachment } from "../api";
import type { Attachment } from "../types";

function isImage(mimeType: string) {
  return mimeType.startsWith("image/");
}

function isVideo(mimeType: string) {
  return mimeType.startsWith("video/");
}

export default function AttachmentList({
  attachments,
  onChange,
}: {
  attachments: Attachment[];
  onChange: () => void;
}) {
  if (attachments.length === 0) {
    return <p className="muted">No files attached yet.</p>;
  }

  async function handleRemove(id: string) {
    if (!confirm("Remove this file?")) return;
    await deleteAttachment(id);
    onChange();
  }

  return (
    <div className="attachment-gallery">
      {attachments.map((a) => (
        <div key={a.id} className="attachment-gallery-item">
          <a href={attachmentUrl(a.id)} target="_blank" rel="noreferrer">
            {isImage(a.mimeType) ? (
              <img src={attachmentUrl(a.id)} alt={a.filename} />
            ) : isVideo(a.mimeType) ? (
              <video src={attachmentUrl(a.id)} controls />
            ) : (
              <div className="attachment-file-icon">📄</div>
            )}
          </a>
          <div className="attachment-gallery-caption">
            <a href={attachmentUrl(a.id)} target="_blank" rel="noreferrer" title={a.filename}>
              {a.filename}
            </a>
            <button className="danger" onClick={() => handleRemove(a.id)}>
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
