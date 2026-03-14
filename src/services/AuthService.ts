import { jwtDecode } from 'jwt-decode';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { isSuccessResponse } from '@react-native-google-signin/google-signin';
import { register as apiRegister, signin as apiSignin } from '../api/auth';
import { setAccessToken, setRefreshToken } from './TokenStorage';
import type { AuthUser } from '../types/auth';
import type { GoogleJwtPayload } from '../types/auth';

export type SignInWithGoogleResult =
  | { success: true; data: AuthUser }
  | { success: false; error: string };

export type RegisterWithGoogleResult =
  | { success: true; data: AuthUser }
  | { success: false; error: string };

const PARENT_ROLE = 'PARENT';

/**
 * Luồng theo BE:
 * 1. Nhận credential (JWT) từ Google
 * 2. Dùng jwtDecode để lấy email, name, picture
 * 3. Gọi API app qua signin(email) trong AuthService
 * 4. Nếu thành công thì trả data về callback onSuccess
 */
export async function signInWithGoogle(): Promise<SignInWithGoogleResult> {
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) {
    console.warn('[AuthService] Đăng nhập Google bị hủy hoặc không thành công');
    return { success: false, error: 'Đăng nhập Google bị hủy' };
  }

  const tokens = await GoogleSignin.getTokens();
  const idToken = tokens.idToken;
  if (!idToken) {
    console.error('[AuthService] Không nhận được JWT (idToken) từ Google');
    return { success: false, error: 'Không nhận được JWT từ Google' };
  }

  const payload = jwtDecode<GoogleJwtPayload>(idToken);
  const email = payload.email ?? (response.data as { email?: string }).email;
  if (!email) {
    console.error('[AuthService] Không lấy được email từ JWT. Payload:', payload);
    return { success: false, error: 'Không lấy được email từ Google' };
  }

  try {
    const loginResponse = await apiSignin(email);
    const body = loginResponse.body;
    if (body.accessToken) await setAccessToken(body.accessToken);
    if (body.refreshToken) await setRefreshToken(body.refreshToken);
    return { success: true, data: body.account };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Đăng nhập thất bại';
    console.error('[AuthService] Gọi API login thất bại:', message, e);
    return { success: false, error: message };
  }
}

/**
 * Đăng ký Parent bằng Google: lấy email từ Google → gọi POST /api/v1/auth/register
 * với role PARENT, schoolRequest null.
 */
export async function registerWithGoogle(): Promise<RegisterWithGoogleResult> {
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) {
    return { success: false, error: 'Đăng ký Google bị hủy' };
  }

  const tokens = await GoogleSignin.getTokens();
  const idToken = tokens.idToken;
  if (!idToken) {
    return { success: false, error: 'Không nhận được JWT từ Google' };
  }

  const payload = jwtDecode<GoogleJwtPayload>(idToken);
  const email = payload.email ?? (response.data as { email?: string }).email;
  if (!email) {
    return { success: false, error: 'Không lấy được email từ Google' };
  }

  try {
    const registerResponse = await apiRegister({
      email,
      role: PARENT_ROLE,
      schoolRequest: null,
    });
    const body = registerResponse.body;
    if (body.accessToken) await setAccessToken(body.accessToken);
    if (body.refreshToken) await setRefreshToken(body.refreshToken);
    return { success: true, data: body.account };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Đăng ký thất bại';
    console.error('[AuthService] Gọi API register thất bại:', message, e);
    return { success: false, error: message };
  }
}

/** Trả về email, name, picture từ Google JWT (để dùng hiển thị hoặc gửi BE nếu cần) */
export function getGoogleProfileFromJwt(idToken: string): {
  email: string | undefined;
  name: string | undefined;
  picture: string | undefined;
} {
  const payload = jwtDecode<GoogleJwtPayload>(idToken);
  return {
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  };
}
