import sequelize from '../config/database';
import { QueryInterface } from 'sequelize';

async function addResponderLocationColumn() {
    const queryInterface: QueryInterface = sequelize.getQueryInterface();

    try {
        // Check if column exists
        const tableDescription = await queryInterface.describeTable('responses');

        if (!tableDescription.responderLocation) {
            console.log('Adding responderLocation column to responses table...');

            await queryInterface.addColumn('responses', 'responderLocation', {
                type: 'VARCHAR(255)',
                allowNull: true,
                comment: 'GPS coordinates or location string of the responder',
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

addResponderLocationColumn();
