/*import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from 'src/entities/payment.entity';
import { HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  async processPayment(userId: number, plan: string) {
    try {
      console.log(`🔹 Simulating payment for user ${userId} - Plan: ${plan}`);

      // Simulate a successful payment
      const paymentSuccess = true;

      // Create a new Payment record
      const payment = new Payment();
      payment.userId = userId;
      payment.amount = plan === 'premium' ? 100 : 50; // example amounts
      payment.status = paymentSuccess ? 'completed' : 'failed';
      payment.stripeSessionId = `mocked-session-id-${Math.floor(Math.random() * 10000)}`;
      payment.createdAt = new Date();

      // Save payment to the database
      const savedPayment = await this.paymentRepository.save(payment);

      if (paymentSuccess) {
        return {
          success: true,
          transactionId: savedPayment.id,
          userId,
          plan,
          message: `✅ Payment simulated and saved for user ${userId} with plan ${plan}.`,
          paymentId: savedPayment.id,
        };
      } else {
        throw new HttpException('❌ Payment simulation failed', HttpStatus.PAYMENT_REQUIRED);
      }

    } catch (error) {
      console.error('❌ Error in payment simulation:', error);
      throw new HttpException('Failed to process payment', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
*/
// billing.service.ts
// billing.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Payment } from './entities/payment.entity';
import { CostExplorerClient, GetCostAndUsageCommand } from '@aws-sdk/client-cost-explorer';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv' ;
dotenv.config();

interface Subscription {
  userId: number;
  plan: string;
  status: string;
}

@Injectable()
export class BillingService {
    private readonly stripe: Stripe;

