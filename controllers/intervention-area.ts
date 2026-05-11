// controllers/interventionAreaController.ts
import { Controller, Get, Post, Put, Delete, Route, Tags, Response, Body, Path, Query, Security } from '@tsoa/runtime';
import { ServiceResponse } from '../utils/serviceResponse';
import { asyncCatch } from '../middlewares/errorHandler';
import sequelize from '../config/database';
import db from '@/models';

interface InterventionAreaCreateRequest {
  name: string;
  description?: string | null;
  documents?: Array<{
    documentName: string;
    size?: number | null;
    type?: string | null;
    addedAt?: Date;
    documentUrl?: string | null;
    userId: string;
    publicId?: string | null;
    deleteToken?: string | null;
  }> | null;
}

interface InterventionAreaUpdateRequest extends Partial<InterventionAreaCreateRequest> {
  removeDocumentIds?: string[];
}

@Route('api/intervention-areas')
@Tags('Intervention Areas')
export class InterventionAreaController extends Controller {
  // @Security('jwt', ['intervention_area:read'])
  @Get('/')
  @asyncCatch
  public async getInterventionAreas(
    @Query() page: number = 1,
    @Query() limit: number = 10
  ): Promise<ServiceResponse<any[]>> {
    const offset = (page - 1) * limit;
    const { count, rows } = await db.InterventionArea.findAndCountAll({
      limit,
      offset,
      include: [
        { model: db.Document, as: 'documents' },
        { model: db.Project, as: 'projects' },
      ],
      order: [['createdAt', 'DESC']],
      distinct: true,
    });

    return ServiceResponse.success('Intervention areas retrieved successfully', rows, 200, { total: count, page, totalPages: Math.ceil(count / limit) });
  }

  // In your InterventionAreaController.ts
  @Get('/{interventionAreaId}')
  @asyncCatch
  @Response<ServiceResponse<null>>(404, 'Intervention area not found')
  public async getInterventionAreaById(@Path() interventionAreaId: string): Promise<ServiceResponse<any | null>> {
    const interventionArea = await db.InterventionArea.findByPk(interventionAreaId, {
      include: [
        {
          model: db.Document,
          as: 'documents'
        },
        {
          model: db.Project,
          as: 'projects'
        },
        // Remove the where clause from include and filter in JavaScript
        {
          model: db.Event,
          as: 'events',
          where: {
            status: ['upcoming', 'ongoing']
          },
          required: false,
          order: [
            ['status', 'ASC'],
            ['startDate', 'ASC']
          ],
          limit: 10
        }
      ],
    });

    if (!interventionArea) return ServiceResponse.failure('Intervention area not found', null, 404);
    return ServiceResponse.success('Intervention area retrieved successfully', interventionArea);
  }

  @Security('jwt', ['intervention_area:create'])
  @Post('/')
  @asyncCatch
  public async createInterventionArea(@Body() data: InterventionAreaCreateRequest): Promise<ServiceResponse<any | null>> {
    const tx = await sequelize.transaction();
    try {
      console.log('=== Creating Intervention Area ===');
      console.log('Payload received:', JSON.stringify(data, null, 2));

      const interventionArea = await db.InterventionArea.create({
        name: data.name,
        description: data.description ?? null,
      }, { transaction: tx });

      console.log('✓ Intervention area created with ID:', interventionArea.id);

      // Create documents using association method (same as Project)
      if (data.documents && data.documents.length) {
        console.log(`Creating ${data.documents.length} documents...`);

        for (const doc of data.documents) {
          console.log('Creating document:', doc.documentName);

          // Use createDocument association method (same as Project does)
          await (interventionArea as any).createDocument({
            documentName: doc.documentName,
            size: doc.size ?? null,
            type: doc.type ?? null,
            addedAt: doc.addedAt ?? new Date(),
            documentUrl: doc.documentUrl ?? null,
            userId: doc.userId,
            publicId: doc.publicId ?? null,
            deleteToken: doc.deleteToken ?? null,
          }, { transaction: tx });

          console.log('✓ Document created:', doc.documentName);
        }
        console.log('✓ All documents created successfully');
      } else {
        console.log('⚠ No documents to create');
      }

      const result = await db.InterventionArea.findByPk(interventionArea.id, {
        include: [
          { model: db.Document, as: 'documents' },
        ],
        transaction: tx,
      });

      console.log('✓ Final result with', result?.documents?.length || 0, 'documents');

      this.setStatus(201);
      await tx.commit();
      return ServiceResponse.success('Intervention area created successfully', result, 201);
    } catch (err) {
      console.error('✗ Error creating intervention area:', err);
      await tx.rollback();
      throw err;
    }
  }

  @Security('jwt', ['intervention_area:update'])
  @Put('/{interventionAreaId}')
  @asyncCatch
  public async updateInterventionArea(
    @Path() interventionAreaId: string,
    @Body() data: InterventionAreaUpdateRequest
  ): Promise<ServiceResponse<any | null>> {
    const interventionArea = await db.InterventionArea.findByPk(interventionAreaId);
    if (!interventionArea) return ServiceResponse.failure('Intervention area not found', null, 404);

    await interventionArea.update({
      name: data.name ?? interventionArea.name,
      description: data.description ?? interventionArea.description,
    });

    // Remove selected documents
    if (data.removeDocumentIds && data.removeDocumentIds.length) {
      await db.Document.destroy({
        where: {
          id: data.removeDocumentIds,
          interventionAreaId: interventionArea.id,
        }
      });
    }

    // Add new documents
    if (data.documents && data.documents.length) {
      for (const doc of data.documents) {
        await (interventionArea as any).createDocument({
          documentName: doc.documentName,
          size: doc.size ?? null,
          type: doc.type ?? null,
          addedAt: doc.addedAt ?? new Date(),
          documentUrl: doc.documentUrl ?? null,
          userId: doc.userId,
          publicId: doc.publicId ?? null,
          deleteToken: doc.deleteToken ?? null,
        });
      }
    }

    const result = await db.InterventionArea.findByPk(interventionArea.id, {
      include: [
        { model: db.Document, as: 'documents' },
        { model: db.Project, as: 'projects' },
      ],
    });

    return ServiceResponse.success('Intervention area updated successfully', result);
  }

  @Security('jwt', ['intervention_area:delete'])
  @Delete('/{interventionAreaId}')
  @asyncCatch
  public async deleteInterventionArea(@Path() interventionAreaId: string): Promise<ServiceResponse<null>> {
    const interventionArea = await db.InterventionArea.findByPk(interventionAreaId);
    if (!interventionArea) return ServiceResponse.failure('Intervention area not found', null, 404);

    await interventionArea.destroy();
    this.setStatus(204);
    return ServiceResponse.success('Intervention area deleted successfully', null, 204);
  }


}

