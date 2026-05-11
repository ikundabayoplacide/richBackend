import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// Expanded question types to match frontend
export type QuestionType =
  | 'single_choice'
  | 'multiple_choice'
  | 'text_input'
  | 'textarea'
  | 'file_upload'
  | 'rating'
  | 'linear_scale'

export interface QuestionAttributes {
  id: string;
  surveyId: string;

  type: QuestionType;
  title: string;
  description: string;
  required: boolean;

  // UI / frontend fields
  sectionId?: string | null;
  questionNumber?: number | null;

  // Choice / grid
  options?: string[] | null;
  rows?: string[] | null;
  columns?: string[] | null;
  hasOther?: boolean | null;

  // Text
  placeholder?: string | null;

  // File
  allowedTypes?: string[] | null;
  maxSize?: number | null; // MB

  // Rating
  maxRating?: number | null;
  ratingLabel?: string | null;

  // Linear scale
  minValue?: number | null;
  maxValue?: number | null;
  minLabel?: string | null;
  maxLabel?: string | null;

  // Date/time options
  includeTime?: boolean | null;
  format24?: boolean | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export type QuestionCreationAttributes = Optional<
  QuestionAttributes,
  | 'id'
  | 'options'
  | 'placeholder'
  | 'createdAt'
  | 'updatedAt'
  | 'rows'
  | 'columns'
  | 'allowedTypes'
  | 'maxSize'
  | 'maxRating'
  | 'ratingLabel'
  | 'minValue'
  | 'maxValue'
  | 'minLabel'
  | 'maxLabel'
  | 'includeTime'
  | 'format24'
  | 'sectionId'
  | 'questionNumber'
>;

class Question extends Model<QuestionAttributes, QuestionCreationAttributes> implements QuestionAttributes {
  declare id: string;
  declare surveyId: string;

  declare type: QuestionType;
  declare title: string;
  declare description: string;
  declare required: boolean;

  declare sectionId?: string | null;
  declare questionNumber?: number | null;

  declare options?: string[] | null;
  declare rows?: string[] | null;
  declare columns?: string[] | null;
  declare hasOther?: boolean | null;

  declare placeholder?: string | null;

  declare allowedTypes?: string[] | null;
  declare maxSize?: number | null;

  declare maxRating?: number | null;
  declare ratingLabel?: string | null;

  declare minValue?: number | null;
  declare maxValue?: number | null;
  declare minLabel?: string | null;
  declare maxLabel?: string | null;

  declare includeTime?: boolean | null;
  declare format24?: boolean | null;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Question.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    surveyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    type: {
      type: DataTypes.ENUM(
        'single_choice',
        'multiple_choice',
        'text_input',
        'textarea',
        'file_upload',
        'rating',
        'linear_scale',
      ),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
    },
    required: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // Section / ordering
    sectionId: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
    },
    questionNumber: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },

    // Choice/grid arrays
    options: {
      type: (sequelize.getDialect() === 'postgres' ? (DataTypes as any).JSONB : DataTypes.JSON),
      allowNull: true,
      defaultValue: null,
    },
    rows: {
      type: (sequelize.getDialect() === 'postgres' ? (DataTypes as any).JSONB : DataTypes.JSON),
      allowNull: true,
      defaultValue: null,
    },
    columns: {
      type: (sequelize.getDialect() === 'postgres' ? (DataTypes as any).JSONB : DataTypes.JSON),
      allowNull: true,
      defaultValue: null,
    },
    hasOther: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },

    // Text
    placeholder: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },

    // File upload
    allowedTypes: {
      type: (sequelize.getDialect() === 'postgres' ? (DataTypes as any).JSONB : DataTypes.JSON),
      allowNull: true,
      defaultValue: null,
    },
    maxSize: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },

    // Rating
    maxRating: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    ratingLabel: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },

    // Linear scale
    minValue: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    maxValue: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    minLabel: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    maxLabel: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },

    // Date/time extras
    includeTime: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    format24: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: 'Question',
    tableName: 'questions',
    timestamps: true,
    indexes: []
  },
);

export default Question;
