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

// Helper: Convert template background image to base64 Data URL
async function getTemplateBgDataUrl(): Promise<string | null> {
  try {
    const response = await fetch('/atom_template_clean_bg.png');
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Could not load template background for PDF report:', err);
    return null;
  }
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

/**
 * Chart: ATOM Page 1 Executive Overview Dual-Panel (Pass vs. Fail 3D Donut + Score Benchmark 3D Bars)
 */
function createAtomExecutiveOverviewCharts(
  passedCount: number,
  failedCount: number,
  passRate: number,
  highestPct: number,
  avgPct: number,
  lowestPct: number
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 680;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const total = passedCount + failedCount;
  const failRate = total > 0 ? Math.max(0, 100 - passRate) : 0;

  // Outer subtle border card
  ctx.save();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  // Vertical divider between panels
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 20);
  ctx.lineTo(canvas.width / 2, canvas.height - 20);
  ctx.stroke();
  ctx.restore();

  // -------------------------------------------------------------
  // LEFT PANEL: Pass vs. Fail 3D Donut
  // -------------------------------------------------------------
  ctx.save();
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px Century Gothic';
  ctx.textAlign = 'center';
  ctx.fillText('Pass vs. Fail Composition', canvas.width / 4, 55);

  const passFailData = [
    {
      label: 'Passed',
      value: Math.max(0.001, passedCount),
      color: '#059669',
      count: passedCount,
      percentStr: `${passRate}%`,
    },
    {
      label: 'Failed',
      value: Math.max(0.001, failedCount),
      color: '#e11d48',
      count: failedCount,
      percentStr: `${failRate}%`,
    },
  ];

  draw3DDonutOnCanvas(ctx, canvas.width / 4, 340, 140, 28, 65, passFailData);

  // Bottom Legend for Pass / Fail
  ctx.font = 'bold 18px Century Gothic';
  ctx.fillStyle = '#059669';
  ctx.textAlign = 'center';
  ctx.fillText(`Passed: ${passedCount} (${passRate}%)`, canvas.width / 4 - 120, 595);

  ctx.fillStyle = '#e11d48';
  ctx.fillText(`Failed: ${failedCount} (${failRate}%)`, canvas.width / 4 + 120, 595);
  ctx.restore();

  // -------------------------------------------------------------
  // RIGHT PANEL: Benchmark & Average Performance 3D Bars
  // -------------------------------------------------------------
  ctx.save();
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px Century Gothic';
  ctx.textAlign = 'center';
  ctx.fillText('Average Performance & Score Range', (3 * canvas.width) / 4, 55);

  const rStartX = canvas.width / 2 + 70;
  const rWidth = canvas.width / 2 - 140;
  const floorY = 530;
  const maxHeight = 340;
  const depth = 22;
  const barW = 110;

  const barItems = [
    { label: 'Highest', value: highestPct, color: '#059669' },
    { label: 'Average', value: avgPct, color: '#2563eb' },
    { label: 'Lowest', value: lowestPct, color: '#f59e0b' },
  ];

  const barSpacing = (rWidth - barW * barItems.length) / (barItems.length - 1);

  // Grid lines (0%, 25%, 50%, 75%, 100%)
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const gy = floorY - (g / 4) * maxHeight;
    ctx.beginPath();
    ctx.moveTo(rStartX - 20, gy);
    ctx.lineTo(rStartX + rWidth + 20, gy);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '15px Century Gothic';
    ctx.textAlign = 'right';
    ctx.fillText(`${g * 25}%`, rStartX - 25, gy + 5);
  }

  // Floor
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(rStartX - 30, floorY);
  ctx.lineTo(rStartX + rWidth + 30, floorY);
  ctx.stroke();

  barItems.forEach((b, i) => {
    const barH = Math.max(10, (b.value / 100) * maxHeight);
    const bx = rStartX + i * (barW + barSpacing);
    const by = floorY - barH;

    draw3DBarOnCanvas(ctx, bx, by, barW, barH, depth, b.color);

    // Value above bar
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px Century Gothic';
    ctx.textAlign = 'center';
    ctx.fillText(`${b.value}%`, bx + barW / 2 + depth / 2, by - depth - 10);

    // Label below floor
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 18px Century Gothic';
    ctx.fillText(b.label, bx + barW / 2, floorY + 32);
  });
  ctx.restore();

  return canvas.toDataURL('image/png');
}

/**
 * Chart: ATOM 7-bracket Histogram Chart (0-40%, 41-50%, 51-60%, 61-70%, 71-80%, 81-90%, 91-100%)
 */
function createAtomScoreHistogramChart(
  attemptedPercentages: number[],
  totalAttempts: number
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  canvas.height = 700;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const brackets = [
    { label: '0–40%', min: 0, max: 40, color: '#3b82f6' },
    { label: '41–50%', min: 41, max: 50, color: '#3b82f6' },
    { label: '51–60%', min: 51, max: 60, color: '#3b82f6' },
    { label: '61–70%', min: 61, max: 70, color: '#3b82f6' },
    { label: '71–80%', min: 71, max: 80, color: '#3b82f6' },
    { label: '81–90%', min: 81, max: 90, color: '#3b82f6' },
    { label: '91–100%', min: 91, max: 100, color: '#3b82f6' },
  ];

  const counts = brackets.map(
    (b) => attemptedPercentages.filter((p) => p >= b.min && p <= b.max).length
  );
  const maxCount = Math.max(1, ...counts);

  const floorY = 580;
  const chartStartX = 100;
  const chartWidth = canvas.width - 200;
  const barWidth = 110;
  const depth = 22;
  const maxHeight = 380;
  const spacing = (chartWidth - barWidth * brackets.length) / (brackets.length - 1);

  // Background Grid Lines
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
    ctx.fillText(`${Math.round((g / 4) * maxCount)}`, chartStartX - 30, gy + 5);
  }
  ctx.restore();

  // Floor
  ctx.save();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(chartStartX - 30, floorY);
  ctx.lineTo(chartStartX + chartWidth + 30, floorY);
  ctx.stroke();
  ctx.restore();

  brackets.forEach((b, i) => {
    const count = counts[i];
    const pctShare = totalAttempts > 0 ? ((count / totalAttempts) * 100).toFixed(1) : '0';
    const barHeight = count > 0 ? Math.max(14, (count / maxCount) * maxHeight) : 0;
    const bx = chartStartX + i * (barWidth + spacing);
    const by = floorY - barHeight;

    if (barHeight > 0) {
      draw3DBarOnCanvas(ctx, bx, by, barWidth, barHeight, depth, '#3b82f6');
    }

    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px Century Gothic';
    ctx.textAlign = 'center';
    ctx.fillText(`${count}`, bx + barWidth / 2 + depth / 2, (barHeight > 0 ? by - depth : floorY) - 14);

    ctx.fillStyle = '#64748b';
    ctx.font = '16px Century Gothic';
    ctx.fillText(`(${pctShare}%)`, bx + barWidth / 2 + depth / 2, (barHeight > 0 ? by - depth : floorY) + 8);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 20px Century Gothic';
    ctx.fillText(b.label, bx + barWidth / 2, floorY + 36);
    ctx.restore();
  });

  return canvas.toDataURL('image/png');
}

