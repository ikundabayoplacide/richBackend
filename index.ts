import config from "@/config/config";
import app from "@/server";
import { startAnnouncementScheduler } from "@/jobs/announcementScheduler";
import { initializeDatabase } from "@/config/database";
const PORT = Number(process.env.PORT) || config.port;

const server = app.listen(PORT, "0.0.0.0", async () => {
	console.log(`Server running on port ${PORT}`);
	await initializeDatabase();
	startAnnouncementScheduler();
});

const onCloseSignal = () => {
	console.log("sigint received, shutting down");
	server.close(() => {
		console.log("server closed");
		process.exit();
	});
	setTimeout(() => process.exit(1), 10000).unref(); // Force shutdown after 10s
};

process.on("SIGINT", onCloseSignal);
process.on("SIGTERM", onCloseSignal);
