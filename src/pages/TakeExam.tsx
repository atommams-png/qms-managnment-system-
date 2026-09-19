import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getExam, getExamAccessStatus, startAttempt, updateAttempt, submitAttempt, getCandidate } from '@/lib/store';
import { Exam, ExamAttempt, CandidateAnswer, Question } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ChevronLeft, ChevronRight, Clock, Send } from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/Header';

const TakeExam = () => {
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { candidateId, examId } = (location.state || {}) as { candidateId?: string; examId?: string };

  const [exam, setExam] = useState<Exam | null>(null);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<CandidateAnswer[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [passageMap, setPassageMap] = useState<Record<string, string>>({});
  const [showTabSwitchAlert, setShowTabSwitchAlert] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState('');
  const [alertTimeoutId, setAlertTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const attemptRef = useRef<ExamAttempt | null>(null);
  const tabSwitchesRef = useRef<number>(0);
  const questionTimesRef = useRef<Record<string, number>>({});
  const questionEnteredAtRef = useRef<number>(Date.now());

  // Initialize exam
  useEffect(() => {
    if (!candidateId || !examId) { navigate('/'); return; }

    const initializeExam = async () => {
      try {
        // Validate candidate exists and belongs to this exam
        const candidate = await getCandidate(candidateId);
        if (!candidate || candidate.examId !== examId) {
          toast.error('Invalid candidate or access denied');
          navigate('/');
          return;
        }

        const e = await getExam(examId);
        if (!e) { navigate('/'); return; }

        const access = await getExamAccessStatus(e.code);
        if (access.status === 'not_started') {
          setScheduleMessage('Exam not yet active');
          setExam(e);
          return;
        }
        if (access.status === 'expired') {
          setScheduleMessage('Exam expired');
          setExam(e);
          return;
        }
        if (access.status !== 'active') {
          setScheduleMessage('Invalid exam code or inactive exam');
          setExam(e);
          return;
        }

        setExam(e);

        let qs = [...e.questions];
        if (e.settings.randomOrder) {
          // Fisher-Yates shuffle for proper randomization
          for (let i = qs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [qs[i], qs[j]] = [qs[j], qs[i]];
          }
        }
        setQuestions(qs);
        setAnswers(qs.map(q => ({ questionId: q.id, selectedAnswer: null })));
        questionTimesRef.current = Object.fromEntries(qs.map(q => [q.id, 0]));
        questionEnteredAtRef.current = Date.now();
        setTimeLeft(e.settings.duration * 60);

        // Build passage map for reading comprehension
        const pMap: Record<string, string> = {};
        for (const q of e.questions) {
          if (q.type === 'reading-comprehension' && q.passage && q.passageGroupId) {
            pMap[q.passageGroupId] = q.passage;
          }
        }
        setPassageMap(pMap);

        const att = await startAttempt(candidateId, examId);
        if (!att) {
          toast.error('Failed to start exam. You may have already attempted this exam.');
          navigate('/');
          return;
        }
        setAttempt(att);
        attemptRef.current = att;

        // Fullscreen (only works if triggered by user gesture, will fail silently)
        if (e.settings.fullscreenMode) {
          // Note: Fullscreen request must be triggered by user interaction (e.g., button click)
          // Not from useEffect. This will be attempted when questions are displayed.
          // document.documentElement.requestFullscreen?.().catch(() => {});
        }
      } catch (error) {
        console.error('Error initializing exam:', error);
        toast.error('Error loading exam');
        navigate('/');
      }
    };

    initializeExam();
  }, [candidateId, examId, navigate]);

  // Timer
  useEffect(() => {
    if (submitted || !exam) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { handleSubmit(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [submitted, exam]);

  // Tab switch detection
  useEffect(() => {
    if (!exam?.settings.tabSwitchDetection || submitted) return;
    const handler = () => {
      if (document.hidden) {
        setTabSwitches(prev => {
          const next = prev + 1;

          // Show alert in the middle of exam
          setShowTabSwitchAlert(true);

          // Clear previous timeout if exists
          if (alertTimeoutId) clearTimeout(alertTimeoutId);

          // Auto-hide alert after 4 seconds
          const timeoutId = setTimeout(() => {
            setShowTabSwitchAlert(false);
          }, 4000);
          setAlertTimeoutId(timeoutId);

          // Show toast notification
          toast.warning(`Tab switch detected! (${next}/${exam.settings.maxTabSwitches})`);

          tabSwitchesRef.current = next;

          if (next >= exam.settings.maxTabSwitches) {
            handleSubmit(next);
            toast.error('Exam auto-submitted due to too many tab switches');
          }
          return next;
        });
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => {
      document.removeEventListener('visibilitychange', handler);
      if (alertTimeoutId) clearTimeout(alertTimeoutId);
    };
  }, [exam, submitted, alertTimeoutId]);

  const handleSubmit = useCallback(async (forcedTabSwitches?: number) => {
    if (submitted) return;
    setSubmitted(true);
    const att = attemptRef.current;
    if (!att) return;
    const finalTabSwitches = forcedTabSwitches ?? tabSwitchesRef.current;

    const currentQuestionId = questions[currentQ]?.id;
    if (currentQuestionId) {
      const elapsedSeconds = Math.max(0, Math.round((Date.now() - questionEnteredAtRef.current) / 1000));
      questionTimesRef.current[currentQuestionId] = (questionTimesRef.current[currentQuestionId] || 0) + elapsedSeconds;
      questionEnteredAtRef.current = Date.now();
    }

    try {
      // Sanitize answers to only include safe, serializable fields
      const answersWithTime = answers.map(a => ({
        questionId: a.questionId,
        selectedAnswer: a.selectedAnswer,
        timeSpentSeconds: Math.max(0, Math.round(questionTimesRef.current[a.questionId] || 0)),
      }));

      // Quick debug: log answers shape to catch any accidental DOM / event objects
      // (remove this log after debugging in development)
      // eslint-disable-next-line no-console
      console.debug('Submitting answersWithTime:', answersWithTime);

      // Only pass the specific fields needed, not the entire attempt object (which has circular refs)
      const result = await submitAttempt(att.id, answersWithTime, finalTabSwitches);
      if (!result) {
        toast.error('Failed to generate result. Please try again.');
        setSubmitted(false);
        return;
      }

      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});

      // Disable back button after submission
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', () => {
        window.history.pushState(null, '', window.location.href);
        toast.error('Back navigation is disabled after exam submission');
      });

      navigate(`/exam/${code}/result`, { state: { attemptId: att.id, examId: att.examId } });
    } catch (error) {
      console.error('Error submitting exam:', error);
      toast.error('Error submitting exam');
      setSubmitted(false);
    }
  }, [answers, submitted, navigate, code, questions, currentQ]);

  const navigateToQuestion = (targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= questions.length || targetIndex === currentQ) return;

    const currentQuestionId = questions[currentQ]?.id;
    if (currentQuestionId) {
      const elapsedSeconds = Math.max(0, Math.round((Date.now() - questionEnteredAtRef.current) / 1000));
      questionTimesRef.current[currentQuestionId] = (questionTimesRef.current[currentQuestionId] || 0) + elapsedSeconds;
    }

    questionEnteredAtRef.current = Date.now();
    setCurrentQ(targetIndex);
  };

  // Keep attemptRef updated
  useEffect(() => { if (attempt) attemptRef.current = attempt; }, [attempt]);

  // Keep ref in sync to avoid stale values during async submit triggers
  useEffect(() => {
    tabSwitchesRef.current = tabSwitches;
  }, [tabSwitches]);

  // Disable screenshots and inspector during exam
  useEffect(() => {
    if (submitted) return;

    // Prevent right-click context menu
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      toast.error('Right-click is disabled during exam');
      return false;
    };

    // Prevent keyboard shortcuts
    const preventKeyboard = (e: KeyboardEvent) => {
      // Print Screen key (116 = F5, 119 = F8, etc.)
      const blockedKeys = [
        'PrintScreen', // Print Screen
        'F12', // Dev Tools
        'F11', // Full screen
        'F5', // Reload
      ];

      // Block specific keys
      if (blockedKeys.includes(e.key)) {
        e.preventDefault();
        toast.error('This action is not allowed during exam');
        return false;
      }

      // Block Ctrl+S (save)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        toast.error('Save is disabled during exam');
        return false;
      }

      // Block Ctrl+P (print)
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        toast.error('Print is disabled during exam');
        return false;
      }

      // Block Ctrl+Shift+I (inspector)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        toast.error('Inspector is disabled during exam');
        return false;
      }

      // Block Ctrl+Shift+C (inspector)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        toast.error('Inspector is disabled during exam');
        return false;
      }

      // Block Ctrl+Shift+S (screenshot in some browsers)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 's') {
        e.preventDefault();
        toast.error('Screenshots are disabled during exam');
        return false;
      }

      return true;
    };

    // Prevent drag and drop, copy-paste
    const preventDragDrop = (e: DragEvent) => {
      e.preventDefault();
      return false;
    };

    const preventCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      toast.error('Copy is disabled during exam');
      return false;
    };

    // Add event listeners
    document.addEventListener('contextmenu', preventContextMenu as any);
    document.addEventListener('keydown', preventKeyboard);
    document.addEventListener('dragstart', preventDragDrop);
    document.addEventListener('copy', preventCopy);

    // Disable images drag and right-click save
    const allImages = document.querySelectorAll('img');
    allImages.forEach(img => {
      img.addEventListener('dragstart', preventDragDrop);
      img.addEventListener('contextmenu', preventContextMenu as any);
    });

    // Disable print CSS
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        * { display: none !important; }
      }
      img {
        pointer-events: none !important;
        user-select: none !important;
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
      }
    `;
    document.head.appendChild(style);

    // Cleanup
    return () => {
      document.removeEventListener('contextmenu', preventContextMenu as any);
      document.removeEventListener('keydown', preventKeyboard);
      document.removeEventListener('dragstart', preventDragDrop);
      document.removeEventListener('copy', preventCopy);
      allImages.forEach(img => {
        img.removeEventListener('dragstart', preventDragDrop);
        img.removeEventListener('contextmenu', preventContextMenu as any);
      });
      document.head.removeChild(style);
    };
  }, [submitted]);

  const selectAnswer = (index: number) => {
    // Try fullscreen on first interaction if enabled
    if (exam?.settings.fullscreenMode && !document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {
        // Silently fail - browser may not allow fullscreen
      });
    }
    setAnswers(prev => prev.map((a, i) => i === currentQ ? { ...a, selectedAnswer: index } : a));
  };

  if (scheduleMessage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="max-w-md rounded-xl border bg-card p-6 text-center">
          <h2 className="text-xl font-bold">{scheduleMessage}</h2>
          <p className="mt-2 text-muted-foreground">Please come back during the scheduled exam window.</p>
          <Button className="mt-4" onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  if (!exam || questions.length === 0) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading exam...</div>;
  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isLowTime = timeLeft < 60;
  const isWarnTime = timeLeft < 300 && !isLowTime;
  const q = questions[currentQ];
  const currentAnswer = answers[currentQ]?.selectedAnswer;
  const displayOptions = q.type === 'true-false' ? q.options.slice(0, 2) : q.options;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Tab Switch Alert - Middle of Screen */}
      {showTabSwitchAlert && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="animate-in zoom-in-95 scale-95 duration-300">
            <Card className="w-96 border-4 border-destructive bg-card shadow-2xl">
              <CardContent className="pt-8 pb-8 text-center">
                <div className="mb-4 flex justify-center">
                  <div className="rounded-full bg-destructive/20 p-4">
                    <AlertTriangle className="h-12 w-12 text-destructive animate-pulse" />
                  </div>
                </div>
                <h2 className="mb-2 text-2xl font-bold text-destructive">Tab Switch Detected!</h2>
                <p className="mb-4 text-sm text-muted-foreground">You switched away from the exam window</p>
                <div className="mb-6 rounded-lg bg-destructive/5 p-4 border border-destructive/20">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Switch Count:</span>
                    <span className="text-lg font-bold text-destructive">{tabSwitches} / {exam?.settings.maxTabSwitches}</span>
                  </div>
                  <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-destructive transition-all duration-300"
                      style={{ width: `${Math.min(100, (tabSwitches / exam!.settings.maxTabSwitches) * 100)}%` }}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {tabSwitches >= exam?.settings.maxTabSwitches ? (
                    <span className="text-destructive font-semibold">Limit reached! Exam will auto-submit.</span>
                  ) : (
                    <span>{exam ? exam.settings.maxTabSwitches - tabSwitches : 0} attempt{tabSwitches !== exam?.settings.maxTabSwitches - 1 ? 's' : ''} remaining</span>
                  )}
                </p>
                <Button
                  onClick={() => setShowTabSwitchAlert(false)}
                  className="mt-6 w-full bg-primary hover:bg-primary/90"
                >
                  Continue Exam
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Header
        className="sticky top-0 z-40 shadow-sm compact"
        title={exam.name}
        leftChildren={
          <div className="hidden sm:block ml-2">
            <p className="text-xs sm:text-sm text-muted-foreground">Q {currentQ + 1} of {questions.length}</p>
          </div>
        }
      >
        {tabSwitches > 0 && (
          <Badge variant="destructive" className="text-xs hidden sm:flex">
            <AlertTriangle className="mr-1 h-3 w-3" /> {tabSwitches}
          </Badge>
        )}
        <div className={`flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 font-mono text-xs sm:text-sm font-bold ${isLowTime ? 'bg-destructive/10 text-destructive timer-pulse' : isWarnTime ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
          <Clock className="h-3 sm:h-4 w-3 sm:w-4" />
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
      </Header>

      {/* Mobile-only Question Navigator (immediately below header) */}
      {exam.settings.navigationPanel && (
        <div className="lg:hidden w-full px-2 sm:px-4">
          <div className="mx-auto w-full max-w-6xl">
            <div className="mt-2 mb-3 pb-4 border-b border-border">
              <p className="mb-3 text-xs font-semibold text-muted-foreground uppercase">Question Navigator</p>
              <div className="grid grid-cols-6 gap-2">
                {questions.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => navigateToQuestion(i)}
                    className={`flex h-9 w-9 items-center justify-center rounded-md text-xs font-semibold transition-all ${
                      i === currentQ
                        ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                        : answers[i]?.selectedAnswer !== null
                        ? 'bg-success/20 text-success border-2 border-success/40 hover:bg-success/30'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80 border border-border'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><div className="h-3 w-3 rounded bg-primary" /> Current</div>
                <div className="flex items-center gap-2"><div className="h-3 w-3 rounded border border-success/40 bg-success/20" /> Answered</div>
                <div className="flex items-center gap-2"><div className="h-3 w-3 rounded border border-border bg-muted" /> Unanswered</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col lg:flex-row mx-auto px-2 sm:px-4 py-4 sm:py-6 gap-4 sm:gap-6 w-full max-w-6xl">
        {/* Question Area */}
        <div className="flex-1 space-y-6">
          <Card>
            <CardContent className="pt-6">
              <p className="mb-4 text-lg font-medium">
                <span className="mr-2 text-primary font-bold">Q{currentQ + 1}.</span>
                {q.text}
              </p>
              {q.imageUrl && <img src={q.imageUrl} alt="Question" className="mb-4 max-h-64 w-auto rounded border" />}
              {q.type === 'reading-comprehension' && (q.passage || (q.passageGroupId && passageMap[q.passageGroupId])) && (
                <div className="mb-6 p-4 bg-muted rounded-lg border border-border">
                  <p className="font-semibold text-sm mb-2">Reading Passage:</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{q.passage || passageMap[q.passageGroupId!]}</p>
                </div>
              )}
              <div className="space-y-3">
                {displayOptions.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => selectAnswer(i)}
                    className={`w-full rounded-lg border p-4 text-left transition-all ${
                      currentAnswer === i
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/40 hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                        currentAnswer === i ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        {q.type === 'true-false' ? (opt === 'True' ? 'T' : 'F') : String.fromCharCode(65 + i)}
                      </span>
                      <div className="flex-1">
                        <p>{opt}</p>
                        {q.optionImages?.[i] && q.type === 'mcq-image' && <img src={q.optionImages[i]} alt={`Option ${String.fromCharCode(65 + i)}`} className="mt-2 max-h-32 w-auto rounded" />}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              
            </CardContent>
          </Card>

          <div className="flex w-full flex-col sm:flex-row items-center sm:justify-between gap-3">
            <Button variant="outline" onClick={() => navigateToQuestion(currentQ - 1)} disabled={currentQ === 0}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Previous
            </Button>
            {currentQ === questions.length - 1 ? (
              <Button onClick={() => handleSubmit()} className="bg-success hover:bg-success/90 text-success-foreground">
                <Send className="mr-1.5 h-4 w-4" /> Submit Exam
              </Button>
            ) : (
              <Button onClick={() => navigateToQuestion(currentQ + 1)}>
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Navigation Panel - Desktop Only */}
        {exam.settings.navigationPanel && (
          <div className="hidden w-64 shrink-0 lg:block pt-2">
            <Card className="sticky top-20">
              <CardContent className="pt-6">
                <p className="mb-3 text-sm font-semibold">Question Navigator</p>
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => navigateToQuestion(i)}
                      className={`flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-all ${
                        i === currentQ
                          ? 'bg-primary text-primary-foreground'
                          : answers[i]?.selectedAnswer !== null
                          ? 'bg-success/15 text-success border border-success/30'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2"><div className="h-3 w-3 rounded bg-success/15 border border-success/30" /> Answered</div>
                  <div className="flex items-center gap-2"><div className="h-3 w-3 rounded bg-muted" /> Unanswered</div>
                  <div className="flex items-center gap-2"><div className="h-3 w-3 rounded bg-primary" /> Current</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default TakeExam;
