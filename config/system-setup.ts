import dotenv from 'dotenv';
import db from '../models/index';
import sequelize, { initializeDatabase } from './database';
import { hash } from 'bcrypt';

dotenv.config();

// Mock permissions
const permissions = [
  // User Permissions
  { name: 'user:create', description: 'Create users' },
  { name: 'user:view', description: 'View users' },
  { name: 'user:read', description: 'View users' },
  { name: 'user:update', description: 'Update users' },
  { name: 'user:delete', description: 'Delete users' },

  // Role Permissions
  { name: 'role:create', description: 'Create roles' },
  { name: 'role:read', description: 'View roles' },
  { name: 'role:update', description: 'Update roles' },
  { name: 'role:delete', description: 'Delete roles' },

  // Feedback Permissions
  { name: 'feedback:create', description: 'Create feedback' },
  { name: 'feedback:read', description: 'View feedback' },
  { name: 'feedback:update', description: 'Update feedback' },
  { name: 'feedback:delete', description: 'Delete feedback' },
  { name: 'feedback:all:read', description: 'View all feedback' },
  { name: 'feedback:personal:read', description: 'View personal feedback' },

  // Project Permissions
  { name: 'project:create', description: 'Create projects' },
  { name: 'project:read', description: 'View projects' },
  { name: 'project:update', description: 'Update projects' },
  { name: 'project:delete', description: 'Delete projects' },
  { name: 'project:approve', description: 'Approve projects' },


  // Community Session Permissions
  { name: 'community_session:create', description: 'Create community sessions' },
  { name: 'community_session:read', description: 'View community sessions' },
  { name: 'community_session:update', description: 'Update community sessions' },
  { name: 'community_session:download', description: 'Download community sessions' },
  { name: 'community_session:delete', description: 'Delete community sessions' },
  
  // Reporting Permissions
  { name: 'report:create', description: 'Create reports' },
  { name: 'report:read', description: 'View reports' },
  { name: 'report:update', description: 'Update reports' },
  { name: 'report:delete', description: 'Delete reports' },

  // dashboards Permissions
  { name: 'dashboard:analytics', description: 'View analytics dashboard' },
   { name: 'dashboard:community', description: 'View community dashboard' },

  // Survey Permissions
  { name: 'survey:create', description: 'Create surveys' },
  { name: 'survey:read', description: 'View surveys' },
  { name: 'survey:respond', description: 'Respond to surveys' },
  { name: 'survey:update', description: 'Update surveys' },
  { name: 'survey:delete', description: 'Delete surveys' },
  { name: 'survey:analytics', description: 'View analytics' },
  { name: 'survey:forms', description: 'View and create other user\'s forms' },
  { name: 'survey:all:read', description: 'View all surveys' },

  // Notification Permissions
  { name: 'notification:read', description: 'View notifications' },
  { name: 'notification:delete', description: 'Delete notifications' },

  // Announcement Permissions
  { name: 'announcement:create', description: 'Create announcements' },
  { name: 'announcement:read', description: 'View announcements' },
  { name: 'announcement:update', description: 'Update announcements' },
  { name: 'announcement:delete', description: 'Delete announcements' },

  //Rapid Enquiry Permissions
  { name: 'rapid_enquiry:create', description: 'Create rapid enquiry' },
  { name: 'rapid_enquiry:read', description: 'View rapid enquiry' },
  { name: 'rapid_enquiry:update', description: 'Update rapid enquiry' },
  { name: 'rapid_enquiry:delete', description: 'Delete rapid enquiry' },

  // Stakeholder Permissions
  { name: 'stakeholder:create', description: 'Create stakeholders' },
  { name: 'stakeholder:read', description: 'View stakeholders' },
  { name: 'stakeholder:update', description: 'Update stakeholders' },
  { name: 'stakeholder:delete', description: 'Delete stakeholders' },

  // System Logs
  { name: 'system_log:create', description: 'Create system logs' },
  { name: 'system_log:read', description: 'View system logs' },
  { name: 'system_log:update', description: 'Update system logs' },
  { name: 'system_log:delete', description: 'Delete system logs' },

  // Settings Permissions
  { name: 'settings:create', description: 'Create website settings' },
  { name: 'settings:read', description: 'View website settings' },
  { name: 'settings:update', description: 'Update website settings' },
  { name: 'settings:delete', description: 'Delete website settings' },
  
  // intervention area Permissions
  { name: 'intervention_area:create', description: 'Create intervention areas' },
  { name: 'intervention_area:read', description: 'View intervention areas' },
  { name: 'intervention_area:update', description: 'Update intervention areas' },
  { name: 'intervention_area:delete', description: 'Delete intervention areas' },

  //permission to manage Events

  { name: 'event:create', description: 'Create events' },
  { name: 'event:read', description: 'View events' },
  { name: 'event:update', description: 'Update events' },
  { name: 'event:delete', description: 'Delete events' },

  // sharing feedback permissions 
  { name: 'feedback:share', description: 'Share feedback with others' },

  // Weekly Report Permissions
  { name: 'weeklyreport:create', description: 'Create weekly reports' },
  { name: 'weeklyreport:read', description: 'View weekly reports' },
  { name: 'weeklyreport:update', description: 'Update weekly reports' },
  { name: 'weeklyreport:delete', description: 'Delete weekly reports' },
  { name: 'weeklyreport:review', description: 'Review and approve weekly reports' },
  //create and get weekly reports
  {name: 'weekly_report:create', description: 'Create weekly reports' },
  {name: 'weekly_report:read', description: 'View weekly reports' },
  {name: 'weekly_report:update', description: 'Update weekly reports' },
  {name: 'weekly_report:delete', description: 'Delete weekly reports' },

];