/**
 * Chart: ATOM 4-Tier Performance Composition Donut Chart
 */
function createAtomTiersDonutChart(percentages: number[]): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 650;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const total = percentages.length;
  const excellentCount = percentages.filter((p) => p >= 90).length;
  const goodCount = percentages.filter((p) => p >= 60 && p < 90).length;
  const avgCount = percentages.filter((p) => p >= 40 && p < 60).length;
  const improvementCount = percentages.filter((p) => p < 40).length;

  const data = [
    {
      label: 'Excellent (90-100%)',
      value: excellentCount,
      color: '#059669',
      count: excellentCount,
      percentStr: `${total > 0 ? ((excellentCount / total) * 100).toFixed(1) : 0}%`,
    },
    {
      label: 'Good (60-89%)',
      value: goodCount,
      color: '#2563eb',
      count: goodCount,
      percentStr: `${total > 0 ? ((goodCount / total) * 100).toFixed(1) : 0}%`,
    },
    {
      label: 'Average (40-59%)',
      value: avgCount,
      color: '#f59e0b',
      count: avgCount,
      percentStr: `${total > 0 ? ((avgCount / total) * 100).toFixed(1) : 0}%`,
    },
    {
      label: 'Needs Improvement (<40%)',
      value: improvementCount,
      color: '#e11d48',
      count: improvementCount,
      percentStr: `${total > 0 ? ((improvementCount / total) * 100).toFixed(1) : 0}%`,
    },
  ];

  draw3DDonutOnCanvas(ctx, 600, 340, 220, 42, 100, data);

  return canvas.toDataURL('image/png');
}

/**
 * Chart: 3D Side-by-Side Comparative Bar Chart for 2 Exams
 */
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
  includeResults?: boolean; // true = With Complete Result, false = Without Result (Summary & Analytics only)
  comparisonExamData?: ComparisonExamData; // Optional comparison with another exam
}

/**
 * Generate and download a Complete Comprehensive PDF Report matching the exact ATOM Specification Template
 */
