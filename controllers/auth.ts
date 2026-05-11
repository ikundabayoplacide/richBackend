import { Controller, Post, Get, Body, Route, Tags, Response, SuccessResponse, Res, Query, TsoaResponse, Request, Security } from '@tsoa/runtime';
import { compare, hash } from 'bcrypt';
import { Request as ExpressRequest } from 'express';
import { Op } from 'sequelize';
import { ServiceResponse } from '../utils/serviceResponse';
import { generateToken as generateJwtToken, verifyToken } from '../utils/jwt';
import { getGoogleAuthURL, getGoogleUser } from '../utils/googleOAuth';
import config from '../config/config';
import { sendPasswordResetEmail } from '../utils/emailService';
import { IUserResponse } from '../types/user-controller-types';

import {
  LoginRequest,
  SignupRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from '../types/auth-controller-types';
import sequelize from '../config/database';
import { asyncCatch } from '@/middlewares/errorHandler';
import db from '@/models';
import { IUserAttributes } from '../types/user-types';
import { verifyInviteToken } from '../utils/tokenService';
import { validateSignupData, sanitizeString } from '../utils/validationHelpers';
import type { User } from '@/models/users';

// Extend the Express Request type to include the user property
declare global {
  namespace Express {
    interface Request {
      user?: User
    }
  }
}

// First, add this to your auth-controller-types.ts file:
export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}



@Route('api/auth')
@Tags('Authentication')
export class AuthController extends Controller {

  private async _buildUserResponse(user: User): Promise<IUserResponse> {
    const roles = await user.getRoles({
      attributes: ['id', 'name', 'category', 'description'],
      include: [{
        model: db.Permission,
        as: 'permissions',
        through: { attributes: [] },
        attributes: ['id', 'name', 'description']
      }]
    });

    const { password, resetPasswordCode, resetPasswordExpires, ...userData } = user.toJSON();

    return {
      ...userData,
      roles,
    };
  }

  @Post('/login')
  @SuccessResponse(200, 'Login successful')
  @Response(401, 'Invalid credentials')
  @Response(403, 'Account is inactive')
  @asyncCatch
  public async login(
    @Body() credentials: LoginRequest,
    @Res() res: TsoaResponse<200 | 401 | 403, ServiceResponse<{ user: IUserResponse | null }>>
  ): Promise<void> {
    const { type, email, phone, password } = credentials as any;

    if ((!email && !phone) || !password) {

      res(401, ServiceResponse.failure('Invalid credentials', { user: null }));
      return;
    }

    let where: any;
    if (type === 'email') {
      where = { email: email };
    } else if (type === 'phone') {
      where = { phone: phone };
    }

    const data = await db.User.findOne({ where });
    const user = data?.toJSON() as IUserAttributes | undefined;

    if (!user || !user.password || !(await compare(password, user.password))) {
      res(401, ServiceResponse.failure('Invalid credentials', { user: null }));
      return;
    }

    if (user.status === 'inactive') {
      res(403, ServiceResponse.failure('Your account is inactive. Please contact support.', { user: null }));
      return;
    }
    if (user.status === 'pending') {
      res(403, ServiceResponse.failure('Account Needs Verification.', { user: null }));
      return;
    }

    const token = await this.generateToken(data!);
    const cookieString = await this.getCookieString(token);

    const userResponse = await this._buildUserResponse(data!);
  
    return res(200, ServiceResponse.success('Login successful', { user: userResponse, token: token }), {
      'Set-Cookie': cookieString,
    });

  }

