import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface IPermissionAttributes {
  id: string;
  name: string;
  description: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPermissionCreationAttributes extends Optional<IPermissionAttributes, 'id' | 'description'> {}

export class Permission extends Model<IPermissionAttributes, IPermissionCreationAttributes> implements IPermissionAttributes {
  // Use declare to prevent shadowing Sequelize's getters/setters
  declare id: string;
  declare name: string;
  declare description: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
  
  // Static associations
  declare static associations: {
    roles: any;
  };
}

Permission.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [2, 50]
      }
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        len: [0, 255]
      }
    },
  },
  {
    tableName: 'permissions',
    sequelize,
    timestamps: true,
    paranoid: false,
    indexes: [
      {
        unique: true,
        fields: ['name']
      }
    ]
  }
);

// Hooks can be added here if needed
Permission.beforeCreate(async (permission: Permission) => {
  permission.name = String(permission.name).trim();
});

export default Permission;
