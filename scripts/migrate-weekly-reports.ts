import sequelize from '../config/database';

const migrateWeeklyReports = async () => {
  try {
    console.log('🔄 Starting weekly reports table migration...');
    
    // Drop the existing table if it exists
    await sequelize.getQueryInterface().dropTable('weekly_reports');
    console.log('✅ Dropped existing weekly_reports table');
    
    // Sync the WeeklyReport model to create the new table structure
    const { WeeklyReport } = await import('../models/weeklyreport');
    await WeeklyReport.sync({ force: true });
    console.log('✅ Created new weekly_reports table with updated structure');
    
    console.log('✅ Weekly reports migration completed successfully!');
  } catch (error) {
    console.error('❌ Error during weekly reports migration:', error);
    throw error;
  }
};

// Run migration if this file is executed directly
if (require.main === module) {
  migrateWeeklyReports()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { migrateWeeklyReports };