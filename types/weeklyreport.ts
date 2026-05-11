import { Model, Optional } from 'sequelize';
export type ReportStatus = 'pending' | 'reviewed' | 'approved' | 'rejected' | 'seen';

export interface CompletedActivity {
  project: string;
  task: string;
}

export interface NextWeekTask {
  task: string;
  startDate: string;
}

export interface IWeeklyReportAttributes {
  id: string;
  userId: string;
  supervisorName: string;
  staffName: string;
  periodFrom: Date;
  periodTo: Date;
  hoursWorked: number;
  completedActivities: CompletedActivity[];
  challenges: string[];
  nextWeekTasks: NextWeekTask[];
  immediateIssues: string[];
  status: ReportStatus;
  reviewedBy?: string | null;
  reviewComments?: string | null;
  seenAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type IWeeklyReportCreationAttributes = Optional<
  IWeeklyReportAttributes,
  'id' | 'status' | 'createdAt' | 'updatedAt' | 'reviewedBy' | 'reviewComments' | 'seenAt'
>;

export interface IWeeklyReportInstance extends 
  Model<IWeeklyReportAttributes, IWeeklyReportCreationAttributes>,
  IWeeklyReportAttributes {
    // Add any instance methods here if needed
}