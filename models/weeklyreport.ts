import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';
import { IWeeklyReportAttributes, IWeeklyReportCreationAttributes, CompletedActivity, NextWeekTask } from '../types/weeklyreport';

export class WeeklyReport extends Model<IWeeklyReportAttributes, IWeeklyReportCreationAttributes> implements IWeeklyReportAttributes {
  declare id: string;
  declare userId: string;
  declare supervisorName: string;
  declare staffName: string;
  declare periodFrom: Date;
  declare periodTo: Date;
  declare hoursWorked: number;
  declare completedActivities: CompletedActivity[];
  declare challenges: string[];
  declare nextWeekTasks: NextWeekTask[];
  declare immediateIssues: string[];
  declare status: 'pending' | 'reviewed' | 'approved' | 'rejected' | 'seen';
  declare reviewedBy?: string | null;
  declare reviewComments?: string | null;
  declare seenAt?: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

WeeklyReport.init(
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
      comment: 'Foreign key to User',
    },
    supervisorName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Name of the supervisor',
    },
    staffName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Name of the staff member',
    },
    periodFrom: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: 'Start date of the reporting period',
    },
    periodTo: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: 'End date of the reporting period',
    },
    hoursWorked: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Total hours worked during the week',
    },
    completedActivities: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      comment: 'Array of completed activities with project and task details',
    },
    challenges: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      comment: 'Array of challenges faced during the week',
    },
    nextWeekTasks: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      comment: 'Array of tasks planned for next week with start dates',
    },
    immediateIssues: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      comment: 'Array of issues requiring immediate attention',
    },
    status: {
      type: DataTypes.ENUM('pending', 'reviewed', 'approved', 'rejected', 'seen'),
      allowNull: false,
      defaultValue: 'pending',
      comment: 'Status of the weekly report',
    },
    reviewedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'User who reviewed the report',
    },
    reviewComments: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Comments from the reviewer',
    },
    seenAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp when admin/super admin viewed the report',
    },
  },
  {
    sequelize,
    tableName: 'weekly_reports',
    timestamps: true,
    underscored: true,
    comment: 'Table for storing weekly reports submitted by users',
  }
);