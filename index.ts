import config from "@/config/config";
import app from "@/server";
import { startAnnouncementScheduler } from "@/jobs/announcementScheduler";


const server = app.listen(config.port, "0.0.0.0", () => {
	const { nodeEnv, port } = config;
	console.log(`Server (${nodeEnv}) running on port http://0.0.0.0:${port}`);
	
	// Start scheduled jobs
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
