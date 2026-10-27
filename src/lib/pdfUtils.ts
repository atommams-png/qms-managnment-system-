import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Exam, Candidate, ExamResult, ExamAttempt } from './types';
import { parseQuestionContent } from '@/components/FormattedQuestionText';

// Helper: Format date/time
function formatDateTime(value?: string | null): string {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Helper: Safe number parsing
function safeNum(val: any, fallback: number = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
}

// Helper: Format marks with up to 2 decimal places if needed
function formatMarks(val: any): string {
  const num = safeNum(val, 0);
  return Number.isInteger(num) ? num.toString() : num.toFixed(2);
}

// Helper: Format percentage string
function formatPct(val: any): string {
  const num = safeNum(val, 0);
  return Number.isInteger(num) ? `${num}%` : `${num.toFixed(1)}%`;
}

// Helper: Convert logo image to base64 Data URL
async function getLogoDataUrl(): Promise<string | null> {
  try {
    const response = await fetch('/atom shaale logo.png');
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Could not load logo for PDF report:', err);
    return null;
  }
}

// Helper: Color brightness adjuster for 3D faces
function adjustColor(hex: string, percent: number): string {
  if (!hex || typeof hex !== 'string') return '#059669';
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((c) => c + c).join('');
  }
  let num = parseInt(cleanHex, 16);
  if (isNaN(num)) num = 0x059669;
  let r = (num >> 16) + Math.round(2.55 * percent);
  let g = ((num >> 8) & 0x00ff) + Math.round(2.55 * percent);
  let b = (num & 0x0000ff) + Math.round(2.55 * percent);
  return `rgb(${Math.min(255, Math.max(0, r))}, ${Math.min(255, Math.max(0, g))}, ${Math.min(255, Math.max(0, b))})`;
}

