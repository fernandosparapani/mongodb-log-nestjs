import { MongoClient, Collection } from 'mongodb';
import { MongodbLogError } from './mongodb-log.error';
import * as Queue from 'bull';
import axios from 'axios';

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
    private readonly localeTimezone: string,
    private readonly additionalCollectionNames?: string[],
    private readonly apiLoggerEndpoint?: string,
    private readonly apiHeaders?: string
  ) {
    const database = this.client.db(this.databaseName);
    this.logColletion = database.collection(this.logsCollectionName);
    this.additionalCollectionNames?.forEach((name) => {
      this.additionalCollections[name] = database.collection(name);
    });
    this.mongoQueue = new Queue('mongo-queue-nestjs', 'redis://' + this.redisHost + ':' + this.redisPort);
    this.queueListener();
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
            await axios.post(this.apiLoggerEndpoint, data, { headers: { apiHeaders }});
          } catch (error) {
            MongodbLogError.print("error when call API " + this.apiLoggerEndpoint + error);
          }

        } else {
          await logColletion.insertOne({ ...data });
        }

      } catch (error) {
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
      MongodbLogError.print(`Additional collection "${collectionName}" need to be set on module config.`);
      return;
    }

    await this.register(collection, data, timestampString, useAPI);
  }

  private async register(colletion: Collection, data: any, timestampString: string = null, useAPI: boolean = null) {

    if (timestampString !== null && timestampString !== undefined) {
      data = { ...data, date: timestampString, collection: colletion.collectionName }
    }

    if(useAPI){
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
      MongodbLogError.print("Error to add on log queue: " + error);
    }
  }

  private getTimestampString(): string {
    return new Date().toLocaleString(this.localeTimezone, { timeZone: this.timezone })
  }

}