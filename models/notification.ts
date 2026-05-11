import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface NotificationAttributes {
  id: string;
  type: 'survey' | 'feedback' | 'community_session' | 'system';
  title: string;
  message: string;
  icon?: string;
  link?: string;
  entityId?: string; // ID of the related entity (survey, feedback, etc.)
  entityType?: string; // Type of the related entity
  isRead: boolean;
  userId: string; // User who should receive this notification
  createdBy?: string; // User who triggered this notification
  organizationId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface NotificationCreationAttributes extends Optional<NotificationAttributes, 'id' | 'createdAt' | 'updatedAt' | 'isRead' | 'icon' | 'link' | 'entityId' | 'entityType' | 'createdBy' | 'organizationId'> {}

class Notification extends Model<NotificationAttributes, NotificationCreationAttributes> implements NotificationAttributes {
  public id!: string;
  public type!: 'survey' | 'feedback' | 'community_session' | 'system';
  public title!: string;
  public message!: string;
  public icon?: string;
  public link?: string;
  public entityId?: string;
  public entityType?: string;
  public isRead!: boolean;
  public userId!: string;
  public createdBy?: string;
  public organizationId?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Notification.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    type: {
      type: DataTypes.ENUM('survey', 'feedback', 'community_session', 'system'),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    icon: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    link: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    entityId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    entityType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    organizationId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Notification',
    tableName: 'notifications',
    timestamps: true,
    indexes: [
      {
        fields: ['userId', 'isRead'],
      },
      {
        fields: ['type'],
      },
      {
        fields: ['createdAt'],
      },
      {
        fields: ['entityId', 'entityType'],
      },
    ],
  }
);

export default Notification;
