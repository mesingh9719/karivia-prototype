import { useCallback, useEffect, useState } from 'react';
import { ordersService } from '../services/shop/ordersService';
import { subscribeShopChanges } from '../services/shop/events';

export function useShopOrders(params) {
  const key = JSON.stringify(params),
    [revision, setRevision] = useState(0);
  const [state, setState] = useState({
    data: [],
    total: 0,
    totalPages: 1,
    page: 1,
    summary: {},
    loading: true,
    error: '',
  });
  const refresh = useCallback(() => setRevision((r) => r + 1), []);
  useEffect(() => subscribeShopChanges(refresh), [refresh]);
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: '' }));
    ordersService
      .list(JSON.parse(key))
      .then((result) => {
        if (!cancelled) setState({ ...result, loading: false, error: '' });
      })
      .catch((error) => {
        if (!cancelled)
          setState((s) => ({
            ...s,
            data: [],
            loading: false,
            error: error.message,
          }));
      });
    return () => {
      cancelled = true;
    };
  }, [key, revision]);
  return { ...state, refresh };
}

export function useShopOrder(id, params = {}) {
  const key = JSON.stringify(params),
    [revision, setRevision] = useState(0);
  const [state, setState] = useState({ order: null, loading: true, error: '' });
  const refresh = useCallback(() => setRevision((r) => r + 1), []);
  useEffect(() => subscribeShopChanges(refresh), [refresh]);
  useEffect(() => {
    let cancelled = false;
    setState({ order: null, loading: true, error: '' });
    ordersService
      .get(id, JSON.parse(key))
      .then((order) => {
        if (!cancelled) setState({ order, loading: false, error: '' });
      })
      .catch((error) => {
        if (!cancelled)
          setState({ order: null, loading: false, error: error.message });
      });
    return () => {
      cancelled = true;
    };
  }, [id, key, revision]);
  return { ...state, refresh };
}
