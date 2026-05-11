import { Controller, Get, Post, Put, Delete, Route, Tags, Response, SuccessResponse, Body, Path, Query, Security, Request } from '@tsoa/runtime';
import { ServiceResponse } from '../utils/serviceResponse';
import Feedback from '../models/feedback';
import Document from '../models/document';
import { asyncCatch } from '../middlewares/errorHandler';
import { IUserAttributes } from '@/types';
import { Op } from 'sequelize';
import { User } from '@/models/users';
import Project from '@/models/project';
import Role from '@/models/role';
import { createSystemLog } from '../utils/systemLog';
import Organization from '@/models/organization';
import { createNotificationForAdmins, createNotificationForUsers } from './notifications';
import { sendFeedbackReplyEmail } from '../utils/emailService';
import config from '../config/config';
import FeedbackReply from '@/models/feedback-reply';
import geoip from 'geoip-lite';
import sequelize from '@/config/database';
import db from '@/models';


interface DocumentInput {
  documentName: string;
  documentUrl: string;
  type: string;
  size?: number | null;
  publicId?: string | null;
  deleteToken?: string | null;
}

interface FeedbackCreateRequest {
  projectId?: string | null;
  mainMessage?: string | null;
  feedbackType?: 'positive' | 'negative' | 'suggestion' | 'concern' | null;
  feedbackMethod: 'text' | 'voice' | 'video';
  suggestions?: string | null;
  followUpNeeded?: boolean;
  documents?: DocumentInput[];
  responderName?: string | null;
  responderLocation?: string | null;
  otherFeedbackOn?: string;
}

interface FeedbackUpdateRequest extends Partial<FeedbackCreateRequest> {
  status?: 'submitted' | 'Acknowledged' | 'Resolved' | 'Rejected' | 'replied';
}

interface FeedbackReplyCreateRequest {
  subject?: string | null;
  message: string;
}

interface ShareFeedbackRequest {
  feedbackIds: string[];
  roleIds: string[];
}

