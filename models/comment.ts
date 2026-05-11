import { DataTypes, Model, Optional, type BelongsToGetAssociationMixin, type BelongsToSetAssociationMixin, type BelongsToCreateAssociationMixin } from 'sequelize';
import sequelize from '../config/database';

export interface CommentAttributes {
  id: string;
  content: string;
  communitySessionId: string;
  userId: string;
  timestamp?: number; // Optional timestamp for video/audio comments (in seconds)
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CommentCreationAttributes = Optional<CommentAttributes, 'id' | 'timestamp' | 'isActive' | 'createdAt' | 'updatedAt'>;

class Comment extends Model<CommentAttributes, CommentCreationAttributes> implements CommentAttributes {
  declare id: string;
  declare content: string;
  declare communitySessionId: string;
  declare userId: string;
  declare timestamp?: number;
  declare isActive: boolean;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  // belongsTo(CommunitySession) association mixins
  declare getCommunitySession: BelongsToGetAssociationMixin<any>;
  declare setCommunitySession: BelongsToSetAssociationMixin<any, string>;
  declare createCommunitySession: BelongsToCreateAssociationMixin<any>;
  declare readonly communitySession?: any;
}

Comment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: { notEmpty: true },
      comment: 'Comment content/text',
    },
    communitySessionId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'community_session_id',
      comment: 'Reference to the community session this comment belongs to',
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
      comment: 'User who posted this comment',
    },
    timestamp: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Optional timestamp in seconds for video/audio comments',
      validate: {
        min: 0,
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
      comment: 'Whether this comment is active/visible',
    },
  },
  {
    sequelize,
    modelName: 'Comment',
    tableName: 'comments',
    timestamps: true,
    indexes: []
  }
);

export default Comment;
