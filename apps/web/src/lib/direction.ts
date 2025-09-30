export type Direction = 'SENT' | 'RECEIVED';

// 내 주소 컨텍스트가 없으면 SENT 기본(공유 링크 등)
export function computeDirection(
  viewerAddresses: string[] | null | undefined,
  fromAddress: string,
  toAddress: string
): Direction {
  const toL = (s: string) => s?.toLowerCase?.() ?? '';
  if (!viewerAddresses || viewerAddresses.length === 0) return 'SENT';
  const set = new Set(viewerAddresses.map(toL));
  const from = toL(fromAddress);
  const to = toL(toAddress);
  if (set.has(to) && !set.has(from)) return 'RECEIVED';
  return 'SENT';
}