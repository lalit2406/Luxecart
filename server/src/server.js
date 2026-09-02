import app from './app.js';
import { config } from './config/env.js';
import { connectDB, disconnectDB } from './config/database.js';

let server;

async function startServer() {
  try {
    // Attempt database connection if URI is configured
    if (config.mongoUri) {
      await connectDB(config.mongoUri);
    } else {
      console.warn('[Database] MONGODB_URI is not configured in environment.');
    }

    server = app.listen(config.port, () => {
      console.log(`LuxeCart Server running in ${config.nodeEnv} mode on port ${config.port}`);
    });

    // Setup graceful shutdown handlers
    const shutdown = async (signal) => {
      console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);
      if (server) {
        server.close(async () => {
          console.log('[Server] HTTP server closed.');
          await disconnectDB();
          console.log('[Server] Shutdown complete.');
          process.exit(0);
        });
      } else {
        await disconnectDB();
        process.exit(0);
      }

      // Force close if graceful shutdown takes too long
      setTimeout(() => {
        console.error('[Server] Forced shutdown after timeout.');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    process.on('unhandledRejection', (err) => {
      console.error('[Server] Unhandled Rejection:', err.message || err);
      if (server) {
        server.close(() => process.exit(1));
      } else {
        process.exit(1);
      }
    });

    return server;
  } catch (error) {
    console.error('[Server] Startup error:', error.message || error);
    process.exit(1);
  }
}

startServer();

export default app;
