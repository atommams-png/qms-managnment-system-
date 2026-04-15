import { Exam, Candidate, ExamResult, ExamAttempt } from './types';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

/**
 * Helper function to load logo image from public folder
 */
async function loadLogoImage(): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch('/atom shaale logo.png');
    if (!response.ok) throw new Error('Failed to load logo');
    const arrayBuffer = await response.arrayBuffer();
    return arrayBuffer;
  } catch (error) {
    console.warn('Could not load logo image:', error);
    return null;
  }
}

/**
 * Helper function to add logo image to worksheet header
 */
function addLogoToSheet(
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  logoBuffer: ArrayBuffer | null
) {
  if (!logoBuffer) return; // Skip if logo not loaded
  
  try {
    const imageId = workbook.addImage({
      buffer: new Uint8Array(logoBuffer) as any,
      extension: 'png',
    });

    // Keep logo on the first (white) row, aligned like the provided sample.
    worksheet.addImage(imageId, {
      tl: { col: 0.2, row: 0.12 },
      ext: { width: 110, height: 42 },
    });
  } catch (error) {
    console.warn('Failed to add logo to sheet:', error);
  }
}

/**
 * Helper: Add consistent branded header to a worksheet
 */
function addBrandedSheetHeader(
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  logoBuffer: ArrayBuffer | null,
  title: string,
  subtitle: string,
  totalColumns: number
) {
  const logoRow = worksheet.addRow([]);
  logoRow.height = 52;
  addLogoToSheet(workbook, worksheet, logoBuffer);

  const titleRow = worksheet.addRow([title]);
  titleRow.getCell(1).font = {
    bold: true,
    size: 18,
    color: { argb: 'FFFFFFFF' },
  };
  titleRow.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF008037' },
  };
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.height = 35;
  worksheet.mergeCells(2, 1, 2, totalColumns);

  const subtitleRow = worksheet.addRow([subtitle]);
  subtitleRow.getCell(1).font = {
    bold: true,
    size: 12,
    color: { argb: 'FF333333' },
  };
  subtitleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  subtitleRow.height = 20;
  worksheet.mergeCells(3, 1, 3, totalColumns);

  worksheet.addRow([]);
}

/**
 * Helper function to trigger file download in browser
 */
async function downloadExcelFile(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Helper function to get section scores from an exam attempt
 */
function getSectionScoresFromAttempt(attempt: ExamAttempt, exam: Exam): string {
  const examNegativeMarks = exam.settings?.negativeMarks ?? 0;
  const sections = new Map<string, { total: number; obtained: number }>();

  exam.questions.forEach(q => {
    const section = q.section || 'Unsorted';
    const entry = sections.get(section) ?? { total: 0, obtained: 0 };
    const marks = q.marks || 1;
    entry.total += marks;

    const ans = attempt.answers.find(a => a.questionId === q.id);
    if (ans && ans.selectedAnswer !== null) {
      if (ans.selectedAnswer === q.correctAnswer) {
        entry.obtained += marks;
      } else {
        entry.obtained -= q.negativeMarks ?? examNegativeMarks;
      }
    }

    sections.set(section, entry);
  });

  return Array.from(sections.entries())
    .map(([section, { total, obtained }]) => {
      const positiveObtained = Math.max(0, obtained);
      const percent = total > 0 ? Math.round((positiveObtained / total) * 100) : 0;
      return `${section}: ${positiveObtained}/${total} (${percent}%)`;
    })
    .join(' | ');
}

/**
 * Helper: Compute result metrics using question-wise marks
 */
function getAttemptMetrics(attempt: ExamAttempt, exam: Exam) {
  const examNegativeMarks = exam.settings?.negativeMarks ?? 0;
  let attempted = 0;
  let correct = 0;
  let wrong = 0;

  const totalMarks = exam.questions.reduce((sum, q) => sum + (q.marks || 1), 0);
  let obtainedMarks = 0;

  exam.questions.forEach((q) => {
    const ans = attempt.answers.find(a => a.questionId === q.id);
    if (!ans || ans.selectedAnswer === null) return;

    attempted++;
    if (ans.selectedAnswer === q.correctAnswer) {
      correct++;
      obtainedMarks += q.marks || 1;
    } else {
      wrong++;
      obtainedMarks -= q.negativeMarks ?? examNegativeMarks;
    }
  });

  obtainedMarks = Math.max(0, obtainedMarks);
  const percentage = totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 100) : 0;

  return { attempted, correct, wrong, obtainedMarks, totalMarks, percentage };
}

