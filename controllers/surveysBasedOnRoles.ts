import { Controller, Get, Post, Put, Delete, Route, Tags, Response, SuccessResponse, Body, Path, Query, Security, Request } from '@tsoa/runtime';
import { ServiceResponse } from '../utils/serviceResponse';
import { asyncCatch } from '../middlewares/errorHandler';
import sequelize from '../config/database';
import { Op, or } from 'sequelize';
import db from '@/models';
import { createSystemLog } from '../utils/systemLog';
import { reverseGeocode } from '../utils/geocoding';
import { randomUUID } from 'crypto';
import type { Includeable } from 'sequelize';
import { sortAnswersByQuestionNumber } from '../utils/sortAnswers';

interface SurveyCreateRequest {
  title: string;
  description: string;
  projectId?: string | null;
  surveyType: "general" | "report-form" | "rapid-enquiry" | undefined
  startAt: string; // ISO timestamp, required
  endAt: string;   // ISO timestamp, required
  estimatedTime: string; // string to match UI
  sections: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
  questions: Array<
    | {
      id: number;
      type: 'single_choice' | 'multiple_choice';
      title: string;
      description: string;
      required: boolean;
      sectionId: string;
      questionNumber?: number;
      options: string[];
    }
    | {
      id: number;
      type: 'text_input' | 'textarea';
      title: string;
      description: string;
      required: boolean;
      sectionId: string;
      questionNumber?: number;
      placeholder: string;
    }
    | {
      id: number;
      type: 'file_upload';
      title: string;
      description: string;
      required: boolean;
      sectionId: string;
      questionNumber?: number;
      allowedTypes: string[];
      maxSize: number;
    }
    | {
      id: number;
      type: 'rating';
      title: string;
      description: string;
      required: boolean;
      sectionId: string;
      questionNumber?: number;
      maxRating: number;
      ratingLabel?: string;
    }
    | {
      id: number;
      type: 'linear_scale';
      title: string;
      description: string;
      required: boolean;
      sectionId: string;
      questionNumber?: number;
      minValue: number;
      maxValue: number;
      minLabel?: string;
      maxLabel?: string;
    }
  >;
  allowedRoles?: string[]; // NEW: array of Role IDs allowed to view/answer
}

interface SurveyUpdateRequest extends Partial<SurveyCreateRequest> {
  status?: "draft" | "active" | "paused" | "archived";
  projectId?: string | null;
}

@Route('api/surveys')
@Tags('Surveys')
export class SurveyController extends Controller {
  @Security('jwt', ['survey:read'])
  @Get('/')
  @asyncCatch
  public async getSurveys(
    @Request() request: any,
    @Query() page: number = 1,
    @Query() limit: number = 10,
    @Query() status?: 'draft' | 'active' | 'paused' | 'archived',
    @Query() surveyType?: 'general' | 'report-form' | 'rapid-enquiry',
    @Query() owner?: 'me' | 'others' | 'any', // owner filter
    @Query() responded?: boolean, // if true, return only surveys the current user has answered
    @Query() allowed?: boolean, // if true, return only surveys that allow any of the current user's roles
    @Query() available?: boolean, // if true, return only surveys the current user hasn't responded to
    @Query() startDate?: string,
    @Query() endDate?: string,
    @Query() search?: string
  ): Promise<ServiceResponse<any[]>> {
    const offset = (page - 1) * limit;
    const where: any = {};
    const userId = request?.user?.id ?? null;

    // this is check skateholder ids for organization owner
    const user = request?.user;
    const userStakeholderIds = user?.stakeholderIds || [];

  const includeArr: any[] = [
  {
    model: db.Section,
    as: 'sections',
    separate: true,
    order: [['order', 'ASC']],
  },
  {
    model: db.Question,
    as: 'questionItems',
    separate: true,
    order: [['questionNumber', 'ASC']],
    include: [{ model: db.Section, as: 'section', order: [['order', 'ASC']] }],
  },
  {
    model: db.Response,
    as: 'responses',
    include: [
      {
        model: db.Answer,
        as: 'answers',
        include: [
          { model: db.User, as: 'user', attributes: ['id', 'name'] },
          { model: db.Question, as: 'question', attributes: ['id', 'questionNumber', 'title'] }
        ],
      },
      { model: db.User, as: 'user', attributes: ['id', 'name'] },
    ],
  },
  {
    model: db.Role,
    as: 'allowedRoles',
    through: { attributes: [] },
    required: false,
  },
  {
    model: db.Organization,
    as: 'organization',
    attributes: ['id', 'name'],
  },
  {
    model: db.User,
    as: 'creator',
    attributes: ['id', 'name'],
  },
  {
    model: db.Project,
    as: 'project',
    attributes: ['id', 'name', 'status'],
  },
  {
    model: db.UserSurveyView,
    as: 'userViews',
    where: { userId },
    required: false,
  },
];

    if (userStakeholderIds.length > 0) {
      // Organization owner - only see surveys for projects where their org is a donor
      includeArr.push({
        model: db.Project,
        as: 'project',
        attributes: ['id', 'name', 'status'],
        required: true, // INNER JOIN - only surveys with projects
        include: [
          {
            model: db.Organization,
            as: 'donors',
            through: { attributes: [] },
            where: {
              id: userStakeholderIds, // Only projects where user's org is donor
            },
            required: true, // INNER JOIN - only projects with matching donors
          }
        ]
      });
    } else {
      // Super admin - see all surveys
      includeArr.push({
        model: db.Project,
        as: 'project',
        attributes: ['id', 'name', 'status'],
        required: false, // LEFT JOIN - include surveys even without projects
      });
    }
    // DATE RANGE FILTER
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    // STATUS FILTER
    if (status) where.status = status;

    // SURVEY TYPE FILTER
    if (surveyType) where.surveyType = surveyType;

    // SEARCH FILTER (title, description)
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      // Ensure Op.and exists if already used elsewhere
      where[Op.and] = where[Op.and] || [];
      (where[Op.and] as any[]).push({
        [Op.or]: [
          { title: { [Op.like]: term } },
          { description: { [Op.like]: term } },
        ],
      });
    }

