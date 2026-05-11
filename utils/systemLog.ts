import db from '@/models';

/**
 * Create a system log entry.
 * - reqOrActor can be the express Request object (preferred) or a userId string/null.
 * - action: short action key e.g. 'created_user', 'updated_survey'
 * - resourceType: e.g. 'User', 'Survey'
 * - resourceId: ID of affected resource (optional)
 * - meta: free-form JSON for extra context (optional)
 */
export async function createSystemLog(
  reqOrActor: any | string | null,
  action: string,
  resourceType?: string | null,
  resourceId?: string | null,
  meta?: any
) {
  try {
    let userId: string | null = null;
    let ip: string | null = null;
    let userAgent: string | null = null;

    if (typeof reqOrActor === 'string') {
      userId = reqOrActor;
    } else if (reqOrActor && typeof reqOrActor === 'object') {
      // request-like object
      userId = (reqOrActor.user && reqOrActor.user.id) ? reqOrActor.user.id : (reqOrActor.userId ?? null);
      ip = reqOrActor.ip || (reqOrActor.headers && (reqOrActor.headers['x-forwarded-for'] || reqOrActor.headers['x-real-ip'])) || null;
      userAgent = reqOrActor.headers?.['user-agent'] ?? null;
    } else {
      userId = null;
    }

    await (db as any).SystemLog.create({
      userId,
      action,
      resourceType: resourceType ?? null,
      resourceId: resourceId ?? null,
      meta: meta ?? null,
      ip,
      userAgent,
    });
  } catch (err) {
    // don't throw: logging must not break main flow
    // optional: console.error for visibility during development
    // eslint-disable-next-line no-console
    console.error('Failed to write system log', err);
  }
}
