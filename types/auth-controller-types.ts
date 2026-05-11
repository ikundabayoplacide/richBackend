export interface LoginRequest {
  // Backward compatible: clients may still send `email`
  email?: string;
  // New options to allow login via phone or a generic identifier
  phone?: string;
  identifier?: string; // email or phone
  // Preferred shape
  type?: 'email' | 'phone';
  loginValue?: string;
  password: string;
}

export interface SignupRequest {
  name: string;
  email?: string; // optional: signup can proceed without email
  password: string;
  address?: string;
  phone: string; // required for signup
  roleType?: string;
  userType?: string | null;
  // Extended optional profile fields
  district?: string | null;
  sector?: string | null;
  cell?: string | null;
  village?: string | null;
  preferredLanguage?: string | null;
  nearByHealthCenter?: string | null;
  // Role-specific
  schoolName?: string | null;
  schoolAddress?: string | null;
  churchName?: string | null;
  churchAddress?: string | null;
  hospitalName?: string | null;
  hospitalAddress?: string | null;
  healthCenterName?: string | null;
  healthCenterAddress?: string | null;
  epiDistrict?: string | null;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture: string;
  email_verified: boolean;
}

// Raw response from Google OAuth2 API (covers both v2 and v3 endpoints)
export interface RawGoogleUser {
  // v3 endpoint fields
  sub?: string;              // User ID in v3
  email: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
  
  // v2 endpoint fields (fallback)
  id?: string;              // User ID in v2
  verified_email?: boolean; // v2 version of email_verified
}
