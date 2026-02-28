import { useState } from "react";
import { Link } from "react-router";
import { 
  Menu, 
  X, 
  Zap, 
  FileJson, 
  RefreshCw, 
  CheckCircle2,
  Mail,
  MapPin,
  Phone,
  ArrowRight,
  FileCode,
  Layers,
  Clock
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";

export function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-[#1F2937] border-b border-[#334155] z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#0F6CBD] rounded-lg flex items-center justify-center">
                <FileCode className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold text-white">
                AssessmentCore
              </span>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#home" className="text-[#E2E8F0] hover:text-[#0F6CBD] transition-colors">Home</a>
              <a href="#about" className="text-[#E2E8F0] hover:text-[#0F6CBD] transition-colors">About</a>
              <a href="#services" className="text-[#E2E8F0] hover:text-[#0F6CBD] transition-colors">Services</a>
              <a href="#pricing" className="text-[#E2E8F0] hover:text-[#0F6CBD] transition-colors">Pricing</a>
              <a href="#contact" className="text-[#E2E8F0] hover:text-[#0F6CBD] transition-colors">Contact</a>
              <Link to="/workspace">
                <Button className="bg-[#0F6CBD] hover:bg-[#0B5A9A] active:bg-[#094A7F] text-white rounded-md">
                  Go to Workspace
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#334155] bg-[#1F2937]">
            <div className="px-4 py-4 space-y-3">
              <a href="#home" className="block text-[#E2E8F0] hover:text-[#0F6CBD] transition-colors py-2">Home</a>
              <a href="#about" className="block text-[#E2E8F0] hover:text-[#0F6CBD] transition-colors py-2">About</a>
              <a href="#services" className="block text-[#E2E8F0] hover:text-[#0F6CBD] transition-colors py-2">Services</a>
              <a href="#pricing" className="block text-[#E2E8F0] hover:text-[#0F6CBD] transition-colors py-2">Pricing</a>
              <a href="#contact" className="block text-[#E2E8F0] hover:text-[#0F6CBD] transition-colors py-2">Contact</a>
              <Link to="/workspace" className="block">
                <Button className="w-full bg-[#0F6CBD] hover:bg-[#0B5A9A] active:bg-[#094A7F] text-white rounded-md">
                  Go to Workspace
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section id="home" className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-5xl sm:text-6xl font-bold text-[#111827] mb-6">
              Transform Questions into{" "}
              <span className="text-[#0F6CBD]">
                QTI & JSON
              </span>
            </h1>
            <p className="text-xl text-[#475569] mb-8">
              Empower your EdTech platform with seamless batch conversion of assessment questions 
              into QTI and JSON formats. Built for small EdTech platforms that need speed and reliability.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/workspace">
                <Button size="lg" className="bg-[#0F6CBD] hover:bg-[#0B5A9A] active:bg-[#094A7F] text-white rounded-md">
                  Get Started Free
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <a href="#pricing">
                <Button size="lg" variant="outline" className="border border-[#334155] text-[#1F2937] hover:bg-[#F1F5F9] rounded-md">
                  View Pricing
                </Button>
              </a>
            </div>
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20">
            <Card className="border border-[#E2E8F0] hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-[#F1F5F9] rounded-lg flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-[#0F6CBD]" />
                </div>
                <CardTitle>Lightning Fast</CardTitle>
                <CardDescription>
                  Process thousands of questions in minutes, not hours
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border border-[#E2E8F0] hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-[#F1F5F9] rounded-lg flex items-center justify-center mb-4">
                  <FileJson className="w-6 h-6 text-[#0F6CBD]" />
                </div>
                <CardTitle>Multiple Formats</CardTitle>
                <CardDescription>
                  Export to QTI, JSON, or custom formats tailored to your needs
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border border-[#E2E8F0] hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-[#F1F5F9] rounded-lg flex items-center justify-center mb-4">
                  <RefreshCw className="w-6 h-6 text-[#0F6CBD]" />
                </div>
                <CardTitle>Batch Processing</CardTitle>
                <CardDescription>
                  Convert entire question banks with a single click
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-[#111827] mb-6">
                About AssessmentCore
              </h2>
              <p className="text-lg text-[#475569] mb-6">
                We specialize in helping small EdTech platforms streamline their assessment 
                workflow by converting questions into standardized formats. Our mission is to 
                make educational content more accessible and portable.
              </p>
              <p className="text-lg text-[#475569] mb-6">
                Founded by educators and developers, AssessmentCore understands the unique 
                challenges faced by emerging EdTech companies. We provide enterprise-grade 
                conversion tools at prices that make sense for growing platforms.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-[#16A34A] flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold text-[#111827]">Industry Standard</h4>
                    <p className="text-[#475569]">Full compliance with QTI 2.1 and 3.0 specifications</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-[#16A34A] flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold text-[#111827]">Reliable Support</h4>
                    <p className="text-[#475569]">Dedicated support team to help you succeed</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-[#16A34A] flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold text-[#111827]">Continuous Updates</h4>
                    <p className="text-[#475569]">Regular updates with new features and improvements</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-[#1F2937] rounded-2xl p-8 text-white">
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                    <div className="text-4xl font-bold mb-2">99.9%</div>
                    <div className="text-sm opacity-90">Uptime</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                    <div className="text-4xl font-bold mb-2">10M+</div>
                    <div className="text-sm opacity-90">Questions Converted</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                    <div className="text-4xl font-bold mb-2">500+</div>
                    <div className="text-sm opacity-90">EdTech Platforms</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                    <div className="text-4xl font-bold mb-2">24/7</div>
                    <div className="text-sm opacity-90">Support</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[#111827] mb-4">Our Services</h2>
            <p className="text-xl text-[#475569] max-w-2xl mx-auto">
              Comprehensive solutions for all your assessment conversion needs
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border border-[#E2E8F0] hover:border-[#0F6CBD] transition-all hover:shadow-xl">
              <CardHeader>
                <div className="w-14 h-14 bg-[#F1F5F9] rounded-xl flex items-center justify-center mb-4">
                  <FileJson className="w-7 h-7 text-[#0F6CBD]" />
                </div>
                <CardTitle>QTI Conversion</CardTitle>
                <CardDescription className="text-base">
                  Convert your questions into QTI 2.1 or 3.0 format with full compliance 
                  and validation. Perfect for LMS integration.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border border-[#E2E8F0] hover:border-[#0F6CBD] transition-all hover:shadow-xl">
              <CardHeader>
                <div className="w-14 h-14 bg-[#F1F5F9] rounded-xl flex items-center justify-center mb-4">
                  <FileCode className="w-7 h-7 text-[#0F6CBD]" />
                </div>
                <CardTitle>JSON Export</CardTitle>
                <CardDescription className="text-base">
                  Export to clean, structured JSON format ready for API integration 
                  in your web or mobile applications.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border border-[#E2E8F0] hover:border-[#0F6CBD] transition-all hover:shadow-xl">
              <CardHeader>
                <div className="w-14 h-14 bg-[#F1F5F9] rounded-xl flex items-center justify-center mb-4">
                  <Layers className="w-7 h-7 text-[#0F6CBD]" />
                </div>
                <CardTitle>Batch Processing</CardTitle>
                <CardDescription className="text-base">
                  Upload and convert thousands of questions at once. Save time 
                  with our intelligent batch processing system.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border border-[#E2E8F0] hover:border-[#0F6CBD] transition-all hover:shadow-xl">
              <CardHeader>
                <div className="w-14 h-14 bg-[#F1F5F9] rounded-xl flex items-center justify-center mb-4">
                  <RefreshCw className="w-7 h-7 text-[#0F6CBD]" />
                </div>
                <CardTitle>Format Migration</CardTitle>
                <CardDescription className="text-base">
                  Migrate between different question formats seamlessly. We handle 
                  the complexity so you don't have to.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border border-[#E2E8F0] hover:border-[#0F6CBD] transition-all hover:shadow-xl">
              <CardHeader>
                <div className="w-14 h-14 bg-[#F1F5F9] rounded-xl flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-7 h-7 text-[#0F6CBD]" />
                </div>
                <CardTitle>QTI Rendering</CardTitle>
                <CardDescription className="text-base">
                  Preview and validate your QTI questions with our built-in 
                  renderer before deploying to production.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border border-[#E2E8F0] hover:border-[#0F6CBD] transition-all hover:shadow-xl">
              <CardHeader>
                <div className="w-14 h-14 bg-[#F1F5F9] rounded-xl flex items-center justify-center mb-4">
                  <Clock className="w-7 h-7 text-[#0F6CBD]" />
                </div>
                <CardTitle>Custom Solutions</CardTitle>
                <CardDescription className="text-base">
                  Need something specific? We offer custom conversion solutions 
                  tailored to your unique requirements.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[#111827] mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-[#475569] max-w-2xl mx-auto">
              Choose the plan that fits your needs. All plans include core features.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Starter Plan */}
            <Card className="border border-[#E2E8F0] hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="text-2xl">Starter</CardTitle>
                <CardDescription>Perfect for getting started</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-[#111827]">$49</span>
                  <span className="text-[#475569]">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#16A34A] flex-shrink-0 mt-0.5" />
                    <span className="text-[#475569]">Up to 5,000 questions/month</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#16A34A] flex-shrink-0 mt-0.5" />
                    <span className="text-[#475569]">QTI 2.1 & JSON export</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#16A34A] flex-shrink-0 mt-0.5" />
                    <span className="text-[#475569]">Batch processing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#16A34A] flex-shrink-0 mt-0.5" />
                    <span className="text-[#475569]">Email support</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#16A34A] flex-shrink-0 mt-0.5" />
                    <span className="text-[#475569]">QTI Renderer</span>
                  </li>
                </ul>
                <Button className="w-full border border-[#334155] text-[#1F2937] hover:bg-[#F1F5F9] rounded-md" variant="outline">Get Started</Button>
              </CardContent>
            </Card>

            {/* Professional Plan */}
            <Card className="border border-[#0F6CBD] hover:shadow-xl transition-shadow relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-[#0F6CBD] text-white px-4 py-1 rounded-full text-sm font-semibold">
                  Most Popular
                </span>
              </div>
              <CardHeader>
                <CardTitle className="text-2xl">Professional</CardTitle>
                <CardDescription>For growing platforms</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-[#111827]">$149</span>
                  <span className="text-[#475569]">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#16A34A] flex-shrink-0 mt-0.5" />
                    <span className="text-[#475569]">Up to 25,000 questions/month</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#16A34A] flex-shrink-0 mt-0.5" />
                    <span className="text-[#475569]">QTI 2.1, 3.0 & JSON export</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#16A34A] flex-shrink-0 mt-0.5" />
                    <span className="text-[#475569]">Advanced batch processing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#16A34A] flex-shrink-0 mt-0.5" />
                    <span className="text-[#475569]">Priority support</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#16A34A] flex-shrink-0 mt-0.5" />
                    <span className="text-[#475569]">API access</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#16A34A] flex-shrink-0 mt-0.5" />
                    <span className="text-[#475569]">Custom templates</span>
                  </li>
                </ul>
                <Button className="w-full bg-[#0F6CBD] hover:bg-[#0B5A9A] active:bg-[#094A7F] text-white rounded-md">
                  Get Started
                </Button>
              </CardContent>
            </Card>

            {/* Enterprise Plan */}
            <Card className="border border-[#E2E8F0] hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="text-2xl">Enterprise</CardTitle>
                <CardDescription>For large-scale platforms</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-[#111827]">Custom</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#16A34A] flex-shrink-0 mt-0.5" />
                    <span className="text-[#475569]">Unlimited questions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#16A34A] flex-shrink-0 mt-0.5" />
                    <span className="text-[#475569]">All formats & versions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#16A34A] flex-shrink-0 mt-0.5" />
                    <span className="text-[#475569]">Dedicated infrastructure</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#16A34A] flex-shrink-0 mt-0.5" />
                    <span className="text-[#475569]">24/7 premium support</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#16A34A] flex-shrink-0 mt-0.5" />
                    <span className="text-[#475569]">Custom integrations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#16A34A] flex-shrink-0 mt-0.5" />
                    <span className="text-[#475569]">SLA guarantee</span>
                  </li>
                </ul>
                <Button className="w-full border border-[#334155] text-[#1F2937] hover:bg-[#F1F5F9] rounded-md" variant="outline">Contact Sales</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
            <h2 className="text-4xl font-bold text-[#111827] mb-6">Get in Touch</h2>
            <p className="text-lg text-[#475569] mb-8">
              Have questions? We'd love to hear from you. Send us a message and 
              we'll respond as soon as possible.
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#F1F5F9] rounded-lg flex items-center justify-center flex-shrink-0">
                  <Mail className="w-6 h-6 text-[#0F6CBD]" />
                </div>
                <div>
                  <h4 className="font-semibold text-[#111827] mb-1">Email</h4>
                  <p className="text-[#475569]">info@assesmentcore.com</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#F1F5F9] rounded-lg flex items-center justify-center flex-shrink-0">
                  <Phone className="w-6 h-6 text-[#0F6CBD]" />
                </div>
                <div>
                  <h4 className="font-semibold text-[#111827] mb-1">Phone</h4>
                  <p className="text-[#475569]">+1 (555) 123-4567</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#F1F5F9] rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-6 h-6 text-[#0F6CBD]" />
                </div>
                <div>
                  <h4 className="font-semibold text-[#111827] mb-1">Office</h4>
                  <p className="text-[#475569]">
                    123 EdTech Avenue<br />
                    San Francisco, CA 94105
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Card className="border border-[#E2E8F0]">
            <CardHeader>
              <CardTitle>Send us a Message</CardTitle>
              <CardDescription>
                Fill out the form below and we'll get back to you shortly
              </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-[#334155] mb-2">
                        Name
                      </label>
                      <Input id="name" placeholder="Your name" />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-[#334155] mb-2">
                        Email
                      </label>
                      <Input id="email" type="email" placeholder="your@email.com" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="subject" className="block text-sm font-medium text-[#334155] mb-2">
                      Subject
                    </label>
                    <Input id="subject" placeholder="How can we help?" />
                  </div>
                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-[#334155] mb-2">
                      Message
                    </label>
                    <Textarea 
                      id="message" 
                      placeholder="Tell us more about your needs..." 
                      className="min-h-[120px]"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-[#0F6CBD] hover:bg-[#0B5A9A] active:bg-[#094A7F] text-white rounded-md"
                  >
                    Send Message
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1F2937] text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-[#0F6CBD] rounded-lg flex items-center justify-center">
                  <FileCode className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-semibold">AssessmentCore</span>
              </div>
              <p className="text-[#94A3B8]">
                Transforming assessment questions into standardized formats for EdTech platforms.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-[#94A3B8]">
                <li><a href="#services" className="hover:text-white transition-colors">Services</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><Link to="/workspace" className="hover:text-white transition-colors">Workspace</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-[#94A3B8]">
                <li><a href="#about" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#contact" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-[#94A3B8]">
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-[#334155] pt-8 text-center text-[#94A3B8]">
            <p>&copy; 2026 AssessmentCore. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

