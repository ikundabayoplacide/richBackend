import { DataTypes, Model, Optional, type BelongsToManyAddAssociationMixin, type BelongsToManyGetAssociationsMixin, type BelongsToManySetAssociationsMixin, type BelongsToGetAssociationMixin } from 'sequelize';
import sequelize from '../config/database';
import Role from './role';
import { User } from './users';
export type AnnouncementStatus = 'draft' | 'scheduled' | 'sent' | 'stopped';

export interface AnnouncementAttributes {
  id: string;
  title: string;
  message: string;
  status: AnnouncementStatus;
  scheduledAt?: Date | null;
  viewDetailsLink?: string | null;
  createdBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type AnnouncementCreationAttributes = Optional<AnnouncementAttributes, 'id' | 'scheduledAt' | 'viewDetailsLink' | 'createdBy' | 'createdAt' | 'updatedAt'>;

class Announcement extends Model<AnnouncementAttributes, AnnouncementCreationAttributes> implements AnnouncementAttributes {
  declare id: string;
  declare title: string;
  declare message: string;
  declare status: AnnouncementStatus;
  declare scheduledAt?: Date | null;
  declare viewDetailsLink?: string | null;
  declare createdBy?: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  // M:N with Role (allowed roles)
  declare getAllowedRoles: BelongsToManyGetAssociationsMixin<Role>;
  declare addAllowedRole: BelongsToManyAddAssociationMixin<Role, string>;
  declare setAllowedRoles: BelongsToManySetAssociationsMixin<Role, string>;

  // Creator relation
  declare getCreator: BelongsToGetAssociationMixin<User>;
  declare readonly creator?: User | null;
}

Announcement.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: { notEmpty: true },
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
    },
    status: {
      type: DataTypes.ENUM('draft', 'scheduled', 'sent', 'stopped'),
      allowNull: false,
      defaultValue: 'draft',
    },
    scheduledAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    viewDetailsLink: {
      type: DataTypes.STRING(1024),
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'User who created the announcement',
    },
  },
  {
    sequelize,
    modelName: 'Announcement',
    tableName: 'announcements',
    timestamps: true,
    indexes: []
  }
);

export default Announcement;
