import { Injectable } from '@nestjs/common';
import { envs } from 'src/config';
import Stripe from 'stripe';
import { PaymentSessionDto } from './dto/payment-session.dto';
import { Request, Response } from 'express';

@Injectable()
export class PaymentsService {
  private readonly stripe = new Stripe(envs.stripeSecret);

  async createPaymentSession(paymentSessionDto: PaymentSessionDto) {
    const { currency, items, orderId } = paymentSessionDto;
    const lineItems = items.map((items) => {
      return {
        price_data: {
          currency,
          product_data: {
            name: items.name,
          },
          unit_amount: Math.round(items.price * 100),
        },
        quantity: items.quantity,
      };
    });
    const session = await this.stripe.checkout.sessions.create({
      // Colocar aqui el id de la order
      payment_intent_data: {
        metadata: {
          orderId: orderId,
        },
      },
      line_items: lineItems,
      mode: 'payment',
      success_url: envs.stripeSuccessUrl,
      cancel_url: envs.stripeCancellUrl,
    });

    return session;
  }

  async stripeWebhook(req: Request, res: Response) {
    const sig = req.headers['stripe-signature'];

    let event: Stripe.Event;

    //Testing
    // const endpointSecret =
    //   'whsec_325ced071f4e8c6992b02c3c3d2a78dc0e51ecae14ab8e9d4eb7380c60c0c7db';

    const endpointSecret = envs.stripeEndpointSecret;
    try {
      event = this.stripe.webhooks.constructEvent(
        req['rawBody'],
        sig,
        endpointSecret,
      );
    } catch (err) {
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }
    switch (event.type) {
      case 'charge.succeeded':
        const chargeSucceded = event.data.object;
        // TODO:
        console.log({
          metadata: chargeSucceded.metadata,
          orderId: chargeSucceded.metadata.orderId,
        });
        break;

      default:
        console.log('Event type not handled');
    }

    return res.status(200).json({ sig });
  }
}
