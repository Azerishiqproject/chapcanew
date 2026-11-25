'use client';

import { Provider } from 'react-redux';
import { store } from './store';
import { useEffect } from 'react';
import { useAppDispatch } from './hooks';
import { checkSession, clearSession } from './slices/authSlice';

function SessionManager() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    localStorage.removeItem('auth_session');
    dispatch(checkSession());

    // Check periodically every minute
    const interval = setInterval(() => {
      dispatch(checkSession());
    }, 60000);

    const expire = () => dispatch(clearSession());
    window.addEventListener('chapca-session-expired', expire);
    return () => {
      clearInterval(interval);
      window.removeEventListener('chapca-session-expired', expire);
    };
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