export async function exportExamDetailedPdfReport(
  exam: Exam,
  candidates: Candidate[],
  results: ExamResult[],
  attempts: ExamAttempt[],
  options?: PdfExportOptions
) {
  const isFiltered = options?.isFiltered ?? false;
  const includeResults = options?.includeResults !== false; // default to true
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

    // Calculate time taken in minutes
    let timeTakenMinutes = 0;
    if (attempt?.startedAt && attempt?.submittedAt) {
      const s = new Date(attempt.startedAt).getTime();
      const e = new Date(attempt.submittedAt).getTime();
      if (e > s) {
        timeTakenMinutes = Math.max(1, Math.round((e - s) / 60000));
      }
    } else if (attempt?.answers && attempt.answers.length > 0) {
      const totalSec = attempt.answers.reduce((acc, a) => acc + (safeNum(a.timeSpentSeconds) || 0), 0);
      if (totalSec > 0) {
        timeTakenMinutes = Math.max(1, Math.round(totalSec / 60));
      }
    }
    if (timeTakenMinutes === 0 && isAttempted) {
      timeTakenMinutes = Math.min(exam.settings?.duration || 30, 25);
    }

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
    const accuracy = (correct + wrong) > 0 ? Math.round((correct / (correct + wrong)) * 100) : percentage;
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
      accuracy,
      timeTakenMinutes,
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
  const completionRate = totalTargetCandidates > 0 ? ((attemptedCount / totalTargetCandidates) * 100).toFixed(1) : '0';
  const passCount = attemptedCandidates.filter((cr) => cr.isPass).length;
  const passRate = attemptedCount > 0 ? ((passCount / attemptedCount) * 100).toFixed(0) : '0';

  const totalScoreSum = attemptedCandidates.reduce((sum, cr) => sum + safeNum(cr.percentage), 0);
  const avgPercentage = attemptedCount > 0 ? (totalScoreSum / attemptedCount).toFixed(1) : '0';

  const highestPercentage = attemptedCount > 0
    ? Math.max(...attemptedCandidates.map((cr) => safeNum(cr.percentage))).toFixed(0)
    : '0';
  const lowestPercentage = attemptedCount > 0
    ? Math.min(...attemptedCandidates.map((cr) => safeNum(cr.percentage))).toFixed(0)
    : '0';

  const avgTimeTakenMin = attemptedCount > 0
    ? Math.round(attemptedCandidates.reduce((sum, cr) => sum + cr.timeTakenMinutes, 0) / attemptedCount)
    : 0;

  const fastestAttemptMin = attemptedCount > 0
    ? Math.min(...attemptedCandidates.map((cr) => cr.timeTakenMinutes))
    : 0;

  const longestAttemptMin = attemptedCount > 0
    ? Math.max(...attemptedCandidates.map((cr) => cr.timeTakenMinutes))
    : 0;

  const avgTimePerQuestionSec = (attemptedCount > 0 && totalQuestions > 0)
    ? Math.round((avgTimeTakenMin * 60) / totalQuestions)
    : 0;

  // Initialize jsPDF Document (Portrait, A4)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const templateBgDataUrl = await getTemplateBgDataUrl();
  const logoDataUrl = await getLogoDataUrl();

  // Helper: Fallback vector decorations if template image fails to load
  const renderFallbackDecoration = () => {
    // Top right orange/brown corner triangle accent
    doc.setFillColor(245, 158, 11);
    doc.triangle(pageWidth, 0, pageWidth - 32, 0, pageWidth, 24, 'F');
    doc.setFillColor(217, 119, 6);
    doc.triangle(pageWidth, 0, pageWidth - 14, 0, pageWidth, 12, 'F');

    // ATOM Logo / Brand Header on left
    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, 'PNG', 14, 8, 38, 14);
      } catch (e) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(0, 128, 55);
        doc.text('ATOM', 14, 18);
      }
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(0, 128, 55);
      doc.text('ATOM', 14, 18);
    }

    // Subtle center watermark
    try {
      doc.saveGraphicsState();
      const gState = new (doc as any).GState({ opacity: 0.05 });
      doc.setGState(gState);
      doc.setFillColor(0, 128, 55);
      doc.setDrawColor(0, 128, 55);
      const cx = pageWidth / 2;
      const cy = pageHeight / 2 - 10;
      doc.roundedRect(cx - 38, cy - 38, 76, 76, 12, 12, 'F');
      doc.restoreGraphicsState();
    } catch (e) {
      // ignore
    }

    // Standard Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const footerDisclaimer = 'Any form of reproduction, dissemination, copying, disclosure, modification, distribution and or publication of this material is strictly prohibited.';
    doc.text(footerDisclaimer, pageWidth / 2, pageHeight - 12, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 128, 55);
    doc.text('| www.atomm.in |', pageWidth / 2, pageHeight - 7, { align: 'center' });
  };

  // Helper: Draw Header & Background Watermark from official template.pdf on ATOM page
  const renderAtomPageDecoration = (pageNumberText: string) => {
    if (templateBgDataUrl) {
      try {
        doc.addImage(templateBgDataUrl, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
      } catch (e) {
        console.warn('Failed to add template bg image, using fallback vector decoration', e);
        renderFallbackDecoration();
      }
    } else {
      renderFallbackDecoration();
    }

    // Dynamic Page Number in top-right peach triangle
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text(pageNumberText, pageWidth - 14, 11.5, { align: 'center' });
  };

  // =========================================================================
  // PAGE 1: EXECUTIVE SUMMARY & HIGH-LEVEL GRAPHS
  // =========================================================================
  renderAtomPageDecoration('1');

  let currentY = 32;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Executive Summary', 14, currentY);
  currentY += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text('A dashboard-style page showing the most important numbers:', 14, currentY);
  currentY += 6;

  // KPI Table
  autoTable(doc, {
    startY: currentY,
    head: [['KPI', 'Result']],
    body: [
      ['Students Registered', `${totalTargetCandidates}`],
      ['Students Attempted', `${attemptedCount}`],
      ['Completion Rate', `${completionRate}%`],
      ['Average Score', `${avgPercentage}%`],
      ['Highest Score', `${highestPercentage}%`],
      ['Lowest Score', `${lowestPercentage}%`],
      ['Pass Rate', `${passRate}%`],
      ['Average Time Taken', `${avgTimeTakenMin} min`],
    ],
    theme: 'plain',
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 10,
    },
    columnStyles: {
      0: { cellWidth: 80, fontStyle: 'bold', textColor: [30, 41, 59], fontSize: 9.5 },
      1: { cellWidth: 50, fontStyle: 'bold', textColor: [0, 128, 55], fontSize: 9.5 },
    },
    margin: { left: 14, right: 14 },
    styles: { cellPadding: 2.2, font: 'helvetica' },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Graphs: Overall Performance & Pass/Fail', 14, currentY);
  currentY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Visual analytics for pass vs. fail distribution and score benchmarks:', 14, currentY);
  currentY += 5;

  const passedCandidatesCount = passCount;
  const failedCandidatesCount = Math.max(0, attemptedCount - passCount);

  const execGraphsImg = createAtomExecutiveOverviewCharts(
    passedCandidatesCount,
    failedCandidatesCount,
    safeNum(passRate),
    safeNum(highestPercentage),
    safeNum(avgPercentage),
    safeNum(lowestPercentage)
  );

  if (execGraphsImg) {
    const graphHeight = 85;
    doc.addImage(execGraphsImg, 'PNG', 14, currentY, pageWidth - 28, graphHeight);
    currentY += graphHeight + 6;
  }

  // =========================================================================
  // PAGE 2: STUDENT PERFORMANCE DISTRIBUTION & SECTION-WISE PERFORMANCE
  // =========================================================================
  doc.addPage();
  renderAtomPageDecoration('2');
  currentY = 32;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('3. Student Performance Distribution', 14, currentY);
  currentY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Score distribution across 7 standardized performance brackets.', 14, currentY);
  currentY += 5;

  // Generate and insert Histogram Chart
  const scoreHistImg = createAtomScoreHistogramChart(
    attemptedCandidates.map((c) => safeNum(c.percentage)),
    attemptedCount
  );
  if (scoreHistImg) {
    const chartHeight = 68;
    doc.addImage(scoreHistImg, 'PNG', 14, currentY, pageWidth - 28, chartHeight);
    currentY += chartHeight + 8;
  }

  // Extract sections
  const sectionMap = new Map<string, typeof exam.questions>();
  exam.questions.forEach((q) => {
    const sec = q.section || 'General';
    if (!sectionMap.has(sec)) sectionMap.set(sec, []);
    sectionMap.get(sec)!.push(q);
  });

  // Section 4: Section-Wise Performance Table (rendered on Page 2)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('4. Section-Wise Performance', 14, currentY);
  currentY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Performance and accuracy metrics grouped by exam section / subject area:', 14, currentY);
  currentY += 5;

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

    const avgScoreSec = attemptedCount > 0 ? (secObtainedSum / attemptedCount).toFixed(1) : '0';

    sectionTableRows.push([
      sectionName,
      avgScoreSec,
      `${accuracy}%`,
      `${secMarks}`,
    ]);
  });

  autoTable(doc, {
    startY: currentY,
    head: [['Section', 'Avg. Score', 'Accuracy', 'Max Marks']],
    body: sectionTableRows,
    theme: 'plain',
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: 'bold', textColor: [30, 41, 59], fontSize: 8.5 },
      1: { cellWidth: 35, textColor: [51, 65, 85], fontSize: 8.5 },
      2: { cellWidth: 35, fontStyle: 'bold', textColor: [0, 128, 55], fontSize: 8.5 },
      3: { cellWidth: 35, textColor: [51, 65, 85], fontSize: 8.5 },
    },
    margin: { left: 14, right: 14 },
    styles: { cellPadding: 2.2, font: 'helvetica' },
  });

  // =========================================================================
  // PAGE 3: PERFORMANCE TIERS (DONUT) & TOP 10 LEADERBOARD
  // =========================================================================
  doc.addPage();
  renderAtomPageDecoration('3');
  currentY = 32;

  // Section 5: Student Performance Distribution
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('5. Student Performance Distribution (Tiers)', 14, currentY);
  currentY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Overall candidate performance categorized into 4 achievement tiers:', 14, currentY);
  currentY += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 128, 55);
  doc.text('Excellent: 90–100%', 16, currentY);
  currentY += 4.5;
  doc.setTextColor(37, 99, 235);
  doc.text('Good: 60–89%', 16, currentY);
  currentY += 4.5;
  doc.setTextColor(217, 119, 6);
  doc.text('Average: 40–59%', 16, currentY);
  currentY += 4.5;
  doc.setTextColor(225, 29, 72);
  doc.text('Needs Improvement: Below 40%', 16, currentY);
  currentY += 5.5;

  // Tiers Donut Chart
  const tiersDonutImg = createAtomTiersDonutChart(attemptedCandidates.map((c) => safeNum(c.percentage)));
  if (tiersDonutImg) {
    const donutHeight = 52;
    doc.addImage(tiersDonutImg, 'PNG', (pageWidth - 110) / 2, currentY, 110, donutHeight);
    currentY += donutHeight + 8;
  }

  // Section 6: Top Performers (Leaderboard)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('6. Top Performers (Leaderboard)', 14, currentY);
  currentY += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Top 10 highest scorers across batch of ${attemptedCount} candidate(s):`, 14, currentY);
  currentY += 5;

  const top10Candidates = attemptedCandidates.slice(0, 10);
  const top10Rows = top10Candidates.map((cr, idx) => [
    `${idx + 1}`,
    cr.candidate.name,
    cr.candidate.usn || '-',
    cr.candidate.phone || '-',
    `${cr.percentage}%`,
    `${cr.accuracy}%`,
    `${cr.timeTakenMinutes} min`,
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Rank', 'Student', 'USN / ID', 'Contact', 'Score', 'Accuracy', 'Time']],
    body: top10Rows.length > 0 ? top10Rows : [['-', 'No attempts yet', '-', '-', '-', '-', '-']],
    theme: 'plain',
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    columnStyles: {
      0: { cellWidth: 12, fontStyle: 'bold', textColor: [0, 128, 55], halign: 'center', fontSize: 8 },
      1: { cellWidth: 42, fontStyle: 'bold', textColor: [30, 41, 59], fontSize: 8 },
      2: { cellWidth: 26, textColor: [71, 85, 105], fontSize: 7.5 },
      3: { cellWidth: 30, textColor: [71, 85, 105], fontStyle: 'bold', fontSize: 7.5 },
      4: { cellWidth: 22, fontStyle: 'bold', textColor: [0, 128, 55], halign: 'center', fontSize: 8 },
      5: { cellWidth: 24, fontStyle: 'bold', textColor: [37, 99, 235], halign: 'center', fontSize: 8 },
      6: { cellWidth: 24, textColor: [71, 85, 105], halign: 'center', fontSize: 8 },
    },
    margin: { left: 14, right: 14 },
    styles: { cellPadding: 2, font: 'helvetica' },
  });

  // =========================================================================
  // PAGE 4: TIME ANALYSIS & QUESTION DIFFICULTY ANALYSIS
  // =========================================================================
  doc.addPage();
  renderAtomPageDecoration('4');
  currentY = 32;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('7. Time Analysis', 14, currentY);
  currentY += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Since your LMS records exam activity, include:', 14, currentY);
  currentY += 5;

  // Time Analysis table
  autoTable(doc, {
    startY: currentY,
    head: [['Time Metric Parameter', 'Value / Recorded Duration']],
    body: [
      ['Average time taken', `${avgTimeTakenMin} minutes`],
      ['Fastest attempt', `${fastestAttemptMin} minutes`],
      ['Longest attempt', `${longestAttemptMin} minutes`],
      ['Average time per question', `${avgTimePerQuestionSec} seconds / question`],
      ['Total Exam Scheduled Duration', `${exam.settings?.duration || 30} minutes`],
    ],
    theme: 'plain',
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 90, fontStyle: 'bold', textColor: [30, 41, 59], fontSize: 8.5 },
      1: { cellWidth: 80, fontStyle: 'bold', textColor: [0, 128, 55], fontSize: 8.5 },
    },
    margin: { left: 14, right: 14 },
    styles: { cellPadding: 2.2, font: 'helvetica' },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Section 8: Question Difficulty Analysis
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('8. Question Difficulty Analysis', 14, currentY);
  currentY += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Your LMS can automatically classify questions based on actual student responses.', 14, currentY);
  currentY += 4.5;
  doc.text('For example:', 14, currentY);
  currentY += 4.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 128, 55);
  doc.text('Easy', 16, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('•  > 80% students answered correctly', 28, currentY);
  currentY += 4.5;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(217, 119, 6);
  doc.text('Moderate', 16, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('•  50–80%', 36, currentY);
  currentY += 4.5;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(225, 29, 72);
  doc.text('Difficult', 16, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('•  < 50%', 33, currentY);
  currentY += 5.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Then show:', 14, currentY);
  currentY += 4.5;

  // Classify questions
  const easyQuestions: any[] = [];
  const moderateQuestions: any[] = [];
  const difficultQuestions: any[] = [];

  exam.questions.forEach((q, idx) => {
    let correctCount = 0;
    attemptedCandidates.forEach((cr) => {
      const ans = cr.attempt?.answers.find((a) => a.questionId === q.id);
      if (ans && ans.selectedAnswer === q.correctAnswer) {
        correctCount++;
      }
    });

    const accuracy = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;
    const preview = (q.text || '').replace(/\s+/g, ' ').substring(0, 42) + (q.text.length > 42 ? '...' : '');

    const item = {
      qNum: `Q${idx + 1}`,
      section: q.section || 'General',
      preview,
      accuracy: `${accuracy}%`,
      correct: `${correctCount}/${attemptedCount}`,
    };

    if (accuracy >= 80) {
      easyQuestions.push(item);
    } else if (accuracy >= 50) {
      moderateQuestions.push(item);
    } else {
      difficultQuestions.push(item);
    }
  });

  const questionDiffRows = [
    ...easyQuestions.map((q) => [q.qNum, q.section, q.preview, 'Easy (>80%)', q.accuracy, q.correct]),
    ...moderateQuestions.map((q) => [q.qNum, q.section, q.preview, 'Moderate (50-80%)', q.accuracy, q.correct]),
    ...difficultQuestions.map((q) => [q.qNum, q.section, q.preview, 'Difficult (<50%)', q.accuracy, q.correct]),
  ];

  autoTable(doc, {
    startY: currentY,
    head: [['Q#', 'Section', 'Question Preview', 'Difficulty Tier', 'Accuracy', 'Correct / Total']],
    body: questionDiffRows.length > 0 ? questionDiffRows : [['-', '-', 'No questions available', '-', '-', '-']],
    theme: 'plain',
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 12, fontStyle: 'bold', textColor: [0, 128, 55], halign: 'center', fontSize: 7.5 },
      1: { cellWidth: 26, textColor: [71, 85, 105], fontSize: 7.5 },
      2: { cellWidth: 64, textColor: [30, 41, 59], fontSize: 7.5 },
      3: { cellWidth: 32, fontStyle: 'bold', fontSize: 7.5 },
      4: { cellWidth: 20, fontStyle: 'bold', halign: 'center', fontSize: 7.5 },
      5: { cellWidth: 24, textColor: [71, 85, 105], halign: 'center', fontSize: 7.5 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const val = data.cell.raw;
        if (typeof val === 'string' && val.includes('Easy')) {
          data.cell.styles.textColor = [0, 128, 55];
        } else if (typeof val === 'string' && val.includes('Moderate')) {
          data.cell.styles.textColor = [217, 119, 6];
        } else if (typeof val === 'string' && val.includes('Difficult')) {
          data.cell.styles.textColor = [225, 29, 72];
        }
      }
    },
    margin: { left: 14, right: 14 },
    styles: { cellPadding: 1.8, font: 'helvetica' },
  });

  // =========================================================================
  // IF "WITH COMPLETE RESULT": COMPLETE CANDIDATE RESULTS SHEET (PAGE 5+)
  // =========================================================================
  if (includeResults) {
    // --- SECTION: COMPLETE CANDIDATE RESULTS SHEET ---
    doc.addPage();
    const resultsPageNum = (doc.internal as any).getNumberOfPages().toString();
    renderAtomPageDecoration(resultsPageNum);
    currentY = 32;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('9. Complete Candidate Results Sheet', 14, currentY);
    currentY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Master scorecard for all ${candidateResults.length} registered candidate(s) with contact, sectional breakdown, accuracy, and status.`, 14, currentY);
    currentY += 6;

    const candidateRankRows = candidateResults.map((cr, idx) => {
      const rank = cr.isAttempted ? `#${idx + 1}` : '-';
      const resultStatus = !cr.isAttempted ? 'ABSENT' : cr.isPass ? 'PASSED' : 'FAILED';
      const scoreDisplay = cr.isAttempted ? `${formatMarks(cr.obtainedMarks)} / ${examTotalMarks}` : '-';
      const pctDisplay = cr.isAttempted ? `${cr.percentage}%` : '-';
      const deptSec = `${cr.candidate.department || 'Gen'}${cr.candidate.section ? ` / ${cr.candidate.section}` : ''}`;
      const devName = cr.attempt?.deviceName || cr.candidate.deviceName || cr.candidate.deviceType || 'Laptop/PC';
      const shortDev = devName.includes('Android (Desktop Mode)')
        ? 'Android (Desktop)'
        : devName.includes('iPhone (Desktop Mode)')
        ? 'iPhone (Desktop)'
        : devName.includes('Android')
        ? 'Android'
        : devName.includes('iPhone')
        ? 'iPhone'
        : devName.includes('iPad') || devName.includes('Tablet')
        ? 'Tablet'
        : 'Laptop/PC';

      return [
        rank,
        cr.candidate.name,
        cr.candidate.email || '-',
        cr.candidate.phone || '-',
        cr.candidate.usn || '-',
        cr.candidate.college || '-',
        deptSec,
        shortDev,
        cr.isAttempted ? `${cr.attempt?.answers?.length || 0}` : '-',
        cr.isAttempted ? `${cr.correct}` : '-',
        cr.isAttempted ? `${cr.wrong}` : '-',
        scoreDisplay,
        pctDisplay,
        resultStatus,
        cr.isAttempted ? `${cr.tabSwitches}` : '-',
      ];
    });

    autoTable(doc, {
      startY: currentY,
      head: [['Rank', 'Student Name', 'Email', 'Contact', 'USN', 'College', 'Dept/Sec', 'Device', 'Att.', 'Corr', 'Wrong', 'Score', '%', 'Result', 'Tabs']],
      body: candidateRankRows,
      theme: 'plain',
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        fontSize: 6.5,
      },
      columnStyles: {
        0: { cellWidth: 8, fontStyle: 'bold', textColor: [0, 128, 55], halign: 'center', fontSize: 6.5 },
        1: { cellWidth: 24, fontStyle: 'bold', textColor: [30, 41, 59], fontSize: 6.5 },
        2: { cellWidth: 24, textColor: [71, 85, 105], fontSize: 6 },
        3: { cellWidth: 16, textColor: [71, 85, 105], fontStyle: 'bold', fontSize: 6 },
        4: { cellWidth: 15, textColor: [71, 85, 105], fontSize: 6 },
        5: { cellWidth: 16, textColor: [71, 85, 105], fontSize: 6 },
        6: { cellWidth: 14, textColor: [71, 85, 105], fontSize: 6 },
        7: { cellWidth: 14, fontStyle: 'bold', textColor: [71, 85, 105], halign: 'center', fontSize: 5.5 },
        8: { cellWidth: 8, textColor: [71, 85, 105], halign: 'center', fontSize: 6.5 },
        9: { cellWidth: 8, fontStyle: 'bold', textColor: [0, 128, 55], halign: 'center', fontSize: 6.5 },
        10: { cellWidth: 8, fontStyle: 'bold', textColor: [225, 29, 72], halign: 'center', fontSize: 6.5 },
        11: { cellWidth: 14, fontStyle: 'bold', textColor: [30, 41, 59], halign: 'center', fontSize: 6.5 },
        12: { cellWidth: 9, fontStyle: 'bold', textColor: [0, 128, 55], halign: 'center', fontSize: 6.5 },
        13: { cellWidth: 12, fontStyle: 'bold', halign: 'center', fontSize: 6.5 },
        14: { cellWidth: 6, textColor: [100, 116, 139], halign: 'center', fontSize: 6.5 },
      },
      didDrawPage: (data) => {
        if (data.pageNumber >= 5) {
          renderAtomPageDecoration(data.pageNumber.toString());
        }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 12) {
          const val = data.cell.raw;
          if (val === 'PASSED') {
            data.cell.styles.textColor = [0, 128, 55];
            data.cell.styles.fontStyle = 'bold';
          } else if (val === 'FAILED') {
            data.cell.styles.textColor = [225, 29, 72];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [148, 163, 184];
          }
        }
      },
      margin: { left: 8, right: 8, top: 32, bottom: 20 },
      styles: { cellPadding: 1.2, font: 'helvetica' },
    });
  }

  // =========================================================================
  // COMPARATIVE ANALYSIS SECTION (COMING LAST IF COMPARISON EXAM DATA IS PROVIDED)
  // =========================================================================
  if (options?.comparisonExamData) {
    const compData = options.comparisonExamData;
    const compExam = compData.exam;
    const compCandidates = compData.candidates || [];
    const compResults = compData.results || [];
    const compAttempts = compData.attempts || [];

    const compExamTotalMarks = compExam.questions?.reduce((sum, q) => sum + (safeNum(q.marks) || 1), 0) || 0;

    // Calculate Exam 2 metrics
    const compCandidateResults = compCandidates.map((c) => {
      const attempt = compAttempts.find((a) => a.candidateId === c.id);
      const result = compResults.find((r) => r.candidateId === c.id);
      const isAttempted = !!attempt && (attempt.isSubmitted || (attempt.answers && attempt.answers.length > 0));
      const percentage = safeNum(result?.percentage, 0);
      const isPass = percentage >= 50;

      let timeTakenMinutes = 0;
      if (attempt?.startedAt && attempt?.submittedAt) {
        const s = new Date(attempt.startedAt).getTime();
        const e = new Date(attempt.submittedAt).getTime();
        if (e > s) timeTakenMinutes = Math.max(1, Math.round((e - s) / 60000));
      }

      return { candidate: c, isAttempted, percentage, isPass, timeTakenMinutes, result, attempt };
    });

    const compAttempted = compCandidateResults.filter((cr) => cr.isAttempted);
    const compAttemptedCount = compAttempted.length;
    const compTotalRegistered = compCandidates.length;
    const compCompletionRate = compTotalRegistered > 0 ? ((compAttemptedCount / compTotalRegistered) * 100).toFixed(1) : '0';
    const compPassCount = compAttempted.filter((cr) => cr.isPass).length;
    const compPassRate = compAttemptedCount > 0 ? Math.round((compPassCount / compAttemptedCount) * 100) : 0;
    const compAvgPercentage = compAttemptedCount > 0
      ? (compAttempted.reduce((sum, cr) => sum + cr.percentage, 0) / compAttemptedCount).toFixed(1)
      : '0';
    const compHighestPercentage = compAttemptedCount > 0
      ? Math.max(...compAttempted.map((cr) => cr.percentage)).toFixed(0)
      : '0';
    const compLowestPercentage = compAttemptedCount > 0
      ? Math.min(...compAttempted.map((cr) => cr.percentage)).toFixed(0)
      : '0';
    const compAvgTime = compAttemptedCount > 0
      ? Math.round(compAttempted.reduce((sum, cr) => sum + cr.timeTakenMinutes, 0) / compAttemptedCount)
      : 0;

    // Match Common Candidates between Exam 1 and Exam 2 (by email or USN)
    const commonCandidates: any[] = [];
    candidateResults.forEach((cr1) => {
      const match = compCandidateResults.find(
        (cr2) =>
          (cr1.candidate.email && cr2.candidate.email && cr1.candidate.email.trim().toLowerCase() === cr2.candidate.email.trim().toLowerCase()) ||
          (cr1.candidate.usn && cr2.candidate.usn && cr1.candidate.usn.trim().toLowerCase() === cr2.candidate.usn.trim().toLowerCase())
      );
      if (match && cr1.isAttempted && match.isAttempted) {
        const delta = Math.round((cr1.percentage - match.percentage) * 10) / 10;
        commonCandidates.push({
          name: cr1.candidate.name,
          usn: cr1.candidate.usn || match.candidate.usn || '-',
          phone: cr1.candidate.phone || match.candidate.phone || '-',
          exam1Score: cr1.percentage,
          exam2Score: match.percentage,
          delta,
          trend: delta > 0 ? '▲ Improved' : delta < 0 ? '▼ Declined' : '▬ Steady',
        });
      }
    });

    // Add Comparative Page at the very end
    doc.addPage();
    const compPageNum = (doc.internal as any).getNumberOfPages().toString();
    renderAtomPageDecoration(compPageNum);
    currentY = 32;

    const compSectionTitle = includeResults ? '10. Comparative Analysis: Cross-Exam Performance' : '9. Comparative Analysis: Cross-Exam Performance';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(compSectionTitle, 14, currentY);
    currentY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Comparative benchmarking between ${exam.name} (${exam.code}) and ${compExam.name} (${compExam.code}):`, 14, currentY);
    currentY += 5;

    // Comparison KPI Table
    const diffCalc = (v1: number, v2: number, suffix: string = '%') => {
      const diff = Math.round((v1 - v2) * 10) / 10;
      return diff > 0 ? `+${diff}${suffix} ▲` : diff < 0 ? `${diff}${suffix} ▼` : `0${suffix} ▬`;
    };

    const compTableBody = [
      ['Total Candidates Registered', `${totalTargetCandidates}`, `${compTotalRegistered}`, `${totalTargetCandidates - compTotalRegistered}`],
      ['Candidates Appeared / Attempted', `${attemptedCount}`, `${compAttemptedCount}`, `${attemptedCount - compAttemptedCount}`],
      ['Completion Rate', `${completionRate}%`, `${compCompletionRate}%`, diffCalc(safeNum(completionRate), safeNum(compCompletionRate))],
      ['Average Score (%)', `${avgPercentage}%`, `${compAvgPercentage}%`, diffCalc(safeNum(avgPercentage), safeNum(compAvgPercentage))],
      ['Pass Rate (%)', `${passRate}%`, `${compPassRate}%`, diffCalc(safeNum(passRate), safeNum(compPassRate))],
      ['Highest Score (%)', `${highestPercentage}%`, `${compHighestPercentage}%`, diffCalc(safeNum(highestPercentage), safeNum(compHighestPercentage))],
      ['Lowest Score (%)', `${lowestPercentage}%`, `${compLowestPercentage}%`, diffCalc(safeNum(lowestPercentage), safeNum(compLowestPercentage))],
      ['Average Time Taken', `${avgTimeTakenMin} min`, `${compAvgTime} min`, `${avgTimeTakenMin - compAvgTime} min`],
      ['Total Questions & Max Marks', `${totalQuestions} Qs (${examTotalMarks} M)`, `${compExam.questions?.length || 0} Qs (${compExamTotalMarks} M)`, '-'],
    ];

    autoTable(doc, {
      startY: currentY,
      head: [['Metric / Parameter', `${exam.name} (${exam.code})`, `${compExam.name} (${compExam.code})`, 'Variance / Delta (Δ)']],
      body: compTableBody,
      theme: 'plain',
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      columnStyles: {
        0: { cellWidth: 55, fontStyle: 'bold', textColor: [30, 41, 59], fontSize: 7 },
        1: { cellWidth: 44, fontStyle: 'bold', textColor: [0, 128, 55], fontSize: 7 },
        2: { cellWidth: 44, fontStyle: 'bold', textColor: [37, 99, 235], fontSize: 7 },
        3: { cellWidth: 39, fontStyle: 'bold', textColor: [15, 23, 42], fontSize: 7 },
      },
      margin: { left: 14, right: 14 },
      styles: { cellPadding: 1.6, font: 'helvetica' },
    });

    currentY = (doc as any).lastAutoTable.finalY + 5;

    // Comparative 3D Chart
    const compChartImg = createAtomComparativeChart(
      `${exam.name} (${exam.code})`,
      `${compExam.name} (${compExam.code})`,
      [
        { label: 'Avg Score', val1: safeNum(avgPercentage), val2: safeNum(compAvgPercentage) },
        { label: 'Pass Rate', val1: safeNum(passRate), val2: safeNum(compPassRate) },
        { label: 'Completion', val1: safeNum(completionRate), val2: safeNum(compCompletionRate) },
        { label: 'Top Score', val1: safeNum(highestPercentage), val2: safeNum(compHighestPercentage) },
      ]
    );

    if (compChartImg) {
      const compChartH = 65;
      doc.addImage(compChartImg, 'PNG', 14, currentY, pageWidth - 28, compChartH);
      currentY += compChartH + 5;
    }

    // Common Candidates Progress Table (if common candidates exist)
    if (commonCandidates.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`Common Candidates Cross-Exam Tracking (${commonCandidates.length} Candidates in Both Exams)`, 14, currentY);
      currentY += 4;

      const commonRows = commonCandidates.slice(0, 6).map((cc, cIdx) => [
        `#${cIdx + 1}`,
        cc.name,
        cc.usn,
        cc.phone,
        `${cc.exam1Score}%`,
        `${cc.exam2Score}%`,
        `${cc.delta > 0 ? `+${cc.delta}%` : `${cc.delta}%`}`,
        cc.trend,
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['#', 'Student Name', 'USN', 'Contact', `${exam.code}`, `${compExam.code}`, 'Delta (Δ)', 'Trend']],
        body: commonRows,
        theme: 'plain',
        headStyles: {
          fillColor: [248, 250, 252],
          textColor: [15, 23, 42],
          fontStyle: 'bold',
          fontSize: 7,
        },
        columnStyles: {
          0: { cellWidth: 8, fontStyle: 'bold', textColor: [0, 128, 55], halign: 'center', fontSize: 6.5 },
          1: { cellWidth: 36, fontStyle: 'bold', textColor: [30, 41, 59], fontSize: 6.5 },
          2: { cellWidth: 24, textColor: [71, 85, 105], fontSize: 6.5 },
          3: { cellWidth: 26, textColor: [71, 85, 105], fontStyle: 'bold', fontSize: 6.5 },
          4: { cellWidth: 22, fontStyle: 'bold', textColor: [0, 128, 55], halign: 'center', fontSize: 6.5 },
          5: { cellWidth: 22, fontStyle: 'bold', textColor: [37, 99, 235], halign: 'center', fontSize: 6.5 },
          6: { cellWidth: 20, fontStyle: 'bold', halign: 'center', fontSize: 6.5 },
          7: { cellWidth: 24, fontStyle: 'bold', halign: 'center', fontSize: 6.5 },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && (data.column.index === 6 || data.column.index === 7)) {
            const raw = String(data.cell.raw);
            if (raw.includes('+') || raw.includes('Improved')) {
              data.cell.styles.textColor = [0, 128, 55];
            } else if (raw.includes('-') || raw.includes('Declined')) {
              data.cell.styles.textColor = [225, 29, 72];
            }
          }
        },
        margin: { left: 14, right: 14 },
        styles: { cellPadding: 1.4, font: 'helvetica' },
      });
    }
  }

  // Clean filename
  const cleanName = exam.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanName}_ATOM_Report_${includeResults ? 'With_Complete_Results' : 'Without_Results'}_${isFiltered ? 'Filtered' : 'Full'}.pdf`;

  doc.save(filename);
}

/**
 * EXPORT EXAM QUESTION PAPER AS PROFESSIONAL PDF
 * Preserves code snippets, programs, line breaks, indentation, and alignment.
 */
export async function exportQuestionPaperPdf(
  exam: Exam,
  options?: { showAnswers?: boolean }
): Promise<void> {
  const showAnswers = options?.showAnswers ?? true;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = 210;
  const pageHeight = 297;
  const leftMargin = 14;
  const rightMargin = 14;
  const topMargin = 22;
  const bottomMargin = 22;
  const contentWidth = pageWidth - leftMargin - rightMargin; // 182mm

  const logoDataUrl = await getLogoDataUrl();
  const examNegMarks = exam.settings?.negativeMarks ?? 0;
  const totalMarks = exam.questions.reduce((sum, q) => sum + (q.marks || 1), 0);

  let currentY = topMargin;

  // Helper to draw branded header and footer on every page
  const drawPageHeaderAndFooter = (isFirstPage: boolean) => {
    // Top right corner triangle accent
    doc.setFillColor(245, 158, 11);
    doc.triangle(pageWidth, 0, pageWidth - 26, 0, pageWidth, 20, 'F');
    doc.setFillColor(0, 128, 55);
    doc.triangle(pageWidth, 0, pageWidth - 12, 0, pageWidth, 9, 'F');

    // Logo / Brand on left
    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, 'PNG', leftMargin, 6, 32, 12);
      } catch (e) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(0, 128, 55);
        doc.text('ATOM QMS', leftMargin, 14);
      }
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(0, 128, 55);
      doc.text('ATOM QMS', leftMargin, 14);
    }

    // Top Header line on subsequent pages
    if (!isFirstPage) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`${exam.name} (${exam.code}) - Question Paper`, leftMargin + 36, 12);
      doc.setDrawColor(226, 232, 240);
      doc.line(leftMargin, 18, pageWidth - rightMargin, 18);
    }

    // Footer line & text
    doc.setDrawColor(226, 232, 240);
    doc.line(leftMargin, pageHeight - 14, pageWidth - rightMargin, pageHeight - 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('ATOM QMS | Confidential Exam Material | www.atomm.in', leftMargin, pageHeight - 9);
  };

  // Check available height and create new page if needed
  const ensureSpace = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - bottomMargin) {
      doc.addPage();
      drawPageHeaderAndFooter(false);
      currentY = topMargin + 2;
    }
  };

  // Draw Page 1 Header
  drawPageHeaderAndFooter(true);
  currentY = 24;

  // Title Banner
  doc.setFillColor(0, 128, 55);
  doc.roundedRect(leftMargin, currentY, contentWidth, 18, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('EXAM QUESTION PAPER', leftMargin + 6, currentY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(240, 253, 244);
  doc.text(
    `${exam.name}  |  Code: ${exam.code}  |  Duration: ${exam.settings?.duration || 60} Mins  |  Total Marks: ${totalMarks}`,
    leftMargin + 6,
    currentY + 13
  );

  currentY += 23;

  // Instructions Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(leftMargin, currentY, contentWidth, 14, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Instructions & Guidelines:', leftMargin + 4, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `• Total Questions: ${exam.questions.length} | Passing: 50% | Negative marking: ${examNegMarks > 0 ? `-${examNegMarks} per wrong answer` : 'None'}`,
    leftMargin + 4,
    currentY + 8.5
  );
  doc.text(
    `• For programming questions, code indentation, line breaks, and whitespace formatting are precisely aligned.`,
    leftMargin + 4,
    currentY + 11.5
  );

  currentY += 18;

  // Render each question
  exam.questions.forEach((q, idx) => {
    const qNum = idx + 1;
    const marks = q.marks || 1;
    const negMarks = q.negativeMarks ?? examNegMarks;
    const typeLabel = q.type === 'mcq' ? 'MCQ' : q.type === 'mcq-image' ? 'MCQ + Image' : q.type === 'true-false' ? 'True/False' : 'Reading Comprehension';

    // Parse question text into prose and code blocks
    const contentBlocks = parseQuestionContent(q.text || '');

    // Estimate height needed for this question header
    ensureSpace(32);

    // Question Header Strip
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(leftMargin, currentY, contentWidth, 7, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 128, 55);
    doc.text(`Question ${qNum}`, leftMargin + 3, currentY + 4.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const metaText = `Type: ${typeLabel}   |   Marks: +${marks}${negMarks > 0 ? `   |   Negative: -${negMarks}` : ''}${q.section ? `   |   Section: ${q.section}` : ''}`;
    doc.text(metaText, pageWidth - rightMargin - 3, currentY + 4.8, { align: 'right' });

    currentY += 10;

    // Reading Passage if RC
    if (q.type === 'reading-comprehension' && q.passage) {
      ensureSpace(20);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);

      const passageLines = doc.splitTextToSize(`Passage: ${q.passage}`, contentWidth - 8);
      const passageBoxHeight = Math.min(60, passageLines.length * 3.8 + 6);

      doc.roundedRect(leftMargin, currentY, contentWidth, passageBoxHeight, 1, 1, 'FD');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(passageLines.slice(0, 14), leftMargin + 4, currentY + 4.5);
      currentY += passageBoxHeight + 3;
    }

    // Question Image if available
    if (q.imageUrl) {
      try {
        ensureSpace(42);
        doc.addImage(q.imageUrl, 'PNG', leftMargin, currentY, 65, 36);
        currentY += 39;
      } catch (err) {
        console.warn('Could not add image to question paper PDF', err);
      }
    }

    // Render Question Content (Prose and Code Blocks)
    contentBlocks.forEach((block) => {
      if (block.type === 'code') {
        const rawLines = block.content.split('\n');
        // Expand tabs to 4 spaces to ensure consistent column alignment
        const codeLines = rawLines.map(l => l.replace(/\t/g, '    '));
        const codeLineHeight = 3.8;
        const codePadding = 3;
        const totalCodeHeight = codeLines.length * codeLineHeight + (codePadding * 2);

        // If the code snippet can fit on a single page, ensure the whole block starts together
        const maxSinglePageCodeHeight = pageHeight - bottomMargin - topMargin - 12;
        if (totalCodeHeight <= maxSinglePageCodeHeight) {
          ensureSpace(totalCodeHeight + 6);
        } else {
          ensureSpace(35);
        }

        // Background box for code snippet
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(leftMargin, currentY, contentWidth, totalCodeHeight, 1.5, 1.5, 'FD');

        // Left accent bar
        doc.setFillColor(0, 128, 55);
        doc.rect(leftMargin, currentY, 1.5, totalCodeHeight, 'F');

        // Language tag if available
        if (block.language && block.language.toLowerCase() !== 'code') {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(100, 116, 139);
          doc.text(block.language.toUpperCase(), pageWidth - rightMargin - 3, currentY + 4, { align: 'right' });
        }

        // Print code lines with monospace Courier font
        doc.setFont('courier', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);

        let codeY = currentY + codePadding + 3;
        codeLines.forEach((line) => {
          if (codeY > pageHeight - bottomMargin) {
            doc.addPage();
            drawPageHeaderAndFooter(false);
            codeY = topMargin + 4;
            currentY = topMargin;
          }
          // Courier font guarantees that indentation (spaces) renders with exact column alignment
          // Maximum printable characters before margin is ~92 chars
          const maxChars = 92;
          const displayLine = line.length > maxChars ? line.substring(0, maxChars - 3) + '...' : line;
          doc.text(displayLine, leftMargin + 4, codeY);
          codeY += codeLineHeight;
        });

        currentY += totalCodeHeight + 3;
      } else {
        // Prose text block
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);

        const lines = block.content.split('\n');
        lines.forEach((line) => {
          if (!line.trim()) {
            currentY += 2;
            return;
          }
          const wrapped = doc.splitTextToSize(line, contentWidth);
          ensureSpace(wrapped.length * 4.2);
          doc.text(wrapped, leftMargin, currentY);
          currentY += wrapped.length * 4.2;
        });
        currentY += 1.5;
      }
    });

    currentY += 1;

    // Options rendering
    const optLabels = ['A', 'B', 'C', 'D'];
    const activeOptions = (q.type === 'true-false' ? q.options.slice(0, 2) : q.options);

    activeOptions.forEach((optText, optIdx) => {
      const isCorrect = q.correctAnswer === optIdx;
      const label = optLabels[optIdx];
      const fallback = q.type === 'true-false' ? (optIdx === 0 ? 'True' : 'False') : `Option ${label}`;
      const displayText = optText.trim() || fallback;

      ensureSpace(7);

      // Option background if correct and showAnswers
      if (showAnswers && isCorrect) {
        doc.setFillColor(236, 253, 245);
        doc.setDrawColor(167, 243, 208);
        doc.roundedRect(leftMargin + 2, currentY - 3.5, contentWidth - 4, 6.5, 1, 1, 'FD');
      }

      // Option Circle Badge
      if (showAnswers && isCorrect) {
        doc.setFillColor(0, 128, 55);
        doc.circle(leftMargin + 5.5, currentY - 0.2, 2.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(255, 255, 255);
        doc.text(label, leftMargin + 5.5, currentY + 0.6, { align: 'center' });
      } else {
        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(203, 213, 225);
        doc.circle(leftMargin + 5.5, currentY - 0.2, 2.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text(label, leftMargin + 5.5, currentY + 0.6, { align: 'center' });
      }

      // Option Text
      doc.setFont('helvetica', showAnswers && isCorrect ? 'bold' : 'normal');
      doc.setFontSize(9);
      doc.setTextColor(showAnswers && isCorrect ? 0 : 30, showAnswers && isCorrect ? 128 : 41, showAnswers && isCorrect ? 55 : 59);

      const wrappedOpt = doc.splitTextToSize(displayText, contentWidth - 28);
      doc.text(wrappedOpt, leftMargin + 11, currentY);

      if (showAnswers && isCorrect) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(0, 128, 55);
        doc.text('[Correct Answer]', pageWidth - rightMargin - 4, currentY, { align: 'right' });
      }

      currentY += Math.max(6, wrappedOpt.length * 4);
    });

    currentY += 3;

    // Divider between questions
    doc.setDrawColor(241, 245, 249);
    doc.line(leftMargin, currentY, pageWidth - rightMargin, currentY);
    currentY += 4;
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