// Base role templates with common permissions
const roleTemplates = {
  // Frontend-aligned roles from signup userTypes
  // Community Members
  volunteers: {
    description: 'Volunteers - Community role',
    category: 'Community Members',
    permissions: [
      'system_log:read',
      'role:read',
      //Surveys
      'survey:read', 'survey:respond',

      //Feedback
      'feedback:create', 'feedback:read', 'feedback:update','my_feedback:delete',
      'feedback:personal:read',

      //Documents
      'document:read','document:download','document:update','document:delete',

      //Reports
      'report:create', 'report:read', 'report:update',

      //Community Sessions
      'community_session:read','community_session:download','community_session:create',

      //Dashboard
      'dashboard:community',

      //Notifications
      'notification:read',
      'notification:delete',

      //Announcements
      'announcement:read',
      'announcement:delete',

      //Comments
      'comment:read',
      'comment:create',
      'comment:update',
      'comment:delete',

      //Projects
      'project:read',

      //Stakeholders
      'stakeholder:read'
    ]
  },
  youth_leaders: {
    description: 'Youth Leaders - Community role',
    category: 'Community Members',
    permissions: [
      'system_log:read',
      'role:read',
      //Surveys
      'survey:read', 'survey:respond',

      //Feedback
      'feedback:create', 'feedback:read', 'feedback:update','my_feedback:delete',
      'feedback:personal:read',

      //Documents
      'document:read','document:download','document:update','document:delete',

      //Community Sessions
      'community_session:read','community_session:download',

      //Dashboard
      'dashboard:community',

      //Notifications
      'notification:read',
      'notification:delete',

      //Announcements
      'announcement:read',
      'announcement:delete',

      //Comments
      'comment:read',
      'comment:create',
      'comment:update',
      'comment:delete',

      //Projects
      'project:read',

      //Stakeholders
      'stakeholder:read'
    ]
  },
  local_government_leaders: {
    description: 'Local Government Leaders - Community role',
    category: 'Community Members',
    permissions: [
      'system_log:read',
      'role:read',
      //Surveys
      'survey:read', 'survey:respond',

      //Feedback
      'feedback:create', 'feedback:read', 'feedback:update','my_feedback:delete',
      'feedback:personal:read',

      //Documents
      'document:read','document:download','document:update','document:delete',

      //Community Sessions
      'community_session:read','community_session:download',

      //Dashboard
      'dashboard:community',

      //Notifications
      'notification:read',
      'notification:delete',

      //Announcements
      'announcement:read',
      'announcement:delete',

      //Comments
      'comment:read',
      'comment:create',
      'comment:update',
      'comment:delete',

       //Projects
      'project:read',

      //Stakeholders
      'stakeholder:read'
    ]
  },
  school_representatives: {
    description: 'School Representatives - Community role',
    category: 'Community Members',
    permissions: [
      'system_log:read',
      'role:read',
      //Surveys
      'survey:read', 'survey:respond',

      //Feedback
      'feedback:create', 'feedback:read', 'feedback:update','my_feedback:delete',
      'feedback:personal:read',

      //Documents
      'document:read','document:download','document:update','document:delete',

      //Reports
      'report:create', 'report:read', 'report:update',

      //Community Sessions
      'community_session:read','community_session:download',

      //Dashboard
      'dashboard:community',

      //Notifications
      'notification:read',
      'notification:delete',

      //Announcements
      'announcement:read',
      'announcement:delete',

      //Comments
      'comment:read',
      'comment:create',
      'comment:update',
      'comment:delete',

       //Projects
      'project:read',

      //Stakeholders
      'stakeholder:read'
    ]
  },
  beneficiaries: {
    description: 'Beneficiaries - Community role',
    category: 'Community Members',
    permissions: [
      'system_log:read',
      'role:read',
      //Surveys
      'survey:read', 'survey:respond',

      //Feedback
      'feedback:create', 'feedback:read', 'feedback:update','my_feedback:delete',
      'feedback:personal:read',

      //Documents
      'document:read','document:download','document:update','document:delete',

      //Reports
      'report:create', 'report:read', 'report:update',

      //Community Sessions
      'community_session:read','community_session:download',

      //Dashboard
      'dashboard:community',

      //Notifications
      'notification:read',
      'notification:delete',

      //Announcements
      'announcement:read',
      'announcement:delete',

      //Comments
      'comment:read',
      'comment:create',
      'comment:update',
      'comment:delete',

       //Projects
      'project:read',

      //Stakeholders
      'stakeholder:read'
    ]
  },
  religious_community_representatives: {
    description: 'Religious Community Representatives - Community role',
    category: 'Community Members',
    permissions: [
      'system_log:read',
      'role:read',
      //Surveys
      'survey:read', 'survey:respond',

      //Feedback
      'feedback:create', 'feedback:read', 'feedback:update','my_feedback:delete',
      'feedback:personal:read',

      //Documents
      'document:read','document:download','document:update','document:delete',

      //Reports
      'report:create', 'report:read', 'report:update',

      //Community Sessions
      'community_session:read','community_session:download',

      //Dashboard
      'dashboard:community',

      //Notifications
      'notification:read',
      'notification:delete',

      //Announcements
      'announcement:read',
      'announcement:delete',

      //Comments
      'comment:read',
      'comment:create',
      'comment:update',
      'comment:delete',

       //Projects
      'project:read',

      //Stakeholders
      'stakeholder:read'
    ]
  },
  general_population: {
    description: 'General Population - Community role',
    category: 'Community Members',
    permissions: [
      'system_log:read',
      'role:read',
      //Surveys
      'survey:read', 'survey:respond',

      //Feedback
      'feedback:create', 'feedback:read', 'feedback:update','my_feedback:delete',
      'feedback:personal:read',

      //Documents
      'document:read','document:download','document:update','document:delete',

      //Community Sessions
      'community_session:read','community_session:download',

      //Dashboard
      'dashboard:community',

      //Notifications
      'notification:read',
      'notification:delete',

      //Announcements
      'announcement:read',
      'announcement:delete',

      //Comments
      'comment:read',
      'comment:create',
      'comment:update',
      'comment:delete',

       //Projects
      'project:read',

      //Stakeholders
      'stakeholder:read'
      ]
  },
  
  // Health service providers
  nurses: {
    description: 'Nurses - Health Services role',
    category: 'Health service providers',
    permissions: [
      'system_log:read',
      'role:read',
      //Surveys
      'survey:read', 'survey:respond','survey:create','survey:update','survey:delete',

      //Feedback
      'feedback:create', 'feedback:read', 'feedback:update','my_feedback:delete',
      'feedback:personal:read',

      //Documents
      'document:read','document:download','document:update','document:delete',

      //Reports
      'report:create', 'report:read', 'report:update',

      //Community Sessions
      'community_session:read','community_session:download',

      //Dashboard
      'dashboard:health',

      //Notifications
      'notification:read',
      'notification:delete',

      //Announcements
      'announcement:read',
      'announcement:delete',

      //Comments
      'comment:read',
      'comment:create',
      'comment:update',
      'comment:delete',

       //Projects
      'project:read',

      //Stakeholders
      'stakeholder:read'
      ]
  },
  chw: {
    description: 'Community Health Workers - Health Services role',
    category: 'Health service providers',
    permissions: [
      'system_log:read',
      'role:read',
      //Surveys
      'survey:read', 'survey:respond','survey:create','survey:update','survey:delete',

      //Feedback
      'feedback:create', 'feedback:read', 'feedback:update','my_feedback:delete',
      'feedback:personal:read',

      //Documents
      'document:read','document:download','document:update','document:delete',

      //Reports
      'report:create', 'report:read', 'report:update',

      //Community Sessions
      'community_session:read','community_session:download',

      //Dashboard
      'dashboard:health',

      //Notifications
      'notification:read',
      'notification:delete',

      //Announcements
      'announcement:read',
      'announcement:delete',

      //Comments
      'comment:read',
      'comment:create',
      'comment:update',
      'comment:delete',

       //Projects
      'project:read',

      //Stakeholders
      'stakeholder:read'
    ]
  },
  epi_managers: {
    description: 'EPI Managers - Health Services role',
    category: 'Health service providers',
    permissions: [
      'system_log:read',
      'role:read',
      //Surveys
      'survey:read', 'survey:respond','survey:create','survey:update','survey:delete',

      //Feedback
      'feedback:create', 'feedback:read', 'feedback:update','my_feedback:delete',
      'feedback:personal:read',

      //Documents
      'document:read','document:download','document:update','document:delete',

      //Reports
      'report:create', 'report:read', 'report:update',

      //Community Sessions
      'community_session:read','community_session:download',

      //Dashboard
      'dashboard:health',

      //Notifications
      'notification:read',
      'notification:delete',

      //Announcements
      'announcement:read',
      'announcement:delete',

      //Comments
      'comment:read',
      'comment:create',
      'comment:update',
      'comment:delete',

       //Projects
      'project:read',

      //Stakeholders
      'stakeholder:read'
    ]
  },
  doctors: {
    description: 'Doctors - Health Services role',
    category: 'Health service providers',
    permissions: [
      'system_log:read',
      'role:read',
      //Surveys
      'survey:read', 'survey:respond','survey:create','survey:update','survey:delete',

      //Feedback
      'feedback:create', 'feedback:read', 'feedback:update','my_feedback:delete',
      'feedback:personal:read',

      //Documents
      'document:read','document:download','document:update','document:delete',

      //Reports
      'report:create', 'report:read', 'report:update',

      //Community Sessions
      'community_session:read','community_session:download',

      //Dashboard
      'dashboard:health',

      //Notifications
      'notification:read',
      'notification:delete',

      //Announcements
      'announcement:read',
      'announcement:delete',

      //Comments
      'comment:read',
      'comment:create',
      'comment:update',
      'comment:delete',

       //Projects
      'project:read',

      //Stakeholders
      'stakeholder:read'
    ]
  },
  health_facility_managers: {
    description: 'Health Facility Managers - Health Services role',
    category: 'Health service providers',
    permissions: [
      'system_log:read',
      'role:read',
      //Surveys
      'survey:read', 'survey:respond','survey:create','survey:update','survey:delete',

      //Feedback
      'feedback:create', 'feedback:read', 'feedback:update','my_feedback:delete',
      'feedback:personal:read',

      //Documents
      'document:read','document:download','document:update','document:delete',

      //Reports
      'report:create', 'report:read', 'report:update',

      //Community Sessions
      'community_session:read','community_session:download',

      //Dashboard
      'dashboard:health',

      //Notifications
      'notification:read',
      'notification:delete',

      //Announcements
      'announcement:read',
      'announcement:delete',

      //Comments
      'comment:read',
      'comment:create',
      'comment:update',
      'comment:delete',

       //Projects
      'project:read',

      //Stakeholders
      'stakeholder:read'
    ]
  },
  anc: {
    description: 'ANC - Health Services role',
    category: 'Health service providers',
    permissions: [
      'system_log:read',
      'role:read',
      //Surveys
      'survey:read', 'survey:respond','survey:create','survey:update','survey:delete',

      //Feedback
      'feedback:create', 'feedback:read', 'feedback:update','my_feedback:delete',
      'feedback:personal:read',

      //Documents
      'document:read','document:download','document:update','document:delete',

      //Reports
      'report:create', 'report:read', 'report:update',

      //Community Sessions
      'community_session:read','community_session:download',

      //Dashboard
      'dashboard:health',

      //Notifications
      'notification:read',
      'notification:delete',

      //Announcements
      'announcement:read',
      'announcement:delete',

      //Comments
      'comment:read',
      'comment:create',
      'comment:update',
      'comment:delete',

       //Projects
      'project:read',

      //Stakeholders
      'stakeholder:read'
    ]
  },
  cho: {
    description: 'CHO - Health Services role',
    category: 'Health service providers',
    permissions: [
      'system_log:read',
      'role:read',
      //Surveys
      'survey:read', 'survey:respond','survey:create','survey:update','survey:delete',

      //Feedback
      'feedback:create', 'feedback:read', 'feedback:update','my_feedback:delete',
      'feedback:personal:read',

      //Documents
      'document:read','document:download','document:update','document:delete',

      //Reports
      'report:create', 'report:read', 'report:update',

      //Community Sessions
      'community_session:read','community_session:download',

      //Dashboard
      'dashboard:health',

      //Notifications
      'notification:read',
      'notification:delete',

      //Announcements
      'announcement:read',
      'announcement:delete',

      //Comments
      'comment:read',
      'comment:create',
      'comment:update',
      'comment:delete',

       //Projects
      'project:read',

      //Stakeholders
      'stakeholder:read'
    ]
  },
  frontline_health_workers: {
    description: 'Frontline Health Workers - Health Services role',
    category: 'Health service providers',
    permissions: [
      'system_log:read',
      'role:read',
      //Surveys
      'survey:read', 'survey:respond','survey:create','survey:update','survey:delete',

      //Feedback
      'feedback:create', 'feedback:read', 'feedback:update','my_feedback:delete',
      'feedback:personal:read',

      //Documents
      'document:read','document:download','document:update','document:delete',

      //Reports
      'report:create', 'report:read', 'report:update',

      //Community Sessions
      'community_session:read','community_session:download',

      //Dashboard
      'dashboard:health',

      //Notifications
      'notification:read',
      'notification:delete',

      //Announcements
      'announcement:read',
      'announcement:delete',

      //Comments
      'comment:read',
      'comment:create',
      'comment:update',
      'comment:delete',

       //Projects
      'project:read',

      //Stakeholders
      'stakeholder:read'
    ]
  },
  
  // RICH Staff
  religious_leaders: {
    description: 'Religious Leaders - RICH Staff role',
    category: 'RICH Staff',
    permissions: [
      'system_log:read',
      'role:read',
      'survey:read', 'survey:respond', 'survey:create', 'survey:update','survey:forms',
      'feedback:create', 'feedback:read','feedback:all:read',
      'document:read',
      'community_session:read', 'community_session:create', 'community_session:download',
      'dashboard:religious',
      'notification:read',
      'announcement:read',
      'service:rating',
      'project:read',
      'comment:read',
      'comment:create',
      'comment:update',
      'rapid_enquiry:create',
      'rapid_enquiry:read',
      'rapid_enquiry:update',
      'rapid_enquiry:delete',

      //Projects
      'project:read',

      //Stakeholders
      'stakeholder:read',
      'stakeholder:create',
      'stakeholder:update',
      'stakeholder:delete',

      //Weekly Reports
      'weeklyreport:create',
      'weeklyreport:read',
      'weeklyreport:update'
    ]
  },
  rich_staff: {
    description: 'RICH Staff  - RICH Staff role',
    category: 'RICH Staff',
    permissions: [
      'system_log:read',
      'weekly_report:read',
      'role:read',
      'survey:read', 'survey:respond', 'survey:create', 'survey:update','survey:forms','survey:all:read',
      'feedback:create', 'feedback:read','feedback:all:read', 'feedback:all:delete','feedback:update','feedback:delete','my_feedback:delete',
      'document:read',
      'community_session:read', 'community_session:create',
      'dashboard:religious',
      'notification:read',
      'announcement:read',
      'service:rating',
      'project:read',
      'comment:read',
      'comment:create',
      'comment:update',
      'rapid_enquiry:create',
      'rapid_enquiry:read',
      'rapid_enquiry:update',
      'rapid_enquiry:delete',

      //Users
        'user:view',
        'user:create',
        'user:update',
        'user:delete',

        //Roles
        'role:read',

       //Projects
      'project:read',

      //Stakeholders
      'stakeholder:read',
      'stakeholder:create',
      'stakeholder:update',
      'stakeholder:delete',

      //Weekly Reports
      'weeklyreport:create',
      'weeklyreport:read',
      'weeklyreport:update',
      'weeklyreport:delete',
      'weeklyreport:review'
    ]
  },
  
  // System roles
  super_admin: {
    description: 'Has all permissions',
    category: 'System',
    permissions: permissions.map(p => p.name)
  },
  admin: {
    description: 'System administrator with all permissions',
    category: 'System',
    permissions: permissions.map(p => p.name)
  }
};

