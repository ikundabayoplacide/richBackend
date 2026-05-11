import { Controller, Get, Post, Put, Delete, Route, Tags, Response, SuccessResponse, Body, Path, Query, Security, Request } from '@tsoa/runtime';
import { ServiceResponse } from '../utils/serviceResponse';
import { asyncCatch } from '../middlewares/errorHandler';
import sequelize from '../config/database';
import { Op } from 'sequelize';
import { createSystemLog } from '../utils/systemLog';
import db from '@/models';

@Route('api/announcements')
@Tags('Announcements')
export class AnnouncementController extends Controller {
  @Security('jwt', ['project:read'])
  @Get('/')
  @asyncCatch
  public async listAnnouncements(
    @Request() req: { user: { id: string } },
    @Query() page: number = 1,
    @Query() limit: number = 25,
    @Query() status?: 'draft' | 'scheduled' | 'sent' | 'stopped',
    @Query() q?: string,
    @Query() startDate?: string,
    @Query() endDate?: string,
    @Query() allowed?: boolean
  ): Promise<ServiceResponse<any[]>> {
    const offset = (Math.max(1, page) - 1) * Math.max(1, limit);
    const where: any = {};

    // Base filters
    if (status) where.status = status;
    if (q) {
      // Use LOWER() for case-insensitive search in MySQL/MariaDB
      const searchTerm = q.toLowerCase();
      where[Op.or] = [
        sequelize.where(sequelize.fn('LOWER', sequelize.col('Announcement.title')), 'LIKE', `%${searchTerm}%`),
        sequelize.where(sequelize.fn('LOWER', sequelize.col('Announcement.message')), 'LIKE', `%${searchTerm}%`)
      ];
    }

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

    // Base includes array
    const includeArr: any[] = [
      { model: db.Role, as: 'allowedRoles', through: { attributes: [] }, required: false },
      { model: db.User, as: 'creator', attributes: ['id', 'name', 'email'], required: false }
    ];

    // If allowed=true, filter by user's roles
    if (allowed) {
      if (!req?.user?.id) {
        return ServiceResponse.failure('Authentication required to filter by allowed', [], 401);
      }

      // Load user's roles
      const user = await db.User.findByPk(req.user.id, {
        include: [{ model: db.Role, as: 'roles', through: { attributes: [] } }],
      });
      
      const roleIds = user?.roles?.map((r: any) => r.id).filter(Boolean) ?? [];
      if (!roleIds.length) {
        // User has no roles -> no announcements allowed
        return ServiceResponse.success('Announcements retrieved successfully', [], 200, { total: 0, page, totalPages: 0 });
      }

      // Replace allowedRoles include to be required and filter by user's role ids
      includeArr[0] = {
        model: db.Role,
        as: 'allowedRoles',
        through: { attributes: [] },
        required: true,
        where: { id: roleIds },
      };
    }

    const { count, rows } = await db.Announcement.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: Math.max(1, limit),
      offset,
      include: includeArr,
      distinct: true,
    });

    return ServiceResponse.success('Announcements retrieved successfully', rows, 200, { total: count, page, totalPages: Math.ceil(count / limit) });
  }

  @Security('jwt', ['project:read'])
  @Get('/{id}')
  @asyncCatch
  @Response<ServiceResponse<null>>(404, 'Announcement not found')
  public async getAnnouncement(@Path() id: string): Promise<ServiceResponse<any | null>> {
    const announcement = await db.Announcement.findByPk(id, {
      include: [{ model: db.Role, as: 'allowedRoles', through: { attributes: [] }, required: false }],
    });
    if (!announcement) return ServiceResponse.failure('Announcement not found', null, 404);
    return ServiceResponse.success('Announcement retrieved successfully', announcement);
  }

  @Security('jwt', ['announcement:create'])
  @Post('/')
  @asyncCatch
  public async createAnnouncement(
    @Request() req: any,
    @Body() body: {
      title: string;
      message: string;
      status?: 'draft' | 'scheduled' | 'sent';
      scheduledAt?: string | null;
      viewDetailsLink?: string | null;
      allowedRoles?: string[] | null;
    }
  ): Promise<ServiceResponse<any | null>> {
    const tx = await sequelize.transaction();
    try {
      const a = await db.Announcement.create({
        title: body.title,
        message: body.message,
        status: body.status ?? 'draft',
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        viewDetailsLink: body.viewDetailsLink ?? null,
        createdBy: req?.user?.id ?? null,
      }, { transaction: tx });

      if (body.allowedRoles && body.allowedRoles.length > 0) {
        const roles = await db.Role.findAll({ where: { id: body.allowedRoles }, transaction: tx });
        if (roles.length) {
          await (a as any).setAllowedRoles(roles, { transaction: tx });
        }
      }

      await tx.commit();
      await createSystemLog(req ?? null, 'created_announcement', 'Announcement', a.id, { title: a.title });
      const result = await db.Announcement.findByPk(a.id, { include: [{ model: db.Role, as: 'allowedRoles', through: { attributes: [] } }] });
      this.setStatus(201);
      return ServiceResponse.success('Announcement created successfully', result, 201);
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  @Security('jwt', ['project:update'])
  @Put('/{id}')
  @asyncCatch
  @Response<ServiceResponse<null>>(404, 'Announcement not found')
  public async updateAnnouncement(
    @Path() id: string,
    @Request() req: any,
    @Body() body: {
      title?: string;
      message?: string;
      status?: 'draft' | 'scheduled' | 'sent' | 'stopped';
      scheduledAt?: string | null;
      viewDetailsLink?: string | null;
      allowedRoles?: string[] | null;
    }
  ): Promise<ServiceResponse<any | null>> {
    const announcement = await db.Announcement.findByPk(id);
    if (!announcement) return ServiceResponse.failure('Announcement not found', null, 404);

    const tx = await sequelize.transaction();
    try {
      await announcement.update({
        title: body.title ?? announcement.title,
        message: body.message ?? announcement.message,
        status: body.status ?? announcement.status,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : body.scheduledAt === null ? null : announcement.scheduledAt,
        viewDetailsLink: body.viewDetailsLink ?? announcement.viewDetailsLink,
      }, { transaction: tx });

      if (body.allowedRoles) {
        const roles = await db.Role.findAll({ where: { id: body.allowedRoles }, transaction: tx });
        await (announcement as any).setAllowedRoles(roles, { transaction: tx });
      }

      await tx.commit();
      await createSystemLog(req ?? null, 'updated_announcement', 'Announcement', announcement.id, { changes: Object.keys(body) });
      const result = await db.Announcement.findByPk(announcement.id, { include: [{ model: db.Role, as: 'allowedRoles', through: { attributes: [] } }] });
      return ServiceResponse.success('Announcement updated successfully', result);
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  @Security('jwt', ['project:delete'])
  @Delete('/{id}')
  @SuccessResponse(204, 'No Content')
  @asyncCatch
  public async deleteAnnouncement(@Path() id: string, @Request() req?: any): Promise<ServiceResponse<null>> {
    const announcement = await db.Announcement.findByPk(id);
    if (!announcement) return ServiceResponse.failure('Announcement not found', null, 404);
    await announcement.destroy();
    await createSystemLog(req ?? null, 'deleted_announcement', 'Announcement', id, { title: announcement.title });
    this.setStatus(204);
    return ServiceResponse.success('Announcement deleted successfully', null, 204);
  }
}
