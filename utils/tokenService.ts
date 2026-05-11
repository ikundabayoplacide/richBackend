// Generate invite link and verify - FIXED VERSION
import crypto from 'crypto';

// Include email in token for better security
export function generateInviteToken(email: string, organizationId: string): string {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex'); // Increased entropy
  const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').substring(0, 8);
  return `${timestamp}_${organizationId}_${emailHash}_${randomString}`;
}

export function verifyInviteToken(token: string, email?: string): { email: string; organizationId: string } | null {
  try {
    const parts = token.split('_');
    if (parts.length !== 4) {
      console.log('Invalid token format - wrong number of parts:', parts.length);
      return null;
    }
    
    const [timestamp, organizationId, emailHash, randomString] = parts;
    const tokenAge = Date.now() - parseInt(timestamp);
    
    // Token expires after 24 hours (86400000 ms)
    if (tokenAge > 86400000) {
      console.log('Token expired. Age:', tokenAge, 'ms');
      return null;
    }

    // If email is provided, verify it matches the hash in token
    if (email) {
      const expectedHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').substring(0, 8);
      if (emailHash !== expectedHash) {
        console.log('Email hash mismatch');
        return null;
      }
    }

    return {
      organizationId,
      email: email || '' // Return the provided email or empty string
    };
  } catch (err) {
    console.log('Token verification error:', err);
    return null;
  }
}
