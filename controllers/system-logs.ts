import { Controller, Get, Post, Delete, Route, Tags, Response, SuccessResponse, Body, Path, Query, Security, Request } from '@tsoa/runtime';
import { ServiceResponse } from '../utils/serviceResponse';
import SystemLog from '../models/systemLog';
import { asyncCatch } from '../middlewares/errorHandler';
import { Op } from 'sequelize';
import db from '../models';

@Route('api/system-logs')
@Tags('System Logs')
export class SystemLogController extends Controller {
  /**
   * List system logs with optional filters and pagination
   */
  @Security('jwt', ['system_log:read'])
  @Get('/')
  @asyncCatch
  public async listLogs(
    @Query() page: number = 1,
    @Query() limit: number = 25,
    @Query() userId?: string,
    @Query() action?: string,
    @Query() resourceType?: string,
    @Query() startDate?: string,
    @Query() endDate?: string
  ): Promise<ServiceResponse<any[]>> {
    const offset = (Math.max(1, page) - 1) * Math.max(1, limit);
    const where: any = {};

    if (userId) where.userId = userId;
    if (action) where.action = { [Op.iLike]: `%${action}%` };
    if (resourceType) where.resourceType = resourceType;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const s = new Date(startDate);
        if (!isNaN(s.getTime())) where.createdAt[Op.gte] = s;
      }
      if (endDate) {
        const e = new Date(endDate);
        if (!isNaN(e.getTime())) where.createdAt[Op.lte] = e;
      }
    }

    const { count, rows } = await SystemLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: Math.max(1, limit),
      offset,
      include: [
        {
          model: db.User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'phone'],
          required: false
        }
      ]
    });

    // Process logs to add resource names and user names
    const processedLogs = rows.map((log: any) => {
      const logData = log.toJSON();

      // Extract resource name
      const resourceName = logData.meta?.title ||
        logData.meta?.name ||
        logData.resourceId ||
        '';

      // Extract user name
      const userName = (logData as any).user?.name || '';
      console.log('Log user data:', (logData as any).user, 'userName:', userName);

      return {
        ...logData,
        resourceName,
        userName
      };
    });

    return ServiceResponse.success('System logs retrieved successfully', processedLogs, 200, { total: count, page, totalPages: Math.ceil(count / limit) });
  }

  /**
   * Get a single system log by id
   */
  @Security('jwt', ['system_log:read'])
  @Get('/{id}')
  @asyncCatch
  @Response<ServiceResponse<null>>(404, 'System log not found')
  public async getLogById(@Path() id: string): Promise<ServiceResponse<any | null>> {
    const log = await SystemLog.findByPk(id, {
      include: [
        {
          model: db.User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'phone'],
          required: false
        }
      ]
    });
    if (!log) return ServiceResponse.failure('System log not found', null, 404);

    const logData = log.toJSON();

    // Extract resource name and user name
    const resourceName = logData.meta?.title ||
      logData.meta?.name ||
      logData.resourceId ||
      '';

    const userName = (logData as any).user?.name || '';
    console.log('Single log user data:', (logData as any).user, 'userName:', userName);

    const processedLog = {
      ...logData,
      resourceName,
      userName
    };

    return ServiceResponse.success('System log retrieved successfully', processedLog);
  }

  /**
   * Delete a system log (hard delete)
   */
  @Security('jwt')
  @Delete('/{id}')
  @SuccessResponse(204, 'No Content')
  @asyncCatch
  public async deleteLog(@Path() id: string): Promise<ServiceResponse<null>> {
    const log = await SystemLog.findByPk(id);
    if (!log) return ServiceResponse.failure('System log not found', null, 404);
    await log.destroy();
    this.setStatus(204);
    return ServiceResponse.success('System log deleted successfully', null, 204);
  }

  /**
   * (Optional) Create a system log via API - marked as internal usage; protected by permission
   * Accepts minimal payload and stores meta as provided.
   */
  @Security('jwt', ['system_log:create'])
  @Post('/')
  @asyncCatch
  public async createLog(
    @Request() req: any,
    @Body() body: {
      action: string;
      resourceType?: string | null;
      resourceId?: string | null;
      meta?: any | null;
    }
  ): Promise<ServiceResponse<any | null>> {
    const userId = req?.user?.id ?? null;
    const log = await SystemLog.create({
      userId,
      action: body.action,
      resourceType: body.resourceType ?? null,
      resourceId: body.resourceId ?? null,
      meta: body.meta ?? null,
      ip: req?.ip ?? null,
      userAgent: req?.headers?.['user-agent'] ?? null,
    });
    return ServiceResponse.success('System log created', log, 201);
  }
}
