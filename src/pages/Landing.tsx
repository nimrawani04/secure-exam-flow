import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Lock,
  Eye,
  FileCheck,
  Users,
  Clock,
  CheckCircle,
  ArrowRight,
  Fingerprint,
  FileText,
  Calendar,
} from 'lucide-react';

const features = [
  {
    icon: Lock,
    title: 'End-to-End Encryption',
    description: 'All exam papers are encrypted during upload, storage, and transmission.',
  },
  {
    icon: Eye,
    title: 'Anonymous Review',
    description: 'HODs review papers without knowing teacher identities, ensuring bias-free selection.',
  },
  {
    icon: Clock,
    title: 'Time-Based Access',
    description: 'Papers unlock only at scheduled exam time. No early access possible.',
  },
  {
    icon: Fingerprint,
    title: 'Complete Audit Trail',
    description: 'Every action is logged with timestamps, user IDs, and IP addresses.',
  },
  {
    icon: FileCheck,
    title: 'Version Control',
    description: 'Multiple paper sets (A, B, C) with full version history tracking.',
  },
  {
    icon: Users,
    title: 'Role-Based Access',
    description: 'Strict permissions for Teachers, HODs, and Examination Cell.',
  },
];

const workflow = [
  {
    step: 1,
    title: 'Teacher Uploads',
    description: 'Subject teachers securely upload question papers before the deadline.',
    icon: FileText,
  },
  {
    step: 2,
    title: 'HOD Reviews',
    description: 'Department heads anonymously compare and select the best paper.',
    icon: Eye,
  },
  {
    step: 3,
    title: 'Paper Locked',
    description: 'Selected paper is locked and forwarded to Examination Cell.',
    icon: Lock,
  },
  {
    step: 4,
    title: 'Exam Day Access',
    description: 'Papers unlock automatically at scheduled time for secure printing.',
    icon: Calendar,
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative gradient-hero text-primary-foreground overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />

        <div className="container relative pt-8">
          {/* Navigation */}
          <nav className="flex items-center justify-between mb-20">
            <div className="flex items-center gap-3">
             {/* LOGO IMAGE */}
<div className="w-12 h-12 rounded-xl gradient-accent p-1 shadow-glow">
  <div className="w-full h-full bg-white rounded-xl flex items-center justify-center overflow-hidden">
    <img
      src="/cuk-favicon.png"
      alt="CUK Logo"
      className="w-11 h-11 object-contain"
    />
  </div>
</div>


              <div>
                <h1 className="font-bold text-xl">CUK ExamSecure</h1>
                <p className="text-xs opacity-70">Paper Management System</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Link to="/auth">
                <Button variant="heroOutline" size="lg">
                  Login
                </Button>
              </Link>
            </div>
          </nav>

          {/* Hero Content */}
          <div className="max-w-4xl mx-auto text-center pb-24">
            <div className="flex justify-center mb-10 animate-fade-in">
  <img
    src="/cuk-favicon.png"
    alt="Central University of Kashmir Logo"
    className="w-40 h-40 md:w-48 md:h-48 object-contain drop-shadow-2xl"
  />
</div>

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/20 text-accent-foreground/90 text-sm font-medium mb-8 animate-fade-in">
              <Lock className="w-4 h-4" />
              Secure • Transparent • Institution-Ready

            </div>

            <h2 className="text-5xl md:text-6xl font-bold mb-6 animate-slide-up">
              CUK Secure Examination
              <br />
             <span className="text-accent/90">Management System</span>

            </h2>

            <p className="text-xl text-primary-foreground/80 mb-10 max-w-2xl mx-auto animate-fade-in">
              A centralized and secure platform for managing university examination papers.
Ensures confidentiality, controlled access, and a complete digital audit trail
across all stages of the examination lifecycle.

            </p>

            <div className="flex items-center justify-center gap-4 animate-slide-up">
              <Link to="/auth">
                <Button variant="hero" size="xl" className="gap-2">
                  Get Started
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </div>

            <div className="mt-16 pt-8 border-t border-primary-foreground/10">
              <p className="text-sm text-primary-foreground/50 mb-4">
                CENTRAL UNIVERSITY OF KASHMIR
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-background">
        <div className="container">
          <div className="text-center mb-16">
            <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">Features</h3>
            <h2 className="text-4xl font-bold mb-4">Security at Every Step</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              From paper upload to exam day, every step is secured, logged, and compliant with accreditation requirements.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="group p-6 rounded-2xl border bg-card shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-12 h-12 rounded-xl gradient-accent flex items-center justify-center mb-4 group-hover:shadow-glow transition-shadow">
                  <feature.icon className="w-6 h-6 text-accent-foreground" />
                </div>
                <h4 className="font-semibold text-lg mb-2">{feature.title}</h4>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="py-24 bg-secondary/30">
        <div className="container">
          <div className="text-center mb-16">
            <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">How It Works</h3>
            <h2 className="text-4xl font-bold mb-4">Streamlined Paper Lifecycle</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              A clear, auditable process from paper creation to exam day.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {workflow.map((item, index) => (
              <div key={item.step} className="relative">
                {index < workflow.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-1/2 w-full h-0.5 bg-border" />
                )}
                <div className="relative bg-card rounded-2xl p-6 shadow-card text-center">
                  <div className="w-12 h-12 rounded-full gradient-accent flex items-center justify-center mx-auto mb-4 relative z-10">
                    <item.icon className="w-6 h-6 text-accent-foreground" />
                  </div>
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    {item.step}
                  </div>
                  <h4 className="font-semibold text-lg mb-2">{item.title}</h4>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles Section */}
      <section className="py-24 bg-background">
        <div className="container">
          <div className="text-center mb-16">
            <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">User Roles</h3>
            <h2 className="text-4xl font-bold mb-4">Designed for Every Stakeholder</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                role: 'Teacher',
                description: 'Upload and manage exam papers with deadline tracking',
                features: [
                  'Upload question papers',
                  'Multiple paper sets (A, B, C)',
                  'Real-time status updates',
                  'Deadline countdown',
                ],
              },
              {
                role: 'Head of Department',
                description: 'Anonymous review and selection of best papers',
                features: [
                  'Anonymous paper comparison',
                  'Bias-free selection',
                  'Rejection with feedback',
                  'Department oversight',
                ],
              },
              {
                role: 'Examination Cell',
                description: 'Secure access and exam day management',
                features: [
                  'Time-locked access',
                  'Secure PDF download',
                  'Exam calendar',
                  'Paper archival',
                ],
              },
            ].map((item) => (
              <div
                key={item.role}
                className="rounded-2xl border bg-card p-8 shadow-card hover:shadow-card-hover transition-all duration-300"
              >
                <h4 className="font-bold text-2xl mb-2">{item.role}</h4>
                <p className="text-muted-foreground mb-6">{item.description}</p>
                <ul className="space-y-3">
                  {item.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm">
                      <CheckCircle className="w-5 h-5 text-accent flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 gradient-hero text-primary-foreground">
        <div className="container text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Secure Your Exams?</h2>
          <p className="text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
            Join leading universities in eliminating paper leaks and ensuring exam integrity.
          </p>
          <Link to="/auth">
            <Button variant="hero" size="xl" className="gap-2">
              Start Now
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-primary text-primary-foreground">
        <div className="container">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* FOOTER LOGO IMAGE */}
              <div className="w-10 h-10 rounded-lg gradient-accent p-[2px]">
                <div className="w-full h-full bg-white rounded-lg flex items-center justify-center overflow-hidden">
                  <img
                    src="/cuk-favicon.png"
                    alt="CUK Logo"
                    className="w-6 h-6 object-contain"
                  />
                </div>
              </div>

              <div>
                <h1 className="font-bold">CUK ExamSecure</h1>
                <p className="text-xs opacity-70">Paper Management System</p>
              </div>
            </div>

            <p className="text-sm opacity-70">© 2026 CUK ExamSecure.</p>

            <p className="text-sm">
              Created by{' '}
              <a
                href="https://m4milaad.github.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Milad Ajaz Bhat
              </a>{' '}
              &amp;{' '}
              <a
                href="https://nimrawani.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Nimra Wani
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
