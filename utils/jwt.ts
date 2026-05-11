import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { v4 as uuidv4 } from 'uuid';
import config from '@/config/config';

// Define token payload types
export type TokenType = 'access' | 'refresh';
export interface TokenPayload extends JWTPayload {
  userId: string;
  email: string;
  roles: string[];
  type: TokenType;
}

// Get JWT secret from config
const secret = new TextEncoder().encode(config.jwt.secret);

/**
 * Generate a JWT token
 * @param payload Token payload
 * @param expiresIn Expiration time in seconds (default: 1 day for access, 7 days for refresh)
 * @returns Signed JWT token
 */
export async function generateToken(
  payload: Omit<TokenPayload, 'iat' | 'exp' | 'jti'>,
  expiresIn: number = payload.type === 'access' ? 24 * 60 * 60 : 7 * 24 * 60 * 60 // 1d or 7d
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + expiresIn;
  
  return new SignJWT({ ...payload, iat, exp })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(uuidv4())
    .sign(secret);
}

/**
 * Verify a JWT token
 * @param token JWT token to verify
 * @param expectedType Expected token type (access or refresh)
 * @returns Decoded token payload if valid
 * @throws If token is invalid or expired
 */
export async function verifyToken(
  token: string,
  expectedType?: TokenType
): Promise<TokenPayload> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
      ...(expectedType && { typ: 'JWT' })
    });

    // Type assertion since we know our payload structure
    const typedPayload = payload as TokenPayload;

    // Verify token type if expected type is provided
    if (expectedType && typedPayload.type !== expectedType) {
      throw new Error(`Invalid token type: expected ${expectedType}, got ${typedPayload.type}`);
    }

    return typedPayload;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'JWTExpired') {
        throw new Error('Token has expired');
      }
      if (error.name === 'JWSInvalid' || error.name === 'JWTClaimValidationFailed') {
        throw new Error('Invalid token');
      }
    }
    throw error;
  }
}

// Helper function to import keys
async function importPKCS8OrSPKI(pem: string, type: 'private' | 'public', alg: string) {
  const keyData = pem
    .replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/, '')
    .replace(/-----END (?:RSA )?PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  
  const keyBuffer = Buffer.from(keyData, 'base64');
  
  return await (type === 'private'
    ? crypto.subtle.importKey(
        'pkcs8',
        keyBuffer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
      )
    : crypto.subtle.importKey(
        'spki',
        keyBuffer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
      ));
}
