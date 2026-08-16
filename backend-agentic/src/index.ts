import { app } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { defaultWorker } from './queue/worker.js';
import { startStaleMissionSweeper } from './queue/sweeper.js';

async function bootstrap() {
  try {
    // 1. Connect to MongoDB Atlas
    await connectDB();

    // 2. Start HTTP Server
    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 PandaPrep Agentic Backend running on port ${env.PORT} [${env.NODE_ENV}]`);
    });

    // 3. Start Background Worker Loop
    defaultWorker.start();

    // 4. Start Background Stale Mission Sweeper
    const sweeper = startStaleMissionSweeper();

    // Graceful Shutdown Handling
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Received shutdown signal. Commencing graceful shutdown...');
      sweeper.stop();

      // Arm a force-exit safety BEFORE awaiting worker stop: a hung LLM call inside
      // graph.invoke would otherwise block SIGINT forever.
      const forceExit = setTimeout(() => {
        logger.error('Forced exit after shutdown timeout');
        process.exit(1);
      }, 10000);
      forceExit.unref();

      await defaultWorker.stop();

      await new Promise<void>((resolve) => {
        server.close(() => {
          logger.info('HTTP server closed');
          resolve();
        });
      });

      clearTimeout(forceExit);
      await disconnectDB();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error({ err: error }, 'Fatal error during server bootstrap');
    process.exit(1);
  }
}

bootstrap();