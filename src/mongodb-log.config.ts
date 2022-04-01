export interface MongodbLogConfig {
  databaseName: string;
  connectionString: string;
  logsCollectionName?: string;
  additionalCollectionNames?: string[];
  timezone?: string;
  localeTimezone?: string;
  redisHost: string;
  redisPort: string;
}
