import { Controller, Get, Post, Put, Delete, Route, Tags, Response, SuccessResponse, Body, Path, Query, Security, Request } from '@tsoa/runtime';
import { ServiceResponse } from '../utils/serviceResponse';
import { asyncCatch } from '../middlewares/errorHandler';
import { Op } from 'sequelize';
import db from '@/models';

interface NotificationCreateRequest {
  type: 'survey' | 'feedback' | 'community_session' | 'system';
  title: string;
  message: string;
  icon?: string;
  link?: string;
  entityId?: string;
  entityType?: string;
  userIds: string[]; // Array of user IDs to send notification to
}

interface NotificationUpdateRequest {
  isRead?: boolean;
}

@Route('api/notifications')
@Tags('Notifications')
export class NotificationController extends Controller {
  @Security('jwt')
  @Get('/')
  @asyncCatch
  public async getNotifications(
    @Request() request: any,
    @Query() page: number = 1,
    @Query() limit: number = 10,
    @Query() type?: 'survey' | 'feedback' | 'community_session' | 'system',
    @Query() isRead?: boolean,
    @Query() startDate?: string,
    @Query() endDate?: string
  ): Promise<ServiceResponse<any[]>> {
    const userId = request?.user?.id;
    if (!userId) {
      return ServiceResponse.failure('Authentication required', [], 401);
    }

    const offset = (page - 1) * limit;
    const where: any = { userId };

    // Type filter
    if (type) where.type = type;

    // Read status filter
    if (typeof isRead === 'boolean') where.isRead = isRead;

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const { count, rows } = await db.Notification.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        { model: db.User, as: 'creator', attributes: ['id', 'name'] },
        { model: db.User, as: 'user', attributes: ['id', 'name'] },
      ],
    });

    return ServiceResponse.success(
      'Notifications retrieved successfully',
      rows,
      200,
      { total: count, page, totalPages: Math.ceil(count / limit) }
    );
  }

  @Security('jwt')
  @Get('/unread-count')
  @asyncCatch
  public async getUnreadCount(@Request() request: any): Promise<ServiceResponse<{ count: number }>> {
    const userId = request?.user?.id;
    if (!userId) {
      return ServiceResponse.failure('Authentication required', { count: 0 }, 401);
    }

    const count = await db.Notification.count({
      where: { userId, isRead: false },
    });

    return ServiceResponse.success('Unread count retrieved successfully', { count });
  }

  @Security('jwt')
  @Get('/{notificationId}')
  @asyncCatch
  @Response<ServiceResponse<null>>(404, 'Notification not found')
  public async getNotificationById(
    @Path() notificationId: string,
    @Request() request: any
  ): Promise<ServiceResponse<any | null>> {
    const userId = request?.user?.id;
    if (!userId) {
      return ServiceResponse.failure('Authentication required', null, 401);
    }

    const notification = await db.Notification.findOne({
      where: { id: notificationId, userId },
      include: [
        { model: db.User, as: 'creator', attributes: ['id', 'name'] },
        { model: db.User, as: 'user', attributes: ['id', 'name'] },
      ],
    });

    if (!notification) return ServiceResponse.failure('Notification not found', null, 404);
    return ServiceResponse.success('Notification retrieved successfully', notification);
  }

  @Security('jwt')
  @Post('/')
  @asyncCatch
  public async createNotification(
    @Request() request: any,
    @Body() data: NotificationCreateRequest
  ): Promise<ServiceResponse<any | null>> {
    const createdBy = request?.user?.id;
    const organizationId = request?.user?.primaryOrganizationId;

    if (!data.userIds || data.userIds.length === 0) {
      return ServiceResponse.failure('At least one user ID is required', null, 400);
    }

    // Create notifications for all specified users
    const notifications = await Promise.all(
      data.userIds.map(userId =>
        db.Notification.create({
          type: data.type,
          title: data.title,
          message: data.message,
          icon: data.icon,
          link: data.link,
          entityId: data.entityId,
          entityType: data.entityType,
          userId,
          createdBy,
          organizationId,
        })
      )
    );

    this.setStatus(201);

    return ServiceResponse.success('Notifications created successfully', notifications, 201);
  }

  @Security('jwt')
  @Put('/{notificationId}')
  @asyncCatch
  public async updateNotification(
    @Path() notificationId: string,
    @Request() request: any,
    @Body() data: NotificationUpdateRequest
  ): Promise<ServiceResponse<any | null>> {
    const userId = request?.user?.id;
    if (!userId) {
      return ServiceResponse.failure('Authentication required', null, 401);
    }

    const notification = await db.Notification.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) return ServiceResponse.failure('Notification not found', null, 404);

    await notification.update(data);

    const result = await db.Notification.findOne({
      where: { id: notificationId, userId },
      include: [
        { model: db.User, as: 'creator', attributes: ['id', 'name'] },
        { model: db.User, as: 'user', attributes: ['id', 'name'] },
      ],
    });

    return ServiceResponse.success('Notification updated successfully', result);
  }

  @Security('jwt')
  @Put('/mark-all-read')
  @asyncCatch
  public async markAllAsRead(@Request() request: any): Promise<ServiceResponse<{ updated: number }>> {
    const userId = request?.user?.id;
    if (!userId) {
      return ServiceResponse.failure('Authentication required', { updated: 0 }, 401);
    }

    const [updatedCount] = await db.Notification.update(
      { isRead: true },
      { where: { userId, isRead: false } }
    );

    return ServiceResponse.success('All notifications marked as read', { updated: updatedCount });
  }

  @Security('jwt')
  @Delete('/{notificationId}')
  @SuccessResponse(204, 'No Content')
  @asyncCatch
  public async deleteNotification(
    @Path() notificationId: string,
    @Request() request: any
  ): Promise<ServiceResponse<null>> {
    const userId = request?.user?.id;
    if (!userId) {
      return ServiceResponse.failure('Authentication required', null, 401);
    }

    const notification = await db.Notification.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) return ServiceResponse.failure('Notification not found', null, 404);

    await notification.destroy();
    
    this.setStatus(204);
    return ServiceResponse.success('Notification deleted successfully', null, 204);
  }

  @Security('jwt')
  @Delete('/clear-read')
  @SuccessResponse(204, 'No Content')
  @asyncCatch
  public async clearReadNotifications(@Request() request: any): Promise<ServiceResponse<{ deleted: number }>> {
    const userId = request?.user?.id;
    if (!userId) {
      return ServiceResponse.failure('Authentication required', { deleted: 0 }, 401);
    }

    const deletedCount = await db.Notification.destroy({
      where: { userId, isRead: true },
    });

    return ServiceResponse.success('Read notifications cleared successfully', { deleted: deletedCount });
  }
}

