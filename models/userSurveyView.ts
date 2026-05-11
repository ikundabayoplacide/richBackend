import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

export interface IUserSurveyViewAttributes {
  id: string;
  userId: string;
  surveyId: string;
  viewedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class UserSurveyView extends Model<IUserSurveyViewAttributes> implements IUserSurveyViewAttributes {
  declare id: string;
  declare userId: string;
  declare surveyId: string;
  declare viewedAt: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

UserSurveyView.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    surveyId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'surveys',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    viewedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'user_survey_views',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'survey_id'],
      },
      {
        fields: ['user_id'],
      },
      {
        fields: ['survey_id'],
      },
    ],
  }
);

export default UserSurveyView;
