import { Controller, Get, Post, Put, Delete, Patch, Route, Tags, Body, Path, Query, Security, Request } from '@tsoa/runtime';
import { ServiceResponse } from '../utils/serviceResponse';
import { Op } from 'sequelize';
import db from '../models';
import sequelize from '../config/database';
import { createSystemLog } from '../utils/systemLog';
import { createNotificationForAdmins } from './notifications';
import { CompletedActivity, NextWeekTask, IWeeklyReportCreationAttributes } from '../types/weeklyreport';

interface WeeklyReportFormData {
  supervisorName: string;
  staffName: string;
  periodFrom: string;
  periodTo: string;
  hoursWorked: string;
  completedActivities: CompletedActivity[];
  challenges: string[];
  nextWeekTasks: NextWeekTask[];
  immediateIssues: string[];
}

@Route('api/weeklyreports')
@Tags('WeeklyReports')
export class WeeklyReportController extends Controller {
  @Security('jwt', ['weeklyreport:read'])
  @Get('/')
  public async listWeeklyReports(
    @Request() req: { user: { id: string } },
    @Query() page: number = 1,
    @Query() limit: number = 25,
    @Query() status?: 'pending' | 'reviewed' | 'approved' | 'rejected' | 'seen',
    @Query() userId?: string,
    @Query() startDate?: string,
    @Query() endDate?: string
  ): Promise<ServiceResponse<any>> {
    const offset = (Math.max(1, page) - 1) * Math.max(1, limit);
    const where: any = {};

    if (status) where.status = status;
    if (userId) where.userId = userId;

    if (startDate || endDate) {
      where.periodFrom = {};
      if (startDate) {
        const s = new Date(startDate);
        if (!isNaN(s.getTime())) where.periodFrom[Op.gte] = s;
      }
      if (endDate) {
        const e = new Date(endDate);
        if (!isNaN(e.getTime())) where.periodFrom[Op.lte] = e;
      }
    }

    try {
      const { rows, count } = await db.WeeklyReport.findAndCountAll({
        where,
        offset,
        limit: Math.max(1, limit),
        order: [['periodFrom', 'DESC']],
        include: [
          { model: db.User, as: 'user', attributes: ['id', 'name', 'email'], required: false },
          { model: db.User, as: 'reviewer', attributes: ['id', 'name', 'email'], required: false }
        ]
      });

      return ServiceResponse.success('Weekly reports fetched successfully', { reports: rows, total: count });
    } catch (error) {
      return ServiceResponse.failure('Error fetching weekly reports', error);
    }
  }

