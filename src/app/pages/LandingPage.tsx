import { useState } from "react";
import { Link } from "react-router";
import {
  Menu,
  X,
  Zap,
  FileJson,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Mail,
  MapPin,
  ArrowRight,
  FileCode,
  Layers,
  Clock,
  ChevronDown,
  Upload,
  Settings2,
  Download,
  Shield,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { useAuth } from "../../contexts/AuthContext";

const PLAN_FEATURES: { label: string; free: string | boolean; pro: string | boolean }[] = [
  { label: "Exports per month",        free: "1",          pro: "Unlimited" },
  { label: "Questions per export",     free: "Up to 100",  pro: "1,000+" },
  { label: "QTI 1.2 / 2.1 / 3.0",     free: true,         pro: true },
  { label: "JSON export",              free: true,         pro: true },
  { label: "Batch validation",         free: true,         pro: true },
  { label: "Image & media support",    free: true,         pro: true },
  { label: "Template XML",             free: true,         pro: true },
  { label: "AI-powered validation",    free: false,        pro: true },
  { label: "LMS export integration",  free: false,        pro: true },
  { label: "Support",                  free: "Standard",   pro: "Priority" },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "What file formats can I upload?",
    a: "AssessmentCore accepts CSV, XLSX (Excel), and JSON files. Your spreadsheet should contain columns for questions, answer choices, correct answers, and question type — our system auto-detects them.",
  },
  {
    q: "Which QTI versions are supported?",
    a: "We support QTI 1.2, QTI 2.1, and QTI 3.0, covering the full range of LMS platforms from legacy systems to the latest standards.",
  },
  {
    q: "What is the difference between Free and Professional?",
    a: "The Free plan includes 1 export per month with up to 100 questions. The Professional plan unlocks unlimited exports, 1,000+ questions per batch, AI-powered XML validation, LMS export integration, and priority support.",
  },
  {
    q: "Can I include images in my questions?",
    a: "Yes. You can upload a ZIP archive or a folder of images alongside your question file. AssessmentCore embeds image references correctly in the generated QTI package.",
  },
  {
    q: "How does AI validation work?",
    a: "After generating QTI XML, the AI validator reviews each item for structural correctness, semantic accuracy, and spec compliance, then flags or auto-fixes issues. This feature is available on the Professional plan.",
  },
  {
    q: "Is my data stored on your servers?",
    a: "No. File processing is performed entirely in your browser. Your question data is never stored on our servers — only your account credentials and usage statistics are retained.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[#F8FAFC] transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="font-medium text-[#111827] pr-4">{q}</span>
        <ChevronDown
          className={`w-5 h-5 text-[#475569] flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-6 pb-5 text-[#475569] text-sm leading-relaxed border-t border-[#E2E8F0] pt-4">
          {a}
        </div>
      )}
    </div>
  );
}

export function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated } = useAuth();

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
              <a href="#features" className="text-[#E2E8F0] hover:text-[#0F6CBD] transition-colors">Features</a>
              <a href="#about" className="text-[#E2E8F0] hover:text-[#0F6CBD] transition-colors">About</a>
              <a href="#services" className="text-[#E2E8F0] hover:text-[#0F6CBD] transition-colors">Services</a>
              <a href="#faq" className="text-[#E2E8F0] hover:text-[#0F6CBD] transition-colors">FAQ</a>
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
              <a href="#features" className="block text-[#E2E8F0] hover:text-[#0F6CBD] transition-colors py-2">Features</a>
              <a href="#about" className="block text-[#E2E8F0] hover:text-[#0F6CBD] transition-colors py-2">About</a>
              <a href="#services" className="block text-[#E2E8F0] hover:text-[#0F6CBD] transition-colors py-2">Services</a>
              <a href="#faq" className="block text-[#E2E8F0] hover:text-[#0F6CBD] transition-colors py-2">FAQ</a>
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
      <section id="home" className="pt-32 pb-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#F0F9FF] to-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-[#E0F0FF] text-[#0F6CBD] text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            <Shield className="w-4 h-4" />
            Built for EdTech Professionals
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold text-[#111827] mb-6 leading-tight">
            Transform Questions into{" "}
            <span className="text-[#0F6CBD]">QTI & JSON</span>
          </h1>
          <p className="text-xl text-[#475569] mb-10 max-w-2xl mx-auto">
            Empower your EdTech platform with seamless batch conversion of assessment questions
            into QTI and JSON formats — fast, validated, and LMS-ready.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-5">
            <Link to="/workspace">
              <Button size="lg" className="bg-[#0F6CBD] hover:bg-[#0B5A9A] active:bg-[#094A7F] text-white rounded-md px-8">
                Get Started Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline" className="border-[#CBD5E1] text-[#334155] hover:bg-[#F1F5F9] rounded-md px-8">
                See Features
              </Button>
            </a>
          </div>
          <p className="text-sm text-[#94A3B8]">No credit card required · 1 free export included</p>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold text-[#111827] mb-4">How It Works</h2>
            <p className="text-xl text-[#475569]">From spreadsheet to QTI package in three steps</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-[#0F6CBD] rounded-2xl flex items-center justify-center mb-5 text-white text-xl font-bold shadow-md">
                1
              </div>
              <Upload className="w-8 h-8 text-[#0F6CBD] mb-4" />
              <h3 className="text-xl font-semibold text-[#111827] mb-3">Upload Your Spreadsheet</h3>
              <p className="text-[#475569]">Import a CSV, XLSX, or JSON file containing your questions, answer choices, and correct answers. Our system auto-detects columns.</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-[#0F6CBD] rounded-2xl flex items-center justify-center mb-5 text-white text-xl font-bold shadow-md">
                2
              </div>
              <Settings2 className="w-8 h-8 text-[#0F6CBD] mb-4" />
              <h3 className="text-xl font-semibold text-[#111827] mb-3">Configure & Validate</h3>
              <p className="text-[#475569]">Select your target QTI version (1.2, 2.1, or 3.0), review validation results, and optionally enable AI-powered XML validation.</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-[#0F6CBD] rounded-2xl flex items-center justify-center mb-5 text-white text-xl font-bold shadow-md">
                3
              </div>
              <Download className="w-8 h-8 text-[#0F6CBD] mb-4" />
              <h3 className="text-xl font-semibold text-[#111827] mb-3">Export Your Package</h3>
              <p className="text-[#475569]">Download a fully compliant QTI or JSON package ready to import into Canvas, Moodle, Blackboard, and other major LMS platforms.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold text-[#111827] mb-4">Why AssessmentCore?</h2>
            <p className="text-xl text-[#475569]">Everything you need to ship high-quality assessments faster</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border border-[#E2E8F0] hover:border-[#0F6CBD] hover:shadow-xl transition-all">
              <CardHeader>
                <div className="w-12 h-12 bg-[#F0F9FF] rounded-xl flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-[#0F6CBD]" />
                </div>
                <CardTitle>Lightning Fast</CardTitle>
                <CardDescription className="text-base">
                  Process thousands of questions in seconds. The batch engine handles large files without slowing down.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border border-[#E2E8F0] hover:border-[#0F6CBD] hover:shadow-xl transition-all">
              <CardHeader>
                <div className="w-12 h-12 bg-[#F0F9FF] rounded-xl flex items-center justify-center mb-4">
                  <FileJson className="w-6 h-6 text-[#0F6CBD]" />
                </div>
                <CardTitle>Multiple Formats</CardTitle>
                <CardDescription className="text-base">
                  Export to QTI 1.2, QTI 2.1, QTI 3.0, or structured JSON — whatever your LMS or application requires.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border border-[#E2E8F0] hover:border-[#0F6CBD] hover:shadow-xl transition-all">
              <CardHeader>
                <div className="w-12 h-12 bg-[#F0F9FF] rounded-xl flex items-center justify-center mb-4">
                  <RefreshCw className="w-6 h-6 text-[#0F6CBD]" />
                </div>
                <CardTitle>Batch Processing</CardTitle>
                <CardDescription className="text-base">
                  Convert entire question banks in one click. Batch upload, validate, and export — end to end.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl">
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



      {/* Feature Comparison Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold text-[#111827] mb-4">Free vs Professional</h2>
            <p className="text-xl text-[#475569]">Choose the plan that fits your workflow</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-sm">
            <div className="grid grid-cols-3 bg-[#F8FAFC] border-b border-[#E2E8F0]">
              <div className="px-6 py-4 text-sm font-semibold text-[#475569] uppercase tracking-wide">Feature</div>
              <div className="px-6 py-4 text-center">
                <span className="text-base font-bold text-[#111827]">Free</span>
              </div>
              <div className="px-6 py-4 text-center bg-[#0F6CBD]">
                <span className="text-base font-bold text-white">Professional</span>
              </div>
            </div>
            {PLAN_FEATURES.map((row, i) => (
              <div
                key={row.label}
                className={`grid grid-cols-3 border-b border-[#E2E8F0] last:border-b-0 ${i % 2 === 0 ? "bg-white" : "bg-[#FAFBFC]"}`}
              >
                <div className="px-6 py-4 text-sm text-[#334155] font-medium flex items-center">{row.label}</div>
                <div className="px-6 py-4 flex justify-center items-center">
                  {typeof row.free === "boolean" ? (
                    row.free ? (
                      <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
                    ) : (
                      <XCircle className="w-5 h-5 text-[#CBD5E1]" />
                    )
                  ) : (
                    <span className="text-sm text-[#334155] font-medium">{row.free}</span>
                  )}
                </div>
                <div className="px-6 py-4 flex justify-center items-center bg-[#F0F8FF]">
                  {typeof row.pro === "boolean" ? (
                    row.pro ? (
                      <CheckCircle2 className="w-5 h-5 text-[#0F6CBD]" />
                    ) : (
                      <XCircle className="w-5 h-5 text-[#CBD5E1]" />
                    )
                  ) : (
                    <span className="text-sm text-[#0F6CBD] font-semibold">{row.pro}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link to="/workspace">
              <Button className="bg-[#0F6CBD] hover:bg-[#0B5A9A] text-white rounded-md px-8">
                Get Started Free
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold text-[#111827] mb-4">Frequently Asked Questions</h2>
            <p className="text-xl text-[#475569]">Everything you need to know about AssessmentCore</p>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <FAQItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC]">
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
                    <p className="text-[#475569]">hello@assesmentcore.in</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#F1F5F9] rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-[#0F6CBD]" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-[#111827] mb-1">Office</h4>
                    <p className="text-[#475569]">
                      Tamluk<br />
                      West Bengal, India<br />
                      721628
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
              <p className="text-[#94A3B8] mb-6">
                Transforming assessment questions into standardized formats for EdTech platforms.
              </p>
              <div className="flex items-center gap-3">
                {/* Twitter / X */}
                <a href="#" aria-label="Twitter" className="w-9 h-9 rounded-lg bg-[#2D3748] hover:bg-[#0F6CBD] flex items-center justify-center transition-colors">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-[#94A3B8] hover:text-white" aria-hidden="true">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
                  </svg>
                </a>
                {/* LinkedIn */}
                <a href="#" aria-label="LinkedIn" className="w-9 h-9 rounded-lg bg-[#2D3748] hover:bg-[#0F6CBD] flex items-center justify-center transition-colors">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-[#94A3B8] hover:text-white" aria-hidden="true">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065Zm1.782 13.019H3.555V9h3.564v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003Z" />
                  </svg>
                </a>
                {/* GitHub */}
                <a href="#" aria-label="GitHub" className="w-9 h-9 rounded-lg bg-[#2D3748] hover:bg-[#0F6CBD] flex items-center justify-center transition-colors">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-[#94A3B8] hover:text-white" aria-hidden="true">
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                  </svg>
                </a>
                {/* Instagram */}
                <a href="#" aria-label="Instagram" className="w-9 h-9 rounded-lg bg-[#2D3748] hover:bg-[#0F6CBD] flex items-center justify-center transition-colors">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-[#94A3B8] hover:text-white" aria-hidden="true">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069ZM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0Zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881Z" />
                  </svg>
                </a>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-[#94A3B8]">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#services" className="hover:text-white transition-colors">Services</a></li>
                <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
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

          <div className="border-t border-[#334155] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[#94A3B8]">
            <p>&copy; 2026 AssessmentCore. All rights reserved.</p>
            <div className="flex items-center gap-3">
              <a href="#" aria-label="Twitter" className="hover:text-white transition-colors">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
                </svg>
              </a>
              <a href="#" aria-label="LinkedIn" className="hover:text-white transition-colors">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065Zm1.782 13.019H3.555V9h3.564v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003Z" />
                </svg>
              </a>
              <a href="#" aria-label="GitHub" className="hover:text-white transition-colors">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
              </a>
              <a href="#" aria-label="Instagram" className="hover:text-white transition-colors">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069ZM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0Zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881Z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

