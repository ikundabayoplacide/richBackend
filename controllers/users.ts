import { Controller, Get, Post, Put, Delete, Route, Tags, Response, SuccessResponse, Body, Path, Query, Security, Request } from '@tsoa/runtime';
import { ServiceResponse } from '../utils/serviceResponse';
import { User } from '../models/users';
import { Role } from '../models/role';
import { IUserCreateRequest, IUserResponse, IUserUpdateRequest } from '../types/user-controller-types';
import { asyncCatch } from '../middlewares/errorHandler';
import { hash } from 'bcrypt';
import sequelize from '../config/database';
import { Op } from 'sequelize';
import Stakeholder from '../models/organization';
import { createSystemLog } from '../utils/systemLog';
import db from '@/models';

@Route("api/users")
@Tags("Users")
export class UserController extends Controller {

  private async _buildUserResponse(user: User): Promise<IUserResponse> {
    const roles = await user.getRoles({
      attributes: ['id', 'name', 'description'],
    });
    const { password, resetPasswordCode, resetPasswordExpires, ...userData } = user.toJSON();
    return {
      ...userData,
      roles,
      createdAt: user.createdAt ? new Date(user.createdAt) : undefined,
      updatedAt: user.updatedAt ? new Date(user.updatedAt) : undefined,
    };
  }

  @Security("jwt", ["user:create", "user:update", "user:delete"])
  @Get("/")
  @asyncCatch
  public async getUsers(
    @Query() page: number = 1,
    @Query() limit: number = 10,
    @Query() search?: string,
    @Query() userType?: string
  ): Promise<ServiceResponse<IUserResponse[]>> {
    // Handle request for all users (limit = -1) set offset to 0 to get all users
    const offset = limit > 0 ? (page - 1) * limit : 0; // Handle negative limit

    // Build where clause for search
    let whereClause: any = {};
    let searchConditions: any = {};

    // Add userType filter if provided
    if (userType && userType.trim()) {
      whereClause.userType = userType;
    }

    if (search && search.trim()) {
      const searchTerm = `%${search.toLowerCase()}%`;

      searchConditions = {
        [Op.or]: [
          // Search in user fields with proper table qualification
          sequelize.where(sequelize.fn('LOWER', sequelize.col('User.name')), {
            [Op.like]: searchTerm
          }),
          sequelize.where(sequelize.fn('LOWER', sequelize.col('User.email')), {
            [Op.like]: searchTerm
          }),
          sequelize.where(sequelize.fn('LOWER', sequelize.col('User.phone')), {
            [Op.like]: searchTerm
          }),
          sequelize.where(sequelize.fn('LOWER', sequelize.col('User.district')), {
            [Op.like]: searchTerm
          }),
          sequelize.where(sequelize.fn('LOWER', sequelize.col('User.sector')), {
            [Op.like]: searchTerm
          }),
          sequelize.where(sequelize.fn('LOWER', sequelize.col('User.cell')), {
            [Op.like]: searchTerm
          }),
          sequelize.where(sequelize.fn('LOWER', sequelize.col('User.village')), {
            [Op.like]: searchTerm
          }),
          sequelize.where(sequelize.fn('LOWER', sequelize.col('User.address')), {
            [Op.like]: searchTerm
          })
        ]
      };
    }

    // Combine where conditions with search conditions (same as feedback controller)
    const finalWhere = search && search.trim()
      ? { [Op.and]: [whereClause, searchConditions] }
      : whereClause;


    const queryOptions: any = {
      offset,
      order: [['createdAt', 'DESC']],
      where: finalWhere,
      include: [{
        model: Role,
        as: 'roles',
        attributes: ['id', 'name', 'description'],
        through: { attributes: [] },
        required: false // Use left join to include users without roles
      }],
      distinct: true,
    }

    if (limit > 0) {
      queryOptions.limit = limit;
    }

    const { count, rows: users } = await User.findAndCountAll(queryOptions);

    const userResponses = await Promise.all(users.map(user => this._buildUserResponse(user)));

    return ServiceResponse.success('Users retrieved successfully', userResponses, 200, {
      total: count,
      page,
      totalPages: Math.ceil(count / limit)
    });
  }