// Helper: Draw 3D Isometric Bar on Canvas
function draw3DBarOnCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  depth: number,
  colorHex: string
) {
  if (height <= 0 || width <= 0) return;

  // 1. Drop shadow
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.beginPath();
  ctx.ellipse(x + width / 2 + depth / 2, y + height + depth / 3, width / 2 + depth / 3, depth / 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2. Right Side 3D Face
  ctx.save();
  ctx.fillStyle = adjustColor(colorHex, -35);
  ctx.beginPath();
  ctx.moveTo(x + width, y);
  ctx.lineTo(x + width + depth, y - depth);
  ctx.lineTo(x + width + depth, y + height - depth);
  ctx.lineTo(x + width, y + height);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // 3. Top 3D Face
  ctx.save();
  ctx.fillStyle = adjustColor(colorHex, 40);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + depth, y - depth);
  ctx.lineTo(x + width + depth, y - depth);
  ctx.lineTo(x + width, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // 4. Front Face
  ctx.save();
  const frontGrad = ctx.createLinearGradient(x, y, x + width, y + height);
  frontGrad.addColorStop(0, adjustColor(colorHex, 15));
  frontGrad.addColorStop(1, adjustColor(colorHex, -15));
  ctx.fillStyle = frontGrad;
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Gloss highlight
  if (width > 8 && height > 6) {
    const glossGrad = ctx.createLinearGradient(x, y, x + width * 0.45, y);
    glossGrad.addColorStop(0, 'rgba(255,255,255,0.45)');
    glossGrad.addColorStop(1, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = glossGrad;
    ctx.fillRect(x + 1, y + 1, width * 0.35, Math.max(1, height - 2));
  }
  ctx.restore();
}

// Helper: Draw 3D Isometric Donut on Canvas
function draw3DDonutOnCanvas(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  thickness: number,
  innerRadius: number,
  data: { label: string; value: number; color: string; count?: number; percentStr?: string }[]
) {
  const safeData = data.filter((d) => Number.isFinite(d.value) && d.value > 0);
  const total = safeData.reduce((sum, d) => sum + d.value, 0);

  if (total <= 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 20px Inter, Century Gothic';
    ctx.textAlign = 'center';
    ctx.fillText('No data available', centerX, centerY);
    return;
  }

  const startAngleBase = -Math.PI / 2;
  const ySquish = 0.58;

  // Draw 3D thickness layers
  for (let t = thickness; t >= 0; t -= 2) {
    let currentAngle = startAngleBase;
    safeData.forEach((slice) => {
      const sliceAngle = (slice.value / total) * Math.PI * 2;
      const darkShade = adjustColor(slice.color, -35 - (t / thickness) * 20);

      ctx.save();
      ctx.fillStyle = t === 0 ? slice.color : darkShade;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY + t, radius, radius * ySquish, 0, currentAngle, currentAngle + sliceAngle);
      ctx.ellipse(centerX, centerY + t, innerRadius, innerRadius * ySquish, 0, currentAngle + sliceAngle, currentAngle, true);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      currentAngle += sliceAngle;
    });
  }

  // Draw slice labels / callout badges
  let currentAngle = startAngleBase;
  safeData.forEach((slice) => {
    const sliceAngle = (slice.value / total) * Math.PI * 2;
    const midAngle = currentAngle + sliceAngle / 2;
    const calloutR = radius * 1.25;
    const lx = centerX + Math.cos(midAngle) * calloutR;
    const ly = centerY + Math.sin(midAngle) * (calloutR * ySquish);

    ctx.save();
    ctx.fillStyle = slice.color;
    ctx.font = 'bold 18px Century Gothic';
    ctx.textAlign = lx > centerX ? 'left' : 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${slice.label}: ${slice.percentStr || Math.round((slice.value / total) * 100) + '%'} (${slice.count ?? slice.value})`, lx, ly);
    ctx.restore();

    currentAngle += sliceAngle;
  });
}

function generateChartHeader(
  ctx: CanvasRenderingContext2D,
  width: number,
  title: string,
  subtitle: string
) {
  const headerGrad = ctx.createLinearGradient(0, 0, width, 0);
  headerGrad.addColorStop(0, '#064e3b');
  headerGrad.addColorStop(0.5, '#008037');
  headerGrad.addColorStop(1, '#10b981');
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, width, 14);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 30px Century Gothic';
  ctx.textAlign = 'left';
  ctx.fillText(title, 40, 60);

  ctx.fillStyle = '#059669';
  ctx.font = 'bold 18px Century Gothic';
  ctx.fillText(subtitle, 40, 92);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, 110);
  ctx.lineTo(width - 40, 110);
  ctx.stroke();
}

/**
 * Chart 1: 3D Score Distribution Chart
 */
function createScoreDistributionChart(
  attemptedPercentages: number[],
  totalAttempts: number
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  canvas.height = 760;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  generateChartHeader(
    ctx,
    canvas.width,
    '3D Score Distribution Analysis',
    'Candidate performance grouped by score percentage brackets'
  );

  const brackets = [
    { label: '0-20%', min: 0, max: 20, color: '#e11d48' },
    { label: '21-40%', min: 21, max: 40, color: '#f97316' },
    { label: '41-60%', min: 41, max: 60, color: '#eab308' },
    { label: '61-80%', min: 61, max: 80, color: '#3b82f6' },
    { label: '81-100%', min: 81, max: 100, color: '#059669' },
  ];

  const counts = brackets.map(
    (b) => attemptedPercentages.filter((p) => p >= b.min && p <= b.max).length
  );
  const maxCount = Math.max(1, ...counts);

  const floorY = 620;
  const chartStartX = 140;
  const chartWidth = canvas.width - 280;
  const barWidth = 130;
  const depth = 28;
  const maxHeight = 380;
  const spacing = (chartWidth - barWidth * brackets.length) / (brackets.length - 1);

  ctx.save();
  const floorGrad = ctx.createLinearGradient(0, floorY - depth, 0, floorY);
  floorGrad.addColorStop(0, '#f1f5f9');
  floorGrad.addColorStop(1, '#e2e8f0');
  ctx.fillStyle = floorGrad;
  ctx.beginPath();
  ctx.moveTo(chartStartX - 40, floorY);
  ctx.lineTo(chartStartX - 40 + depth, floorY - depth);
  ctx.lineTo(chartStartX + chartWidth + 40 + depth, floorY - depth);
  ctx.lineTo(chartStartX + chartWidth + 40, floorY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  brackets.forEach((b, i) => {
    const count = counts[i];
    const pctShare = totalAttempts > 0 ? ((count / totalAttempts) * 100).toFixed(1) : '0';
    const barHeight = Math.max(12, (count / maxCount) * maxHeight);
    const bx = chartStartX + i * (barWidth + spacing);
    const by = floorY - barHeight;

    draw3DBarOnCanvas(ctx, bx, by, barWidth, barHeight, depth, b.color);

    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px Century Gothic';
    ctx.textAlign = 'center';
    ctx.fillText(`${count}`, bx + barWidth / 2 + depth / 2, by - depth - 16);

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 16px Century Gothic';
    ctx.fillText(`(${pctShare}%)`, bx + barWidth / 2 + depth / 2, by - depth + 6);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 20px Century Gothic';
    ctx.fillText(b.label, bx + barWidth / 2, floorY + 40);
    ctx.restore();
  });

  return canvas.toDataURL('image/png');
}

/**
 * Chart 2: 3D Pass vs Fail Donut Chart
 */
function createPassFailDonutChart(
  passCount: number,
  failCount: number,
  absentCount: number,
  totalCandidates: number
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  canvas.height = 760;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  generateChartHeader(
    ctx,
    canvas.width,
    '3D Pass vs. Fail Qualification Breakdown',
    'Candidate qualification distribution and turnout assessment'
  );

  const data = [
    { label: 'Passed (≥50%)', value: passCount, color: '#008037', count: passCount, percentStr: `${totalCandidates > 0 ? ((passCount / totalCandidates) * 100).toFixed(1) : 0}%` },
    { label: 'Failed (<50%)', value: failCount, color: '#e11d48', count: failCount, percentStr: `${totalCandidates > 0 ? ((failCount / totalCandidates) * 100).toFixed(1) : 0}%` },
    { label: 'Unattempted', value: absentCount, color: '#94a3b8', count: absentCount, percentStr: `${totalCandidates > 0 ? ((absentCount / totalCandidates) * 100).toFixed(1) : 0}%` },
  ];

  draw3DDonutOnCanvas(ctx, 700, 420, 260, 48, 120, data);

  ctx.save();
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 36px Century Gothic';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const passRate = (passCount + failCount) > 0 ? Math.round((passCount / (passCount + failCount)) * 100) : 0;
  ctx.fillText(`${passRate}%`, 700, 410);

  ctx.fillStyle = '#059669';
  ctx.font = 'bold 18px Century Gothic';
  ctx.fillText('PASS RATE', 700, 445);
  ctx.restore();

  return canvas.toDataURL('image/png');
}

/**
 * Chart 3: 3D Section-wise Accuracy Chart
 */
function createSectionAccuracyChart(
  sectionData: { name: string; accuracy: number; questionsCount: number; maxMarks: number }[]
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  canvas.height = 760;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  generateChartHeader(
    ctx,
    canvas.width,
    '3D Section-Wise Accuracy Performance',
    'Average accuracy comparison across all examination sections'
  );

  const colors = ['#008037', '#0284c7', '#8b5cf6', '#d97706', '#e11d48', '#0d9488'];
  const floorY = 620;
  const chartStartX = 140;
  const chartWidth = canvas.width - 280;
  const count = Math.max(1, sectionData.length);
  const barWidth = Math.min(180, Math.max(80, (chartWidth - 60 * (count - 1)) / count));
  const depth = 26;
  const maxHeight = 380;
  const spacing = count > 1 ? (chartWidth - barWidth * count) / (count - 1) : 0;

  ctx.save();
  const floorGrad = ctx.createLinearGradient(0, floorY - depth, 0, floorY);
  floorGrad.addColorStop(0, '#f1f5f9');
  floorGrad.addColorStop(1, '#e2e8f0');
  ctx.fillStyle = floorGrad;
  ctx.beginPath();
  ctx.moveTo(chartStartX - 30, floorY);
  ctx.lineTo(chartStartX - 30 + depth, floorY - depth);
  ctx.lineTo(chartStartX + chartWidth + 30 + depth, floorY - depth);
  ctx.lineTo(chartStartX + chartWidth + 30, floorY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  sectionData.forEach((sec, i) => {
    const color = colors[i % colors.length];
    const barHeight = Math.max(12, (sec.accuracy / 100) * maxHeight);
    const bx = chartStartX + i * (barWidth + spacing);
    const by = floorY - barHeight;

    draw3DBarOnCanvas(ctx, bx, by, barWidth, barHeight, depth, color);

    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px Century Gothic';
    ctx.textAlign = 'center';
    ctx.fillText(`${sec.accuracy}%`, bx + barWidth / 2 + depth / 2, by - depth - 16);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 18px Century Gothic';
    const label = sec.name.length > 18 ? sec.name.substring(0, 16) + '...' : sec.name;
    ctx.fillText(label, bx + barWidth / 2, floorY + 40);

    ctx.fillStyle = '#64748b';
    ctx.font = '14px Century Gothic';
    ctx.fillText(`${sec.questionsCount} Qs (${sec.maxMarks}M)`, bx + barWidth / 2, floorY + 65);
    ctx.restore();
  });

  return canvas.toDataURL('image/png');
}



/**
 * Chart 4: 3D Department-wise Performance Chart
 */
function createDepartmentPerformanceChart(
  deptData: { department: string; avgScore: number; count: number }[]
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  canvas.height = 760;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  generateChartHeader(
    ctx,
    canvas.width,
    '3D Department-Wise Performance Comparison',
    'Average candidate percentage score by academic/functional department'
  );

  const colors = ['#059669', '#2563eb', '#7c3aed', '#ea580c', '#db2777', '#0891b2'];
  const floorY = 620;
  const chartStartX = 140;
  const chartWidth = canvas.width - 280;
  const count = Math.max(1, deptData.length);
  const barWidth = Math.min(180, Math.max(80, (chartWidth - 60 * (count - 1)) / count));
  const depth = 26;
  const maxHeight = 380;
  const spacing = count > 1 ? (chartWidth - barWidth * count) / (count - 1) : 0;

  ctx.save();
  const floorGrad = ctx.createLinearGradient(0, floorY - depth, 0, floorY);
  floorGrad.addColorStop(0, '#f1f5f9');
  floorGrad.addColorStop(1, '#e2e8f0');
  ctx.fillStyle = floorGrad;
  ctx.beginPath();
  ctx.moveTo(chartStartX - 30, floorY);
  ctx.lineTo(chartStartX - 30 + depth, floorY - depth);
  ctx.lineTo(chartStartX + chartWidth + 30 + depth, floorY - depth);
  ctx.lineTo(chartStartX + chartWidth + 30, floorY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  deptData.forEach((d, i) => {
    const color = colors[i % colors.length];
    const barHeight = Math.max(12, (d.avgScore / 100) * maxHeight);
    const bx = chartStartX + i * (barWidth + spacing);
    const by = floorY - barHeight;

    draw3DBarOnCanvas(ctx, bx, by, barWidth, barHeight, depth, color);

    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px Century Gothic';
    ctx.textAlign = 'center';
    ctx.fillText(`${d.avgScore}%`, bx + barWidth / 2 + depth / 2, by - depth - 16);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 18px Century Gothic';
    const label = d.department.length > 18 ? d.department.substring(0, 16) + '...' : d.department;
    ctx.fillText(label, bx + barWidth / 2, floorY + 40);

    ctx.fillStyle = '#64748b';
    ctx.font = '14px Century Gothic';
    ctx.fillText(`${d.count} Candidate${d.count !== 1 ? 's' : ''}`, bx + barWidth / 2, floorY + 65);
    ctx.restore();
  });

  return canvas.toDataURL('image/png');
}

function createAtomComparativeChart(
  exam1Label: string,
  exam2Label: string,
  metrics: { label: string; val1: number; val2: number }[]
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 680;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Outer border
  ctx.save();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  // Header Title & Legend
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px Century Gothic';
  ctx.textAlign = 'left';
  ctx.fillText('Cross-Exam Benchmark Comparison (%)', 40, 50);

  // Legend
  ctx.font = 'bold 18px Century Gothic';
  ctx.fillStyle = '#008037';
  ctx.fillRect(canvas.width - 550, 32, 20, 20);
  ctx.fillText(exam1Label.length > 22 ? exam1Label.substring(0, 22) + '...' : exam1Label, canvas.width - 520, 48);

  ctx.fillStyle = '#2563eb';
  ctx.fillRect(canvas.width - 270, 32, 20, 20);
  ctx.fillText(exam2Label.length > 22 ? exam2Label.substring(0, 22) + '...' : exam2Label, canvas.width - 240, 48);
  ctx.restore();

  const floorY = 560;
  const chartStartX = 80;
  const chartWidth = canvas.width - 160;
  const maxHeight = 380;
  const depth = 20;
  const barW = 60;
  const groupSpacing = (chartWidth - (barW * 2 + 15) * metrics.length) / (metrics.length + 1);

  // Background Grid Lines (0%, 25%, 50%, 75%, 100%)
  ctx.save();
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const gy = floorY - (g / 4) * maxHeight;
    ctx.beginPath();
    ctx.moveTo(chartStartX - 20, gy);
    ctx.lineTo(chartStartX + chartWidth + 20, gy);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px Century Gothic';
    ctx.textAlign = 'right';
    ctx.fillText(`${g * 25}%`, chartStartX - 25, gy + 5);
  }

  // Floor line
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(chartStartX - 30, floorY);
  ctx.lineTo(chartStartX + chartWidth + 30, floorY);
  ctx.stroke();

  metrics.forEach((m, i) => {
    const groupX = chartStartX + groupSpacing + i * (barW * 2 + 20 + groupSpacing);

    // Bar 1 (Exam 1 - Emerald Green)
    const h1 = Math.max(10, (Math.min(100, m.val1) / 100) * maxHeight);
    const b1x = groupX;
    const b1y = floorY - h1;
    draw3DBarOnCanvas(ctx, b1x, b1y, barW, h1, depth, '#008037');

    // Bar 2 (Exam 2 - Royal Blue)
    const h2 = Math.max(10, (Math.min(100, m.val2) / 100) * maxHeight);
    const b2x = groupX + barW + 15;
    const b2y = floorY - h2;
    draw3DBarOnCanvas(ctx, b2x, b2y, barW, h2, depth, '#2563eb');

    // Values on top
    ctx.fillStyle = '#008037';
    ctx.font = 'bold 20px Century Gothic';
    ctx.textAlign = 'center';
    ctx.fillText(`${m.val1}%`, b1x + barW / 2 + depth / 2, b1y - depth - 8);

    ctx.fillStyle = '#2563eb';
    ctx.fillText(`${m.val2}%`, b2x + barW / 2 + depth / 2, b2y - depth - 8);

    // Metric Label below floor
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 20px Century Gothic';
    ctx.fillText(m.label, groupX + barW + 8, floorY + 36);
  });
  ctx.restore();

  return canvas.toDataURL('image/png');
}


export interface ComparisonExamData {
  exam: Exam;
  candidates: Candidate[];
  results: ExamResult[];
  attempts: ExamAttempt[];
}

export interface PdfExportOptions {
  filteredCandidates?: Candidate[];
  isFiltered?: boolean;
  includeResults?: boolean;
  comparisonExamData?: ComparisonExamData;
}


export async function exportExamDetailedPdfReport(
  exam: Exam,
  candidates: Candidate[],
  results: ExamResult[],
  attempts: ExamAttempt[],
  options?: PdfExportOptions
) {
  const isFiltered = options?.isFiltered ?? false;
  const includeResults = options?.includeResults !== false;
  const targetCandidates = options?.filteredCandidates ?? candidates;
  const totalQuestions = exam.questions.length;
  const examTotalMarks = exam.questions.reduce((sum, q) => sum + (safeNum(q.marks) || 1), 0);
  const examNegativeMarks = safeNum(exam.settings?.negativeMarks, 0);

  // Calculate candidate results mapping
  const candidateResults = targetCandidates.map((c) => {
    const attempt = attempts.find((a) => a.candidateId === c.id);
    const result = results.find((r) => r.candidateId === c.id);

    let isAttempted = !!attempt && (attempt.isSubmitted || (attempt.answers && attempt.answers.length > 0));
    let correct = safeNum(result?.correctAnswers, 0);
    let wrong = safeNum(result?.wrongAnswers, 0);
    let obtainedMarks = safeNum(result?.obtainedMarks, 0);
    let percentage = safeNum(result?.percentage, 0);
    let tabSwitches = safeNum(attempt?.tabSwitches, 0);

    // Recalculate if result object missing but attempt exists
    if (!result && attempt && isAttempted) {
      let calcMarks = 0;
      let cCount = 0;
      let wCount = 0;
      exam.questions.forEach((q) => {
        const ans = attempt.answers.find((a) => a.questionId === q.id);
        if (ans && ans.selectedAnswer !== null && ans.selectedAnswer !== undefined) {
          if (ans.selectedAnswer === q.correctAnswer) {
            cCount++;
            calcMarks += safeNum(q.marks, 1);
          } else {
            wCount++;
            calcMarks -= safeNum(q.negativeMarks ?? examNegativeMarks, 0);
          }
        }
      });
      correct = cCount;
      wrong = wCount;
      obtainedMarks = Math.max(0, calcMarks);
      percentage = examTotalMarks > 0 ? Math.round((obtainedMarks / examTotalMarks) * 1000) / 10 : 0;
    }

    const skipped = totalQuestions - (correct + wrong);
    const isPass = percentage >= 50;
    const submissionStatus = !isAttempted
      ? 'Not Attempted'
      : (exam.settings.maxTabSwitches ?? 0) > 0 && tabSwitches >= exam.settings.maxTabSwitches
      ? 'Limit Exceeded'
      : 'Normal Submit';

    return {
      candidate: c,
      attempt,
      result,
      isAttempted,
      correct,
      wrong,
      skipped,
      obtainedMarks,
      totalMarks: examTotalMarks,
      percentage,
      isPass,
      tabSwitches,
      submissionStatus,
    };
  });

  // Sort candidates by score descending for ranking
  candidateResults.sort((a, b) => {
    if (a.isAttempted !== b.isAttempted) return a.isAttempted ? -1 : 1;
    return (safeNum(b.obtainedMarks) - safeNum(a.obtainedMarks)) || (safeNum(b.percentage) - safeNum(a.percentage));
  });

  // Aggregated Cohort Metrics
  const totalTargetCandidates = targetCandidates.length;
  const attemptedCandidates = candidateResults.filter((cr) => cr.isAttempted);
  const attemptedCount = attemptedCandidates.length;
  const notAttemptedCount = totalTargetCandidates - attemptedCount;
  const turnoutRate = totalTargetCandidates > 0 ? (attemptedCount / totalTargetCandidates) * 100 : 0;
  const passCount = attemptedCandidates.filter((cr) => cr.isPass).length;
  const failCount = attemptedCount - passCount;
  const passRate = attemptedCount > 0 ? ((passCount / attemptedCount) * 100).toFixed(1) : '0';
  const failRate = attemptedCount > 0 ? ((failCount / attemptedCount) * 100).toFixed(1) : '0';

  const totalScoreSum = attemptedCandidates.reduce((sum, cr) => sum + safeNum(cr.obtainedMarks), 0);
  const avgScore = attemptedCount > 0 ? (totalScoreSum / attemptedCount).toFixed(2) : '0.00';
  const avgPercentage = attemptedCount > 0
    ? (attemptedCandidates.reduce((sum, cr) => sum + safeNum(cr.percentage), 0) / attemptedCount).toFixed(1)
    : '0';

  const highestScore = attemptedCount > 0
    ? Math.max(...attemptedCandidates.map((cr) => safeNum(cr.obtainedMarks)))
    : 0;
  const lowestScore = attemptedCount > 0
    ? Math.min(...attemptedCandidates.map((cr) => safeNum(cr.obtainedMarks)))
    : 0;

  const flaggedCount = candidateResults.filter((cr) => cr.submissionStatus === 'Limit Exceeded').length;

  // Initialize jsPDF Document (Portrait, A4)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const darkTextColor = [30, 41, 59]; // slate-800

  const logoDataUrl = await getLogoDataUrl();

  // Helper for Header Banner on Cover Page
  const drawCoverHeader = () => {
    doc.setFillColor(0, 128, 55);
    doc.rect(0, 0, pageWidth, 26, 'F');

    doc.setFillColor(16, 185, 129);
    doc.rect(0, 26, pageWidth, 1.5, 'F');

    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, 'PNG', 14, 4, 38, 18);
      } catch (e) {
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('ATOM', 14, 16);
      }
    } else {
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('ATOM', 14, 16);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('EXAMINATION INTELLIGENCE REPORT', pageWidth - 14, 12, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(220, 252, 231);
    doc.text(`Generated: ${formatDateTime(new Date().toISOString())}`, pageWidth - 14, 18, { align: 'right' });
  };

  drawCoverHeader();

  let currentY = 34;

  // Title Block
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(exam.name, 14, currentY);
  currentY += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  const examCodeText = `Exam Code: ${exam.code}  |  Duration: ${exam.settings.duration} Mins  |  Total Marks: ${examTotalMarks}  |  Questions: ${totalQuestions}`;
  doc.text(examCodeText, 14, currentY);
  currentY += 8;

  // =========================================================================
  // SECTION 1: EXAMINATION SPECIFICATIONS & POLICY
  // =========================================================================
  autoTable(doc, {
    startY: currentY,
    head: [['EXAMINATION SPECIFICATIONS & CONFIGURATION', 'VALUE / POLICY']],
    body: [
      ['Examination Name', exam.name],
      ['Access Code', exam.code],
      ['Scheduled Window', `${formatDateTime(exam.startDateTime)}  to  ${formatDateTime(exam.endDateTime)}`],
      ['Total Assessment Duration', `${exam.settings.duration} Minutes`],
      ['Total Questions & Max Marks', `${totalQuestions} Questions  |  ${examTotalMarks} Max Marks`],
      ['Standard Passing Threshold', `50% Score (${(examTotalMarks * 0.5).toFixed(1)} Marks required to Pass)`],
      ['Negative Marking Policy', examNegativeMarks > 0 ? `-${examNegativeMarks} marks per incorrect question` : 'Disabled (0 negative marks)'],
      ['Integrity & Security Policy', exam.settings.tabSwitchDetection ? `Tab Switch Limit: Max ${exam.settings.maxTabSwitches || 3} allowed` : 'Tab Switch Detection Disabled'],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [0, 128, 55],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: 'bold', textColor: [30, 41, 59], fontSize: 8 },
      1: { cellWidth: 'auto', textColor: [51, 65, 85], fontSize: 8 },
    },
    margin: { left: 14, right: 14 },
    styles: { cellPadding: 2.2, font: 'helvetica' },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // =========================================================================
  // SECTION 2: EXECUTIVE COHORT PERFORMANCE & METRICS
  // =========================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(0, 128, 55);
  doc.text('COHORT PERFORMANCE & EXECUTIVE METRICS', 14, currentY);
  currentY += 3;

  autoTable(doc, {
    startY: currentY,
    head: [['Metric Description', 'Count / Value', 'Cohort Share / Benchmark']],
    body: [
      ['Total Registered Candidates', `${totalTargetCandidates} Candidates`, '100% Target Population'],
      ['Exam Submissions / Attempted', `${attemptedCount} Candidates`, `${turnoutRate.toFixed(1)}% Turnout Rate`],
      ['Unattempted / Absent', `${notAttemptedCount} Candidates`, `${totalTargetCandidates > 0 ? ((notAttemptedCount / totalTargetCandidates) * 100).toFixed(1) : 0}% Absentee Rate`],
      ['Qualified / Passed (>= 50%)', `${passCount} Candidates`, `${passRate}% of Attempted`],
      ['Did Not Qualify / Failed (< 50%)', `${failCount} Candidates`, `${failRate}% of Attempted`],
      ['Class Average Score', `${avgScore} / ${examTotalMarks} Marks`, `${avgPercentage}% Average Accuracy`],
      ['Highest Score Achieved', `${formatMarks(highestScore)} / ${examTotalMarks} Marks`, `${examTotalMarks > 0 ? formatPct((highestScore / examTotalMarks) * 100) : '0%'} Score`],
      ['Lowest Score Achieved', `${formatMarks(lowestScore)} / ${examTotalMarks} Marks`, `${examTotalMarks > 0 ? formatPct((lowestScore / examTotalMarks) * 100) : '0%'} Score`],
      ['Integrity Flagged (Limit Exceeded)', `${flaggedCount} Candidates`, flaggedCount > 0 ? 'Review flagged attempts' : 'Zero severe violations'],
    ],
    theme: 'striped',
    headStyles: {
      fillColor: [5, 150, 105],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: 'bold', textColor: [30, 41, 59], fontSize: 8 },
      1: { cellWidth: 50, fontStyle: 'bold', textColor: [0, 128, 55], fontSize: 8 },
      2: { cellWidth: 'auto', textColor: [71, 85, 105], fontSize: 8 },
    },
    margin: { left: 14, right: 14 },
    styles: { cellPadding: 2, font: 'helvetica' },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // =========================================================================
  // SECTION 3: SCORE BRACKET & GRADE DISTRIBUTION TABLE
  // =========================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(0, 128, 55);
  doc.text('SCORE & PERFORMANCE BRACKET DISTRIBUTION', 14, currentY);
  currentY += 3;

  const brackets = [
    { label: '81% - 100%', tier: 'Outstanding (Grade A+)', min: 81, max: 100 },
    { label: '61% - 80%', tier: 'Good / Competent (Grade A)', min: 61, max: 80 },
    { label: '41% - 60%', tier: 'Average (Grade B)', min: 41, max: 60 },
    { label: '21% - 40%', tier: 'Below Average (Grade C)', min: 21, max: 40 },
    { label: '0% - 20%', tier: 'Needs Improvement (Grade D)', min: 0, max: 20 },
  ];

  const bracketRows = brackets.map((b) => {
    const count = attemptedCandidates.filter((c) => safeNum(c.percentage) >= b.min && safeNum(c.percentage) <= b.max).length;
    const share = attemptedCount > 0 ? ((count / attemptedCount) * 100).toFixed(1) : '0.0';
    return [b.label, b.tier, `${count} Candidates`, `${share}%`];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['Percentage Bracket', 'Performance Tier', 'Candidate Count', 'Percentage Share']],
    body: bracketRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 118, 110],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [30, 41, 59], fontSize: 8 },
      1: { textColor: [51, 65, 85], fontSize: 8 },
      2: { fontStyle: 'bold', textColor: [0, 128, 55], fontSize: 8, halign: 'center' },
      3: { textColor: [71, 85, 105], fontSize: 8, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
    styles: { cellPadding: 2, font: 'helvetica' },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // =========================================================================
  // SECTION 4: SECTION-WISE PERFORMANCE BREAKDOWN TABLE
  // =========================================================================
  const sectionMap = new Map<string, typeof exam.questions>();
  exam.questions.forEach((q) => {
    const sec = q.section || 'General';
    if (!sectionMap.has(sec)) sectionMap.set(sec, []);
    sectionMap.get(sec)!.push(q);
  });

  const sectionStats: { name: string; accuracy: number; questionsCount: number; maxMarks: number }[] = [];
  const sectionTableRows: any[] = [];

  sectionMap.forEach((questions, sectionName) => {
    const secMarks = questions.reduce((sum, q) => sum + (safeNum(q.marks, 1)), 0);
    let secObtainedSum = 0;
    let secMaxPossibleSum = 0;

    attemptedCandidates.forEach((cr) => {
      questions.forEach((q) => {
        secMaxPossibleSum += safeNum(q.marks, 1);
        const ans = cr.attempt?.answers.find((a) => a.questionId === q.id);
        if (ans && ans.selectedAnswer === q.correctAnswer) {
          secObtainedSum += safeNum(q.marks, 1);
        } else if (ans && ans.selectedAnswer !== null && ans.selectedAnswer !== undefined) {
          secObtainedSum -= safeNum(q.negativeMarks ?? examNegativeMarks, 0);
        }
      });
    });

    const accuracy = secMaxPossibleSum > 0
      ? Math.max(0, Math.round((secObtainedSum / secMaxPossibleSum) * 100))
      : 0;
    const rating = accuracy >= 75 ? 'High (Mastery)' : accuracy >= 50 ? 'Moderate' : 'Challenging';

    sectionStats.push({
      name: sectionName,
      accuracy,
      questionsCount: questions.length,
      maxMarks: secMarks,
    });

    sectionTableRows.push([
      sectionName,
      `${questions.length} Questions`,
      `${secMarks} Marks`,
      `${accuracy}%`,
      rating,
    ]);
  });

  if (currentY + 45 > pageHeight - 18) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(0, 128, 55);
  doc.text('SECTION-WISE ACCURACY & MASTERY BREAKDOWN', 14, currentY);
  currentY += 3;

  autoTable(doc, {
    startY: currentY,
    head: [['Section Name', 'Questions Count', 'Max Marks', 'Avg Accuracy', 'Performance Tier']],
    body: sectionTableRows,
    theme: 'striped',
    headStyles: {
      fillColor: [0, 128, 55],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [30, 41, 59], fontSize: 8 },
      1: { textColor: [71, 85, 105], fontSize: 8 },
      2: { fontStyle: 'bold', textColor: [71, 85, 105], fontSize: 8 },
      3: { fontStyle: 'bold', textColor: [0, 128, 55], fontSize: 8, halign: 'center' },
      4: { fontStyle: 'bold', textColor: [51, 65, 85], fontSize: 8 },
    },
    margin: { left: 14, right: 14 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // =========================================================================
  if (includeResults) {
    // SECTION 5: COMPLETE CANDIDATE EXAMINATION RESULTS & SCORECARD (NO CUTOFF)
    // =========================================================================
    if (currentY + 35 > pageHeight - 18) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 128, 55);
    doc.text('CANDIDATE MERIT RANK LIST & DETAILED SCORECARD', 10, currentY);
    currentY += 4.5;

    const distinctQuestionSections = Array.from(
      new Set(
        exam.questions
          .map((q) => (q.section && String(q.section).trim()) || '')
          .filter((s) => s.length > 0 && s.toLowerCase() !== 'general')
      )
    );
    const hasQuestionSections = distinctQuestionSections.length > 0;

    const strongSecColIdx = hasQuestionSections ? 10 : -1;
    const avgSecColIdx = hasQuestionSections ? 11 : -1;
    const weakSecColIdx = hasQuestionSections ? 12 : -1;
    const resultColIdx = hasQuestionSections ? 13 : 10;
    const tabsColIdx = hasQuestionSections ? 14 : 11;

    const candidateRankRows = candidateResults.map((cr, idx) => {
      const rank = cr.isAttempted ? `#${idx + 1}` : '-';
      const resultStatus = !cr.isAttempted ? 'ABSENT' : cr.isPass ? 'PASSED' : 'FAILED';
      const deptSec = cr.candidate.department
        ? (cr.candidate.section ? `${cr.candidate.department} (${cr.candidate.section})` : cr.candidate.department)
        : (cr.candidate.section || 'General');

      const scoreDisplay = cr.isAttempted
        ? `${formatMarks(cr.obtainedMarks)} / ${examTotalMarks}`
        : '-';
      const pctDisplay = cr.isAttempted
        ? formatPct(cr.percentage)
        : '-';

      let strongSection = '-';
      let avgSection = '-';
      let weakSection = '-';

      if (hasQuestionSections && cr.isAttempted && cr.attempt) {
        const secScores: { name: string; obtained: number; total: number; accuracy: number }[] = [];
        distinctQuestionSections.forEach((secName) => {
          const secQuestions = exam.questions.filter(
            (q) => (q.section && String(q.section).trim().toLowerCase()) === secName.toLowerCase()
          );
          if (secQuestions.length === 0) return;
          let obtained = 0;
          let total = 0;
          secQuestions.forEach((q) => {
            const qMarks = safeNum(q.marks, 1);
            total += qMarks;
            const ans = cr.attempt?.answers.find((a) => a.questionId === q.id);
            if (ans && ans.selectedAnswer !== null && ans.selectedAnswer !== undefined) {
              if (Number(ans.selectedAnswer) === Number(q.correctAnswer)) {
                obtained += qMarks;
              } else {
                obtained -= safeNum(q.negativeMarks ?? examNegativeMarks, 0);
              }
            }
          });
          const accuracy = total > 0 ? Math.max(0, Math.round((obtained / total) * 100)) : 0;
          secScores.push({ name: secName, obtained, total, accuracy });
        });

        if (secScores.length > 0) {
          // Sort descending: highest accuracy first, then obtained marks
          secScores.sort((a, b) => b.accuracy - a.accuracy || b.obtained - a.obtained);

          const maxAcc = secScores[0].accuracy;
          const minAcc = secScores[secScores.length - 1].accuracy;

          const formatSecList = (items: { name: string; accuracy: number }[]) => {
            if (items.length === 0) return '-';
            const acc = items[0].accuracy;
            if (items.length >= distinctQuestionSections.length && distinctQuestionSections.length >= 3) {
              return `All (${acc}%)`;
            }
            const shortNames = items.map((s) => {
              const n = s.name.trim();
              if (n.toLowerCase() === 'mathematics') return 'Math';
              if (n.toLowerCase() === 'quantitative aptitude') return 'Quant';
              if (n.toLowerCase() === 'logical reasoning') return 'Logical';
              if (n.toLowerCase() === 'reading comprehension') return 'Reading';
              return n;
            });
            return `${shortNames.join(', ')} (${acc}%)`;
          };

          // 1. Strong Section(s): All sections tied with maxAcc (if maxAcc > 0)
          if (maxAcc > 0) {
            const topSections = secScores.filter((s) => s.accuracy === maxAcc);
            strongSection = formatSecList(topSections);
          }

          // 2. Weak Section(s): Sections tied with minAcc (if minAcc < maxAcc, or if all are 0%)
          if (minAcc < maxAcc) {
            const bottomSections = secScores.filter((s) => s.accuracy === minAcc);
            weakSection = formatSecList(bottomSections);
          } else if (maxAcc === 0) {
            weakSection = formatSecList(secScores);
          }

          // 3. Average Section(s): Only sections strictly between minAcc and maxAcc (and strictly > 0% and < 100%)
          if (secScores.length >= 3 && minAcc < maxAcc) {
            const midSections = secScores.filter((s) => s.accuracy < maxAcc && s.accuracy > minAcc && s.accuracy > 0);
            if (midSections.length > 0) {
              avgSection = formatSecList(midSections);
            }
          }
        }
      }

      const row = [
        rank,
        cr.candidate.name,
        cr.candidate.email,
        cr.candidate.usn || '-',
        deptSec,
        cr.submissionStatus,
        cr.isAttempted ? `${cr.correct}` : '-',
        cr.isAttempted ? `${cr.wrong}` : '-',
        scoreDisplay,
        pctDisplay,
      ];

      if (hasQuestionSections) {
        row.push(strongSection);
        row.push(avgSection);
        row.push(weakSection);
      }

      row.push(resultStatus);
      row.push(cr.isAttempted ? `${cr.tabSwitches}` : '-');

      return row;
    });

    const tableHeaders = [
      'Rank', 'Candidate Name', 'Email Address', 'USN', 'Dept', 'Status', 'Corr', 'Wrong', 'Score', 'Accuracy'
    ];
    if (hasQuestionSections) {
      tableHeaders.push('Strong Sec', 'Avg Sec', 'Weak Sec');
    }
    tableHeaders.push('Result', 'Tabs');

    const colStyles = hasQuestionSections
      ? {
          0: { cellWidth: 7, fontStyle: 'bold', textColor: [0, 128, 55], halign: 'center', fontSize: 6.5 },
          1: { cellWidth: 'auto', fontStyle: 'bold', textColor: [30, 41, 59], fontSize: 6.5 },
          2: { cellWidth: 'auto', textColor: [71, 85, 105], fontSize: 6 },
          3: { cellWidth: 11, textColor: [71, 85, 105], fontSize: 6 },
          4: { cellWidth: 11, textColor: [71, 85, 105], fontSize: 6 },
          5: { cellWidth: 14, fontStyle: 'bold', halign: 'center', fontSize: 6 },
          6: { cellWidth: 8, fontStyle: 'bold', halign: 'center', fontSize: 6.5 },
          7: { cellWidth: 8, fontStyle: 'bold', halign: 'center', fontSize: 6.5 },
          8: { cellWidth: 12, fontStyle: 'bold', textColor: [30, 41, 59], halign: 'center', fontSize: 6.5 },
          9: { cellWidth: 11, fontStyle: 'bold', halign: 'center', fontSize: 6.5 },
          10: { cellWidth: 16, fontStyle: 'bold', halign: 'center', fontSize: 6 },
          11: { cellWidth: 16, fontStyle: 'bold', halign: 'center', fontSize: 6 },
          12: { cellWidth: 16, fontStyle: 'bold', halign: 'center', fontSize: 6 },
          13: { cellWidth: 13, fontStyle: 'bold', halign: 'center', fontSize: 6.5 },
          14: { cellWidth: 8, fontStyle: 'bold', halign: 'center', fontSize: 6.5 },
        }
      : {
          0: { cellWidth: 8, fontStyle: 'bold', textColor: [0, 128, 55], halign: 'center', fontSize: 7.5 },
          1: { cellWidth: 'auto', fontStyle: 'bold', textColor: [30, 41, 59], fontSize: 7.5 },
          2: { cellWidth: 'auto', textColor: [71, 85, 105], fontSize: 7 },
          3: { cellWidth: 14, textColor: [71, 85, 105], fontSize: 7 },
          4: { cellWidth: 14, textColor: [71, 85, 105], fontSize: 7 },
          5: { cellWidth: 18, fontStyle: 'bold', halign: 'center', fontSize: 7 },
          6: { cellWidth: 10, fontStyle: 'bold', halign: 'center', fontSize: 7.5 },
          7: { cellWidth: 10, fontStyle: 'bold', halign: 'center', fontSize: 7.5 },
          8: { cellWidth: 16, fontStyle: 'bold', textColor: [30, 41, 59], halign: 'center', fontSize: 7.5 },
          9: { cellWidth: 14, fontStyle: 'bold', halign: 'center', fontSize: 7.5 },
          10: { cellWidth: 17, fontStyle: 'bold', halign: 'center', fontSize: 7.5 },
          11: { cellWidth: 11, fontStyle: 'bold', halign: 'center', fontSize: 7.5 },
        };

    autoTable(doc, {
      startY: currentY,
      head: [tableHeaders],
      body: candidateRankRows,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 128, 55],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: hasQuestionSections ? 6.5 : 7.5,
        halign: 'center',
        cellPadding: hasQuestionSections ? 1 : 1.2,
      },
      columnStyles: colStyles as any,
      didParseCell: (data) => {
        if (data.section === 'body') {
          const rowRaw = data.row.raw as any[];
          const status = rowRaw[5];
          const isAttempted = status !== 'Not Attempted';

          // Status column (col 5)
          if (data.column.index === 5) {
            data.cell.styles.halign = 'center';
            data.cell.styles.fontStyle = 'bold';
            if (status === 'Limit Exceeded') {
              data.cell.styles.fillColor = [254, 226, 226]; // Soft Red (#FEE2E2)
              data.cell.styles.textColor = [185, 28, 28]; // Dark Red (#B91C1C)
            } else if (status === 'Normal Submit') {
              data.cell.styles.fillColor = [220, 252, 231]; // Soft Green (#DCFCE7)
              data.cell.styles.textColor = [21, 128, 61]; // Dark Green (#15803D)
            } else {
              data.cell.styles.fillColor = [241, 245, 249];
              data.cell.styles.textColor = [100, 116, 139];
            }
          }

          // Corr column (col 6) - Excel Green heat cell
          if (data.column.index === 6) {
            data.cell.styles.halign = 'center';
            data.cell.styles.fontStyle = 'bold';
            const corrVal = parseInt(String(data.cell.raw ?? ''), 10);
            if (isAttempted && !isNaN(corrVal)) {
              if (corrVal > 0) {
                data.cell.styles.fillColor = [220, 252, 231]; // Light green
                data.cell.styles.textColor = [21, 128, 61];
              } else {
                data.cell.styles.fillColor = [248, 250, 252];
                data.cell.styles.textColor = [148, 163, 184];
              }
            } else {
              data.cell.styles.textColor = [148, 163, 184];
            }
          }

          // Wrong column (col 7) - Excel Red heat cell
          if (data.column.index === 7) {
            data.cell.styles.halign = 'center';
            data.cell.styles.fontStyle = 'bold';
            const wrongVal = parseInt(String(data.cell.raw ?? ''), 10);
            if (isAttempted && !isNaN(wrongVal)) {
              if (wrongVal > 0) {
                data.cell.styles.fillColor = [254, 226, 226]; // Light red
                data.cell.styles.textColor = [185, 28, 28];
              } else {
                data.cell.styles.fillColor = [240, 253, 244]; // Green clean 0 wrong
                data.cell.styles.textColor = [22, 163, 74];
              }
            } else {
              data.cell.styles.textColor = [148, 163, 184];
            }
          }

          // Score column (col 8)
          if (data.column.index === 8) {
            data.cell.styles.halign = 'center';
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = isAttempted ? [30, 41, 59] : [148, 163, 184];
          }

          // Accuracy column (col 9) - Excel 3-Color Scale Heat Map
          if (data.column.index === 9) {
            data.cell.styles.halign = 'center';
            data.cell.styles.fontStyle = 'bold';
            if (isAttempted) {
              const pctVal = parseFloat(String(data.cell.raw ?? ''));
              if (!isNaN(pctVal)) {
                if (pctVal >= 75) {
                  data.cell.styles.fillColor = [220, 252, 231]; // Excel Green heat cell
                  data.cell.styles.textColor = [21, 128, 61];
                } else if (pctVal >= 50) {
                  data.cell.styles.fillColor = [254, 249, 195]; // Excel Yellow/Amber heat cell
                  data.cell.styles.textColor = [161, 98, 7];
                } else {
                  data.cell.styles.fillColor = [254, 226, 226]; // Excel Red heat cell
                  data.cell.styles.textColor = [185, 28, 28];
                }
              }
            } else {
              data.cell.styles.textColor = [148, 163, 184];
            }
          }

          // Strong Section column (col 10 if hasQuestionSections)
          if (strongSecColIdx !== -1 && data.column.index === strongSecColIdx) {
            data.cell.styles.halign = 'center';
            data.cell.styles.fontStyle = 'bold';
            const val = data.cell.raw;
            if (val && val !== '-') {
              data.cell.styles.fillColor = [220, 252, 231]; // Soft Green
              data.cell.styles.textColor = [21, 128, 61]; // Dark Green
            } else {
              data.cell.styles.textColor = [148, 163, 184];
            }
          }

          // Average Section column (col 11 if hasQuestionSections)
          if (avgSecColIdx !== -1 && data.column.index === avgSecColIdx) {
            data.cell.styles.halign = 'center';
            data.cell.styles.fontStyle = 'bold';
            const val = data.cell.raw;
            if (val && val !== '-') {
              data.cell.styles.fillColor = [254, 249, 195]; // Soft Yellow/Amber
              data.cell.styles.textColor = [161, 98, 7]; // Dark Amber
            } else {
              data.cell.styles.textColor = [148, 163, 184];
            }
          }

          // Weak Section column (col 12 if hasQuestionSections)
          if (weakSecColIdx !== -1 && data.column.index === weakSecColIdx) {
            data.cell.styles.halign = 'center';
            data.cell.styles.fontStyle = 'bold';
            const val = data.cell.raw;
            if (val && val !== '-') {
              data.cell.styles.fillColor = [254, 226, 226]; // Soft Red/Pink
              data.cell.styles.textColor = [185, 28, 28]; // Dark Red
            } else {
              data.cell.styles.textColor = [148, 163, 184];
            }
          }

          // Result column - Status Badge
          if (data.column.index === resultColIdx) {
            data.cell.styles.halign = 'center';
            data.cell.styles.fontStyle = 'bold';
            const resVal = data.cell.raw;
            if (resVal === 'PASSED') {
              data.cell.styles.fillColor = [220, 252, 231];
              data.cell.styles.textColor = [21, 128, 61];
            } else if (resVal === 'FAILED') {
              data.cell.styles.fillColor = [254, 226, 226];
              data.cell.styles.textColor = [185, 28, 28];
            } else {
              data.cell.styles.fillColor = [241, 245, 249];
              data.cell.styles.textColor = [100, 116, 139];
            }
          }

          // Tabs column - Tab violation heat cell
          if (data.column.index === tabsColIdx) {
            data.cell.styles.halign = 'center';
            data.cell.styles.fontStyle = 'bold';
            const tabVal = parseInt(String(data.cell.raw ?? ''), 10);
            if (isAttempted && !isNaN(tabVal)) {
              if (tabVal >= 3 || status === 'Limit Exceeded') {
                data.cell.styles.fillColor = [254, 226, 226]; // Red violation
                data.cell.styles.textColor = [185, 28, 28];
              } else if (tabVal > 0) {
                data.cell.styles.fillColor = [254, 249, 195]; // Amber caution
                data.cell.styles.textColor = [161, 98, 7];
              } else {
                data.cell.styles.fillColor = [240, 253, 244]; // Green clean
                data.cell.styles.textColor = [21, 128, 61];
              }
            } else {
              data.cell.styles.textColor = [148, 163, 184];
            }
          }
        }
      },
      margin: { left: 10, right: 10 },
      styles: { cellPadding: hasQuestionSections ? 1.2 : 1.5, font: 'helvetica', fontSize: hasQuestionSections ? 6.5 : 7, overflow: 'linebreak' },
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // =========================================================================
  // QUESTION-LEVEL DATA PREPARATION FOR CHARTS & DETAILED BREAKDOWN
  // =========================================================================
  const questionAnalysisList: any[] = [];

  exam.questions.forEach((q, idx) => {
    let qCorrect = 0;
    let qWrong = 0;
    let qSkipped = 0;
    const optionCounts = new Array(q.options?.length || 4).fill(0);
    const candidatesCorrect: string[] = [];
    const candidatesWrong: string[] = [];
    const candidatesSkipped: string[] = [];

    attemptedCandidates.forEach((cr) => {
      const candidateName = cr.candidate.name;
      const ans = cr.attempt?.answers.find((a) => a.questionId === q.id);
      if (!ans || ans.selectedAnswer === null || ans.selectedAnswer === undefined) {
        qSkipped++;
        candidatesSkipped.push(candidateName);
      } else {
        const chosen = Number(ans.selectedAnswer);
        if (chosen >= 0 && chosen < optionCounts.length) {
          optionCounts[chosen]++;
        }
        if (chosen === Number(q.correctAnswer)) {
          qCorrect++;
          candidatesCorrect.push(candidateName);
        } else {
          qWrong++;
          candidatesWrong.push(candidateName);
        }
      }
    });

    const totalTries = attemptedCount;
    const accuracy = totalTries > 0 ? Math.round((qCorrect / totalTries) * 100) : 0;
    const wrongPct = totalTries > 0 ? Math.round((qWrong / totalTries) * 100) : 0;
    const diff = accuracy >= 75 ? 'Easy' : accuracy >= 50 ? 'Moderate' : 'Challenging';
    const correctKeyChar = String.fromCharCode(65 + (Number(q.correctAnswer) || 0));

    questionAnalysisList.push({
      qNumber: idx + 1,
      question: q,
      accuracy,
      wrongPct,
      diff,
      correctKeyChar,
      qCorrect,
      qWrong,
      qSkipped,
      totalTries,
      optionCounts,
      candidatesCorrect,
      candidatesWrong,
      candidatesSkipped,
    });
  });

  // =========================================================================
  // DETAILED QUESTION-BY-QUESTION INDIVIDUAL BREAKDOWN CARDS
  // =========================================================================
  if (currentY + 50 > pageHeight - 18) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 128, 55);
  doc.text('DETAILED QUESTION-BY-QUESTION ITEM BREAKDOWN', 14, currentY);
  currentY += 6;

  questionAnalysisList.forEach((qa) => {
    const splitQText = doc.splitTextToSize(`"${qa.question.text}"`, pageWidth - 32);
    const qTextHeight = splitQText.length * 4.2 + 2;
    const optionRowsCount = (qa.question.options || []).length || 4;
    const estCardHeight = 10.5 + qTextHeight + 3.5 + (optionRowsCount + 1) * 6 + 6;

    if (currentY + estCardHeight > pageHeight - 18) {
      doc.addPage();
      currentY = 20;
    }

    // Card Header Bar
    doc.setFillColor(240, 253, 244);
    doc.rect(14, currentY, pageWidth - 28, 7.5, 'F');
    doc.setDrawColor(167, 243, 208);
    doc.rect(14, currentY, pageWidth - 28, 7.5, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 128, 55);
    doc.text(`Question #${qa.qNumber}  [${qa.question.section || 'General'}]`, 17, currentY + 5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(qa.diff === 'Easy' ? 5 : qa.diff === 'Challenging' ? 225 : 217, qa.diff === 'Easy' ? 150 : qa.diff === 'Challenging' ? 29 : 119, qa.diff === 'Easy' ? 105 : qa.diff === 'Challenging' ? 72 : 6);
    doc.text(`Tier: ${qa.diff} (${qa.accuracy}% Accuracy)`, 95, currentY + 5);

    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text(`Marks: +${qa.question.marks || 1} / -${qa.question.negativeMarks ?? examNegativeMarks}`, pageWidth - 17, currentY + 5, { align: 'right' });
    currentY += 10.5;

    // Full Question Text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(splitQText, 16, currentY);
    currentY += splitQText.length * 4.2 + 2;

    // Metrics mini-row
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Correct: ${qa.qCorrect}/${qa.totalTries} (${qa.accuracy}%)  |  Incorrect: ${qa.qWrong}/${qa.totalTries} (${qa.wrongPct}%)  |  Skipped: ${qa.qSkipped}/${qa.totalTries}`,
      16,
      currentY
    );
    currentY += 3.5;

    // Options Distribution Table for this question
    const optionRows = (qa.question.options || []).map((optText: string, oIdx: number) => {
      const isCorrect = oIdx === Number(qa.question.correctAnswer);
      const chosenCount = qa.optionCounts[oIdx] || 0;
      const pct = qa.totalTries > 0 ? Math.round((chosenCount / qa.totalTries) * 100) : 0;
      const optLetter = String.fromCharCode(65 + oIdx);

      return [
        `Option ${optLetter}`,
        optText,
        isCorrect ? '✓ Correct Answer' : 'Incorrect Choice',
        `${chosenCount} Candidate${chosenCount !== 1 ? 's' : ''} (${pct}%)`,
      ];
    });

    autoTable(doc, {
      startY: currentY,
      head: [['Option', 'Option Text', 'Status', 'Candidates Selected']],
      body: optionRows,
      theme: 'grid',
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [51, 65, 85],
        fontStyle: 'bold',
        fontSize: 7,
      },
      columnStyles: {
        0: { cellWidth: 20, fontStyle: 'bold', textColor: [0, 128, 55], fontSize: 7 },
        1: { cellWidth: 'auto', textColor: [30, 41, 59], fontSize: 7 },
        2: { cellWidth: 32, fontStyle: 'bold', fontSize: 7 },
        3: { cellWidth: 42, fontStyle: 'bold', textColor: [71, 85, 105], halign: 'center', fontSize: 7 },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 2) {
          if (data.cell.raw === '✓ Correct Answer') {
            data.cell.styles.textColor = [0, 128, 55];
            data.cell.styles.fillColor = [236, 253, 245];
          } else {
            data.cell.styles.textColor = [156, 163, 175];
          }
        }
      },
      margin: { left: 16, right: 16 },
      styles: { cellPadding: 1.5, font: 'helvetica' },
    });

    currentY = (doc as any).lastAutoTable.finalY + 7;
  });

  // =========================================================================
  // SECTION 7: 3D VISUAL ANALYTICS & CHARTS GALLERY (AT THE VERY LAST / END)
  // =========================================================================

  // --- 3D Visual Analytics & Charts Gallery ---
  doc.addPage();
  currentY = 20;

  // Gallery Section Banner
  doc.setFillColor(0, 128, 55);
  doc.rect(14, currentY, pageWidth - 28, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('EXAMINATION 3D VISUAL ANALYTICS & CHARTS GALLERY', 18, currentY + 6.2);
  currentY += 13;

  const galleryChartHeight = 72;

  // Graph 1: 3D Score Distribution Chart
  const scoreDistChartImg = createScoreDistributionChart(
    attemptedCandidates.map((c) => safeNum(c.percentage)),
    attemptedCount
  );
  if (scoreDistChartImg) {
    doc.addImage(scoreDistChartImg, 'PNG', 14, currentY, pageWidth - 28, galleryChartHeight);
    currentY += galleryChartHeight + 6;
  }

  // Row 2: 3D Pass vs Fail Qualification Donut & 3D Section-Wise Accuracy Performance Chart
  const passFailDonutImg = createPassFailDonutChart(passCount, failCount, notAttemptedCount, totalTargetCandidates);
  if (passFailDonutImg) {
    doc.addImage(passFailDonutImg, 'PNG', 14, currentY, (pageWidth - 32) / 2, galleryChartHeight);
  }

  const sectionChartImg = createSectionAccuracyChart(sectionStats);
  if (sectionChartImg) {
    doc.addImage(sectionChartImg, 'PNG', 14 + (pageWidth - 32) / 2 + 4, currentY, (pageWidth - 32) / 2, galleryChartHeight);
  }
  currentY += galleryChartHeight + 6;

  // Department Stats Data
  const deptMap = new Map<string, typeof attemptedCandidates>();
  attemptedCandidates.forEach((cr) => {
    const dept = cr.candidate.department || 'General';
    if (!deptMap.has(dept)) deptMap.set(dept, []);
    deptMap.get(dept)!.push(cr);
  });

  const deptStats: { department: string; avgScore: number; count: number }[] = [];
  deptMap.forEach((cands, dept) => {
    const avgPct = cands.length > 0 ? Math.round(cands.reduce((sum, c) => sum + safeNum(c.percentage), 0) / cands.length) : 0;
    deptStats.push({ department: dept, avgScore: avgPct, count: cands.length });
  });

  // Graph 3: 3D Department-Wise Performance Comparison Chart
  const deptChartImg = createDepartmentPerformanceChart(deptStats);
  if (deptChartImg) {
    doc.addImage(deptChartImg, 'PNG', 14, currentY, pageWidth - 28, galleryChartHeight);
  }

  
  // =========================================================================
  // OPTIONAL: COMPARATIVE ANALYSIS BENCHMARK PAGE
  // =========================================================================
  if (options?.comparisonExamData) {
    const compData = options.comparisonExamData;
    doc.addPage();
    currentY = 20;

    doc.setFillColor(0, 128, 55);
    doc.rect(14, currentY, pageWidth - 28, 9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('COMPARATIVE BENCHMARK ANALYSIS', 18, currentY + 6.2);
    currentY += 13;

    const otherCandidates = compData.candidates || [];
    const otherResults = compData.results || [];
    const otherAttempts = compData.attempts || [];
    const otherTotalAttempts = otherAttempts.filter((a) => a.isSubmitted || (a.answers && a.answers.length > 0)).length;
    const otherPassCount = otherResults.filter((r) => r.percentage >= 50).length;
    const otherPassRate = otherTotalAttempts > 0 ? Math.round((otherPassCount / otherTotalAttempts) * 100) : 0;
    const otherAvgScore = otherResults.length > 0 ? Math.round(otherResults.reduce((s, r) => s + r.percentage, 0) / otherResults.length) : 0;
    const otherIntegrityRate = otherTotalAttempts > 0 ? Math.round((otherAttempts.filter((a) => (a.tabSwitches || 0) === 0).length / otherTotalAttempts) * 100) : 0;
    const myIntegrityRate = attemptedCount > 0 ? Math.round((attemptedCandidates.filter((c) => safeNum(c.tabSwitches) === 0).length / attemptedCount) * 100) : 0;

    const compChartImg = createAtomComparativeChart(
      exam.name,
      compData.exam.name,
      [
        { label: 'Turnout Rate', val1: Math.round(turnoutRate), val2: otherCandidates.length > 0 ? Math.round((otherTotalAttempts / otherCandidates.length) * 100) : 0 },
        { label: 'Pass Rate', val1: Math.round(Number(passRate)), val2: otherPassRate },
        { label: 'Avg Score', val1: Math.round(Number(avgPercentage)), val2: otherAvgScore },
        { label: 'Integrity Rate', val1: myIntegrityRate, val2: otherIntegrityRate },
      ]
    );

    if (compChartImg) {
      doc.addImage(compChartImg, 'PNG', 14, currentY, pageWidth - 28, 95);
      currentY += 105;
    }

    autoTable(doc, {
      startY: currentY,
      head: [['Benchmark Metric', `${exam.name} (${exam.code})`, `${compData.exam.name} (${compData.exam.code})`, 'Delta / Variance']],
      body: [
        ['Registered Candidates', `${totalTargetCandidates}`, `${otherCandidates.length}`, `${totalTargetCandidates - otherCandidates.length}`],
        ['Attempted / Submissions', `${attemptedCount} (${Math.round(turnoutRate)}%)`, `${otherTotalAttempts}`, `${attemptedCount - otherTotalAttempts}`],
        ['Pass Rate', `${Math.round(Number(passRate))}%`, `${otherPassRate}%`, `${Math.round(Number(passRate)) - otherPassRate}%`],
        ['Average Score', `${Math.round(Number(avgPercentage))}%`, `${otherAvgScore}%`, `${Math.round(Number(avgPercentage)) - otherAvgScore}%`],
        ['Clean Integrity (0 tabs)', `${myIntegrityRate}%`, `${otherIntegrityRate}%`, `${myIntegrityRate - otherIntegrityRate}%`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [0, 128, 55], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      margin: { left: 14, right: 14 },
      styles: { cellPadding: 2, font: 'helvetica', fontSize: 8 },
    });
  }

  // =========================================================================
  // FOOTER & PAGE NUMBERING ON ALL PAGES
  // =========================================================================
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pWidth = doc.internal.pageSize.getWidth();
    const pHeight = doc.internal.pageSize.getHeight();

    doc.setFillColor(0, 128, 55);
    doc.rect(10, pHeight - 12, pWidth - 20, 0.4, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `ATOM SHAALE • Confidential Examination Report • Exam: ${exam.name} (${exam.code})`,
      10,
      pHeight - 7
    );
    doc.text(
      `Page ${i} of ${totalPages}`,
      pWidth - 10,
      pHeight - 7,
      { align: 'right' }
    );
  }

  // Clean filename
  const cleanName = exam.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanName}_Comprehensive_Exam_Report_${isFiltered ? 'Filtered' : 'Full'}.pdf`;

  doc.save(filename);
}

export async function exportQuestionPaperPdf(
  exam: Exam,
  options?: { showAnswers?: boolean }
): Promise<void> {
  const showAnswers = options?.showAnswers ?? true;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = 210;
  const pageHeight = 297;
  const leftMargin = 12;
  const rightMargin = 12;
  const topMargin = 16;
  const bottomMargin = 14;
  const contentWidth = pageWidth - leftMargin - rightMargin; // 186mm

  const logoDataUrl = await getLogoDataUrl();
  const examNegMarks = exam.settings?.negativeMarks ?? 0;
  const totalMarks = exam.questions.reduce((sum, q) => sum + (q.marks || 1), 0);

  let currentY = topMargin;

  // Helper to draw branded header and footer on every page
  const drawPageHeaderAndFooter = (isFirstPage: boolean) => {
    // Logo / Brand on left
    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, 'PNG', leftMargin, 4, 30, 10);
      } catch (e) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(0, 128, 55);
        doc.text('ATOM QMS', leftMargin, 11);
      }
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(0, 128, 55);
      doc.text('ATOM QMS', leftMargin, 11);
    }

    // Top Header line on subsequent pages
    if (!isFirstPage) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`${exam.name} (${exam.code}) - Question Paper`, leftMargin + 34, 10.5);
      doc.setDrawColor(226, 232, 240);
      doc.line(leftMargin, 14.5, pageWidth - rightMargin, 14.5);
    }

    // Footer line & text
    doc.setDrawColor(226, 232, 240);
    doc.line(leftMargin, pageHeight - 10, pageWidth - rightMargin, pageHeight - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('ATOM QMS | Confidential Exam Material | www.atomm.in', leftMargin, pageHeight - 6);
  };

  // Check available height and create new page if needed
  const ensureSpace = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - bottomMargin) {
      doc.addPage();
      drawPageHeaderAndFooter(false);
      currentY = topMargin;
    }
  };

  // Draw Page 1 Header
  drawPageHeaderAndFooter(true);
  currentY = 18;

  // Title Banner
  doc.setFillColor(0, 128, 55);
  doc.roundedRect(leftMargin, currentY, contentWidth, 16, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('EXAM QUESTION PAPER', leftMargin + 6, currentY + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(240, 253, 244);
  doc.text(
    `${exam.name}  |  Code: ${exam.code}  |  Duration: ${exam.settings?.duration || 60} Mins  |  Total Marks: ${totalMarks}`,
    leftMargin + 6,
    currentY + 12
  );

  currentY += 19;

  // Instructions Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(leftMargin, currentY, contentWidth, 12, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('Instructions & Guidelines:', leftMargin + 4, currentY + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `• Total Questions: ${exam.questions.length} | Passing: 50% | Negative marking: ${examNegMarks > 0 ? `-${examNegMarks} per wrong answer` : 'None'} | Whitespace & code indentation strictly aligned.`,
    leftMargin + 4,
    currentY + 8
  );

  currentY += 16;

  // Render questions grouped with visual card styling matching the exam review UI
  let lastSection: string | null = null;

  exam.questions.forEach((q, idx) => {
    const qNum = idx + 1;
    const marks = q.marks || 1;
    const negMarks = q.negativeMarks ?? examNegMarks;
    const typeLabel = q.type === 'mcq' ? 'MCQ' : q.type === 'mcq-image' ? 'MCQ + Image' : q.type === 'true-false' ? 'True/False' : 'Reading Comprehension';

    // Parse question text into prose and code blocks
    const contentBlocks = parseQuestionContent(q.text || '');

    // Card dimensions
    const cardLeft = leftMargin;
    const cardWidth = contentWidth; // 186mm
    const cardPad = 3.5;
    const innerLeft = cardLeft + cardPad;
    const innerWidth = cardWidth - (cardPad * 2); // 179mm

    // Measure prompt
    let hasFirstText = false;
    let promptLines: string[] = [];
    let promptH = 5.0;

    if (contentBlocks.length > 0 && contentBlocks[0].type === 'text') {
      hasFirstText = true;
      const cleanFirst = contentBlocks[0].content.replace(/^Q?\d+[\.\:]\s*/i, '');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      promptLines = doc.splitTextToSize(`Q${qNum}. ${cleanFirst}`, innerWidth);
      promptH = promptLines.length * 4.0 + 1.5;
    }

    // Measure Reading Passage
    let passageH = 0;
    let passageLines: string[] = [];
    if (q.type === 'reading-comprehension' && q.passage) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      passageLines = doc.splitTextToSize(`Passage: ${q.passage}`, innerWidth - 6);
      passageH = Math.min(42, passageLines.length * 3.4 + 7) + 2.0;
    }

    // Measure Question Image
    let imgH = 0;
    if (q.imageUrl) {
      imgH = 30 + 2.0;
    }

    // Measure Code & Subsequent Text Blocks
    let blocksH = 0;
    contentBlocks.forEach((block, bIdx) => {
      if (bIdx === 0 && hasFirstText) return;
      if (block.type === 'code') {
        const rawLines = block.content.split('\n');
        blocksH += 4.8 + (rawLines.length * 3.4) + 2.5 + 2.0;
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const tLines = doc.splitTextToSize(block.content, innerWidth);
        blocksH += (tLines.length * 4.0) + 1.2;
      }
    });

    // Badges Bar Height
    const badgesH = 4.2 + 2.0;

    // Measure Options (2-Column Grid)
    const colGap = 3.5;
    const colW = (innerWidth - colGap) / 2; // ~87.7mm
    const optList = (q.type === 'true-false' ? q.options.slice(0, 2) : q.options);

    const calcOptHeight = (optIdx: number): number => {
      if (optIdx >= optList.length) return 7;
      const isCorrect = q.correctAnswer === optIdx;
      const optText = optList[optIdx] ?? '';
      const fallback = q.type === 'true-false' ? (optIdx === 0 ? 'True' : 'False') : `Option ${String.fromCharCode(65 + optIdx)}`;
      doc.setFont('helvetica', isCorrect && showAnswers ? 'bold' : 'normal');
      doc.setFontSize(8);
      const lines = doc.splitTextToSize(optText.trim() || fallback, colW - 10);
      const textH = lines.length * 3.6 + 3.0;
      const correctExtra = (showAnswers && isCorrect) ? 3.5 : 0;
      const imgExtra = (q.type === 'mcq-image' && q.optionImages?.[optIdx]) ? 18 : 0;
      return Math.max(7.2, textH + correctExtra + imgExtra);
    };

    const row0H = Math.max(calcOptHeight(0), optList.length > 1 ? calcOptHeight(1) : 0);
    const row1H = optList.length > 2 ? Math.max(calcOptHeight(2), optList.length > 3 ? calcOptHeight(3) : 0) : 0;
    const optionsH = row0H + (optList.length > 2 ? row1H + 2.0 : 0);

    // Total Card Height
    const totalCardHeight = (cardPad * 2) + promptH + passageH + imgH + blocksH + badgesH + optionsH;

    // Check if section header is needed
    const currentSectionName = (q.section && q.section.trim()) || '';
    const isNewSection = Boolean(
      currentSectionName &&
      currentSectionName !== lastSection &&
      currentSectionName !== 'General' &&
      currentSectionName !== 'Unsorted'
    );
    const sectionHeaderH = isNewSection ? 9.5 : 0;

    // Total space needed for question (+ section header if new)
    const totalNeeded = sectionHeaderH + totalCardHeight;
    const maxPageUsable = pageHeight - bottomMargin - topMargin;

    // Decide page break BEFORE printing section header or question
    if (currentY + totalNeeded > pageHeight - bottomMargin) {
      if (totalCardHeight <= maxPageUsable) {
        doc.addPage();
        drawPageHeaderAndFooter(false);
        currentY = topMargin;
      } else if (currentY + 45 > pageHeight - bottomMargin) {
        doc.addPage();
        drawPageHeaderAndFooter(false);
        currentY = topMargin;
      }
    }

    // Now render Section Header (GUARANTEED on same page as question)
    if (isNewSection) {
      lastSection = currentSectionName;
      doc.setFillColor(0, 128, 55);
      doc.rect(leftMargin, currentY, 2.5, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.setTextColor(0, 128, 55);
      doc.text(currentSectionName, leftMargin + 5, currentY + 4.8);
      currentY += 8.5;
    }

    // Draw Outer Rounded Card Container
    const cardTop = currentY;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240); // slate-200 subtle border
    doc.roundedRect(cardLeft, cardTop, cardWidth, totalCardHeight, 2, 2, 'FD');

    let itemY = cardTop + cardPad;

    // A. Render Prompt Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    const prefixStr = `Q${qNum}. `;
    const prefixW = doc.getTextWidth(prefixStr);

    if (hasFirstText) {
      doc.setTextColor(0, 128, 55);
      doc.text(prefixStr, innerLeft, itemY + 3.8);

      doc.setTextColor(15, 23, 42);
      const line0Rest = promptLines[0].substring(prefixStr.length);
      doc.text(line0Rest, innerLeft + prefixW, itemY + 3.8);

      let textY = itemY + 3.8 + 4.0;
      for (let l = 1; l < promptLines.length; l++) {
        doc.text(promptLines[l], innerLeft, textY);
        textY += 4.0;
      }
      itemY = textY - 4.0 + 2.0;
    } else {
      doc.setTextColor(0, 128, 55);
      doc.text(prefixStr, innerLeft, itemY + 3.8);
      itemY += 5.0;
    }

    // B. Render Reading Passage (if RC)
    if (q.type === 'reading-comprehension' && q.passage) {
      const pBoxH = Math.min(42, passageLines.length * 3.4 + 7);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(innerLeft, itemY, innerWidth, pBoxH, 1.2, 1.2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      doc.text('Reading Passage:', innerLeft + 3.5, itemY + 3.8);

      doc.setFont('helvetica', 'italic');
      doc.setTextColor(71, 85, 105);
      doc.text(passageLines.slice(0, 10), innerLeft + 3.5, itemY + 7.2);

      itemY += pBoxH + 2.0;
    }

    // C. Render Question Image (if any)
    if (q.imageUrl) {
      try {
        const imgH = 30;
        const imgW = 55;
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(innerLeft, itemY, imgW, imgH, 1.2, 1.2, 'D');
        doc.addImage(q.imageUrl, 'PNG', innerLeft + 0.5, itemY + 0.5, imgW - 1, imgH - 1);
        itemY += imgH + 2.0;
      } catch (err) {
        console.warn('Could not add image to question paper PDF', err);
      }
    }

    // D. Render Code Blocks and Trailing Prose Text
    contentBlocks.forEach((block, bIdx) => {
      if (bIdx === 0 && hasFirstText) return;

      if (block.type === 'code') {
        const rawLines = block.content.split('\n');
        const codeLines = rawLines.map(l => l.replace(/\t/g, '    '));
        const headerH = 4.8;
        const lineH = 3.4;
        const bodyH = codeLines.length * lineH + 2.5;
        const totalCodeBoxH = headerH + bodyH;

        // Outer Dark Container
        doc.setFillColor(15, 23, 42); // slate-900
        doc.setDrawColor(51, 65, 85); // slate-700
        doc.roundedRect(innerLeft, itemY, innerWidth, totalCodeBoxH, 1.5, 1.5, 'FD');

        // Header Bar (Terminal Header)
        doc.setFillColor(30, 41, 59); // slate-800
        doc.roundedRect(innerLeft, itemY, innerWidth, headerH, 1.5, 1.5, 'F');
        doc.rect(innerLeft, itemY + 2, innerWidth, headerH - 2, 'F');
        doc.setDrawColor(51, 65, 85);
        doc.line(innerLeft, itemY + headerH, innerLeft + innerWidth, itemY + headerH);

        // Terminal icon ">_ "
        doc.setFont('courier', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(52, 211, 153); // emerald-400
        doc.text('>_ ', innerLeft + 3, itemY + 3.4);

        // Language
        const langLabel = (block.language && block.language.toLowerCase() !== 'code') ? block.language : 'Python';
        doc.setTextColor(203, 213, 225); // slate-300
        doc.text(langLabel, innerLeft + 8.5, itemY + 3.4);

        // Line count
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184); // slate-400
        const lText = `(${codeLines.length} line${codeLines.length !== 1 ? 's' : ''})`;
        const lX = innerLeft + 8.5 + doc.getTextWidth(langLabel) + 2;
        doc.text(lText, lX, itemY + 3.3);

        // Monospace code lines with line numbers
        let cLineY = itemY + headerH + 2.8;
        codeLines.forEach((cLine, lineIdx) => {
          // Line number
          doc.setFont('courier', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139); // slate-500
          doc.text(String(lineIdx + 1), innerLeft + 6.5, cLineY, { align: 'right' });

          // Code text
          doc.setFont('courier', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(241, 245, 249); // slate-100
          const maxC = 88;
          const disp = cLine.length > maxC ? cLine.substring(0, maxC - 3) + '...' : cLine;
          doc.text(disp, innerLeft + 9, cLineY);

          cLineY += lineH;
        });

        itemY += totalCodeBoxH + 2.0;
      } else {
        // Trailing prose text
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        const tLines = doc.splitTextToSize(block.content, innerWidth);
        tLines.forEach((tl: string) => {
          doc.text(tl, innerLeft, itemY + 3.5);
          itemY += 4.0;
        });
        itemY += 1.0;
      }
    });

    // E. Render Badges Bar ([MCQ] [2 marks] [-0.00 neg])
    const badgeH = 4.2;
    let bX = innerLeft;
    const renderPill = (txt: string) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      const tw = doc.getTextWidth(txt);
      const bw = tw + 5;

      doc.setFillColor(241, 245, 249); // slate-100
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.roundedRect(bX, itemY, bw, badgeH, 1, 1, 'FD');

      doc.setTextColor(71, 85, 105); // slate-600
      doc.text(txt, bX + bw / 2, itemY + 3.0, { align: 'center' });

      bX += bw + 2;
    };

    renderPill(typeLabel);
    renderPill(`${marks} mark${marks !== 1 ? 's' : ''}`);
    renderPill(`-${negMarks > 0 ? negMarks.toFixed(2) : '0.00'} neg`);

    itemY += badgeH + 2.5;

    // F. Render Options in 2-Column Grid
    const colXs = [innerLeft, innerLeft + colW + colGap];

    const renderOptCard = (optIdx: number, oX: number, oY: number, oH: number) => {
      const isCorrect = q.correctAnswer === optIdx;
      const labelLetter = String.fromCharCode(65 + optIdx);
      const rawOpt = optList[optIdx] ?? '';
      const fallbackOpt = q.type === 'true-false' ? (optIdx === 0 ? 'True' : 'False') : `Option ${labelLetter}`;
      const dispOpt = rawOpt.trim() || fallbackOpt;

      if (showAnswers && isCorrect) {
        // Emerald highlighted card
        doc.setFillColor(240, 253, 244); // emerald-50
        doc.setDrawColor(134, 239, 172); // emerald-300
        doc.roundedRect(oX, oY, colW, oH, 1.2, 1.2, 'FD');

        // "C." label
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(0, 128, 55);
        doc.text(`${labelLetter}.`, oX + 2.8, oY + 3.8);

        // Option Text
        const optLines = doc.splitTextToSize(dispOpt, colW - 10);
        doc.text(optLines, oX + 6.8, oY + 3.8);

        // "(Correct)" tag
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(0, 128, 55);
        doc.text('(Correct)', oX + 6.8, oY + oH - 1.6);
      } else {
        // Standard option card
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.roundedRect(oX, oY, colW, oH, 1.2, 1.2, 'FD');

        // "A." label
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(`${labelLetter}.`, oX + 2.8, oY + 3.8);

        // Option Text
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 41, 59);
        const optLines = doc.splitTextToSize(dispOpt, colW - 10);
        doc.text(optLines, oX + 6.8, oY + 3.8);
      }

      // Option image if any
      if (q.type === 'mcq-image' && q.optionImages?.[optIdx]) {
        try {
          doc.addImage(q.optionImages[optIdx], 'PNG', oX + 6.8, oY + oH - 18, 22, 15);
        } catch (e) {
          console.warn('Option image render error', e);
        }
      }
    };

    // Row 0: Options A and B
    renderOptCard(0, colXs[0], itemY, row0H);
    if (optList.length > 1) {
      renderOptCard(1, colXs[1], itemY, row0H);
    }
    itemY += row0H + 2.0;

    // Row 1: Options C and D
    if (optList.length > 2) {
      renderOptCard(2, colXs[0], itemY, row1H);
      if (optList.length > 3) {
        renderOptCard(3, colXs[1], itemY, row1H);
      }
      itemY += row1H + 2.0;
    }

    // Advance Y position for next question
    currentY = cardTop + totalCardHeight + 3.5;
  });

  // =========================================================================
  // ANSWER KEY SUMMARY TABLE (at the end)
  // =========================================================================
  if (showAnswers && exam.questions.length > 0) {
    ensureSpace(45);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 128, 55);
    doc.text('Answer Key Summary', leftMargin, currentY);
    currentY += 4;

    const keyRows = exam.questions.map((q, idx) => [
      `Q${idx + 1}`,
      String.fromCharCode(65 + (q.correctAnswer ?? 0)),
      (q.options[q.correctAnswer] || '').replace(/\s+/g, ' ').substring(0, 40),
      `+${q.marks || 1}`,
      (q.negativeMarks ?? examNegMarks) > 0 ? `-${q.negativeMarks ?? examNegMarks}` : '0',
      q.section || 'General',
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Question', 'Correct Option', 'Answer Preview', 'Marks', 'Negative', 'Section']],
      body: keyRows,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 128, 55],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 18, fontStyle: 'bold', halign: 'center', fontSize: 7.5 },
        1: { cellWidth: 24, fontStyle: 'bold', textColor: [0, 128, 55], halign: 'center', fontSize: 8 },
        2: { cellWidth: 70, fontSize: 7.5 },
        3: { cellWidth: 16, halign: 'center', fontSize: 7.5 },
        4: { cellWidth: 18, halign: 'center', fontSize: 7.5 },
        5: { cellWidth: 36, fontSize: 7.5 },
      },
      margin: { left: leftMargin, right: rightMargin },
      styles: { cellPadding: 1.5, font: 'helvetica' },
    });
  }

  // Stamp Page Numbers (Page X of Y) on every page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - rightMargin, pageHeight - 9, { align: 'right' });
  }

  const cleanName = exam.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${cleanName}_Question_Paper.pdf`);
}
