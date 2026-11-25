import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  type User,
  type UserUpdate,
} from '@/lib/users';
import { errorMessage, type PageCursor } from '@/lib/api-client';

interface UsersState {
  users: User[];
  lastDoc: PageCursor | null;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: UsersState = {
  users: [],
  lastDoc: null,
  hasMore: true,
  isLoading: false,
  error: null,
};

// Async thunks
export const fetchUsers = createAsyncThunk(
  'users/fetchAll',
  async ({ pageSize, lastDoc }: { pageSize: number; lastDoc?: PageCursor | null }, { rejectWithValue }) => {
    try {
      const { users, lastDoc: newLastDoc, error } = await getAllUsers(pageSize, lastDoc);
      if (error) {
        return rejectWithValue(error);
      }
      return { users, lastDoc: newLastDoc, hasMore: users.length === pageSize };
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  }
);

export const createUserAction = createAsyncThunk(
  'users/create',
  async (
    {
      email,
      password,
      name,
      phone,
      status,
    }: {
      email: string;
      password: string;
      name: string;
      phone?: string;
      status: 'admin' | 'user';
    },
    { rejectWithValue }
  ) => {
    try {
      const { user, error } = await createUser(email, password, {
        name,
        phone,
        status,
      });
      if (error) {
        return rejectWithValue(error);
      }
      if (!user) return rejectWithValue('Kullanıcı oluşturulamadı.');
      return user;
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  }
);

export const updateUserAction = createAsyncThunk(
  'users/update',
  async (
    { userId, userData }: { userId: string; userData: UserUpdate },
    { rejectWithValue }
  ) => {
    try {
      const { user, error } = await updateUser(userId, userData);
      if (error) {
        return rejectWithValue(error);
      }
      if (!user) return rejectWithValue('Kullanıcı güncellenemedi.');
      return { userId, userData: user };
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  }
);

export const removeUser = createAsyncThunk(
  'users/delete',
  async (userId: string, { rejectWithValue }) => {
    try {
      const { error } = await deleteUser(userId);
      if (error) {
        return rejectWithValue(error);
      }
      return userId;
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  }
);

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    resetUsers: (state) => {
      state.users = [];
      state.lastDoc = null;
      state.hasMore = true;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch users
      .addCase(fetchUsers.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.meta.arg.lastDoc) {
          state.users = [...state.users, ...action.payload.users];
        } else {
          state.users = action.payload.users;
        }
        state.lastDoc = action.payload.lastDoc;
        state.hasMore = action.payload.hasMore;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Create user
      .addCase(createUserAction.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createUserAction.fulfilled, (state, action) => {
        state.isLoading = false;
        state.users.unshift(action.payload); // Add new users to the top
      })
      .addCase(createUserAction.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Update user
      .addCase(updateUserAction.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateUserAction.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.users.findIndex((u) => u.id === action.payload.userId);
        if (index !== -1) {
          state.users[index] = { ...state.users[index], ...action.payload.userData };
        }
      })
      .addCase(updateUserAction.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Delete user
      .addCase(removeUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removeUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.users = state.users.filter((u) => u.id !== action.payload);
      })
      .addCase(removeUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, resetUsers } = usersSlice.actions;
export default usersSlice.reducer;
