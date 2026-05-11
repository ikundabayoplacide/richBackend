import { IUserAttributes } from './user-types';

export interface IUserCreateRequest {
  name: string;
  email: string;
  password?: string;
  address?: string;
  phone?: string;
  role?: IUserAttributes['roles'];
  status?: IUserAttributes['status'];
  profileImage?: string;
  district?: string | null;
  sector?: string | null;
  cell?: string | null;
  village?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  userType?: string; // Optional: a broader category than role
  // Optional: assign roles by id on creation
  roleIds?: string[];
  stakeholderId?: string; // Optional: associate user with a stakeholder on creation
}

export interface IUserUpdateRequest extends Partial<IUserCreateRequest> {}

export interface IUserResponse extends Omit<IUserAttributes, 'password' | 'resetPasswordCode' | 'resetPasswordExpires' | 'googleId'> {
  profileImage?: string;
}
