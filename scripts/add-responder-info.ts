import sequelize from '../config/database';
import { QueryInterface } from 'sequelize';

async function addResponderInfoColumns() {
  const queryInterface: QueryInterface = sequelize.getQueryInterface();

  try {
    const tableDescription = await queryInterface.describeTable('responses');

    const columns: { name: string; after: string }[] = [
      { name: 'responderNId', after: 'userId' },
      { name: 'responderName', after: 'responderNId' },
      { name: 'responderDistrict', after: 'responderName' },
      { name: 'responderSector', after: 'responderDistrict' },
      { name: 'responderCell', after: 'responderSector' },
      { name: 'responderVillage', after: 'responderCell' },
      { name: 'responderHealthCenter', after: 'responderVillage' },
    ];

    for (const col of columns) {
      if (!tableDescription[col.name]) {
        console.log(`Adding ${col.name} column...`);
        await queryInterface.addColumn('responses', col.name, {
          type: 'VARCHAR(255)',
          allowNull: true,
          after: col.after,
        } as any);
        console.log(`✅ ${col.name} added`);
      } else {
        console.log(`✅ ${col.name} already exists`);
      }
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

addResponderInfoColumns();
