import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface ResponseAttributes {
  id: string;
  surveyId: string;
  userId?: string | null; // nullable for anonymous
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

