import '../config/database';
import db from '../models';
import { initializeDatabase } from '../config/database';

// Treat models as any to avoid strict TS model attribute typings in the seed script
const D: any = db as any;

async function seed() {
  await initializeDatabase();

  const t = await D.sequelize.transaction();
  try {
    console.log('Seeding mock data...');

    // Create some generic permissions
    const permissionNames = ['project:read', 'project:create', 'organization:create', 'survey:read', 'announcement:read'];
    const permissions: any[] = [];
    for (const name of permissionNames) {
      const [p] = await D.Permission.findOrCreate({ where: { name }, defaults: { name, description: name }, transaction: t } as any);
      permissions.push(p);
    }

    // Create three organizations
    const organizations: any[] = [];
    for (let i = 1; i <= 3; i++) {
      const org = await D.Organization.create({
        name: `Mock Organization ${i}`,
        description: `Description for Mock Organization ${i}`,
        logo: null,
        type: 'stakeholder',
        status: 'active',
      } as any, { transaction: t } as any);

      organizations.push(org);

      // Create a role for the organization
      const roleName = `${org.name.toLowerCase().replace(/\s+/g, '_')}_admin`;
      const [role] = await D.Role.findOrCreate({
        where: { name: roleName },
        defaults: {
          name: roleName,
          description: `Admin role for ${org.name}`,
          organizationId: org.id,
        },
        transaction: t,
      } as any);

      // Attach permissions to role
      if (permissions.length) await (role as any).setPermissions(permissions.slice(0, 3), { transaction: t });

      // Create owner user
      const owner = await D.User.create({
        name: `Owner ${i}`,
        email: `owner${i}@example.com`,
        password: 'password',
        phone: `+100000000${i}`,
        status: 'active',
        emailVerified: true,
      } as any, { transaction: t } as any);

      // set organization owner
      await org.update({ ownerId: owner.id } as any, { transaction: t } as any);

      // Add owner to organization users
      await (org as any).addUser(owner, { transaction: t } as any);

      // assign role to owner
      await (owner as any).addRole(role, { transaction: t } as any);

      // create additional users for org
      const users: any[] = [owner];
      for (let u = 1; u <= 4; u++) {
        const user = await D.User.create({
          name: `User ${i}-${u}`,
          email: `user${i}_${u}@example.com`,
          password: 'password',
          phone: `+10000000${i}${u}`,
          status: 'active',
          emailVerified: true,
        } as any, { transaction: t } as any);
        users.push(user);
        await (org as any).addUser(user, { transaction: t } as any);
      }

      // create projects for org
      const projects: any[] = [];
      for (let p = 1; p <= 2; p++) {
        const project = await D.Project.create({
          name: `Project ${i}-${p}`,
          description: `Project ${i}-${p} description`,
          organizationId: org.id,
        } as any, { transaction: t } as any);
        projects.push(project);
      }

      // create documents for each project
      for (const project of projects) {
        for (let d = 1; d <= 2; d++) {
          await D.Document.create({
            documentName: `Doc ${project.name} - ${d}`,
            content: `Content for ${project.name} doc ${d}`,
            projectId: project.id,
            organizationId: org.id,
          } as any, { transaction: t } as any);
        }
      }

      // create a survey for org
      const now = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30); // Survey ends in 30 days
      
      const survey = await D.Survey.create({
        title: `Survey for ${org.name}`,
        description: `Survey description for ${org.name}`,
        createdBy: owner.id,
        organizationId: org.id,
        startAt: now,
        endAt: endDate,
      } as any, { transaction: t } as any);

      // create questions and answers
      for (let q = 1; q <= 3; q++) {
        const question = await D.Question.create({
          surveyId: survey.id,
          title: `Question ${q} for ${org.name}`,
          text: `Question ${q} for ${org.name}`,
          type: 'text_input',
          organizationId: org.id,
        } as any, { transaction: t } as any);

        // create responses and answers from each user
        for (const u of users.slice(0, 3)) {
          // Create a response for this user and survey
          const response = await D.Response.create({
            surveyId: survey.id,
            userId: u.id,
          } as any, { transaction: t } as any);

          // Create answer linked to the response
          await D.Answer.create({
            surveyId: survey.id,
            responseId: response.id,
            questionId: question.id,
            answerText: `Answer by ${u.name} to question ${q}`,
            organizationId: org.id,
          } as any, { transaction: t } as any);
        }
      }

      // create feedback for a random document
      const randomDoc = await D.Document.findOne({ where: { organizationId: org.id } as any, transaction: t } as any);
      if (randomDoc) {
        await D.Feedback.create({
          userId: users[1].id,
          projectId: projects[0].id,
          documentId: randomDoc.id,
          comment: `Feedback for ${randomDoc.documentName || randomDoc.id}`,
          organizationId: org.id,
        } as any, { transaction: t } as any);
      }

      // community sessions and comments
      const session = await D.CommunitySession.create({
        title: `Session for ${org.name}`,
        documentId: randomDoc ? randomDoc.id : null,
        createdBy: owner.id,
        organizationId: org.id,
      } as any, { transaction: t } as any);

      await D.Comment.create({
        content: 'Great session',
        communitySessionId: session.id,
        userId: users[2].id,
        organizationId: org.id,
      } as any, { transaction: t } as any);

      // announcement
      await D.Announcement.create({
        title: `Announcement for ${org.name}`,
        body: `This is an announcement for ${org.name}`,
        createdBy: owner.id,
        organizationId: org.id,
      } as any, { transaction: t } as any);

      // system log
      await D.SystemLog.create({
        userId: owner.id,
        action: 'seeded_organization',
        details: { organizationId: org.id },
        organizationId: org.id,
      } as any, { transaction: t } as any);
    }

    await t.commit();
    console.log('Seeding completed successfully.');
  } catch (err) {
    console.error('Seeding failed:', err);
    await t.rollback();
    process.exit(1);
  } finally {
    D.sequelize.close();
  }
}

seed().catch((e) => {
  console.error('Unexpected error while seeding:', e);
  process.exit(1);
});
