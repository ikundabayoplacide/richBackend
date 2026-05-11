import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import Document from './document';
import InterventionArea from './interventionArea';
import type {
  HasManyGetAssociationsMixin,
  HasManyAddAssociationMixin,
  HasManyAddAssociationsMixin,
  HasManySetAssociationsMixin,
  HasManyCreateAssociationMixin,
} from 'sequelize';
import type { BelongsToGetAssociationMixin } from 'sequelize';

export type ProjectStatus = 'pending' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled'|'active';

export interface ProjectAttributes {
  id: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  targetGroup: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  donorIds?: string[] | null;
  geographicArea: string | null;
  interventionAreaId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  userId?: string;
}

export type ProjectCreationAttributes = Optional<
  ProjectAttributes,
  'id' | 'status' | 'targetGroup' | 'startDate' | 'endDate' | 'geographicArea' | 'createdAt' | 'updatedAt'
>;

class Project extends Model<ProjectAttributes, ProjectCreationAttributes> implements ProjectAttributes {
  declare id: string;
  declare name: string;
  declare description: string | null;
  declare status: ProjectStatus;
  declare targetGroup: string | null;
  declare startDate: Date | null;
  declare endDate: Date | null;
  declare donorIds?: string[] | null;
  declare geographicArea: string | null;
  declare interventionAreaId?: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  // hasMany(Document) association mixins
  declare getDocuments: HasManyGetAssociationsMixin<Document>;
  declare addDocument: HasManyAddAssociationMixin<Document, string>;
  declare addDocuments: HasManyAddAssociationsMixin<Document, string>;
  declare setDocuments: HasManySetAssociationsMixin<Document, string>;
  declare createDocument: HasManyCreateAssociationMixin<Document>;
  declare readonly documents?: Document[];

  // belongsTo(InterventionArea) association mixins
  declare getInterventionArea: BelongsToGetAssociationMixin<InterventionArea>;
  declare readonly interventionArea?: InterventionArea;
}

Project.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    interventionAreaId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Foreign key to intervention area',
    },
    donorIds: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of donor organization IDs',
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true },
      comment: 'Project Name',
    },
    status: {
      type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'on_hold', 'cancelled', 'active'),
      allowNull: false,
      defaultValue: 'pending',
    },
    targetGroup: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Project description',
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Project start date',
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Project end date',
    },
    geographicArea: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Geographic area where the project takes place',
    },
  },
  {
    sequelize,
    modelName: 'Project',
    tableName: 'projects',
    timestamps: true,
    indexes: []
  }
);

export default Project;
