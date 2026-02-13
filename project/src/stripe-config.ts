export interface StripeProduct {
  priceId: string;
  name: string;
  description: string;
  mode: 'payment' | 'subscription';
}

export const stripeProducts: StripeProduct[] = [
  {
    priceId: 'price_1Sxx4LE2lorxVqBbfAGt7tiw',
    name: 'Donation',
    description: 'Support this mission',
    mode: 'payment',
  },
];