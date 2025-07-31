// Payment Gate Component - User must select plan before tenant creation

import React, { useState } from 'react';
import { PricingPlan } from '../types/billing';

interface PaymentGateProps {
  onPlanSelected: (plan: PricingPlan, paymentSkipped?: boolean) => void;
  onSkipPayment?: () => void; // MVP: Skip button for development
}

export function PaymentGate({ onPlanSelected, onSkipPayment }: PaymentGateProps) {
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null);
  const [processing, setProcessing] = useState(false);

  // MVP: Hardcoded pricing plans
  const pricingPlans: PricingPlan[] = [
    {
      id: 'free',
      name: 'Free',
      description: 'Perfect for trying out browser automation',
      price: 0,
      currency: 'usd',
      interval: 'month',
      features: {
        recordingSessions: 10,
        toolsGenerated: 5,
        agentExecutions: 100,
        apiCalls: 1000,
        storageLimit: 1024 * 1024 * 1024, // 1GB
        oauthIntegrations: false,
        prioritySupport: false,
        customDeployment: false
      }
    },
    {
      id: 'pro',
      name: 'Pro',
      description: 'For serious automation workflows',
      price: 2900, // $29/month
      currency: 'usd',
      interval: 'month',
      popular: true,
      features: {
        recordingSessions: 100,
        toolsGenerated: 50,
        agentExecutions: 1000,
        apiCalls: 10000,
        storageLimit: 10 * 1024 * 1024 * 1024, // 10GB
        oauthIntegrations: true,
        prioritySupport: true,
        customDeployment: false
      },
      stripePriceId: 'price_pro_monthly' // Will be real Stripe price ID
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'Custom deployment and unlimited usage',
      price: 9900, // $99/month
      currency: 'usd',
      interval: 'month',
      features: {
        recordingSessions: -1, // unlimited
        toolsGenerated: -1,
        agentExecutions: -1,
        apiCalls: -1,
        storageLimit: 100 * 1024 * 1024 * 1024, // 100GB
        oauthIntegrations: true,
        prioritySupport: true,
        customDeployment: true
      },
      stripePriceId: 'price_enterprise_monthly'
    }
  ];

  const formatPrice = (price: number) => {
    if (price === 0) return 'Free';
    return `$${(price / 100).toFixed(0)}`;
  };

  const formatFeature = (value: number | boolean, unit?: string) => {
    if (typeof value === 'boolean') return value ? '✅' : '❌';
    if (value === -1) return 'Unlimited';
    if (unit === 'bytes') {
      const gb = value / (1024 * 1024 * 1024);
      return `${gb}GB`;
    }
    return value.toLocaleString();
  };

  const handlePlanSelect = (plan: PricingPlan) => {
    setSelectedPlan(plan);
    
    if (plan.price === 0) {
      // Free plan - no payment needed
      onPlanSelected(plan);
    }
  };

  const handlePayment = async () => {
    if (!selectedPlan) return;
    
    setProcessing(true);
    
    try {
      // TODO: Integrate with Stripe
      // For now, simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      onPlanSelected(selectedPlan);
    } catch (error) {
      console.error('Payment failed:', error);
      setProcessing(false);
    }
  };

  const handleSkipPayment = () => {
    if (selectedPlan) {
      onPlanSelected(selectedPlan, true);
    } else if (onSkipPayment) {
      onSkipPayment();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-6xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Choose Your Automation Plan
          </h1>
          <p className="text-xl text-gray-300">
            Get your personal browser automation workspace at{' '}
            <span className="text-cyan-400">username.mymcp.me</span>
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {pricingPlans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white/10 backdrop-blur-lg rounded-2xl p-8 border transition-all duration-300 cursor-pointer ${
                selectedPlan?.id === plan.id
                  ? 'border-cyan-400 bg-white/20 scale-105'
                  : 'border-white/20 hover:border-white/40 hover:bg-white/15'
              } ${plan.popular ? 'ring-2 ring-cyan-400' : ''}`}
              onClick={() => handlePlanSelect(plan)}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-cyan-400 to-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-gray-300 mb-4">{plan.description}</p>
                <div className="text-4xl font-bold text-white">
                  {formatPrice(plan.price)}
                  {plan.price > 0 && <span className="text-lg text-gray-300">/month</span>}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Recording Sessions</span>
                  <span className="text-white font-medium">
                    {formatFeature(plan.features.recordingSessions)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Tools Generated</span>
                  <span className="text-white font-medium">
                    {formatFeature(plan.features.toolsGenerated)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Agent Executions</span>
                  <span className="text-white font-medium">
                    {formatFeature(plan.features.agentExecutions)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Storage</span>
                  <span className="text-white font-medium">
                    {formatFeature(plan.features.storageLimit, 'bytes')}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">OAuth Integrations</span>
                  <span className="text-white font-medium">
                    {formatFeature(plan.features.oauthIntegrations)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Priority Support</span>
                  <span className="text-white font-medium">
                    {formatFeature(plan.features.prioritySupport)}
                  </span>
                </div>
              </div>

              {selectedPlan?.id === plan.id && (
                <div className="mt-6 p-3 bg-cyan-400/20 rounded-lg border border-cyan-400/30">
                  <p className="text-cyan-300 text-sm text-center font-medium">
                    ✅ Selected Plan
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="text-center space-y-4">
          {selectedPlan && selectedPlan.price > 0 && (
            <button
              onClick={handlePayment}
              disabled={processing}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <>
                  <span className="animate-spin inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                  Processing Payment...
                </>
              ) : (
                <>
                  🚀 Create {selectedPlan.name} Workspace - {formatPrice(selectedPlan.price)}/month
                </>
              )}
            </button>
          )}

          {selectedPlan && selectedPlan.price === 0 && (
            <button
              onClick={() => onPlanSelected(selectedPlan)}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300"
            >
              🎉 Create Free Workspace
            </button>
          )}

          {/* MVP: Skip payment button for development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-8 p-4 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
              <p className="text-yellow-300 text-sm mb-3">
                🚧 Development Mode: Skip payment for testing
              </p>
              <button
                onClick={handleSkipPayment}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-6 rounded-lg transition-all duration-300"
              >
                Skip Payment (Dev Only)
              </button>
            </div>
          )}
        </div>

        {/* Trust Indicators */}
        <div className="mt-12 text-center">
          <p className="text-gray-400 text-sm mb-4">
            🔒 Secure payment processing • 30-day money-back guarantee • Cancel anytime
          </p>
          <div className="flex justify-center items-center space-x-6 opacity-60">
            <span className="text-2xl">💳</span>
            <span className="text-sm text-gray-400">Stripe</span>
            <span className="text-2xl">🔐</span>
            <span className="text-sm text-gray-400">256-bit SSL</span>
            <span className="text-2xl">🛡️</span>
            <span className="text-sm text-gray-400">PCI Compliant</span>
          </div>
        </div>
      </div>
    </div>
  );
}