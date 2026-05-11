import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';


export interface IUserRoleAttributes {
  id?: number;
  userId: string;
  roleId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUserRoleCreationAttributes extends Optional<IUserRoleAttributes, 'id'> {}

export class UserRole extends Model<IUserRoleAttributes, IUserRoleCreationAttributes> implements IUserRoleAttributes {
  declare id: number;
  declare userId: string;
  declare roleId: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

UserRole.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    roleId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'roles',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
  },
  {
    tableName: 'user_roles',
    sequelize,
    timestamps: true,
    indexes:[]
  }
);

export default UserRole;
