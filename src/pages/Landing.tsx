import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getExamByCode } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Shield, Clock, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/Header';

const Landing = () => {
  const [code, setCode] = useState('');
  const navigate = useNavigate();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedCode = code.trim().toUpperCase();

    // Special case: "ATOM" code redirects to admin login
    if (normalizedCode === 'ATOM') {
      navigate('/admin');
      return;
    }

    const exam = await getExamByCode(normalizedCode);

    if (exam?.code) {
      navigate(`/exam/${exam.code}/register`);
      return;
    }

    // Defensive fallback: use the entered code if backend omits mapped code field.
    if (exam) {
      navigate(`/exam/${normalizedCode}/register`);
      return;
    }

    toast.error('Invalid or inactive exam code');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <main className="container relative overflow-hidden py-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex justify-center">
          <div className="absolute left-1/3 top-0 h-56 w-56 -translate-x-1/2 rounded-full bg-emerald-400/25 blur-3xl" />
          <div className="absolute right-0 top-16 h-44 w-44 rounded-full bg-sky-500/10 blur-3xl" />
        </div>

        <div className="mx-auto max-w-2xl text-center animate-fade-in space-y-4">
          <span className="inline-flex rounded-full bg-emerald-100 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700 shadow-sm">
            Fast · Secure · Instant
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            <span className="block bg-gradient-to-r from-emerald-700 via-slate-900 to-emerald-500 bg-clip-text text-transparent">
              ATOM QMS Examination Portal
            </span>
          </h1>
          <p className="mx-auto max-w-xl text-base text-slate-600 sm:text-lg">
            Take exams securely with anti-cheating measures, automatic evaluation, and instant results.
          </p>

          {/* Exam Code Entry */}
          <Card className="mx-auto mt-3 max-w-md overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/95 shadow-lg shadow-slate-200/60 transition duration-300 hover:-translate-y-1 hover:shadow-2xl">
            <CardHeader className="px-8 pt-8">
              <CardTitle className="text-2xl">Join an Exam</CardTitle>
              <CardDescription>Enter the exam code provided by your instructor</CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <form onSubmit={handleJoin} className="flex gap-2">
                <Input
                  placeholder="Enter exam code"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  className="font-mono text-center text-lg tracking-widest transition duration-300 focus:scale-[1.01] focus:ring-emerald-400"
                  maxLength={8}
                  required
                />
                <Button type="submit" className="transition-transform duration-300 hover:scale-110">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Features */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Shield, title: 'Secure', desc: 'Anti-cheating with fullscreen mode & tab detection' },
              { icon: Clock, title: 'Timed', desc: 'Auto-submit when time runs out' },
              { icon: BookOpen, title: 'Instant Results', desc: 'Get your score immediately after submission' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 text-center shadow-sm transition duration-300 hover:-translate-y-2 hover:bg-white hover:shadow-xl">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-inner">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-slate-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200/80 bg-slate-50 py-6 text-center text-sm text-slate-500">
        Powered by ATOM
      </footer>
    </div>
  );
};

export default Landing;
