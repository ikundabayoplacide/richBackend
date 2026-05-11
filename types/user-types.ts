import { Model, Optional } from 'sequelize';
import { IRoleAttributes } from './role.types';

export type UserStatus = 'pending' | 'active' | 'inactive'| 'reject';

export interface IUserAttributes {
  id: string;
  name: string;
  email?: string | null;
  password: string;
  address?: string | null;
  phone?: string | null;
  temporaryPassword?: string | null;
  status: UserStatus;
  resetPasswordCode?: string | null;
  resetPasswordExpires?: Date | null;
  DeletedAt?: Date | null;
  googleId?: string | null;
  salary?: number | null;
  profile?: string | null;
  emailVerified?: boolean;
  userType?: string | null;
  // Community Health Worker optional fields
  district?: string | null;
  sector?: string | null;
  cell?: string | null;
  village?: string | null;
  preferredLanguage?: string | null;
  nearByHealthCenter?: string | null;
  // Role-specific optional fields
  schoolName?: string | null;
  schoolAddress?: string | null;
  churchName?: string | null;
  churchAddress?: string | null;
  hospitalName?: string | null;
  hospitalAddress?: string | null;
  healthCenterName?: string | null;
  healthCenterAddress?: string | null;
  epiDistrict?: string | null;
  roles?: IRoleAttributes[];
  stakeholderIds?: string[];
  userRoles?: any[]; // For the association
  createdAt?: Date;
  updatedAt?: Date;
}

export type IUserCreationAttributes = Optional<
  IUserAttributes, 
  'id' | 'status' | 'createdAt' | 'updatedAt' |'DeletedAt'| 'emailVerified' | 'password' | 'googleId'
>;

export interface IUserInstance extends 
  Model<IUserAttributes, IUserCreationAttributes>,
  IUserAttributes {
    // Add any instance methods here if needed
    hasRoleByName: (roleName: string) => Promise<boolean>;
    hasPermission: (permissionName: string) => Promise<boolean>;
    addRoleById: (roleId: string) => Promise<void>;
    removeRoleById: (roleId: string) => Promise<void>;
    $get: (association: string) => Promise<any>;
    $add: (association: string, instance: any) => Promise<void>;
    
    // Sequelize association methods
    getRoles: (options?: any) => Promise<any[]>;
    addRole: (role: any, options?: any) => Promise<void>;
    removeRole: (role: any, options?: any) => Promise<void>;
    setRoles: (roles: any[], options?: any) => Promise<void>;
    hasRole: (role: any) => Promise<boolean>;
}
