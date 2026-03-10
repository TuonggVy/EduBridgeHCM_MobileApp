export type ParentInfo = {
  occupation: string | null;
  idCardNumber: string | null;
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

export type LoginResponse = {
  message: string;
  body: AuthUser;
};

/** Payload từ Google JWT (idToken) sau khi jwtDecode */
export type GoogleJwtPayload = {
  email?: string;
  name?: string;
  picture?: string;
  sub?: string;
  [key: string]: unknown;
};
