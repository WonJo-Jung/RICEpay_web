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

export function formatFullDateTime(iso: string, opts?: Intl.DateTimeFormatOptions) {
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  const date = new Date(iso);

  // Intl로 날짜/시간(초 단위까지) 포맷
  const df = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit', // ✅ 초 추가
    hour12: true, // 오전/오후
    ...opts,
  });

  // 밀리초 추출
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${df.format(date)}.${ms}`;
}