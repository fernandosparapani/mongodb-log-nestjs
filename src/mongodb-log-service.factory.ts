import { MongodbLogConfig } from './mongodb-log.config';
import { MongodbLogService } from './mongodb-log.service';
import { MongodbLogConnections } from './mongodb-log.connections';
import { DEFAULT_LOG_COLLECTION_NAME, MONGODB_LOG_CONFIG, DEFAULT_TIMEZONE, DEFAULT_TIMEZONE_FORMAT, DEFAULT_REDIS_HOST, DEFAULT_REDIS_PORT, DEFAULT_ERROR_PATH } from './constants';
import { MongodbLogError } from './mongodb-log.error';
import { Inject } from '@nestjs/common';

export class MongodbLogServiceFactory {
  static async create(
    @Inject(MONGODB_LOG_CONFIG) config: MongodbLogConfig,
    connections: MongodbLogConnections,
  ): Promise<MongodbLogService> {
    if (!config) {
      return null;
    }
    try {
      const connection = await connections.create(config.connectionString);
      return new MongodbLogService(
        connection,
        config.databaseName,
        config.logsCollectionName || DEFAULT_LOG_COLLECTION_NAME,
        config.redisHost || DEFAULT_REDIS_HOST,
        config.redisPort || DEFAULT_REDIS_PORT,
        config.timezone || DEFAULT_TIMEZONE,
        config.timezoneFormat || DEFAULT_TIMEZONE_FORMAT,
        config.localErrorPath || DEFAULT_ERROR_PATH,
        config.additionalCollectionNames,
        config.ApiEndpoint,
        config.ApiHeaders
      );
    } catch (error) {
      MongodbLogError.print(error.toString());
      throw error;
    }
  }
}
