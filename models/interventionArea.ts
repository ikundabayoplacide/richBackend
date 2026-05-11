import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import Document from './document';
import Project from './project';
import type {
  HasManyGetAssociationsMixin,
  HasManyAddAssociationMixin,
  HasManyAddAssociationsMixin,
  HasManySetAssociationsMixin,
  HasManyCreateAssociationMixin,
  HasManyRemoveAssociationMixin,
} from 'sequelize';

export interface InterventionAreaAttributes {
  id: string;
  name: string;
  description?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type InterventionAreaCreationAttributes = Optional<
  InterventionAreaAttributes,
  'id' | 'description' | 'createdAt' | 'updatedAt'
>;

class InterventionArea extends Model<InterventionAreaAttributes, InterventionAreaCreationAttributes>
  implements InterventionAreaAttributes {
  declare id: string;
  declare name: string;
  declare description: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  // hasMany(Project) association mixins
  declare getProjects: HasManyGetAssociationsMixin<Project>;
  declare addProject: HasManyAddAssociationMixin<Project, string>;
  declare addProjects: HasManyAddAssociationsMixin<Project, string>;
  declare setProjects: HasManySetAssociationsMixin<Project, string>;
  declare createProject: HasManyCreateAssociationMixin<Project>;
  declare removeProject: HasManyRemoveAssociationMixin<Project, string>;
  declare readonly projects?: Project[];

  // hasMany(Document) association mixins for resources (PDF, Video, Audio)
  declare getDocuments: HasManyGetAssociationsMixin<Document>;
  declare addDocument: HasManyAddAssociationMixin<Document, string>;
  declare addDocuments: HasManyAddAssociationsMixin<Document, string>;
  declare setDocuments: HasManySetAssociationsMixin<Document, string>;
  declare createDocument: HasManyCreateAssociationMixin<Document>;
  declare removeDocument: HasManyRemoveAssociationMixin<Document, string>;
  declare readonly documents?: Document[];
}

InterventionArea.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { notEmpty: true },
      comment: 'Intervention Area Name (e.g., Nutrition Program, Education)',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Description of the intervention area',
    },
  },
  {
    sequelize,
    modelName: 'InterventionArea',
    tableName: 'intervention_areas',
    timestamps: true,
    indexes: []
  }
);

export default InterventionArea;