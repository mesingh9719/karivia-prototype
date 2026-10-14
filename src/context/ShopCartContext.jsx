import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { cartService } from '../services/shop/cartService';
import { subscribeShopChanges } from '../services/shop/events';

const CartContext = createContext(null);
const emptyCart = {
  items: [],
  subtotal: 0,
  itemCount: 0,
  canCheckout: false,
  customerId: '',
};

export function ShopCartProvider({ children }) {
  const { user } = useAuth(),
    toast = useToast(),
    accountId = user?.id || '';
  const [state, setState] = useState({
    ...emptyCart,
    accountId: '',
    loading: true,
    error: '',
  });
  const [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => subscribeShopChanges(refresh), [refresh]);
  useEffect(() => {
    let cancelled = false;
    setState((previous) => ({
      ...(previous.accountId === accountId ? previous : emptyCart),
      accountId,
      loading: true,
      error: '',
    }));
    cartService
      .get({ accountId })
      .then((cart) => {
        if (!cancelled)
          setState({ ...cart, accountId, loading: false, error: '' });
      })
      .catch((error) => {
        if (!cancelled)
          setState({
            ...emptyCart,
            accountId,
            loading: false,
            error: error.message,
          });
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, revision]);

  async function mutate(method, args, success) {
    if (pending.current)
      throw new Error('Please wait for the current cart change to finish.');
    pending.current = true;
    setBusy(true);
    try {
      const cart = await cartService[method](...args, { accountId });
      setState({ ...cart, accountId, loading: false, error: '' });
      if (success) toast(success);
      return cart;
    } catch (error) {
      toast(error.message, 'error');
      throw error;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const visible =
    state.accountId === accountId
      ? state
      : { ...emptyCart, loading: true, error: '' };
  return (
    <CartContext.Provider
      value={{
        ...visible,
        accountId,
        busy,
        refresh,
        addItem: (id, quantity = 1) =>
          mutate('add', [id, quantity], 'Added to your bag.'),
        setQuantity: (id, quantity) => mutate('update', [id, quantity]),
        removeItem: (id) =>
          mutate('remove', [id], 'Product removed from your bag.'),
        clearCart: () => mutate('clear', [], 'Your bag has been cleared.'),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
export const useShopCart = () => useContext(CartContext);
