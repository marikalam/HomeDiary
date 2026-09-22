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
