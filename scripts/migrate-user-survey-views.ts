import sequelize from '../config/database';
import { UserSurveyView } from '../models/userSurveyView';

const migrateUserSurveyViews = async () => {
  try {
    console.log('🔄 Starting user_survey_views table migration...');
    
    // Sync the UserSurveyView model to create the table
    await UserSurveyView.sync({ force: false });
    console.log('✅ Created user_survey_views table with indexes');
    
    console.log('✅ User survey views migration completed successfully!');
  } catch (error) {
    console.error('❌ Error during user survey views migration:', error);
    throw error;
  }
};

// Run migration if this file is executed directly
if (require.main === module) {
  migrateUserSurveyViews()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { migrateUserSurveyViews };
