// Date-only values are stored as UTC midnight; format in UTC so the
// displayed date always matches what was entered, regardless of the
// viewer's local timezone.
export function formatDate(
  isoString: string,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" }
) {
  return new Date(isoString).toLocaleDateString(undefined, {
    ...options,
    timeZone: "UTC",
  });
}

// Today's date as YYYY-MM-DD in the user's local timezone, for
// defaulting <input type="date"> fields.
export function todayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
