import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import type {
  HasManyGetAssociationsMixin,
  HasManyAddAssociationMixin,
  HasManyAddAssociationsMixin,
  HasManySetAssociationsMixin,
  HasManyCreateAssociationMixin,
} from 'sequelize';
import Slideshow from './slideshow';
import Impact from './impact';

export interface SettingsAttributes {
  id: string;
  websiteName: string;
  websiteDescription?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  socialLinks?: object | null; // JSON object for social media links
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type SettingsCreationAttributes = Optional<
  SettingsAttributes,
  'id' | 'websiteDescription' | 'logoUrl' | 'faviconUrl' | 'primaryColor' | 'secondaryColor' | 
  'contactEmail' | 'contactPhone' | 'address' | 'socialLinks' | 'metaTitle' | 'metaDescription' | 
  'metaKeywords' | 'isActive' | 'createdAt' | 'updatedAt'
>;

class Settings extends Model<SettingsAttributes, SettingsCreationAttributes> implements SettingsAttributes {
  declare id: string;
  declare websiteName: string;
  declare websiteDescription: string | null;
  declare logoUrl: string | null;
  declare faviconUrl: string | null;
  declare primaryColor: string | null;
  declare secondaryColor: string | null;
  declare contactEmail: string | null;
  declare contactPhone: string | null;
  declare address: string | null;
  declare socialLinks: object | null;
  declare metaTitle: string | null;
  declare metaDescription: string | null;
  declare metaKeywords: string | null;
  declare isActive: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  // hasMany(Slideshow) association mixins
  declare getSlideshows: HasManyGetAssociationsMixin<Slideshow>;
  declare addSlideshow: HasManyAddAssociationMixin<Slideshow, string>;
  declare addSlideshows: HasManyAddAssociationsMixin<Slideshow, string>;
  declare setSlideshows: HasManySetAssociationsMixin<Slideshow, string>;
  declare createSlideshow: HasManyCreateAssociationMixin<Slideshow>;

  // hasMany(Impact) association mixins
  declare getImpacts: HasManyGetAssociationsMixin<Impact>;
  declare addImpact: HasManyAddAssociationMixin<Impact, string>;
  declare addImpacts: HasManyAddAssociationsMixin<Impact, string>;
  declare setImpacts: HasManySetAssociationsMixin<Impact, string>;
  declare createImpact: HasManyCreateAssociationMixin<Impact>;

  // Virtual fields for associations
  declare readonly slideshows?: Slideshow[];
  declare readonly impacts?: Impact[];
}

Settings.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    websiteName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
      },
    },
    websiteDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    logoUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },
    faviconUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },
    primaryColor: {
      type: DataTypes.STRING(7), // For hex colors like #ffffff
      allowNull: true,
      validate: {
        is: /^#[0-9A-F]{6}$/i, // Hex color validation
      },
    },
    secondaryColor: {
      type: DataTypes.STRING(7),
      allowNull: true,
      validate: {
        is: /^#[0-9A-F]{6}$/i,
      },
    },
    contactEmail: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true,
      },
    },
    contactPhone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    socialLinks: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
    metaTitle: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    metaDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metaKeywords: {
      type: DataTypes.TEXT,
      allowNull: true,
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
    tableName: 'settings',
    modelName: 'Settings',
    timestamps: true,
    indexes: [
      {
        fields: ['isActive'],
      },
      {
        fields: ['websiteName'],
      },
    ],
  }
);

export default Settings;
