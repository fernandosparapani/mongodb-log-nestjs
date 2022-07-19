import { MongoClient, Collection } from 'mongodb';
import { MongodbLogError } from './mongodb-log.error';
import * as Queue from 'bull';
import axios from 'axios';
import { utcToZonedTime, format } from 'date-fns-tz'
import pino from 'pino'

export class MongodbLogService {
  private logColletion: Collection;
  private additionalCollections: { [name: string]: Collection } = {};
  private mongoQueue: Queue.Queue;

  constructor(
    private readonly client: MongoClient,
    private readonly databaseName: string,
    private readonly logsCollectionName: string,
    private readonly redisHost: string,
    private readonly redisPort: string,
    private readonly timezone: string,
    private readonly timezoneFormat: string,
    private readonly localErrorPath: string,
    private readonly additionalCollectionNames?: string[],
    private readonly apiLoggerEndpoint?: string,
    private readonly apiHeaders?: string
  ) {
    try {
      const database = this.client.db(this.databaseName);
      this.logColletion = database.collection(this.logsCollectionName);
      this.additionalCollectionNames?.forEach((name) => {
        this.additionalCollections[name] = database.collection(name);
      });
    } catch (error) {
      this.internalErrorLog(error)
    }
    try {
      this.mongoQueue = new Queue('mongodb-queue-nestjs-' + this.databaseName, 'redis://' + this.redisHost + ':' + this.redisPort);
      this.queueListener();
    } catch (error) {
      this.internalErrorLog(error)
    }
  }

  async queueListener() {
    const queue = this.mongoQueue;
    const database = this.client.db(this.databaseName);

    queue.process(async (job, done) => {
      const logColletion: Collection = database.collection(job.data.collection);
      const data = job.data;

      try {
        if (job.data.useAPI) {

          const apiHeaders = JSON.parse(JSON.stringify(this.apiHeaders))

          try {
            await axios.post(this.apiLoggerEndpoint, data, { headers: { apiHeaders } });
          } catch (error) {
            this.internalErrorLog(error)
            MongodbLogError.print("error when call API " + this.apiLoggerEndpoint + error);
          }

        } else {
          await logColletion.insertOne({ ...data });
        }

      } catch (error) {
        this.internalErrorLog(error)
        MongodbLogError.print("Error when execute log queue: " + error);
      }
      done();
    });
  }

  async registerLog(log: any, registerDate: boolean = null) {

    let timestampString: string;
    if (registerDate) {
      timestampString = this.getTimestampString()
    }

    return await this.register(this.logColletion, log, timestampString);
  }

  async registerOn(collectionName: string, data: any, registerDate: boolean = null, useAPI: boolean = null) {

    let timestampString: string;

    if (registerDate) {
      timestampString = this.getTimestampString()
    }

    const collection = this.additionalCollections[collectionName];
    if (!collection) {
      this.internalErrorLog({ message: `Additional collection "${collectionName}" need to be set on module config.` })
      MongodbLogError.print(`Additional collection "${collectionName}" need to be set on module config.`);
      return;
    }

    await this.register(collection, data, timestampString, useAPI);
  }

  private async register(colletion: Collection, data: any, timestampString: string = null, useAPI: boolean = null) {

    if (timestampString !== null && timestampString !== undefined) {
      data = { ...data, date: timestampString, collection: colletion.collectionName }
    }

    if (useAPI) {
      data = { ...data, useAPI }
    }

    try {
      await this.mongoQueue.add(data, {
        jobId: (Math.random() + 1).toString(36).substring(1),
        priority: 1,
        delay: 0,
        removeOnComplete: true,
        removeOnFail: true,
        attempts: 3,
        backoff: {
          type: 'fixed',
          delay: 5000
        }
      });
    } catch (error) {
      this.internalErrorLog(error)
      MongodbLogError.print("Error to add on log queue: " + error);
    }
  }

  private getTimestampString(): string {
    const date = new Date()
    const timeZone = 'America/Sao_Paulo'
    const zonedDate = utcToZonedTime(date, timeZone)
    // zonedDate could be used to initialize a date picker or display the formatted local date/time

    const pattern = this.timezoneFormat
    const output = format(zonedDate, pattern, { timeZone: this.timezone })

    return output
  }

  private internalErrorLog(error: any) {
    const date = this.getTimestampString()
    const destination = pino.destination(`${this.localErrorPath}/error-log.txt`)
    const logger = pino(destination)
    try {
      logger.error({ ...error, date })
    } catch (error) {
      MongodbLogError.print("Error to write a log: " + error);
    }
  }

}