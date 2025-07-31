// Billing Service - Handle subscriptions, payments, and usage tracking

import { Subscription, PricingPlan, PaymentMethod, Invoice, UsageRecord } from '../types/billing';
import { TenantApiClient } from './TenantApiClient';

export class BillingService {
  private apiClient: TenantApiClient;

  constructor(tenantId: string) {
    this.apiClient = new TenantApiClient(tenantId);
  }

  /**
   * Create subscription after payment gate
   */
  async createSubscription(
    userId: string,
    plan: PricingPlan,
    paymentSkipped: boolean = false
  ): Promise<Subscription> {
    const subscription: Subscription = {
      id: `sub_${Date.now()}`, // Will be Stripe subscription ID
      userId,
      tenantId: this.apiClient.tenantId,
      plan: plan.id as 'free' | 'pro' | 'enterprise',
      status: paymentSkipped ? 'trialing' : (plan.price === 0 ? 'active' : 'active'),
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      amount: plan.price,
      currency: 'usd',
      interval: plan.interval,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // For development: Set trial period if payment was skipped
    if (paymentSkipped) {
      subscription.trialStart = new Date().toISOString();
      subscription.trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7-day trial
    }

    // Save subscription to database
    await this.saveSubscription(subscription);

    return subscription;
  }

  /**
   * Get current subscription for tenant
   */
  async getCurrentSubscription(): Promise<Subscription | null> {
    try {
      const response = await this.apiClient.get('/billing/subscription');
      return response.subscription || null;
    } catch (error) {
      console.error('Failed to get subscription:', error);
      return null;
    }
  }

  /**
   * Update subscription plan
   */
  async updateSubscription(newPlan: PricingPlan): Promise<Subscription> {
    const response = await this.apiClient.put('/billing/subscription', {
      planId: newPlan.id,
      stripePriceId: newPlan.stripePriceId
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to update subscription');
    }

    return response.subscription;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(cancelAtPeriodEnd: boolean = true): Promise<Subscription> {
    const response = await this.apiClient.post('/billing/subscription/cancel', {
      cancelAtPeriodEnd
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to cancel subscription');
    }

    return response.subscription;
  }

  /**
   * Record usage for billing (called by other services)
   */
  async recordUsage(
    metricType: 'recordingSessions' | 'toolsGenerated' | 'agentExecutions' | 'apiCalls',
    amount: number = 1
  ): Promise<void> {
    try {
      await this.apiClient.post('/billing/usage', {
        metricType,
        amount,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Failed to record usage:', error);
      // Don't throw - usage recording shouldn't break functionality
    }
  }

  /**
   * Get current usage for billing period
   */
  async getCurrentUsage(): Promise<UsageRecord | null> {
    try {
      const response = await this.apiClient.get('/billing/usage/current');
      return response.usage || null;
    } catch (error) {
      console.error('Failed to get usage:', error);
      return null;
    }
  }

  /**
   * Check if tenant has exceeded limits
   */
  async checkUsageLimits(): Promise<{
    withinLimits: boolean;
    limits: Record<string, number>;
    usage: Record<string, number>;
    exceeded: string[];
  }> {
    try {
      const [subscription, usage] = await Promise.all([
        this.getCurrentSubscription(),
        this.getCurrentUsage()
      ]);

      if (!subscription) {
        return {
          withinLimits: false,
          limits: {},
          usage: {},
          exceeded: ['no_subscription']
        };
      }

      const plan = this.getPlanFeatures(subscription.plan);
      const currentUsage = usage || this.getEmptyUsageRecord();

      const limits = {
        recordingSessions: plan.recordingSessions,
        toolsGenerated: plan.toolsGenerated,
        agentExecutions: plan.agentExecutions,
        apiCalls: plan.apiCalls
      };

      const usageValues = {
        recordingSessions: currentUsage.recordingSessions,
        toolsGenerated: currentUsage.toolsGenerated,
        agentExecutions: currentUsage.agentExecutions,
        apiCalls: currentUsage.apiCalls
      };

      const exceeded: string[] = [];
      
      for (const [metric, limit] of Object.entries(limits)) {
        if (limit !== -1 && usageValues[metric] >= limit) {
          exceeded.push(metric);
        }
      }

      return {
        withinLimits: exceeded.length === 0,
        limits,
        usage: usageValues,
        exceeded
      };
    } catch (error) {
      console.error('Failed to check usage limits:', error);
      return {
        withinLimits: false,
        limits: {},
        usage: {},
        exceeded: ['error']
      };
    }
  }

  /**
   * Get billing history (invoices)
   */
  async getBillingHistory(): Promise<Invoice[]> {
    try {
      const response = await this.apiClient.get('/billing/invoices');
      return response.invoices || [];
    } catch (error) {
      console.error('Failed to get billing history:', error);
      return [];
    }
  }

  /**
   * Get payment methods
   */
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    try {
      const response = await this.apiClient.get('/billing/payment-methods');
      return response.paymentMethods || [];
    } catch (error) {
      console.error('Failed to get payment methods:', error);
      return [];
    }
  }

  /**
   * Create Stripe checkout session (for plan upgrades)
   */
  async createCheckoutSession(
    planId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ checkoutUrl: string }> {
    const response = await this.apiClient.post('/billing/checkout', {
      planId,
      successUrl,
      cancelUrl
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to create checkout session');
    }

    return { checkoutUrl: response.checkoutUrl };
  }

  /**
   * Create customer portal session (for managing billing)
   */
  async createPortalSession(returnUrl: string): Promise<{ portalUrl: string }> {
    const response = await this.apiClient.post('/billing/portal', {
      returnUrl
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to create portal session');
    }

    return { portalUrl: response.portalUrl };
  }

  // Private helper methods

  private async saveSubscription(subscription: Subscription): Promise<void> {
    const response = await this.apiClient.post('/billing/subscription', subscription);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to save subscription');
    }
  }

  private getPlanFeatures(planId: string) {
    const plans = {
      free: {
        recordingSessions: 10,
        toolsGenerated: 5,
        agentExecutions: 100,
        apiCalls: 1000,
        storageLimit: 1024 * 1024 * 1024, // 1GB
        oauthIntegrations: false
      },
      pro: {
        recordingSessions: 100,
        toolsGenerated: 50,
        agentExecutions: 1000,
        apiCalls: 10000,
        storageLimit: 10 * 1024 * 1024 * 1024, // 10GB
        oauthIntegrations: true
      },
      enterprise: {
        recordingSessions: -1, // unlimited
        toolsGenerated: -1,
        agentExecutions: -1,
        apiCalls: -1,
        storageLimit: 100 * 1024 * 1024 * 1024, // 100GB
        oauthIntegrations: true
      }
    };

    return plans[planId] || plans.free;
  }

  private getEmptyUsageRecord(): UsageRecord {
    return {
      tenantId: this.apiClient.tenantId,
      period: new Date().toISOString().slice(0, 7), // YYYY-MM
      recordingSessions: 0,
      toolsGenerated: 0,
      agentExecutions: 0,
      apiCalls: 0,
      storageUsed: 0,
      createdAt: new Date().toISOString()
    };
  }
}

// Helper function to check if user can perform action
export async function checkUsageLimit(
  tenantId: string,
  action: 'recordingSessions' | 'toolsGenerated' | 'agentExecutions' | 'apiCalls'
): Promise<{ allowed: boolean; reason?: string }> {
  const billingService = new BillingService(tenantId);
  const usageCheck = await billingService.checkUsageLimits();

  if (!usageCheck.withinLimits && usageCheck.exceeded.includes(action)) {
    return {
      allowed: false,
      reason: `You've reached your ${action} limit. Upgrade your plan to continue.`
    };
  }

  return { allowed: true };
}

// Helper to record usage after successful actions
export async function recordUsageAfterAction(
  tenantId: string,
  action: 'recordingSessions' | 'toolsGenerated' | 'agentExecutions' | 'apiCalls',
  amount: number = 1
): Promise<void> {
  const billingService = new BillingService(tenantId);
  await billingService.recordUsage(action, amount);
}