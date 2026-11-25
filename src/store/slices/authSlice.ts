import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getSession, signIn, signOut, type SessionUser } from '@/lib/auth';
import { errorMessage } from '@/lib/api-client';

interface AuthState {
  user: { uid: string; email: string } | null;
  userData: { status: 'admin' | 'user'; name: string } | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
}
const empty: Omit<AuthState, 'isLoading'> = { user: null, userData: null, isAuthenticated: false, isAdmin: false, error: null };
const initialState: AuthState = { ...empty, isLoading: true };
export const loginUser = createAsyncThunk('auth/login', async (input: { email: string; password: string }, { rejectWithValue }) => {
  try { return await signIn(input.email, input.password); }
  catch (error) { return rejectWithValue(errorMessage(error)); }
});
export const checkSession = createAsyncThunk('auth/checkSession', async () => {
  try { return await getSession(); } catch { return null; }
});
export const logoutUser = createAsyncThunk('auth/logout', async (_, { rejectWithValue }) => {
  try { await signOut(); } catch (error) { return rejectWithValue(errorMessage(error)); }
});
function applyUser(state: AuthState, user: SessionUser | null) {
  state.isLoading = false;
  state.user = user ? { uid: user.uid, email: user.email } : null;
  state.userData = user ? { name: user.name, status: user.status } : null;
  state.isAuthenticated = !!user;
  state.isAdmin = user?.status === 'admin';
}
const slice = createSlice({
  name: 'auth', initialState,
  reducers: {
    clearError(state) { state.error = null; },
    clearSession(state) { Object.assign(state, empty, { isLoading: false }); },
  },
  extraReducers(builder) {
    builder
      .addCase(loginUser.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(loginUser.fulfilled, (state, action) => { applyUser(state, action.payload); })
      .addCase(loginUser.rejected, (state, action) => { applyUser(state, null); state.error = action.payload as string; })
      .addCase(checkSession.fulfilled, (state, action) => { applyUser(state, action.payload); })
      .addCase(logoutUser.pending, (state) => { state.isLoading = true; })
      .addCase(logoutUser.fulfilled, (state) => { applyUser(state, null); state.error = null; })
      .addCase(logoutUser.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });
  },
});
export const { clearError, clearSession } = slice.actions;
export default slice.reducer;
