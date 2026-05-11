import { 
  BelongsToManySetAssociationsMixin, 
  BelongsToManyGetAssociationsMixin,
  BelongsToManyAddAssociationMixin,
  BelongsToManyAddAssociationsMixin,
  BelongsToManyRemoveAssociationMixin,
  DataTypes, 
  Model, 
  Optional 
} from 'sequelize';
import sequelize from '../config/database';
import { Role } from './role';

export interface FeedbackAttributes {
  id: string;
  mainMessage: string | null;
  feedbackType: 'positive' | 'negative' | 'suggestion' | 'concern' | null;
  feedbackMethod: 'text' | 'voice' | 'video';
  suggestions: string | null;
  followUpNeeded: boolean;
  feedbackReplied: boolean;
  status: 'submitted' | 'Acknowledged' | 'Resolved' | 'Rejected' | 'replied';
  projectId: string | null;
  responderName: string | null;
  responderLocation: string | null;
  userId: string | null;
  otherFeedbackOn: string | null;
  organizationId?: string | null;
  allowedRoles?: Role[];
  createdAt?: Date;
  updatedAt?: Date;
}

export type FeedbackCreationAttributes = Optional<FeedbackAttributes, 'id' | 'mainMessage' | 'suggestions' | 'followUpNeeded' | 'status' | 'feedbackType' | 'projectId' | 'userId' | 'createdAt' | 'updatedAt' | 'organizationId'>;

class Feedback extends Model<FeedbackAttributes, FeedbackCreationAttributes> implements FeedbackAttributes {
  declare id: string;
  declare mainMessage: string | null;
  declare feedbackType: 'positive' | 'negative' | 'suggestion' | 'concern' | null;
  declare feedbackMethod: 'text' | 'voice' | 'video';
  declare suggestions: string | null;
  declare followUpNeeded: boolean;
  declare status: 'submitted' | 'Acknowledged' | 'Resolved' | 'Rejected' | 'replied';
  declare feedbackReplied: boolean;
  declare responderName: string | null;
  declare responderLocation: string | null;
  declare projectId: string | null;
  declare userId: string | null;
  declare otherFeedbackOn: string | null;
  declare organizationId?: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  // Document association mixins
  declare getDocuments: () => Promise<any[]>;
  declare addDocument: (document: any) => Promise<void>;
  declare removeDocument: (document: any) => Promise<void>;

  // Role association mixins - CORRECTED TYPES
  declare getAllowedRoles: BelongsToManyGetAssociationsMixin<Role>;
  declare addAllowedRole: BelongsToManyAddAssociationMixin<Role, string>;
  declare addAllowedRoles: BelongsToManyAddAssociationsMixin<Role, string>;
  declare setAllowedRoles: BelongsToManySetAssociationsMixin<Role, string>;
  declare removeAllowedRole: BelongsToManyRemoveAssociationMixin<Role, string>;
  declare removeAllowedRoles: BelongsToManyRemoveAssociationMixin<Role, string>;
  declare hasAllowedRole: (role: Role | string) => Promise<boolean>;
  declare hasAllowedRoles: (roles: (Role | string)[]) => Promise<boolean>;
  declare countAllowedRoles: () => Promise<number>;
  
  // Virtual field populated by includes
  declare readonly allowedRoles?: Role[];
}
Feedback.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  mainMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  feedbackType: {
    type: DataTypes.ENUM('positive', 'negative', 'suggestion', 'concern'),
    allowNull: true,
    field: 'feedback_type',
  },
  otherFeedbackOn: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'other_feedback_on',
  },
  feedbackMethod: {
    type: DataTypes.ENUM('text', 'voice', 'video'),
    allowNull: false,
    field: 'feedback_method',
  },
  suggestions: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  followUpNeeded: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'follow_up_needed',
  },
  feedbackReplied: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'feedback_replied',
  },
  responderName: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'responder_name',
  },
  responderLocation:{
    type: DataTypes.STRING,
    allowNull: true,
    field: 'responder_location',
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true, // Can be submitted anonymously
    field: 'user_id',
  },
  projectId: {
    type: DataTypes.UUID,
    allowNull: true, // Not all feedback is project-specific
    field: 'project_id',
  },
  organizationId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'organization_id',
    references: { model: 'organizations', key: 'id' },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  },
  status: {
    type: DataTypes.ENUM('submitted', 'Acknowledged', 'Resolved', 'Rejected', 'replied'),
    allowNull: false,
    defaultValue: 'submitted',
  },
}, {
  sequelize,
  modelName: 'Feedback',
  tableName: 'feedback',
  timestamps: true,
  indexes: []
});

export default Feedback;