  @Post('/signup')
  @SuccessResponse(201, 'User created')
  @Response(400, 'Validation error')
  @asyncCatch
  public async signup(
    @Body() signupData: SignupRequest,
    @Res() res: TsoaResponse<201 | 400, ServiceResponse<{ user: IUserResponse | null }>>
  ): Promise<void> {
    const {
      email,
      password,
      name,
      address,
      phone,
      roleType,
      userType,
      // extended optional profile fields
      district,
      sector,
      cell,
      village,
      preferredLanguage,
      nearByHealthCenter,
      // role-specific
      schoolName,
      schoolAddress,
      churchName,
      churchAddress,
      hospitalName,
      hospitalAddress,
      healthCenterName,
      healthCenterAddress,
      epiDistrict,
    } = signupData as any;

    // Comprehensive input validation using validation helpers
    const validation = validateSignupData(signupData);
    if (!validation.isValid) {
      res(400, ServiceResponse.failure(validation.message!, { user: null }));
      return;
    }

    // Clean phone number for database operations
    const phoneStr = String(phone).trim();

    // Uniqueness checks with user-friendly messages
    const existingPhoneUser = await db.User.findOne({ where: { phone: phoneStr } });
    if (existingPhoneUser) {
      res(400, ServiceResponse.failure('An account with this phone number already exists. Please use a different phone number or try logging in.', { user: null }));
      return;
    }

    if (email && String(email).trim()) {
      const existingEmailUser = await db.User.findOne({ where: { email: String(email).trim().toLowerCase() } });
      if (existingEmailUser) {
        res(400, ServiceResponse.failure('An account with this email address already exists. Please use a different email or try logging in.', { user: null }));
        return;
      }
    }

    const hashedPassword = await hash(password, 10);

    const newUser = await sequelize.transaction(async (t) => {
      // Create user with status based on role
      const isGeneralPopulation = roleType === 'general_population';
      
      // Clean and prepare data for database insertion using sanitization helpers
      const userData = {
        name: sanitizeString(name)!,
        email: email ? sanitizeString(email)!.toLowerCase() : null,
        password: hashedPassword,
        address: sanitizeString(address),
        phone: phoneStr,
        status: (isGeneralPopulation ? 'active' : 'pending') as 'active' | 'pending',
        userType: sanitizeString(userType),
        // extended optional fields - clean and validate
        district: sanitizeString(district),
        sector: sanitizeString(sector),
        cell: sanitizeString(cell),
        village: sanitizeString(village),
        preferredLanguage: sanitizeString(preferredLanguage),
        nearByHealthCenter: sanitizeString(nearByHealthCenter),
        // role-specific optional fields - clean and validate
        schoolName: sanitizeString(schoolName),
        schoolAddress: sanitizeString(schoolAddress),
        churchName: sanitizeString(churchName),
        churchAddress: sanitizeString(churchAddress),
        hospitalName: sanitizeString(hospitalName),
        hospitalAddress: sanitizeString(hospitalAddress),
        healthCenterName: sanitizeString(healthCenterName),
        healthCenterAddress: sanitizeString(healthCenterAddress),
        epiDistrict: sanitizeString(epiDistrict),
      };

      const user = await db.User.create(userData, { transaction: t });

      // Find or create role
      let role = await db.Role.findOne({ where: { name: roleType }, transaction: t });

      // If role doesn't exist, return error
      if (!role) {
        res(400, ServiceResponse.failure('The selected role is not valid. Please choose a valid role and try again.', { user: null }));
        await t.rollback();
        return;
      }

      // Assign role to user
      await (user as any).addRole(role, { transaction: t });

      // Associate created user with the system_owner organization if it exists
      try {
        const systemOrg = await db.Organization.findOne({ where: { type: 'system_owner' }, transaction: t });
        if (systemOrg) {
          await (systemOrg as any).addUser(user, { transaction: t });
        }
      } catch (e) {
        // non-fatal: log and continue
        console.warn('Failed to associate user with system_owner organization', e);
      }

      //save user
      await user.save({ transaction: t });

      return user;
    });

    if (!newUser) {
      res(400, ServiceResponse.failure('Unable to create your account. Please check your information and try again.', { user: null }));
      return;
    }

    // if role is general_population, send token otherwise send message that they need to be verified
    if (roleType !== 'general_population') {
      res(201, ServiceResponse.success('Signup successful. Your account is pending verification.', { user: null }));
      return;
    }
    const token = await this.generateToken(newUser);
    const cookieString = await this.getCookieString(token);

    const userResponse = await this._buildUserResponse(newUser);
    res(201, ServiceResponse.success('Signup successful', { user: userResponse }), {
      'Set-Cookie': cookieString,
    });
  }

