// ============================================================
// API SERVICE - Connects React to MySQL Backend
// ============================================================

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const port = window.location.port;
    // Vite dev server ports
    if (port === '5173' || port === '3000' || port === '8080') {
      return `${protocol}//${hostname}:5001/api`;
    }
    // Production (served via Express or reverse proxy on same port)
    return `${protocol}//${window.location.host}/api`;
  }
  return 'http://localhost:5001/api';
};

const API_URL = getApiBaseUrl();

function toQuestion(question: any) {
  const type = question.type;
  const rawOptions = Array.isArray(question.options) ? question.options : [];
  const options = type === 'true-false'
    ? rawOptions.slice(0, 2).map((opt: any, idx: number) => {
        const value = typeof opt === 'string' ? opt.trim() : '';
        if (value) return value;
        return idx === 0 ? 'True' : 'False';
      })
    : rawOptions;

  return {
    id: question.id,
    examId: question.examId ?? question.exam_id,
    type,
    text: question.text,
    imageUrl: question.imageUrl ?? question.image_url,
    options,
    optionImages: question.optionImages ?? question.option_images,
    correctAnswer: question.correctAnswer ?? question.correct_answer,
    marks: question.marks ?? 1,
    negativeMarks: question.negativeMarks ?? question.negative_marks ?? null,
    section: question.section,
    passage: question.passage,
    passageGroupId: question.passageGroupId ?? question.passage_group_id
  };
}

function toExam(exam: any) {
  return {
    id: exam.id,
    name: exam.name,
    code: exam.code ?? exam.examCode ?? exam.exam_code,
    settings: {
      duration: exam.duration ?? 60,
      marksPerQuestion: exam.marksPerQuestion ?? exam.marks_per_question ?? 1,
      negativeMarks: exam.negativeMarks ?? exam.negative_marks ?? 0,
      showResult: Boolean(exam.showResult ?? exam.show_result),
      randomOrder: Boolean(exam.randomOrder ?? exam.random_order),
      fullscreenMode: Boolean(exam.fullscreenMode ?? exam.fullscreen_mode),
      tabSwitchDetection: Boolean(exam.tabSwitchDetection ?? exam.tab_switch_detection),
      maxTabSwitches: exam.maxTabSwitches ?? exam.max_tab_switches ?? 0,
      navigationPanel: Boolean(exam.navigationPanel ?? exam.navigation_panel),
      questionTimer: exam.questionTimer ?? exam.question_timer ?? 0
    },
    questions: Array.isArray(exam.questions) ? exam.questions.map(toQuestion) : [],
    createdAt: exam.createdAt ?? exam.created_at,
    isActive: Boolean(exam.isActive ?? exam.is_active),
    startDateTime: exam.startDateTime ?? exam.start_date_time,
    endDateTime: exam.endDateTime ?? exam.end_date_time,
    questionCount: exam.questionCount ?? exam.question_count,
    candidateCount: exam.candidateCount ?? exam.candidate_count
  };
}

function toCandidate(candidate: any) {
  return {
    id: candidate.id,
    examId: candidate.examId ?? candidate.exam_id,
    name: candidate.name,
    email: candidate.email,
    phone: candidate.phone,
    college: candidate.college,
    usn: candidate.usn,
    department: candidate.department,
    section: candidate.section,
    registeredAt: candidate.registeredAt ?? candidate.registered_at
  };
}

function toAttempt(attempt: any) {
  return {
    id: attempt.id,
    candidateId: attempt.candidateId ?? attempt.candidate_id,
    examId: attempt.examId ?? attempt.exam_id,
    answers: Array.isArray(attempt.answers) ? attempt.answers : [],
    startedAt: attempt.startedAt ?? attempt.started_at,
    submittedAt: attempt.submittedAt ?? attempt.submitted_at,
    tabSwitches: parseInt(attempt.tabSwitches ?? attempt.tab_switches ?? 0, 10),
    isSubmitted: Boolean(attempt.isSubmitted ?? attempt.is_submitted)
  };
}

function toResult(result: any) {
  return {
    attemptId: result.attemptId ?? result.attempt_id,
    candidateId: result.candidateId ?? result.candidate_id,
    examId: result.examId ?? result.exam_id,
    totalQuestions: result.totalQuestions ?? result.total_questions,
    correctAnswers: result.correctAnswers ?? result.correct_answers,
    wrongAnswers: result.wrongAnswers ?? result.wrong_answers,
    unanswered: result.unanswered,
    totalMarks: result.totalMarks ?? result.total_marks,
    obtainedMarks: result.obtainedMarks ?? result.obtained_marks,
    percentage: result.percentage
  };
}

// ============================================================
// ADMIN / AUTHENTICATION
// ============================================================

export async function adminLogin(username: string, password: string) {
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      sessionStorage.setItem('exam_admin_session', data.data.id);
      return data.data;
    }
    return null;
  } catch (error) {
    console.error('Login error:', error);
    return null;
  }
}

