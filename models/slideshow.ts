import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import type {
  BelongsToGetAssociationMixin,
  BelongsToSetAssociationMixin,
  BelongsToCreateAssociationMixin,
} from 'sequelize';
import Settings from './settings';

export interface SlideshowAttributes {
  id: string;
  settingsId: string;
  imageUrl: string;
  altText: string;
  statisticsTitle: string;
  statisticsLabel: string;
  statisticsValue: string;
  order: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type SlideshowCreationAttributes = Optional<
  SlideshowAttributes,
  'id' | 'order' | 'isActive' | 'createdAt' | 'updatedAt'
>;

class Slideshow extends Model<SlideshowAttributes, SlideshowCreationAttributes> implements SlideshowAttributes {
  declare id: string;
  declare settingsId: string;
  declare imageUrl: string;
  declare altText: string;
  declare statisticsTitle: string;
  declare statisticsLabel: string;
  declare statisticsValue: string;
  declare order: number;
  declare isActive: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  // belongsTo(Settings) association mixins
  declare getSettings: BelongsToGetAssociationMixin<Settings>;
  declare setSettings: BelongsToSetAssociationMixin<Settings, string>;
  declare createSettings: BelongsToCreateAssociationMixin<Settings>;

  // Virtual fields for associations
  declare readonly settings?: Settings;
}

Slideshow.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    settingsId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'settings',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    imageUrl: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        isUrl: true,
      },
    },
    altText: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
      },
    },
    statisticsTitle: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    statisticsLabel: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
      },
    },
    statisticsValue: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 50],
      },
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'slideshows',
    modelName: 'Slideshow',
    timestamps: true,
    indexes: [
      {
        fields: ['settingsId'],
      },
      {
        fields: ['order'],
      },
      {
        fields: ['isActive'],
      },
      {
        fields: ['settingsId', 'order'],
        unique: false,
      },
    ],
  }
);

export default Slideshow;