/**
 * Helper: Determine submission status
 */
function getSubmissionStatus(attempt: ExamAttempt, exam: Exam): 'Normal Submit' | 'Limit Exceeded' {
  if (attempt.tabSwitches >= exam.settings.maxTabSwitches) {
    return 'Limit Exceeded';
  }
  return 'Normal Submit';
}

/**
 * Helper: Format date/time for reports
 */
function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

/**
 * Helper: Resolve per-question time from answer payload or fallback estimate
 */
function getQuestionTimeSeconds(answer: any, fallbackSeconds: number): number {
  const candidates = [
    answer?.timeSpentSeconds,
    answer?.timeSpent,
    answer?.timeTaken,
    answer?.time_taken,
    answer?.duration,
    answer?.durationSeconds,
  ];

  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.round(parsed);
    }
  }

  return fallbackSeconds;
}

/**
 * Helper: Get color for cell based on answer status
 */
function getColorForAnswer(isCorrect: boolean | null, isUnattempted: boolean, isAfterTabSwitchExceed: boolean): string {
  if (isAfterTabSwitchExceed) return 'FF2196F3'; // Blue - Tab switch submit marker
  if (isUnattempted) return 'FFFFFF00'; // Yellow - Unattempted
  if (isCorrect === true) return 'FF4CAF50'; // Green - Correct
  if (isCorrect === false) return 'FFF44336'; // Red - Wrong
  return 'FFFFFFFF'; // White - Default
}

/**
 * Helper: Calculate question-level statistics
 */
function getQuestionStats(question: any, results: ExamResult[], attempts: ExamAttempt[], exam: Exam) {
  let correct = 0;
  let incorrect = 0;
  let unattempted = 0;
  let totalTime = 0;
  let count = 0;

  attempts.forEach(attempt => {
    const result = results.find(r => r.attemptId === attempt.id);
    if (!result) return;

    const ans = attempt.answers.find(a => a.questionId === question.id);
    const isUnattempted = ans === undefined || ans.selectedAnswer === null;

    if (isUnattempted) {
      unattempted++;
    } else if (ans && ans.selectedAnswer === question.correctAnswer) {
      correct++;
    } else {
      incorrect++;
    }

    if (attempt.submittedAt && attempt.startedAt) {
      totalTime += new Date(attempt.submittedAt).getTime() - new Date(attempt.startedAt).getTime();
      count++;
    }
  });

  const avgTimePerQuestion = count > 0 ? Math.round((totalTime / count) / 1000) : 0;
  const accuracy = (correct + incorrect) > 0 ? ((correct / (correct + incorrect)) * 100).toFixed(2) : '0';

  return { correct, incorrect, unattempted, avgTimePerQuestion, accuracy };
}

/**
 * Helper: Add professional section header
 */
function addSectionHeader(worksheet: ExcelJS.Worksheet, title: string) {
  const headerRow = worksheet.addRow([title]);
  headerRow.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8F5E9' }, // Light green
  };
  headerRow.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF008037' } };
  headerRow.height = 18;
  worksheet.addRow([]); // Spacing
}

/**
 * PROFESSIONAL EXCEL EXPORT
 */
