import { Controller, Get, Post, Put, Delete, Route, Tags, Response, SuccessResponse, Body, Path, Query, Security, Request } from '@tsoa/runtime';
import { ServiceResponse } from '../utils/serviceResponse';
import { asyncCatch } from '../middlewares/errorHandler';
import sequelize from '../config/database';
import { Op } from 'sequelize';
import db from '@/models';
import { createSystemLog } from '../utils/systemLog';
import { randomUUID } from 'crypto';
import type { Includeable } from 'sequelize';
import { sortAnswersByQuestionNumber } from '../utils/sortAnswers';

interface GeneralSurveyCreateRequest {
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

interface GeneralSurveyUpdateRequest extends Partial<GeneralSurveyCreateRequest> {
  status?: "draft" | "active" | "paused" | "archived";
}

@Route('api/generalsurveys')
@Tags('GeneralSurveys')
export class SurveyGeneralController extends Controller {
  
    @Security('jwt', ['survey:read'])
    @Get('/')
    @asyncCatch
     public async getGeneralSurveys(
    @Request() request: any,
    @Query() page: number = 1,
    @Query() limit: number = 10,
    @Query() status?: 'draft' | 'active' | 'paused' | 'archived',
    @Query() surveyType?: 'general' | 'report-form' | 'rapid-enquiry',
    @Query() startDate?: string,
    @Query() endDate?: string,
    @Query() search?: string
  ): Promise<ServiceResponse<any[]>> {
    const offset = (page - 1) * limit;
    const where: any = {};
    const userId = request.user?.id;
    
    // Simple includes - no user filtering
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
      where[Op.and] = where[Op.and] || [];
      (where[Op.and] as any[]).push({
        [Op.or]: [
          { title: { [Op.like]: term } },
          { description: { [Op.like]: term } },
        ],
      });
    }

    // Get ALL surveys - no user filtering
    const { count, rows } = await db.Survey.findAndCountAll({
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      where,
      include: includeArr,
      distinct: true,
    });

    // Add isNew flag to each survey
    const surveysWithIsNew = rows.map((survey: any) => {
      const surveyData = sortAnswersByQuestionNumber(survey.toJSON());
      const isNew = !surveyData.userViews || surveyData.userViews.length === 0;
      return {
        ...surveyData,
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
  public async getGeneralSurveyAnalytics(@Path() surveyId: string, @Query() startDate?: string, @Query() endDate?: string): Promise<ServiceResponse<any>> {

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
          separate: true,
          order: [[{ model: db.Question, as: 'question' }, 'questionNumber', 'ASC']],
          include: [{ model: db.Question, as: 'question', attributes: ['questionNumber'] }]
        },
        { model: db.User, as: 'user', attributes: ['id'] },
      ],
    });

    const totalResponses = responses.length;
    const uniqueRespondents = new Set<string>();
    const trendsMap: Record<string, number> = {};

    for (const r of responses as any[]) {
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
      for (const r of responses as any[]) {
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
      for (const r of responses as any[]) {
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

// In your SurveyGeneralController
@Security('jwt', ['survey:read'])
@Get('/responses')
@asyncCatch
public async getGeneralSurveyResponses(
  @Query() surveyId?: string,
  @Query() responderId?: string,
  @Query() page: number = 1,
  @Query() limit: number = 20,
  @Query() surveyType?: 'general' | 'report-form' | 'rapid-enquiry',
  @Query() search?: string
): Promise<ServiceResponse<any[]>> {
  const offset = (page - 1) * limit;
  const where: any = {};

  if (surveyId) where.surveyId = surveyId;
  if (responderId) where.userId = responderId;
  if (surveyType) {
    // Filter by survey type through the survey relation
    where['$survey.surveyType$'] = surveyType;
  }

  const { count, rows } = await db.Response.findAndCountAll({
    limit,
    offset,
    where,
    include: [
      {
        model: db.Survey,
        as: 'survey',
        include: [
          { model: db.Question, as: 'questionItems', separate: true, order: [['questionNumber', 'ASC']] },
          { model: db.Project, as: 'project', attributes: ['id', 'name'] }
        ]
      },
      { model: db.User, as: 'user', attributes: ['id', 'name'] },
      {
        model: db.Answer,
        as: 'answers',
        include: [{ model: db.Question, as: 'question', attributes: ['id', 'questionNumber', 'title'] }]
      }
    ],
    order: [['createdAt', 'DESC']],
    distinct: true,
  });

  return ServiceResponse.success(
    'Responses retrieved successfully',
    rows,
    200,
    { total: count, page, totalPages: Math.ceil(count / limit) }
  );
}

  @Security('optionalJwt')
  @Get('/{surveyId}')
  @asyncCatch
  @Response<ServiceResponse<null>>(404, 'Survey not found')
  public async getGeneralSurveyById(
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
          separate: true,
          order: [[{ model: db.Question, as: 'question' }, 'questionNumber', 'ASC']],
          include: [{ model: db.Question, as: 'question', attributes: ['questionNumber'] }]
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
  responsesInclude,
  { model: db.Role, as: 'allowedRoles', through: { attributes: [] } },
  { model: db.Organization, as: 'organization', attributes: ['id', 'name'] },
  { model: db.User, as: 'creator', attributes: ['id', 'name'] },
  { model: db.Project, as: 'project', attributes: ['id', 'name'] },
],
order: [['createdAt', 'DESC']],

    });

    if (!survey) return ServiceResponse.failure('Survey not found', null, 404);
    return ServiceResponse.success('Survey retrieved successfully', survey);
  }