export function getAdminSession(): string | null {
  return sessionStorage.getItem('exam_admin_session');
}

export function adminLogout() {
  sessionStorage.removeItem('exam_admin_session');
}

// ============================================================
// EXAMS
// ============================================================

export async function getExams() {
  try {
    const res = await fetch(`${API_URL}/exams`);
    const data = await res.json();
    return (data.data || []).map(toExam);
  } catch (error) {
    console.error('Get exams error:', error);
    return [];
  }
}

export async function getExam(id: string) {
  try {
    const res = await fetch(`${API_URL}/exams/${id}`);
    const data = await res.json();
    return data.data ? toExam(data.data) : null;
  } catch (error) {
    console.error('Get exam error:', error);
    return null;
  }
}

export async function getExamByCode(code: string) {
  try {
    const res = await fetch(`${API_URL}/exams/code/${code}`);
    const data = await res.json();
    return data.data ? toExam(data.data) : null;
  } catch (error) {
    console.error('Get exam by code error:', error);
    return null;
  }
}

export async function createExam(name: string, settings: any, startDateTime?: string, endDateTime?: string) {
  try {
    const res = await fetch(`${API_URL}/exams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, settings, startDateTime, endDateTime })
    });
    const data = await res.json();
    return data.data ? toExam(data.data) : null;
  } catch (error) {
    console.error('Create exam error:', error);
    return null;
  }
}

export async function updateExam(exam: any) {
  try {
    const res = await fetch(`${API_URL}/exams/${exam.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: exam.name,
        settings: {
          duration: exam.settings?.duration,
          marksPerQuestion: exam.settings?.marksPerQuestion,
          negativeMarks: exam.settings?.negativeMarks,
          showResult: exam.settings?.showResult,
          randomOrder: exam.settings?.randomOrder,
          fullscreenMode: exam.settings?.fullscreenMode,
          tabSwitchDetection: exam.settings?.tabSwitchDetection,
          maxTabSwitches: exam.settings?.maxTabSwitches,
          navigationPanel: exam.settings?.navigationPanel,
          questionTimer: exam.settings?.questionTimer
        },
        startDateTime: exam.startDateTime,
        endDateTime: exam.endDateTime
      })
    });
    return res.ok;
  } catch (error) {
    console.error('Update exam error:', error);
    return false;
  }
}

export async function toggleExamActive(examId: string) {
  try {
    const res = await fetch(`${API_URL}/exams/${examId}/toggle`, {
      method: 'PATCH'
    });
    return res.ok;
  } catch (error) {
    console.error('Toggle exam error:', error);
    return false;
  }
}

export async function deleteExam(examId: string) {
  try {
    const res = await fetch(`${API_URL}/exams/${examId}`, {
      method: 'DELETE'
    });
    return res.ok;
  } catch (error) {
    console.error('Delete exam error:', error);
    return false;
  }
}

// ============================================================
// QUESTIONS
// ============================================================

export async function addQuestion(
  examId: string,
  type: string,
  text: string,
  options: string[],
  correctAnswer: number,
  imageUrl?: string,
  optionImages?: string[],
  marks?: number,
  negativeMarks?: number | null,
  section?: string,
  passage?: string,
  passageGroupId?: string
) {
  try {
    const res = await fetch(`${API_URL}/exams/${examId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        text,
        imageUrl,
        options,
        correctAnswer,
        optionImages,
        marks,
        negativeMarks,
        section,
        passage,
        passageGroupId
      })
    });
    const data = await res.json();
    return data.data ? toQuestion(data.data) : null;
  } catch (error) {
    console.error('Add question error:', error);
    return null;
  }
}

export async function updateQuestion(
  examId: string,
  questionId: string,
  type: string,
  text: string,
  options: string[],
  correctAnswer: number,
  imageUrl?: string,
  optionImages?: string[],
  marks?: number,
  negativeMarks?: number | null,
  section?: string,
  passage?: string,
  passageGroupId?: string
) {
  try {
    const res = await fetch(`${API_URL}/exams/${examId}/questions/${questionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        text,
        imageUrl,
        options,
        correctAnswer,
        optionImages,
        marks,
        negativeMarks,
        section,
        passage,
        passageGroupId
      })
    });
    return res.ok;
  } catch (error) {
    console.error('Update question error:', error);
    return false;
  }
}

export async function deleteQuestion(examId: string, questionId: string) {
  try {
    const res = await fetch(`${API_URL}/exams/${examId}/questions/${questionId}`, {
      method: 'DELETE'
    });
    return res.ok;
  } catch (error) {
    console.error('Delete question error:', error);
    return false;
  }
}

// ============================================================
// CANDIDATES
// ============================================================

