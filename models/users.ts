import { DataTypes, Model, Transaction } from 'sequelize';
import sequelize from '../config/database';
import { IUserAttributes, IUserCreationAttributes, IUserInstance } from '../types/user-types';
import { Role } from './role';
import UserRole from './userRole';
import Permission from './permission';

// Define the User model
class User extends Model<IUserAttributes, IUserCreationAttributes> implements IUserInstance {
  // Use declare to prevent shadowing Sequelize's getters/setters
  declare id: string;
  declare name: string;
  declare email: string | null;
  declare password: string;
  declare address: string | null;
  declare phone: string | null;
  // Community Health Worker optional fields
  declare district: string | null;
  declare sector: string | null;
  declare cell: string | null;
  declare village: string | null;
  declare preferredLanguage: string | null;
  declare nearByHealthCenter: string | null;
  // Role-specific optional fields
  declare schoolName: string | null;
  declare schoolAddress: string | null;
  declare churchName: string | null;
  declare churchAddress: string | null;
  declare hospitalName: string | null;
  declare hospitalAddress: string | null;
  declare healthCenterName: string | null;
  declare DeletedAt?: Date | null;
  declare healthCenterAddress: string | null;
  declare epiDistrict: string | null;
  declare userType: string | null;
  declare status: 'active' | 'inactive' | 'pending' | 'reject';
  declare resetPasswordCode: string | null;
  declare resetPasswordExpires: Date | null;
  declare googleId: string | null;
  declare salary: number | null;
  declare profile: string | null;
  declare emailVerified: boolean;
  declare roles?: Role[];
  declare   stakeholderIds: string[]; 
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  // Sequelize association methods - these will be added automatically by Sequelize
  declare getRoles: (options?: any) => Promise<Role[]>;
  declare addRole: (role: Role | string, options?: any) => Promise<void>;
  declare removeRole: (role: Role | string, options?: any) => Promise<void>;
  declare setRoles: (roles: Role[] | string[], options?: any) => Promise<void>;
  declare addRoles: (roles: Role[] | string[], options?: any) => Promise<void>;

  public async hasRole(role: Role | string): Promise<boolean> {
    const roles = await this.getRoles();
    if (typeof role === 'string') {
      return roles.some(r => r.id === role || r.name === role);
    }
    return roles.some(r => r.id === role.id);
  }

  // Static associations
  public static associations: {
    roles: any;
  };

  // Instance methods to satisfy IUserInstance
  public async hasRoleByName(roleName: string): Promise<boolean> {
    const roles = await this.getRoles();
    return roles.some((role: any) => role.name === roleName);
  }

  public async hasPermission(permissionName: string): Promise<boolean> {
    const roles = await this.getRoles({
      include: [{
        model: Permission,
        as: 'permissions',
        through: { attributes: [] },
        required: false
      }]
    });

    return roles.some((role: any) =>
      role.permissions && role.permissions.some((permission: any) => permission.name === permissionName)
    );
  }

  public async addRoleById(roleId: string, transaction?: Transaction): Promise<void> {
    await UserRole.create({
      userId: this.id,
      roleId
    }, { transaction });
  }

  public async removeRoleById(roleId: string, transaction?: Transaction): Promise<void> {
    await UserRole.destroy({
      where: {
        userId: this.id,
        roleId
      },
      transaction
    });
  }

  // Add $get and $add methods to satisfy IUserInstance
  public $get(association: string, options?: any): Promise<any> {
    // @ts-ignore - This is a dynamic method provided by Sequelize
    return this[`get${association.charAt(0).toUpperCase() + association.slice(1)}`](options);
  }

  public $add(association: string, instance: any, options?: any): Promise<void> {
    // @ts-ignore - This is a dynamic method provided by Sequelize
    return this[`add${association.charAt(0).toUpperCase() + association.slice(1)}`](instance, options);
  }
}

// Initialize the model
User.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
    },
    comment: "Name field is required."
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    validate: {
      // Validate email format only when provided
      isEmailOrNull(value: unknown) {
        const v = value as string | null | undefined;
        if (v === null || v === undefined || v === '') return;
        // Basic email format check; avoids requiring external validator import
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!re.test(v)) {
          throw new Error('Invalid email format');
        }
      },
    },
    comment: "Email field is required."
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  temporaryPassword: {
  type: DataTypes.STRING,
  allowNull: true,
  defaultValue: null,
},
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: "Phone field is required."
  },
  // Community Health Worker optional fields
  district: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Optional district name"
  },
  sector: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Optional sector name"
  },
  cell: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Optional cell name"
  },
  village: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Optional village name"
  },
  preferredLanguage: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Optional preferred language"
  },
  nearByHealthCenter: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Optional nearby health center"
  },
  // Role-specific optional fields
  schoolName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Optional school name (for School Director)"
  },
  schoolAddress: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Optional school address (for School Director)"
  },
  churchName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Optional church/mosque name (for religious leaders)"
  },
  churchAddress: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Optional church/mosque address (for religious leaders)"
  },
  hospitalName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Optional hospital name (for Nurse)"
  },
  hospitalAddress: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Optional hospital address (for Nurse)"
  },
  healthCenterName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Optional health center name (for Local Health Center)"
  },
  healthCenterAddress: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Optional health center address (for Local Health Center)"
  },
  epiDistrict: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Optional working district (for EPI Supervisor)"
  },
  userType: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Optional user type received at signup"
  },
  emailVerified: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
    field: 'email_verified',
    comment: 'Whether the user has verified their email address.'
  },
  status: {
    type: DataTypes.ENUM("pending", "active", "inactive", "reject"),
    defaultValue: "pending",
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  resetPasswordCode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  resetPasswordExpires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  googleId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },

  // New fields:
  salary: {
    type: DataTypes.FLOAT,
    allowNull: true,
    validate: {
      min: 0,
    },
  },
  profile: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isCustomUrl(value: string) {
        if (
          value &&
          !/^https?:\/\/(localhost|127\.0\.0\.1|\S+\.\S+)(:\d+)?(\/\S*)?$/.test(
            value
          )
        ) {
          throw new Error(
            "Profile must be a valid URL including localhost or domain."
          );
        }
      },
    },
    comment: "The profile Image should be correct url link."
  },
  DeletedAt:{
    type: DataTypes.DATE,
    allowNull:true,
    comment:"Soft delete field"
  }
}, {
  sequelize,
  modelName: 'User',
  tableName: 'users',
  timestamps: true,
  indexes:[]
});

export { User };