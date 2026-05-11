import { Response } from 'express';

export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string,
  options: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    maxAge: number;
    path: string;
  }
) => {
  const { httpOnly, secure, sameSite, maxAge, path } = options;

  // Set access token cookie
  res.cookie('access_token', accessToken, {
    httpOnly,
    secure,
    sameSite,
    maxAge,
    path,
  });

  // Set refresh token cookie
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true, // Always httpOnly for refresh token
    secure,
    sameSite,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/auth/refresh-token',
  });
};

export const clearAuthCookies = (res: Response) => {
  res.clearCookie('access_token', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  
  res.clearCookie('refresh_token', {
    path: '/api/auth/refresh-token',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
};
