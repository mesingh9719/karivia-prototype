import { useCallback, useEffect, useState } from 'react';
import { subscribeShopChanges } from '../services/shop/events';
import { productsService } from '../services/shop/productsService';
import { shopCategoriesService } from '../services/shop/shopCategoriesService';

export function useShop(kind, params) {
  const key = JSON.stringify(params);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({
    data: [],
    categories: [],
    total: 0,
    page: 1,
    totalPages: 1,
    loading: true,
    error: '',
  });
  const refresh = useCallback(() => setRevision((r) => r + 1), []);
  useEffect(() => subscribeShopChanges(refresh), [refresh]);
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: '' }));
    const service =
      kind === 'products' ? productsService : shopCategoriesService;
    Promise.all([
      service.list(JSON.parse(key)),
      shopCategoriesService.list({ pageSize: 1000, sort: 'name_asc' }),
    ])
      .then(([result, categories]) => {
        if (!cancelled)
          setState({
            ...result,
            categories: categories.data,
            loading: false,
            error: '',
          });
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
  }, [kind, key, revision]);
  return { ...state, refresh };
}

export function useShopProduct(id, { publicOnly = false } = {}) {
  const [state, setState] = useState({
    loading: true,
    error: '',
    product: null,
  });
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((r) => r + 1), []);
  useEffect(() => subscribeShopChanges(refresh), [refresh]);
  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, error: '', product: null });
    productsService
      .get(id, { publicOnly })
      .then((product) => {
        if (!cancelled) setState({ loading: false, error: '', product });
      })
      .catch((error) => {
        if (!cancelled)
          setState({ loading: false, error: error.message, product: null });
      });
    return () => {
      cancelled = true;
    };
  }, [id, publicOnly, revision]);
  return { ...state, refresh };
}
