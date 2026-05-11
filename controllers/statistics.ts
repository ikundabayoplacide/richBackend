import { Controller, Get, Route, Tags, Query, Security, Request, Response } from '@tsoa/runtime';
import { ServiceResponse } from '../utils/serviceResponse';
import { asyncCatch } from '../middlewares/errorHandler';
import db from '@/models';
import { Op } from 'sequelize';

type Period = 'daily' | 'weekly' | 'monthly';

@Route('api/statistics')
@Tags('Statistics')
export class StatisticsController extends Controller {
    /**
     * Overview statistics (counts + deltas) for a given period.
     * Defaults to last 30 days when startDate/endDate not provided.
     */
    @Security('jwt', ['dashboard:analytics', 'dashboard:community'])
    @Get('/overview')
    @asyncCatch
    public async getOverview(
        @Request() req: any,
        @Query() startDate?: string,
        @Query() endDate?: string
    ): Promise<ServiceResponse<any>> {
        // parse dates, default to last 30 days
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);

        // compute previous period of equal length
        const periodMs = end.getTime() - start.getTime();
        const prevEnd = new Date(start.getTime() - 1);
        const prevStart = new Date(prevEnd.getTime() - periodMs);

        // Helper to compute delta safely
        const computeDelta = (current: number, previous: number) => {
            if (previous === 0) {
                return current === 0 ? 0 : 100;
            }
            return Math.round(((current - previous) / Math.abs(previous)) * 100);
        };

        // FEEDBACKS: total in period and previous period
        const userId = req?.user?.id ?? null;
        const [feedbackCountCurrent, feedbackCountPrev, userFeedbackCount] = await Promise.all([
            db.Feedback.count({ where: { createdAt: { [Op.gte]: start, [Op.lte]: end } } }),
            db.Feedback.count({ where: { createdAt: { [Op.gte]: prevStart, [Op.lte]: prevEnd } } }),
            db.Feedback.count({ where: { userId: userId, createdAt: { [Op.gte]: start, [Op.lte]: end } } }),
        ]);

        // Users: newly registered in period and total users
        const [usersCreatedCurrent, usersCreatedPrev, totalUsers] = await Promise.all([
            db.User.count({ where: { createdAt: { [Op.gte]: start, [Op.lte]: end } } }),
            db.User.count({ where: { createdAt: { [Op.gte]: prevStart, [Op.lte]: prevEnd } } }),
            db.User.count(),
        ]);

        // Surveys: active now and surveys created in period (we provide both)
        const [activeSurveysNow, surveysCreatedCurrent, surveysCreatedPrev, respondedSurveys] = await Promise.all([
            db.Survey.count({ where: { status: 'active', surveyType: "general" } }),
            db.Survey.count({ where: { createdAt: { [Op.gte]: start, [Op.lte]: end } } }),
            db.Survey.count({ where: { createdAt: { [Op.gte]: prevStart, [Op.lte]: prevEnd } } }),
            db.Survey.count({
                where: {
                    surveyType: "general",
                    status: 'active'
                },
                include: [{ model: db.Response, as: 'responses', required: true, where: { userId }, include: [{ model: db.User, as: 'user', attributes: ['id', 'name'] }] }]
            }),
        ]);

        // Build response
        const overview = {
            feedbacks: {
                count: feedbackCountCurrent,
                deltaPercent: computeDelta(feedbackCountCurrent, feedbackCountPrev),
                previousCount: feedbackCountPrev,

                // userCount: userFeedbackCount, // include if needed
                userCount: userFeedbackCount,
                userDeltaPercent: userFeedbackCount !== null ? computeDelta(userFeedbackCount, 0) : null, // compare to 0 if previous not tracked
            },
            users: {
                total: totalUsers,
                createdInPeriod: usersCreatedCurrent,
                createdDeltaPercent: computeDelta(usersCreatedCurrent, usersCreatedPrev),
                previousCreated: usersCreatedPrev,
            },
            surveys: {
                activeNow: activeSurveysNow,
                createdInPeriod: surveysCreatedCurrent,
                createdDeltaPercent: computeDelta(surveysCreatedCurrent, surveysCreatedPrev),
                previousCreated: surveysCreatedPrev,
                respondedByUser: userId ? respondedSurveys : null,
                respondedDeltaPercent: userId ? computeDelta(respondedSurveys, 0) : null, // compare to 0 if previous not tracked
            },
            period: {
                start: start.toISOString(),
                end: end.toISOString(),
                previousStart: prevStart.toISOString(),
                previousEnd: prevEnd.toISOString(),
            },
        };

