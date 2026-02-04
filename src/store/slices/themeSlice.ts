import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  isInitialized: boolean;
}

const initialState: ThemeState = {
  theme: 'light',
  isInitialized: false,
};

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    initializeTheme: (state) => {
      if (typeof window !== 'undefined' && !state.isInitialized) {
        const savedTheme = localStorage.getItem('theme') as Theme;
        if (savedTheme === 'light' || savedTheme === 'dark') {
          state.theme = savedTheme;
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          state.theme = 'dark';
        }
        state.isInitialized = true;
      }
    },
    setTheme: (state, action: PayloadAction<Theme>) => {
      state.theme = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', action.payload);
      }
    },
    toggleTheme: (state) => {
      const newTheme = state.theme === 'light' ? 'dark' : 'light';
      state.theme = newTheme;
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', newTheme);
      }
    },
  },
});

export const { initializeTheme, setTheme, toggleTheme } = themeSlice.actions;
export default themeSlice.reducer;
