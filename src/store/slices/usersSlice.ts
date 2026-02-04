import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  type User,
} from '@/lib/users';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

interface UsersState {
  users: User[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
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
  async ({ pageSize, lastDoc }: { pageSize: number; lastDoc?: QueryDocumentSnapshot<DocumentData> | null }, { rejectWithValue }) => {
    try {
      const { users, lastDoc: newLastDoc, error } = await getAllUsers(pageSize, lastDoc);
      if (error) {
        return rejectWithValue(error);
      }
      return { users, lastDoc: newLastDoc, hasMore: users.length === pageSize };
    } catch (error: any) {
      return rejectWithValue(error.message);
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
      const { id, userId, error } = await createUser(email, password, {
        name,
        phone,
        status,
      });
      if (error) {
        return rejectWithValue(error);
      }
      return {
        id,
        email,
        name,
        phone: phone || '',
        status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as User;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateUserAction = createAsyncThunk(
  'users/update',
  async (
    { userId, userData }: { userId: string; userData: Partial<User> },
    { rejectWithValue }
  ) => {
    try {
      const { error } = await updateUser(userId, userData);
      if (error) {
        return rejectWithValue(error);
      }
      return { userId, userData };
    } catch (error: any) {
      return rejectWithValue(error.message);
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
    } catch (error: any) {
      return rejectWithValue(error.message);
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
        state.lastDoc = action.payload.lastDoc as any; // Firestore types can be tricky with Immer
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
