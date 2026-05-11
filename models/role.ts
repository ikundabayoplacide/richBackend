import { 
  Model, 
  DataTypes,
} from 'sequelize';
import sequelize from '../config/database';
import { IRoleAttributes, IRoleCreationAttributes } from '../types/role.types';

export class Role extends Model<IRoleAttributes, IRoleCreationAttributes> implements IRoleAttributes {
  // Basic model attributes - keep these
  declare id: string;
  declare name: string;
  declare description: string | null;
  declare category?: string | null;
  declare stakeholderId?: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  // Custom instance methods for convenience
  public async addPermissionById(permissionId: string): Promise<any> {
    const { Permission } = require('./permission');
    const permission = await Permission.findByPk(permissionId);
    if (!permission) {
      throw new Error('Permission not found');
    }
    await (this as any).addPermission(permission);
    return permission;
  }

  public async removePermissionById(permissionId: string): Promise<boolean> {
    const { Permission } = require('./permission');
    const permission = await Permission.findByPk(permissionId);
    if (!permission) {
      return false;
    }
    await (this as any).removePermission(permission);
    return true;
  }

  public async hasPermissionByName(permissionName: string): Promise<boolean> {
    const permissions = await (this as any).getPermissions({
      where: { name: permissionName },
    });
    return permissions.length > 0;
  }
}

Role.init(
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
    stakeholderId: {
      type: DataTypes.UUID,
      allowNull: true,
      unique: true
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        len: [0, 255]
      }
    },
    category: {
      type: DataTypes.STRING(80),
      allowNull: true,
      validate: {
        len: [0, 80]
      }
    },
  },
  {
    tableName: 'roles',
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
Role.beforeCreate(async (role: Role) => {
  // You can add any pre-save logic here
  role.name = String(role.name).trim();
});

export default Role;