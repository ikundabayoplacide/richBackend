import { IUserAttributes } from "./user-types";

export interface ILoginRequest {
  email: string;
  password: string;
}

export interface ISignupRequest extends ILoginRequest {
  name: string;
  role?: IUserAttributes['roles'];
  address?: string;
  phone?: string;
}

export interface IForgotPasswordRequest {
  email: string;
}

export interface IResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ITokenPayload {
  userId: string;
  email: string;
  role: string;
}

export interface IAuthResponse {
  token: string;
  user: Omit<IUserAttributes, 'password' | 'resetPasswordCode' | 'resetPasswordExpires'>;
}
