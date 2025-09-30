// ENS 연동은 나중에 원하면 추가

export function shortAddr(addr?: string, left = 6, right = 4) {
  if (!addr) return '';
  if (addr.length <= left + right) return addr;
  return `${addr.slice(0, left)}…${addr.slice(-right)}`;
}