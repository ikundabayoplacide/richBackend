import { DataTypes, Model, Optional, type HasManyGetAssociationsMixin, type HasManyAddAssociationMixin, type HasManyAddAssociationsMixin, type HasManySetAssociationsMixin, type HasManyCreateAssociationMixin, type BelongsToGetAssociationMixin } from 'sequelize';
import sequelize from '../config/database';
import Question from './question';
import Survey from './survey';

export interface SectionAttributes {
  id: string;
  surveyId: string;
  title: string;
  description?: string | null;
  order?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type SectionCreationAttributes = Optional<SectionAttributes, 'id' | 'description' | 'order' | 'createdAt' | 'updatedAt'>;

class Section extends Model<SectionAttributes, SectionCreationAttributes> implements SectionAttributes {
  declare id: string;
  declare surveyId: string;
  declare title: string;
  declare description?: string | null;
  declare order?: number | null;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  // hasMany(Question) association mixins
  declare getQuestions: HasManyGetAssociationsMixin<Question>;
  declare addQuestion: HasManyAddAssociationMixin<Question, string>;
  declare addQuestions: HasManyAddAssociationsMixin<Question, string>;
  declare setQuestions: HasManySetAssociationsMixin<Question, string>;
  declare createQuestion: HasManyCreateAssociationMixin<Question>;
  declare readonly questions?: Question[];

  // BelongsTo (Section -> Survey) mixin
  declare getSurvey: BelongsToGetAssociationMixin<Survey>;
  declare readonly survey?: Survey | null;
}

Section.init(
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
      references: {
        model: 'surveys',
        key: 'id',
      },
      onDelete: 'CASCADE',
      comment: 'Foreign key to Survey',
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true },
      comment: 'Section title',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
      comment: 'Optional section description',
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: 'Order of section within survey',
    },
  },
  {
    sequelize,
    modelName: 'Section',
    tableName: 'sections',
    timestamps: true,
    indexes: []
  }
);

export default Section;