  private readonly costExplorerClient = new CostExplorerClient({ region: 'us-east-1' });

  

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    private httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    const stripeSecret = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.stripe = new Stripe(stripeSecret, {
      apiVersion: '2025-05-28.basil',
    });
  
  }


      async fetchTempCredentials(userId: number) {
  try {
    // Utilise une variable d'environnement pour l'URL du user-service
    const userServiceUrl = this.configService.get<string>('USER_SERVICE_URL', 'http://localhost:3030');

    const { data } = await firstValueFrom(
      this.httpService.post(`${userServiceUrl}/user/${userId}/connect-aws`, {})
    );
    console.log(`Fetched AWS credentials for user ${userId}`);
    return data;
  } catch (error) {
    console.error(`Error fetching AWS credentials for user ${userId}: ${error.message}`);
    throw error;
  }
}
  async checkCostOverPlan(userId: number, plan: string): Promise<{ over: boolean; totalCost: number; limit: number }> {
  const awsCost = await this.getAwsCost(userId); // ← renvoie en dollars
  let limit = 0;

  switch (plan) {
    case 'medium':
      limit = 100;
      break;
    case 'small':
    default:
      limit = 50;
      break;
  }

  const over = awsCost.totalAmount > limit;

  return {
    over,
    totalCost: parseFloat(awsCost.totalAmount.toFixed(2)),
    limit,
  };
}




  async createCheckoutSession(userId: number, plan: string, email: string, successUrl: string, cancelUrl: string) {
    try {
      console.log(`🔹 Creating Checkout Session for user ${userId} - Plan: ${plan}`);

      // Validate inputs
      if (!userId || !plan || !email) {
        throw new HttpException('Missing required fields: userId, plan, or email', HttpStatus.BAD_REQUEST);
      }

      // Validate plan
      const normalizedPlan = plan.toLowerCase();
      if (!['small', 'medium'].includes(normalizedPlan)) {
        throw new HttpException(`Invalid plan: ${plan}`, HttpStatus.BAD_REQUEST);
      }

      const planAmount = normalizedPlan === 'medium' ? 50000 : 8000; // $500 or $80 in cents
      console.log(`🔹 Plan amount: $${planAmount / 100}`);

        // Get AWS sub-account ID
    /*  let subAccountId: string;
      try {
        subAccountId = await this.getAwsSubAccountId(userId);
        console.log(`🔹 AWS sub-account ID: ${subAccountId}`);
      } catch (error) {
        console.error(`❌ Failed to get AWS sub-account ID: ${error.message}`);
        throw new HttpException(`Failed to retrieve AWS sub-account: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    */



   
      // Create Checkout Session
      let session: Stripe.Checkout.Session;
      try {
        session = await this.stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          customer_email: email,
          line_items: [{
            price_data: {
              currency: 'usd',
              product_data: { name: normalizedPlan.charAt(0).toUpperCase() + normalizedPlan.slice(1) + ' Plan' },
              unit_amount: planAmount,
            },
            quantity: 1,
          }],
          mode: 'payment', // Change to 'subscription' for recurring plans
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: { userId: userId.toString(), plan: normalizedPlan,/* subAccountId*/ },
        });
        console.log(`🔹 Checkout Session created: ${session.id}`);
      } catch (error) {
        console.error(`❌ Stripe API error: ${error.message}`);
        throw new HttpException(`Failed to create Stripe Checkout Session: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      // Save payment record
      try {
        const payment = new Payment();
        payment.userId = userId;
        payment.amount = planAmount / 100; // In dollars
        payment.status = 'pending';
        payment.stripeSessionId = session.id;
        payment.createdAt = new Date();
        const savedPayment = await this.paymentRepository.save(payment);
        console.log(`🔹 Payment record saved: ID ${savedPayment.id}`);
      } catch (error) {
        console.error(`❌ Failed to save payment record: ${error.message}`);
        throw new HttpException(`Failed to save payment record: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return { sessionId: session.id };
    } catch (error) {
      console.error(`❌ Error in createCheckoutSession: ${error.message}`);
      throw new HttpException(
        `Failed to create Checkout Session: ${error.message}`,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }


  async processPayment(userId: number, plan: string, paymentMethodId: string , email : string) {
    try {
      console.log(`🔹 Processing payment for user ${userId} - Plan: ${plan}`);

      // Validate plan
      if (!['small', 'medium'].includes(plan.toLowerCase())) {
        throw new HttpException('Invalid plan', HttpStatus.BAD_REQUEST);
      }

      console.log(plan)
      // Fetch or create subscription = > correct 
      const planAmount = plan === 'medium' ? 100 : 50; // $100 or $50 in cents
      const subAccountId = await this.getAwsSubAccountId(userId);

      console.log(subAccountId)

     let  subscription = await this.updateSubscriptionInUserService(userId, plan);
      console.log("bonjour")
      console.log("hi ",subscription)
      // Get AWS costs
     // const awsCost = await this.getAwsCost(userId);
      const totalAmount = planAmount //+ awsCost;

      // Get Stripe sub-account

      // Create Stripe Payment Intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: totalAmount,
        currency: 'usd',
        payment_method: paymentMethodId,
        customer: await this.getOrCreateCustomer(userId,email),
        confirm: true,
        confirmation_method: 'manual',
   /*     automatic_payment_methods: {
        enabled: true,
      },*/
    //    application_fee_amount: Math.round(totalAmount * 0.1), // 10% platform fee
      });

      // Save payment
      const payment = new Payment();
      payment.userId = userId;
      payment.amount = totalAmount / 100; // In dollars
      payment.status = paymentIntent.status === 'succeeded' ? 'completed' : 'failed';
      payment.stripeSessionId = paymentIntent.id;
      payment.createdAt = new Date();
      const savedPayment = await this.paymentRepository.save(payment);

      if (paymentIntent.status === 'succeeded') {
        // save subscription in the user table !! the user has a subscription

        return {
          success: true,
          transactionId: savedPayment.id,
          userId,
          plan,
          message: `✅ Payment processed for user ${userId} with plan ${plan} and AWS costs.`,
          paymentId: savedPayment.id,
        };
      } else {
        throw new HttpException('❌ Payment failed', HttpStatus.PAYMENT_REQUIRED);
      }
    } catch (error) {
      console.error('❌ Error in payment processing:', error.message);
      throw new HttpException(`Failed to process payment: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }



  
  private async getOrCreateCustomer(userId: number , email:string): Promise<string> {
    const customer = await this.stripe.customers.create({
      metadata: { userId: userId.toString() },
      email: email, // Replace with real email
    });
    return customer.id;
  }





   async updateSubscriptionInUserService(userId: number, plan: string): Promise<Subscription> {

        const userServiceUrl = this.configService.get<string>('USER_SERVICE_URL', 'http://localhost:3030');


    const response = await firstValueFrom(
      this.httpService.put(`${userServiceUrl}/user/${userId}/subscription`, {
        plan,
        status: 'active',
      }),
    );
    return response.data;
  }




  async getAwsCost(userId: number): Promise<{
  totalAmount: number; // in USD
  currency: string;
  startDate: string;
  endDate: string;
  servicesBreakdown: { service: string; amount: number }[];
}> {
  const subAccountId = await this.getAwsSubAccountId(userId);

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const endDate = now.toISOString().slice(0, 10);

  try {
    const params = new GetCostAndUsageCommand({
      TimePeriod: { Start: startDate, End: endDate },
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
      Filter: {
        Dimensions: {
          Key: 'LINKED_ACCOUNT',
          Values: [subAccountId],
        },
      },
      GroupBy: [
        {
          Type: 'DIMENSION',
          Key: 'SERVICE',
        },
      ],
    });

    const result = await this.costExplorerClient.send(params);
    const timePeriod = result.ResultsByTime?.[0];
    const breakdown: { service: string; amount: number }[] = [];

    let total = 0;

    if (timePeriod?.Groups) {
      for (const group of timePeriod.Groups) {
        const serviceName = group.Keys?.[0] ?? 'Unknown';
        const amount = parseFloat(group.Metrics?.UnblendedCost?.Amount || '0');
        total += amount;
        breakdown.push({ service: serviceName, amount: parseFloat(amount.toFixed(2)) });
      }
    }

    return {
      totalAmount: parseFloat(total.toFixed(2)),
      currency: 'USD',
      startDate,
      endDate,
      servicesBreakdown: breakdown,
    };
  } catch (err) {
    console.error(`Error fetching AWS cost for user ${userId}: ${err.message}`);
    return {
      totalAmount: 0,
      currency: 'USD',
      startDate,
      endDate,
      servicesBreakdown: [],
    };
  }
}



async getDetailedAwsCosts(userId: number, accountId: string): Promise<any[]> {
  const client = new CostExplorerClient({ region: 'us-east-1' });

  const start = new Date();
  start.setDate(1); // first day of current month
  const startDate = start.toISOString().split('T')[0];
  const endDate = new Date().toISOString().split('T')[0]; // today

  const command = new GetCostAndUsageCommand({
    TimePeriod: { Start: startDate, End: endDate },
    Granularity: 'MONTHLY',
    Metrics: ['UnblendedCost'],
    GroupBy: [
      { Type: 'DIMENSION', Key: 'SERVICE' },
    ],
    Filter: {
      Dimensions: {
        Key: 'LINKED_ACCOUNT',
        Values: [accountId],
      },
    },
  });

  try {
    const result = await client.send(command);
    const services = result.ResultsByTime?.[0]?.Groups || [];

    return services.map(group => ({
      service: group.Keys?.[0],
      cost: parseFloat(group.Metrics?.UnblendedCost?.Amount || '0').toFixed(2),
      unit: group.Metrics?.UnblendedCost?.Unit || 'USD'
    }));
  } catch (err) {
    console.error(`❌ Error fetching detailed AWS costs:`, err.message);
    return [];
  }
}




  async getAwsSubAccountId(userId: number): Promise<string> {
     // 1. Get temporary credentials from user service
        const data = await this.fetchTempCredentials(userId);

         const { accessKeyId, secretAccessKey, sessionToken } = data;
    console.log("sub account aws id ",data?.accountId)
    return data?.accountId || '123456789012'; // Replace with actual logic
  }

  async getUserBalance(userId: number,plan:string): Promise<number> {
    // soum l plan + l cost taaa l user
    //const subscription = await this.getSubscriptionFromUserService(userId);
    const subscriptionAmount = plan ? (plan === 'medium' ? 100 : 50) : 0;
    const awsCost = await this.getAwsCost(userId);
    return subscriptionAmount + awsCost.totalAmount; // In cents
  }
}
