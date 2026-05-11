import { Controller, Get, Post, Put, Delete, Route, Tags, Security, Path, Body, Query, Response as TsoaResponse } from '@tsoa/runtime';
import { Permission } from '@/models/permission';
import { ServiceResponse } from '@/utils/serviceResponse';
import { asyncCatch } from '@/middlewares/errorHandler';
import { Op } from 'sequelize';

export interface PermissionCreateRequest {
  name: string;
  description?: string | null;
}

export interface PermissionUpdateRequest {
  name?: string;
  description?: string | null;
}

@Route('api/permissions')
@Tags('Permissions')
export class PermissionsController extends Controller {
  @Get('/')
  @asyncCatch
  public async listPermissions(): Promise<ServiceResponse<any[]>> {
    const permissions = await Permission.findAll({
      order: [['name', 'ASC']],
    });

    return ServiceResponse.success(
      'Permissions retrieved successfully',
      permissions,
      200
    );
  }

  @Security('jwt', ['permission:read'])
  @Get('/{permissionId}')
  @asyncCatch
  @TsoaResponse<ServiceResponse<null>>(404, 'Permission not found')
  public async getPermission(@Path() permissionId: string): Promise<ServiceResponse<any | null>> {
    const permission = await Permission.findByPk(permissionId);
    
    if (!permission) {
      return ServiceResponse.failure('Permission not found', null, 404);
    }

    return ServiceResponse.success('Permission retrieved successfully', permission, 200);
  }

  @Security('jwt', ['permission:create'])
  @Post('/')
  @asyncCatch
  @TsoaResponse<ServiceResponse<null>>(400, 'Validation error')
  @TsoaResponse<ServiceResponse<null>>(409, 'Permission already exists')
  public async createPermission(@Body() data: PermissionCreateRequest): Promise<ServiceResponse<any | null>> {
    // Check if permission with same name already exists
    const existingPermission = await Permission.findOne({
      where: { name: data.name }
    });

    if (existingPermission) {
      return ServiceResponse.failure('Permission with this name already exists', null, 409);
    }

    const created = await Permission.create({
      name: data.name,
      description: data.description || null,
    });

    this.setStatus(201);
    return ServiceResponse.success('Permission created successfully', created, 201);
  }

  @Security('jwt', ['permission:update'])
  @Put('/{permissionId}')
  @asyncCatch
  @TsoaResponse<ServiceResponse<null>>(404, 'Permission not found')
  @TsoaResponse<ServiceResponse<null>>(409, 'Permission name already exists')
  public async updatePermission(@Path() permissionId: string, @Body() data: PermissionUpdateRequest): Promise<ServiceResponse<any | null>> {
    const permission = await Permission.findByPk(permissionId);
    if (!permission) return ServiceResponse.failure('Permission not found', null, 404);

    // Check if new name conflicts with existing permission
    if (data.name && data.name !== permission.name) {
      const existingPermission = await Permission.findOne({
        where: { 
          name: data.name,
          id: { [Op.ne]: permissionId }
        }
      });

      if (existingPermission) {
        return ServiceResponse.failure('Permission with this name already exists', null, 409);
      }
    }

    await permission.update({
      name: data.name ?? permission.name,
      description: data.description ?? permission.description,
    });

    const updated = await Permission.findByPk(permissionId);
    return ServiceResponse.success('Permission updated successfully', updated, 200);
  }

  @Security('jwt', ['permission:delete'])
  @Delete('/{permissionId}')
  @asyncCatch
  @TsoaResponse<ServiceResponse<null>>(404, 'Permission not found')
  @TsoaResponse<ServiceResponse<null>>(409, 'Cannot delete permission that is assigned to roles')
  public async deletePermission(@Path() permissionId: string): Promise<ServiceResponse<null>> {
    const permission = await Permission.findByPk(permissionId);
    if (!permission) return ServiceResponse.failure('Permission not found', null, 404);

    // Check if permission is assigned to any roles
    const roleCount = await (permission as any).countRoles();
    if (roleCount > 0) {
      return ServiceResponse.failure(
        'Cannot delete permission that is assigned to roles. Remove from roles first.',
        null,
        409
      );
    }

    await permission.destroy();
    return ServiceResponse.success('Permission deleted successfully', null, 200);
  }

}
