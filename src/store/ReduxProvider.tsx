'use client';

import { Provider } from 'react-redux';
import { store } from './store';
import { useEffect } from 'react';
import { useAppDispatch } from './hooks';
import { checkSession } from './slices/authSlice';

function SessionManager() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Check session on mount
    dispatch(checkSession());

    // Check periodically every minute
    const interval = setInterval(() => {
      dispatch(checkSession());
    }, 60000);

    return () => clearInterval(interval);
  }, [dispatch]);

  return null;
}

export function ReduxProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <SessionManager />
      {children}
    </Provider>
  );
}
