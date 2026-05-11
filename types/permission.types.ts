import { Optional } from 'sequelize';

export interface IPermissionAttributes {
  id: string;
  name: string;
  description: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPermissionCreationAttributes extends Optional<IPermissionAttributes, 'id' | 'description'> {}
