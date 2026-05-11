import { OAuth2Client } from 'google-auth-library';
import { GoogleUser, RawGoogleUser } from '../types/auth-controller-types';
import config from '../config/config';

const { google } = config;

// Create a new OAuth2 client with the Google client ID and secret
export const oauth2Client = new OAuth2Client(
  google.clientId,
  google.clientSecret,
  google.callbackURL
);

/**
 * Generate the Google OAuth2 URL for user login
 * @param state Optional state parameter for CSRF protection
 * @returns The Google OAuth2 URL
 */
export const getGoogleAuthURL = (state: string = 'state_parameter_passthrough_value'): string => {
  try {
    // Log configuration for debugging (remove in production)
    console.log('Google OAuth Config:', {
      clientId: google.clientId ? 'configured' : 'missing',
      clientSecret: google.clientSecret ? 'configured' : 'missing',
      callbackURL: google.callbackURL
    });

    // Define the scopes needed for the Google OAuth2 request
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ];

    // Generate the URL for the Google OAuth2 consent page
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      response_type: 'code',
      prompt: 'consent', // Forces the consent screen to be shown
      scope: scopes,
      state,
    });

    console.log('Generated auth URL:', authUrl);
    return authUrl;
  } catch (error) {
    console.error('Error generating Google auth URL:', error);
    throw new Error(`Failed to generate Google auth URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Exchange the authorization code for user information
 * @param code The authorization code from Google
 * @returns User information from Google
 */
export const getGoogleUser = async (code: string): Promise<GoogleUser> => {
  try {
    console.log('Starting Google OAuth token exchange...');
    console.log('Authorization code received:', code ? 'present' : 'missing');

    // Validate inputs
    if (!code) {
      throw new Error('Authorization code is required');
    }

    if (!google.clientId || !google.clientSecret || !google.callbackURL) {
      throw new Error('Google OAuth configuration is incomplete');
    }

    // Exchange the authorization code for tokens
    console.log('Exchanging code for tokens...');
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('Tokens received:', {
      access_token: tokens.access_token ? 'present' : 'missing',
      token_type: tokens.token_type,
      expires_in: tokens.expiry_date
    });

    if (!tokens.access_token) {
      throw new Error('No access token received from Google');
    }
    
    // Set the credentials on the OAuth2 client
    oauth2Client.setCredentials(tokens);
    
    // Get user info from Google's OAuth2 API
    console.log('Fetching user info from Google...');
    
    // Try the v2 endpoint first (more reliable)
    let userInfo;
    try {
      userInfo = await oauth2Client.request<RawGoogleUser>({
        url: 'https://www.googleapis.com/oauth2/v2/userinfo',
      });
    } catch (v2Error) {
      console.log('v2 endpoint failed, trying v3...', v2Error);
      // Fallback to v3 endpoint
      userInfo = await oauth2Client.request<RawGoogleUser>({
        url: 'https://www.googleapis.com/oauth2/v3/userinfo',
      });
    }

    console.log('Raw user info received:', userInfo.data);

    const googleUserData = userInfo.data as RawGoogleUser;

    // Validate required fields
    if (!googleUserData.sub && !googleUserData.id) {
      throw new Error('No user ID found in Google response');
    }

    if (!googleUserData.email) {
      throw new Error('No email found in Google response');
    }

    // Handle both v2 and v3 API response formats
    const userId = googleUserData.sub || googleUserData.id;
    
    const result: GoogleUser = {
      id: userId!,
      email: googleUserData.email,
      name: googleUserData.name || `${googleUserData.given_name || ''} ${googleUserData.family_name || ''}`.trim(),
      picture: googleUserData.picture || '',
      email_verified: googleUserData.email_verified || googleUserData.verified_email || false,
    };

    console.log('Processed user data:', result);
    return result;

  } catch (error) {
    console.error('Detailed error in getGoogleUser:', error);
    
    // Log specific error details for debugging
    if (error && typeof error === 'object') {
      console.error('Error details:', {
        name: (error as any).name,
        message: (error as any).message,
        code: (error as any).code,
        status: (error as any).status,
        response: (error as any).response?.data,
        config: (error as any).config ? {
          url: (error as any).config.url,
          method: (error as any).config.method,
        } : undefined
      });
    }

    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('invalid_grant')) {
        throw new Error('Authorization code has expired or been used already. Please try logging in again.');
      } else if (error.message.includes('invalid_client')) {
        throw new Error('Invalid OAuth client configuration. Please check your Google Console settings.');
      } else if (error.message.includes('redirect_uri_mismatch')) {
        throw new Error('Redirect URI mismatch. Please check your Google Console configuration.');
      } else if (error.message.includes('access_denied')) {
        throw new Error('Access denied by user or Google.');
      }
    }
    
    throw new Error(`Failed to authenticate with Google: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};