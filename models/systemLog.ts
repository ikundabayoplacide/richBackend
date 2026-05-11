import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface SystemLogAttributes {
  id: string;
  userId?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  meta?: any | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type SystemLogCreationAttributes = Optional<SystemLogAttributes, 'id' | 'userId' | 'resourceType' | 'resourceId' | 'meta' | 'ip' | 'userAgent' | 'createdAt' | 'updatedAt'>;

class SystemLog extends Model<SystemLogAttributes, SystemLogCreationAttributes> implements SystemLogAttributes {
  declare id: string;
  declare userId?: string | null;
  declare action: string;
  declare resourceType?: string | null;
  declare resourceId?: string | null;
  declare meta?: any | null;
  declare ip?: string | null;
  declare userAgent?: string | null;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

SystemLog.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'user_id',
    },
    action: {
      type: DataTypes.STRING(128),
      allowNull: false,
      comment: 'Action performed (e.g. created_user, updated_survey)',
    },
    resourceType: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'resource_type',
    },
    resourceId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'resource_id',
    },
    meta: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Optional metadata to store context',
    },
    ip: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'user_agent',
    },
  },
  {
    sequelize,
    modelName: 'SystemLog',
    tableName: 'system_logs',
    timestamps: true,
    indexes:[]
  }
);

export default SystemLog;