    // OWNER FILTERING (requires authenticated user)
    if (owner === 'me') {
      if (!userId) {
        return ServiceResponse.failure('Authentication required to filter by owner', [], 401);
      }
      where.createdBy = userId;
    } else if (owner === 'others') {
      if (!userId) {
        return ServiceResponse.failure('Authentication required to filter by owner', [], 401);
      }
      where.createdBy = { [Op.ne]: userId };
    }
    // else {
    //     return ServiceResponse.failure('Invalid owner filter value', [], 400);
    // }

    // RESPONDED FILTERING (requires authenticated user)
    if (responded) {
      if (!userId) {
        return ServiceResponse.failure('Authentication required to filter by responded', [], 401);
      }
      // require at least one response by this user (inner join)
      includeArr[2] = {
        model: db.Response, as: 'responses', required: true, where: { userId }, include: [
          {
            model: db.Answer,
            as: 'answers',
            include: [
              { model: db.User, as: 'user', attributes: ['id', 'name'] },
              { model: db.Question, as: 'question', attributes: ['id', 'questionNumber', 'title'] }
            ]
          },
          { model: db.User, as: 'user', attributes: ['id', 'name'] }
        ]
      };
    }

    // AVAILABLE FILTERING: only surveys the current user hasn't responded to
    if (available) {
      if (!userId) {
        return ServiceResponse.failure('Authentication required to filter by available', [], 401);
      }

      // Use a subquery approach to exclude surveys the user has already responded to
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push({
        id: {
          [Op.notIn]: db.sequelize.literal(`(
            SELECT DISTINCT surveyId 
            FROM responses 
            WHERE userId = '${userId}'
          )`)
        }
      });
    }

    // ALLOWED FILTERING: only surveys that allow any of the current user's roles
    if (allowed) {
      if (!userId) {
        return ServiceResponse.failure('Authentication required to filter by allowed', [], 401);
      }
      // load user's roles
      const user = await db.User.findByPk(userId, {
        include: [{ model: db.Role, as: 'roles', through: { attributes: [] } }],
      });

      const roleIds = (user?.roles ?? []).map((r: any) => r.id).filter(Boolean);
      if (!roleIds.length) {
        // user has no roles -> no surveys allowed
        return ServiceResponse.success('Surveys retrieved successfully', [], 200, { total: 0, page, totalPages: 0 });
      }

      // replace allowedRoles include to be required and filter by user's role ids (inner join)
      includeArr[3] = {
        model: db.Role,
        as: 'allowedRoles',
        through: { attributes: [] },
        required: true,
        where: { id: roleIds },
      };
    }

    const { count, rows } = await db.Survey.findAndCountAll({
      limit,
      offset,
     order: [['createdAt', 'DESC']],
      where,
      include: includeArr,
      distinct: true,
    });

    // Sort answers by question number for each response
    const processedRows = rows.map((survey: any) => {
      const surveyData = survey.toJSON();
      if (surveyData.responses) {
        surveyData.responses = surveyData.responses.map((response: any) => {
          if (response.answers) {
            response.answers.sort((a: any, b: any) => {
              const qNumA = a.question?.questionNumber ?? 999999;
              const qNumB = b.question?.questionNumber ?? 999999;
              return qNumA - qNumB;
            });
          }
          return response;
        });
      }
      return surveyData;
    });

    // Add isNew flag to each survey
    const surveysWithIsNew = processedRows.map((survey: any) => {
      const isNew = !survey.userViews || survey.userViews.length === 0;
      return {
        ...survey,
        isNew,
      };
    });

