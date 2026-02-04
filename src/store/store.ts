import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import usersReducer from './slices/usersSlice';
import themeReducer from './slices/themeSlice';
import captchaReducer from './slices/captchaSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    users: usersReducer,
    theme: themeReducer,
    captcha: captchaReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Firestore lastDoc is a non-serializable QueryDocumentSnapshot
        ignoredActions: ['users/fetchAll/fulfilled', 'users/fetchAll/pending', 'users/fetchAll/rejected'],
        ignoredActionPaths: ['payload.lastDoc', 'meta.arg.lastDoc'],
        ignoredPaths: ['users.lastDoc'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