  @Security("jwt", ["user:view"])
  @Get("/{userId}")
  @asyncCatch
  @Response<ServiceResponse<null>>(404, "User not found")
  public async getUserById(
    @Path() userId: string
  ): Promise<ServiceResponse<IUserResponse | null>> {
    const user = await User.findByPk(userId, {
      include: [
        {
          model: Role,
          as: 'roles',
          attributes: ['id', 'name', 'description'],
          through: { attributes: [] },
          required: false
        }
      ]
    });

    if (!user) {
      return ServiceResponse.failure('User not found', null, 404);
    }

    // Fetch user's feedbacks
    const feedbacks = await db.Feedback.findAll({
      where: { userId: userId },
      include: [
        {
          model: db.Project,
          as: 'project',
          attributes: ['id', 'name', 'description']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 50 // Limit to recent 50 feedbacks
    });

    // Fetch user's survey responses
    const surveyResponses = await db.Response.findAll({
      where: { userId: userId },
      include: [
        {
          model: db.Survey,
          as: 'survey',
          attributes: ['id', 'title', 'description', 'surveyType'],
          where: { surveyType: 'general' },
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 50 // Limit to recent 50 responses
    });

    // Fetch user's system logs
    const systemLogs = await db.SystemLog.findAll({
      where: { userId: userId },
      order: [['createdAt', 'DESC']],
      limit: 100 // Limit to recent 100 logs
    });

    // Build user response with roles
    const { password, resetPasswordCode, resetPasswordExpires, ...userData } = user.toJSON();

    const userResponse = {
      ...userData,
      roles: user.roles || [],
      feedbacks: feedbacks.map(f => f.toJSON()),
      surveyResponses: surveyResponses.map(r => r.toJSON()),
      systemLogs: systemLogs.map(l => l.toJSON())
    };

    return ServiceResponse.success('User retrieved successfully', userResponse as any);
  }

  @Security("jwt", ["user:create"])
  @Post("/")
  @Response<ServiceResponse<null>>(400, "Email already in use")
  public async createUser(
    @Request() req: any,
    @Body() userData: IUserCreateRequest
  ): Promise<ServiceResponse<IUserResponse | null>> {
    if (await User.findOne({ where: { email: userData.email } })) {
      return ServiceResponse.failure('Email already in use', null, 400);
    }

    // Generate default password if not provided
    const generateDefaultPassword = () => {
      const base = (userData.name || 'User').trim().split(' ').join('').slice(0, 6);
      const rand = Math.random().toString(36).slice(-4);
      return `${base}${rand}!`;
    };

    const plainPassword = userData.password ? userData.password : generateDefaultPassword();

    const hashedPassword = await hash(plainPassword, 10);

    const newUser = await sequelize.transaction(async (t) => {
      const user = await User.create({ ...userData, password: hashedPassword, status: 'pending' }, { transaction: t });

      // Assign explicit roleIds if provided
      if ((userData as any).roleIds && (userData as any).roleIds.length > 0) {
        const roles = await Role.findAll({ where: { id: (userData as any).roleIds }, transaction: t });
        if (roles.length) {
          await user.setRoles(roles, { transaction: t });
        }
      } else {
        const userRole = await Role.findOne({ where: { name: 'general_population' }, transaction: t });
        if (userRole) {
          await user.addRole(userRole, { transaction: t });
        }
      }

      // If a stakeholderId was provided, associate user -> stakeholder
      const stakeholderId = (userData as any).stakeholderId;
      if (stakeholderId) {
        const stakeholder = await Stakeholder.findByPk(stakeholderId, { transaction: t });
        if (stakeholder) {
          // create association
          await (stakeholder as any).addUser(user, { transaction: t });
        }
      }

      return user;
    });

    const userResponse = await this._buildUserResponse(newUser);
    this.setStatus(201);
    // Log activity
    await createSystemLog(req ?? null, 'created_user', 'User', newUser.id, { email: newUser.email });
    return ServiceResponse.success('User created successfully', userResponse, 201);
  }

  @Security("jwt", ["user:update"])
  @Put("/{userId}")
  @Response<ServiceResponse<null>>(404, "User not found")
  @Response<ServiceResponse<null>>(400, "Email already in use")
  @asyncCatch
  public async updateUser(
    @Request() req: any,
    @Path() userId: string,
    @Body() userData: IUserUpdateRequest
  ): Promise<ServiceResponse<IUserResponse | null>> {
    const user = await User.findByPk(userId);
    if (!user) {
      return ServiceResponse.failure('User not found', null, 404);
    }

    if (userData.email && userData.email !== user.email) {
      if (await User.findOne({ where: { email: userData.email } })) {
        return ServiceResponse.failure('Email already in use', null, 400);
      }
    }

    await user.update(userData);
    const userResponse = await this._buildUserResponse(user);
    await createSystemLog(req ?? null, 'updated_user', 'User', user.id, { changes: Object.keys(userData) });
    return ServiceResponse.success('User updated successfully', userResponse);
  }

  @Security("jwt", ["user:update"])
  @Put("/{userId}/roles")
  @Response<ServiceResponse<null>>(404, "User not found")
  @Response<ServiceResponse<null>>(400, "Invalid role IDs provided")
  @asyncCatch
  public async updateUserRoles(
    @Request() req: any,
    @Path() userId: string,
    @Body() roleData: { roleIds: string[] }
  ): Promise<ServiceResponse<IUserResponse | null>> {
    const user = await User.findByPk(userId);
    if (!user) {
      return ServiceResponse.failure('User not found', null, 404);
    }

    // Validate that all provided role IDs exist
    const roles = await Role.findAll({
      where: { id: roleData.roleIds },
      attributes: ['id', 'name', 'description']
    });

    if (roles.length !== roleData.roleIds.length) {
      const foundRoleIds = roles.map(role => role.id);
      const invalidRoleIds = roleData.roleIds.filter(id => !foundRoleIds.includes(id));
      return ServiceResponse.failure(
        `Invalid role IDs provided: ${invalidRoleIds.join(', ')}`,
        null,
        400
      );
    }

    await sequelize.transaction(async (t) => {
      // Replace all user roles with the new ones
      await user.setRoles(roles, { transaction: t });
    });

    const userResponse = await this._buildUserResponse(user);
    await createSystemLog(
      req ?? null,
      'updated_user_roles',
      'User',
      user.id,
      {
        roleIds: roleData.roleIds,
        roleNames: roles.map(role => role.name)
      }
    );

    return ServiceResponse.success('User roles updated successfully', userResponse);
  }

  @Security("jwt", ["user:delete"])
  @Delete("/{userId}")
  @SuccessResponse(204, "No Content")
  @Response<ServiceResponse<null>>(404, "User not found")
  @asyncCatch
  public async deleteUser(
    @Request() req: any,
    @Path() userId: string
  ): Promise<ServiceResponse<null>> {
    const user = await User.findByPk(userId);
    if (!user) {
      return ServiceResponse.failure('User not found', null, 404);
    }

    await user.destroy();
    await createSystemLog(req ?? null, 'deleted_user', 'User', userId, { deletedEmail: user.email });
    this.setStatus(204);
    return ServiceResponse.success('User deleted successfully', null, 204);
  }
}
