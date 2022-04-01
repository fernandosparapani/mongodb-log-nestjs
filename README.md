# mongodb-queue-log-nestjs

## Description
This package is fork of <b>mongodb-log-nestjs</b> with additional methods to register raw data from the Redis queue

## Instalation
```npm i --save mongodb-queue-log-nestjs```

## Quick Start

<ol>

  **Important**
  <br>
  By default, the Redis configuration is set to localhost:6379, use MongodbLogService constructor to modify if necessary

  <li>Import <b>MongodbLogModule</b> and use <b>forRoot</b> or <b>forRootAsync</b> static methods on your <b>AppModule</b> for initial configuration <i>(see parameters for configuration on <b>MongodbLogConfig</b> and <b>MongodbLogConfigAsync</b> files)</i>. </li>
  <br>
  <li>Import <b>MongodbLogService</b> on your service or controller and use <b>registerLog</b> method to register log on default log collection, or use <b>registerOn</b> to register log on additional collection defined on MongodbLogModule static method configuration.</li>
</ol>

## Example

```node
import { Injectable } from '@nestjs/common';
import { MongodbLogService } from 'mongodb-queue-log-nestjs';

@Injectable()
export class Logger {

    constructor(private mongoService: MongodbLogService) {}

    private registerLog(collection, log) {
        return this.mongoService.registerOn(collection, log, true);
    }

    async log(data: any, collection = 'other_collection'): Promise<any> {
        return await this.registerLog(collection, data)
    }

}
```