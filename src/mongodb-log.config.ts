export interface MongodbLogConfig {
  databaseName: string;
  connectionString: string;
  logsCollectionName?: string;
  additionalCollectionNames?: string[];
  timezone?: string;
  timezoneFormat?: string;
  localErrorPath: string;
  redisHost: string;
  redisPort: string;
  ApiEndpoint?: string;
  ApiHeaders?: string;
}