  @Security('jwt', ['survey:create'])
  @Post('/')
  @asyncCatch
  public async createGeneralSurvey(@Request() request: any, @Body() data: GeneralSurveyCreateRequest): Promise<ServiceResponse<any | null>> {
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
              separate: true,
              order: [[{ model: db.Question, as: 'question' }, 'questionNumber', 'ASC']],
              include: [{ model: db.Question, as: 'question', attributes: ['questionNumber'] }]
            },
            { model: db.User, as: 'user', attributes: ['id', 'name'] }
          ]
        },
        { model: db.Role, as: 'allowedRoles', through: { attributes: [] } },
        { model: db.Organization, as: 'organization', attributes: ['id', 'name'] },
        { model: db.User, as: 'creator', attributes: ['id', 'name'] },
      ],
    });

    // Log creation (best-effort)
    await createSystemLog(request ?? null, 'created_survey', 'Survey', created.id, { title: data.title });

    return ServiceResponse.success('Survey created successfully', result, 201);
  }

  @Security('jwt', ['survey:update'])
  @Put('/{surveyId}')
  @asyncCatch
  public async updateGeneralSurvey(
    @Path() surveyId: string,
    @Request() request: any,
    @Body() data: GeneralSurveyUpdateRequest
  ): Promise<ServiceResponse<any | null>> {
    const survey = await db.Survey.findByPk(surveyId);
    if (!survey) return ServiceResponse.failure('Survey not found', null, 404);

    await sequelize.transaction(async (t) => {
      if (data.startAt || data.endAt) {
        const start = data.startAt ? new Date(data.startAt) : survey.startAt;
        const end = data.endAt ? new Date(data.endAt) : survey.endAt;
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
              separate: true,
              order: [[{ model: db.Question, as: 'question' }, 'questionNumber', 'ASC']],
              include: [{ model: db.Question, as: 'question', attributes: ['questionNumber'] }]
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

    return ServiceResponse.success('Survey updated successfully', result);
  }

  @Security('jwt', ['survey:delete'])
  @Delete('/{surveyId}')
  @SuccessResponse(204, 'No Content')
  @asyncCatch
  public async deleteGeneralSurvey(@Path() surveyId: string, @Request() request?: any): Promise<ServiceResponse<null>> {
    const survey = await db.Survey.findByPk(surveyId);
    if (!survey) return ServiceResponse.failure('Survey not found', null, 404);

    await survey.destroy();
    await createSystemLog(request ?? null, 'deleted_survey', 'Survey', surveyId, {});
    this.setStatus(204);
    return ServiceResponse.success('Survey deleted successfully', null, 204);
  }

  // New: submit answers for a survey
  @Security('optionalJwt')
  @Post('/{surveyId}/answers')
  @asyncCatch
  public async submitGeneralAnswers(
    @Path() surveyId: string,
    @Request() request: any,
    @Body()
    body: {
      userId?: string | null; // optional explicit userId (else use auth or anonymous)
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
          model: db.Response, as: 'responses', include: [{ model: db.Answer, as: 'answers' },
          { model: db.User, as: 'user', attributes: ['id', 'name'] }]
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
      // get last userReportCounter for loggedin user
      if (responses && responses.length > 0) {
        const lastResponse = Math.max(...responses.map(r => r.userReportCounter || 0));
        userReportCounter = lastResponse + 1;
      } else {
        // For new users or first submission, start with counter 1
        userReportCounter = 1;
      }
    }

    const effectiveUserId = body.userId ?? request?.user?.id ?? null;
    let createdResponse: any = null;
    await sequelize.transaction(async (t) => {
      createdResponse = await db.Response.create({
        surveyId: survey.id,
        userReportCounter: userReportCounter,
        userId: effectiveUserId,
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

    await createSystemLog(request ?? null, 'responded_survey', survey?.dataValues?.title, createdResponse.id, { answersCount: (body.answers || []).length });

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
              separate: true,
              order: [[{ model: db.Question, as: 'question' }, 'questionNumber', 'ASC']],
              include: [{ model: db.Question, as: 'question', attributes: ['questionNumber'] }]
            },
            { model: db.User, as: 'user', attributes: ['id', 'name'] }
          ]
        },
        { model: db.Organization, as: 'organization', attributes: ['id', 'name'] },
        { model: db.User, as: 'creator', attributes: ['id', 'name'] },
      ],
    });

    this.setStatus(201);
    return ServiceResponse.success('Answers submitted successfully', result, 201);
  }

  @Security('jwt', ['survey:read'])
  @Get('/response/{responseId}')
  @asyncCatch
  public async getGeneralResponseById(
    @Path() responseId: string,
    @Request() request: any
  ): Promise<ServiceResponse<any | null>> {
    // Get user info
    const userRoleIds = request?.user?.roles?.map((role: any) => role.id) || [];
    const isSuperAdmin = request?.user?.roles?.some((role: any) =>
      role.name === 'super_admin' || role.name === 'super admin'
    );
    const currentUserId = request?.user?.id;

    // Build the query
    const includeOptions: any[] = [
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

    // TypeScript fix: Cast to any to access associations
    const responseData = response as any;
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
  public async getGeneralLatestRapidEnquiry(): Promise<ServiceResponse<any | null>> {
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

    // Count surveys with subquery approach
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