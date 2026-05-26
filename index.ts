import config from "@/config/config";
import app from "@/server";
import { startAnnouncementScheduler } from "@/jobs/announcementScheduler";
const PORT = Number(process.env.PORT) || config.port;



const server = app.listen(PORT, "0.0.0.0", () => {
	console.log(`Server running on port ${PORT}`);
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
