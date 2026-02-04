import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { signIn } from '@/lib/auth';
import { getUserByEmail } from '@/lib/users';
import { checkUserStatus } from '@/lib/admin';
import type { UserStatus } from '@/lib/users';

interface UserInfo {
  uid: string;
  email: string;
}

interface AuthState {
  user: UserInfo | null;
  userData: { status: UserStatus; name: string } | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  loginTime: number | null; // Timestamp of last login
}

const SESSION_TIMEOUT = 3600000; // 1 hour in ms

const getStoredAuth = () => {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('auth_session');
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    const now = Date.now();
    if (now - parsed.loginTime > SESSION_TIMEOUT) {
      localStorage.removeItem('auth_session');
      return null;
    }
    return parsed;
  } catch (e) {
    return null;
  }
};

const storedAuth = getStoredAuth();

const initialState: AuthState = storedAuth ? {
  ...storedAuth,
  isLoading: false,
  error: null,
} : {
  user: null,
  userData: null,
  isAuthenticated: false,
  isAdmin: false,
  isLoading: false,
  error: null,
  loginTime: null,
};

// Async thunks
export const loginUser = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      // Firebase Authentication ile giriş yap
      const { user, error } = await signIn(email, password);
      if (error) {
        return rejectWithValue(error);
      }

      if (!user || !user.email || !user.uid) {
        return rejectWithValue('Kullanıcı bilgisi alınamadı');
      }

      // Firestore'dan kullanıcı bilgilerini çek
      const { user: userData, error: userError } = await getUserByEmail(user.email);
      if (userError || !userData) {
        return rejectWithValue('Kullanıcı bilgileri bulunamadı');
      }

      return {
        userInfo: {
          uid: user.uid,
          email: user.email,
        },
        userData,
      };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      return null;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// Auth state değiştiğinde user bilgilerini Firestore'dan çek
export const loadUserData = createAsyncThunk(
  'auth/loadUserData',
  async (email: string, { rejectWithValue }) => {
    try {
      const { user: userData, error: userError } = await getUserByEmail(email);
      if (userError || !userData) {
        return rejectWithValue('Kullanıcı bilgileri bulunamadı');
      }
      return userData;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// Firestore'dan user status'unu güncelle
export const refreshUserStatus = createAsyncThunk(
  'auth/refreshStatus',
  async (email: string, { rejectWithValue }) => {
    try {
      const status = await checkUserStatus(email);
      if (!status) {
        return rejectWithValue('Kullanıcı status bilgisi bulunamadı');
      }
      return status;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<{ uid: string; email: string } | null>) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
      if (!action.payload) {
        state.userData = null;
        state.isAdmin = false;
      }
    },
    clearError: (state) => {
      state.error = null;
    },
    checkSession: (state) => {
      if (state.loginTime && Date.now() - state.loginTime > SESSION_TIMEOUT) {
        state.user = null;
        state.userData = null;
        state.isAuthenticated = false;
        state.isAdmin = false;
        state.loginTime = null;
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_session');
        }
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.userInfo;
        state.userData = {
          status: action.payload.userData.status,
          name: action.payload.userData.name,
        };
        state.isAuthenticated = true;
        state.isAdmin = action.payload.userData.status === 'admin';
        state.loginTime = Date.now();

        // Save to localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_session', JSON.stringify({
            user: state.user,
            userData: state.userData,
            isAuthenticated: true,
            isAdmin: state.isAdmin,
            loginTime: state.loginTime
          }));
        }
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
        state.user = null;
        state.userData = null;
        state.isAdmin = false;
      })
      // Logout
      .addCase(logoutUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.isLoading = false;
        state.user = null;
        state.userData = null;
        state.isAuthenticated = false;
        state.isAdmin = false;
        state.error = null;
        state.loginTime = null;

        // Clear localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_session');
        }
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Load user data
      .addCase(loadUserData.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(loadUserData.fulfilled, (state, action) => {
        state.isLoading = false;
        state.userData = {
          status: action.payload.status,
          name: action.payload.name,
        };
        state.isAdmin = action.payload.status === 'admin';
      })
      .addCase(loadUserData.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Refresh status
      .addCase(refreshUserStatus.fulfilled, (state, action) => {
        if (state.userData) {
          state.userData.status = action.payload;
          state.isAdmin = action.payload === 'admin';
        }
      });
  },
});

export const { setUser, clearError, checkSession } = authSlice.actions;
export default authSlice.reducer;
