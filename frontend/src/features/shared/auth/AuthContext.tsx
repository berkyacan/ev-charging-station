import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiClientError, apiClient } from '../api';
import type { User, UserRole } from '../types';
import {
  AUTH_STATE_CHANGE_EVENT,
  clearToken,
  getStoredUser,
  getToken,
  setAuthSession,
  setStoredUser,
  setToken,
} from '../utils/authToken';

interface AuthContextValue {
  currentUser: User | null;
  hasToken: boolean;
  isLoadingUser: boolean;
  refreshCurrentUser: (options?: { silent?: boolean }) => Promise<User | null>;
  role: UserRole | null;
  setAuthenticatedSession: (accessToken: string, user?: User | null) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [currentUser, setCurrentUser] = useState<User | null>(() => getStoredUser());
  const [hasToken, setHasToken] = useState<boolean>(() => Boolean(getToken()));
  const [isLoadingUser, setIsLoadingUser] = useState<boolean>(() => {
    return Boolean(getToken()) && !getStoredUser();
  });

  useEffect(() => {
    function syncAuthStateFromStorage(): void {
      const storedToken = getToken();
      const storedUser = getStoredUser();

      setHasToken(Boolean(storedToken));
      setCurrentUser(storedUser);

      if (!storedToken) {
        setIsLoadingUser(false);
        return;
      }

      if (storedUser) {
        setIsLoadingUser(false);
        void refreshCurrentUser({ silent: true });
        return;
      }

      setIsLoadingUser(true);
      void refreshCurrentUser();
    }

    syncAuthStateFromStorage();

    if (typeof window === 'undefined') {
      return undefined;
    }

    window.addEventListener(AUTH_STATE_CHANGE_EVENT, syncAuthStateFromStorage);

    return () => {
      window.removeEventListener(
        AUTH_STATE_CHANGE_EVENT,
        syncAuthStateFromStorage,
      );
    };
  }, []);

  async function refreshCurrentUser(
    options: { silent?: boolean } = {},
  ): Promise<User | null> {
    const { silent = false } = options;
    const token = getToken();

    if (!token) {
      setHasToken(false);
      setCurrentUser(null);
      setIsLoadingUser(false);
      return null;
    }

    if (!silent) {
      setIsLoadingUser(true);
    }

    try {
      const user = await apiClient.get<User>('/auth/me');
      setStoredUser(user);
      setCurrentUser(user);
      setHasToken(true);
      return user;
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        clearToken();
        setHasToken(false);
        setCurrentUser(null);
        return null;
      }

      if (!silent) {
        setCurrentUser(getStoredUser());
      }

      return getStoredUser();
    } finally {
      if (!silent) {
        setIsLoadingUser(false);
      }
    }
  }

  async function setAuthenticatedSession(
    accessToken: string,
    user?: User | null,
  ): Promise<void> {
    if (user) {
      setAuthSession(accessToken, user);
      setHasToken(true);
      setCurrentUser(user);
      setIsLoadingUser(false);
      return;
    }

    setHasToken(true);
    setIsLoadingUser(true);
    setToken(accessToken);
    await refreshCurrentUser();
  }

  function signOut(): void {
    clearToken();
    setHasToken(false);
    setCurrentUser(null);
    setIsLoadingUser(false);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      hasToken,
      isLoadingUser,
      refreshCurrentUser,
      role: currentUser?.role ?? null,
      setAuthenticatedSession,
      signOut,
    }),
    [currentUser, hasToken, isLoadingUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
}
