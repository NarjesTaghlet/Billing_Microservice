import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Enable CORS to allow requests from Angular frontend (or other clients)
  app.enableCors({
    origin: 'http://localhost:4200',  // URL of your Angular app (adjust as needed)
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],  // Allowed methods
    allowedHeaders: ['Content-Type', 'Authorization'],  // Allowed headers
  });

 app.use(
    '/billing/webhook',
    express.raw({ type: 'application/json' }),
    (req, res, next) => {
      req.rawBody = req.body; // Ensure rawBody is set
      next();
    },
  );

  app.use(express.json());


  // Listen for HTTP requests on port 3000
  await app.listen(3001);
}
bootstrap();