// Utility function to create notifications for specific scenarios
export const createNotificationForRoles = async (
  type: 'survey' | 'feedback' | 'community_session' | 'system',
  title: string,
  message: string,
  roleIds: string[],
  options: {
    icon?: string;
    link?: string;
    entityId?: string;
    entityType?: string;
    createdBy?: string;
    organizationId?: string;
  } = {}
) => {
  if (!roleIds || roleIds.length === 0) return [];

  // Get all users with the specified roles
  const users = await db.User.findAll({
    include: [
      {
        model: db.Role,
        as: 'roles',
        where: { id: roleIds },
        through: { attributes: [] },
      },
    ],
    attributes: ['id'],
  });

  const userIds = users.map(user => user.id);
  if (userIds.length === 0) return [];

  // Create notifications for all users
  const notifications = await Promise.all(
    userIds.map(userId =>
      db.Notification.create({
        type,
        title,
        message,
        icon: options.icon,
        link: options.link,
        entityId: options.entityId,
        entityType: options.entityType,
        userId,
        createdBy: options.createdBy,
        organizationId: options.organizationId,
      })
    )
  );

  return notifications;
};

// Utility function to create notifications for admin roles
export const createNotificationForAdmins = async (
  type: 'survey' | 'feedback' | 'community_session' | 'system',
  title: string,
  message: string,
  options: {
    icon?: string;
    link?: string;
    entityId?: string;
    entityType?: string;
    createdBy?: string;
    organizationId?: string;
  } = {}
) => {
  // Get admin and super admin roles
  const adminRoles = await db.Role.findAll({
    where: {
      name: {
        [Op.in]: ['admin', 'super_admin'],
      },
    },
    attributes: ['id'],
  });

  const roleIds = adminRoles.map(role => role.id);
  return createNotificationForRoles(type, title, message, roleIds, options);
};

// Utility to create notifications for specific users
export const createNotificationForUsers = async (
  type: 'survey' | 'feedback' | 'community_session' | 'system',
  title: string,
  message: string,
  userIds: string[],
  options: {
    icon?: string;
    link?: string;
    entityId?: string;
    entityType?: string;
    createdBy?: string;
    organizationId?: string;
  } = {}
) => {
  if (!userIds || userIds.length === 0) return [];
  const notifications = await Promise.all(
    userIds.map(userId =>
      db.Notification.create({
        type,
        title,
        message,
        icon: options.icon,
        link: options.link,
        entityId: options.entityId,
        entityType: options.entityType,
        userId,
        createdBy: options.createdBy,
        organizationId: options.organizationId,
      })
    )
  );
  return notifications;
};
