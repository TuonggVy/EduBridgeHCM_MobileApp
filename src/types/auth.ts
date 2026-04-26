export type ParentInfo = {
  gender: string | null;
  name: string | null;
  phone: string | null;
  occupation: string | null;
  idCardNumber: string | null;
  avatar: string | null;
  relationship: string | null;
  workplace: string | null;
  currentAddress: string | null;
};

export type AuthUser = {
  parent: ParentInfo;
  role: string;
  firstLogin: boolean;
  email: string;
  registerDate: string;
  status: string;
};

/** Body login/register cho mobile: account (user) + tokens */
export type LoginRegisterBody = {
  account: AuthUser;
  accessToken: string;
  refreshToken: string;
  tokenType?: string;
  accessExpiresIn?: number;
  refreshExpiresIn?: number;
};

export type LoginResponse = {
  message: string;
  body: LoginRegisterBody;
};

/** Dùng cho counsellor/school đăng ký; parent gửi null */
export type SchoolRequest = {
  personalEmail?: string;
  schoolName?: string;
  schoolAddress?: string;
  campusName?: string;
  campusAddress?: string;
  taxCode?: string;
  websiteUrl?: string;
  businessLicenseUrl?: string;
  reviewNote?: string;
  rejectionReason?: string;
  createdAt?: string;
};

/** POST /api/v1/auth/register — đăng ký Parent: avatar là URL ảnh Google (JWT claim `picture`) */
export type RegisterRequest = {
  email: string;
  avatar: string;
  role: string;
};

export type RegisterResponse = {
  message: string;
  body: LoginRegisterBody;
};

/** Response POST /api/v1/auth/refresh - body thường là accessToken mới */
export type RefreshResponse = {
  message: string;
  body: string;
};

/** Payload từ Google JWT (idToken) sau khi jwtDecode */
export type GoogleJwtPayload = {
  email?: string;
  name?: string;
  picture?: string;
  sub?: string;
  [key: string]: unknown;
};

// ─── Profile API ───────────────────────────────────────────────────────────

export type ProfileGetBody = {
  parent: ParentInfo;
  role: string;
  firstLogin: boolean;
  email: string;
  status: string;
};

export type ProfileGetResponse = {
  message: string;
  body: ProfileGetBody;
};

export type ParentDataInput = {
  gender?: string;
  name?: string;
  phone?: string;
  idCardNumber?: string;
  relationship?: string;
  workplace?: string;
  occupation?: string;
  currentAddress?: string;
};

export type ProfilePostRequest = {
  parentData?: ParentDataInput;
  counsellorData?: { name?: string };
  campusData?: Record<string, unknown>;
};

export type ProfilePostResponse = {
  message: string;
  body: string;
};
