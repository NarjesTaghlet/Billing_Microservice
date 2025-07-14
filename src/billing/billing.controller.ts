// billing.controller.ts
/*import { Controller, Post, Body, Request ,Get ,Param} from '@nestjs/common';
import { Query } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs'; // Fix TS2304
import { Payment } from './entities/payment.entity';
import { BillingService } from './billing.service';
import Stripe from 'stripe'; // Fix TS2503
import { TokenGuard } from './Guards/token-guard';
import { HttpException, HttpStatus } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { Res } from '@nestjs/common';
dotenv.config();

interface Subscription {
  userId: number;
  plan: string;
  status: string;
}

@Controller('billing')
export class BillingController {
  private readonly stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-05-28.basil' }); // Fix TS2339
  private readonly webhookSecret = process.env.STRIPE_WEBHOOK_SECRET; // Fix TS2339

  constructor(
    private readonly billingService: BillingService,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>, // Fix TS2339
    private readonly httpService: HttpService, // Fix TS2339
  ) {}

  @UseGuards(TokenGuard)
  @Post('create-checkout-session')
  async createCheckoutSession(
    @Request() req,
    @Body() body: { plan: string; email: string; successUrl: string; cancelUrl: string },
  ) {
    const userId = req.user.userId;
    console.log(userId)
    return this.billingService.createCheckoutSession(userId, body.plan, body.email, body.successUrl, body.cancelUrl);
  }

  @UseGuards(TokenGuard)
  @Get('session/:sessionId')
  async getSession(@Param('sessionId') sessionId: string) {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    return { status: session.payment_status === 'paid' ? 'completed' : 'pending' };
  }

  @UseGuards(TokenGuard)
    @Get('cost')
  async getBillingForUser(@Request() req ): Promise<{ costInUSD: number }> {
    const userId = req.user.userId ; 
    const cost = await this.billingService.getAwsCost(parseInt(userId, 10));
    return { costInUSD: cost.totalAmount };
  }

   // Ex: GET /billing?userId=19&plan=medium
     @UseGuards(TokenGuard)

  @Get('balance')
  async getUserBalance(
    @Query('plan') plan: string,@Request() req
  ): Promise<{ totalBalance: number }> {
        const userId = req.user.userId ; 

    const total = await this.billingService.getUserBalance(parseInt(userId, 10), plan);
    return { totalBalance: total }; // in cents (ex: 200 = 2.00 USD)
  }


//for admin   
@UseGuards(TokenGuard)
  @Get('details')
async getCostBreakdown(@Request() req) : Promise<any> {
  const userId = req.user.userId ; 
  const accountId = await this.billingService.getAwsSubAccountId(+userId);
  console.log(accountId)
  return await this.billingService.getDetailedAwsCosts(+userId, accountId);
}

@Post("alert")
@UseGuards(TokenGuard)
async checkAlert(@Request () req , @Body() body : any ): Promise<{ alert: boolean; message?: string }> {
  const userId = req.user.userId;
  const plan = body.plan

  const result = await this.billingService.checkCostOverPlan(userId, plan);

  if (result.over) {
    return {
      alert: true,
      message: `💸 Vous avez dépassé votre quota mensuel de ${result.limit}$. Consommation actuelle : ${result.totalCost}$.`,
    };
  }

  return { alert: false };
}




  



//  @UseGuards(TokenGuard)
  @Post('webhook')
  async handleWebhook(@Request() req: any) {
   console.log('🔹 Webhook endpoint hit');
    const signature = req.headers['stripe-signature'];
    const rawBody = req.rawBody as Buffer;


    console.log(`🔹 Raw body length: ${rawBody?.length || 0}`);
    console.log(`🔹 Signature: ${signature || 'none'}`);
    console.log(`🔹 Headers: ${JSON.stringify(req.headers)}`);

    if (!rawBody) {
      console.error('❌ No raw body provided in webhook request');
      throw new HttpException('No webhook payload was provided', HttpStatus.BAD_REQUEST);
    }

    try {
      const event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
      console.log(`🔹 Webhook event received: ${event.type}`);

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session; // Fix TS2503
        const userId = parseInt(session.metadata.userId);
        const plan = session.metadata.plan;
        const email = session.customer_email || '';

        // Update payment status
        const payment = await this.paymentRepository.findOne({ where: { stripeSessionId: session.id } }); // Fix TS2339
        if (payment) {
          payment.status = 'completed';
          payment.amount = session.amount_total / 100;
          await this.paymentRepository.save(payment); // Fix TS2339
          console.log(`🔹 Payment ${payment.id} marked as completed`);
        } else {
          console.warn(`⚠️ Payment record not found for session: ${session.id}`);
        }

        // Save subscription
        const subscription = await this.billingService.updateSubscriptionInUserService(userId, plan); // Fix TS2341
        console.log(`🔹 Subscription saved for user ${userId}, plan: ${plan}`,subscription);

      }

      return { received: true };
    } catch (error) {
      console.error(`❌ Webhook error: ${error.message}`);
      throw new HttpException(`Webhook failed: ${error.message}`, HttpStatus.BAD_REQUEST);
    }
  }
}
  */
