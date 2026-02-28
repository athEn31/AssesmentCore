import { useNavigate } from 'react-router';
import { Check, Star, Zap, ArrowRight } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

interface PricingTier {
  name: string;
  price: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
  action: () => void;
}

export function PricingPage() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleUpgrade = (tier: string) => {
    // TODO: Integrate with payment provider (Stripe, Razorpay, etc.)
    console.log(`Upgrading to ${tier} tier`);
    alert(`Upgrade to ${tier} tier coming soon!`);
  };

  const pricingTiers: PricingTier[] = [
    {
      name: 'Free',
      price: '$0',
      description: 'Perfect for getting started',
      features: [
        '1 QTI export per month',
        'Up to 100 questions per batch',
        'Basic validation',
        'Community support',
      ],
      cta: 'Current Plan',
      action: () => navigate('/workspace'),
    },
    {
      name: 'Professional',
      price: '$29',
      description: 'For regular users',
      features: [
        'Unlimited QTI exports',
        'Up to 1000 questions per batch',
        'Advanced validation',
        'Email support',
        'Custom templates',
        'Export history',
      ],
      highlighted: true,
      cta: 'Upgrade Now',
      action: () => handleUpgrade('Professional'),
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      description: 'For organizations',
      features: [
        'Unlimited everything',
        'Unlimited batch size',
        'Advanced analytics',
        'Priority support',
        'API access',
        'Custom integrations',
        'Dedicated account manager',
      ],
      cta: 'Contact Sales',
      action: () => window.open('mailto:sales@assessmentcore.com'),
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <header className="bg-white border-b border-[#E2E8F0] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#0F6CBD] rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-[#1F2937]">AssessmentCore</span>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <>
                <span className="text-sm text-[#64748B]">{user.email}</span>
                <Button variant="outline" onClick={handleLogout}>
                  Logout
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-[#1F2937] mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-[#64748B] mb-8">
            You've used your free QTI export quota. Choose a plan that works for you.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {pricingTiers.map((tier) => (
              <Card
                key={tier.name}
                className={`relative transition-all ${
                  tier.highlighted
                    ? 'md:scale-105 border-[#0F6CBD] shadow-2xl'
                    : 'border-[#E2E8F0]'
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-[#0F6CBD] text-white px-4 py-1 rounded-full text-sm font-semibold inline-flex items-center gap-1">
                      <Star className="w-4 h-4" />
                      Most Popular
                    </div>
                  </div>
                )}

                <CardHeader>
                  <CardTitle className="text-2xl">{tier.name}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Price */}
                  <div>
                    <div className="text-4xl font-bold text-[#1F2937]">
                      {tier.price}
                      {tier.price !== 'Custom' && (
                        <span className="text-lg font-normal text-[#64748B]">/month</span>
                      )}
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-3">
                    {tier.features.map((feature, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-[#475569]">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA Button */}
                  <Button
                    onClick={tier.action}
                    className={`w-full ${
                      tier.highlighted
                        ? 'bg-[#0F6CBD] hover:bg-[#0d4a94] text-white'
                        : 'border-[#E2E8F0] text-[#0F6CBD] hover:bg-[#F1F5F9]'
                    }`}
                    variant={tier.highlighted ? 'default' : 'outline'}
                  >
                    {tier.cta}
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-[#1F2937] mb-12 text-center">
            Frequently Asked Questions
          </h2>

          <div className="space-y-6">
            {[
              {
                q: 'Can I cancel my subscription anytime?',
                a: 'Yes, you can cancel your subscription at any time without any penalties. Your access will continue until the end of your billing cycle.',
              },
              {
                q: 'Do you offer student discounts?',
                a: 'Yes! Students and educators get 50% off all plans. Contact our support team with your educational email.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit cards, PayPal, and bank transfers for Enterprise plans.',
              },
              {
                q: 'Is there a free trial for Professional plan?',
                a: 'Yes! You get 7 days free trial on our Professional plan. No credit card required.',
              },
            ].map((item, index) => (
              <div key={index} className="border border-[#E2E8F0] rounded-lg p-6">
                <h3 className="font-semibold text-[#1F2937] mb-2">{item.q}</h3>
                <p className="text-[#64748B]">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <section className="py-8 px-4 sm:px-6 lg:px-8 border-t border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto text-center text-[#64748B]">
          <p>Need help? Contact our support team at support@assessmentcore.com</p>
        </div>
      </section>
    </div>
  );
}
