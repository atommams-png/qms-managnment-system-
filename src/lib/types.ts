export interface Admin {
  id: string;
  username: string;
  password: string;
}

export type QuestionType = 'mcq' | 'mcq-image' | 'true-false' | 'reading-comprehension';

export interface ExamSettings {
  duration: number; // minutes
  marksPerQuestion: number;
  negativeMarks: number;
  showResult: boolean;
  randomOrder: boolean;
  fullscreenMode: boolean;
  tabSwitchDetection: boolean;
  maxTabSwitches: number;
  navigationPanel: boolean;
  questionTimer: number; // seconds, 0 = disabled
}

export interface Question {
  id: string;
  examId: string;
  type: QuestionType; // NEW: Question type
  text: string;
  imageUrl?: string; // Optional image for MCQ questions
  options: string[];
  optionImages?: string[]; // Optional images for options like MCQ with images
  correctAnswer: number; // index
  marks: number; // Marks allocated for this question
  negativeMarks?: number | null; // Optional override, fallback to exam settings when null/undefined
  section?: string; // Section name (e.g., "Python", "Java", "Reading Comprehension")
  passage?: string; // For reading comprehension questions
  passageGroupId?: string; // To group multiple questions with same passage
}

export interface Exam {
  id: string;
  name: string;
  code: string;
  settings: ExamSettings;
  questions: Question[];
  createdAt: string;
  isActive: boolean;
  startDateTime?: string;
  endDateTime?: string;
}

export type ExamAccessStatus = 'active' | 'not_started' | 'expired' | 'inactive' | 'invalid';

export interface Candidate {
  id: string;
  examId: string;
  name: string;
  email: string;
  phone: string;
  college: string;
  usn: string;
  department: string;
  section: string;
  registeredAt: string;
}

export interface CandidateAnswer {
  questionId: string;
  selectedAnswer: number | null;
  timeSpentSeconds?: number;
}

export interface ExamAttempt {
  id: string;
  candidateId: string;
  examId: string;
  answers: CandidateAnswer[];
  startedAt: string;
  submittedAt: string | null;
  tabSwitches: number;
  isSubmitted: boolean;
}

export interface ExamResult {
  attemptId: string;
  candidateId: string;
  examId: string;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  unanswered: number;
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
}
