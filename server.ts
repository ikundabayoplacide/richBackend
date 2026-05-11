import express, { NextFunction, type Request, type Response } from "express";
import swaggerUi from "swagger-ui-express";
import { RegisterRoutes } from "./generated/routes";
import errorHandlerMiddleware from "./middlewares/errorHandler";
import dotenv from "dotenv";
import { initializeDatabase } from "./config/database";

// Ensure all models are loaded and associations are registered
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";

dotenv.config();

const app = express();

// Track database connection status
let databaseConnected = false;
let databaseError: any = null;

// Initialize database connection
initializeDatabase().then((result) => {
  databaseConnected = result.success;
  if (!result.success) {
    databaseError = result.error;
  }
});

const allowedOrigins = [
  "http://localhost:3000",
  "capacitor://localhost",
  "https://richubuzima.rw",
  "https://api.richubuzima.rw",
  "http://localhost:8080",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = `The CORS policy for this site does not allow access from the specified origin: ${origin}`;
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposedHeaders: ["set-cookie"]
  })
);

app.use(express.json());
app.use(morgan("combined"));
app.use(cookieParser());

// Swagger docs - MUST be before the root route to avoid conflicts
import swaggerDocument from "./docs/swagger.json";

// Serve Swagger UI with proper CSP headers
app.use(
  "/docs",
  (req: Request, res: Response, next: NextFunction) => {
    // Set permissive CSP headers for Swagger UI to work through PHP proxy
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
    );
    next();
  },
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "API Documentation"
  })
);

// Root route - shows status without redirect
app.get("/", (req: Request, res: Response) => {
  if (!databaseConnected) {
    return res.status(503).json({
      error: "Failed to connect to database",
      message: "Database connection failed during startup",
      details: databaseError?.message || "Unknown database error",
      timestamp: new Date().toISOString()
    });
  }

  // Return API info instead of redirecting
  res.json({
    name: "API Server",
    version: "1.0.0",
    status: "running",
    database: "connected",
    documentation: "/docs",
    timestamp: new Date().toISOString()
  });
});

// Register TSOA-generated routes
RegisterRoutes(app);

const [notFoundHandler, errorLogger, errorResponder] = errorHandlerMiddleware();
app.use(notFoundHandler);
app.use(errorLogger);
app.use(errorResponder);

export default app;