// Create roles array from templates
const roles = Object.entries(roleTemplates).map(([name, role]) => ({
  name,
  ...role
}));

// Function to set up system permissions and roles
const setupSystem = async () => {
  try {
    // Test the database connection first
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    
    console.log('🔄 Creating database schema...');
    // Use force: true to ensure tables are recreated from scratch
    await sequelize.sync({ force: true });
    await initializeDatabase();
    console.log('✅ Database models synchronized.');

    // Create permissions - now we can safely query since tables exist
    console.log('🔄 Creating permissions...');
    const createdPermissions = [];
    
    for (const permission of permissions) {
      try {
        // Since we used force: true, tables are empty, so we can directly create
        const newPermission = await db.Permission.create({
          name: String(permission.name).trim(),
          description: permission.description
        });
        
        console.log(`✅ Created permission: ${newPermission.name}`);
        createdPermissions.push(newPermission);
      } catch (error) {
        console.error(`❌ Error creating permission ${permission.name}:`, error);
        throw error;
      }
    }
    console.log(`${createdPermissions.length} permissions created.`);

    // Create roles and associate permissions
    console.log('🔄 Creating roles and associating permissions...');
    const createdRoles = [];
    
    for (const roleData of roles) {
      try {
        // Create new role (tables are empty due to force: true)
        const role = await db.Role.create({
          name: String(roleData.name).trim(),
          description: roleData.description,
          category: (roleData as any).category ?? null,
        });
        console.log(`✅ Created role: ${role.name}`);

        // Get permission instances for this role
        const rolePermissions = await db.Permission.findAll({
          where: { name: roleData.permissions }
        });

        if (rolePermissions.length > 0) {
          // Use setPermissions to associate all permissions at once
          // This is more efficient than adding one by one
          await (role as any).setPermissions(rolePermissions);
          console.log(`🔗 Associated ${rolePermissions.length} permissions with role ${role.name}`);
        } else {
          console.warn(`⚠️  No permissions found for role: ${role.name}`);
        }
        
        createdRoles.push(role);
      } catch (error) {
        console.error(`❌ Error processing role ${roleData.name}:`, error);
        throw error;
      }
    }
    console.log(`${createdRoles.length} roles created with permissions.`);

    // Create super admin user and RICH organization
    try {
      const superEmail = 'richrwanda@gmail.com';
      const superPlain = 'richrwanda2025';
      let superUser = await db.User.findOne({ where: { email: superEmail } });
      if (!superUser) {
        const hashed = await hash(superPlain, 10);
        superUser = await db.User.create({
          name: 'RICHUBUZIMA',
          email: superEmail,
          password: hashed,
          phone: '250788307845',
          status: 'active',
          emailVerified: true,
        });
        console.log('✅ Created super admin user');
      } else {
        console.log('ℹ️ Super admin user already exists');
      }

      let richOrg = await db.Organization.findOne({ where: { name: 'RICH' } });
      if (!richOrg) {
        richOrg = await db.Organization.create({
          name: 'RICH',
          description: 'RICH organization created by system setup',
          type: 'system_owner',
          status: 'active',
          ownerId: superUser.id,
        } as any);
        console.log('✅ Created RICH organization');
      } else {
        console.log('ℹ️ RICH organization already exists');
      }

      // ensure association
      try {
        await (richOrg as any).addUser(superUser);
      } catch (e) {
        // ignore if already associated
      }

      const superRole = await db.Role.findOne({ where: { name: 'super_admin' } });
      if (superRole) {
        try {
          await (superUser as any).addRole(superRole);
        } catch (e) {
          // ignore if already assigned
        }
      }

      console.log('🔐 Super admin setup complete');
    } catch (err) {
      console.error('❌ Failed to create super admin or RICH org:', err);
      throw err;
    }

    // Create default website settings
    try {
      console.log('🔄 Creating default website settings...');
      
      let existingSettings = await db.Settings.findOne({ where: { isActive: true } });
      if (!existingSettings) {
        // Create the main settings record
        const settings = await db.Settings.create({
          websiteName: 'Community Listening',
          websiteDescription: 'Amplifying community voices through faith-based collaboration. Join our interfaith network promoting health, unity, and sustainable development across Rwanda.',
          logoUrl: 'https://sugiramwana.rw/logo192.png',
          faviconUrl: 'https://sugiramwana.rw/favicon.ico',
          primaryColor: '#004f64',
          secondaryColor: '#0ea5e9',
          contactEmail: 'info@richubuzima.rw',
          contactPhone: '+250788307845',
          address: 'Kigali, Rwanda',
          socialLinks: {
            facebook: 'https://facebook.com/communitylistening',
            twitter: 'https://twitter.com/communitylistening',
            linkedin: 'https://linkedin.com/company/communitylistening',
            instagram: 'https://instagram.com/communitylistening'
          },
          metaTitle: 'Community Listening - Amplifying Voices Through Faith',
          metaDescription: 'Join our interfaith network promoting health, unity, and sustainable development across Rwanda through community engagement.',
          metaKeywords: 'community, faith, health, Rwanda, interfaith, development, listening, voices',
          isActive: true
        });

        console.log('✅ Created default settings');

        // Create slideshow images
        const slideshowData = [
          {
            settingsId: settings.id,
            imageUrl: 'https://sugiramwana.rw/images/religious_trainees.jpg',
            altText: 'Community health workers in Rwanda',
            statisticsTitle: 'Training Impact',
            statisticsLabel: 'Community health workers',
            statisticsValue: '450+ trained',
            order: 0,
            isActive: true
          },
          {
            settingsId: settings.id,
            imageUrl: 'https://sugiramwana.rw/images/gbc_support.jpg',
            altText: 'Gender based violence',
            statisticsTitle: 'GBV Support',
            statisticsLabel: 'Gender based victims supported',
            statisticsValue: '2,720+',
            order: 1,
            isActive: true
          },
          {
            settingsId: settings.id,
            imageUrl: 'https://sugiramwana.rw/images/ecd_children.jpg',
            altText: 'ECD Program for children',
            statisticsTitle: 'ECD Program',
            statisticsLabel: 'Children enrolled in ECD',
            statisticsValue: '5,854 children',
            order: 2,
            isActive: true
          },
          {
            settingsId: settings.id,
            imageUrl: 'https://sugiramwana.rw/images/counciljpg.jpg',
            altText: 'Community reached',
            statisticsTitle: 'Community Outreach',
            statisticsLabel: 'Community members',
            statisticsValue: '2M+ members',
            order: 3,
            isActive: true
          }
        ];

        await db.Slideshow.bulkCreate(slideshowData);
        console.log('✅ Created slideshow images');

        // Create impact statistics
        const impactData = [
          { settingsId: settings.id, icon: 'FaUsers', value: '2M+', label: 'Community Members Reached', color: 'bg-blue-500', order: 0, isActive: true },
          { settingsId: settings.id, icon: 'FaChild', value: '5,854+', label: 'Children Enrolled in ECD Programs', color: 'bg-pink-500', order: 1, isActive: true },
          { settingsId: settings.id, icon: 'FaHeart', value: '2,720+', label: 'GBV Victims Supported', color: 'bg-red-500', order: 2, isActive: true },
          { settingsId: settings.id, icon: 'MdVolunteerActivism', value: '3,784+', label: 'Religious Volunteers', color: 'bg-green-500', order: 3, isActive: true },
          { settingsId: settings.id, icon: 'MdFamilyRestroom', value: '3,464+', label: 'Households in ECD Programs', color: 'bg-purple-500', order: 4, isActive: true },
          { settingsId: settings.id, icon: 'FaUserMd', value: '180+', label: 'Health Workers Trained', color: 'bg-teal-500', order: 5, isActive: true },
          { settingsId: settings.id, icon: 'MdSchool', value: '19+', label: 'Model ECD Centers', color: 'bg-orange-500', order: 6, isActive: true },
          { settingsId: settings.id, icon: 'FaChurch', value: '128+', label: 'Religious Leaders Trained', color: 'bg-indigo-500', order: 7, isActive: true },
          { settingsId: settings.id, icon: 'FaHospital', value: '135+', label: 'Health Centers Partnered', color: 'bg-cyan-500', order: 8, isActive: true },
          { settingsId: settings.id, icon: 'FaGraduationCap', value: '285+', label: 'ECD Animateurs', color: 'bg-amber-500', order: 9, isActive: true },
          { settingsId: settings.id, icon: 'FaHandsHelping', value: '60+', label: 'Family Counsellors', color: 'bg-rose-500', order: 10, isActive: true },
          { settingsId: settings.id, icon: 'FaBrain', value: '10K+', label: 'Mental Health Messages Delivered', color: 'bg-violet-500', order: 11, isActive: true },
          { settingsId: settings.id, icon: 'BiHealth', value: '500K+', label: 'SBC Intervention Beneficiaries', color: 'bg-emerald-500', order: 12, isActive: true },
          { settingsId: settings.id, icon: 'FaShieldAlt', value: '6+', label: 'Isange One Stop Centers Supported', color: 'bg-lime-500', order: 13, isActive: true },
          { settingsId: settings.id, icon: 'FaUserFriends', value: '144+', label: 'Youth Group Leaders Engaged', color: 'bg-sky-500', order: 14, isActive: true },
          { settingsId: settings.id, icon: 'FiTrendingUp', value: '16+', label: 'Districts with ECD Centers', color: 'bg-yellow-500', order: 15, isActive: true }
        ];

        await db.Impact.bulkCreate(impactData);
        console.log('✅ Created impact statistics');
        console.log('🌐 Default website settings setup complete');
      } else {
        console.log('ℹ️ Website settings already exist');
      }
    } catch (err) {
      console.error('❌ Failed to create default website settings:', err);
      throw err;
    }

    console.log('✅ System setup completed successfully!');
    return {
      roles: createdRoles.length,
      permissions: createdPermissions.length
    };
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
};

// Alternative setup function that preserves existing data
const setupSystemPreserveData = async () => {
  try {
    // Test the database connection first
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    
    console.log('🔄 Creating/updating database schema...');
    // Use alter: true to modify existing tables without dropping data
    await sequelize.sync({ alter: true });
    await initializeDatabase();
    console.log('✅ Database models synchronized.');

    // Create permissions one by one, checking for existence
    console.log('🔄 Creating permissions...');
    const createdPermissions = [];
    
    for (const permission of permissions) {
      try {
        // Use findOrCreate to avoid duplicates
        const [newPermission, created] = await db.Permission.findOrCreate({
          where: { name: permission.name },
          defaults: {
            name: String(permission.name).trim(),
            description: permission.description
          }
        });
        
        if (created) {
          console.log(`✅ Created permission: ${newPermission.name}`);
        } else {
          console.log(`ℹ️  Permission already exists: ${newPermission.name}`);
        }
        createdPermissions.push(newPermission);
      } catch (error) {
        console.error(`❌ Error creating permission ${permission.name}:`, error);
        throw error;
      }
    }
    console.log(`${createdPermissions.length} permissions processed.`);

    // Create roles and associate permissions
    console.log('🔄 Creating roles and associating permissions...');
    const createdRoles = [];
    
    for (const roleData of roles) {
      try {
        // Use findOrCreate to avoid duplicates
        const [role, created] = await db.Role.findOrCreate({
          where: { name: roleData.name },
          defaults: {
            name: roleData.name.trim(),
            description: roleData.description,
            category: (roleData as any).category ?? null,
          }
        });

        if (created) {
          console.log(`✅ Created role: ${role.name}`);
        } else {
          console.log(`ℹ️  Role already exists: ${role.name}`);
        }

        // Get permission instances for this role
        const rolePermissions = await db.Permission.findAll({
          where: { name: roleData.permissions }
        });

        if (rolePermissions.length > 0) {
          // Use setPermissions to replace all existing associations efficiently
          // This will remove old permissions and set new ones in one operation
          await (role as any).setPermissions(rolePermissions);
          console.log(`🔗 Associated ${rolePermissions.length} permissions with role ${role.name}`);
        } else {
          console.warn(`⚠️  No permissions found for role: ${role.name}`);
        }
        
        createdRoles.push(role);
      } catch (error) {
        console.error(`❌ Error processing role ${roleData.name}:`, error);
        throw error;
      }
    }
    console.log(`${createdRoles.length} roles processed with permissions.`);

    // Ensure super admin user and RICH org exist (preserve flow)
    try {
      const superEmail = 'richrwanda@gmail.com';
      const superPlain = 'richrwanda2025';
      let superUser = await db.User.findOne({ where: { email: superEmail } });
      if (!superUser) {
        const hashed = await hash(superPlain, 10);
        superUser = await db.User.create({
          name: 'Super Admin',
          email: superEmail,
          password: hashed,
          phone: '+250000000000',
          status: 'active',
          emailVerified: true,
        } as any);
        console.log('✅ Created super admin user');
      } else {
        console.log('ℹ️ Super admin user already exists');
      }

      let richOrg = await db.Organization.findOne({ where: { name: 'RICH' } });
      if (!richOrg) {
        richOrg = await db.Organization.create({
          name: 'RICH',
          description: 'RICH organization created by system setup',
          type: 'system_owner',
          status: 'active',
          ownerId: superUser.id,
        } as any);
        console.log('✅ Created RICH organization');
      } else {
        console.log('ℹ️ RICH organization already exists');
      }

      // ensure association
      try {
        await (richOrg as any).addUser(superUser);
      } catch (e) {
        // ignore if already associated
      }

      const superRole = await db.Role.findOne({ where: { name: 'super_admin' } });
      if (superRole) {
        try {
          await (superUser as any).addRole(superRole);
        } catch (e) {
          // ignore if already assigned
        }
      }

      console.log('🔐 Super admin setup complete (preserve)');
    } catch (err) {
      console.error('❌ Failed to ensure super admin or RICH org in preserve flow:', err);
      throw err;
    }

    // Create default website settings (preserve mode)
    try {
      console.log('🔄 Creating default website settings (preserve mode)...');
      
      let existingSettings = await db.Settings.findOne({ where: { isActive: true } });
      if (!existingSettings) {
        // Create the main settings record
        const settings = await db.Settings.create({
          websiteName: 'Community Listening',
          websiteDescription: 'Amplifying community voices through faith-based collaboration. Join our interfaith network promoting health, unity, and sustainable development across Rwanda.',
          logoUrl: 'https://sugiramwana.rw/logo192.png',
          faviconUrl: 'https://sugiramwana.rw/favicon.ico',
          primaryColor: '#004f64',
          secondaryColor: '#0ea5e9',
          contactEmail: 'info@richubuzima.rw',
          contactPhone: '+250788307845',
          address: 'Kigali, Rwanda',
          socialLinks: {
            facebook: 'https://facebook.com/communitylistening',
            twitter: 'https://twitter.com/communitylistening',
            linkedin: 'https://linkedin.com/company/communitylistening',
            instagram: 'https://instagram.com/communitylistening'
          },
          metaTitle: 'Community Listening - Amplifying Voices Through Faith',
          metaDescription: 'Join our interfaith network promoting health, unity, and sustainable development across Rwanda through community engagement.',
          metaKeywords: 'community, faith, health, Rwanda, interfaith, development, listening, voices',
          isActive: true
        });

        console.log('✅ Created default settings (preserve)');

        // Create slideshow images
        const slideshowData = [
          {
            settingsId: settings.id,
            imageUrl: 'https://sugiramwana.rw/images/religious_trainees.jpg',
            altText: 'Community health workers in Rwanda',
            statisticsTitle: 'Training Impact',
            statisticsLabel: 'Community health workers',
            statisticsValue: '450+ trained',
            order: 0,
            isActive: true
          },
          {
            settingsId: settings.id,
            imageUrl: 'https://sugiramwana.rw/images/gbc_support.jpg',
            altText: 'Gender based violence',
            statisticsTitle: 'GBV Support',
            statisticsLabel: 'Gender based victims supported',
            statisticsValue: '2,720+',
            order: 1,
            isActive: true
          },
          {
            settingsId: settings.id,
            imageUrl: 'https://sugiramwana.rw/images/ecd_children.jpg',
            altText: 'ECD Program for children',
            statisticsTitle: 'ECD Program',
            statisticsLabel: 'Children enrolled in ECD',
            statisticsValue: '5,854 children',
            order: 2,
            isActive: true
          },
          {
            settingsId: settings.id,
            imageUrl: 'https://sugiramwana.rw/images/counciljpg.jpg',
            altText: 'Community reached',
            statisticsTitle: 'Community Outreach',
            statisticsLabel: 'Community members',
            statisticsValue: '2M+ members',
            order: 3,
            isActive: true
          }
        ];

        await db.Slideshow.bulkCreate(slideshowData);
        console.log('✅ Created slideshow images (preserve)');

        // Create impact statistics
        const impactData = [
          { settingsId: settings.id, icon: 'FaUsers', value: '2M+', label: 'Community Members Reached', color: 'bg-blue-500', order: 0, isActive: true },
          { settingsId: settings.id, icon: 'FaChild', value: '5,854+', label: 'Children Enrolled in ECD Programs', color: 'bg-pink-500', order: 1, isActive: true },
          { settingsId: settings.id, icon: 'FaHeart', value: '2,720+', label: 'GBV Victims Supported', color: 'bg-red-500', order: 2, isActive: true },
          { settingsId: settings.id, icon: 'MdVolunteerActivism', value: '3,784+', label: 'Religious Volunteers', color: 'bg-green-500', order: 3, isActive: true },
          { settingsId: settings.id, icon: 'MdFamilyRestroom', value: '3,464+', label: 'Households in ECD Programs', color: 'bg-purple-500', order: 4, isActive: true },
          { settingsId: settings.id, icon: 'FaUserMd', value: '180+', label: 'Health Workers Trained', color: 'bg-teal-500', order: 5, isActive: true },
          { settingsId: settings.id, icon: 'MdSchool', value: '19+', label: 'Model ECD Centers', color: 'bg-orange-500', order: 6, isActive: true },
          { settingsId: settings.id, icon: 'FaChurch', value: '128+', label: 'Religious Leaders Trained', color: 'bg-indigo-500', order: 7, isActive: true },
          { settingsId: settings.id, icon: 'FaHospital', value: '135+', label: 'Health Centers Partnered', color: 'bg-cyan-500', order: 8, isActive: true },
          { settingsId: settings.id, icon: 'FaGraduationCap', value: '285+', label: 'ECD Animateurs', color: 'bg-amber-500', order: 9, isActive: true },
          { settingsId: settings.id, icon: 'FaHandsHelping', value: '60+', label: 'Family Counsellors', color: 'bg-rose-500', order: 10, isActive: true },
          { settingsId: settings.id, icon: 'FaBrain', value: '10K+', label: 'Mental Health Messages Delivered', color: 'bg-violet-500', order: 11, isActive: true },
          { settingsId: settings.id, icon: 'BiHealth', value: '500K+', label: 'SBC Intervention Beneficiaries', color: 'bg-emerald-500', order: 12, isActive: true },
          { settingsId: settings.id, icon: 'FaShieldAlt', value: '6+', label: 'Isange One Stop Centers Supported', color: 'bg-lime-500', order: 13, isActive: true },
          { settingsId: settings.id, icon: 'FaUserFriends', value: '144+', label: 'Youth Group Leaders Engaged', color: 'bg-sky-500', order: 14, isActive: true },
          { settingsId: settings.id, icon: 'FiTrendingUp', value: '16+', label: 'Districts with ECD Centers', color: 'bg-yellow-500', order: 15, isActive: true }
        ];

        await db.Impact.bulkCreate(impactData);
        console.log('✅ Created impact statistics (preserve)');
        console.log('🌐 Default website settings setup complete (preserve)');
      } else {
        console.log('ℹ️ Website settings already exist (preserve)');
      }
    } catch (err) {
      console.error('❌ Failed to create default website settings (preserve):', err);
      throw err;
    }

    console.log('✅ System setup completed successfully!');
    return {
      roles: createdRoles.length,
      permissions: createdPermissions.length
    };
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
};

// Run the setup if this file is executed directly
// Choose which setup function to use based on your needs
const runSetup = process.env.PRESERVE_DATA === 'true' ? setupSystemPreserveData : setupSystem;

runSetup()
    .then((result) => {
      console.log('✅ System setup completed successfully!', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error during system setup:', error);
      process.exit(1);
    });

export { setupSystem, setupSystemPreserveData };