export async function exportExamResultsToExcel(
  exam: Exam,
  candidates: Candidate[],
  results: ExamResult[],
  attempts?: ExamAttempt[],
  selectedColumns?: string[]
) {
  const wb = new ExcelJS.Workbook();

  // Load logo image once
  const logoBuffer = await loadLogoImage();

  // Filter valid attempts
  const validAttempts = (attempts || []).filter(a => a.isSubmitted);
  const filteredResults = results.filter(r => validAttempts.some(a => a.id === r.attemptId));

  // Create sheets in required display order
  const dashboardSheet = wb.addWorksheet('Overall Analytics');
  const studentQuestionsSheet = wb.addWorksheet('Student Questions');
  const resultsSheet = wb.addWorksheet('Results');

  // Add consistent branded header to Results sheet
  addBrandedSheetHeader(
    wb,
    resultsSheet,
    logoBuffer,
    'ATOM EXAM SYSTEM - EXAM RESULTS',
    'Candidate Performance Report',
    14
  );

  // ============================================================
  // SHEET 4: RESULTS
  // ============================================================
  const resultsHeaderCells = [
    'Student Name',
    'Email',
    'College',
    'USN',
    'Attempted',
    'Correct',
    'Wrong',
    'Marks',
    'Percentage',
    'Tab Switch',
    'Status',
    'Started At',
    'Completed At',
    'Section-wise Scores'
  ];
  const resultsHeaderRow = resultsSheet.addRow(resultsHeaderCells);
  
  resultsHeaderRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF008037' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  resultsHeaderRow.height = 25;

  filteredResults.forEach((result, idx) => {
    const candidate = candidates.find(c => c.id === result.candidateId);
    const attempt = validAttempts.find(a => a.id === result.attemptId);
    const sectionScores = attempt ? getSectionScoresFromAttempt(attempt, exam) : 'N/A';
    const metrics = attempt ? getAttemptMetrics(attempt, exam) : null;
    const tabSwitches = attempt?.tabSwitches ?? 0;
    const status = attempt ? getSubmissionStatus(attempt, exam) : 'Normal Submit';

    const row = resultsSheet.addRow([
      candidate?.name || 'Unknown',
      candidate?.email || '',
      candidate?.college || '',
      candidate?.usn || '',
      metrics?.attempted ?? result.totalQuestions - result.unanswered,
      metrics?.correct ?? result.correctAnswers,
      metrics?.wrong ?? result.wrongAnswers,
      `${metrics?.obtainedMarks ?? result.obtainedMarks}/${metrics?.totalMarks ?? result.totalMarks}`,
      `${metrics?.percentage ?? result.percentage}%`,
      tabSwitches,
      status,
      formatDateTime(attempt?.startedAt),
      formatDateTime(attempt?.submittedAt),
      sectionScores,
    ]);

    // Alternate row colors
    if (idx % 2 === 0) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F8E9' } };
      });
    }

    // Center align numeric/status columns
    row.getCell(5).alignment = { horizontal: 'center' };
    row.getCell(6).alignment = { horizontal: 'center' };
    row.getCell(7).alignment = { horizontal: 'center' };
    row.getCell(8).alignment = { horizontal: 'center' };
    row.getCell(9).alignment = { horizontal: 'center' };
    row.getCell(10).alignment = { horizontal: 'center' };
    row.getCell(11).alignment = { horizontal: 'center' };

    if (status === 'Limit Exceeded') {
      row.getCell(11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0E0' } };
      row.getCell(11).font = { color: { argb: 'FFCC0000' }, bold: true };
    }
  });

  resultsSheet.columns = [
    { width: 20 }, { width: 25 }, { width: 18 }, { width: 14 },
    { width: 12 }, { width: 10 }, { width: 10 }, { width: 15 },
    { width: 12 }, { width: 10 }, { width: 16 }, { width: 20 },
    { width: 20 }, { width: 35 }
  ];

  // Add footer with branding
  resultsSheet.addRow([]);
  const footerRow = resultsSheet.addRow(['Powered by ATOM']);
  footerRow.getCell(1).font = {
    bold: true,
    size: 11,
    italic: true,
    color: { argb: 'FF008037' },
  };
  footerRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  footerRow.height = 20;
  resultsSheet.mergeCells(`A${footerRow.number}:N${footerRow.number}`);

  // ============================================================
  // SHEET 2: STUDENT QUESTIONS
  // ============================================================
  const studentSheetColumnCount = 13 + (exam.questions.length * 2);
  addBrandedSheetHeader(
    wb,
    studentQuestionsSheet,
    logoBuffer,
    'ATOM EXAM SYSTEM - STUDENT QUESTION DETAILS',
    'Individual Student Response Analysis',
    studentSheetColumnCount
  );

  const sqHeaders = ['Name', 'Email', 'College', 'USN', 'Department', 'Section', 'Tab Switches', 'Status', 'Exam Started At', 'Completed At'];
  exam.questions.forEach((q, idx) => {
    sqHeaders.push(`Q${idx + 1}`);
  });
  exam.questions.forEach((q, idx) => {
    sqHeaders.push(`Q${idx + 1} Time (sec)`);
  });
  sqHeaders.push('Correct', 'Wrong', 'Unattempted');

  const sqHeaderRow = studentQuestionsSheet.addRow(sqHeaders);
  sqHeaderRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF008037' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  sqHeaderRow.height = 25;

  filteredResults.forEach(result => {
    const candidate = candidates.find(c => c.id === result.candidateId);
    const attempt = validAttempts.find(a => a.id === result.attemptId);
    const status = attempt ? getSubmissionStatus(attempt, exam) : 'Normal Submit';
    const startedAt = formatDateTime(attempt?.startedAt);
    const completedAt = formatDateTime(attempt?.submittedAt);
    const tabSwitchCount = attempt?.tabSwitches ?? 0;

    const startedMs = attempt?.startedAt ? new Date(attempt.startedAt).getTime() : NaN;
    const submittedMs = attempt?.submittedAt ? new Date(attempt.submittedAt).getTime() : NaN;
    const totalAttemptSec = Number.isFinite(startedMs) && Number.isFinite(submittedMs) && submittedMs > startedMs
      ? Math.round((submittedMs - startedMs) / 1000)
      : 0;

    const answeredCount = exam.questions.reduce((count, q) => {
      const ans = attempt?.answers.find(a => a.questionId === q.id);
      return count + (ans && ans.selectedAnswer !== null ? 1 : 0);
    }, 0);

    const fallbackPerQuestionSec = answeredCount > 0
      ? Math.max(1, Math.round(totalAttemptSec / answeredCount))
      : 0;

    const sectionDisplay = (candidate?.section && String(candidate.section).trim()) || '-';

    const rowData = [
      candidate?.name || 'Unknown',
      candidate?.email || '',
      candidate?.college || '',
      candidate?.usn || '',
      candidate?.department || '',
      sectionDisplay,
      String(tabSwitchCount),
      status,
      startedAt,
      completedAt,
    ];

    const questionStatuses: string[] = [];
    const questionTimes: string[] = [];

    let correctCount = 0, wrongCount = 0, unattemptedCount = 0;

    // Add question indicators with color coding
    exam.questions.forEach((q) => {
      const ans = attempt?.answers.find(a => a.questionId === q.id);
      const isUnattempted = ans === undefined || ans.selectedAnswer === null;

      if (isUnattempted) {
        unattemptedCount++;
        questionStatuses.push('U');
        questionTimes.push('0');
      } else if (ans && ans.selectedAnswer === q.correctAnswer) {
        correctCount++;
        questionStatuses.push('C');
        questionTimes.push(String(getQuestionTimeSeconds(ans, fallbackPerQuestionSec)));
      } else {
        wrongCount++;
        questionStatuses.push('W');
        questionTimes.push(String(getQuestionTimeSeconds(ans, fallbackPerQuestionSec)));
      }
    });

    rowData.push(...questionStatuses);
    rowData.push(...questionTimes);

    rowData.push(String(correctCount), String(wrongCount), String(unattemptedCount));

    const row = studentQuestionsSheet.addRow(rowData);

    // Color code question status columns
    const statusStartIndex = 10;
    for (let i = statusStartIndex; i < statusStartIndex + exam.questions.length; i++) {
      const cellValue = rowData[i];
      let bgColor = 'FFFFFFFF';
      let textColor = 'FF000000';

      if (cellValue === 'C') {
        bgColor = 'FF4CAF50'; // Green
        textColor = 'FFFFFFFF';
      } else if (cellValue === 'W') {
        bgColor = 'FFF44336'; // Red
        textColor = 'FFFFFFFF';
      } else if (cellValue === 'U') {
        bgColor = 'FFFFFF00'; // Yellow
      }

      row.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      row.getCell(i + 1).font = { color: { argb: textColor }, bold: true };
      row.getCell(i + 1).alignment = { horizontal: 'center', vertical: 'middle' };
    }

    // Highlight status cell and center key numeric/text columns
    const statusCell = row.getCell(8);
    if (status === 'Limit Exceeded') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0E0' } };
      statusCell.font = { color: { argb: 'FFCC0000' }, bold: true };
    } else {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
      statusCell.font = { color: { argb: 'FF2E7D32' }, bold: true };
    }

    row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };

    const questionTimeStart = statusStartIndex + exam.questions.length;
    for (let i = questionTimeStart; i < questionTimeStart + exam.questions.length; i++) {
      row.getCell(i + 1).alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });

  const sqColumns = [
    { width: 18 }, { width: 22 }, { width: 16 }, { width: 14 },
    { width: 14 }, { width: 12 }, { width: 12 }, { width: 16 }, { width: 20 }, { width: 20 }
  ];
  exam.questions.forEach(() => sqColumns.push({ width: 6 }));
  exam.questions.forEach(() => sqColumns.push({ width: 10 }));
  sqColumns.push({ width: 10 }, { width: 10 }, { width: 13 });
  studentQuestionsSheet.columns = sqColumns;

  // Add footer to Student Questions sheet
  studentQuestionsSheet.addRow([]);
  const sqFooterRow = studentQuestionsSheet.addRow(['Powered by ATOM']);
  sqFooterRow.getCell(1).font = {
    bold: true,
    size: 11,
    italic: true,
    color: { argb: 'FF008037' },
  };
  sqFooterRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  sqFooterRow.height = 20;
  studentQuestionsSheet.mergeCells(sqFooterRow.number, 1, sqFooterRow.number, studentSheetColumnCount);

  // ============================================================
  // SHEET 1: OVERALL ANALYTICS (DASHBOARD)
  // ============================================================
  addBrandedSheetHeader(
    wb,
    dashboardSheet,
    logoBuffer,
    'ATOM EXAM SYSTEM - EXAM ANALYTICS',
    'Exam Performance Summary',
    2
  );

  const attemptMetricsList = validAttempts.map(a => getAttemptMetrics(a, exam));
  const passCount = attemptMetricsList.filter(m => m.percentage >= 50).length;
  const failCount = attemptMetricsList.filter(m => m.percentage < 50).length;
  const avgPercentage = attemptMetricsList.length > 0
    ? (attemptMetricsList.reduce((sum, m) => sum + m.percentage, 0) / attemptMetricsList.length).toFixed(2)
    : '0';
  const avgMarks = attemptMetricsList.length > 0
    ? (attemptMetricsList.reduce((sum, m) => sum + m.obtainedMarks, 0) / attemptMetricsList.length).toFixed(2)
    : '0';

  addSectionHeader(dashboardSheet, 'SUMMARY STATISTICS');
  dashboardSheet.addRow(['Exam Name', exam.name]);
  dashboardSheet.addRow(['Exam Code', exam.code]);
  dashboardSheet.addRow(['Total Questions', exam.questions.length]);

  addSectionHeader(dashboardSheet, 'COMPLETION DATA');
  dashboardSheet.addRow(['Total Candidates', candidates.length]);
  dashboardSheet.addRow(['Candidates Completed', validAttempts.length]);
  dashboardSheet.addRow(['Completion Rate', candidates.length > 0 ? ((validAttempts.length / candidates.length) * 100).toFixed(2) + '%' : '0%']);

  // Format dashboard content
  dashboardSheet.eachRow((row, rowNumber) => {
    if (rowNumber > 4) { // Skip header rows
      row.getCell(1).font = { bold: true, size: 11 };
      row.getCell(2).alignment = { horizontal: 'right' };
    }
  });

  dashboardSheet.columns = [{ width: 30 }, { width: 25 }];

  // Add footer to Overall Analytics sheet
  dashboardSheet.addRow([]);
  const dashFooterRow = dashboardSheet.addRow(['Powered by ATOM']);
  dashFooterRow.getCell(1).font = {
    bold: true,
    size: 11,
    italic: true,
    color: { argb: 'FF008037' },
  };
  dashFooterRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  dashFooterRow.height = 20;
  dashboardSheet.mergeCells(`A${dashFooterRow.number}:B${dashFooterRow.number}`);

  // Save the file
  await downloadExcelFile(wb, `${exam.name}_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
}

/**
 * Import candidates from Excel file
 */
export function importCandidatesFromExcel(
  file: File,
  examId: string
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const candidates: any[] = jsonData.map((row: any) => ({
          id: crypto.randomUUID(),
          examId,
          name: row.Name || row.name || '',
          email: row.Email || row.email || '',
          phone: row.Phone || row.phone || '',
          college: row.College || row.college || '',
          usn: row.USN || row.usn || row.Usn || '',
          department: row.Department || row.department || '',
          section: row.Section || row.section || '',
          registeredAt: new Date().toISOString(),
        }));

        resolve(candidates);
      } catch (error) {
        reject(new Error('Failed to parse Excel file: ' + (error as Error).message));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Import questions from Excel file
 */
export function importQuestionsFromExcel(
  file: File
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const parsed = parseQuestionsFromWorkbook(workbook);
        resolve(parsed.validQuestions);
      } catch (error) {
        reject(new Error('Failed to parse Excel file: ' + (error as Error).message));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

export function previewQuestionsFromExcel(file: File): Promise<{ validQuestions: any[]; invalidRows: { rowNumber: number; reason: string }[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        resolve(parseQuestionsFromWorkbook(workbook));
      } catch (error) {
        reject(new Error('Failed to parse Excel file: ' + (error as Error).message));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

function parseQuestionsFromWorkbook(workbook: XLSX.WorkBook): { validQuestions: any[]; invalidRows: { rowNumber: number; reason: string }[] } {
  // Pick the first sheet that looks like a questions sheet.
  const targetSheetName = workbook.SheetNames.find((name) => {
    const sheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[];
    if (!rows.length) return false;
    const sample = rows[0] || {};
    const keys = Object.keys(sample).map(k => k.toLowerCase());
    return keys.includes('question') && (keys.includes('option a') || keys.includes('option 1'));
  }) || workbook.SheetNames[0];

  const worksheet = workbook.Sheets[targetSheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as any[];

  const validQuestions: any[] = [];
  const invalidRows: { rowNumber: number; reason: string }[] = [];

  jsonData.forEach((row, idx) => {
    const text = (row.Question || row.question || '').toString().trim();
    const typeRaw = (row.Type || row.type || 'MCQ').toString().trim().toLowerCase();
    const type = typeRaw === 'mcq-image' ? 'mcq-image' : typeRaw === 'true-false' ? 'true-false' : typeRaw === 'reading-comprehension' ? 'reading-comprehension' : 'mcq';
    const options = [
      (row['Option A'] || row['Option 1'] || '').toString().trim(),
      (row['Option B'] || row['Option 2'] || '').toString().trim(),
      (row['Option C'] || row['Option 3'] || '').toString().trim(),
      (row['Option D'] || row['Option 4'] || '').toString().trim(),
    ];

    const correctRaw = (row['Correct Answer'] || row['correct'] || '').toString().trim().toUpperCase();
    const numericCandidate = Number(correctRaw);
    const answerIndex = /^[A-D]$/.test(correctRaw) ? correctRaw.charCodeAt(0) - 65 : numericCandidate;
    const correctAnswer = Number.isInteger(answerIndex) ? answerIndex : -1;

    if (!text) {
      invalidRows.push({ rowNumber: idx + 2, reason: 'Question text is empty' });
      return;
    }

    if (correctAnswer < 0 || correctAnswer > 3) {
      invalidRows.push({ rowNumber: idx + 2, reason: 'Correct Answer must be A/B/C/D or 0-3' });
      return;
    }

    if (!options[correctAnswer]) {
      invalidRows.push({ rowNumber: idx + 2, reason: `Correct option ${String.fromCharCode(65 + correctAnswer)} is empty` });
      return;
    }

    validQuestions.push({
      text,
      type,
      options,
      correctAnswer,
      marks: Number(row.Marks || row.marks || 1),
      section: row.Section || row.section || undefined,
    });
  });

  return { validQuestions, invalidRows };
}

/**
 * Download sample candidate template
 */
export function downloadCandidateTemplate() {
  const templateData = [
    {
      Name: 'John Doe',
      Email: 'john@example.com',
      Phone: '9876543210',
      College: 'ABC Engineering College',
      USN: '1GA21CS001',
      Department: 'CSE',
      Section: 'A',
    },
    {
      Name: 'Jane Smith',
      Email: 'jane@example.com',
      Phone: '9876543211',
      College: 'ABC Engineering College',
      USN: '1GA21CS002',
      Department: 'CSE',
      Section: 'A',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(templateData);
  ws['!cols'] = [
    { wch: 20 },
    { wch: 25 },
    { wch: 15 },
    { wch: 25 },
    { wch: 15 },
    { wch: 12 },
    { wch: 10 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Candidates');
  XLSX.writeFile(wb, 'Candidate_Template.xlsx');
}

/**
 * Download sample questions template
 */
export function downloadQuestionsTemplate() {
  // Create workbook with a single examples sheet
  const wb = XLSX.utils.book_new();

  // Single sheet: Examples for each question type
  const examplesData = [
    {
      Question: 'What is 2 + 2?',
      Type: 'MCQ',
      Passage: '',
      'Option A': '3',
      'Option B': '4',
      'Option C': '5',
      'Option D': '6',
      'Image URL': '',
      'Option A Image': '',
      'Option B Image': '',
      'Option C Image': '',
      'Option D Image': '',
      'Correct Answer': 'B',
      Marks: 1,
      Section: 'Mathematics',
    },
    {
      Question: 'Which graph shows the function y=2x?',
      Type: 'MCQ-Image',
      Passage: '',
      'Option A': 'Graph 1',
      'Option B': 'Graph 2',
      'Option C': 'Graph 3',
      'Option D': 'Graph 4',
      'Image URL': 'https://example.com/question-image.jpg',
      'Option A Image': 'https://example.com/graph1.jpg',
      'Option B Image': 'https://example.com/graph2.jpg',
      'Option C Image': 'https://example.com/graph3.jpg',
      'Option D Image': 'https://example.com/graph4.jpg',
      'Correct Answer': 'B',
      Marks: 2,
      Section: 'Mathematics',
    },
    {
      Question: 'The Earth is flat.',
      Type: 'True-False',
      Passage: '',
      'Option A': 'True',
      'Option B': 'False',
      'Option C': '',
      'Option D': '',
      'Image URL': '',
      'Option A Image': '',
      'Option B Image': '',
      'Option C Image': '',
      'Option D Image': '',
      'Correct Answer': 'B',
      Marks: 1,
      Section: 'Science',
    },
    {
      Question: 'What is the main idea of this passage?',
      Type: 'Reading-Comprehension',
      Passage: 'The Industrial Revolution was a period of human history comprising the social and economic changes that transformed agrarian, feudal societies into industrial, urban ones. It began in Britain in the late 18th century and spread throughout Europe.',
      'Option A': 'The Industrial Revolution only happened in Europe',
      'Option B': 'The Industrial Revolution transformed agrarian societies into industrial urban ones',
      'Option C': 'The Industrial Revolution caused economic decline',
      'Option D': 'The Industrial Revolution started in France',
      'Image URL': '',
      'Option A Image': '',
      'Option B Image': '',
      'Option C Image': '',
      'Option D Image': '',
      'Correct Answer': 'B',
      Marks: 2,
      Section: 'History',
    },
  ];

  const examplesSheet = XLSX.utils.json_to_sheet(examplesData);
  examplesSheet['!cols'] = [
    { wch: 35 }, // Question
    { wch: 18 }, // Type
    { wch: 40 }, // Passage
    { wch: 20 }, // Option A
    { wch: 20 }, // Option B
    { wch: 20 }, // Option C
    { wch: 20 }, // Option D
    { wch: 30 }, // Image URL
    { wch: 25 }, // Option A Image
    { wch: 25 }, // Option B Image
    { wch: 25 }, // Option C Image
    { wch: 25 }, // Option D Image
    { wch: 15 }, // Correct Answer
    { wch: 8 },  // Marks
    { wch: 20 }, // Section
  ];

  // Style header row
  const headerRow = examplesSheet['!data']?.[0];
  if (headerRow) {
    headerRow.forEach((cell: any) => {
      if (cell) {
        cell.s = {
          fill: { fgColor: { rgb: 'FF008037' } },
          font: { bold: true, color: { rgb: 'FFFFFFFF' } },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }
    });
  }

  XLSX.utils.book_append_sheet(wb, examplesSheet, ' Examples');

  XLSX.writeFile(wb, 'Questions_Template.xlsx');
}
