import { useState } from "react";
import type { Attachment } from "../types";
import Modal from "./Modal";
import AttachmentList from "./AttachmentList";

export default function AttachmentsButton({
  attachments,
  onChange,
  label = "Photos & documents",
}: {
  attachments: Attachment[];
  onChange: () => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  if (attachments.length === 0) return null;

  return (
    <>
      <button className="secondary attachments-trigger" onClick={() => setOpen(true)}>
        📎 {label} ({attachments.length})
      </button>
      {open && (
        <Modal title={label} onClose={() => setOpen(false)}>
          <AttachmentList attachments={attachments} onChange={onChange} />
        </Modal>
      )}
    </>
  );
}
