
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

import * as dotenv from 'dotenv';
import { BillingModule } from './billing/billing.module';
import { Payment } from './billing/entities/payment.entity';
dotenv.config();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env', // Change à '.env' si à la racine, ou garde 'src/.env' si dans src/
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        console.log('SECRET_KEY in TypeOrm config:', process.env.SECRET_KEY); // Debug
        return {
          type: 'mysql',
    //host: 'localhost',
    host : process.env.DB_HOST,
    port: 3307,
    username: 'root',
    password: '',
    database: 'billing',
    entities: [Payment],
    synchronize: true,  //
        };
      },
      inject: [ConfigService],
    }),
    BillingModule // Contient JwtStrategy et toute la logique user
  ],
  controllers: [AppController],
  providers: [AppService], // Retire JwtStrategy d'ici
})
export class AppModule {
  constructor(configService: ConfigService) {
    console.log('SECRET_KEY in AppModule:', process.env.SECRET_KEY); // Debug
  }
}