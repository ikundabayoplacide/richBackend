import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface FeedbackReplyAttributes {
  id: string;
  feedbackId: string;
  subject: string | null;
  message: string;
  userId: string | null;
  organizationId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type FeedbackReplyCreationAttributes = Optional<FeedbackReplyAttributes, 'id' | 'subject' | 'userId' | 'organizationId' | 'createdAt' | 'updatedAt'>;

class FeedbackReply extends Model<FeedbackReplyAttributes, FeedbackReplyCreationAttributes> implements FeedbackReplyAttributes {
  declare id: string;
  declare feedbackId: string;
  declare subject: string | null;
  declare message: string;
  declare userId: string | null;
  declare organizationId?: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

FeedbackReply.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  feedbackId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'feedback_id',
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'user_id',
  },
  organizationId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'organization_id',
  },
}, {
  sequelize,
  modelName: 'FeedbackReply',
  tableName: 'feedback_replies',
  timestamps: true,
  indexes: []
});

export default FeedbackReply;

