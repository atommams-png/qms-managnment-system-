import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getAdminSession, getExam, addQuestion, updateQuestion, deleteQuestion, getCandidates, getResults, getAttempts, exportResultsCSV } from '@/lib/store';
import { Exam, ExamResult, Candidate, ExamAttempt } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2, Download, Copy, Edit, Settings, Upload, FileText, Eye, CheckCircle2, XCircle, MinusCircle, HelpCircle, Sparkles, LayoutGrid, Table as TableIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, BarChart3, FileQuestion } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ImageUploadInput } from '@/components/ImageUploadInput';
import { exportExamResultsToExcel, previewQuestionsFromExcel, downloadQuestionsTemplate } from '@/lib/excelUtils';
import { exportExamDetailedPdfReport } from '@/lib/pdfUtils';
import { formatExamScheduleDateTime } from '@/lib/dateUtils';
import Header from '@/components/Header';
import { ExamResults3DAnalytics } from '@/components/ExamResults3DAnalytics';

const ExamManage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<Exam | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('questions');
  const [questionType, setQuestionType] = useState<'mcq' | 'mcq-image' | 'true-false' | 'reading-comprehension'>('mcq');
  const [questionText, setQuestionText] = useState('');
  const [questionImage, setQuestionImage] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [optionImages, setOptionImages] = useState(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState(0);
  const [questionMarks, setQuestionMarks] = useState(1);
  const [useQuestionNegativeMarks, setUseQuestionNegativeMarks] = useState(false);
  const [questionNegativeMarks, setQuestionNegativeMarks] = useState('');
  const [questionSection, setQuestionSection] = useState('');
  const [passage, setPassage] = useState('');
  const [passageGroupId, setPassageGroupId] = useState('');
  const [linkToPreviousPassage, setLinkToPreviousPassage] = useState(false);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState<any[]>([]);
  const [previewInvalidRows, setPreviewInvalidRows] = useState<{ rowNumber: number; reason: string }[]>([]);

  // Filter states
  const [filterAttempted, setFilterAttempted] = useState<'all' | 'attempted' | 'notAttempted'>('all');
  const [filterPercentageMin, setFilterPercentageMin] = useState<number>(0);
  const [filterPercentageMax, setFilterPercentageMax] = useState<number>(100);
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [filterCollege, setFilterCollege] = useState<string>('');
  const [filterSection, setFilterSection] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [resultsViewMode, setResultsViewMode] = useState<'table' | 'card' | 'graph'>('table');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(24);
  const [selectedCandidateForQAnalysis, setSelectedCandidateForQAnalysis] = useState<{ candidate: Candidate; attempt?: ExamAttempt; result?: ExamResult } | null>(null);

  // Export dialog states
  const [showExportDialog, setShowExportDialog] = useState<boolean>(false);
  const [exportAllData, setExportAllData] = useState<boolean>(false);
  const [exportColumns, setExportColumns] = useState<Set<string>>(new Set([
    'name', 'email', 'college', 'usn', 'department', 'section', 'attempted',
    'tabSwitches', 'sectionWise', 'questionWise', 'correct', 'wrong', 'score', 'percentage'
  ]));

  const questionFileRef = useRef<HTMLInputElement>(null);
  const imageUploadSectionRef = useRef<HTMLDivElement>(null);
  const formSectionRef = useRef<HTMLDivElement>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);

  const getEditingQuestionNumber = () => {
    if (!exam || !editingQuestionId) return null;
    const index = exam.questions.findIndex(q => q.id === editingQuestionId);
    return index !== -1 ? index + 1 : null;
  };

  useEffect(() => {
    if (window.location.hash === '#schedule') {
      scheduleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const refresh = async () => {
    setIsLoading(true);
    if (!id) {
      setExam(null);
      setIsLoading(false);
      return;
    }
    try {
      const e = await getExam(id);
      if (!e) {
        setExam(null);
      } else {
        setExam({
          ...e,
          questions: Array.isArray(e.questions) ? e.questions : [],
          settings: e.settings || {
            duration: 30,
            marksPerQuestion: 1,
            negativeMarks: 0,
            showResult: true,
            randomOrder: true,
            fullscreenMode: true,
            tabSwitchDetection: true,
            maxTabSwitches: 3,
            navigationPanel: true,
            questionTimer: 0,
          },
        });
      }
      const results = await getResults(id);
      setResults(results);
      const candidates = await getCandidates(id);
      setCandidates(candidates);
      const exAttempts = await getAttempts(id);
      setAttempts(exAttempts);
    } catch (error) {
      console.error('Failed to load exam details:', error);
      setExam(null);
      setResults([]);
      setCandidates([]);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setQuestionText('');
    setQuestionImage('');
    setOptions(['', '', '', '']);
    setOptionImages(['', '', '', '']);
    setCorrectAnswer(0);
    setQuestionType('mcq');
    setQuestionMarks(1);
    setUseQuestionNegativeMarks(false);
    setQuestionNegativeMarks('');
    setQuestionSection('');
    setPassage('');
    setPassageGroupId('');
    setLinkToPreviousPassage(false);
  };

  const getAttemptsList = () => {
    return attempts;
  };

  const getSectionScoresText = (attempt: ExamAttempt) => {
    if (!exam) return '';

    const examNegativeMarks = exam.settings?.negativeMarks ?? 0;
    const sections = new Map<string, { total: number; obtained: number }>();

    exam.questions.forEach(q => {
      const section = (q.section && String(q.section).trim()) || '';
      if (!section) return; // Only process sections that were explicitly mentioned

      const entry = sections.get(section) ?? { total: 0, obtained: 0 };
      const marks = q.marks || 1;
      entry.total += marks;

      const ans = attempt.answers.find(a => a.questionId === q.id);
      if (ans && ans.selectedAnswer !== null && ans.selectedAnswer !== undefined) {
        if (ans.selectedAnswer === q.correctAnswer) {
          entry.obtained += marks;
        } else {
          entry.obtained -= q.negativeMarks ?? examNegativeMarks;
        }
      }

      sections.set(section, entry);
    });

    if (sections.size === 0) return '-';

    return Array.from(sections.entries())
      .map(([section, { total, obtained }]) => {
        const positiveObtained = Math.max(0, obtained);
        const percent = total > 0 ? Math.round((positiveObtained / total) * 100) : 0;
        return `${section}: ${positiveObtained}/${total} (${percent}%)`;
      })
      .join(' | ');
  };

  const getSectionScoresData = (attempt: ExamAttempt) => {
    if (!exam) return [];

    const examNegativeMarks = exam.settings?.negativeMarks ?? 0;
    const sections = new Map<string, { total: number; obtained: number }>();

    exam.questions.forEach(q => {
      const section = (q.section && String(q.section).trim()) || '';
      if (!section) return;

      const entry = sections.get(section) ?? { total: 0, obtained: 0 };
      const marks = q.marks || 1;
      entry.total += marks;

      const ans = attempt.answers.find(a => a.questionId === q.id);
      if (ans && ans.selectedAnswer !== null && ans.selectedAnswer !== undefined) {
        if (ans.selectedAnswer === q.correctAnswer) {
          entry.obtained += marks;
        } else {
          entry.obtained -= q.negativeMarks ?? examNegativeMarks;
        }
      }

      sections.set(section, entry);
    });

    return Array.from(sections.entries()).map(([section, { total, obtained }]) => {
      const positiveObtained = Math.max(0, obtained);
      const percent = total > 0 ? Math.round((positiveObtained / total) * 100) : 0;
      return {
        section,
        obtained: positiveObtained,
        total,
        percent,
      };
    });
  };

  const formatDateTimeDDMMYYYY = (value?: string | null) => {
    if (!value) return 'Not scheduled';
    const date = new Date(value);
    if (isNaN(date.getTime())) return 'Not scheduled';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const time = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    return `${day}/${month}/${year}, ${time}`;
  };

  const formatAttemptTime = (attempt: ExamAttempt | undefined) => {
    if (!attempt) return '';
    const iso = attempt.submittedAt || attempt.startedAt;
    if (!iso) return '';
    const formatted = formatDateTimeDDMMYYYY(iso);
    return formatted === 'Not scheduled' ? '' : formatted;
  };

  const getSubmissionStatus = (attempt: ExamAttempt | undefined) => {
    if (!attempt) return 'Normal Submit';
    const maxTabSwitches = exam?.settings?.maxTabSwitches ?? 0;

    if (maxTabSwitches > 0 && attempt.tabSwitches >= maxTabSwitches) {
      return 'Limit Exceeded';
    }

    return 'Normal Submit';
  };

  const getFilteredCandidates = () => {
    return candidates.filter(candidate => {
      const result = results.find(r => r.candidateId === candidate.id);
      const attempt = result ? getAttemptsList().find(a => a.id === result.attemptId) : undefined;

      // Filter by attempt status
      if (filterAttempted === 'attempted' && !attempt) return false;
      if (filterAttempted === 'notAttempted' && attempt) return false;

      // Filter by percentage range
      if (result && (result.percentage < filterPercentageMin || result.percentage > filterPercentageMax)) {
        return false;
      }

      // Filter by department
      if (filterDepartment && candidate.department !== filterDepartment) return false;

      // Filter by college
      if (filterCollege && candidate.college !== filterCollege) return false;

      // Filter by section
      if (filterSection && candidate.section !== filterSection) return false;

      // Filter by search (name and email)
      if (filterSearch) {
        const searchTerm = filterSearch.toLowerCase();
        if (!candidate.name.toLowerCase().includes(searchTerm) &&
          !candidate.email.toLowerCase().includes(searchTerm)) {
          return false;
        }
      }

      return true;
    });
  };

  const getUniqueValues = (field: 'department' | 'college' | 'section') => {
    const values = new Set<string>();
    candidates.forEach(c => {
      const value = c[field];
      if (value) values.add(value);
    });
    return Array.from(values).sort();
  };

  const resetFilters = () => {
    setFilterAttempted('all');
    setFilterPercentageMin(0);
    setFilterPercentageMax(100);
    setFilterDepartment('');
    setFilterCollege('');
    setFilterSection('');
    setFilterSearch('');
  };

  useEffect(() => {
    if (!getAdminSession()) { navigate('/admin'); return; }
    refresh();
  }, [id, navigate]);

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !questionText.trim()) { toast.error('Enter question text'); return; }

    // Validate options based on question type
    if (questionType === 'true-false') {
      if (!options[0]?.trim() || !options[1]?.trim()) { toast.error('Fill all True/False options'); return; }
    } else {
      if (options.some(o => !o.trim())) { toast.error('Fill all options'); return; }
    }

    if (questionType === 'reading-comprehension' && !passage.trim() && !linkToPreviousPassage) { toast.error('Enter passage or link to previous passage'); return; }
    if (questionMarks <= 0) { toast.error('Marks must be greater than 0'); return; }
    if (useQuestionNegativeMarks) {
      const parsedNegative = Number(questionNegativeMarks);
      if (!Number.isFinite(parsedNegative) || parsedNegative < 0) {
        toast.error('Negative marks must be 0 or greater');
        return;
      }
    }

    const passageText = questionType === 'reading-comprehension' ? passage.trim() : undefined;
    const groupId = questionType === 'reading-comprehension' && linkToPreviousPassage ? passageGroupId : undefined;
    const questionNegativeMarksValue = useQuestionNegativeMarks ? Number(questionNegativeMarks) : null;
    const trimmedOptions = questionType === 'true-false'
      ? options.slice(0, 2).map(o => o.trim())
      : options.map(o => o.trim());

    try {
      if (isEditing && editingQuestionId) {
        await updateQuestion(id, editingQuestionId, questionType, questionText.trim(), trimmedOptions, correctAnswer, questionImage || undefined, optionImages.some(img => img.trim()) ? optionImages : undefined, questionMarks, questionNegativeMarksValue, questionSection || undefined, passageText, groupId);
        toast.success('Question updated');
        handleCancelEdit();
      } else {
        await addQuestion(id, questionType, questionText.trim(), trimmedOptions, correctAnswer, questionImage || undefined, optionImages.some(img => img.trim()) ? optionImages : undefined, questionMarks, questionNegativeMarksValue, questionSection || undefined, passageText, groupId);
        toast.success('Question added');
        resetForm();
      }
      await refresh();
    } catch (error) {
      console.error('Error adding/updating question:', error);
      toast.error('Failed to add question');
    }
  };

  const handleQuestionTypeChange = (newType: string) => {
    setQuestionType(newType as any);

    // Reset options and correct answer based on question type
    if (newType === 'true-false') {
      // Auto-fill exactly two options for True/False
      setOptions(['True', 'False']);
      setCorrectAnswer(0);
      setQuestionImage('');
      setOptionImages(['', '', '', '']);
    } else if (newType === 'mcq' || newType === 'mcq-image') {
      // Reset to 4 empty MCQ options
      setOptions(['', '', '', '']);
      setOptionImages(['', '', '', '']);
      setCorrectAnswer(0);
      // For mcq-image, don't clear questionImage
      if (newType === 'mcq') {
        setQuestionImage('');
      }
    } else if (newType === 'reading-comprehension') {
      // Reset to 4 options for reading comp
      setOptions(['', '', '', '']);
      setOptionImages(['', '', '', '']);
      setCorrectAnswer(0);
      setQuestionImage('');
    }
  };

  const handleEditQuestion = (qid: string) => {
    const question = exam?.questions.find(q => q.id === qid);
    if (!question) return;

    const normalizedOptions = question.type === 'true-false'
      ? (Array.isArray(question.options)
        ? [...question.options.slice(0, 2), ...Array(Math.max(0, 2 - question.options.length)).fill('')]
        : ['True', 'False'])
      : (Array.isArray(question.options)
        ? [...question.options.slice(0, 4), ...Array(Math.max(0, 4 - question.options.length)).fill('')]
        : ['', '', '', '']);
    const normalizedOptionImages = Array.isArray(question.optionImages)
      ? [...question.optionImages.slice(0, 4), ...Array(Math.max(0, 4 - question.optionImages.length)).fill('')]
      : ['', '', '', ''];

    setIsEditing(true);
    setEditingQuestionId(qid);
    setQuestionType(question.type as any);
    setQuestionText(question.text);
    setQuestionImage(question.imageUrl || '');
    setOptions(normalizedOptions);
    setOptionImages(normalizedOptionImages);
    setCorrectAnswer(Number(question.correctAnswer) || 0);
    setQuestionMarks(Number(question.marks) || 1);
    if (question.negativeMarks === null || question.negativeMarks === undefined) {
      setUseQuestionNegativeMarks(false);
      setQuestionNegativeMarks('');
    } else {
      setUseQuestionNegativeMarks(true);
      setQuestionNegativeMarks(String(question.negativeMarks));
    }
    setQuestionSection(question.section || '');
    setPassage(question.passage || '');
    setPassageGroupId(question.passageGroupId || '');
    setLinkToPreviousPassage(!!question.passageGroupId);

    // Scroll to form section after state updates
    setTimeout(() => {
      formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingQuestionId(null);
    resetForm();
  };

  const handleDeleteQ = async (qid: string) => {
    if (!id) return;
    try {
      const ok = await deleteQuestion(id, qid);
      if (!ok) {
        toast.error('Failed to delete question');
        return;
      }
      toast.success('Question deleted');
      await refresh();
      if (editingQuestionId === qid) {
        handleCancelEdit();
      }
    } catch (error) {
      console.error('Error deleting question:', error);
      toast.error('Failed to delete question');
    }
  };

  const handleExport = async () => {
    if (!id || !exam) return;
    const attempts = getAttemptsList();

    // Determine which candidates and results to export
    let candidatesToExport = candidates;
    let resultsToExport = results;

    if (!exportAllData) {
      candidatesToExport = getFilteredCandidates();
      resultsToExport = results.filter(r => candidatesToExport.some(c => c.id === r.candidateId));
    }

    if (resultsToExport.length === 0 && !exportAllData) {
      toast.error('No results to export with current filters');
      return;
    }

    // Convert columns set to array for export function
    const columnsArray = Array.from(exportColumns);

    await exportExamResultsToExcel(exam, candidatesToExport, resultsToExport, attempts, columnsArray);
    toast.success('Results exported to Excel with detailed analytics');
    setShowExportDialog(false);
  };

  const handleExportPdf = async (customFiltered?: boolean) => {
    if (!id || !exam) return;
    const attempts = getAttemptsList();

    const isFiltered = customFiltered !== undefined ? customFiltered : (!exportAllData && showFilters);
    const candidatesToExport = isFiltered ? getFilteredCandidates() : candidates;

    if (candidatesToExport.length === 0) {
      toast.error('No candidates found to include in the PDF report');
      return;
    }

    const toastId = toast.loading('Generating comprehensive exam PDF report...');
    try {
      await exportExamDetailedPdfReport(exam, candidates, results, attempts, {
        filteredCandidates: candidatesToExport,
        isFiltered,
      });
      toast.success('Complete PDF Report downloaded successfully!', { id: toastId });
      setShowExportDialog(false);
    } catch (err) {
      console.error('PDF Export Error:', err);
      toast.error('Failed to generate PDF report: ' + ((err as Error).message || 'Unknown error'), { id: toastId });
    }
  };

  const toggleExportColumn = (column: string) => {
    const newColumns = new Set(exportColumns);
    if (newColumns.has(column)) {
      newColumns.delete(column);
    } else {
      newColumns.add(column);
    }
    setExportColumns(newColumns);
  };



  const handleImportQuestions = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    try {
      const preview = await previewQuestionsFromExcel(file);
      setPreviewQuestions(preview.validQuestions);
      setPreviewInvalidRows(preview.invalidRows);
      setShowImportPreview(true);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleConfirmImport = async () => {
    if (!id) return;

    setIsImporting(true);
    try {
      let successCount = 0;
      let failedCount = 0;

      for (const q of previewQuestions) {
        try {
          const created = await addQuestion(
            id,
            q.type || 'mcq',
            q.text,
            q.options,
            q.correctAnswer,
            undefined,
            undefined,
            q.marks || 1,
            null,
            q.section
          );
          if (created) {
            successCount++;
          } else {
            failedCount++;
          }
        } catch (err) {
          console.error('Error adding question:', err);
          failedCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Imported ${successCount} questions successfully`);
      }
      if (failedCount > 0) {
        toast.error(`${failedCount} question(s) failed to import.`);
      }
      await refresh();
    } finally {
      setIsImporting(false);
      setShowImportPreview(false);
      setPreviewQuestions([]);
      setPreviewInvalidRows([]);
      if (questionFileRef.current) {
        questionFileRef.current.value = '';
      }
    }
  };

  const handleCancelImportPreview = () => {
    setShowImportPreview(false);
    setPreviewQuestions([]);
    setPreviewInvalidRows([]);
    if (questionFileRef.current) {
      questionFileRef.current.value = '';
    }
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center">Loading exam details...</div>;
  if (!exam) return (
    <div className="flex min-h-screen flex-col items-center justify-center space-y-3">
      <p className="text-muted-foreground">Exam not found or may have been deleted.</p>
      <Button onClick={() => navigate('/admin/dashboard')}>Back to Dashboard</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-green-50 to-green-100 border-b border-green-200">
        <Header
          title={exam.name}
          leftChildren={
            <div className="flex items-center gap-2 text-sm text-muted-foreground ml-4">
              <span>Code:</span>
              <code className="font-mono font-semibold text-green-700">{exam.code}</code>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { navigator.clipboard.writeText(exam.code); toast.success('Copied!'); }}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          }
        >
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/admin/exam/${id}/edit-details`)}>
            <Settings className="mr-1.5 h-4 w-4" /> Edit Details
          </Button>
        </Header>
      </div>

      <main className="max-w-4xl mx-auto px-4 lg:max-w-[1600px] py-8 mt-4 animate-fade-in">
        <div ref={scheduleRef} />
        <Card className="border-green-200 shadow-md mb-6">
          <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 border-b border-green-200">
            <CardTitle className="text-green-900">Exam Schedule</CardTitle>
            <CardDescription className="text-green-700">Current exam window</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2 pt-6">
            <div className="rounded-lg bg-green-50 p-4 border border-green-200">
              <p className="text-xs font-semibold text-green-700 uppercase">Start</p>
              <p className="font-semibold text-green-900 mt-1">{formatExamScheduleDateTime(exam.startDateTime)}</p>
            </div>
            <div className="rounded-lg bg-green-50 p-4 border border-green-200">
              <p className="text-xs font-semibold text-green-700 uppercase">End</p>
              <p className="font-semibold text-green-900 mt-1">{formatExamScheduleDateTime(exam.endDateTime)}</p>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <TabsList className="bg-emerald-50/90 border-2 border-emerald-200 p-1.5 rounded-xl h-auto flex gap-2 shadow-sm">
              <TabsTrigger
                value="questions"
                className="px-5 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-emerald-950 data-[state=inactive]:hover:bg-emerald-100/80 cursor-pointer"
              >
                <span>Questions</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold transition-colors ${activeTab === 'questions' ? 'bg-white/25 text-white shadow-sm' : 'bg-emerald-200 text-emerald-900'}`}>
                  {exam.questions.length}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="participants"
                className="px-5 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-emerald-950 data-[state=inactive]:hover:bg-emerald-100/80 cursor-pointer"
              >
                <span>Results Sheet</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold transition-colors ${activeTab === 'participants' ? 'bg-white/25 text-white shadow-sm' : 'bg-emerald-200 text-emerald-900'}`}>
                  {Math.max(candidates.length, results.length)}
                </span>
              </TabsTrigger>
            </TabsList>

            {activeTab === 'questions' && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => questionFileRef.current?.click()}
                  disabled={isImporting}
                  className="bg-primary text-white hover:bg-primary/90 shadow-sm"
                >
                  <Upload className="mr-1.5 h-4 w-4" /> Import Questions
                </Button>
                <Button
                  size="sm"
                  onClick={downloadQuestionsTemplate}
                  className="bg-primary text-white hover:bg-primary/90 shadow-sm"
                >
                  <FileText className="mr-1.5 h-4 w-4" /> Question Template
                </Button>
              </div>
            )}

            {activeTab === 'participants' && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  {showFilters ? 'Hide' : 'Show'} Filters
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowExportDialog(true)}
                  disabled={candidates.length === 0}
                  className="bg-primary text-white hover:bg-primary/90 shadow-sm"
                >
                  <Download className="mr-1.5 h-4 w-4" /> Export Excel
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleExportPdf(false)}
                  disabled={candidates.length === 0}
                  className="bg-[#008037] text-white hover:bg-black shadow-sm font-bold flex items-center gap-1.5"
                >
                  <FileText className="h-4 w-4" /> Export PDF Report
                </Button>
              </div>
            )}
          </div>

          <TabsContent value="questions" className="space-y-6">
            <input
              ref={questionFileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportQuestions}
              style={{ display: 'none' }}
            />

            {showImportPreview && (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                  <CardHeader>
                    <CardTitle>Import Preview</CardTitle>
                    <CardDescription>
                      Valid rows: {previewQuestions.length} | Invalid rows: {previewInvalidRows.length}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-md border p-3 bg-muted/30">
                      <p className="text-sm font-medium">Only valid rows will be imported.</p>
                    </div>

                    {previewInvalidRows.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-destructive">Invalid Rows</p>
                        <div className="max-h-48 overflow-y-auto rounded border">
                          <table className="w-full text-sm">
                            <thead className="bg-muted">
                              <tr>
                                <th className="px-3 py-2 text-left">Excel Row</th>
                                <th className="px-3 py-2 text-left">Reason</th>
                              </tr>
                            </thead>
                            <tbody>
                              {previewInvalidRows.map((row, i) => (
                                <tr key={`${row.rowNumber}-${i}`} className="border-t">
                                  <td className="px-3 py-2">{row.rowNumber}</td>
                                  <td className="px-3 py-2">{row.reason}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <p className="text-sm font-semibold">Sample Valid Questions</p>
                      <div className="max-h-48 overflow-y-auto rounded border">
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              <th className="px-3 py-2 text-left">Question</th>
                              <th className="px-3 py-2 text-left">Type</th>
                              <th className="px-3 py-2 text-left">Correct</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewQuestions.slice(0, 10).map((q, i) => (
                              <tr key={`preview-${i}`} className="border-t">
                                <td className="px-3 py-2">{q.text}</td>
                                <td className="px-3 py-2">{q.type}</td>
                                <td className="px-3 py-2">{String.fromCharCode(65 + q.correctAnswer)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={handleCancelImportPreview} disabled={isImporting}>Cancel</Button>
                      <Button onClick={handleConfirmImport} disabled={isImporting || previewQuestions.length === 0}>
                        {isImporting ? 'Importing...' : `Import ${previewQuestions.length} Questions`}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            {/* 2-Column Authoring Section: Form on Left, Preview + Questions on Right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Form (5 cols on lg, sticky) */}
              <div ref={formSectionRef} className="lg:col-span-5 space-y-4 lg:sticky lg:top-6">
                <Card className={`transition-all shadow-sm ${isEditing ? 'border-amber-400 dark:border-amber-600 ring-1 ring-amber-400/30' : 'border-border'}`}>
                  <CardHeader className={`${isEditing ? 'bg-amber-50/50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800/50' : 'bg-muted/40 border-b'} pb-3`}>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        {isEditing ? <Edit className="h-4 w-4 text-amber-600" /> : <Plus className="h-4 w-4 text-primary" />}
                        {isEditing ? `Edit Question ${getEditingQuestionNumber() ? `#${getEditingQuestionNumber()}` : ''}` : 'Add Question'}
                      </CardTitle>
                      {isEditing && (
                        <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300 font-medium">
                          Editing Mode
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs">
                      {isEditing ? 'Make your adjustments below and click Update Question' : 'Enter question details, options, and select the correct answer'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <form onSubmit={handleAddQuestion} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Question Type</Label>
                        <select value={questionType} onChange={e => handleQuestionTypeChange(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                          <option value="mcq">MCQ (Multiple Choice)</option>
                          <option value="mcq-image">MCQ with Images</option>
                          <option value="true-false">True/False</option>
                          <option value="reading-comprehension">Reading Comprehension</option>
                        </select>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Section (Optional)</Label>
                          <Input placeholder="e.g., Python, Java, Reading Comprehension" value={questionSection} onChange={e => setQuestionSection(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Marks</Label>
                          <Input type="number" min="1" placeholder="Marks for this question" value={questionMarks} onChange={e => setQuestionMarks(Math.max(1, parseInt(e.target.value) || 1))} required />
                        </div>
                      </div>
                      <div className="space-y-3 rounded-md border border-border p-3">
                        <div className="flex items-center gap-2">
                          <input
                            id="questionNegativeToggle"
                            type="checkbox"
                            checked={useQuestionNegativeMarks}
                            onChange={e => {
                              setUseQuestionNegativeMarks(e.target.checked);
                              if (!e.target.checked) {
                                setQuestionNegativeMarks('');
                              }
                            }}
                            className="rounded"
                          />
                          <Label htmlFor="questionNegativeToggle" className="cursor-pointer">Set negative marks for this question</Label>
                        </div>
                        {useQuestionNegativeMarks && (
                          <div className="space-y-2">
                            <Label>Question Negative Marks</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.25"
                              placeholder={`Exam default: ${exam.settings?.negativeMarks ?? 0}`}
                              value={questionNegativeMarks}
                              onChange={e => setQuestionNegativeMarks(e.target.value)}
                            />
                          </div>
                        )}
                        {!useQuestionNegativeMarks && (
                          <p className="text-xs text-muted-foreground">
                            Using exam-level negative marks: {exam.settings?.negativeMarks ?? 0}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>{questionType === 'reading-comprehension' ? 'Question (about the passage)' : 'Question Text'}</Label>
                        <Input placeholder={questionType === 'reading-comprehension' ? "e.g., Which of the following..." : "Enter question text"} value={questionText} onChange={e => setQuestionText(e.target.value)} required />
                      </div>
                      {questionType === 'reading-comprehension' && (
                        <div className="space-y-3 border border-border rounded p-3">
                          <div className="flex items-center gap-2">
                            <input type="checkbox" id="linkPassage" checked={linkToPreviousPassage} onChange={e => {
                              setLinkToPreviousPassage(e.target.checked);
                              if (e.target.checked) setPassage('');
                            }} className="rounded" />
                            <Label htmlFor="linkPassage" className="cursor-pointer">Use same passage from previous question</Label>
                          </div>
                          {linkToPreviousPassage && exam ? (() => {
                            const prevRCQuestions = exam.questions.filter((q, idx) => q.type === 'reading-comprehension' && q.passage);
                            const uniquePassages = Array.from(new Map(prevRCQuestions.map(q => [q.passageGroupId || q.id, q])).values());
                            return (
                              <div className="space-y-2">
                                <Label>Select Passage</Label>
                                <select value={passageGroupId} onChange={e => {
                                  const q = prevRCQuestions.find(pq => (pq.passageGroupId || pq.id) === e.target.value);
                                  if (q) {
                                    setPassageGroupId(q.passageGroupId || q.id);
                                    setPassage(q.passage || '');
                                  }
                                }} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                                  <option value="">Select a passage...</option>
                                  {uniquePassages.map((q, i) => (
                                    <option key={q.passageGroupId || q.id} value={q.passageGroupId || q.id}>
                                      Passage {i + 1}: {q.passage?.substring(0, 50)}...
                                    </option>
                                  ))}
                                </select>
                                {passage && <div className="p-2 bg-muted rounded text-sm max-h-24 overflow-y-auto">{passage}</div>}
                              </div>
                            );
                          })() : (
                            <div className="space-y-2">
                              <Label>Passage Text</Label>
                              <textarea placeholder="Enter the reading passage here" value={passage} onChange={e => setPassage(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-32" />
                            </div>
                          )}
                        </div>
                      )}
                      {(questionType === 'mcq' || questionType === 'mcq-image') && (
                        <div ref={imageUploadSectionRef} className="space-y-2">
                          <Label>Question Image {questionType === 'mcq-image' && '(Required for MCQ with Images)'}</Label>
                          <div className="space-y-2">
                            <Input placeholder="Enter image URL or upload a file" value={questionImage} onChange={e => setQuestionImage(e.target.value)} required={questionType === 'mcq-image'} />
                            <ImageUploadInput label="Or upload question image" value={questionImage && questionImage.startsWith('data:') ? questionImage : ''} onChange={setQuestionImage} />
                          </div>
                          {questionImage && <img src={questionImage} alt="Question preview" className="h-32 w-auto rounded border" onError={() => toast.error('Failed to load image')} />}
                        </div>
                      )}
                      {(questionType === 'mcq' || questionType === 'mcq-image') && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {options.map((opt, i) => (
                            <div key={i} className="space-y-1">
                              <Label className="flex items-center gap-2">
                                <input type="radio" name="correct" checked={correctAnswer === i} onChange={() => setCorrectAnswer(i)} className="accent-primary" />
                                Option {String.fromCharCode(65 + i)} {correctAnswer === i && <Badge variant="outline" className="text-xs">Correct</Badge>}
                              </Label>
                              <Input placeholder={`Option ${String.fromCharCode(65 + i)} text`} value={opt} onChange={e => { const n = [...options]; n[i] = e.target.value; setOptions(n); }} />
                              {questionType === 'mcq-image' && <ImageUploadInput label={`Option ${String.fromCharCode(65 + i)} image`} value={optionImages[i]} onChange={e => { const n = [...optionImages]; n[i] = e; setOptionImages(n); }} />}
                            </div>
                          ))}
                        </div>
                      )}
                      {questionType === 'true-false' && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="flex items-center gap-2">
                              <input type="radio" name="correct" checked={correctAnswer === 0} onChange={() => setCorrectAnswer(0)} className="accent-primary" />
                              Option A {correctAnswer === 0 && <Badge variant="outline" className="text-xs">Correct</Badge>}
                            </Label>
                            <Input placeholder="Option A text" value={options[0]} onChange={e => { const n = [...options]; n[0] = e.target.value; setOptions(n); }} />
                          </div>
                          <div className="space-y-1">
                            <Label className="flex items-center gap-2">
                              <input type="radio" name="correct" checked={correctAnswer === 1} onChange={() => setCorrectAnswer(1)} className="accent-primary" />
                              Option B {correctAnswer === 1 && <Badge variant="outline" className="text-xs">Correct</Badge>}
                            </Label>
                            <Input placeholder="Option B text" value={options[1]} onChange={e => { const n = [...options]; n[1] = e.target.value; setOptions(n); }} />
                          </div>
                        </div>
                      )}
                      {questionType === 'reading-comprehension' && (
                        <div className="space-y-2">
                          <Label>Answer Options</Label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {options.map((opt, i) => (
                              <div key={i} className="space-y-1">
                                <Label className="flex items-center gap-2">
                                  <input type="radio" name="correct" checked={correctAnswer === i} onChange={() => setCorrectAnswer(i)} className="accent-primary" />
                                  Option {String.fromCharCode(65 + i)} {correctAnswer === i && <Badge variant="outline" className="text-xs">Correct</Badge>}
                                </Label>
                                <Input placeholder={`Option ${String.fromCharCode(65 + i)} text`} value={opt} onChange={e => { const n = [...options]; n[i] = e.target.value; setOptions(n); }} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button type="submit" className="flex-1">{isEditing ? 'Update Question' : <><Plus className="mr-1.5 h-4 w-4" /> Add Question</>}</Button>
                        {isEditing && <Button type="button" variant="outline" onClick={handleCancelEdit}>Cancel</Button>}
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Live Question Preview & Questions List (7 cols on lg) */}
              <div className="lg:col-span-7 space-y-6">
                <Card className="border-2 border-primary/30 shadow-md bg-card overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2 text-primary font-semibold">
                        <Eye className="h-4 w-4 text-primary" />
                        Live Question Preview
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300 font-medium">
                            Editing Q{getEditingQuestionNumber()}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30 flex items-center gap-1.5">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            Draft
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardDescription className="text-xs">
                      Live preview of how candidates will see this question
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    {/* Metadata Header Badges */}
                    <div className="flex items-center gap-2 flex-wrap pb-2 border-b border-border/60">
                      <Badge variant="outline" className="text-xs font-semibold bg-muted/50">
                        {questionType === 'mcq' && 'MCQ'}
                        {questionType === 'mcq-image' && 'MCQ + Images'}
                        {questionType === 'true-false' && 'True / False'}
                        {questionType === 'reading-comprehension' && 'Reading Comprehension'}
                      </Badge>

                      {questionSection.trim() && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          {questionSection.trim()}
                        </Badge>
                      )}

                      <Badge variant="secondary" className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200">
                        +{questionMarks} mark{questionMarks !== 1 ? 's' : ''}
                      </Badge>

                      <Badge variant="secondary" className="text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200">
                        -{useQuestionNegativeMarks ? (questionNegativeMarks !== '' ? questionNegativeMarks : (exam?.settings?.negativeMarks ?? 0)) : (exam?.settings?.negativeMarks ?? 0)} neg
                      </Badge>
                    </div>

                    {/* Reading Comprehension Passage Preview */}
                    {questionType === 'reading-comprehension' && (
                      <div className="p-3 bg-muted/70 rounded-md border text-sm max-h-48 overflow-y-auto">
                        <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <span>📖</span> Reading Passage
                        </p>
                        <p className="whitespace-pre-wrap text-sm text-foreground">
                          {passage.trim() || <span className="text-muted-foreground italic">Enter or select a passage on the left...</span>}
                        </p>
                      </div>
                    )}

                    {/* Question Text */}
                    <div className="space-y-1">
                      <p className="text-base font-medium text-foreground leading-relaxed">
                        <span className="font-bold text-primary mr-1">
                          Q{isEditing ? (getEditingQuestionNumber() ?? (exam?.questions.length ?? 0) + 1) : ((exam?.questions.length ?? 0) + 1)}.
                        </span>{' '}
                        {questionText.trim() ? (
                          questionText
                        ) : (
                          <span className="text-muted-foreground italic font-normal">
                            Question text will appear here as you type...
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Question Image Preview */}
                    {questionImage && (
                      <div className="rounded-lg border bg-muted/20 p-2 overflow-hidden flex justify-center">
                        <img
                          src={questionImage}
                          alt="Question preview"
                          className="max-h-48 w-auto rounded object-contain"
                          onError={() => { }}
                        />
                      </div>
                    )}

                    {/* Options Preview */}
                    <div className="space-y-2 pt-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Options:
                      </p>
                      <div className="grid gap-2 sm:grid-cols-1">
                        {(questionType === 'true-false' ? options.slice(0, 2) : options).map((opt, i) => {
                          const isCorrect = correctAnswer === i;
                          const optionLabel = String.fromCharCode(65 + i);
                          const fallbackText = questionType === 'true-false'
                            ? (i === 0 ? 'True' : 'False')
                            : `Option ${optionLabel} text`;
                          const optionImageSrc = optionImages[i];

                          return (
                            <div
                              key={i}
                              className={`p-3 rounded-lg border transition-all ${isCorrect
                                  ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/20 ring-1 ring-emerald-500/40'
                                  : 'border-border bg-card hover:bg-muted/20'
                                }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2.5 flex-1">
                                  <div
                                    className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${isCorrect
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'bg-muted text-muted-foreground border'
                                      }`}
                                  >
                                    {optionLabel}
                                  </div>
                                  <div className="flex-1 text-sm">
                                    <span className={isCorrect ? 'font-semibold text-emerald-950 dark:text-emerald-100' : 'text-foreground'}>
                                      {opt.trim() || <span className="text-muted-foreground italic">{fallbackText}</span>}
                                    </span>
                                    {questionType === 'mcq-image' && optionImageSrc && (
                                      <div className="mt-2">
                                        <img
                                          src={optionImageSrc}
                                          alt={`Option ${optionLabel}`}
                                          className="h-20 w-auto rounded border object-cover"
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {isCorrect && (
                                  <Badge className="bg-emerald-600 text-white text-[11px] font-semibold px-2 py-0.5 shrink-0 flex items-center gap-1 shadow-sm">
                                    <CheckCircle2 className="h-3 w-3" /> Correct
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Preview Info Summary */}
                    <div className="p-3 bg-muted/40 rounded-lg border text-xs text-muted-foreground flex items-center justify-between">
                      <span>
                        Key: <strong className="text-foreground">Option {String.fromCharCode(65 + correctAnswer)}</strong>
                      </span>
                      <span>
                        Value: <strong className="text-foreground">{questionMarks} mark{questionMarks !== 1 ? 's' : ''}</strong>
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Questions in Exam List Header & Content */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                        Questions in Exam
                        <Badge variant="secondary" className="font-semibold">{exam.questions.length}</Badge>
                      </h3>
                      <p className="text-xs text-muted-foreground">All questions currently assigned to this examination</p>
                    </div>
                  </div>

                  {exam.questions.length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center text-muted-foreground">No questions available yet. Add your first question above.</CardContent>
                    </Card>
                  ) : (() => {
                    const sections = new Map<string, any[]>();
                    exam.questions.forEach((q, idx) => {
                      const section = q.section || 'Unsorted';
                      if (!sections.has(section)) sections.set(section, []);
                      sections.get(section)!.push({ q, idx });
                    });

                    let globalQNum = 1;
                    return Array.from(sections.entries()).map(([section, questions]) => {
                      // Group questions by passageGroupId within each section
                      const passageGroups = new Map<string, any[]>();
                      const nonRCQuestions: any[] = [];

                      questions.forEach(item => {
                        if (item.q.type === 'reading-comprehension' && item.q.passageGroupId) {
                          const groupId = item.q.passageGroupId;
                          if (!passageGroups.has(groupId)) passageGroups.set(groupId, []);
                          passageGroups.get(groupId)!.push(item);
                        } else {
                          nonRCQuestions.push(item);
                        }
                      });

                      return (
                        <div key={section} className="space-y-4">
                          {section !== 'Unsorted' && (
                            <div className="border-l-4 border-primary pl-4">
                              <h3 className="text-lg font-semibold text-primary">{section}</h3>
                            </div>
                          )}

                          {/* Display passage groups */}
                          {Array.from(passageGroups.entries()).map(([groupId, groupQuestions]) => {
                            const passageText = groupQuestions[0]?.q.passage;
                            const passageQNum = globalQNum;
                            globalQNum += groupQuestions.length;

                            return (
                              <Card key={groupId} className="border-2 border-accent/30">
                                <CardContent className="pt-6">
                                  {/* Display passage once */}
                                  {passageText && (
                                    <div className="mb-6 p-4 bg-muted rounded-lg">
                                      <p className="font-semibold mb-2 text-sm">Reading Passage:</p>
                                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{passageText}</p>
                                    </div>
                                  )}

                                  {/* Display all questions for this passage */}
                                  <div className="space-y-4">
                                    {groupQuestions.map((item, passageQIdx) => {
                                      const q = item.q;
                                      const qNum = passageQNum + passageQIdx;
                                      return (
                                        <div key={q.id} className={passageQIdx > 0 ? 'border-t pt-4' : ''}>
                                          <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                <p className="font-medium">Q{qNum}. {q.text}</p>
                                                <Badge variant="outline" className="text-xs">Reading Comprehension</Badge>
                                                <Badge variant="secondary" className="text-xs">{q.marks} mark{q.marks !== 1 ? 's' : ''}</Badge>
                                                <Badge variant="secondary" className="text-xs">-{q.negativeMarks ?? exam.settings?.negativeMarks ?? 0} neg</Badge>
                                              </div>
                                              <div className="grid gap-1 sm:grid-cols-2 mt-2">
                                                {q.options.map((opt, j) => (
                                                  <div key={j} className={`text-sm ${j === q.correctAnswer ? 'font-semibold text-success' : 'text-muted-foreground'}`}>
                                                    <p>{String.fromCharCode(65 + j)}. {opt} {j === q.correctAnswer ? '(Correct)' : ''}</p>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                            <div className="flex gap-2">
                                              <Button variant="outline" size="icon" className="bg-primary text-white hover:bg-primary/90" onClick={() => handleEditQuestion(q.id)}>
                                                <Edit className="h-4 w-4 text-white" />
                                              </Button>
                                              <Button variant="ghost" size="icon" className="bg-destructive text-white hover:bg-destructive/90" onClick={() => handleDeleteQ(q.id)}>
                                                <Trash2 className="h-4 w-4 text-white" />
                                              </Button>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}

                          {/* Display non-grouped questions */}
                          {nonRCQuestions.map(({ q, idx }) => {
                            const qNum = globalQNum++;
                            return (
                              <Card key={q.id}>
                                <CardContent className="pt-6">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        <p className="font-medium">Q{qNum}. {q.text}</p>
                                        <Badge variant="outline" className="text-xs">
                                          {q.type === 'mcq' ? 'MCQ' : q.type === 'mcq-image' ? 'MCQ + Image' : q.type === 'true-false' ? 'True/False' : 'Reading Comprehension'}
                                        </Badge>
                                        <Badge variant="secondary" className="text-xs">{q.marks} mark{q.marks !== 1 ? 's' : ''}</Badge>
                                        <Badge variant="secondary" className="text-xs">-{q.negativeMarks ?? exam.settings?.negativeMarks ?? 0} neg</Badge>
                                      </div>
                                      {q.imageUrl && <img src={q.imageUrl} alt="Question" className="mt-2 h-32 w-auto rounded border" />}
                                      {q.type !== 'reading-comprehension' && (
                                        <div className="mt-2 grid gap-1 sm:grid-cols-2">
                                          {q.options.map((opt, j) => (
                                            <div key={j} className={`text-sm ${j === q.correctAnswer ? 'font-semibold text-success' : 'text-muted-foreground'}`}>
                                              <p>{String.fromCharCode(65 + j)}. {opt} {j === q.correctAnswer ? '(Correct)' : ''}</p>
                                              {q.optionImages?.[j] && <img src={q.optionImages[j]} alt={`Option ${String.fromCharCode(65 + j)}`} className="mt-1 h-20 w-auto rounded" />}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {q.type === 'reading-comprehension' && q.passage && (
                                        <div className="mt-2 space-y-3">
                                          <div className="p-3 bg-muted rounded text-sm">
                                            <p className="font-medium mb-2">Passage:</p>
                                            <p className="text-muted-foreground whitespace-pre-wrap">{q.passage}</p>
                                          </div>
                                          <div className="space-y-2">
                                            <p className="font-medium text-sm">{q.text}</p>
                                            <div className="grid gap-1 sm:grid-cols-2">
                                              {q.options.map((opt, j) => (
                                                <div key={j} className={`text-sm ${j === q.correctAnswer ? 'font-semibold text-success' : 'text-muted-foreground'}`}>
                                                  <p>{String.fromCharCode(65 + j)}. {opt} {j === q.correctAnswer ? '(Correct)' : ''}</p>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex gap-2">
                                      <Button variant="outline" size="icon" className="bg-primary text-white hover:bg-primary/90" onClick={() => handleEditQuestion(q.id)}>
                                        <Edit className="h-4 w-4 text-white" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="bg-destructive text-white hover:bg-destructive/90" onClick={() => handleDeleteQ(q.id)}>
                                        <Trash2 className="h-4 w-4 text-white" />
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="participants" className="space-y-6">
            {(() => {
              const filteredCandidates = getFilteredCandidates();
              const totalFiltered = filteredCandidates.length;
              const totalPages = Math.ceil(totalFiltered / pageSize) || 1;
              const paginatedCandidates = pageSize === -1
                ? filteredCandidates
                : filteredCandidates.slice((currentPage - 1) * pageSize, currentPage * pageSize);

              return (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Results Sheet</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Showing {totalFiltered > 0 ? (currentPage - 1) * pageSize + 1 : 0} - {Math.min(currentPage * pageSize, totalFiltered)} of {totalFiltered} candidates ({candidates.length} total)
                      </p>
                    </div>

                    {/* View Switcher Toggle & Page Size */}
                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-emerald-50/70 border border-emerald-200 px-2.5 py-1 rounded-xl">
                        <span className="font-semibold text-emerald-950">Show:</span>
                        <select
                          aria-label="Items per page"
                          value={pageSize}
                          onChange={(e) => {
                            setPageSize(Number(e.target.value));
                            setCurrentPage(1);
                          }}
                          className="bg-transparent font-bold text-emerald-900 focus:outline-none cursor-pointer text-xs"
                        >
                          <option value={12}>12 / page</option>
                          <option value={24}>24 / page</option>
                          <option value={48}>48 / page</option>
                          <option value={96}>96 / page</option>
                          <option value={200}>200 / page</option>
                          <option value={500}>500 / page</option>
                        </select>
                      </div>

                      <div className="flex items-center bg-emerald-50/90 border-2 border-emerald-200 p-1 rounded-xl shadow-sm">
                        <button
                          type="button"
                          onClick={() => setResultsViewMode('table')}
                          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${resultsViewMode === 'table'
                              ? 'bg-primary text-white shadow-sm'
                              : 'text-emerald-950 hover:bg-emerald-100/80'
                            }`}
                        >
                          <TableIcon className="h-4 w-4" />
                          <span>Table Form</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setResultsViewMode('card')}
                          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${resultsViewMode === 'card'
                              ? 'bg-primary text-white shadow-sm'
                              : 'text-emerald-950 hover:bg-emerald-100/80'
                            }`}
                        >
                          <LayoutGrid className="h-4 w-4" />
                          <span>Card Form</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setResultsViewMode('graph')}
                          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${resultsViewMode === 'graph'
                              ? 'bg-primary text-white shadow-sm'
                              : 'text-emerald-950 hover:bg-emerald-100/80'
                            }`}
                        >
                          <BarChart3 className="h-4 w-4" />
                          <span>3D Graphs & Analytics</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {showFilters && (
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="pt-6">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                          {/* Search */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Search (Name/Email)</Label>
                            <Input
                              placeholder="Search..."
                              value={filterSearch}
                              onChange={(e) => {
                                setFilterSearch(e.target.value);
                                setCurrentPage(1);
                              }}
                              className="h-8 text-sm"
                            />
                          </div>

                          {/* Attempt Status */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Attempt Status</Label>
                            <select
                              aria-label="Filter by attempt status"
                              value={filterAttempted}
                              onChange={(e) => {
                                setFilterAttempted(e.target.value as any);
                                setCurrentPage(1);
                              }}
                              className="h-8 w-full rounded-md border border-border bg-white px-2 text-sm"
                            >
                              <option value="all">All</option>
                              <option value="attempted">Attempted</option>
                              <option value="notAttempted">Not Attempted</option>
                            </select>
                          </div>

                          {/* Department */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Department</Label>
                            <select
                              aria-label="Filter by department"
                              value={filterDepartment}
                              onChange={(e) => {
                                setFilterDepartment(e.target.value);
                                setCurrentPage(1);
                              }}
                              className="h-8 w-full rounded-md border border-border bg-white px-2 text-sm"
                            >
                              <option value="">All</option>
                              {getUniqueValues('department').map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                              ))}
                            </select>
                          </div>

                          {/* College */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">College</Label>
                            <select
                              aria-label="Filter by college"
                              value={filterCollege}
                              onChange={(e) => {
                                setFilterCollege(e.target.value);
                                setCurrentPage(1);
                              }}
                              className="h-8 w-full rounded-md border border-border bg-white px-2 text-sm"
                            >
                              <option value="">All</option>
                              {getUniqueValues('college').map(college => (
                                <option key={college} value={college}>{college}</option>
                              ))}
                            </select>
                          </div>

                          {/* Section */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Section</Label>
                            <select
                              aria-label="Filter by section"
                              value={filterSection}
                              onChange={(e) => {
                                setFilterSection(e.target.value);
                                setCurrentPage(1);
                              }}
                              className="h-8 w-full rounded-md border border-border bg-white px-2 text-sm"
                            >
                              <option value="">All</option>
                              {getUniqueValues('section').map(section => (
                                <option key={section} value={section}>{section}</option>
                              ))}
                            </select>
                          </div>

                          {/* Percentage Range - Min */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Min Score %</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={filterPercentageMin}
                              onChange={(e) => {
                                setFilterPercentageMin(parseInt(e.target.value) || 0);
                                setCurrentPage(1);
                              }}
                              className="h-8 text-sm"
                            />
                          </div>

                          {/* Percentage Range - Max */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Max Score %</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={filterPercentageMax}
                              onChange={(e) => {
                                setFilterPercentageMax(parseInt(e.target.value) || 100);
                                setCurrentPage(1);
                              }}
                              className="h-8 text-sm"
                            />
                          </div>

                          {/* Reset Button */}
                          <div className="flex items-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                resetFilters();
                                setCurrentPage(1);
                              }}
                              className="w-full h-8 text-sm"
                            >
                              Reset Filters
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {(candidates.length === 0 && results.length === 0) ? (
                    <Card><CardContent className="py-12 text-center text-muted-foreground">No participants yet</CardContent></Card>
                  ) : totalFiltered === 0 ? (
                    <Card className="shadow-sm border-dashed">
                      <CardContent className="py-12 text-center">
                        <p className="text-muted-foreground font-medium">No candidates match the current filter criteria.</p>
                        <Button variant="outline" size="sm" onClick={() => { resetFilters(); setCurrentPage(1); }} className="mt-3">
                          Reset Filters
                        </Button>
                      </CardContent>
                    </Card>
                  ) : resultsViewMode === 'table' ? (
                    /* Table Form View */
                    <Card className="shadow-md overflow-hidden border-emerald-200">
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="min-w-full w-full text-sm">
                            <thead>
                              <tr className="bg-emerald-100/90 border-b-2 border-emerald-200">
                                <th className="px-4 py-3.5 font-bold text-emerald-950 text-left whitespace-nowrap">Sl No</th>
                                <th className="px-4 py-3.5 font-bold text-emerald-950 text-left whitespace-nowrap">Name</th>
                                <th className="px-4 py-3.5 font-bold text-emerald-950 text-left whitespace-nowrap">Email</th>
                                <th className="px-4 py-3.5 font-bold text-emerald-950 text-left whitespace-nowrap">College</th>
                                <th className="px-4 py-3.5 font-bold text-emerald-950 text-left whitespace-nowrap">USN</th>
                                <th className="px-4 py-3.5 font-bold text-emerald-950 text-left whitespace-nowrap">Dept</th>
                                <th className="px-4 py-3.5 font-bold text-emerald-950 text-center whitespace-nowrap">Attempted</th>
                                <th className="px-4 py-3.5 font-bold text-emerald-950 text-center whitespace-nowrap">Tab Switches</th>
                                <th className="px-4 py-3.5 font-bold text-emerald-950 text-left min-w-[200px]">Section-wise</th>
                                <th className="px-4 py-3.5 font-bold text-emerald-950 text-center whitespace-nowrap min-w-[150px]">Question-wise Analysis</th>
                                <th className="px-4 py-3.5 font-bold text-emerald-950 text-center whitespace-nowrap">Status</th>
                                <th className="px-4 py-3.5 font-bold text-emerald-950 text-center whitespace-nowrap">Correct</th>
                                <th className="px-4 py-3.5 font-bold text-emerald-950 text-center whitespace-nowrap">Wrong</th>
                                <th className="px-4 py-3.5 font-bold text-emerald-950 text-center whitespace-nowrap">Score</th>
                                <th className="px-4 py-3.5 font-bold text-emerald-950 text-center whitespace-nowrap">%</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-emerald-100/70">
                              {paginatedCandidates.map((c, pIdx) => {
                                const actualIdx = (currentPage - 1) * pageSize + pIdx;
                                const result = results.find(r => r.candidateId === c.id);
                                const attempt = result ? getAttemptsList().find(a => a.id === result.attemptId) : undefined;
                                const sectionData = attempt ? getSectionScoresData(attempt) : [];
                                const status = getSubmissionStatus(attempt);
                                return (
                                  <tr key={c.id} className={`transition-colors hover:bg-emerald-50/60 ${pIdx % 2 === 0 ? 'bg-white' : 'bg-emerald-50/20'}`}>
                                    <td className="px-4 py-3.5 font-bold text-emerald-800 text-center whitespace-nowrap">{actualIdx + 1}</td>
                                    <td className="px-4 py-3.5 font-semibold text-gray-900 whitespace-nowrap">{c.name}</td>
                                    <td className="px-4 py-3.5 text-gray-700 max-w-[200px] truncate" title={c.email}>{c.email}</td>
                                    <td className="px-4 py-3.5 text-gray-700 max-w-[160px] truncate" title={c.college}>{c.college}</td>
                                    <td className="px-4 py-3.5 text-gray-700 font-mono text-xs whitespace-nowrap">{c.usn}</td>
                                    <td className="px-4 py-3.5 text-gray-700 whitespace-nowrap">{c.department}</td>
                                    <td className="px-4 py-3.5 text-gray-700 whitespace-nowrap text-center">{c.section}</td>
                                    <td className="px-4 py-3.5 text-gray-700 text-center whitespace-nowrap">{attempt ? attempt.answers.length : 'N/A'}</td>
                                    <td className="px-4 py-3.5 text-gray-700 text-center whitespace-nowrap">
                                      <span className={attempt && attempt.tabSwitches > 0 ? "font-bold text-amber-700" : ""}>
                                        {attempt?.tabSwitches ?? 0}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3.5 text-gray-700">
                                      {sectionData.length > 0 ? (
                                        <div className="flex flex-col gap-1 py-0.5">
                                          {sectionData.map((sec, sIdx) => (
                                            <div key={sIdx} className="inline-flex items-center justify-between gap-1.5 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded text-xs">
                                              <span className="font-semibold text-emerald-950 truncate max-w-[110px]" title={sec.section}>{sec.section}:</span>
                                              <span className="font-bold text-emerald-800 shrink-0">{sec.obtained}/{sec.total}</span>
                                              <span className="text-[10px] text-emerald-600 shrink-0">({sec.percent}%)</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-muted-foreground text-xs">{attempt ? 'General' : 'N/A'}</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                      {attempt && exam && exam.questions && exam.questions.length > 0 ? (
                                        <div className="flex flex-col items-center gap-1.5 py-0.5">
                                          {/* Mini question visual dots */}
                                          <div className="flex items-center justify-center gap-0.5 max-w-[140px] flex-wrap">
                                            {exam.questions.map((q, qI) => {
                                              const ans = attempt.answers?.find(a => a.questionId === q.id);
                                              const isAttempted = ans && ans.selectedAnswer !== null && ans.selectedAnswer !== undefined;
                                              const isCorrect = isAttempted && Number(ans.selectedAnswer) === Number(q.correctAnswer);
                                              const isWrong = isAttempted && !isCorrect;

                                              return (
                                                <span
                                                  key={q.id}
                                                  title={`Q${qI + 1} (${q.section || 'General'}): ${isCorrect ? '✓ Correct' : isWrong ? '✗ Incorrect' : '○ Skipped'}`}
                                                  className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded text-[8px] font-bold ${
                                                    isCorrect
                                                      ? 'bg-emerald-600 text-white'
                                                      : isWrong
                                                      ? 'bg-rose-500 text-white'
                                                      : 'bg-gray-200 text-gray-600'
                                                  }`}
                                                >
                                                  {isCorrect ? '✓' : isWrong ? '✗' : '·'}
                                                </span>
                                              );
                                            })}
                                          </div>
                                          <Button
                                            size="sm"
                                            onClick={() => setSelectedCandidateForQAnalysis({ candidate: c, attempt, result })}
                                            className="h-6 px-2 text-[10px] font-bold text-white bg-[#008037] hover:bg-black border border-[#008037] shadow-xs gap-1 inline-flex items-center cursor-pointer transition-colors"
                                          >
                                            <Eye className="h-3 w-3 text-white" />
                                            <span className="text-white font-bold">Q-Breakdown</span>
                                          </Button>
                                        </div>
                                      ) : (
                                        <span className="text-gray-400 text-xs">-</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                      <Badge variant={status === 'Limit Exceeded' ? 'destructive' : 'default'} className="font-semibold text-xs">
                                        {status}
                                      </Badge>
                                    </td>
                                    <td className="px-4 py-3.5 text-center text-emerald-700 font-bold whitespace-nowrap">{result?.correctAnswers ?? 0}</td>
                                    <td className="px-4 py-3.5 text-center text-rose-600 font-bold whitespace-nowrap">{result?.wrongAnswers ?? 0}</td>
                                    <td className="px-4 py-3.5 text-center font-extrabold text-gray-900 whitespace-nowrap">{result ? `${result.obtainedMarks}/${result.totalMarks}` : 'N/A'}</td>
                                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                      <Badge variant={result && result.percentage >= 50 ? 'default' : 'destructive'} className="font-extrabold text-xs">
                                        {result ? `${result.percentage}%` : 'N/A'}
                                      </Badge>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  ) : resultsViewMode === 'card' ? (
                    /* Card Form View - Compact Low-Height Format with Decreased Width */
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {paginatedCandidates.map((c, pIdx) => {
                        const actualIdx = (currentPage - 1) * pageSize + pIdx;
                        const result = results.find(r => r.candidateId === c.id);
                        const attempt = result ? getAttemptsList().find(a => a.id === result.attemptId) : undefined;
                        const status = getSubmissionStatus(attempt);

                        return (
                          <div
                            key={c.id}
                            className="bg-white border border-green-200/90 rounded-xl p-3 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-2 hover:border-green-400"
                          >
                            {/* Line 1: Header (SL No, Name, Email, Status Badge) */}
                            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-green-100">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-xs font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-200 shrink-0">
                                  #{actualIdx + 1}
                                </span>
                                <h4 className="text-sm font-bold text-gray-900 truncate" title={c.name}>
                                  {c.name}
                                </h4>
                              </div>
                              <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-center shrink-0 shadow-2xs ${status === 'Limit Exceeded'
                                  ? 'bg-destructive text-white'
                                  : !attempt
                                    ? 'bg-gray-200 text-gray-700'
                                    : 'bg-[#0a7a3b] text-white'
                                }`}>
                                {status}
                              </div>
                            </div>

                            {/* Line 2: Key Metrics Grid (Score, %, Correct, Wrong, Attempted, Tab Switches) */}
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 py-1 px-1.5 rounded-lg bg-green-50/50 border border-green-100 text-center">
                              <div>
                                <p className="text-[10px] font-semibold text-green-700">Score</p>
                                <p className="text-xs font-bold text-gray-900">
                                  {result ? `${result.obtainedMarks}/${result.totalMarks}` : 'N/A'}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-green-700">Percentage</p>
                                <p className="text-xs font-bold text-gray-900">
                                  {result ? `${typeof result.percentage === 'number' ? result.percentage.toFixed(2) : result.percentage}%` : 'N/A'}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-green-700">Correct</p>
                                <p className="text-xs font-bold text-green-600">{result?.correctAnswers ?? 0}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-green-700">Wrong</p>
                                <p className="text-xs font-bold text-red-600">{result?.wrongAnswers ?? 0}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-green-700">Attempted</p>
                                <p className="text-xs font-semibold text-gray-700">{attempt ? attempt.answers.length : 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-green-700">Tab Switches</p>
                                <p className={`text-xs ${attempt && attempt.tabSwitches > 0 ? 'font-bold text-amber-700' : 'text-gray-700 font-semibold'}`}>
                                  {attempt?.tabSwitches ?? 0}
                                </p>
                              </div>
                            </div>

                            {/* Line 3: Candidate Details */}
                            <div className="grid grid-cols-2 gap-1.5 text-xs">
                              <div className="min-w-0">
                                <span className="text-[10px] font-semibold text-green-700 block">Email</span>
                                <span className="text-xs text-gray-700 truncate block" title={c.email}>{c.email}</span>
                              </div>
                              <div className="min-w-0">
                                <span className="text-[10px] font-semibold text-green-700 block">College</span>
                                <span className="text-xs text-gray-700 truncate block" title={c.college}>{c.college || '-'}</span>
                              </div>
                              <div className="min-w-0">
                                <span className="text-[10px] font-semibold text-green-700 block">USN</span>
                                <span className="text-xs text-gray-700 font-mono truncate block" title={c.usn}>{c.usn || '-'}</span>
                              </div>
                              <div className="min-w-0">
                                <span className="text-[10px] font-semibold text-green-700 block">Dept / Sec</span>
                                <span className="text-xs text-gray-700 truncate block" title={`${c.department || '-'}${c.section ? ` / ${c.section}` : ''}`}>
                                  {c.department || '-'}{c.section ? ` / ${c.section}` : ''}
                                </span>
                              </div>
                            </div>

                            {/* Line 4: Section-wise Scores */}
                            <div className="pt-1 border-t border-green-100 flex items-baseline gap-1 text-xs">
                              <span className="text-[10px] font-semibold text-green-700 shrink-0">Section-wise:</span>
                              <span className="text-[11px] text-gray-700 truncate flex-1" title={attempt ? getSectionScoresText(attempt) : 'N/A'}>
                                {attempt ? getSectionScoresText(attempt) : 'N/A'}
                              </span>
                            </div>

                            {/* Line 5: Question-wise Analysis */}
                            <div className="pt-1.5 border-t border-green-100 flex items-center justify-between gap-1 text-xs">
                              <div className="flex items-center gap-1 min-w-0">
                                <span className="text-[10px] font-semibold text-green-700 shrink-0">Q-Wise:</span>
                                {attempt && exam && exam.questions ? (
                                  <div className="flex items-center gap-0.5 overflow-x-auto max-w-[140px] py-0.5">
                                    {exam.questions.map((q, qIndex) => {
                                      const ans = attempt.answers.find(a => a.questionId === q.id);
                                      const isCorrect = ans && ans.selectedAnswer === q.correctAnswer;
                                      const isWrong = ans && ans.selectedAnswer !== null && ans.selectedAnswer !== undefined && ans.selectedAnswer !== q.correctAnswer;
                                      return (
                                        <span
                                          key={q.id || qIndex}
                                          title={`Q${qIndex + 1} (${q.section || 'General'}): ${isCorrect ? '✓ Correct' : isWrong ? '✗ Incorrect' : '○ Skipped'}`}
                                          className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded text-[8px] font-bold ${
                                            isCorrect
                                              ? 'bg-emerald-600 text-white'
                                              : isWrong
                                              ? 'bg-rose-500 text-white'
                                              : 'bg-gray-200 text-gray-600'
                                          }`}
                                        >
                                          {isCorrect ? '✓' : isWrong ? '✗' : '·'}
                                        </span>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 text-[11px]">-</span>
                                )}
                              </div>
                              {attempt && (
                                <Button
                                  size="sm"
                                  onClick={() => setSelectedCandidateForQAnalysis({ candidate: c, attempt, result })}
                                  className="h-5 px-1.5 text-[9px] font-bold text-white bg-[#008037] hover:bg-black border border-[#008037] shadow-xs gap-0.5 shrink-0 inline-flex items-center cursor-pointer transition-colors"
                                >
                                  <Eye className="h-2.5 w-2.5 text-white" />
                                  <span className="text-white font-bold">Details</span>
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* 3D Graphs & Detailed Analytics View */
                    <ExamResults3DAnalytics
                      exam={exam}
                      candidates={getFilteredCandidates()}
                      results={results}
                      attempts={getAttemptsList()}
                      getSectionScoresData={getSectionScoresData}
                      getSubmissionStatus={getSubmissionStatus}
                    />
                  )}

                  {/* Pagination Controls */}
                  {totalPages > 1 && resultsViewMode !== 'graph' && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-emerald-100">
                      <div className="text-xs text-muted-foreground">
                        Showing <span className="font-semibold text-gray-900">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                        <span className="font-semibold text-gray-900">
                          {Math.min(currentPage * pageSize, totalFiltered)}
                        </span>{' '}
                        of <span className="font-semibold text-gray-900">{totalFiltered}</span> candidates
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Page Size Selector */}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
                          <span>Per page:</span>
                          <select
                            aria-label="Items per page"
                            value={pageSize}
                            onChange={(e) => {
                              setPageSize(Number(e.target.value));
                              setCurrentPage(1);
                            }}
                            className="h-7 rounded-md border border-emerald-200 bg-white px-2 text-xs font-semibold text-gray-800 cursor-pointer"
                          >
                            <option value={12}>12</option>
                            <option value={24}>24</option>
                            <option value={48}>48</option>
                            <option value={96}>96</option>
                            <option value={200}>200</option>
                          </select>
                        </div>

                        {/* Navigation Buttons */}
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="h-7 w-7 p-0"
                            title="First Page"
                          >
                            <ChevronsLeft className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="h-7 w-7 p-0"
                            title="Previous Page"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </Button>

                          <span className="text-xs font-semibold px-2">
                            Page {currentPage} of {totalPages}
                          </span>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="h-7 w-7 p-0"
                            title="Next Page"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="h-7 w-7 p-0"
                            title="Last Page"
                          >
                            <ChevronsRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </TabsContent>
        </Tabs>

        {/* Export Dialog */}
        {showExportDialog && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>Export Results to Excel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Export All or Filtered Data */}
                <div className="space-y-3 border-b pb-4">
                  <Label className="text-base font-semibold">Data to Export</Label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="exportData"
                        checked={!exportAllData}
                        onChange={() => setExportAllData(false)}
                        className="accent-primary"
                      />
                      <span>Export Filtered Results ({getFilteredCandidates().length} candidates)</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="exportData"
                        checked={exportAllData}
                        onChange={() => setExportAllData(true)}
                        className="accent-primary"
                      />
                      <span>Export All Results ({candidates.length} candidates)</span>
                    </label>
                  </div>
                </div>

                {/* Columns Selection */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Columns to Include</Label>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {[
                      { id: 'name', label: 'Name' },
                      { id: 'email', label: 'Email' },
                      { id: 'college', label: 'College' },
                      { id: 'usn', label: 'USN' },
                      { id: 'department', label: 'Department' },
                      { id: 'section', label: 'Section' },
                      { id: 'attempted', label: 'Attempted' },
                      { id: 'tabSwitches', label: 'Tab Switches' },
                      { id: 'sectionWise', label: 'Section-wise Scores' },
                      { id: 'correct', label: 'Correct Answers' },
                      { id: 'wrong', label: 'Wrong Answers' },
                      { id: 'score', label: 'Total Score' },
                      { id: 'percentage', label: 'Percentage' },
                    ].map(col => (
                      <label key={col.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={exportColumns.has(col.id)}
                          onChange={() => toggleExportColumn(col.id)}
                          className="accent-primary"
                        />
                        <span className="text-sm">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 justify-end pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setShowExportDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleExportPdf(!exportAllData)}
                    className="bg-[#008037] text-white hover:bg-black font-bold gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Export PDF Report
                  </Button>
                  <Button
                    className="gap-2 bg-primary text-white hover:bg-primary/90 font-bold"
                    onClick={handleExport}
                  >
                    <Download className="h-4 w-4" />
                    Export Excel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Candidate Question-Wise Breakdown Dialog */}
        <Dialog open={!!selectedCandidateForQAnalysis} onOpenChange={(open) => !open && setSelectedCandidateForQAnalysis(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-50">
            {selectedCandidateForQAnalysis && (
              <>
                {/* Header */}
                <div className="bg-white border-b border-emerald-100 p-5 shrink-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Candidate Breakdown
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          USN: {selectedCandidateForQAnalysis.candidate.usn || 'N/A'}
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-gray-900 mt-1">
                        {selectedCandidateForQAnalysis.candidate.name}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {selectedCandidateForQAnalysis.candidate.email} • {selectedCandidateForQAnalysis.candidate.department || 'General'}
                        {selectedCandidateForQAnalysis.candidate.section ? ` (Sec ${selectedCandidateForQAnalysis.candidate.section})` : ''}
                      </p>
                    </div>

                    {/* Overall Score Badge */}
                    <div className="flex items-center gap-2 bg-emerald-50/80 border border-emerald-200 rounded-xl p-3">
                      <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-emerald-700">Total Score</p>
                        <p className="text-lg font-black text-emerald-900 leading-tight">
                          {selectedCandidateForQAnalysis.result
                            ? `${selectedCandidateForQAnalysis.result.obtainedMarks} / ${selectedCandidateForQAnalysis.result.totalMarks}`
                            : 'N/A'}
                        </p>
                      </div>
                      <div className="h-9 w-px bg-emerald-200" />
                      <div className="text-left">
                        <p className="text-[10px] uppercase font-bold text-emerald-700">Percentage</p>
                        <p className="text-lg font-black text-emerald-800 leading-tight">
                          {selectedCandidateForQAnalysis.result ? `${selectedCandidateForQAnalysis.result.percentage}%` : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Summary metric chips */}
                  <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100 text-xs">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 font-bold">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Correct: {selectedCandidateForQAnalysis.result?.correctAnswers ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-100 text-rose-800 font-bold">
                      <XCircle className="h-3.5 w-3.5" /> Wrong: {selectedCandidateForQAnalysis.result?.wrongAnswers ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-200 text-gray-700 font-bold">
                      <MinusCircle className="h-3.5 w-3.5" /> Skipped: {
                        exam?.questions
                          ? Math.max(0, exam.questions.length - ((selectedCandidateForQAnalysis.result?.correctAnswers ?? 0) + (selectedCandidateForQAnalysis.result?.wrongAnswers ?? 0)))
                          : 0
                      }
                    </span>
                    {selectedCandidateForQAnalysis.attempt && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-100 text-amber-900 font-medium ml-auto">
                        Tab Switches: {selectedCandidateForQAnalysis.attempt.tabSwitches}
                      </span>
                    )}
                  </div>
                </div>

                {/* Question List */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {exam?.questions && exam.questions.length > 0 ? (
                    exam.questions.map((q, idx) => {
                      const ans = selectedCandidateForQAnalysis.attempt?.answers.find(a => a.questionId === q.id);
                      const isAnswered = ans !== undefined && ans.selectedAnswer !== null && ans.selectedAnswer !== undefined;
                      const isCorrect = isAnswered && ans.selectedAnswer === q.correctAnswer;
                      const isWrong = isAnswered && ans.selectedAnswer !== q.correctAnswer;
                      const earnedMarks = isCorrect
                        ? (q.marks || 1)
                        : isWrong
                        ? -(q.negativeMarks ?? exam.settings?.negativeMarks ?? 0)
                        : 0;

                      return (
                        <div
                          key={q.id || idx}
                          className={`bg-white rounded-xl border p-4 shadow-2xs transition-all ${
                            isCorrect
                              ? 'border-emerald-300 ring-1 ring-emerald-200/50'
                              : isWrong
                              ? 'border-rose-300 ring-1 ring-rose-200/50'
                              : 'border-gray-200'
                          }`}
                        >
                          {/* Question header */}
                          <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-gray-100">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-gray-900">
                                Question {idx + 1}
                              </span>
                              {q.section && (
                                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  {q.section}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">
                                (+{q.marks || 1} / -{q.negativeMarks ?? exam.settings?.negativeMarks ?? 0} marks)
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {isCorrect ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white">
                                  <CheckCircle2 className="h-3 w-3" /> Correct (+{earnedMarks})
                                </span>
                              ) : isWrong ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white">
                                  <XCircle className="h-3 w-3" /> Wrong ({earnedMarks})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-200 text-gray-700">
                                  <MinusCircle className="h-3 w-3" /> Skipped (0)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Reading Comprehension Passage */}
                          {q.passage && (
                            <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-gray-700 italic max-h-32 overflow-y-auto">
                              <span className="font-bold not-italic block mb-1 text-slate-800">Passage:</span>
                              {q.passage}
                            </div>
                          )}

                          {/* Question Text */}
                          <p className="text-sm font-medium text-gray-900 mb-3 whitespace-pre-wrap">
                            {q.text}
                          </p>

                          {/* Question Image if present */}
                          {q.imageUrl && (
                            <div className="mb-3">
                              <img
                                src={q.imageUrl}
                                alt={`Question ${idx + 1}`}
                                className="max-h-48 rounded border border-gray-200 object-contain"
                              />
                            </div>
                          )}

                          {/* Options */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {q.options.map((opt, oIdx) => {
                              const isCandidateChoice = ans?.selectedAnswer === oIdx;
                              const isRightAnswer = q.correctAnswer === oIdx;

                              let optBorder = 'border-gray-200 bg-gray-50/50 text-gray-700';
                              if (isRightAnswer && isCandidateChoice) {
                                optBorder = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-semibold ring-1 ring-emerald-400';
                              } else if (isRightAnswer) {
                                optBorder = 'border-emerald-400 bg-emerald-50/60 text-emerald-900 font-semibold border-dashed';
                              } else if (isCandidateChoice) {
                                optBorder = 'border-rose-400 bg-rose-50 text-rose-950 font-semibold ring-1 ring-rose-400';
                              }

                              return (
                                <div
                                  key={oIdx}
                                  className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${optBorder}`}
                                >
                                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                                    isRightAnswer
                                      ? 'bg-emerald-600 text-white'
                                      : isCandidateChoice
                                      ? 'bg-rose-500 text-white'
                                      : 'bg-gray-200 text-gray-700'
                                  }`}>
                                    {String.fromCharCode(65 + oIdx)}
                                  </span>

                                  <div className="flex-1 min-w-0">
                                    <p className="break-words">{opt}</p>
                                    {q.optionImages && q.optionImages[oIdx] && (
                                      <img
                                        src={q.optionImages[oIdx]}
                                        alt={`Option ${String.fromCharCode(65 + oIdx)}`}
                                        className="mt-1.5 max-h-24 rounded border object-contain"
                                      />
                                    )}
                                    <div className="flex items-center gap-1.5 mt-1">
                                      {isRightAnswer && (
                                        <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
                                          <CheckCircle2 className="h-2.5 w-2.5" /> Correct Answer
                                        </span>
                                      )}
                                      {isCandidateChoice && (
                                        <span className={`text-[10px] font-bold flex items-center gap-0.5 ${isRightAnswer ? 'text-emerald-700' : 'text-rose-700'}`}>
                                          • Candidate Selected
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-10 text-muted-foreground text-sm">
                      No question details found for this exam.
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="bg-white border-t border-emerald-100 p-3 px-5 flex justify-end shrink-0">
                  <Button
                    onClick={() => setSelectedCandidateForQAnalysis(null)}
                    className="bg-[#008037] text-white hover:bg-black font-bold px-4 py-1.5 text-xs shadow-xs"
                  >
                    Close Breakdown
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default ExamManage;
