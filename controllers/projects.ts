import { Controller, Get, Post, Put, Delete, Route, Tags, Response, SuccessResponse, Body, Path, Query, Security, Request } from '@tsoa/runtime';
import { ServiceResponse } from '../utils/serviceResponse';
import { asyncCatch } from '../middlewares/errorHandler';
import sequelize from '../config/database';
import db from '@/models';

interface ProjectCreateRequest {
  name: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled'| 'active';
  targetGroup?: string | null;
  description?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  geographicArea?: string | null; // New field
  interventionAreaId?: string | null; // New field
  stakeholderIds?: string[]; // optional to attach stakeholders
  donorIds?: string[]; // New field - optional to attach donors
  // Inline resources to be created and associated
  documents?: Array<{
    documentName: string;
    size?: number | null;
    type?: string | null;
    addedAt?: Date;
    documentUrl?: string | null;
    userId: string; // required by Document model
    publicId?: string | null;
    deleteToken?: string | null;
  }>;
}
interface ProjectApproveRequest {
  interventionAreaId: string;
  donorIds?: string[];
}
interface ProjectUpdateRequest extends Partial<ProjectCreateRequest> {
  // For updates, allow removing specific existing documents by ID
  removeDocumentIds?: string[];
}

@Route('api/projects')
@Tags('Projects')
export class ProjectController extends Controller {
  @Security('jwt', ['project:read'])
  @Get('/')
  @asyncCatch
  public async getProjects(
    @Query() page: number = 1,
    @Query() limit: number = 10,
    @Query('interventionAreaId') interventionAreaId?: string ,
    @Request() request?: any,
  ): Promise<ServiceResponse<any[]>> {
     const whereClause: any = {};
      if (interventionAreaId) {
    whereClause.interventionAreaId = interventionAreaId;
  }
    const offset = (page - 1) * limit;
     // NEW: Get user from JWT token
  const user = request?.user; // This comes from your JWT middleware
  const userStakeholderIds = user?.stakeholderIds || []; 

  console.log('User from request:', user);
  console.log('Stakeholder IDs:', userStakeholderIds);

    // NEW: Build include options with donor filtering
  const includeOptions: any[] = [
    { model: db.Document, as: 'documents' },
    { model: db.Organization, as: 'stakeholders', through: { attributes: [] } },
    { model: db.Survey, as: 'surveys' },
    { model: db.InterventionArea, as: 'interventionArea' },
  ];

  if (userStakeholderIds.length > 0) {
    includeOptions.push({
      model: db.Organization,
      as: 'donors',
      through: { attributes: [] },
      where: {
        id: userStakeholderIds, // Only include projects where user's org is a donor
      },
      required: true, // INNER JOIN - only projects with matching donors
    });
  } else {
    // For users without organizations (super admin), show all
    includeOptions.push({
      model: db.Organization,
      as: 'donors',
      through: { attributes: [] },
      required: false, // LEFT JOIN - include all projects
    });
  }
    const { count, rows } = await db.Project.findAndCountAll({
      where: whereClause, 
      limit,
      offset,
      include: includeOptions,
      order: [['createdAt', 'DESC']],
      distinct: true,
    });

    return ServiceResponse.success('Projects retrieved successfully', rows, 200, { total: count, page, totalPages: Math.ceil(count / limit) });
  }