  @Post('/check-email')
  @SuccessResponse(200, 'Email check successful')
  @asyncCatch
  public async checkEmail(@Body() request: { email: string }): Promise<ServiceResponse<{ exists: boolean }>> {
    const { email } = request;

    if (!email || !email.trim()) {
      return ServiceResponse.failure('Email is required', { exists: false }, 400);
    }

    const user = await db.User.findOne({ where: { email: email.trim().toLowerCase() } });

    return ServiceResponse.success('Email check successful', { exists: !!user });
  }

  @Post('/forgot-password')
  @SuccessResponse(200, 'Password reset email sent')
  @asyncCatch
  public async forgotPassword(@Body() request: ForgotPasswordRequest): Promise<ServiceResponse<null>> {
    const { email } = request;
    const userModel = await db.User.findOne({ where: { email } });
    const user = userModel?.toJSON();

    if (!user) {
      return ServiceResponse.failure('User not found', null, 404);
    }

    const resetCode = Math.random().toString(36).substring(2, 12);
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    await userModel?.update({ resetPasswordCode: resetCode, resetPasswordExpires: resetExpires });
    await sendPasswordResetEmail(user.email || '', resetCode);


    return ServiceResponse.success('A password reset link has been sent to your email.', null);
  }

  @Post('/reset-password')
  @SuccessResponse(200, 'Password has been reset')
  @Response(400, 'Invalid or expired reset code')
  @asyncCatch
  public async resetPassword(@Body() request: ResetPasswordRequest): Promise<ServiceResponse<null>> {
    const { token, newPassword } = request;

    const user = await db.User.findOne({
      where: { resetPasswordCode: token, resetPasswordExpires: { [Op.gt]: new Date() } },
    });

    if (!user) {
      return ServiceResponse.failure('Invalid or expired reset code', null, 400);
    }

    const hashedPassword = await hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordCode = null;
    user.resetPasswordExpires = null;
    await user.save();

    return ServiceResponse.success('Password has been reset successfully', null);
  }

  @Get('/google')
  @SuccessResponse(302, 'Redirect to Google OAuth')
  @asyncCatch
  public googleAuth(@Res() res: TsoaResponse<302, void, { Location: string }>): void {
    res(302, undefined, { Location: getGoogleAuthURL() });
  }

