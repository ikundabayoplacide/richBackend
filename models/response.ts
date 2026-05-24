import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface ResponseAttributes {
  id: string;
  surveyId: string;
  userId?: string | null; // nullable for anonymous
  responderNId?: string | null;
  responderName?: string | null;
  responderDistrict?: string | null;
  responderSector?: string | null;
  responderCell?: string | null;
  responderVillage?: string | null;
  responderHealthCenter?: string | null;
  userReportCounter?: number;
  responderLocation?: string | null; // GPS coordinates
  locationName?: string | null; // Human-readable location name
  createdAt?: Date;
  updatedAt?: Date;
}

export type ResponseCreationAttributes = Optional<
  ResponseAttributes,
  'id' | 'userId' | 'createdAt' | 'updatedAt'
>;

class Response extends Model<ResponseAttributes, ResponseCreationAttributes> implements ResponseAttributes {
  declare id: string;
  declare surveyId: string;
  declare userId?: string | null;
  declare responderNId?: string | null;
  declare responderName?: string | null;
  declare responderDistrict?: string | null;
  declare responderSector?: string | null;
  declare responderCell?: string | null;
  declare responderVillage?: string | null;
  declare responderHealthCenter?: string | null;
  declare userReportCounter?: number;
  declare responderLocation?: string | null;
  declare locationName?: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Response.init(
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
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
    },
    responderNId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    responderName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    responderDistrict: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    responderSector: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    responderCell: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    responderVillage: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    responderHealthCenter: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    userReportCounter: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: 'Counter for user report submissions',
    },
    responderLocation: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'GPS coordinates or location string of the responder',
    },
    locationName: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Human-readable location name from reverse geocoding',
    },
  },
  {
    sequelize,
    modelName: 'Response',
    tableName: 'responses',
    timestamps: true,
    indexes: []
  }
);

export default Response;