        return ServiceResponse.success('Statistics overview retrieved', overview);
    }

    /**
     * Surveys history / responses timeseries
     * Query params:
     *  - startDate, endDate: range (defaults to last 12 months)
     *  - group: 'daily' | 'weekly' | 'monthly' (default 'monthly')
     *  - surveyId: optional to filter to a single survey
     *
     * Returns: { labels: string[], data: number[] } where labels are ISO or human-readable periods
     */
    @Security('jwt', ['dashboard:analytics'])
    @Get('/surveys-history')
    @asyncCatch
    public async getSurveysHistory(
        @Query() group: Period = 'monthly',
        @Query() startDate?: string,
        @Query() endDate?: string,
        @Query() surveyId?: string
    ): Promise<ServiceResponse<any>> {
        const end = endDate ? new Date(endDate) : new Date();
        // default to 12 months for monthly, 90 days for daily, 26 weeks for weekly
        let start: Date;
        if (startDate) start = new Date(startDate);
        else {
            if (group === 'daily') start = new Date(Date.now() - 1000 * 60 * 60 * 24 * 90);
            else if (group === 'weekly') start = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7 * 26);
            else start = new Date(end.getFullYear(), end.getMonth() - 11, 1);
        }

        // fetch responses in date range (optionally for a single survey)
        const responsesWhere: any = { createdAt: { [Op.gte]: start, [Op.lte]: end } };
        if (surveyId) responsesWhere.surveyId = surveyId;

        const responses = await db.Response.findAll({
            where: responsesWhere,
            attributes: ['id', 'createdAt', 'surveyId'],
            order: [['createdAt', 'ASC']],
            raw: true,
        });

        // Build buckets in JS
        const buckets: Record<string, number> = {};
        const labels: string[] = [];
        const data: number[] = [];

        const pad = (n: number) => String(n).padStart(2, '0');

        if (group === 'daily') {
            // iterate days from start to end
            const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
            while (cursor <= end) {
                const label = cursor.toISOString().slice(0, 10); // YYYY-MM-DD
                labels.push(label);
                buckets[label] = 0;
                cursor.setDate(cursor.getDate() + 1);
            }
            for (const r of responses) {
                const label = new Date(r.createdAt).toISOString().slice(0, 10);
                if (label in buckets) buckets[label] += 1;
            }
        } else if (group === 'weekly') {
            // ISO week label: YYYY-Www (simple week buckets by Monday)
            const cursor = new Date(start);
            // set to Monday
            const day = cursor.getDay();
            const diff = (day + 6) % 7; // days since Monday
            cursor.setDate(cursor.getDate() - diff);
            while (cursor <= end) {
                const y = cursor.getFullYear();
                // week number approximate using ISO week (not fully ISO-accurate but ok)
                const weekStart = new Date(cursor);
                const label = `${weekStart.getFullYear()}-W${pad(Math.ceil(((weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) / (7 * 24 * 3600 * 1000)) + 1))}`;
                labels.push(label);
                buckets[label] = 0;
                cursor.setDate(cursor.getDate() + 7);
            }
            for (const r of responses) {
                const d = new Date(r.createdAt);
                // find Monday of that week
                const day = d.getDay();
                const diff = (day + 6) % 7;
                const monday = new Date(d);
                monday.setDate(d.getDate() - diff);
                const label = `${monday.getFullYear()}-W${pad(Math.ceil(((monday.getTime() - new Date(monday.getFullYear(), 0, 1).getTime()) / (7 * 24 * 3600 * 1000)) + 1))}`;
                if (label in buckets) buckets[label] += 1;
            }
        } else {
            // monthly
            const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
            while (cursor <= end) {
                const label = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`; // YYYY-MM
                labels.push(label);
                buckets[label] = 0;
                cursor.setMonth(cursor.getMonth() + 1);
            }
            for (const r of responses) {
                const d = new Date(r.createdAt);
                const label = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
                if (label in buckets) buckets[label] += 1;
            }
        }

        for (const l of labels) {
            data.push(buckets[l] ?? 0);
        }

        return ServiceResponse.success('Surveys history retrieved', { labels, data });
    }
}
