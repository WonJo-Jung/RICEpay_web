import localforage from 'localforage';
import type { AddressBookEntry, Network } from '@ricepay/shared';

localforage.config({ name: 'ricepay', storeName: 'address_book' });
const KEY = 'address_book:v1';
const now = () => new Date().toISOString();

async function loadAll(): Promise<AddressBookEntry[]> {
  return (await localforage.getItem<AddressBookEntry[]>(KEY)) ?? [];
}
async function saveAll(list: AddressBookEntry[]) {
  await localforage.setItem(KEY, list);
}

export const AddressBookStore = {
  async list(params?: { query?: string; network?: Network; includeDeleted?: boolean }) {
    let items = await loadAll();
    if (!params?.includeDeleted) items = items.filter(i => !i.deletedAt);
    if (params?.network) items = items.filter(i => i.network === params.network);
    if (params?.query) {
      const q = params.query.toLowerCase();
      items = items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.address.toLowerCase().includes(q) ||
        (i.memo ?? '').toLowerCase().includes(q),
      );
    }
    items.sort((a, b) =>
      (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '') ||
      (b.usageCount - a.usageCount) ||
      a.name.localeCompare(b.name),
    );
    return items;
  },

  async create(input: { name: string; network: Network; address: string; memo: string }) {
    const list = await loadAll();
    const addrLc = input.address.toLowerCase();

    // 1) 활성 중복: 최신 입력값으로 "업데이트" 처리 (이름/메모 갱신)
    const active = list.find(i => !i.deletedAt && i.network === input.network && i.address.toLowerCase() === addrLc);
    if (active) {
      active.name = input.name.length > 0 ? input.name : active.name;

      const hasMemoField = Object.prototype.hasOwnProperty.call(input, 'memo');
      if (hasMemoField) {
        active.memo = input.memo.trim();
      }

      active.updatedAt = now();
      await saveAll(list);
      return active;
    }

    // 2) 소프트 삭제 항목이 있으면 "복구"
    const deleted = list.find(i => i.deletedAt && i.network === input.network && i.address.toLowerCase() === addrLc);
    if (deleted) {
      deleted.deletedAt = undefined;
      deleted.name = input.name.length > 0 ? input.name : deleted.name;

      const hasMemoField = Object.prototype.hasOwnProperty.call(input, 'memo');
      if (hasMemoField) {
        deleted.memo = input.memo.trim();
      }

      deleted.updatedAt = now();
      await saveAll(list);
      return deleted;
    }

    // 3) 완전 신규 생성
    const entry: AddressBookEntry = {
      id: crypto.randomUUID?.() ?? (await import('uuid')).v4(),
      name: input.name,
      network: input.network,
      address: input.address,
      memo: input.memo.trim(),
      usageCount: 0,
      createdAt: now(),
      updatedAt: now(),
    };
    list.push(entry);
    await saveAll(list);
    return entry;
  },

  async update(id: string, patch: Partial<Pick<AddressBookEntry, 'name' | 'memo' | 'network' | 'address'>>) {
    const list = await loadAll();
    const idx = list.findIndex(i => i.id === id && !i.deletedAt);
    if (idx < 0) throw new Error('Not found');

    const next: AddressBookEntry = { ...list[idx], ...patch, updatedAt: now() };

    if ((patch.network || patch.address) && list.some(i =>
      !i.deletedAt &&
      i.id !== next.id &&
      i.network === next.network &&
      i.address.toLowerCase() === next.address.toLowerCase(),
    )) throw new Error('Duplicate network/address');

    list[idx] = next;
    await saveAll(list);
    return next;
  },

  async remove(id: string) {
    const list = await loadAll();
    const item = list.find(i => i.id === id && !i.deletedAt);
    if (!item) return { ok: true };
    item.deletedAt = now();
    item.updatedAt = now();
    await saveAll(list);
    return { ok: true };
  },

  async markUsed(id: string) {
    const list = await loadAll();
    const item = list.find(i => i.id === id && !i.deletedAt);
    if (!item) throw new Error('Not found');
    item.usageCount += 1;
    item.lastUsedAt = now();
    item.updatedAt = now();
    await saveAll(list);
    return item;
  },
};