  @Get('/google/callback')
  @SuccessResponse(302, 'Redirect after Google OAuth')
  @asyncCatch
  public async googleAuthCallback(
    @Res() res: TsoaResponse<302, void, { Location: string; 'Set-Cookie'?: string }>,
    @Query('code') code: string,
    @Query('error') error?: string
  ): Promise<void> {
    console.log('Google OAuth callback received:', { code, error });

    if (error) {
      console.error('OAuth error:', error);
      res(302, undefined, { Location: `${config.frontendUrl}/login?error=oauth_${error}` });
      return;
    }

    if (!code) {
      console.error('No code received from Google');
      res(302, undefined, { Location: `${config.frontendUrl}/login?error=no_code` });
      return;
    }

    const googleUser = await getGoogleUser(code);

    const user = await sequelize.transaction(async (t) => {
      // First try to find by googleId
      let user = await db.User.findOne({
        where: { googleId: googleUser.id },
        include: [{
          model: db.Role,
          as: 'roles' // Specify the alias for the Role association
        }],
        transaction: t
      });

      if (!user) {
        user = await db.User.findOne({
          where: { email: googleUser.email },
          include: [{
            model: db.Role,
            as: 'roles' // Specify the alias for the Role association
          }],
          transaction: t
        });
      }

      // Create new user if doesn't exist
      if (!user) {
        console.log('Creating new user for Google account');
        user = await db.User.create({
          name: googleUser.name,
          email: googleUser.email,
          googleId: googleUser.id,
          status: 'active',
          emailVerified: googleUser.email_verified,
          profile: googleUser.picture,
        }, { transaction: t });

        // Assign default 'user' role
        const userRole = await db.Role.findOne({
          where: { name: 'local_citizen' },
          transaction: t
        });

        if (userRole) {
          console.log('Assigning default user role');
          await (user as any).addRole(userRole, { transaction: t });
        }
      } else if (!user.googleId) {
        // Link existing account with Google
        console.log('Linking existing account with Google');
        await user.update({
          googleId: googleUser.id,
          emailVerified: googleUser.email_verified,
          profile: googleUser.picture || user.profile
        }, { transaction: t });
      }

      // Make sure to reload with roles
      return user.reload({
        include: [{
          model: db.Role,
          as: 'roles' // Specify the alias for the Role association
        }],
        transaction: t
      });
    });

    const token = await this.generateToken(user);
    const cookieString = await this.getCookieString(token);

    console.log('Redirecting to dashboard');
    res(302, undefined, {
      Location: `${config.frontendUrl}/dashboard`,
      'Set-Cookie': cookieString,
    });
  }

@Get('/me')
@Security("jwt")
@SuccessResponse(200, 'User retrieved successfully')
@Response(401, 'Unauthorized')
@asyncCatch
public async getCurrentUser(
  @Request() req: ExpressRequest,
  @Res() res: TsoaResponse<200 | 401, ServiceResponse<{ user: IUserResponse | null }>>
): Promise<void> {
  try {
    const userId= req.user?.id;

    // Get fresh user data from the database with roles and permissions
    const userModel = await db.User.findByPk(userId, {
      include: [
        {
          model: db.Role,
          as: 'roles',
          attributes: ['id', 'name', 'description'],
          through: { attributes: [] },
          required: false
        }
      ]
    });

    console.log('User found in DB:', userModel ? 'Yes' : 'No');
    
    if (!userModel) {
      console.log('User not found in database for ID:',userId);
      res(401, ServiceResponse.failure('User not found', { user: null }));
      return;
    }

    const userResponse = await this._buildUserResponse(userModel);
    res(200, ServiceResponse.success('User retrieved successfully', { user: userResponse }));
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    res(401, ServiceResponse.failure('Not authenticated', { user: null }));
  }
}

