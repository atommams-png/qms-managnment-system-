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
    <div className="min-h-screen pt-20 bg-background">
      <Header>
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>
          Admin Login
        </Button>
      </Header>

      {/* Hero */}
      <main className="container py-16">
        <div className="mx-auto max-w-2xl text-center animate-fade-in">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          
            <span className="block text-primary">ATOM SHAALE Examination Portal</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Take exams securely with anti-cheating measures, automatic evaluation, and instant results.
          </p>

          {/* Exam Code Entry */}
          <Card className="mx-auto mt-10 max-w-md">
            <CardHeader>
              <CardTitle>Join an Exam</CardTitle>
              <CardDescription>Enter the exam code provided by your instructor</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleJoin} className="flex gap-2">
                <Input
                  placeholder="Enter exam code"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  className="font-mono text-center text-lg tracking-widest"
                  maxLength={8}
                  required
                />
                <Button type="submit">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Features */}
          <div className="mt-16 grid gap-6 sm:grid-cols-3">
            {[
              { icon: Shield, title: 'Secure', desc: 'Anti-cheating with fullscreen mode & tab detection' },
              { icon: Clock, title: 'Timed', desc: 'Auto-submit when time runs out' },
              { icon: BookOpen, title: 'Instant Results', desc: 'Get your score immediately after submission' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl border bg-card p-6 text-center card-hover">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Landing;
