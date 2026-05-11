import { Controller, Get, Post, Put, Delete, Route, Tags, Response, SuccessResponse, Body, Path, Query, Security } from '@tsoa/runtime';
import { ServiceResponse } from '../utils/serviceResponse';
import { Role } from '../models/role';
import Permission from '../models/permission';
import { asyncCatch } from '@/middlewares/errorHandler';
import { Op } from 'sequelize';

interface RoleCreateRequest {
  name: string;
  description?: string | null;
  category?: string | null;
  permissionIds?: string[];
}

interface RoleUpdateRequest {
  name?: string;
  description?: string | null;
  category?: string | null;
  permissionIds?: string[]; // if provided, replace associations with this set
}

@Route('api/roles')
@Tags('Roles')
export class RolesController extends Controller {
  @Security('jwt', ['role:read'])
  @Get('/')
  @asyncCatch
  public async listRoles(
    @Query() page?: number,
    @Query() limit?: number,
    @Query() search?: string,
    @Query() category?: string
  ): Promise<ServiceResponse<any[]>> {
    const where: any = {};

    // Add search functionality using Sequelize operators
    if (search && search.trim()) {
      const searchTerm = search.trim();
      where[Op.or] = [
        { name: { [Op.like]: `%${searchTerm}%` } },
        { description: { [Op.like]: `%${searchTerm}%` } },
        { category: { [Op.like]: `%${searchTerm}%` } }
      ];
    }

    // Filter by category if provided
    if (category && category.trim()) {
      const categoryTerm = category.trim();
      where.category = { [Op.like]: `%${categoryTerm}%` };
    }

    const queryOptions: any = {
      where,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Permission,
          as: 'permissions',
          attributes: ['id', 'name', 'description'],
        },
      ],
      distinct: true,
    };

    if (limit && page) {
      queryOptions.limit = limit;
      queryOptions.offset = (page - 1) * limit;
    }

    const { count, rows } = await Role.findAndCountAll(queryOptions);

    const totalPages = limit ? Math.ceil(count / limit) : 1;

    return ServiceResponse.success(
      'Roles retrieved successfully',
      rows,
      200,
      { total: count, page: page || 1, totalPages }
    );
  }

  @Security('jwt', ['role:read'])
  @Get('/{roleId}')
  @asyncCatch
  @Response<ServiceResponse<null>>(404, 'Role not found')
  public async getRole(@Path() roleId: string): Promise<ServiceResponse<any | null>> {
    const role = await Role.findByPk(roleId, {
      include: [{
        model: Permission,
        as: 'permissions',
        attributes: ['id', 'name', 'description']
      }]
    });

    if (!role) return ServiceResponse.failure('Role not found', null, 404);
    return ServiceResponse.success('Role retrieved successfully', role);
  }

  @Security('jwt', ['role:create'])
  @Post('/')
  @asyncCatch
  public async createRole(@Body() data: RoleCreateRequest): Promise<ServiceResponse<any | null>> {
    const created = await Role.create({
      name: data.name,
      description: data.description ?? null,
      category: data.category ?? null,
    });

    if (data.permissionIds && data.permissionIds.length > 0) {
      await (created as any).setPermissions(data.permissionIds);
    }

    this.setStatus(201);
    const result = await Role.findByPk(created.id, {
      include: [{
        model: Permission,
        as: 'permissions',
        attributes: ['id', 'name', 'description']
      }]
    });

    return ServiceResponse.success('Role created successfully', result, 201);
  }

  @Security('jwt', ['role:update'])
  @Put('/{roleId}')
  @asyncCatch
  public async updateRole(@Path() roleId: string, @Body() data: RoleUpdateRequest): Promise<ServiceResponse<any | null>> {
    const role = await Role.findByPk(roleId);
    if (!role) return ServiceResponse.failure('Role not found', null, 404);

    await role.update({
      name: data.name ?? role.name,
      description: data.description ?? role.description,
      category: data.category ?? role.category ?? null,
    });

    if (data.permissionIds) {
      await (role as any).setPermissions(data.permissionIds);
    }

    const result = await Role.findByPk(role.id, {
      include: [{
        model: Permission,
        as: 'permissions',
        attributes: ['id', 'name', 'description']
      }]
    });

    return ServiceResponse.success('Role updated successfully', result);
  }

  @Security('jwt', ['role:delete'])
  @Delete('/{roleId}')
  @asyncCatch
  @SuccessResponse(204, 'No Content')
  public async deleteRole(@Path() roleId: string): Promise<ServiceResponse<null>> {
    const role = await Role.findByPk(roleId);
    if (!role) return ServiceResponse.failure('Role not found', null, 404);

    await role.destroy();
    this.setStatus(204);
    return ServiceResponse.success('Role deleted successfully', null, 204);
  }

  @Security('jwt', ['role:update'])
  @Post('/{roleId}/permissions')
  @asyncCatch
  public async addPermission(
    @Path() roleId: string,
    @Body() body: { permissionId: string }
  ): Promise<ServiceResponse<any | null>> {
    const role = await Role.findByPk(roleId);
    if (!role) return ServiceResponse.failure('Role not found', null, 404);

    await role.addPermissionById(body.permissionId);

    const result = await Role.findByPk(role.id, {
      include: [{
        model: Permission,
        as: 'permissions',
        attributes: ['id', 'name', 'description']
      }]
    });

    return ServiceResponse.success('Permission added to role', result);
  }

  @Security('jwt', ['role:update'])
  @Delete('/{roleId}/permissions/{permissionId}')
  @asyncCatch
  @SuccessResponse(204, 'No Content')
  public async removePermission(
    @Path() roleId: string,
    @Path() permissionId: string
  ): Promise<ServiceResponse<null>> {
    const role = await Role.findByPk(roleId);
    if (!role) return ServiceResponse.failure('Role not found', null, 404);

    await role.removePermissionById(permissionId);

    this.setStatus(204);
    return ServiceResponse.success('Permission removed from role', null, 204);
  }
}