  @Security('jwt', ['weeklyreport:create'])
  @Post('/')
  public async createWeeklyReport(
    @Request() req: any,
    @Body() body: WeeklyReportFormData
  ): Promise<ServiceResponse<any | null>> {
    const tx = await sequelize.transaction();
    try {
      if (!body.supervisorName || !body.staffName || !body.periodFrom || !body.periodTo || !body.hoursWorked) {
        return ServiceResponse.failure('Missing required fields', null, 400);
      }

      const completedActivities = body.completedActivities.filter(
        activity => activity.project.trim() && activity.task.trim()
      );
      const challenges = body.challenges.filter(challenge => challenge.trim());
      const nextWeekTasks = body.nextWeekTasks.filter(
        task => task.task.trim() && task.startDate
      );
      const immediateIssues = body.immediateIssues.filter(issue => issue.trim());

      const reportData: IWeeklyReportCreationAttributes = {
        userId: req.user.id,
        supervisorName: body.supervisorName.trim(),
        staffName: body.staffName.trim(),
        periodFrom: new Date(body.periodFrom),
        periodTo: new Date(body.periodTo),
        hoursWorked: parseInt(body.hoursWorked),
        completedActivities,
        challenges,
        nextWeekTasks,
        immediateIssues,
        status: 'pending'
      };

      const report = await db.WeeklyReport.create(reportData, { transaction: tx });

      await tx.commit();
      await createSystemLog(req, 'created_weeklyreport', 'WeeklyReport', report.id, { 
        periodFrom: report.periodFrom,
        staffName: report.staffName 
      });

      const result = await db.WeeklyReport.findByPk(report.id, {
        include: [
          { model: db.User, as: 'user', attributes: ['id', 'name', 'email'], required: false }
        ]
      });

      // Create notification for admins about new weekly report
      try {
        console.log('Creating notification for new weekly report:', report.id);
        const notifications = await createNotificationForAdmins(
          'system',
          'New Weekly Report Submitted',
          `${report.staffName} has submitted a weekly report for ${new Date(report.periodFrom).toLocaleDateString()} - ${new Date(report.periodTo).toLocaleDateString()}`,
          {
            icon: 'HiOutlineDocumentReport',
            link: `/dashboard/weekly-reports/${report.id}`,
            entityId: report.id,
            entityType: 'WeeklyReport',
            createdBy: req.user.id,
            organizationId: (req.user as any).primaryOrganizationId,
          }
        );
        console.log('Weekly report notifications created successfully:', notifications.length);
      } catch (error) {
        console.error('Failed to create weekly report notification:', error);
        // Don't fail the report creation if notification fails
      }

      this.setStatus(201);
      return ServiceResponse.success('Weekly report created successfully', result, 201);
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  @Security('jwt', ['weeklyreport:read'])
  @Get('/{id}')
  public async getWeeklyReport(@Path() id: string): Promise<ServiceResponse<any | null>> {
    const report = await db.WeeklyReport.findByPk(id, {
      include: [
        { model: db.User, as: 'user', attributes: ['id', 'name', 'email'], required: false },
        { model: db.User, as: 'reviewer', attributes: ['id', 'name', 'email'], required: false }
      ]
    });
    
    if (!report) {
      return ServiceResponse.failure('Weekly report not found', null, 404);
    }
    
    return ServiceResponse.success('Weekly report retrieved successfully', report);
  }

  @Security('jwt', ['weeklyreport:update'])
  @Put('/{id}')
  public async updateWeeklyReport(
    @Request() req: any,
    @Path() id: string,
    @Body() body: Partial<WeeklyReportFormData> & {
      status?: 'pending' | 'reviewed' | 'approved' | 'rejected' | 'seen';
      reviewComments?: string;
    }
  ): Promise<ServiceResponse<any | null>> {
    const report = await db.WeeklyReport.findByPk(id);
    if (!report) {
      return ServiceResponse.failure('Weekly report not found', null, 404);
    }

    // Check if user is trying to change status
    if (body.status && body.status !== 'pending') {
      const isAdmin = req.user.roles?.some((role: any) => 
        role.name === 'admin' || role.name === 'super-admin'
      );

      if (!isAdmin) {
        return ServiceResponse.failure('Only administrators can change report status', null, 403);
      }
    }

    const tx = await sequelize.transaction();
    try {
      if (body.supervisorName) report.supervisorName = body.supervisorName.trim();
      if (body.staffName) report.staffName = body.staffName.trim();
      if (body.periodFrom) report.periodFrom = new Date(body.periodFrom);
      if (body.periodTo) report.periodTo = new Date(body.periodTo);
      if (body.hoursWorked) report.hoursWorked = parseInt(body.hoursWorked);

      if (body.completedActivities) {
        report.completedActivities = body.completedActivities.filter(
          activity => activity.project.trim() && activity.task.trim()
        );
      }
      if (body.challenges) {
        report.challenges = body.challenges.filter(challenge => challenge.trim());
      }
      if (body.nextWeekTasks) {
        report.nextWeekTasks = body.nextWeekTasks.filter(
          task => task.task.trim() && task.startDate
        );
      }
      if (body.immediateIssues) {
        report.immediateIssues = body.immediateIssues.filter(issue => issue.trim());
      }

      if (body.status) {
        report.status = body.status;
        if (body.status !== 'pending') {
          report.reviewedBy = req.user.id;
        }
      }
      if (body.reviewComments !== undefined) {
        report.reviewComments = body.reviewComments;
      }

      await report.save({ transaction: tx });
      await tx.commit();

      await createSystemLog(req, 'updated_weeklyreport', 'WeeklyReport', report.id, {
        periodFrom: report.periodFrom,
        staffName: report.staffName
      });

      const result = await db.WeeklyReport.findByPk(report.id, {
        include: [
          { model: db.User, as: 'user', attributes: ['id', 'name', 'email'], required: false },
          { model: db.User, as: 'reviewer', attributes: ['id', 'name', 'email'], required: false }
        ]
      });

      return ServiceResponse.success('Weekly report updated successfully', result);
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  @Security('jwt', ['weeklyreport:delete'])
  @Delete('/{id}')
  public async deleteWeeklyReport(
    @Request() req: any,
    @Path() id: string
  ): Promise<ServiceResponse<null>> {
    const report = await db.WeeklyReport.findByPk(id);
    if (!report) {
      return ServiceResponse.failure('Weekly report not found', null, 404);
    }

    const tx = await sequelize.transaction();
    try {
      await report.destroy({ transaction: tx });
      await tx.commit();

      await createSystemLog(req, 'deleted_weeklyreport', 'WeeklyReport', report.id, {
        periodFrom: report.periodFrom,
        staffName: report.staffName
      });

      return ServiceResponse.success('Weekly report deleted successfully', null);
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  @Security('jwt', ['weeklyreport:read'])
  @Get('/user/{userId}')
  public async getUserWeeklyReports(
    @Path() userId: string,
    @Query() page: number = 1,
    @Query() limit: number = 25,
    @Query() status?: 'pending' | 'reviewed' | 'approved' | 'rejected' | 'seen'
  ): Promise<ServiceResponse<any>> {
    const offset = (Math.max(1, page) - 1) * Math.max(1, limit);
    const where: any = { userId };

    if (status) where.status = status;

    try {
      const { rows, count } = await db.WeeklyReport.findAndCountAll({
        where,
        offset,
        limit: Math.max(1, limit),
        order: [['periodFrom', 'DESC']],
        include: [
          { model: db.User, as: 'user', attributes: ['id', 'name', 'email'], required: false },
          { model: db.User, as: 'reviewer', attributes: ['id', 'name', 'email'], required: false }
        ]
      });

      return ServiceResponse.success('User weekly reports fetched successfully', { reports: rows, total: count });
    } catch (error) {
      return ServiceResponse.failure('Error fetching user weekly reports', error);
    }
  }

  @Security('jwt', ['weeklyreport:read'])
  @Put('/{id}/review')
  public async markAsReviewed(
    @Request() req: any,
    @Path() id: string
  ): Promise<ServiceResponse<any | null>> {
    // Check if user is admin or super-admin
    const isAdmin = req.user.roles?.some((role: any) => 
      role.name === 'admin' || role.name === 'super-admin'
    );

    if (!isAdmin) {
      return ServiceResponse.failure('Only administrators can mark reports as reviewed', null, 403);
    }

    const report = await db.WeeklyReport.findByPk(id);
    if (!report) {
      return ServiceResponse.failure('Weekly report not found', null, 404);
    }

    const tx = await sequelize.transaction();
    try {
      report.status = 'reviewed';
      report.reviewedBy = req.user.id;

      await report.save({ transaction: tx });
      await tx.commit();

      await createSystemLog(req, 'reviewed_weeklyreport', 'WeeklyReport', report.id, {
        periodFrom: report.periodFrom,
        staffName: report.staffName
      });

      const result = await db.WeeklyReport.findByPk(report.id, {
        include: [
          { model: db.User, as: 'user', attributes: ['id', 'name', 'email'], required: false },
          { model: db.User, as: 'reviewer', attributes: ['id', 'name', 'email'], required: false }
        ]
      });

      return ServiceResponse.success('Weekly report marked as reviewed', result);
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  @Security('jwt', ['weeklyreport:read'])
  @Put('/{id}/seen')
  public async markAsSeen(
    @Request() req: any,
    @Path() id: string
  ): Promise<ServiceResponse<any | null>> {
    const isAdmin = req.user.roles?.some((role: any) => 
      role.name === 'admin' || role.name === 'super_admin' || role.name === 'super-admin'
    );

    const report = await db.WeeklyReport.findByPk(id);
    if (!report) {
      return ServiceResponse.failure('Weekly report not found', null, 404);
    }

    if (isAdmin) {
      report.seenAt = new Date();
      report.status="seen";
      await report.save();
    }

    const result = await db.WeeklyReport.findByPk(report.id, {
      include: [
        { model: db.User, as: 'user', attributes: ['id', 'name', 'email'], required: false },
        { model: db.User, as: 'reviewer', attributes: ['id', 'name', 'email'], required: false }
      ]
    });

    return ServiceResponse.success('Weekly report marked as seen', result);
  }
}