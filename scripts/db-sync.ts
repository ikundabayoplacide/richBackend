import { Sequelize } from "sequelize";
import config from "../config/config";
import { initializeDatabase } from "../config/database";
import sequelize from "../config/database";

const syncDatabase = async () => {
    try {
        console.log("Starting database synchronization...");

        // Ensure connection is established
        await sequelize.authenticate();
        console.log("Database connection established.");

        // Run sync with alter: true
        await sequelize.sync({ alter: true });
        console.log("Database synchronized successfully.");

        process.exit(0);
    } catch (error) {
        console.error("Error synchronizing database:", error);
        process.exit(1);
    }
};

syncDatabase();
