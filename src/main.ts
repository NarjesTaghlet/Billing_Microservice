import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Enable CORS to allow requests from Angular frontend (or other clients)
    app.enableCors({
    origin: ['http://localhost:4200','https://d398rqqt4ze3my.cloudfront.net',    'https://d1no5jk0cuzn91.cloudfront.net','https://d2k1rrgcfjq38f.cloudfront.net'
] ,// ✅ Autoriser uniquement le frontend Angular
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization',
    credentials: true, // ✅ Si besoin d'authentification (JWT, Cookies)
  });

 //await app.listen(3004);
  // Express CORS Middleware
const corsMiddleware = (req, res, next) => {
  const allowedOrigins = [
    'https://dpfzuq7w5fb82.cloudfront.net',
        'https://d1no5jk0cuzn91.cloudfront.net',
        'https://d2k1rrgcfjq38f.cloudfront.net',

    'https://*.cloudfront.net',
    'http://localhost:3030' // For local development
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
};

// Use the middleware in all services
app.use(corsMiddleware);
 

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
