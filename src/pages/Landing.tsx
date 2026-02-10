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
              {/* LOGO IMAGE (replaced Shield) */}
              <div className="w-12 h-12 rounded-xl gradient-accent p-[2px] shadow-glow">
                <div className="w-full h-full bg-white rounded-xl flex items-center justify-center overflow-hidden">
                  <img
                    src="/cuk-favicon.png"
                    alt="CUK Logo"
                    className="w-8 h-8 object-contain"
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
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/20 text-accent-foreground/90 text-sm font-medium mb-8 animate-fade-in">
              <Lock className="w-4 h-4" />
              Secure • Transparent • Compliant
            </div>
            
            <h2 className="text-5xl md:text-6xl font-bold mb-6 animate-slide-up">
              CUK Secure Exam Paper
              <br />
              <span className="text-accent">Management System</span>
            </h2>
            
            <p className="text-xl text-primary-foreground/80 mb-10 max-w-2xl mx-auto animate-fade-in">
              Eliminate paper leaks, enforce proper approvals, and create a complete digital audit trail. 
              Built for universities that take exam security seriously.
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