 @Security('jwt', ['project:read'])
@Get('/{projectId}')
@asyncCatch
@Response<ServiceResponse<null>>(404, 'Project not found')
public async getProjectById(
  @Path() projectId: string,
  @Request() request?: any
): Promise<ServiceResponse<any | null>> {
  const user = request?.user;
  const userStakeholderIds = user?.stakeholderIds || [];
  
  const includeOptions: any[] = [
    { model: db.Document, as: 'documents' },
    { model: db.Organization, as: 'stakeholders', through: { attributes: [] } },
    { model: db.Survey, as: 'surveys' },
    { model: db.Feedback, as: 'feedbacks' },
    { model: db.InterventionArea, as: 'interventionArea' },
  ];

  // Add donor filtering
  if (userStakeholderIds.length > 0) {
    includeOptions.push({
      model: db.Organization,
      as: 'donors',
      through: { attributes: [] },
      where: {
        id: userStakeholderIds,
      },
      required: true, // Only return if user's org is a donor
    });
  } else {
    includeOptions.push({
      model: db.Organization,
      as: 'donors',
      through: { attributes: [] },
    });
  }

  const project = await db.Project.findByPk(projectId, {
    include: includeOptions,
  });

  if (!project) {
    return ServiceResponse.failure('Project not found or access denied', null, 404);
  }

  return ServiceResponse.success('Project retrieved successfully', project);
}
// Add this method to your ProjectController class
@Security('jwt', ['project:approve'])
@Put('/{projectId}/approve')
@asyncCatch
@Response<ServiceResponse<null>>(404, 'Project not found')
@Response<ServiceResponse<null>>(400, 'Bad Request')
public async approveProject(
  @Path() projectId: string
): Promise<ServiceResponse<any | null>> {
  const tx = await sequelize.transaction();
  try {
    // Find the project
    const project = await db.Project.findByPk(projectId, { transaction: tx });
    if (!project) {
      await tx.rollback();
      return ServiceResponse.failure('Project not found', null, 404);
    }

    // Update project status to active
    await project.update({
      status: 'active', // Change status to 'active'
    }, { transaction: tx });

    // Fetch updated project with associations
    const result = await db.Project.findByPk(project.id, {
      include: [
        { model: db.Document, as: 'documents' },
        { model: db.Organization, as: 'stakeholders', through: { attributes: [] } },
        { model: db.Organization, as: 'donors', through: { attributes: [] } },
        { model: db.Survey, as: 'surveys' },
        { model: db.InterventionArea, as: 'interventionArea' },
      ],
      transaction: tx,
    });

    await tx.commit();
    return ServiceResponse.success('Project approved successfully', result, 200);
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}
  @Security('jwt', ['project:create'])
  @Post('/')
  @asyncCatch
  public async createProject(@Body() data: ProjectCreateRequest): Promise<ServiceResponse<any | null>> {
    const tx = await sequelize.transaction();
    try {
      const project = await db.Project.create({
        name: data.name,
        status: (data.status ?? 'pending') as any,
        description: data.description ?? null,
        targetGroup: data.targetGroup ?? null,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
        geographicArea: data.geographicArea ?? null,
        interventionAreaId: data.interventionAreaId ?? null,
      }, { transaction: tx });

      if (data.stakeholderIds && data.stakeholderIds.length) {
        await (project as any).setStakeholders(data.stakeholderIds, { transaction: tx });
      }

      if (data.donorIds && data.donorIds.length) {
        await (project as any).setDonors(data.donorIds, { transaction: tx });
      }

      // Optionally create incoming document resources and associate
      if (data.documents && data.documents.length) {
        for (const res of data.documents) {
          await (project as any).createDocument({
            documentName: res.documentName,
            size: res.size ?? null,
            type: res.type ?? null,
            addedAt: res.addedAt ?? new Date(),
            documentUrl: res.documentUrl ?? null,
            userId: res.userId,
            publicId: res.publicId ?? null,
            deleteToken: res.deleteToken ?? null,
          }, { transaction: tx });
        }
      }

      

      const result = await db.Project.findByPk(project.id, {
        include: [
          { model: db.Document, as: 'documents' },
          { model: db.Organization, as: 'stakeholders', through: { attributes: [] } },
          { model: db.Organization, as: 'donors', through: { attributes: [] } },
          { model: db.Survey, as: 'surveys' },
          { model: db.InterventionArea, as: 'interventionArea' }, 
        ],
      });

      this.setStatus(201);
      await tx.commit();
      return ServiceResponse.success('Project created successfully', result, 201);
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  @Security('jwt', ['project:update'])
  @Put('/{projectId}')
  @asyncCatch
  public async updateProject(
    @Path() projectId: string,
    @Body() data: ProjectUpdateRequest
  ): Promise<ServiceResponse<any | null>> {
    const project = await db.Project.findByPk(projectId);
    if (!project) return ServiceResponse.failure('Project not found', null, 404);

    await project.update({
      name: data.name ?? project.name,
      description: data.description ?? project.description,
      status: (data.status as any) ?? project.status,
      targetGroup: data.targetGroup ?? project.targetGroup,
      geographicArea: data.geographicArea ?? project.geographicArea,
      startDate: data.startDate ?? project.startDate,
      endDate: data.endDate ?? project.endDate,
      donorIds: data.donorIds ?? project.donorIds,
    });

    if (data.stakeholderIds) {
      await (project as any).setStakeholders(data.stakeholderIds);
    }

    if (data.donorIds) {
      await (project as any).setDonors(data.donorIds);
    }

    // Remove selected existing documents
    if (data.removeDocumentIds && data.removeDocumentIds.length) {
      await db.Document.destroy({
        where: {
          id: data.removeDocumentIds,
          projectId: project.id,
        }
      });
    }

    // Add new documents (resources)
    if (data.documents && data.documents.length) {
      for (const res of data.documents) {
        await (project as any).createDocument({
          documentName: res.documentName,
          size: res.size ?? null,
          type: res.type ?? null,
          addedAt: res.addedAt ?? new Date(),
          documentUrl: res.documentUrl ?? null,
          userId: res.userId,
          publicId: res.publicId ?? null,
          deleteToken: res.deleteToken ?? null,
        });
      }
    }

    const result = await db.Project.findByPk(project.id, {
      include: [
        { model: db.Document, as: 'documents' },
        { model: db.Organization, as: 'stakeholders', through: { attributes: [] } },
        { model: db.Organization, as: 'donors', through: { attributes: [] } },
        { model: db.Survey, as: 'surveys' },
      ],
    });

    return ServiceResponse.success('Project updated successfully', result);
  }

  @Security('jwt', ['project:delete'])
  @Delete('/{projectId}')
  @SuccessResponse(204, 'No Content')
  @asyncCatch
  public async deleteProject(@Path() projectId: string): Promise<ServiceResponse<null>> {
    const project = await db.Project.findByPk(projectId);
    if (!project) return ServiceResponse.failure('Project not found', null, 404);

    await project.destroy();
    this.setStatus(204);
    return ServiceResponse.success('Project deleted successfully', null, 204);
  }

@Security('jwt', ['project:update'])
@Delete('/{projectId}/donors/{donorId}')
@SuccessResponse(200, 'Donor removed successfully')
@asyncCatch
public async removeDonorFromProject(
  @Path() projectId: string,
  @Path() donorId: string
): Promise<ServiceResponse<any>> {
  const project = await db.Project.findByPk(projectId);
  if (!project) return ServiceResponse.failure('Project not found', null, 404);

  const donor = await db.Organization.findByPk(donorId);
  if (!donor) return ServiceResponse.failure('Donor not found', null, 404);

  await (project as any).removeDonor(donorId);

  const result = await db.Project.findByPk(project.id, {
    include: [
      { model: db.Document, as: 'documents' },
      { model: db.Organization, as: 'stakeholders', through: { attributes: [] } },
      { model: db.Organization, as: 'donors', through: { attributes: [] } },
      { model: db.Survey, as: 'surveys' },
      { model: db.InterventionArea, as: 'interventionArea' },
    ],
  });

  return ServiceResponse.success('Donor removed from project successfully', result);
}

}
