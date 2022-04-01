import { Injectable } from '@nestjs/common';
import { Job } from 'bull';
import { MongoClient, Collection, InsertOneWriteOpResult } from 'mongodb';
import { MongodbLogError } from './mongodb-log.error';
import * as Bull from 'bull';
@Injectable()
export class MongodbLogService {
  private logColletion: Collection;
  private additionalCollections: { [name: string]: Collection } = {};
  private defaultTimezone: string;
  private defaultLocaleTimezone: string;

  protected queue = new Bull('mongo-log-queue', {
    redis: {
      port: parseInt(this.redisPort),
      host: this.redisHost,
      password: '',
    },
  });

  protected listener = new Bull('mongo-log-queue', {
    redis: {
      port: parseInt(this.redisPort),
      host: this.redisHost,
      password: '',
    },
  }).process(async (job, done) => {
      this.executeQueue(job)
      done();
  });

  constructor(
    private readonly client: MongoClient,
    private readonly databaseName: string,
    private readonly logsCollectionName: string,
    private readonly redisHost: string,
    private readonly redisPort: string,
    private readonly additionalCollectionNames?: string[],
    private readonly timezone?: string,
    private readonly localeTimezone?: string,

  ) {
    const database = this.client.db(this.databaseName);
    this.logColletion = database.collection(this.logsCollectionName);
    this.additionalCollectionNames?.forEach((name) => {
      this.additionalCollections[name] = database.collection(name);
    });
    this.defaultTimezone = this.timezone
    this.defaultLocaleTimezone = this.localeTimezone
  }

  // async registerLog(log: any): Promise<InsertOneWriteOpResult<any>> {
  //   return await this.register(this.logColletion, log);
  // }

  // async registerUnstructured(log: any): Promise<InsertOneWriteOpResult<any>> {
  //   return await this.registerUnstructuredLog(this.logColletion, log);
  // }

  async registerLog(log: any, registerDate: boolean = null): Promise<InsertOneWriteOpResult<any>> {

    let timestampString: string;
    if(registerDate){
      timestampString = this.getTimestampString()
    }

    return await this.register(this.logColletion, log, timestampString);
  }

  // async registerOn(collectionName: string, data: any): Promise<InsertOneWriteOpResult<any> | undefined> {
  //   const collection = this.additionalCollections[collectionName];
  //   if (!collection) {
  //     MongodbLogError.print(`Additional collection "${collectionName}" need to be set on module config.`);
  //     return;
  //   }
  //   return await this.register(collection, data);
  // }

  // async registerUnstructuredOn(collectionName: string, data: any): Promise<InsertOneWriteOpResult<any> | undefined> {
  //   const collection = this.additionalCollections[collectionName];
  //   if (!collection) {
  //     MongodbLogError.print(`Additional collection "${collectionName}" need to be set on module config.`);
  //     return;
  //   }
  //   return await this.registerUnstructuredLog(collection, data);
  // }

  async registerOn(collectionName: string, data: any, registerDate: boolean = null): Promise<InsertOneWriteOpResult<any> | undefined> {

    let timestampString: string;

    if(registerDate){
      timestampString = this.getTimestampString()
    }

    const collection = this.additionalCollections[collectionName];
    if (!collection) {
      MongodbLogError.print(`Additional collection "${collectionName}" need to be set on module config.`);
      return;
    }
    return await this.register(collection, data, timestampString);
  }

  // private async registerUnstructuredLog(colletion: Collection, data: any): Promise<InsertOneWriteOpResult<any>> {
  //   return await colletion.insertOne({ ...data });
  // }

  // private async register(colletion: Collection, data: any): Promise<InsertOneWriteOpResult<any>> {
  //   return await colletion.insertOne({ data, date: new Date() });
  // }

  private async register(colletion: Collection, data: any, timestampString: string = null): Promise<InsertOneWriteOpResult<any>> {


    if(timestampString !== null && timestampString !== undefined){
      data = {...data, date: timestampString, collection: colletion.collectionName}
    }

    await this.queue.add("mongo-log-job", data, {
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

    return await colletion.insertOne({ ...data });
  }

  private getTimestampString(): string{

    return new Date().toLocaleString(this.defaultLocaleTimezone, { timeZone: this.defaultTimezone })

  }

  private async executeQueue(job: Job<any>) {

    const database = this.client.db(this.databaseName);
    this.logColletion = database.collection(job.data.collection);

    delete job.data.collection

    return await this.logColletion.insertOne({ ...job.data });
  }

}