  @Post('/logout')
  @SuccessResponse(200, 'Logout successful')
  @asyncCatch
  public async logout(@Res() res: TsoaResponse<200, ServiceResponse<{ success: boolean }>, { 'Set-Cookie': string }>): Promise<void> {
    res(200, ServiceResponse.success('Logout successful', { success: true }), {
      'Set-Cookie': 'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    });
  }

  // Updated signup endpoint
  @Post('/organization-signup')
  @asyncCatch
  @SuccessResponse(201, 'Account created successfully')
  @Response(400, 'Invalid or expired invite link')
  public async organizationSignup(
    @Body() data: {
      token: string;
      organizationId: string;
      name: string;
      password: string;
      phone: string;
    },
    @Res() res: TsoaResponse<201 | 400, ServiceResponse<any>, { 'Set-Cookie': string }>
  ): Promise<void> {
    // Verify token with email
    const verified = verifyInviteToken(data.token);
    if (!verified) {
      console.log('Token verification failed:', {
        verified,
        providedOrgId: data.organizationId,
      });
      res(400, ServiceResponse.failure('Invalid or expired invite link', null, 400));
      return;
    }

    const t = await sequelize.transaction();
    try {
      // Check if user with this phone number already exists
      const existingUser = await db.User.findOne({
        where: { phone: data.phone },
        transaction: t
      });

      if (existingUser) {
        await t.rollback();
        res(400, ServiceResponse.failure('User with this phone number already exists', null, 400));
        return;
      }

      // 1. Create user with email
      const user = await db.User.create({
        name: data.name,
        // email: data.email, // ADD EMAIL
        password: await hash(data.password, 10),
        phone: data.phone,
        status: 'active',
        emailVerified: true, // auto-verify since we sent invite
      }, { transaction: t });

      // 2. Find organization and its role
      const organization = await db.Organization.findByPk(verified.organizationId, {
        // include: [{ model: db.Role, as: 'role' }],
        transaction: t,
      });

      if (!organization) {
        await t.rollback();
        res(400, ServiceResponse.failure('Organization not found', null, 400));
        return;
      }

      // 3. Associate user with organization
      await (organization as any).addUser(user, { transaction: t });

      // 4. Set user as organization owner
      await organization.update({ ownerId: user.id }, { transaction: t });

      // 5. Assign organization role to user
      const organizationRole = await db.Role.findOne({
        where: {
          stakeholderId: verified.organizationId
        },
        transaction: t
      });

      if (organizationRole) {
        await user.addRole(organizationRole, { transaction: t });
      }

      const token = await this.generateToken(user);
      const cookieString = await this.getCookieString(token);
      await t.commit();

      return res(201, ServiceResponse.success('Account created successfully', {
        user: { id: user.id, name: user.name, email: user.email }
      }), {
        'Set-Cookie': cookieString
      });
    } catch (err) {
      await t.rollback();
      console.error('Organization signup error:', err);
      throw err;
    }
  }

  // Then add this route to your AuthController class:

  @Post('/change-password')
  @Security("jwt")
  @SuccessResponse(200, 'Password changed successfully')
  @Response(400, 'Invalid old password')
  @Response(401, 'Unauthorized')
  @asyncCatch
  public async changePassword(
    @Body() body: ChangePasswordRequest,
    @Request() req: ExpressRequest,
    @Res() res: TsoaResponse<200 | 400 | 401, ServiceResponse<null>>
  ): Promise<void> {
    const { oldPassword, newPassword } = body;

    // Check if user is authenticated
    const user = req.user;
    if (!user?.id) {
      res(401, ServiceResponse.failure('Not authenticated', null));
      return;
    }

    // Validate input
    if (!oldPassword || !newPassword) {
      res(400, ServiceResponse.failure('Old password and new password are required', null));
      return;
    }

    // Additional validation for new password (you can customize these rules)
    if (newPassword.length < 6) {
      res(400, ServiceResponse.failure('New password must be at least 6 characters long', null));
      return;
    }

    // Get user from database with password
    const userModel = await db.User.findByPk(user.id);
    if (!userModel || !userModel.password) {
      res(401, ServiceResponse.failure('User not found', null));
      return;
    }

    // Verify old password
    const isOldPasswordValid = await compare(oldPassword, userModel.password);
    if (!isOldPasswordValid) {
      res(400, ServiceResponse.failure('Current password is incorrect', null));
      return;
    }

    // Check if new password is different from old password
    const isSamePassword = await compare(newPassword, userModel.password);
    if (isSamePassword) {
      res(400, ServiceResponse.failure('New password must be different from current password', null));
      return;
    }

    // Hash new password and update
    const hashedNewPassword = await hash(newPassword, 10);
    await userModel.update({
      password: hashedNewPassword,
      // Optionally clear reset password fields if they exist
      resetPasswordCode: null,
      resetPasswordExpires: null
    });

    res(200, ServiceResponse.success('Password changed successfully', null));
  }

private async generateToken(userModel: User): Promise<string> {
  const roles = await userModel.getRoles({ attributes: ['name','category','stakeholderId'] });

  // collect role names
  const roleNames = roles.map(role => role.name);

  const user = userModel.toJSON();

  return generateJwtToken({
    userId: user.id,
    email: user.email,
    roles: roleNames,
    type: 'access' as const,
  });
}


  private async getCookieString(token: string): Promise<string> {
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax', // Use 'none' in production for cross-site cookies
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      path: '/',
      ...(isProduction && { domain: 'richubuzima.rw' }),
    };

    return `token=${token}; ${Object.entries(cookieOptions)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ')}`;
  }
}