export async function registerCandidate(data: {
  examId: string;
  name: string;
  email: string;
  phone?: string;
  college?: string;
  usn: string;
  department: string;
  section?: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/candidates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.success) {
      return { success: true, data: toCandidate(result.data) };
    }
    return { success: false, error: result.error || 'Registration failed' };
  } catch (error: any) {
    console.error('Register candidate error:', error);
    return { success: false, error: error.message || 'Network error during registration' };
  }
}

export async function getCandidates(examId?: string) {
  try {
    if (!examId) return [];
    const res = await fetch(`${API_URL}/candidates/exam/${examId}`);
    const data = await res.json();
    return (data.data || []).map(toCandidate);
  } catch (error) {
    console.error('Get candidates error:', error);
    return [];
  }
}

export async function getCandidate(id: string) {
  try {
    const res = await fetch(`${API_URL}/candidates/${id}`);
    const data = await res.json();
    return data.data ? toCandidate(data.data) : null;
  } catch (error) {
    console.error('Get candidate error:', error);
    return null;
  }
}

export async function isDuplicateCandidate(examId: string, usn: string, department: string) {
  try {
    const candidates = await getCandidates(examId);
    return candidates.some(
      (c: any) => c.usn.toLowerCase() === usn.toLowerCase() &&
        c.department.toLowerCase() === department.toLowerCase()
    );
  } catch {
    return false;
  }
}

// ============================================================
// EXAM ATTEMPTS
// ============================================================

export async function startAttempt(candidateId: string, examId: string) {
  try {
    console.log('Starting attempt with:', { candidateId, examId });
    const res = await fetch(`${API_URL}/attempts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateId, examId })
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('Start attempt failed:', data.error || data);
      return null;
    }
    return data.data ? toAttempt(data.data) : null;
  } catch (error) {
    console.error('Start attempt error:', error);
    return null;
  }
}

export async function updateAttempt(attemptId: string, answers: any[], tabSwitches?: number) {
  try {
    const res = await fetch(`${API_URL}/attempts/${attemptId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers, tabSwitches })
    });
    return res.ok;
  } catch (error) {
    console.error('Update attempt error:', error);
    return false;
  }
}

export async function submitAttempt(attemptId: string, answers: any[], tabSwitches?: number) {
  try {
    // Defensively sanitize answers to prevent circular references or DOM nodes
    const sanitizedAnswers = (answers || []).map((a: any) => ({
      questionId: String(a?.questionId ?? ''),
      selectedAnswer: a?.selectedAnswer == null ? null : Number(a.selectedAnswer),
      timeSpentSeconds: Number(a?.timeSpentSeconds ?? 0),
    }));

    let body: string;
    try {
      body = JSON.stringify({ answers: sanitizedAnswers, tabSwitches });
    } catch (err) {
      console.error('Failed to stringify answers for submitAttempt. Dumping entries for debugging:');
      sanitizedAnswers.forEach((entry: any, idx: number) => {
        try {
          JSON.stringify(entry);
        } catch (e) {
          console.error(`Non-serializable answer at index ${idx}:`, entry);
        }
      });
      throw err;
    }

    const res = await fetch(`${API_URL}/attempts/${attemptId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });
    const data = await res.json();
    return data.data ? toResult(data.data) : null;
  } catch (error) {
    console.error('Submit attempt error:', error);
    return null;
  }
}

export async function getAttempts(examId?: string) {
  try {
    if (!examId) return [];
    const res = await fetch(`${API_URL}/attempts/exam/${examId}`);
    const data = await res.json();
    return (data.data || []).map(toAttempt);
  } catch (error) {
    console.error('Get attempts error:', error);
    return [];
  }
}

export async function getAttempt(id: string) {
  try {
    const res = await fetch(`${API_URL}/attempts/${id}`);
    const data = await res.json();
    return data.data ? toAttempt(data.data) : null;
  } catch (error) {
    console.error('Get attempt error:', error);
    return null;
  }
}

// ============================================================
// RESULTS
// ============================================================

export async function getResults(examId?: string) {
  try {
    if (!examId) return [];
    const res = await fetch(`${API_URL}/results/exam/${examId}`);
    const data = await res.json();
    return (data.data || []).map(toResult);
  } catch (error) {
    console.error('Get results error:', error);
    return [];
  }
}

export async function getResult(attemptId: string) {
  try {
    const res = await fetch(`${API_URL}/results/attempt/${attemptId}`);
    const data = await res.json();
    return data.data ? toResult(data.data) : null;
  } catch (error) {
    console.error('Get result error:', error);
    return null;
  }
}

export async function exportResultsCSV(examId: string) {
  try {
    const res = await fetch(`${API_URL}/results/export/${examId}`);
    return await res.text();
  } catch (error) {
    console.error('Export error:', error);
    return '';
  }
}

// ============================================================
// INITIALIZE STORE (No-op for API-based system)
// ============================================================
export function initStore() {
  // No initialization needed - use backend instead
  console.log('API-based system ready. Using MySQL backend.');
}
