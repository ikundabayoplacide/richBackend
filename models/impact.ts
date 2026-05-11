import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import type {
  BelongsToGetAssociationMixin,
  BelongsToSetAssociationMixin,
  BelongsToCreateAssociationMixin,
} from 'sequelize';
import Settings from './settings';

export interface ImpactAttributes {
  id: string;
  settingsId: string;
  icon: string; // Icon name like 'FaUsers', 'FaChild', etc.
  value: string; // Display value like '2M+', '5,854+'
  label: string; // Description like 'Community Members Reached'
  color: string; // Tailwind color class like 'bg-blue-500'
  order: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ImpactCreationAttributes = Optional<
  ImpactAttributes,
  'id' | 'order' | 'isActive' | 'createdAt' | 'updatedAt'
>;

class Impact extends Model<ImpactAttributes, ImpactCreationAttributes> implements ImpactAttributes {
  declare id: string;
  declare settingsId: string;
  declare icon: string;
  declare value: string;
  declare label: string;
  declare color: string;
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

Impact.init(
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
    icon: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 50],
        isIn: [['FaUsers', 'FaChild', 'FaHeart', 'FaUserMd', 'FaGraduationCap', 'FaHandsHelping', 'FaBrain', 'FaShieldAlt', 'FaHospital', 'FaChurch', 'FaUserFriends', 'MdFamilyRestroom', 'MdVolunteerActivism', 'MdSchool', 'BiHealth', 'FiTrendingUp']],
      },
    },
    value: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 20],
      },
    },
    label: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
      },
    },
    color: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 50],
        isIn: [['bg-blue-500', 'bg-pink-500', 'bg-red-500', 'bg-green-500', 'bg-purple-500', 'bg-teal-500', 'bg-orange-500', 'bg-indigo-500', 'bg-cyan-500', 'bg-amber-500', 'bg-rose-500', 'bg-violet-500', 'bg-emerald-500', 'bg-lime-500', 'bg-sky-500', 'bg-yellow-500']],
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
    tableName: 'impacts',
    modelName: 'Impact',
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

export default Impact;
