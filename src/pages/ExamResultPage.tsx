import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getResult, getExam, getAttempt } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, MinusCircle, Home, Trophy } from 'lucide-react';
import Header from '@/components/Header';
import { Exam, ExamResult } from '@/lib/types';

const ExamResult = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { attemptId, examId } = (location.state || {}) as { attemptId?: string; examId?: string };
  const [result, setResult] = useState<ExamResult | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadResultData = async () => {
      if (!attemptId) {
        setLoading(false);
        return;
      }

      const [loadedResult, loadedAttempt] = await Promise.all([
        getResult(attemptId),
        getAttempt(attemptId)
      ]);

      const resolvedExamId = examId || loadedAttempt?.examId;
      const loadedExam = resolvedExamId ? await getExam(resolvedExamId) : null;

      setResult(loadedResult || null);
      setExam(loadedExam || null);
      setLoading(false);
    };

    loadResultData();
  }, [attemptId, examId]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Loading result...</p>
      </div>
    );
  }

  if (!result || !exam) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Result not available</p>
        <Button onClick={() => navigate('/')}>Go Home</Button>
      </div>
    );
  }

  if (!exam.settings.showResult) {
    return (
      <div className="min-h-screen bg-background">
        <Header title="Exam Submitted" />
        <div className="flex flex-col items-center justify-center gap-4 animate-fade-in">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
            <CheckCircle2 className="h-10 w-10 text-success" />
          </div>
          <h1 className="text-2xl font-bold">Exam Submitted!</h1>
          <p className="text-muted-foreground">Your responses have been recorded. Results will be shared by your instructor.</p>
          <Button onClick={() => navigate('/')}><Home className="mr-1.5 h-4 w-4" /> Go Home</Button>
        </div>
      </div>
    );
  }

  const isPassed = result.percentage >= 50;

  return (
    <div className="min-h-screen pt-20 bg-background">
      <Header title="Exam Results" />
      <div className="flex items-center justify-center p-4">
        <Card className="w-full max-w-md animate-fade-in">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Exam Results</CardTitle>
            <Badge variant={isPassed ? 'default' : 'destructive'} className="mx-auto mt-2 text-sm">
              {isPassed ? 'Passed' : 'Failed'}
            </Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <p className="text-5xl font-extrabold text-primary">{result.percentage}%</p>
            <p className="mt-1 text-sm text-muted-foreground">{result.obtainedMarks} / {result.totalMarks} marks</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-success/10 p-4 text-center">
              <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-success" />
              <p className="text-2xl font-bold text-success">{result.correctAnswers}</p>
              <p className="text-xs text-muted-foreground">Correct</p>
            </div>
            <div className="rounded-lg bg-destructive/10 p-4 text-center">
              <XCircle className="mx-auto mb-1 h-5 w-5 text-destructive" />
              <p className="text-2xl font-bold text-destructive">{result.wrongAnswers}</p>
              <p className="text-xs text-muted-foreground">Wrong</p>
            </div>
            <div className="rounded-lg bg-muted p-4 text-center">
              <MinusCircle className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
              <p className="text-2xl font-bold">{result.unanswered}</p>
              <p className="text-xs text-muted-foreground">Skipped</p>
            </div>
          </div>

          <Button className="w-full" onClick={() => navigate('/')}>
            <Home className="mr-1.5 h-4 w-4" /> Go Home
          </Button>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default ExamResult;