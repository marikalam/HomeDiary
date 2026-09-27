import { useEffect, useRef, useState } from "react";
import { propertyExportUrl } from "../api";

export default function ExportMenu({ propertyId }: { propertyId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const options = [
    {
      href: propertyExportUrl(propertyId, "xlsx"),
      label: "Excel workbook (.xlsx)",
      hint: "Summary, timeline and documents",
    },
    {
      href: propertyExportUrl(propertyId, "csv", "timeline"),
      label: "Timeline (.csv)",
      hint: "Events with dates and costs",
    },
    {
      href: propertyExportUrl(propertyId, "csv", "documents"),
      label: "Documents (.csv)",
      hint: "Paperwork list",
    },
  ];

  return (
    <div className="export-menu" ref={ref}>
      <button
        className="secondary"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Export ▾
      </button>
      {open && (
        <div className="export-menu-list" role="menu">
          {options.map((o) => (
            <a
              key={o.href}
              href={o.href}
              download
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              {o.label}
              <small>{o.hint}</small>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
