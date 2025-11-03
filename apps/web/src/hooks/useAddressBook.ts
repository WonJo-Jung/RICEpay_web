'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AddressBookEntry, Chain } from '@ricepay/shared';
import { AddressBookStore } from '../lib/local-address-book';

export function useAddressBook(params?: { query?: string; chain?: Chain; includeDeleted?: boolean }) {
  const [items, setItems] = useState<AddressBookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await AddressBookStore.list(params);
      setItems(data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [params?.query, params?.chain, params?.includeDeleted]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const api = useMemo(() => ({
    reload,
    create: async (input: { name: string; chain: Chain; address: string; memo: string }) => {
      const res = await AddressBookStore.create(input);
      await reload();
      return res;
    },
    update: async (id: string, patch: Partial<Pick<AddressBookEntry, 'name'|'memo'|'chain'|'address'>>) => {
      const res = await AddressBookStore.update(id, patch);
      await reload();
      return res;
    },
    remove: async (id: string) => {
      const res = await AddressBookStore.remove(id);
      await reload();
      return res;
    },
    markUsed: async (id: string) => {
      const res = await AddressBookStore.markUsed(id);
      await reload();
      return res;
    },
  }), [reload]);

  return { items, loading, error, ...api };
}