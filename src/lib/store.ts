import { Admin, Exam, Candidate, ExamAttempt, ExamResult, Question, CandidateAnswer } from './types';
import * as api from './api';
import { parseExamScheduleDate } from './dateUtils';

// ============================================================
// SESSION MANAGEMENT (using SessionStorage for temporary state only)
// ============================================================

const SESSION_KEYS = {
  ADMIN_SESSION: 'exam_admin_session',
};

// Initialize store - no database operations needed
export function initStore() {
  console.log('✓ Store initialized with MySQL backend');
}

// Admin auth - uses API
export async function adminLogin(username: string, password: string): Promise<Admin | null> {
  return await api.adminLogin(username, password);
}

export function getAdminSession(): string | null {
  return sessionStorage.getItem(SESSION_KEYS.ADMIN_SESSION);
}

export function setAdminSession(adminId: string) {
  sessionStorage.setItem(SESSION_KEYS.ADMIN_SESSION, adminId);
}

export function adminLogout() {
  sessionStorage.removeItem(SESSION_KEYS.ADMIN_SESSION);
}

// ============================================================
// EXAMS - All operations use API
// ============================================================

export async function getExams(): Promise<Exam[]> {
  return await api.getExams();
}

export async function getExam(id: string): Promise<Exam | undefined> {
  return await api.getExam(id);
}

export async function getExamByCode(code: string): Promise<Exam | undefined> {
  return await api.getExamByCode(code);
}

export async function getVisibleExams(options: { includeNotStarted?: boolean; includeExpired?: boolean; includeInactive?: boolean } = { includeNotStarted: true, includeExpired: false, includeInactive: true }): Promise<Exam[]> {
  const exams = await api.getExams();
  const now = new Date();

  return exams.filter(exam => {
    // Inactive exam display control
    if (!exam.isActive && !options.includeInactive) return false;

    // Expiration handling
    if (exam.endDateTime) {
      const end = parseExamScheduleDate(exam.endDateTime);
      if (end && end < now && !options.includeExpired) return false;
    }

    // Not started handling
    if (!options.includeNotStarted && exam.startDateTime) {
      const start = parseExamScheduleDate(exam.startDateTime);
      if (start && start > now) return false;
    }

    return true;
  });
}

export async function getExamAccessStatus(code: string): Promise<{ status: 'active' | 'not_started' | 'expired' | 'inactive' | 'invalid'; exam?: Exam }> {
  try {
    const exam = await api.getExamByCode(code);
    if (!exam) return { status: 'invalid' };
    if (!exam.isActive) return { status: 'inactive', exam };

    const now = new Date();
    if (exam.startDateTime) {
      const start = parseExamScheduleDate(exam.startDateTime);
      if (start && now < start) return { status: 'not_started', exam };
    }
    if (exam.endDateTime) {
      const end = parseExamScheduleDate(exam.endDateTime);
      if (end && now > end) return { status: 'expired', exam };
    }

    return { status: 'active', exam };
  } catch (error) {
    return { status: 'invalid' };
  }
}

export async function createExam(name: string, settings: Exam['settings'], startDateTime?: string, endDateTime?: string): Promise<Exam | null> {
  return await api.createExam(name, settings, startDateTime, endDateTime);
}

export async function updateExam(exam: Exam): Promise<boolean> {
  return await api.updateExam(exam);
}

export async function toggleExamActive(examId: string): Promise<boolean> {
  return await api.toggleExamActive(examId);
}

export async function deleteExam(examId: string): Promise<boolean> {
  return await api.deleteExam(examId);
}

// ============================================================
// QUESTIONS - All operations use API
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
): Promise<Question | null> {
  return await api.addQuestion(examId, type, text, options, correctAnswer, imageUrl, optionImages, marks, negativeMarks, section, passage, passageGroupId);
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
): Promise<boolean> {
  return await api.updateQuestion(examId, questionId, type, text, options, correctAnswer, imageUrl, optionImages, marks, negativeMarks, section, passage, passageGroupId);
}

export async function deleteQuestion(examId: string, questionId: string): Promise<boolean> {
  return await api.deleteQuestion(examId, questionId);
}

// ============================================================
// CANDIDATES - All operations use API
// ============================================================

export async function registerCandidate(data: Omit<Candidate, 'id' | 'registeredAt'>): Promise<{ success: boolean; data?: Candidate; error?: string }> {
  return await api.registerCandidate(data as any);
}

export async function getCandidates(examId?: string): Promise<Candidate[]> {
  return await api.getCandidates(examId);
}

export async function getCandidate(id: string): Promise<Candidate | undefined> {
  return await api.getCandidate(id);
}

export async function isDuplicateCandidate(examId: string, usn: string, department: string): Promise<boolean> {
  return await api.isDuplicateCandidate(examId, usn, department);
}

// ============================================================
// EXAM ATTEMPTS - All operations use API
// ============================================================

export async function startAttempt(candidateId: string, examId: string): Promise<ExamAttempt | null> {
  return await api.startAttempt(candidateId, examId);
}

export async function updateAttempt(attempt: ExamAttempt): Promise<boolean> {
  return await api.updateAttempt(attempt.id, attempt.answers, attempt.tabSwitches);
}

export async function submitAttempt(attemptId: string, answers: any[], tabSwitches?: number): Promise<ExamResult | null> {
  return await api.submitAttempt(attemptId, answers, tabSwitches);
}

export async function getAttempts(examId?: string): Promise<ExamAttempt[]> {
  return await api.getAttempts(examId);
}

export async function getAttempt(id: string): Promise<ExamAttempt | undefined> {
  return await api.getAttempt(id);
}

// ============================================================
// RESULTS - All operations use API
// ============================================================

export async function calculateResult(attemptId: string): Promise<ExamResult | null> {
  try {
    const attempt = await api.getAttempt(attemptId);
    if (!attempt) return null;

    // Ensure backend computes result via submit endpoint before reading it.
    return await api.submitAttempt(attemptId, attempt.answers || []);
  } catch (error) {
    console.error('Calculate result error:', error);
    return null;
  }
}

export async function getResults(examId?: string): Promise<ExamResult[]> {
  return await api.getResults(examId);
}

export async function getResult(attemptId: string): Promise<ExamResult | undefined> {
  return await api.getResult(attemptId);
}

export async function exportResultsCSV(examId: string): Promise<string> {
  return await api.exportResultsCSV(examId);
}
