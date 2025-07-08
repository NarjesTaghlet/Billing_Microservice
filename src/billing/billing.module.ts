import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from 'src/billing/entities/payment.entity';
import { HttpModule } from '@nestjs/axios';
import { TokenGuard } from './Guards/token-guard';
@Module({
  imports: [TypeOrmModule.forFeature([Payment]),
  HttpModule, ],
  providers: [BillingService,TokenGuard],
  controllers: [BillingController]
})
export class BillingModule {}
