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

  if (sections.size === 0) return 'N/A';

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
  if ((exam.settings.maxTabSwitches ?? 0) > 0 && attempt.tabSwitches >= exam.settings.maxTabSwitches) {
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
  const resultsSheet = wb.addWorksheet('Results');
  const studentQuestionsSheet = wb.addWorksheet('Student Questions');
  const questionPaperSheet = wb.addWorksheet('Question Paper');

  // Add consistent branded header to Results sheet
  addBrandedSheetHeader(
    wb,
    resultsSheet,
    logoBuffer,
    'ATOM QMS - EXAM RESULTS',
    'Candidate Performance Report',
    14
  );

  // ============================================================
  // SHEET 4: RESULTS
  // ============================================================
  const resultsHeaderCells = [
    'Student Name',
    'Email',
    'Contact',
    'College',
    'USN',
    'Device & Mode',
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

    const deviceDisplay = attempt?.deviceName || candidate?.deviceName || candidate?.deviceType || 'Laptop / Desktop';

    const row = resultsSheet.addRow([
      candidate?.name || 'Unknown',
      candidate?.email || '',
      candidate?.phone || '',
      candidate?.college || '',
      candidate?.usn || '',
      deviceDisplay,
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
    row.getCell(6).alignment = { horizontal: 'center' };
    row.getCell(7).alignment = { horizontal: 'center' };
    row.getCell(8).alignment = { horizontal: 'center' };
    row.getCell(9).alignment = { horizontal: 'center' };
    row.getCell(10).alignment = { horizontal: 'center' };
    row.getCell(11).alignment = { horizontal: 'center' };
    row.getCell(12).alignment = { horizontal: 'center' };
    row.getCell(13).alignment = { horizontal: 'center' };

    if (status === 'Limit Exceeded') {
      row.getCell(13).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0E0' } };
      row.getCell(13).font = { color: { argb: 'FFCC0000' }, bold: true };
    }

    if (deviceDisplay.toLowerCase().includes('desktop mode')) {
      row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
      row.getCell(6).font = { color: { argb: 'FF856404' }, bold: true };
    }
  });

  resultsSheet.columns = [
    { width: 20 }, { width: 25 }, { width: 16 }, { width: 18 }, { width: 14 },
    { width: 22 }, { width: 12 }, { width: 10 }, { width: 10 }, { width: 15 },
    { width: 12 }, { width: 10 }, { width: 16 }, { width: 20 },
    { width: 20 }, { width: 35 }
  ];

  // Add footer with branding
  resultsSheet.addRow([]);
  const footerRow = resultsSheet.addRow(['Powered by ATOM QMS']);
  footerRow.getCell(1).font = {
    bold: true,
    size: 11,
    italic: true,
    color: { argb: 'FF008037' },
  };
  footerRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  footerRow.height = 20;
  resultsSheet.mergeCells(`A${footerRow.number}:O${footerRow.number}`);

  // ============================================================
  // SHEET 2: STUDENT QUESTIONS
  // ============================================================
    const studentSheetColumnCount = 15 + (exam.questions.length * 2);
  addBrandedSheetHeader(
    wb,
    studentQuestionsSheet,
    logoBuffer,
    'ATOM QMS - STUDENT QUESTION DETAILS',
    'Individual Student Response Analysis',
    studentSheetColumnCount
  );

  const sqHeaders = ['Name', 'Email', 'Contact', 'College', 'USN', 'Department', 'Section', 'Device & Mode', 'Tab Switches', 'Status', 'Exam Started At', 'Completed At'];
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
    const deviceDisplay = attempt?.deviceName || candidate?.deviceName || candidate?.deviceType || 'Laptop / Desktop';

    const rowData = [
      candidate?.name || 'Unknown',
      candidate?.email || '',
      candidate?.phone || '',
      candidate?.college || '',
      candidate?.usn || '',
      candidate?.department || '',
      sectionDisplay,
      deviceDisplay,
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
  const sqFooterRow = studentQuestionsSheet.addRow(['Powered by ATOM QMS']);
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
    'ATOM QMS - EXAM ANALYTICS',
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
  const dashFooterRow = dashboardSheet.addRow(['Powered by ATOM QMS']);
  dashFooterRow.getCell(1).font = {
    bold: true,
    size: 11,
    italic: true,
    color: { argb: 'FF008037' },
  };
  dashFooterRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  dashFooterRow.height = 20;
  dashboardSheet.mergeCells(`A${dashFooterRow.number}:B${dashFooterRow.number}`);

  // ============================================================
  // SHEET: QUESTION PAPER
  // ============================================================
  addQuestionPaperWorksheet(wb, questionPaperSheet, exam, logoBuffer);

  // Save the file
  await downloadExcelFile(wb, `${exam.name}_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
}

/**
 * Add Question Paper worksheet to an ExcelJS workbook
 */
export function addQuestionPaperWorksheet(
  wb: ExcelJS.Workbook,
  qpSheet: ExcelJS.Worksheet,
  exam: Exam,
  logoBuffer: ArrayBuffer | null
) {
  const qpColumnsCount = 13;

  // Branded Header
  addBrandedSheetHeader(
    wb,
    qpSheet,
    logoBuffer,
    'ATOM QMS - EXAM QUESTION PAPER & ANSWER KEY',
    `${exam.name} (${exam.code}) | Total Questions: ${exam.questions.length} | Total Marks: ${exam.questions.reduce((sum, q) => sum + (q.marks || 1), 0)}`,
    qpColumnsCount
  );

  // Table Headers
  const qpHeaders = [
    'Q#',
    'Question & Program Code',
    'Type',
    'Section',
    'Reading Passage',
    'Option A',
    'Option B',
    'Option C',
    'Option D',
    'Correct Option',
    'Correct Answer Text',
    'Marks (+)',
    'Negative Marks (-)',
  ];

  const qpHeaderRow = qpSheet.addRow(qpHeaders);
  qpHeaderRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF008037' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF005A26' } },
      left: { style: 'thin', color: { argb: 'FF005A26' } },
      bottom: { style: 'medium', color: { argb: 'FF005A26' } },
      right: { style: 'thin', color: { argb: 'FF005A26' } },
    };
  });
  qpHeaderRow.height = 28;

  // Question Rows
  const examNegMarks = exam.settings?.negativeMarks ?? 0;

  exam.questions.forEach((q, idx) => {
    const qNum = idx + 1;
    const typeLabel = q.type === 'mcq' ? 'MCQ' : q.type === 'mcq-image' ? 'MCQ + Image' : q.type === 'true-false' ? 'True/False' : 'Reading Comprehension';
    const optA = q.options[0] || '';
    const optB = q.options[1] || '';
    const optC = q.options[2] || '';
    const optD = q.options[3] || '';
    const correctLetter = String.fromCharCode(65 + (q.correctAnswer ?? 0));
    const correctText = q.options[q.correctAnswer] || '';
    const marks = q.marks || 1;
    const negMarks = q.negativeMarks ?? examNegMarks;

    const rowData = [
      `Q${qNum}`,
      q.text || '',
      typeLabel,
      q.section || 'General',
      q.passage || '',
      optA,
      optB,
      optC,
      optD,
      correctLetter,
      correctText,
      marks,
      negMarks > 0 ? `-${negMarks}` : 0,
    ];

    const row = qpSheet.addRow(rowData);
    const isZebra = idx % 2 === 1;

    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };

      cell.font = { size: 9.5 };
      cell.alignment = { vertical: 'top', wrapText: true };

      if (isZebra) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      }

      if (colNumber === 1) {
        cell.font = { bold: true, size: 10, color: { argb: 'FF008037' } };
        cell.alignment = { horizontal: 'center', vertical: 'top' };
      } else if (colNumber === 2) {
        // Question & Code font with exact indentation
        cell.font = { name: 'Consolas', size: 9.5 };
        cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
      } else if (colNumber === 3) {
        cell.alignment = { horizontal: 'center', vertical: 'top' };
      } else if (colNumber === 10) {
        cell.font = { bold: true, size: 11, color: { argb: 'FF008037' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
        cell.alignment = { horizontal: 'center', vertical: 'top' };
      } else if (colNumber === 11) {
        cell.font = { bold: true, size: 9.5, color: { argb: 'FF00692C' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F8F4' } };
        cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
      } else if (colNumber === 12 || colNumber === 13) {
        cell.alignment = { horizontal: 'center', vertical: 'top' };
      }
    });

    const lineCount = (q.text || '').split('\n').length;
    if (lineCount > 1) {
      row.height = Math.max(24, Math.min(220, lineCount * 14 + 10));
    }
  });

  // Column widths
  qpSheet.columns = [
    { width: 8 },  // Q#
    { width: 62 }, // Question & Program Code
    { width: 15 }, // Type
    { width: 18 }, // Section
    { width: 35 }, // Reading Passage
    { width: 25 }, // Option A
    { width: 25 }, // Option B
    { width: 25 }, // Option C
    { width: 25 }, // Option D
    { width: 14 }, // Correct Option
    { width: 28 }, // Correct Answer Text
    { width: 10 }, // Marks (+)
    { width: 14 }, // Negative Marks (-)
  ];

  // Footer
  qpSheet.addRow([]);
  const qpFooterRow = qpSheet.addRow(['Powered by ATOM QMS - Exam Question Paper']);
  qpFooterRow.getCell(1).font = {
    bold: true,
    size: 11,
    italic: true,
    color: { argb: 'FF008037' },
  };
  qpFooterRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  qpFooterRow.height = 20;
  qpSheet.mergeCells(qpFooterRow.number, 1, qpFooterRow.number, qpColumnsCount);
}

/**
 * Export standalone Exam Question Paper to Excel
 */
export async function downloadExamQuestionPaper(exam: Exam) {
  const wb = new ExcelJS.Workbook();
  const logoBuffer = await loadLogoImage();
  const qpSheet = wb.addWorksheet('Question Paper');
  addQuestionPaperWorksheet(wb, qpSheet, exam, logoBuffer);
  await downloadExcelFile(wb, `${exam.name}_Question_Paper_${new Date().toISOString().split('T')[0]}.xlsx`);
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

function getRowValue(row: Record<string, any>, candidateKeys: string[]): string {
  const normalizedCandidateKeys = candidateKeys.map(k => k.toLowerCase().replace(/[\s_-]+/g, ''));
  for (const [key, val] of Object.entries(row)) {
    const cleanKey = key.toLowerCase().replace(/[\s_-]+/g, '');
    if (normalizedCandidateKeys.includes(cleanKey)) {
      return val !== null && val !== undefined ? String(val) : '';
    }
  }
  return '';
}

function cleanCellText(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val);
  // Normalize Windows CRLF and Mac CR to standard Unix LF
  str = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // If user typed literal \n instead of pressing Alt+Enter in Excel
  if (!str.includes('\n') && (str.includes('\\n') || str.includes('\\r\\n'))) {
    str = str.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
  }
  // Trim outer empty lines from very start and end, but strictly preserve line indentation!
  return str.replace(/^\n+/, '').replace(/\s+$/, '');
}

function parseQuestionsFromWorkbook(workbook: XLSX.WorkBook): { validQuestions: any[]; invalidRows: { rowNumber: number; reason: string }[] } {
  // Pick the first sheet that looks like a questions sheet.
  const targetSheetName = workbook.SheetNames.find((name) => {
    const sheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[];
    if (!rows.length) return false;
    const sample = rows[0] || {};
    const keys = Object.keys(sample).map(k => k.toLowerCase().replace(/[\s_-]+/g, ''));
    return keys.some(k => k.includes('question')) && (keys.some(k => k.includes('optiona') || k.includes('option1') || k.includes('opt1')));
  }) || workbook.SheetNames[0];

  const worksheet = workbook.Sheets[targetSheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as any[];

  const validQuestions: any[] = [];
  const invalidRows: { rowNumber: number; reason: string }[] = [];

  jsonData.forEach((row, idx) => {
    // Preserve exact question text formatting and indentation
    const textRaw = getRowValue(row, ['question', 'questiontext', 'problem', 'code']) || (row.Question || row.question || '');
    const text = cleanCellText(textRaw);

    const typeRaw = (getRowValue(row, ['type', 'questiontype']) || row.Type || row.type || 'MCQ').toString().trim().toLowerCase();
    const type = typeRaw.includes('image') ? 'mcq-image' : typeRaw.includes('true') || typeRaw === 'tf' ? 'true-false' : typeRaw.includes('reading') || typeRaw.includes('comprehension') || typeRaw === 'rc' ? 'reading-comprehension' : 'mcq';

    const optA = cleanCellText(getRowValue(row, ['optiona', 'option1', 'opt1', 'opta', 'a']) || row['Option A'] || row['Option 1'] || '');
    const optB = cleanCellText(getRowValue(row, ['optionb', 'option2', 'opt2', 'optb', 'b']) || row['Option B'] || row['Option 2'] || '');
    const optC = cleanCellText(getRowValue(row, ['optionc', 'option3', 'opt3', 'optc', 'c']) || row['Option C'] || row['Option 3'] || '');
    const optD = cleanCellText(getRowValue(row, ['optiond', 'option4', 'opt4', 'optd', 'd']) || row['Option D'] || row['Option 4'] || '');

    const options = [optA, optB, optC, optD];

    const correctRaw = (getRowValue(row, ['correctanswer', 'correct', 'answer', 'ans']) || row['Correct Answer'] || row['correct'] || '').toString().trim().toUpperCase();
    const numericCandidate = Number(correctRaw);
    // Support A, B, C, D or 1, 2, 3, 4 or 0, 1, 2, 3
    let answerIndex = -1;
    if (/^[A-D]$/.test(correctRaw)) {
      answerIndex = correctRaw.charCodeAt(0) - 65;
    } else if (Number.isInteger(numericCandidate)) {
      answerIndex = numericCandidate >= 1 && numericCandidate <= 4 ? numericCandidate - 1 : numericCandidate;
    }
    const correctAnswer = answerIndex >= 0 && answerIndex <= 3 ? answerIndex : -1;

    if (!text) {
      invalidRows.push({ rowNumber: idx + 2, reason: 'Question text is empty' });
      return;
    }

    if (correctAnswer < 0 || correctAnswer > 3) {
      invalidRows.push({ rowNumber: idx + 2, reason: 'Correct Answer must be A/B/C/D or 1-4' });
      return;
    }

    if (!options[correctAnswer]) {
      invalidRows.push({ rowNumber: idx + 2, reason: `Correct option ${String.fromCharCode(65 + correctAnswer)} is empty` });
      return;
    }

    const marksVal = Number(getRowValue(row, ['marks', 'mark', 'score']) || row.Marks || row.marks || 1);
    const negMarksRaw = getRowValue(row, ['negativemarks', 'negativemark', 'negmarks', 'penalty']);
    const negativeMarks = negMarksRaw ? Number(negMarksRaw) : null;
    const section = getRowValue(row, ['section', 'subject', 'category', 'topic']) || row.Section || row.section || undefined;
    const passage = cleanCellText(getRowValue(row, ['passage', 'readingpassage', 'comprehension']) || row.Passage || row.passage || '');
    const imageUrl = getRowValue(row, ['imageurl', 'image', 'questionimage']) || row['Image URL'] || undefined;

    const optAImage = getRowValue(row, ['optionaimage', 'option1image', 'imagea']) || row['Option A Image'] || '';
    const optBImage = getRowValue(row, ['optionbimage', 'option2image', 'imageb']) || row['Option B Image'] || '';
    const optCImage = getRowValue(row, ['optioncimage', 'option3image', 'imagec']) || row['Option C Image'] || '';
    const optDImage = getRowValue(row, ['optiondimage', 'option4image', 'imaged']) || row['Option D Image'] || '';
    const hasOptionImages = Boolean(optAImage || optBImage || optCImage || optDImage);

    validQuestions.push({
      text,
      type,
      options,
      correctAnswer,
      marks: isNaN(marksVal) || marksVal <= 0 ? 1 : marksVal,
      negativeMarks: negativeMarks !== null && !isNaN(negativeMarks) ? negativeMarks : null,
      section: section ? section.trim() : undefined,
      passage: passage || undefined,
      imageUrl: imageUrl ? imageUrl.trim() : undefined,
      optionImages: hasOptionImages ? [optAImage, optBImage, optCImage, optDImage] : undefined,
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
      Question: `What will be the output of the following C program?

#include <stdio.h>
int main() {
    int a = 10;
    int b = 20;
    if (a < b) {
        printf("%d", a + b);
    }
    return 0;
}`,
      Type: 'MCQ',
      Passage: '',
      'Option A': '10',
      'Option B': '20',
      'Option C': '30',
      'Option D': 'Compilation Error',
      'Image URL': '',
      'Option A Image': '',
      'Option B Image': '',
      'Option C Image': '',
      'Option D Image': '',
      'Correct Answer': 'C',
      Marks: 2,
      Section: 'Programming / C',
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
