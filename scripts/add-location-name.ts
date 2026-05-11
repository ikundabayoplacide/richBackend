import sequelize from '../config/database';
import { QueryInterface } from 'sequelize';

async function addLocationNameColumn() {
    const queryInterface: QueryInterface = sequelize.getQueryInterface();

    try {
        // Check if column exists
        const tableDescription = await queryInterface.describeTable('responses');

        if (!tableDescription.locationName) {
            console.log('Adding locationName column to responses table...');

            await queryInterface.addColumn('responses', 'locationName', {
                type: 'VARCHAR(255)',
                allowNull: true,
                comment: 'Human-readable location name from reverse geocoding',
            });

            console.log('✅ Column added successfully!');
        } else {
            console.log('✅ Column already exists!');
        }
    } catch (error) {
        console.error('❌ Error adding column:', error);
        throw error;
    } finally {
        await sequelize.close();
    }
}

addLocationNameColumn();
