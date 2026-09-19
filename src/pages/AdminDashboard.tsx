import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getAdminSession, getExams, getVisibleExams, adminLogout, toggleExamActive, deleteExam, getCandidates, getAttempts } from '@/lib/store';
import { Exam } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, LogOut, FileText, Users, Trophy, Copy, Trash2, Eye, EyeOff, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/Header';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [exams, setExams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'notStarted' | 'inactiveExpired'>('all');
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
 
  useEffect(() => {
    if (!getAdminSession()) {
      navigate('/admin');
      return;
    }
    refresh();
  }, [navigate]);

  // Auto-refresh every 10 seconds to update exam statuses based on time changes
  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, []);

  const getExamStatus = (exam: Exam): 'active' | 'notStarted' | 'expired' | 'inactive' => {
    const now = new Date();
    if (!exam.isActive) return 'inactive';

    if (exam.startDateTime) {
      const start = new Date(exam.startDateTime);
      if (now < start) return 'notStarted';
    }

    if (exam.endDateTime) {
      const end = new Date(exam.endDateTime);
      if (now > end) return 'expired';
    }

    return 'active';
  };

  const getFilteredExams = () => {
    if (statusFilter === 'all') return exams;
    
    return exams.filter(exam => {
      const status = getExamStatus(exam);
      if (statusFilter === 'active') return status === 'active';
      if (statusFilter === 'notStarted') return status === 'notStarted';
      if (statusFilter === 'inactiveExpired') return status === 'inactive' || status === 'expired';
      return true;
    });
  };

  const refresh = async () => {
    setIsLoading(true);
    try {
      // Get all exams and filter based on user selection
      const allExams = await getExams();
      setExams(allExams || []);

      // Calculate totals
      if (allExams && allExams.length > 0) {
        let candidates = 0;
        let results = 0;

        for (const exam of allExams) {
          const examCandidates = await getCandidates(exam.id);
          candidates += (examCandidates || []).length;

          const examAttempts = await getAttempts(exam.id);
          results += (examAttempts || []).filter(a => a.isSubmitted).length;
        }

        setTotalCandidates(candidates);
        setTotalResults(results);
      }
    } catch (error) {
      console.error('Error loading exams:', error);
      toast.error('Failed to load exams');
    } finally {
      setIsLoading(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Exam code copied!');
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success('Link copied!');
  };

  const handleToggle = async (id: string) => {
    try {
      await toggleExamActive(id);
      await refresh();
      toast.success('Exam status updated');
    } catch (error) {
      toast.error('Failed to update exam');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this exam?')) {
      try {
        const ok = await deleteExam(id);
        if (!ok) {
          toast.error('Failed to delete exam');
          return;
        }
        await refresh();
        toast.success('Exam deleted');
      } catch (error) {
        toast.error('Failed to delete exam');
      }
    }
  };

  const handleLogout = () => {
    adminLogout();
    navigate('/admin');
  };

  const handleEyeAction = (exam: Exam) => {
    const status = getExamStatus(exam);
    if (status === 'expired') {
      toast.info('Exam expired. Redirecting to schedule settings.');
      navigate(`/admin/exam/${exam.id}/edit-details#schedule`);
      return;
    }

    if (status === 'inactive') {
      handleToggle(exam.id);
      return;
    }

    if (status === 'active') {
      handleToggle(exam.id);
      return;
    }

    // notStarted
    toast('Exam not started yet. Go to Manage to update schedule if needed.');
  };

  return (
    <div className="min-h-screen pt-4 bg-background">
      <Header title="Admin Portal">
        <Button onClick={() => navigate('/admin/create-exam')} size="sm">
          <Plus className="mr-1.5 h-4 w-4" /> New Exam
        </Button>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
        </Button>
      </Header>

      <main className="container py-6 space-y-6 animate-fade-in">
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="stat-card">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Exams</p>
                <p className="text-2xl font-bold">{exams.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                <Users className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Candidates</p>
                <p className="text-2xl font-bold">{totalCandidates}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                <Trophy className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Submissions</p>
                <p className="text-2xl font-bold">{totalResults}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Exams List */}
        <div>
          <div className="mb-6 space-y-4">
            <h2 className="text-lg font-semibold">Your Exams</h2>
            
            {/* Status Filter Tabs */}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setStatusFilter('all')}
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                className={statusFilter === 'all' ? 'bg-primary text-white' : ''}
              >
                All ({exams.length})
              </Button>
              <Button
                onClick={() => setStatusFilter('active')}
                variant={statusFilter === 'active' ? 'default' : 'outline'}
                size="sm"
                className={statusFilter === 'active' ? 'bg-emerald-600 text-white' : ''}
              >
                Active ({exams.filter(e => getExamStatus(e) === 'active').length})
              </Button>
              <Button
                onClick={() => setStatusFilter('notStarted')}
                variant={statusFilter === 'notStarted' ? 'default' : 'outline'}
                size="sm"
                className={statusFilter === 'notStarted' ? 'bg-amber-600 text-white' : ''}
              >
                Not Started ({exams.filter(e => getExamStatus(e) === 'notStarted').length})
              </Button>
              <Button
                onClick={() => setStatusFilter('inactiveExpired')}
                variant={statusFilter === 'inactiveExpired' ? 'default' : 'outline'}
                size="sm"
                className={statusFilter === 'inactiveExpired' ? 'bg-rose-600 text-white' : ''}
              >
                Inactive/Expired ({exams.filter(e => getExamStatus(e) === 'inactive' || getExamStatus(e) === 'expired').length})
              </Button>
            </div>
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Loading exams...</p>
              </CardContent>
            </Card>
          ) : getFilteredExams().length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="mb-4 h-12 w-12 text-muted-foreground/40" />
                <p className="text-muted-foreground mb-4">
                  {exams.length === 0 
                    ? 'No exams found.' 
                    : `No ${statusFilter === 'active' ? 'active' : statusFilter === 'notStarted' ? 'not started' : 'inactive/expired'} exams.`}
                </p>
                {exams.length === 0 && (
                  <Button className="mt-4" onClick={() => navigate('/admin/create-exam')}>
                    <Plus className="mr-1.5 h-4 w-4" /> Create Exam
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {getFilteredExams().map(exam => (
                <Card key={exam.id} className="card-hover">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            getExamStatus(exam) === 'active'
                              ? 'bg-emerald-500'
                              : getExamStatus(exam) === 'notStarted'
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                        />
                        <CardTitle className="text-base">{exam.name}</CardTitle>
                      </div>
                      <Badge
                        variant={
                          getExamStatus(exam) === 'active'
                            ? 'default'
                            : getExamStatus(exam) === 'notStarted'
                            ? 'secondary'
                            : 'destructive'
                        }
                      >
                        {getExamStatus(exam) === 'active'
                          ? 'Active'
                          : getExamStatus(exam) === 'notStarted'
                          ? 'Not started'
                          : exam.isActive
                          ? 'Expired'
                          : 'Inactive'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-muted px-2 py-1 font-mono text-sm font-semibold">
                          {exam.code}
                        </code>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyCode(exam.code)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <a
                          href={`${typeof window !== 'undefined' ? window.location.origin : ''}/exam/${exam.code}/register`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all hover:underline"
                          title={`Open registration for ${exam.code}`}
                        >
                          {`${typeof window !== 'undefined' ? window.location.origin : ''}/exam/${exam.code}/register`}
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyLink(`${typeof window !== 'undefined' ? window.location.origin : ''}/exam/${exam.code}/register`)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>{exam.questionCount ?? exam.questions?.length ?? 0} questions · {exam.settings?.duration ?? 'N/A'} min</p>
                      <p>{exam.settings?.marksPerQuestion ?? 'N/A'} marks/q · {exam.settings?.negativeMarks ?? 'N/A'} negative</p>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/admin/exam/${exam.id}`)}>
                        <BarChart3 className="mr-1 h-3.5 w-3.5" /> Manage
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEyeAction(exam)}
                      >
                        {getExamStatus(exam) === 'active' ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(exam.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
