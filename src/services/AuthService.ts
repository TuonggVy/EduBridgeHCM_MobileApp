import { jwtDecode } from 'jwt-decode';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { isSuccessResponse } from '@react-native-google-signin/google-signin';
import { isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
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
const GOOGLE_ANDROID_PACKAGE = 'com.edubridge.hcm';

function mapGoogleSigninError(error: unknown): string {
  if (isErrorWithCode(error)) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      return 'Bạn đã hủy đăng nhập Google';
    }
    if (error.code === statusCodes.IN_PROGRESS) {
      return 'Đăng nhập Google đang xử lý, vui lòng thử lại';
    }
    if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return 'Google Play Services không khả dụng trên thiết bị';
    }
  }

  const rawMessage = error instanceof Error ? error.message : String(error);
  if (rawMessage.includes('DEVELOPER_ERROR')) {
    return `Google Sign-In cấu hình chưa đúng (DEVELOPER_ERROR). Kiểm tra package ${GOOGLE_ANDROID_PACKAGE}, SHA-1 debug/release và Web client ID trên Google Cloud/Firebase.`;
  }

  return rawMessage || 'Đăng nhập Google thất bại';
}

/**
 * Luồng theo BE:
 * 1. Nhận credential (JWT) từ Google
 * 2. Dùng jwtDecode để lấy email, name, picture
 * 3. Gọi API app qua signin(email) trong AuthService
 * 4. Nếu thành công thì trả data về callback onSuccess
 */
export async function signInWithGoogle(): Promise<SignInWithGoogleResult> {
  let response;
  try {
    await GoogleSignin.hasPlayServices();
    response = await GoogleSignin.signIn();
  } catch (e: unknown) {
    const message = mapGoogleSigninError(e);
    console.error('[AuthService] Google Sign-In thất bại:', message, e);
    return { success: false, error: message };
  }

  if (!isSuccessResponse(response)) {
    console.warn('[AuthService] Đăng nhập Google bị hủy hoặc không thành công');
    return { success: false, error: 'Đăng nhập Google bị hủy' };
  }

  let tokens;
  try {
    tokens = await GoogleSignin.getTokens();
  } catch (e: unknown) {
    const message = mapGoogleSigninError(e);
    console.error('[AuthService] Lấy token Google thất bại:', message, e);
    return { success: false, error: message };
  }

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
 * Đăng ký Parent bằng Google: email + avatar (URL ảnh đại diện Gmail từ JWT `picture`) → POST /api/v1/auth/register.
 */
export async function registerWithGoogle(): Promise<RegisterWithGoogleResult> {
  let response;
  try {
    await GoogleSignin.hasPlayServices();
    response = await GoogleSignin.signIn();
  } catch (e: unknown) {
    const message = mapGoogleSigninError(e);
    console.error('[AuthService] Google Sign-In thất bại khi đăng ký:', message, e);
    return { success: false, error: message };
  }

  if (!isSuccessResponse(response)) {
    return { success: false, error: 'Đăng ký Google bị hủy' };
  }

  let tokens;
  try {
    tokens = await GoogleSignin.getTokens();
  } catch (e: unknown) {
    const message = mapGoogleSigninError(e);
    console.error('[AuthService] Lấy token Google thất bại khi đăng ký:', message, e);
    return { success: false, error: message };
  }

  const idToken = tokens.idToken;
  if (!idToken) {
    return { success: false, error: 'Không nhận được JWT từ Google' };
  }

  const payload = jwtDecode<GoogleJwtPayload>(idToken);
  const email = payload.email ?? (response.data as { email?: string }).email;
  if (!email) {
    return { success: false, error: 'Không lấy được email từ Google' };
  }

  const avatar =
    typeof payload.picture === 'string' && payload.picture.length > 0
      ? payload.picture
      : '';

  try {
    const registerResponse = await apiRegister({
      email,
      avatar,
      role: PARENT_ROLE,
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
