import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { logout as apiLogout } from '../api/auth';
import { getProfile } from '../api/profile';
import { registerWithGoogle as registerWithGoogleService, signInWithGoogle } from '../services/AuthService';
import { unregisterFcmTokenFromBackend } from '../services/PushNotificationService';
import { clearTokens, getAccessToken, getRefreshToken } from '../services/TokenStorage';
import type { AuthUser } from '../types/auth';

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  isBootstrapping: boolean;
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
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const bootstrapSession = async () => {
      try {
        const [accessToken, refreshToken] = await Promise.all([
          getAccessToken(),
          getRefreshToken(),
        ]);
        if (!accessToken && !refreshToken) {
          if (mounted) setUser(null);
          return;
        }

        const profileRes = await getProfile();
        if (!mounted) return;
        const profileBody = profileRes.body;
        const rawRegisterDate = (profileBody as { registerDate?: unknown }).registerDate;
        setUser({
          ...profileBody,
          registerDate: typeof rawRegisterDate === 'string' ? rawRegisterDate : '',
        });
        setError(null);
      } catch {
        if (!mounted) return;
        setUser(null);
        await clearTokens().catch(() => {});
      } finally {
        if (mounted) setIsBootstrapping(false);
      }
    };

    void bootstrapSession();
    return () => {
      mounted = false;
    };
  }, []);

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
    await unregisterFcmTokenFromBackend();
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
        isBootstrapping,
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
