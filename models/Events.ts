// models/Event.ts
import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface EventAttributes {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startDate: Date;
  endDate: Date;
  interventionAreaId: string;
  bannerImage?: string | null;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled'|'active';
  state?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type EventCreationAttributes = Optional<
  EventAttributes,
  'id' | 'description' | 'location' | 'bannerImage' | 'status' | 'createdAt' | 'updatedAt'
>;

class Event extends Model<EventAttributes, EventCreationAttributes> implements EventAttributes {
  declare id: string;
  declare title: string;
  declare description?: string | null;
  declare location?: string | null;
  declare startDate: Date;
  declare endDate: Date;
  declare interventionAreaId: string;
  declare bannerImage?: string | null;
  declare status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  declare state?: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Event.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
    },
  interventionAreaId: {
  type: DataTypes.UUID,
  allowNull: false,
  comment: 'Foreign key to InterventionArea.id',
},
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Title of the event',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Detailed description of the event',
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Location where the event will be held',
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Event start date and time',
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Event end date and time',
    },
    bannerImage: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Banner image URL for event display',
    },
    status: {
      type: DataTypes.ENUM('upcoming', 'ongoing', 'completed', 'cancelled',),
      allowNull: false,
      defaultValue: 'upcoming',
      comment: 'Current status of the event',
    },
    state:{
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'State of the event',
    }
  },
  {
    sequelize,
    modelName: 'Event',
    tableName: 'events',
    timestamps: true,
    indexes: []
  }
);

export default Event;
