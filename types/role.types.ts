import { Optional } from 'sequelize';
import { IPermissionAttributes } from './permission.types';

export interface IRoleAttributes {
  id: string;
  name: string;
  description: string | null;
  category?: string | null;
  stakeholderId?: string | null; // New field to link role to stakeholder
  createdAt?: Date;
  updatedAt?: Date;
  permissions?: IPermissionAttributes[];
}

export interface IRoleCreationAttributes extends Optional<IRoleAttributes, 'id' | 'description' | 'permissions' | 'category'> {}
