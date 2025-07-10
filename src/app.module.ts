
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
  host :configService.get<string>('DB_HOST'),
      port: configService.get<number>('DB_PORT'),
      username: configService.get<string>('DB_USERNAME'),
      password: configService.get<string>('DB_PASSWORD'),
      database: configService.get<string>('DB_NAME'),
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