import { Buffer } from 'buffer/';  // Ajoutez un slash à la fin

import {
  Controller,
  Post,
  Body,
  Request,
  Get,
  Param,
  Query,
  UseGuards,
  Inject,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config'; // 👈 Import ConfigService
import { firstValueFrom } from 'rxjs';
import { Payment } from './entities/payment.entity';
import { BillingService } from './billing.service';
import Stripe from 'stripe';
import { TokenGuard } from './Guards/token-guard';
import { Res } from '@nestjs/common';

interface Subscription {
  userId: number;
  plan: string;
  status: string;
}



@Controller('billing')
export class BillingController {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(
    private readonly billingService: BillingService,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService, // 👈 Injected here
  ) {
    const stripeSecret = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    this.stripe = new Stripe(stripeSecret, {
      apiVersion: '2025-05-28.basil',
    });
  }

  @UseGuards(TokenGuard)
  @Post('create-checkout-session')
  async createCheckoutSession(
    @Request() req,
    @Body() body: { plan: string; email: string; successUrl: string; cancelUrl: string },
  ) {
    const userId = req.user.userId;
    console.log(userId);
    return this.billingService.createCheckoutSession(userId, body.plan, body.email, body.successUrl, body.cancelUrl);
  }

  @UseGuards(TokenGuard)
  @Get('session/:sessionId')
  async getSession(@Param('sessionId') sessionId: string) {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    return { status: session.payment_status === 'paid' ? 'completed' : 'pending' };
  }

  @UseGuards(TokenGuard)
  @Get('cost')
  async getBillingForUser(@Request() req): Promise<{ costInUSD: number }> {
    const userId = req.user.userId;
    const cost = await this.billingService.getAwsCost(parseInt(userId, 10));
    return { costInUSD: cost.totalAmount };
  }

  @UseGuards(TokenGuard)
  @Get('balance')
  async getUserBalance(@Query('plan') plan: string, @Request() req): Promise<{ totalBalance: number }> {
    const userId = req.user.userId;
    const total = await this.billingService.getUserBalance(parseInt(userId, 10), plan);
    return { totalBalance: total };
  }

  @UseGuards(TokenGuard)
  @Get('details')
  async getCostBreakdown(@Request() req): Promise<any> {
    const userId = req.user.userId;
    const accountId = await this.billingService.getAwsSubAccountId(+userId);
    console.log(accountId);
    return await this.billingService.getDetailedAwsCosts(+userId, accountId);
  }

  @Post('alert')
  @UseGuards(TokenGuard)
  async checkAlert(@Request() req, @Body() body: any): Promise<{ alert: boolean; message?: string }> {
    const userId = req.user.userId;
    const plan = body.plan;

    const result = await this.billingService.checkCostOverPlan(userId, plan);

    if (result.over) {
      return {
        alert: true,
        message: `💸 Vous avez dépassé votre quota mensuel de ${result.limit}$. Consommation actuelle : ${result.totalCost}$.`,
      };
    }

    return { alert: false };
  }

  // Webhook Stripe
  @Post('webhook')
  async handleWebhook(@Request() req: any) {
    console.log('🔹 Webhook endpoint hit');
    const signature = req.headers['stripe-signature'];
    const rawBody = req.rawBody as Buffer;

    console.log(`🔹 Raw body length: ${rawBody?.length || 0}`);
    console.log(`🔹 Signature: ${signature || 'none'}`);
    console.log(`🔹 Headers: ${JSON.stringify(req.headers)}`);

    if (!rawBody) {
      console.error('❌ No raw body provided in webhook request');
      throw new HttpException('No webhook payload was provided', HttpStatus.BAD_REQUEST);
    }

    try {
      const event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
      console.log(`🔹 Webhook event received: ${event.type}`);

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = parseInt(session.metadata.userId);
        const plan = session.metadata.plan;
        const email = session.customer_email || '';

        const payment = await this.paymentRepository.findOne({ where: { stripeSessionId: session.id } });
        if (payment) {
          payment.status = 'completed';
          payment.amount = session.amount_total / 100;
          await this.paymentRepository.save(payment);
          console.log(`🔹 Payment ${payment.id} marked as completed`);
        } else {
          console.warn(`⚠️ Payment record not found for session: ${session.id}`);
        }

        const subscription = await this.billingService.updateSubscriptionInUserService(userId, plan);
        console.log(`🔹 Subscription saved for user ${userId}, plan: ${plan}`, subscription);
      }

      return { received: true };
    } catch (error) {
      console.error(`❌ Webhook error: ${error.message}`);
      throw new HttpException(`Webhook failed: ${error.message}`, HttpStatus.BAD_REQUEST);
    }
  }
}

