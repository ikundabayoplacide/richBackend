import sequelize from '@/config/database';
import { asyncCatch } from '@/middlewares/errorHandler';
import db from '@/models';
import Response from '@/models/response';
import { ServiceResponse } from '@/utils/serviceResponse';
import { Body, Controller, Post, Request, Route, Tags, Security } from '@tsoa/runtime';
import { createSystemLog } from '@/utils/systemLog';

interface ShareResponseRequest {
  responseIds: string[];
  roleIds: string[];
}

@Route('api')
@Tags('Share Responses')
export class ShareResponseController extends Controller {
  @Security('jwt', ['survey:update']) // Add appropriate permission
  @Post('/responses/share')
  @asyncCatch
  public async shareResponseWithRoles(
    @Request() request: any,
    @Body() data: ShareResponseRequest
  ): Promise<ServiceResponse<any>> {
    const { responseIds, roleIds } = data;

    // Validate inputs
    if (!responseIds || responseIds.length === 0) {
      return ServiceResponse.failure('No response IDs provided', null, 400);
    }
    if (!roleIds || roleIds.length === 0) {
      return ServiceResponse.failure('No role IDs provided', null, 400);
    }

    // Execute within a transaction
    const result = await sequelize.transaction(async (t) => {
      // Find the responses
      const responses = await Response.findAll({
        where: { id: responseIds },
        include: [{ model: db.Role, as: 'allowedRoles' }],
        transaction: t,
      });

      if (responses.length === 0) {
        throw new Error('No responses found with the provided IDs');
      }

      // Find the roles
      const roles = await db.Role.findAll({
        where: { id: roleIds },
        transaction: t,
      });

      if (roles.length === 0) {
        throw new Error('No roles found with the provided IDs');
      }

      // Assign (share) each response to selected roles
      for (const response of responses) {
        await (response as any).setAllowedRoles(roles, { transaction: t });
      }

      return {
        sharedCount: responses.length,
        roleCount: roles.length,
      };
    });

    // Log the sharing action
    await createSystemLog(request ?? null, 'shared_responses', 'Response', null, {
      responseCount: result.sharedCount,
      roleCount: result.roleCount,
      responseIds: responseIds,
      roleIds: roleIds
    });
    
    return ServiceResponse.success('Responses shared successfully', result);
  }
}