@Route('api/feedback')
@Tags('Feedback')
export class FeedbackController extends Controller {
  // ✅ ADD THIS HELPER FUNCTION HERE (right after class declaration)
  private getLocationFromIP(req: any): string | null {
    try {
      console.log('🌍 === LOCATION DETECTION START ===');

      // 1. Get raw IP from various headers
      const xForwardedFor = req.headers['x-forwarded-for'];
      const xRealIp = req.headers['x-real-ip'];
      const connectionRemote = req.connection?.remoteAddress;
      const socketRemote = req.socket?.remoteAddress;
      const reqIp = req.ip;

      console.log('🌍 Raw IP Sources:', {
        'x-forwarded-for': xForwardedFor,
        'x-real-ip': xRealIp,
        'connection.remoteAddress': connectionRemote,
        'socket.remoteAddress': socketRemote,
        'req.ip': reqIp
      });

      // 2. Extract the first IP if x-forwarded-for is a list
      let ip = xForwardedFor?.split(',')[0].trim() ||
        xRealIp ||
        connectionRemote ||
        socketRemote ||
        reqIp;

      // 3. Handle Localhost / IPv6 Loopback
      if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.includes('::ffff:127.0.0.1')) {
        console.log('🌍 Localhost detected:', ip);

        // CHECK IF IN DEVELOPMENT MODE
        const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

        if (isDev) {
          console.log('🌍 DEV MODE: Using mock IP for testing');
          ip = '207.97.227.239'; // GitHub's IP (San Francisco) for testing
        } else {
          console.log('🌍 PROD MODE: Cannot determine location from localhost');
          return null;
        }
      }

      // 4. Clean IP (remove IPv6 prefix)
      const cleanIP = ip.replace('::ffff:', '');
      console.log('🌍 Using IP for Lookup:', cleanIP);

      // 5. Lookup Geo Data
      const geo = geoip.lookup(cleanIP);

      if (geo) {
        console.log('🌍 Geo Data Found:', JSON.stringify(geo, null, 2));

        // Format: City, Region, Country
        const locationParts = [
          geo.city,
          geo.region,
          geo.country
        ].filter(Boolean);

        const location = locationParts.length > 0
          ? locationParts.join(', ')
          : `Coordinates: ${geo.ll[0]}, ${geo.ll[1]}`;

        console.log('🌍 ✅ Final Location:', location);
        return location;
      } else {
        console.log('🌍 ❌ No Geo Data found for IP:', cleanIP);
        return null;
      }

    } catch (error) {
      console.error('🌍 ❌ IP-based location detection failed:', error);
      return null;
    }
  }
  @Security('jwt', ['feedback:read'])
  @Get('/')
  @asyncCatch
  public async getFeedback(
    @Request() req: { user: IUserAttributes },
    @Query() page: number = 1,
    @Query() limit: number = 10,
    @Query() status?: 'submitted' | 'Acknowledged' | 'Resolved' | 'Rejected',
    @Query() feedbackType?: 'positive' | 'negative' | 'suggestion' | 'concern',
    @Query() projectId?: string,
    @Query() projectName?: string,
    @Query() owner?: 'me' | 'other',
    @Query() org?: 'mine' | 'others' | 'all',
    @Query() startDate?: string,
    @Query() endDate?: string,
    @Query() search?: string
  ): Promise<ServiceResponse<any[]>> {
    const offset = (page - 1) * limit;
    const where: any = {};

    // Get user roles for filtering
    const userRoles = req.user?.roles || [];
    const userRoleIds = userRoles.map((role: any) => role.id);

    console.log('🔵 FEEDBACK LIST - User roles:', userRoleIds);
    // ADD THIS LINE FOR PROJECT FILTER:
    if (projectId) where.projectId = projectId;

    if (status) where.status = status;
    if (feedbackType) where.feedbackType = feedbackType;
    if (owner) {
      where.userId = owner === 'me' ? req.user.id : { [Op.ne]: req.user.id };
    }

    // Organization filtering
    if (org && req.user) {
      const userPrimaryOrg = (req.user as any).primaryOrganizationId ?? null;
      if (org === 'mine') {
        where.organizationId = userPrimaryOrg;
      } else if (org === 'others') {
        where.organizationId = { [Op.ne]: userPrimaryOrg };
      }
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    // Search functionality
    let searchConditions: any = {};
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      searchConditions = {
        [Op.or]: [
          { mainMessage: { [Op.like]: searchTerm } },
          { suggestions: { [Op.like]: searchTerm } },
          { otherFeedbackOn: { [Op.like]: searchTerm } },
          { '$user.name$': { [Op.like]: searchTerm } },
          { '$user.email$': { [Op.like]: searchTerm } },
          { '$project.name$': { [Op.like]: searchTerm } }
        ]
      };
    }

    // ADD PROJECT NAME FILTER (separate from general search):
    if (projectName && projectName.trim()) {
      const projectNameTerm = `%${projectName.trim()}%`;

      const projectNameCondition = {
        '$project.name$': { [Op.like]: projectNameTerm }
      };

      if (Object.keys(searchConditions).length > 0) {
        searchConditions = {
          [Op.and]: [
            searchConditions,
            projectNameCondition
          ]
        };
      } else {
        // If no search conditions, just use project name condition
        searchConditions = projectNameCondition;
      }
    }

    // Combine where conditions with search conditions
    // Ensure projectName filter is applied even when `search` is not provided
    const finalWhere = (searchConditions && Object.keys(searchConditions).length > 0)
      ? { [Op.and]: [where, searchConditions] }
      : where;

    const { count, rows } = await Feedback.findAndCountAll({
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      where: finalWhere,
      include: [
        {
          model: Document,
          as: 'documents',
          attributes: ['id', 'documentName', 'documentUrl', 'type', 'size', 'publicId', 'deleteToken'],
          required: false,
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email'],
          include: [
            { model: Role, as: 'roles', attributes: ['id', 'name'] }
          ]
        },
        {
          model: Project,
          as: 'project',
          attributes: ['id', 'name', 'status'],
          required: false,
        },
        {
          model: Role,
          as: 'allowedRoles',
          through: { attributes: [] },
          required: false,
          attributes: ['id', 'name']
        }
      ],
      distinct: true,
    });

    console.log('🔵 Found feedbacks before role filtering:', rows.length);
    console.log('🔵 User role IDs:', userRoleIds);

    // Check if user is admin/super-admin
    const isAdmin = userRoles.some((role: any) =>
      role.name?.toLowerCase() === 'super_admin' ||
      role.name?.toLowerCase() === 'super admin' ||
      role.name?.toLowerCase() === 'administrator' ||
      role.name?.toLowerCase() === 'admin'
    );

    console.log('🔵 Is user admin?', isAdmin);

    // FILTER FEEDBACKS BY ROLE PERMISSIONS
    const filteredFeedbacks = rows.filter(feedback => {
      const feedbackData = feedback.toJSON();

      console.log(`🔵 Checking feedback ${feedbackData.id}`);
      console.log(`🔵 Feedback allowedRoles:`, feedbackData.allowedRoles);

      // ✅ OPTION 1: Admin sees ALL feedbacks (current behavior)
      if (isAdmin) {
        console.log(`🟢 Admin user - showing feedback ${feedbackData.id}`);
        return true;
      }

      // ✅ FIX: If feedback is owned by the current user, always show it
      if (feedbackData.userId === req.user.id) {
        console.log(`🟢 User owns feedback ${feedbackData.id} - showing`);
        return true;
      }

      // ✅ FIX: Changed logic - if no allowedRoles, DON'T show to non-owners
      if (!feedbackData.allowedRoles || feedbackData.allowedRoles.length === 0) {
        console.log(`🔴 Feedback ${feedbackData.id} has NO role restrictions but user is not owner - HIDING`);
        return false; // ← CHANGED: Hide feedbacks without explicit role assignment
      }

      // If feedback has allowedRoles, user must have at least one matching role
      const feedbackRoleIds = feedbackData.allowedRoles.map((role: any) => role.id);
      const hasAccess = userRoleIds.some((roleId: string) => feedbackRoleIds.includes(roleId));

      console.log(`🔵 Feedback ${feedbackData.id} - Allowed role IDs:`, feedbackRoleIds);
      console.log(`🔵 Feedback ${feedbackData.id} - User has access:`, hasAccess);

      return hasAccess;
    });

    // console.log('🟢 Filtered feedbacks after role check:', filteredFeedbacks.length);
    // console.log('🟢 Filtered feedback IDs:', filteredFeedbacks.map(f => f.id));

    return ServiceResponse.success(
      'Feedback retrieved successfully',
      filteredFeedbacks,
      200,
      { total: filteredFeedbacks.length, page, totalPages: Math.ceil(filteredFeedbacks.length / limit) }
    );
  }

  @Security('jwt', ['feedback:read'])
  @Get('/{feedbackId}')
  @asyncCatch
  @Response<ServiceResponse<null>>(404, 'Feedback not found')
  public async getFeedbackById(@Path() feedbackId: string): Promise<ServiceResponse<any | null>> {
    const feedback = await Feedback.findByPk(feedbackId, {
      include: [
        {
          model: Document,
          as: 'documents',
        },
      ],
    });

    if (!feedback) return ServiceResponse.failure('Feedback not found', null, 404);
    return ServiceResponse.success('Feedback retrieved successfully', feedback);
  }

  @Security('jwt', ['feedback:read'])
  @Put('/{feedbackId}/mark-read')
  @asyncCatch
  public async markFeedbackAsRead(
    @Request() req: any,
    @Path() feedbackId: string
  ): Promise<ServiceResponse<any | null>> {
    const feedback = await Feedback.findByPk(feedbackId);
    if (!feedback) return ServiceResponse.failure('Feedback not found', null, 404);

    await feedback.update({ status: 'Resolved' });
    await createSystemLog(req ?? null, 'marked_feedback_read', 'Feedback', feedbackId, {});

    return ServiceResponse.success('Feedback marked as resolved', feedback);
  }

  @Security('optionalJwt')
  @Post('/')
  @asyncCatch
  public async createFeedback(
    @Request() req: { user: IUserAttributes },
    @Body() data: FeedbackCreateRequest
  ): Promise<ServiceResponse<any | null>> {
    // Determine organization for this feedback
    let orgId: string | null = null;
    if (req?.user && (req.user as any).primaryOrganizationId) {
      orgId = (req.user as any).primaryOrganizationId;
    } else {
      const sys = await Organization.findOne({ where: { type: 'system_owner' } });
      orgId = sys?.id ?? null;
    }

    // ✅ FIX: Auto-detect location from IP (only call once)
    const detectedLocation = this.getLocationFromIP(req);
    console.log('🌍 Detected location from IP:', detectedLocation);

    // Use provided location OR detected location OR fallback
    const finalLocation = data.responderLocation || detectedLocation || 'Unknown Location';
    console.log('🌍 Final location to save:', finalLocation);

    const feedback = await Feedback.create({
      projectId: data.projectId || null,
      mainMessage: data.mainMessage || null,
      feedbackType: data.feedbackType || null,
      feedbackMethod: data.feedbackMethod,
      suggestions: data.suggestions || null,
      followUpNeeded: data.followUpNeeded || false,
      feedbackReplied: false,
      userId: req.user?.id || null,
      organizationId: orgId,
      status: 'submitted',
      responderName: data.responderName || null,
      responderLocation: finalLocation, // ← Use the final location here
      otherFeedbackOn: data.otherFeedbackOn || null,
    });

    if (data.documents && data.documents.length > 0) {
      const documentsToCreate = data.documents.map(doc => ({
        ...doc,
        userId: req.user?.id || null,
        addedAt: new Date(),
      }));

      const createdDocuments = await Document.bulkCreate(documentsToCreate as any[]);
      await feedback.addDocument(createdDocuments);
    }

    this.setStatus(201);
    const result = await Feedback.findByPk(feedback.id, {
      include: [
        {
          model: Document,
          as: 'documents',
        },
      ],
    });

    await createSystemLog(req ?? null, 'created_feedback', 'Feedback', feedback.id, {
      feedbackType: data.feedbackType,
      locationDetected: !data.responderLocation && detectedLocation ? true : false,
      detectedLocation: detectedLocation // ← Add this for debugging
    });

    // Create notifications for admins about new feedback
    try {
      let feedbackSubject = data.otherFeedbackOn || 'Unknown';
      if (data.projectId) {
        const project = await Project.findByPk(data.projectId, { attributes: ['name'] });
        if (project) {
          feedbackSubject = project.name;
        }
      }

      await createNotificationForAdmins(
        'feedback',
        'New feedback received',
        `New feedback has been submitted on ${feedbackSubject}${finalLocation ? ` from ${finalLocation}` : ''}. Please review and take appropriate action.`,
        {
          icon: 'HiOutlineChatAlt',
          link: `/dashboard/feedback?feedbackId=${feedback.id}`,
          entityId: feedback.id,
          entityType: 'Feedback',
          createdBy: req.user?.id,
          organizationId: orgId || undefined,
        }
      );
    } catch (error) {
      console.error('Failed to create feedback notifications:', error);
    }

    return ServiceResponse.success('Feedback created successfully', result, 201);
  }

  // Replies
  @Security('jwt', ['feedback:read'])
  @Get('/{feedbackId}/replies')
  @asyncCatch
  public async getFeedbackReplies(@Path() feedbackId: string): Promise<ServiceResponse<any[]>> {
    const feedback = await Feedback.findByPk(feedbackId);
    if (!feedback) return ServiceResponse.failure('Feedback not found', [], 404);
    const replies = await FeedbackReply.findAll({
      where: { feedbackId },
      order: [['createdAt', 'ASC']],
    });
    return ServiceResponse.success('Feedback replies retrieved successfully', replies);
  }

  @Security('jwt', ['feedback:update'])
  @Post('/{feedbackId}/replies')
  @asyncCatch
  public async addFeedbackReply(
    @Request() req: { user: IUserAttributes },
    @Path() feedbackId: string,
    @Body() data: FeedbackReplyCreateRequest,
  ): Promise<ServiceResponse<any | null>> {
    const feedback = await Feedback.findByPk(feedbackId);
    if (!feedback) return ServiceResponse.failure('Feedback not found', null, 404);

    // Set organization for reply
    let orgId: string | null = feedback.organizationId ?? null;
    if (req?.user && (req.user as any)?.primaryOrganizationId) {
      orgId = (req.user as any)?.primaryOrganizationId;
    }

    const reply = await FeedbackReply.create({
      feedbackId,
      subject: data.subject ?? null,
      message: data.message,
      userId: req.user?.id || null,
      organizationId: orgId,
    });

    // Update feedback status to Resolved and set followUpNeeded to true when a reply is added
    await feedback.update({
      status: 'replied',
      feedbackReplied: true,
    });

    await createSystemLog(req ?? null, 'replied_feedback', 'Feedback', feedbackId, {
      replyId: reply.id,
    });

    // Notify feedback owner if email exists
    try {
      // Get user email if available
      const feedbackWithUser = await Feedback.findByPk(feedbackId, { include: [{ model: User, as: 'user', attributes: ['id', 'email'] }] });
      const recipientEmail = (feedbackWithUser as any)?.user?.email;
      const link = `${config.frontendUrl}/dashboard/feedback?feedbackId=${feedbackId}`;
      if (recipientEmail) {
        await sendFeedbackReplyEmail(recipientEmail, {
          subject: data.subject ?? null,
          message: data.message,
          link,
        });
      }

      const recipientUserId = (feedbackWithUser as any)?.user?.id as string | undefined;
      if (recipientUserId) {
        await createNotificationForUsers(
          'feedback',
          'New reply to your feedback',
          data.subject && data.subject.trim().length > 0 ? data.subject : 'You have a new reply',
          [recipientUserId],
          {
            icon: 'HiOutlineChatAlt2',
            link,
            entityId: feedbackId,
            entityType: 'Feedback',
            createdBy: req.user?.id,
            organizationId: orgId || undefined,
          }
        );
      }
    } catch (notifyErr) {
      console.error('Failed to send feedback reply notifications/email:', notifyErr);
    }

    return ServiceResponse.success('Reply added successfully', reply, 201);
  }

  @Security('jwt', ['feedback:update'])
  @Put('/{feedbackId}')
  @asyncCatch
  public async updateFeedback(
    @Request() req: any,
    @Path() feedbackId: string,
    @Body() data: FeedbackUpdateRequest
  ): Promise<ServiceResponse<any | null>> {
    const feedback = await Feedback.findByPk(feedbackId);
    if (!feedback) return ServiceResponse.failure('Feedback not found', null, 404);

    // determine organization for update (preserve existing or set by user org)
    let orgId = (feedback as any).organizationId ?? null;
    if (req?.user && (req.user as any).primaryOrganizationId) {
      orgId = (req.user as any).primaryOrganizationId;
    } else if (!orgId) {
      const sys = await Organization.findOne({ where: { type: 'system_owner' } });
      orgId = sys?.id ?? null;
    }

    await feedback.update({
      projectId: data.projectId ?? feedback.projectId ?? null,
      mainMessage: data.mainMessage ?? feedback.mainMessage,
      feedbackType: data.feedbackType ?? feedback.feedbackType,
      feedbackMethod: data.feedbackMethod ?? feedback.feedbackMethod,
      suggestions: data.suggestions ?? feedback.suggestions,
      followUpNeeded: data.followUpNeeded ?? feedback.followUpNeeded,
      status: data.status ?? feedback.status,
      responderName: data.responderName ?? feedback.responderName,
      otherFeedbackOn: data.otherFeedbackOn ?? feedback.otherFeedbackOn,
      organizationId: orgId,
    } as any);

    if (data.documents) {
      const existingDocuments = await feedback.getDocuments();
      if (existingDocuments.length > 0) {
        const idsToRemove = existingDocuments.map((doc: any) => doc.id);
        await Document.destroy({ where: { id: { [Op.in]: idsToRemove } } });
      }

      if (data.documents.length > 0) {
        const documentsToCreate = data.documents.map(doc => ({
          ...doc,
          userId: feedback.userId,
          addedAt: new Date(),
        }));
        const createdDocuments = await Document.bulkCreate(documentsToCreate as any[]);
        await feedback.addDocument(createdDocuments);
      }
    }

    const result = await Feedback.findByPk(feedback.id, {
      include: [
        {
          model: Document,
          as: 'documents',
        },
      ],
    });
    await createSystemLog(req ?? null, 'updated_feedback', 'Feedback', feedback.id, { changes: Object.keys(data) });
    return ServiceResponse.success('Feedback updated successfully', result);
  }

  @Security('jwt', ['feedback:delete'])
  @Delete('/{feedbackId}')
  @SuccessResponse(204, 'No Content')
  @asyncCatch
  public async deleteFeedback(
    @Request() req: any,
    @Path() feedbackId: string
  ): Promise<ServiceResponse<null>> {
    const feedback = await Feedback.findByPk(feedbackId);
    if (!feedback) return ServiceResponse.failure('Feedback not found', null, 404);

    const documents = await feedback.getDocuments();
    for (const doc of documents) {
      await doc.destroy();
    }

    await feedback.destroy();
    await createSystemLog(req ?? null, 'deleted_feedback', 'Feedback', feedbackId, { mainMessage: feedback.mainMessage });
    this.setStatus(204);
    return ServiceResponse.success('Feedback deleted successfully', null, 204);
  }

  @Security('jwt', ['feedback:read'])
  @Get('/stats/summary')
  @asyncCatch
  public async getFeedbackStats(): Promise<ServiceResponse<any>> {
    const [
      totalCount,
      submittedCount,
      acknowledgedCount,
      resolvedCount,
      rejectedCount,
      positiveCount,
      negativeCount,
      suggestionCount,
      concernCount,
    ] = await Promise.all([
      Feedback.count(),
      Feedback.count({ where: { status: 'submitted' } }),
      Feedback.count({ where: { status: 'Acknowledged' } }),
      Feedback.count({ where: { status: 'Resolved' } }),
      Feedback.count({ where: { status: 'Rejected' } }),
      Feedback.count({ where: { feedbackType: 'positive' } }),
      Feedback.count({ where: { feedbackType: 'negative' } }),
      Feedback.count({ where: { feedbackType: 'suggestion' } }),
      Feedback.count({ where: { feedbackType: 'concern' } }),
    ]);

    const stats = {
      total: totalCount,
      byStatus: {
        submitted: submittedCount,
        acknowledged: acknowledgedCount,
        resolved: resolvedCount,
        rejected: rejectedCount,
      },
      byType: {
        positive: positiveCount,
        negative: negativeCount,
        suggestion: suggestionCount,
        concern: concernCount,
      },
    };

    return ServiceResponse.success('Feedback statistics retrieved successfully', stats);
  }
  // this is for sharing feedbacks
  // @Security('jwt', ['feedback:share'])
  @Post('/share')
  @asyncCatch
  public async shareFeedbackWithRoles(@Request() request: any,
    @Body() data: ShareFeedbackRequest): Promise<ServiceResponse<any>> {
    const { feedbackIds, roleIds } = data;

    if (!feedbackIds || feedbackIds.length === 0) {
      return ServiceResponse.failure('No feedback IDs provided', null, 400);
    }

    if (!roleIds || roleIds.length === 0) {
      return ServiceResponse.failure('No role IDs provided', null, 400);
    }

    const result = await sequelize.transaction(async (t) => {
      // Find the feedbacks (use the Feedback model imported at top)
      const feedbacks = await Feedback.findAll({
        where: { id: feedbackIds },
        transaction: t
      });

      if (feedbacks.length === 0) {
        throw new Error('No feedbacks found with the provided IDs');
      }

      // Find the roles
      const roles = await db.Role.findAll({
        where: { id: roleIds },
        transaction: t
      });

      if (roles.length === 0) {
        throw new Error('No roles found with the provided IDs');
      }

      // Share each feedback with the selected roles
      for (const feedback of feedbacks) {
        await (feedback as any).setAllowedRoles(roles, { transaction: t });
        // console.log(`🟢 Set allowed roles for feedback ${feedback.id}`);
      }

      return {
        sharedCount: feedbacks.length,
        roleCount: roles.length
      };
    });

    // Log the sharing action
    await createSystemLog(request ?? null, 'shared_feedbacks', 'Feedback', null, {
      feedbackCount: result.sharedCount,
      roleCount: result.roleCount,
      feedbackIds: feedbackIds,
      roleIds: roleIds
    });

    return ServiceResponse.success('Feedbacks shared successfully', result);
  }

}