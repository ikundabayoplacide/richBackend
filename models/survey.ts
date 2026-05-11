import { DataTypes, Model, Optional, type HasManyGetAssociationsMixin, type HasManyAddAssociationMixin, type HasManyAddAssociationsMixin, type HasManySetAssociationsMixin, type HasManyCreateAssociationMixin, type BelongsToManyGetAssociationsMixin, type BelongsToManyAddAssociationMixin, type BelongsToManyAddAssociationsMixin, type BelongsToManySetAssociationsMixin, type BelongsToManyRemoveAssociationMixin, type BelongsToGetAssociationMixin } from 'sequelize';
import sequelize from '../config/database';
import Question from './question';
import Answer from './answer';
import Response from './response';
import Role from './role';
import Section from './section';
import Organization from './organization';
import { User } from './users';

export type QuestionType = 'single_choice' | 'multiple_choice' | 'text_input' | 'textarea';

export interface BaseQuestion {
  id: number;
  type: QuestionType;
  title: string;
  description: string;
  required: boolean;
}

export interface ChoiceQuestion extends BaseQuestion {
  type: 'single_choice' | 'multiple_choice';
  options: string[];
  placeholder?: never;
}

export interface TextQuestion extends BaseQuestion {
  type: 'text_input' | 'textarea';
  options?: never;
  placeholder: string;
}

export type AuthoredQuestion = ChoiceQuestion | TextQuestion;

export interface SurveyAttributes {
  id: string;
  title: string;
  description: string;
  projectId?: string | null;
  estimatedTime: string; // keep as string per UI (e.g., "15")
  status: 'draft' | 'active' | 'paused' | 'archived';
  surveyType?: 'general' | 'report-form' | 'rapid-enquiry';
  createdBy?: string | null;
  organizationId?: string | null; // NEW: organization association
  // New: when survey opens and closes
  startAt: Date;
  endAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type SurveyCreationAttributes = Optional<SurveyAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class Survey extends Model<SurveyAttributes, SurveyCreationAttributes> implements SurveyAttributes {
  declare id: string;
  declare title: string;
  declare description: string;
  declare projectId?: string | null;
  declare estimatedTime: string;
  declare status: 'draft' | 'active' | 'paused' | 'archived';
  declare surveyType?: 'general' | 'report-form' | 'rapid-enquiry';
  declare createdBy?: string | null;
  declare organizationId?: string | null;
  declare startAt: Date;
  declare endAt: Date;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  // hasMany(Question) association mixins
  declare getQuestionItems: HasManyGetAssociationsMixin<Question>;
  declare addQuestionItem: HasManyAddAssociationMixin<Question, string>;
  declare addQuestionItems: HasManyAddAssociationsMixin<Question, string>;
  declare setQuestionItems: HasManySetAssociationsMixin<Question, string>;
  declare createQuestionItem: HasManyCreateAssociationMixin<Question>;
  declare readonly questionItems?: Question[];

  // hasMany(Answer) association mixins
  declare getAnswers: HasManyGetAssociationsMixin<Answer>;
  declare addAnswer: HasManyAddAssociationMixin<Answer, string>;
  declare addAnswers: HasManyAddAssociationsMixin<Answer, string>;
  declare setAnswers: HasManySetAssociationsMixin<Answer, string>;
  declare createAnswer: HasManyCreateAssociationMixin<Answer>;
  declare readonly answers?: Answer[];

  // hasMany(Response) association mixins
  declare getResponses: HasManyGetAssociationsMixin<Response>;
  declare addResponse: HasManyAddAssociationMixin<Response, string>;
  declare addResponses: HasManyAddAssociationsMixin<Response, string>;
  declare setResponses: HasManySetAssociationsMixin<Response, string>;
  declare createResponse: HasManyCreateAssociationMixin<Response>;
  declare readonly responses?: Response[];

  // Many-to-many (Survey <-> Role) mixins for allowedRoles
  declare getAllowedRoles: BelongsToManyGetAssociationsMixin<Role>;
  declare addAllowedRole: BelongsToManyAddAssociationMixin<Role, string>;
  declare addAllowedRoles: BelongsToManyAddAssociationsMixin<Role, string>;
  declare setAllowedRoles: BelongsToManySetAssociationsMixin<Role, string>;
  declare removeAllowedRole: BelongsToManyRemoveAssociationMixin<Role, string>;
  declare readonly allowedRoles?: Role[];

  // hasMany(Section) association mixins
  declare getSections: HasManyGetAssociationsMixin<Section>;
  declare addSection: HasManyAddAssociationMixin<Section, string>;
  declare addSections: HasManyAddAssociationsMixin<Section, string>;
  declare setSections: HasManySetAssociationsMixin<Section, string>;
  declare createSection: HasManyCreateAssociationMixin<Section>;
  declare readonly sections?: Section[];

  // BelongsTo (Survey -> User) mixin for creator
  declare getCreator: BelongsToGetAssociationMixin<User>;
  declare readonly creator?: User | null;

  // BelongsTo (Survey -> Organization) mixin
  declare getOrganization: BelongsToGetAssociationMixin<Organization>;
  declare readonly organization?: Organization | null;
}

Survey.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true },
      comment: 'Survey Title',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
    },
    projectId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Project this survey belongs to',
      references: {
        model: 'projects',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    estimatedTime: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '0',
      comment: 'Estimated time in minutes (string to match UI)',
    },
    // required timestamps for survey availability window
    startAt: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'When survey becomes available (required)',
    },
    endAt: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'When survey closes (required)',
    },
    surveyType: {
      type: DataTypes.ENUM('general', 'report-form', 'rapid-enquiry'),
      defaultValue: 'general',
      allowNull: false,
      comment: 'Type of survey',
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'SET NULL',
      comment: 'User who created this survey',
    },
    organizationId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'organizations',
        key: 'id',
      },
      onDelete: 'SET NULL',
      comment: 'Organization this survey belongs to',
    },
    status: {
      type: DataTypes.ENUM('draft', 'active', 'paused', 'archived'),
      allowNull: false,
      defaultValue: 'draft',
      comment: 'Survey status lifecycle',
    },

  },
  {
    sequelize,
    modelName: 'Survey',
    tableName: 'surveys',
    timestamps: true,
    indexes:[]
  }
);

export default Survey;
