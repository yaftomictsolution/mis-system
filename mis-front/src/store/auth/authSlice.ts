import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { api } from "@/lib/api";
import { computeCredHash } from "@/lib/crypto";

type User = {
  id: number;
  full_name: string;
  email: string;
  permissions: string[];
};

type AuthState = {
  token: string | null;
  user: User | null;
  hydrated: boolean;
  status: "idle" | "loading" | "failed";
  error: string | null;
};

const initialState: AuthState = {
  token: null,
  user: null,
  hydrated: false,
  status: "idle",
  error: null,
};

function extractApiMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null) {
    const maybeResponse = (error as { response?: { data?: { message?: string } } }).response;
    const maybeMessage = maybeResponse?.data?.message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage;
    }
  }

  return fallback;
}

export const login = createAsyncThunk<
  { token: string; user: User },
  { email: string; password: string },
  { rejectValue: string }
>("auth/login", async ({ email, password }, thunkAPI) => {
  try {
    const res = await api.post("/api/auth/login", { email, password });
    const { token, user } = res.data as { token: string; user: User };

    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));

    try {
      localStorage.setItem("offline_user", JSON.stringify(user));
    } catch (error) {
      console.warn("authSlice: failed to store offline_user", error);
    }

    try {
      const hash = await computeCredHash(email, password);
      localStorage.setItem("cred_hash", hash);
      localStorage.setItem("offline_token", token);
    } catch (error) {
      console.warn("computeCredHash failed", error);
    }

    return { token, user };
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(extractApiMessage(error, "Login failed"));
  }
});

export const fetchMe = createAsyncThunk<User, void, { rejectValue: string }>("auth/me", async (_, thunkAPI) => {
  try {
    const res = await api.get("/api/auth/me");
    const user = res.data.user as User;

    localStorage.setItem("user", JSON.stringify(user));
    return user;
  } catch {
    return thunkAPI.rejectWithValue("Unauthorized");
  }
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    hydrateAuth(state, action: PayloadAction<{ token: string | null; user: User | null }>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.hydrated = true;
    },
    logoutLocal(state) {
      state.token = null;
      state.user = null;
      state.hydrated = true;
      state.status = "idle";
      state.error = null;

      localStorage.removeItem("token");
      localStorage.removeItem("user");
    },
    clearOfflineCredentials() {
      localStorage.removeItem("cred_hash");
      localStorage.removeItem("offline_token");
      localStorage.removeItem("offline_user");
    },
  },
  extraReducers(builder) {
    builder
      .addCase(login.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = "idle";
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.hydrated = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.status = "failed";
        state.hydrated = true;
        state.error = action.payload ?? action.error.message ?? "Login failed";
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.hydrated = true;
        state.user = action.payload;
      })
      .addCase(fetchMe.rejected, (state) => {
        state.hydrated = true;
      });
  },
});

export const { hydrateAuth, logoutLocal, clearOfflineCredentials } = authSlice.actions;
export default authSlice.reducer;
