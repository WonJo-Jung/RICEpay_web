export function formatDateTime(iso: string, opts?: Intl.DateTimeFormatOptions) {
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  const df = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...opts,
  });
  return df.format(new Date(iso));
}

export function formatRelative(iso: string) {
  const rtf = new Intl.RelativeTimeFormat(
    typeof navigator !== 'undefined' ? navigator.language : 'en-US',
    { numeric: 'auto' }
  );
  const diffMs = new Date(iso).getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  const diffHr = Math.round(diffMin / 60);
  return rtf.format(diffHr, 'hour');
}