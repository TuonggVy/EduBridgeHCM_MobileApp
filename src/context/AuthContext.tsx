import React, {
  createContext,
  useContext,
  useState,
  useCallback,
} from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { logout as apiLogout } from '../api/auth';
import { registerWithGoogle as registerWithGoogleService, signInWithGoogle } from '../services/AuthService';
import { clearTokens } from '../services/TokenStorage';
import type { AuthUser } from '../types/auth';

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  loginWithGoogle: () => Promise<void>;
  registerWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

type AuthProviderProps = {
  children: React.ReactNode;
  onRegisterSuccess?: () => void;
};

export function AuthProvider({ children, onRegisterSuccess }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginWithGoogle = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await signInWithGoogle();
      if (result.success) {
        setUser(result.data);
        // onSuccess: data đã được trả về và lưu vào state (user)
      } else {
        console.warn('[AuthContext] Login không thành công:', result.error);
        setError(result.error);
      }
    } catch (e) {
      console.error('[AuthContext] Lỗi khi đăng nhập:', e);
      setError('Đăng nhập thất bại');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const registerWithGoogle = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await registerWithGoogleService();
      if (result.success) {
        onRegisterSuccess?.();
        // Không set user: chuyển sang màn hình đăng nhập để user đăng nhập lại.
      } else {
        setError(result.error);
      }
    } catch (e) {
      console.error('[AuthContext] Lỗi khi đăng ký:', e);
      setError('Đăng ký thất bại');
    } finally {
      setIsLoading(false);
    }
  }, [onRegisterSuccess]);

  const logout = useCallback(async () => {
    await GoogleSignin.signOut();
    try {
      await apiLogout();
    } finally {
      await clearTokens();
    }
    setUser(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        loginWithGoogle,
        registerWithGoogle,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
