// Billing and subscription types

export interface Subscription {
  id: string;
  userId: string;
  tenantId: string;
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  
  // Stripe integration
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePaymentMethodId?: string;
  
  // Pricing
  amount: number; // in cents
  currency: 'usd';
  interval: 'month' | 'year';
  
  // Trial info
  trialEnd?: string;
  trialStart?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  price: number; // in cents
  currency: 'usd';
  interval: 'month' | 'year';
  
  // Feature limits
  features: {
    recordingSessions: number; // -1 for unlimited
    toolsGenerated: number;
    agentExecutions: number;
    apiCalls: number;
    storageLimit: number; // bytes
    oauthIntegrations: boolean;
    prioritySupport: boolean;
    customDeployment: boolean;
  };
  
  // UI display
  popular?: boolean;
  stripePriceId?: string;
}

export interface PaymentMethod {
  id: string;
  type: 'card';
  card: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  isDefault: boolean;
}

export interface Invoice {
  id: string;
  subscriptionId: string;
  amount: number;
  currency: 'usd';
  status: 'paid' | 'pending' | 'failed';
  invoiceUrl?: string;
  dueDate: string;
  createdAt: string;
}

export interface UsageRecord {
  tenantId: string;
  period: string; // YYYY-MM format
  
  // Usage metrics
  recordingSessions: number;
  toolsGenerated: number;
  agentExecutions: number;
  apiCalls: number;
  storageUsed: number;
  
  // Calculated costs (for metered billing later)
  overageCharges?: number;
  
  createdAt: string;
}