    return ServiceResponse.success(
      'Surveys retrieved successfully',
      surveysWithIsNew,
      200,
      { total: count, page, totalPages: Math.ceil(count / limit) }
    );
  }

  @Security('jwt', ['survey:read'])
  @Get('/{surveyId}/analytics')
  @asyncCatch
  public async getSurveyAnalytics(@Path() surveyId: string, @Query() startDate?: string, @Query() endDate?: string): Promise<ServiceResponse<any>> {

    const where: any = {};
    if (startDate) where.createdAt = { [Op.gte]: new Date(startDate) };
    if (endDate) where.createdAt = { [Op.lte]: new Date(endDate) };

    const survey = await db.Survey.findByPk(surveyId, {
      attributes: ['id', 'title', 'estimatedTime', 'status', 'surveyType', 'createdAt'],
      include: [
        { model: db.Question, as: 'questionItems', attributes: ['id', 'type', 'title', 'required', 'options', 'minValue', 'maxValue', 'maxRating'], order: [['questionNumber', 'ASC']] } as Includeable,
      ],
    });
    if (!survey) return ServiceResponse.failure('Survey not found', null, 404);

    // Load responses and answers
    const responses = await db.Response.findAll({
      where: { surveyId, ...where },
      attributes: ['id', 'userId', 'createdAt'],
      order: [['createdAt', 'ASC']],
      include: [
        {
          model: db.Answer,
          as: 'answers',
          attributes: ['id', 'questionId', 'answerText', 'answerOptions', 'createdAt'],
          include: [{ model: db.Question, as: 'question', attributes: ['id', 'questionNumber', 'title'] }]
        },
        { model: db.User, as: 'user', attributes: ['id'] },
      ],
    });

    // Sort answers by question number
    const processedResponses = responses.map((r: any) => {
      const rData = r.toJSON();
      if (rData.answers) {
        rData.answers.sort((a: any, b: any) => {
          const qNumA = a.question?.questionNumber ?? 999999;
          const qNumB = b.question?.questionNumber ?? 999999;
          return qNumA - qNumB;
        });
      }
      return rData;
    });

    const totalResponses = processedResponses.length;
    const uniqueRespondents = new Set<string>();
    const trendsMap: Record<string, number> = {};

    for (const r of processedResponses as any[]) {
      if (r.user?.id) uniqueRespondents.add(r.user.id);
      const d = new Date(r.createdAt);
      const key = d.toISOString().slice(0, 10);
      trendsMap[key] = (trendsMap[key] ?? 0) + 1;
    }

    const trends = Object.keys(trendsMap)
      .sort()
      .map(date => ({ date, count: trendsMap[date] }));

    // Build question analytics
    const questionItems = (survey as any).questionItems || [];
    const questionById: Record<string, any> = {};
    for (const q of questionItems) questionById[q.id] = q;

    const questionAnalytics: any[] = [];
    for (const q of questionItems) {
      const answersForQ: any[] = [];
      for (const r of processedResponses as any[]) {
        const found = (r.answers || []).filter((a: any) => a.questionId === q.id);
        answersForQ.push(...found);
      }

      const responseCount = answersForQ.length;
      const required = !!q.required;
      const skipRate = totalResponses > 0 ? Math.max(0, (totalResponses - responseCount) / totalResponses) : 0;

      let answerDistribution: any = {};
      if (q.type === 'single_choice' || q.type === 'multiple_choice') {
        answerDistribution = {} as Record<string, number>;

        // Initialize all possible options with 0 count
        if (q.options) {
          let allOptions: string[] = [];
          try {
            allOptions = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
          } catch (e) {
            allOptions = [];
          }

          // Initialize all options with 0
          for (const option of allOptions) {
            answerDistribution[String(option)] = 0;
          }
        }

        // Count actual responses
        for (const a of answersForQ) {
          const opts: string[] = Array.isArray(a.answerOptions) ? a.answerOptions : (a.answerOptions ? [a.answerOptions] : []);
          if (!opts.length && a.answerText) {
            // fallback when stored as text
            const k = String(a.answerText);
            answerDistribution[k] = (answerDistribution[k] ?? 0) + 1;
          } else {
            for (const opt of opts) {
              const k = String(opt);
              answerDistribution[k] = (answerDistribution[k] ?? 0) + 1;
            }
          }
        }
      } else if (q.type === 'rating' || q.type === 'linear_scale') {
        const values: number[] = [];
        for (const a of answersForQ) {
          const v = a.answerText != null ? Number(a.answerText) : NaN;
          if (!Number.isNaN(v)) values.push(v);
        }
        const sum = values.reduce((acc, n) => acc + n, 0);
        const avg = values.length ? sum / values.length : 0;
        const min = values.length ? Math.min(...values) : 0;
        const max = values.length ? Math.max(...values) : 0;
        answerDistribution = { values, average: avg, min, max };
      } else {
        // text/textarea/file: report counts
        const textResponses = answersForQ.filter(a => a.answerText && String(a.answerText).trim().length > 0).length;
        answerDistribution = { textResponses };
      }

      questionAnalytics.push({
        questionId: q.id,
        title: q.title,
        type: q.type,
        required,
        responseCount,
        skipRate,
        answerDistribution,
      });
    }

    // Completion rate: percentage of responses that answered all required questions
    const requiredIds = questionItems.filter((q: any) => q.required).map((q: any) => q.id);
    let completed = 0;
    if (requiredIds.length === 0) {
      completed = totalResponses;
    } else {
      for (const r of processedResponses as any[]) {
        const answeredIds = new Set((r.answers || []).map((a: any) => a.questionId));
        const all = requiredIds.every((id: string) => answeredIds.has(id));
        if (all) completed += 1;
      }
    }
    const completionRate = totalResponses > 0 ? completed / totalResponses : 0;

    return ServiceResponse.success('Survey analytics retrieved', {
      surveyId: survey.id,
      surveyTitle: (survey as any).title,
      totalResponses,
      uniqueRespondents: uniqueRespondents.size,
      completionRate,
      trends,
      questionAnalytics,
    });
  }

  @Security('jwt', ['survey:read'])
  @Get('/responses')
  @asyncCatch
  public async getSurveyResponses(
    @Request() request: any,
    @Query() surveyId?: string,
    @Query() responderId?: string,
    @Query() surveyType?: 'report-form' | 'general' | 'rapid-enquiry',
    @Query() page: number = 1,
    @Query() limit: number = 10,
    @Query() search?: string,
  ): Promise<ServiceResponse<any[]>> {
    // Validate that at least one query parameter is provided
    if (!surveyId && !responderId && !search) {
      return ServiceResponse.failure('Either surveyId, responderId, or search query parameter is required', [], 400);
    }

    // Get user info from request
    const userId = request?.user?.id;
    const userRoleIds = request?.user?.roles?.map((role: any) => role.id) || [];
    const isSuperAdmin = request?.user?.roles?.some((role: any) =>
      role.name === 'super_admin' || role.name === 'super admin' || role.name === 'admin'
    );

    // Build where clause based on provided parameters
    const whereClause: any = {};
    if (surveyId) whereClause.surveyId = surveyId;
    if (responderId) whereClause.userId = responderId;

    // Build survey include with surveyType filter
    const surveyInclude: any = {
      model: db.Survey,
      as: 'survey',
      include: [
        { model: db.Section, as: 'sections', separate: true, order: [['order', 'ASC']] },
        { model: db.Question, as: 'questionItems', separate: true, include: [{ model: db.Section, as: 'section' }], order: [['questionNumber', 'ASC']] },
        { model: db.Organization, as: 'organization', attributes: ['id', 'name'] },
        { model: db.User, as: 'creator', attributes: ['id', 'name'] },
        { model: db.Project, as: 'project', attributes: ['id', 'name', 'status'] }
      ]
    };

    // Add surveyType filter if provided
    if (surveyType) {
      surveyInclude.where = { surveyType };
    }

    // Add search functionality
    const searchConditions: any[] = [];
    if (search && search.trim()) {
      const searchTerm = search.trim();

      // Check if search is for userReportCounter (format: "visit [number]")
      if (searchTerm.toLowerCase().startsWith('visit ')) {
        const reportNumberMatch = searchTerm.match(/^visit\s+(\d+)$/i);
        if (reportNumberMatch) {
          const reportNumber = parseInt(reportNumberMatch[1], 10);
          whereClause.userReportCounter = reportNumber;
        }
      } else if (searchTerm.toLowerCase().startsWith('date:')) {
        // Date search (format: "date:2023-01-01" or "date:2023-01-01:2023-01-31")
        const dateMatch = searchTerm.match(/^date:([^:]+)(?::(.+))?$/i);
        if (dateMatch) {
          const startDate = new Date(dateMatch[1]);
          if (!isNaN(startDate.getTime())) {
            if (dateMatch[2]) {
              // Date range
              const endDate = new Date(dateMatch[2]);
              if (!isNaN(endDate.getTime())) {
                whereClause.createdAt = {
                  [Op.gte]: startDate,
                  [Op.lte]: endDate
                };
              }
            } else {
              // Single date - search for that day
              const nextDay = new Date(startDate);
              nextDay.setDate(nextDay.getDate() + 1);
              whereClause.createdAt = {
                [Op.gte]: startDate,
                [Op.lt]: nextDay
              };
            }
          }
        }
      } else {
        // Regular text search - only search in survey title for simplicity
        const searchFilter = {
          [Op.or]: [
            {
              '$survey.title$': {
                [Op.like]: `%${searchTerm}%`
              }
            }
          ]
        };
        searchConditions.push(searchFilter);
      }
    }

    const offset = limit > 0 ? (page - 1) * Math.max(1, limit) : 0;

    // Build the allowedRoles include configuration based on user role
    const allowedRolesInclude: any = {
      model: db.Role,
      as: 'allowedRoles',
      attributes: ['id', 'name'],
      through: { attributes: [] },
      required: false, // Left join by default
    };

    if (!isSuperAdmin && !responderId) {
      if (userRoleIds.length === 0) {
        // User has no roles and is not super admin - return empty result
        return ServiceResponse.success('Responses retrieved successfully', [], 200, {
          total: 0,
          page,
          totalPages: 0
        });
      }

      // Filter responses to only show those shared with user's roles
      // Change to inner join (required: true) and filter by user's role IDs
      allowedRolesInclude.required = true;
      allowedRolesInclude.where = { id: userRoleIds };
    }
    // Super admin sees all responses (keeps required: false for left join)

    // Handle negative limit (fetch all records)
    const queryOptions: any = {
      where: searchConditions.length > 0 ? { [Op.and]: [whereClause, ...searchConditions] } : whereClause,
      offset: limit > 0 ? offset : 0,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: db.Answer,
          as: 'answers',
          separate: true,
          order: [[{ model: db.Question, as: 'question' }, 'questionNumber', 'ASC']],
          include: [{ model: db.Question, as: 'question', attributes: ['questionNumber'] }]
        },
        {
          model: db.User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'phone'],
          include: [
            { model: db.Role, as: 'roles', through: { attributes: [] } }
          ]
        },
        surveyInclude,
        allowedRolesInclude // Use the configured allowedRoles include
      ],
      distinct: true,
    };

    // Only add limit if it's positive
    if (limit > 0) {
      queryOptions.limit = limit;
    }

    const { count, rows } = await db.Response.findAndCountAll(queryOptions);

    const processedRows = rows.map((r: any) => sortAnswersByQuestionNumber(r.toJSON()));

    return ServiceResponse.success(
      'Responses retrieved successfully',
      processedRows,
      200,
      {
        total: count,
        page,
        totalPages: limit > 0 ? Math.ceil(count / limit) : 1
      }
    );
  }


  @Security('jwt', ['survey:read'])
  @Get('/unopened-count')
  @asyncCatch
  public async getUnopenedCount(@Request() request: any): Promise<ServiceResponse<any>> {
    const userId = request.user.id;
    const userRoleIds = request.user.roles?.map((r: any) => r.id) || [];

    const now = new Date();
    const baseWhere: any = {
      status: 'active',
      startAt: { [Op.lte]: now },
      endAt: { [Op.gte]: now },
    };

    const surveysResult = await db.Survey.findAll({
      attributes: [
        'id',
        [sequelize.fn('COUNT', sequelize.col('userViews.id')), 'viewCount']
      ],
      where: { ...baseWhere, surveyType: 'general' },
      include: [
        {
          model: db.Role,
          as: 'allowedRoles',
          where: { id: userRoleIds },
          required: true,
          through: { attributes: [] },
        },
        {
          model: db.UserSurveyView,
          as: 'userViews',
          where: { userId },
          required: false,
          attributes: [],
        },
      ],
      group: ['Survey.id'],
      raw: true,
    });

    const reportFormsResult = await db.Survey.findAll({
      attributes: [
        'id',
        [sequelize.fn('COUNT', sequelize.col('userViews.id')), 'viewCount']
      ],
      where: { ...baseWhere, surveyType: 'report-form' },
      include: [
        {
          model: db.Role,
          as: 'allowedRoles',
          where: { id: userRoleIds },
          required: true,
          through: { attributes: [] },
        },
        {
          model: db.UserSurveyView,
          as: 'userViews',
          where: { userId },
          required: false,
          attributes: [],
        },
      ],
      group: ['Survey.id'],
      raw: true,
    });

    const surveysCount = surveysResult.filter((s: any) => s.viewCount === 0).length;
    const reportFormsCount = reportFormsResult.filter((s: any) => s.viewCount === 0).length;

    return ServiceResponse.success('Unopened counts retrieved', {
      surveysCount,
      reportFormsCount,
    });
  }

  @Security('optionalJwt')
  @Get('/{surveyId}')
  @asyncCatch
  @Response<ServiceResponse<null>>(404, 'Survey not found')
  public async getSurveyById(
    @Path() surveyId: string,
    @Request() request?: any
  ): Promise<ServiceResponse<any | null>> {
    // Get user info
    const userRoleIds = request?.user?.roles?.map((role: any) => role.id) || [];
    const isSuperAdmin = request?.user?.roles?.some((role: any) =>
      role.name === 'super_admin' || role.name === 'super admin' || role.name === 'admin'
    );

    // Build responses include with role filtering
    const responsesInclude: any = {
      model: db.Response,
      as: 'responses',
      include: [
        {
          model: db.Answer,
          as: 'answers',
          include: [{ model: db.Question, as: 'question', attributes: ['id', 'questionNumber', 'title'] }]
        },
        {
          model: db.User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'phone', 'status'],
          include: [
            { model: db.Role, as: 'roles', attributes: ['id', 'name'], through: { attributes: [] } }
          ]
        }
      ]
    };

    // If not super admin and user is authenticated, filter responses by roles
    if (request?.user && !isSuperAdmin && userRoleIds.length > 0) {
      responsesInclude.include.push({
        model: db.Role,
        as: 'allowedRoles',
        attributes: ['id'],
        through: { attributes: [] },
        required: true,
        where: { id: userRoleIds }
      });
    }

    const survey = await db.Survey.findByPk(surveyId, {
      include: [
        { model: db.Section, as: 'sections', separate: true, order: [['order', 'ASC']] },
        { model: db.Question, as: 'questionItems', include: [{ model: db.Section, as: 'section', order: [['order', 'ASC']] }] },
        responsesInclude,
        { model: db.Role, as: 'allowedRoles', through: { attributes: [] } },
        { model: db.Organization, as: 'organization', attributes: ['id', 'name'] },
        { model: db.User, as: 'creator', attributes: ['id', 'name'] },
        { model: db.Project, as: 'project', attributes: ['id', 'name'] },
      ],
    order: [['createdAt', 'DESC']],
    });

    if (!survey) return ServiceResponse.failure('Survey not found', null, 404);
    
    const processedSurvey = sortAnswersByQuestionNumber(survey.toJSON());
    return ServiceResponse.success('Survey retrieved successfully', processedSurvey);
  }

  @Security('jwt', ['survey:create'])
  @Post('/')
  @asyncCatch
  public async createSurvey(@Request() request: any, @Body() data: SurveyCreateRequest): Promise<ServiceResponse<any | null>> {
    const userId = request?.user?.id ?? null;
    const organizationId = request?.user?.primaryOrganizationId ?? null;
    const start = new Date(data.startAt);
    const end = new Date(data.endAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return ServiceResponse.failure('Invalid startAt/endAt values', null, 400);
    }

    const created = await sequelize.transaction(async (t) => {
      const s = await db.Survey.create({
        title: data.title,
        description: data.description,
        projectId: data.projectId,
        surveyType: data.surveyType,
        estimatedTime: data.estimatedTime,
        startAt: start,
        endAt: end,
        status: 'active',
        createdBy: userId,
        organizationId: organizationId,
      }, { transaction: t });

      // Create sections with backend-generated IDs and build a mapping
      const sectionIdMap = new Map<string, string>();
      if (data.sections && data.sections.length > 0) {
        const sectionsToCreate = data.sections.map((section, index) => {
          const newId = randomUUID();
          sectionIdMap.set(section.id, newId);
          return {
            id: newId,
            surveyId: s.id,
            title: section.title,
            description: section.description || null,
            order: index + 1,
          };
        });
        await db.Section.bulkCreate(sectionsToCreate, { transaction: t });
      }

      // Create questions (remap sectionId using generated IDs)
      if (data.questions && data.questions.length > 0) {
        const questionsToCreate = data.questions.map((q, index) => {
          const { id, ...questionData } = q;
          const baseQuestion = {
            ...questionData,
            surveyId: s.id,
            sectionId: questionData.sectionId ? (sectionIdMap.get(questionData.sectionId) ?? null) : null,
            questionNumber: index + 1,
          };

          // Handle different question types
          switch (q.type) {
            case 'single_choice':
            case 'multiple_choice':
              return {
                ...baseQuestion,
                options: (q as any).options ?? null,
              };
            case 'text_input':
            case 'textarea':
              return {
                ...baseQuestion,
                options: null,
                placeholder: (q as any).placeholder ?? null,
              };
            case 'file_upload':
              return {
                ...baseQuestion,
                options: null,
                placeholder: null,
                allowedTypes: (q as any).allowedTypes ?? null,
                maxSize: (q as any).maxSize ?? null,
              };
            case 'rating':
              return {
                ...baseQuestion,
                options: null,
                placeholder: null,
                allowedTypes: null,
                maxSize: null,
                maxRating: (q as any).maxRating ?? null,
                ratingLabel: (q as any).ratingLabel ?? null,
              };
            case 'linear_scale':
              return {
                ...baseQuestion,
                minValue: (q as any).minValue ?? null,
                maxValue: (q as any).maxValue ?? null,
                minLabel: (q as any).minLabel ?? null,
                maxLabel: (q as any).maxLabel ?? null,
              };
            default:
              return baseQuestion;
          }
        });
        await db.Question.bulkCreate(questionsToCreate as any, { transaction: t });
      }

      // If the new survey is a rapid enquiry, pause all existing active rapid enquiries (except drafts)
      if (data.surveyType === 'rapid-enquiry') {
        const pausedCount = await db.Survey.update(
          { status: 'paused' },
          {
            where: {
              surveyType: 'rapid-enquiry',
              status: {
                [Op.ne]: 'draft' // Don't pause draft surveys
              }
            },
            transaction: t
          }
        );

        // Log the action for audit purposes
        if (pausedCount[0] > 0) {
          await createSystemLog(request ?? null, 'paused_existing_rapid_enquiries', 'Survey', s.id, {
            pausedCount: pausedCount[0],
            reason: 'New rapid enquiry created'
          });
        }
      }

      if (data.allowedRoles && data.allowedRoles.length > 0) {
        const roles = await db.Role.findAll({ where: { id: data.allowedRoles }, transaction: t });
        if (roles.length) {
          await (s as any).setAllowedRoles(roles, { transaction: t });
        }
      }

      return s;
    });

    this.setStatus(201);
    const result = await db.Survey.findByPk(created.id, {
      include: [
        { model: db.Section, as: 'sections', separate: true, order: [['order', 'ASC']] },
        { model: db.Question, as: 'questionItems', separate: true, include: [{ model: db.Section, as: 'section' }], order: [['questionNumber', 'ASC']] },
        {
          model: db.Response,
          as: 'responses',
          include: [
            {
              model: db.Answer,
              as: 'answers',
              include: [{ model: db.Question, as: 'question', attributes: ['id', 'questionNumber', 'title'] }]
            },
            { model: db.User, as: 'user', attributes: ['id', 'name'] }
          ]
        },
        { model: db.Role, as: 'allowedRoles', through: { attributes: [] } },
        { model: db.Organization, as: 'organization', attributes: ['id', 'name'] },
        { model: db.User, as: 'creator', attributes: ['id', 'name'] },
      ],
    });

    await createSystemLog(request ?? null, 'created_survey', 'Survey', created.id, { title: data.title });

    const processedResult = sortAnswersByQuestionNumber(result?.toJSON());
    return ServiceResponse.success('Survey created successfully', processedResult, 201);
  }

  @Security('jwt', ['survey:update'])
  @Put('/{surveyId}')
  @asyncCatch
  public async updateSurvey(
    @Path() surveyId: string,
    @Request() request: any,
    @Body() data: SurveyUpdateRequest
  ): Promise<ServiceResponse<any | null>> {
    const survey = await db.Survey.findByPk(surveyId);
    if (!survey) return ServiceResponse.failure('Survey not found', null, 404);

    await sequelize.transaction(async (t) => {
      if (data.startAt && data.endAt) {
        const start = new Date(data.startAt);
        const end = new Date(data.endAt);
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
          throw new Error('Invalid startAt/endAt values');
        }
      }

      // If the survey type is being changed to rapid-enquiry, pause all existing active rapid enquiries (except drafts)
      if (data.surveyType === 'rapid-enquiry' && survey.surveyType !== 'rapid-enquiry') {
        const pausedCount = await db.Survey.update(
          { status: 'paused' },
          {
            where: {
              surveyType: 'rapid-enquiry',
              status: {
                [Op.ne]: 'draft' // Don't pause draft surveys
              },
              id: {
                [Op.ne]: survey.id // Don't pause the survey being updated
              }
            },
            transaction: t
          }
        );

        // Log the action for audit purposes
        if (pausedCount[0] > 0) {
          await createSystemLog(request ?? null, 'paused_existing_rapid_enquiries', 'Survey', survey.id, {
            pausedCount: pausedCount[0],
            reason: 'Survey type changed to rapid-enquiry'
          });
        }
      }

      await survey.update({
        title: data.title ?? survey.title,
        description: data.description ?? survey.description,
        projectId: data.projectId !== undefined ? data.projectId : survey.projectId,
        surveyType: data.surveyType ?? survey.surveyType,
        estimatedTime: data.estimatedTime ?? survey.estimatedTime,
        startAt: data.startAt ? new Date(data.startAt) : survey.startAt,
        endAt: data.endAt ? new Date(data.endAt) : survey.endAt,
        status: data.status ?? survey.status ?? 'active',
      }, { transaction: t });

      if (data.sections) {
        await db.Section.destroy({ where: { surveyId: survey.id }, transaction: t });
        const sectionsToCreate = data.sections.map((section, index) => ({
          id: section.id,
          surveyId: survey.id,
          title: section.title,
          description: section.description || null,
          order: index + 1,
        }));
        await db.Section.bulkCreate(sectionsToCreate, { transaction: t });
      }

      if (data.questions) {
        await db.Question.destroy({ where: { surveyId: survey.id }, transaction: t });
        const questionsToCreate = data.questions.map(q => {
          const { id, ...questionData } = q;
          const baseQuestion = {
            ...questionData,
            surveyId: survey.id,
            sectionId: questionData.sectionId,
            questionNumber: questionData.questionNumber || null,
          };

          // Handle different question types
          switch (q.type) {
            case 'single_choice':
            case 'multiple_choice':
              return {
                ...baseQuestion,
                options: (q as any).options ?? null,
              };
            case 'text_input':
            case 'textarea':
              return {
                ...baseQuestion,
                options: null,
                placeholder: (q as any).placeholder ?? null,
              };
            case 'file_upload':
              return {
                ...baseQuestion,
                options: null,
                placeholder: null,
                allowedTypes: (q as any).allowedTypes ?? null,
                maxSize: (q as any).maxSize ?? null,
              };
            case 'rating':
              return {
                ...baseQuestion,
                maxRating: (q as any).maxRating ?? null,
                ratingLabel: (q as any).ratingLabel ?? null,
              };
            case 'linear_scale':
              return {
                ...baseQuestion,
                minValue: (q as any).minValue ?? null,
                maxValue: (q as any).maxValue ?? null,
                minLabel: (q as any).minLabel ?? null,
                maxLabel: (q as any).maxLabel ?? null,
              };
            default:
              return baseQuestion;
          }
        });
        await db.Question.bulkCreate(questionsToCreate as any, { transaction: t });
      }

      if (data.allowedRoles) {
        const roles = await db.Role.findAll({ where: { id: data.allowedRoles }, transaction: t });
        await (survey as any).setAllowedRoles(roles, { transaction: t });
      }
    });

    const result = await db.Survey.findByPk(survey.id, {
      include: [
        { model: db.Section, as: 'sections', separate: true, order: [['order', 'ASC']] },
        { model: db.Question, as: 'questionItems', separate: true, include: [{ model: db.Section, as: 'section' }], order: [['questionNumber', 'ASC']] },
        {
          model: db.Response,
          as: 'responses',
          include: [
            {
              model: db.Answer,
              as: 'answers',
              include: [{ model: db.Question, as: 'question', attributes: ['id', 'questionNumber', 'title'] }]
            },
            { model: db.User, as: 'user', attributes: ['id', 'name'] }
          ]
        },
        { model: db.Role, as: 'allowedRoles', through: { attributes: [] } },
        { model: db.Organization, as: 'organization', attributes: ['id', 'name'] },
        { model: db.User, as: 'creator', attributes: ['id', 'name'] },
      ],
    });

    await createSystemLog(request ?? null, 'updated_survey', 'Survey', survey.id, { changes: Object.keys(data) });

    const processedResult = sortAnswersByQuestionNumber(result?.toJSON());
    return ServiceResponse.success('Survey updated successfully', processedResult);
  }

  @Security('jwt', ['survey:delete'])
  @Delete('/{surveyId}')
  @SuccessResponse(204, 'No Content')
  @asyncCatch
  public async deleteSurvey(@Path() surveyId: string, @Request() request?: any): Promise<ServiceResponse<null>> {
    const survey = await db.Survey.findByPk(surveyId);
    if (!survey) return ServiceResponse.failure('Survey not found', null, 404);

    await survey.destroy();
    await createSystemLog(request ?? null, 'deleted_survey', 'Survey', surveyId, {});
    this.setStatus(204);
    return ServiceResponse.success('Survey deleted successfully', null, 204);
  }

  // New: submit answers for a survey
  // FIXED: submit answers for a survey
  @Security('optionalJwt')
  @Post('/{surveyId}/answers')
  @asyncCatch
  public async submitAnswers(
    @Path() surveyId: string,
    @Request() request: any,
    @Body()
    body: {
      userId?: string | null;
      responderLocation?: string | null;
      responderNId?: string | null;
      responderName?: string | null;
      responderDistrict?: string | null;
      responderSector?: string | null;
      responderCell?: string | null;
      responderVillage?: string | null;
      responderHealthCenter?: string | null;
      answers: Array<{
        questionId: string;
        answerText?: string | null;
        answerOptions?: string[] | null;
      }>;
    }
  ): Promise<ServiceResponse<any | null>> {
    const survey = await db.Survey.findByPk(surveyId, {
      include: [
        {
          model: db.Response, as: 'responses', include: [
            { model: db.Answer, as: 'answers' },
            { model: db.User, as: 'user', attributes: ['id', 'name'] }
          ]
        },
      ],
    });

    if (!survey) return ServiceResponse.failure('Survey not found', null, 404);

    if ((survey as any).status === 'paused' || (survey as any).status === 'archived') {
      return ServiceResponse.failure('Survey is not accepting responses', null, 403);
    }

    let userReportCounter = 0;

    if (survey.surveyType == "report-form") {
      const responses = survey?.responses?.filter(r => r.userId == request?.user?.id);
      if (responses && responses.length > 0) {
        const lastResponse = Math.max(...responses.map(r => r.userReportCounter || 0));
        userReportCounter = lastResponse + 1;
      } else {
        userReportCounter = 1;
      }
    }

    const effectiveUserId = body.userId ?? request?.user?.id ?? null;

    // ✅ FIXED: Reverse geocode with proper error handling
    let locationName: string | null = null;
    if (body.responderLocation) {
      try {
        // Parse the location string (expected format: "lat,lng")
        const [latStr, lngStr] = body.responderLocation.split(',');
        const lat = parseFloat(latStr?.trim());
        const lng = parseFloat(lngStr?.trim());

        if (!isNaN(lat) && !isNaN(lng)) {
          console.log(`📍 Attempting geocoding for: ${lat}, ${lng}`);

          // Wrap geocoding in try-catch so it doesn't crash the submission
          try {
            const locationData = await reverseGeocode(lat, lng);
            locationName = `${locationData.sector || 'Unknown'}, ${locationData.district || 'Unknown'}`;
            console.log(`✅ Geocoding successful: ${locationName}`);
          } catch (geocodeError) {
            // Log the error but continue with submission
            console.error(`⚠️ Geocoding failed, continuing without location name:`, geocodeError);
            locationName = null; // Set to null, submission continues
          }
        } else {
          console.warn(`⚠️ Invalid location coordinates: lat=${latStr}, lng=${lngStr}`);
        }
      } catch (parseError) {
        console.error(`⚠️ Error parsing location string:`, parseError);
      }
    }

    let createdResponse: any = null;
    await sequelize.transaction(async (t) => {
      createdResponse = await db.Response.create({
        surveyId: survey.id,
        userId: effectiveUserId,
        responderNId: body.responderNId ?? null,
        responderName: body.responderName ?? null,
        responderDistrict: body.responderDistrict ?? null,
        responderSector: body.responderSector ?? null,
        responderCell: body.responderCell ?? null,
        responderVillage: body.responderVillage ?? null,
        responderHealthCenter: body.responderHealthCenter ?? null,
        userReportCounter: userReportCounter,
        responderLocation: body.responderLocation,
        locationName: locationName,
      }, { transaction: t });

      for (const a of body.answers || []) {
        await db.Answer.create({
          surveyId: survey.id,
          responseId: createdResponse.id,
          questionId: a.questionId,
          answerText: a.answerText ?? null,
          answerOptions: a.answerOptions ?? null,
        }, { transaction: t });
      }
    });

    await createSystemLog(
      request ?? null,
      'responded_survey',
      survey?.dataValues?.title,
      createdResponse.id,
      { answersCount: (body.answers || []).length }
    );

    const result = await db.Survey.findByPk(survey.id, {
      include: [
        { model: db.Section, as: 'sections', separate: true, order: [['order', 'ASC']] },
        {
          model: db.Question,
          as: 'questionItems',
          separate: true,
          include: [{ model: db.Section, as: 'section' }],
          order: [['questionNumber', 'ASC']]
        },
        {
          model: db.Response,
          as: 'responses',
          include: [
            {
              model: db.Answer,
              as: 'answers',
              include: [{ model: db.Question, as: 'question', attributes: ['id', 'questionNumber', 'title'] }]
            },
            { model: db.User, as: 'user', attributes: ['id', 'name'] }
          ]
        },
        { model: db.Organization, as: 'organization', attributes: ['id', 'name'] },
        { model: db.User, as: 'creator', attributes: ['id', 'name'] },
      ],
    });

    this.setStatus(201);
    const processedResult = sortAnswersByQuestionNumber(result?.toJSON());
    return ServiceResponse.success('Answers submitted successfully', processedResult, 201);
  }

  // FIXED: get response by id
  @Security('jwt', ['survey:read'])
  @Get('/response/{responseId}')
  @asyncCatch
  public async getResponseById(
    @Path() responseId: string,
    @Request() request: any
  ): Promise<ServiceResponse<any | null>> {
    // Get user info
    const userRoleIds = request?.user?.roles?.map((role: any) => role.id) || [];
    const isSuperAdmin = request?.user?.roles?.some((role: any) =>
      role.name === 'super_admin' || role.name === 'super admin' || role.name === 'admin'
    );
    const currentUserId = request?.user?.id;

    // Build the query
    const includeOptions: any[] = [
      {
        model: db.Answer,
        as: 'answers',
        include: [{ model: db.Question, as: 'question', attributes: ['id', 'questionNumber', 'title'] }]
      },
      {
        model: db.User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'phone'],
        include: [
          { model: db.Role, as: 'roles', through: { attributes: [] } }
        ]
      },
      {
        model: db.Survey,
        as: 'survey',
        include: [
          { model: db.Section, as: 'sections', order: [['order', 'ASC']] },
          { model: db.Question, as: 'questionItems', include: [{ model: db.Section, as: 'section' }], order: [['questionNumber', 'ASC']] },
          { model: db.Organization, as: 'organization', attributes: ['id', 'name'] },
          { model: db.User, as: 'creator', attributes: ['id', 'name'] },
          {
            model: db.Role,
            as: 'allowedRoles',
            attributes: ['id', 'name'],
            through: { attributes: [] },
            required: false
          }
        ]
      }
    ];

    // First get the response without role filtering
    const response = await db.Response.findByPk(responseId, {
      include: includeOptions
    });

    if (!response) {
      return ServiceResponse.failure('Response not found', null, 404);
    }

    const responseData = sortAnswersByQuestionNumber(response.toJSON());
    const survey = responseData.survey; // Now TypeScript won't complain
    const responseUserId = responseData.userId;
    if (isSuperAdmin) {
      return ServiceResponse.success('Response retrieved successfully', responseData);
    }

    // User can always see their own responses
    if (responseUserId === currentUserId) {
      return ServiceResponse.success('Response retrieved successfully', responseData);
    }

    // Check survey role restrictions
    const surveyAllowedRoles = survey?.allowedRoles || [];
    if (surveyAllowedRoles.length > 0) {
      const userHasAllowedRole = surveyAllowedRoles.some((role: any) =>
        userRoleIds.includes(role.id)
      );

      if (!userHasAllowedRole) {
        return ServiceResponse.failure('Access denied to this response', null, 403);
      }
    }

    // If survey has no role restrictions and user has survey:read permission, allow access
    return ServiceResponse.success('Response retrieved successfully', responseData);
  }

  // GET RAPID ENQUIRY FOR PUBLIC ACCESS
  @Security('optionalJwt')
  @Get('/public/rapid-enquiry/latest')
  @asyncCatch
  public async getLatestRapidEnquiry(): Promise<ServiceResponse<any | null>> {
    const survey = await db.Survey.findOne({
      where: {
        surveyType: 'rapid-enquiry',
        status: 'active'
      },
      order: [['createdAt', 'DESC']], // Get the latest one
      include: [
        { model: db.Section, as: 'sections', separate: true, order: [['order', 'ASC']] },
        { model: db.Question, as: 'questionItems', separate: true, include: [{ model: db.Section, as: 'section' }], order: [['questionNumber', 'ASC']] },
        { model: db.Organization, as: 'organization', attributes: ['id', 'name'] },
        { model: db.User, as: 'creator', attributes: ['id', 'name'] },
      ],
    });

    if (!survey) {
      return ServiceResponse.failure('No active rapid enquiry survey found', null, 404);
    }

    return ServiceResponse.success('Latest rapid enquiry survey retrieved successfully', survey);
  }

  // delete response

  @Security('jwt', ['survey:delete'])
  @Delete('/response/{responseId}')
  @SuccessResponse(204, 'No Content')
  @asyncCatch
  public async deleteResponse(@Path() responseId: string, @Request() request?: any): Promise<ServiceResponse<null>> {
    const response = await db.Response.findByPk(responseId);
    if (!response) return ServiceResponse.failure('Response not found', null, 404);

    await response.destroy();
    await createSystemLog(request ?? null, 'deleted_response', 'Response', responseId, {});
    this.setStatus(204);
    return ServiceResponse.success('Response deleted successfully', null, 204);
  }

  @Security('jwt', ['survey:read'])
  @Post('/{surveyId}/mark-viewed')
  @asyncCatch
  public async markSurveyAsViewed(
    @Path() surveyId: string,
    @Request() request: any
  ): Promise<ServiceResponse<null>> {
    const userId = request.user.id;

    const survey = await db.Survey.findByPk(surveyId);
    if (!survey) {
      return ServiceResponse.failure('Survey not found', null, 404);
    }

    await db.UserSurveyView.findOrCreate({
      where: { userId, surveyId },
      defaults: { userId, surveyId, viewedAt: new Date() } as any,
    });

    return ServiceResponse.success('Survey marked as viewed', null);
  }
}