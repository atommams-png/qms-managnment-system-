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
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(depth) ||
    height <= 0 ||
    width <= 0
  ) {
    return;
  }

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

function drawComparativeChartHeader(
  ctx: CanvasRenderingContext2D,
  width: number,
  title: string,
  exam1Label: string,
  exam2Label: string
) {
  // Top gradient accent bar
  const headerGrad = ctx.createLinearGradient(0, 0, width, 0);
  headerGrad.addColorStop(0, '#1e3a8a');
  headerGrad.addColorStop(0.5, '#0284c7');
  headerGrad.addColorStop(1, '#008037');
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, width, 10);

  // Outer border
  ctx.save();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, width - 20, ctx.canvas.height - 20);

  // Header Title
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 22px Century Gothic, Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, 35, 45);

  // Legend 1 (Pre / Baseline - Royal Blue)
  ctx.font = 'bold 15px Century Gothic, Inter, sans-serif';
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(width - 560, 28, 16, 16);
  const l1 = exam1Label.length > 22 ? exam1Label.substring(0, 20) + '...' : exam1Label;
  ctx.fillText(`Pre: ${l1}`, width - 535, 42);

  // Legend 2 (Post / Milestone - Emerald Green)
  ctx.fillStyle = '#008037';
  ctx.fillRect(width - 280, 28, 16, 16);
  const l2 = exam2Label.length > 22 ? exam2Label.substring(0, 20) + '...' : exam2Label;
  ctx.fillText(`Post: ${l2}`, width - 255, 42);
  ctx.restore();
}

function createPairedComparative3DChart(
  title: string,
  exam1Label: string,
  exam2Label: string,
  items: { label: string; val1: number; val2: number; badge?: string }[],
  unit: string = '%'
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1500;
  canvas.height = 640;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawComparativeChartHeader(ctx, canvas.width, title, exam1Label, exam2Label);

  const floorY = 530;
  const chartStartX = 80;
  const chartWidth = canvas.width - 160;
  const maxHeight = 340;
  const depth = 18;
  const numItems = Math.max(1, items.length);
  const barW = Math.min(55, Math.max(26, (chartWidth / numItems - 40) / 2));
  const groupSpacing = (chartWidth - (barW * 2 + 12) * numItems) / (numItems + 1);

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
    ctx.font = '14px Century Gothic, Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${g * 25}${unit}`, chartStartX - 25, gy + 5);
  }

  // Floor line
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(chartStartX - 30, floorY);
  ctx.lineTo(chartStartX + chartWidth + 30, floorY);
  ctx.stroke();

  items.forEach((item, i) => {
    const groupX = chartStartX + groupSpacing + i * (barW * 2 + 12 + groupSpacing);
    const v1 = Math.round(safeNum(item.val1, 0));
    const v2 = Math.round(safeNum(item.val2, 0));

    // Bar 1 (Pre - Royal Blue)
    const h1 = Math.max(8, (Math.min(100, Math.max(0, v1)) / 100) * maxHeight);
    const b1x = groupX;
    const b1y = floorY - h1;
    draw3DBarOnCanvas(ctx, b1x, b1y, barW, h1, depth, '#2563eb');

    // Bar 2 (Post - Emerald Green)
    const h2 = Math.max(8, (Math.min(100, Math.max(0, v2)) / 100) * maxHeight);
    const b2x = groupX + barW + 12;
    const b2y = floorY - h2;
    draw3DBarOnCanvas(ctx, b2x, b2y, barW, h2, depth, '#008037');

    // Values on top
    ctx.fillStyle = '#2563eb';
    ctx.font = 'bold 15px Century Gothic, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${v1}${unit}`, b1x + barW / 2 + depth / 2, b1y - depth - 6);

    ctx.fillStyle = '#008037';
    ctx.fillText(`${v2}${unit}`, b2x + barW / 2 + depth / 2, b2y - depth - 6);

    // Delta badge if present
    if (item.badge) {
      const isPos = !item.badge.startsWith('-');
      ctx.fillStyle = isPos ? '#166534' : '#991b1b';
      ctx.font = 'bold 13px Century Gothic, Inter, sans-serif';
      ctx.fillText(item.badge, groupX + barW + 6 + depth / 2, Math.min(b1y, b2y) - depth - 22);
    }

    // Label below floor
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 14px Century Gothic, Inter, sans-serif';
    const cleanLabel = item.label.length > 20 ? item.label.substring(0, 18) + '...' : item.label;
    ctx.fillText(cleanLabel, groupX + barW + 6, floorY + 34);
  });
  ctx.restore();

  return canvas.toDataURL('image/png');
}

function createImprovementDonutChart(
  improvedCount: number,
  unchangedCount: number,
  declinedCount: number,
  total: number
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  canvas.height = 640;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Outer border
  ctx.save();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  // Header Title
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 22px Century Gothic, Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Student Improvement Distribution (Cohort Trajectory)', 35, 45);
  ctx.restore();

  const safeTotal = Math.max(1, total);
  const impPct = Math.round((improvedCount / safeTotal) * 100);
  const uncPct = Math.round((unchangedCount / safeTotal) * 100);
  const decPct = Math.round((declinedCount / safeTotal) * 100);

  draw3DDonutOnCanvas(
    ctx,
    canvas.width / 2,
    340,
    170,
    32,
    85,
    [
      { label: 'Improved', value: Math.max(0, improvedCount), color: '#008037', count: improvedCount, percentStr: `${impPct}%` },
      { label: 'Unchanged', value: Math.max(0, unchangedCount), color: '#3b82f6', count: unchangedCount, percentStr: `${uncPct}%` },
      { label: 'Declined', value: Math.max(0, declinedCount), color: '#ef4444', count: declinedCount, percentStr: `${decPct}%` },
    ]
  );

  return canvas.toDataURL('image/png');
}

function createAtomComparativeChart(
  exam1Label: string,
  exam2Label: string,
  metrics: { label: string; val1: number; val2: number }[]
): string {
  return createPairedComparative3DChart(
    'Average Score Comparison – Pre vs Post Assessment',
    exam1Label,
    exam2Label,
    metrics
  );
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



// =========================================================================
// SECTION 5 SCORECARD DRAWING HELPERS
// =========================================================================
function drawTrophyIcon(doc: any, cx: number, cy: number, s: number = 3.2) {
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(cx - s * 0.7, cy - s * 0.65, s * 1.4, s * 0.22, s * 0.08, s * 0.08, 'F');
  doc.triangle(cx - s * 0.65, cy - s * 0.45, cx + s * 0.65, cy - s * 0.45, cx, cy + s * 0.2, 'F');
  doc.rect(cx - s * 0.12, cy + s * 0.15, s * 0.24, s * 0.35, 'F');
  doc.roundedRect(cx - s * 0.55, cy + s * 0.45, s * 1.1, s * 0.25, s * 0.08, s * 0.08, 'F');
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.35);
  doc.line(cx - s * 0.6, cy - s * 0.4, cx - s * 0.9, cy - s * 0.25);
  doc.line(cx - s * 0.9, cy - s * 0.25, cx - s * 0.75, cy);
  doc.line(cx - s * 0.75, cy, cx - s * 0.35, cy + s * 0.1);
  doc.line(cx + s * 0.6, cy - s * 0.4, cx + s * 0.9, cy - s * 0.25);
  doc.line(cx + s * 0.9, cy - s * 0.25, cx + s * 0.75, cy);
  doc.line(cx + s * 0.75, cy, cx + s * 0.35, cy + s * 0.1);
}

function drawRankMedal(doc: any, cx: number, cy: number, rankNum: number | null) {
  if (rankNum === null) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('-', cx, cy + 0.8, { align: 'center' });
    return;
  }

  if (rankNum === 1) {
    doc.setFillColor(245, 158, 11);
    doc.triangle(cx - 1.2, cy + 2.0, cx - 3.2, cy + 5.5, cx - 1.6, cy + 4.6, 'F');
    doc.triangle(cx - 1.2, cy + 2.0, cx - 1.6, cy + 4.6, cx - 0.4, cy + 2.5, 'F');
    doc.triangle(cx + 0.4, cy + 2.5, cx + 1.6, cy + 4.6, cx + 1.2, cy + 2.0, 'F');
    doc.triangle(cx + 1.2, cy + 2.0, cx + 1.6, cy + 4.6, cx + 3.2, cy + 5.5, 'F');
    doc.setFillColor(251, 191, 36);
    doc.circle(cx, cy, 3.4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('1', cx, cy + 0.9, { align: 'center' });
  } else if (rankNum === 2) {
    doc.setFillColor(148, 163, 184);
    doc.triangle(cx - 1.2, cy + 2.0, cx - 3.2, cy + 5.5, cx - 1.6, cy + 4.6, 'F');
    doc.triangle(cx - 1.2, cy + 2.0, cx - 1.6, cy + 4.6, cx - 0.4, cy + 2.5, 'F');
    doc.triangle(cx + 0.4, cy + 2.5, cx + 1.6, cy + 4.6, cx + 1.2, cy + 2.0, 'F');
    doc.triangle(cx + 1.2, cy + 2.0, cx + 1.6, cy + 4.6, cx + 3.2, cy + 5.5, 'F');
    doc.setFillColor(203, 213, 225);
    doc.circle(cx, cy, 3.4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('2', cx, cy + 0.9, { align: 'center' });
  } else if (rankNum === 3) {
    doc.setFillColor(194, 65, 12);
    doc.triangle(cx - 1.2, cy + 2.0, cx - 3.2, cy + 5.5, cx - 1.6, cy + 4.6, 'F');
    doc.triangle(cx - 1.2, cy + 2.0, cx - 1.6, cy + 4.6, cx - 0.4, cy + 2.5, 'F');
    doc.triangle(cx + 0.4, cy + 2.5, cx + 1.6, cy + 4.6, cx + 1.2, cy + 2.0, 'F');
    doc.triangle(cx + 1.2, cy + 2.0, cx + 1.6, cy + 4.6, cx + 3.2, cy + 5.5, 'F');
    doc.setFillColor(234, 88, 12);
    doc.circle(cx, cy, 3.4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('3', cx, cy + 0.9, { align: 'center' });
  } else {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.35);
    doc.circle(cx, cy, 3.4, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(String(rankNum), cx, cy + 0.9, { align: 'center' });
  }
}

function drawScoreBar(
  doc: any,
  cellX: number,
  cellY: number,
  cellW: number,
  cellH: number,
  scoreText: string,
  obtainedMarks: number,
  totalMarks: number
) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(scoreText, cellX + cellW / 2, cellY + cellH / 2 - 1.8, { align: 'center' });

  const barW = Math.min(cellW - 3, 14);
  const barH = 2.4;
  const barX = cellX + (cellW - barW) / 2;
  const barY = cellY + cellH / 2 + 1.0;
  const r = 1.2;

  doc.setFillColor(226, 232, 240);
  doc.roundedRect(barX, barY, barW, barH, r, r, 'F');

  const pct = totalMarks > 0 ? Math.min(1, Math.max(0, obtainedMarks / totalMarks)) : 0;
  if (pct > 0) {
    const fillW = Math.max(r * 2, barW * pct);
    if (pct >= 0.4) {
      doc.setFillColor(22, 163, 74);
    } else {
      doc.setFillColor(239, 68, 68);
    }
    doc.roundedRect(barX, barY, fillW, barH, r, r, 'F');
  }
}

function drawAccuracyDonut(doc: any, cx: number, cy: number, pct: number) {
  const r = 4.2;
  const strokeW = 1.1;

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(strokeW);
  doc.circle(cx, cy, r, 'S');

  if (pct > 0) {
    let arcColor = [22, 163, 74];
    if (pct < 50) {
      arcColor = [239, 68, 68];
    } else if (pct < 75) {
      arcColor = [245, 158, 11];
    }
    doc.setDrawColor(arcColor[0], arcColor[1], arcColor[2]);
    doc.setLineWidth(strokeW);
    doc.setLineCap('round');

    const startAngle = -Math.PI / 2;
    const sweep = (Math.min(100, Math.max(0, pct)) / 100) * 2 * Math.PI;
    const endAngle = startAngle + sweep;
    const steps = Math.max(6, Math.round((sweep / (2 * Math.PI)) * 36));

    for (let i = 0; i < steps; i++) {
      const a1 = startAngle + (i / steps) * (endAngle - startAngle);
      const a2 = startAngle + ((i + 1) / steps) * (endAngle - startAngle);
      doc.line(
        cx + r * Math.cos(a1), cy + r * Math.sin(a1),
        cx + r * Math.cos(a2), cy + r * Math.sin(a2)
      );
    }
  }

  doc.setFont('helvetica', 'bold');
  const txt = String(Number.isInteger(pct) ? pct : pct.toFixed(1)) + '%';
  doc.setFontSize(txt.length > 4 ? 5.2 : 6.2);
  doc.setTextColor(15, 23, 42);
  doc.text(txt, cx, cy + 0.8, { align: 'center' });
}

function drawSectionCard(
  doc: any,
  cellX: number,
  cellY: number,
  cellW: number,
  cellH: number,
  text: string,
  type: 'strong' | 'avg' | 'weak'
) {
  if (!text || text === '-') {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('-', cellX + cellW / 2, cellY + cellH / 2 + 1, { align: 'center' });
    return;
  }

  const cardX = cellX + 1.0;
  const cardY = cellY + 1.2;
  const cardW = cellW - 2.0;
  const cardH = cellH - 2.4;

  if (type === 'strong') {
    doc.setFillColor(220, 252, 231);
    doc.setTextColor(21, 128, 61);
  } else if (type === 'avg') {
    doc.setFillColor(254, 249, 195);
    doc.setTextColor(133, 77, 14);
  } else {
    doc.setFillColor(254, 226, 226);
    doc.setTextColor(153, 27, 27);
  }

  doc.roundedRect(cardX, cardY, cardW, cardH, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);

  let lines: string[] = doc.splitTextToSize(text, cardW - 1.5);
  const lineH = 2.4;
  const maxLines = Math.max(1, Math.floor((cardH - 1.5) / lineH));
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    if (lines[maxLines - 1]) {
      lines[maxLines - 1] = lines[maxLines - 1].replace(/[….]+$/, '') + '…';
    }
  }

  const totalH = lines.length * lineH;
  let startY = cardY + (cardH - totalH) / 2 + 1.8;
  if (startY < cardY + 2.0) startY = cardY + 2.0;

  for (const l of lines) {
    doc.text(l, cardX + cardW / 2, startY, { align: 'center' });
    startY += lineH;
  }
}

function drawResultPill(
  doc: any,
  cellX: number,
  cellY: number,
  cellW: number,
  cellH: number,
  status: string
) {
  const pillW = Math.min(cellW - 2, 13);
  const pillH = 6;
  const pillX = cellX + (cellW - pillW) / 2;
  const pillY = cellY + (cellH - pillH) / 2;
  const r = pillH / 2;

  if (status === 'PASSED') {
    doc.setFillColor(220, 252, 231);
    doc.roundedRect(pillX, pillY, pillW, pillH, r, r, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(21, 128, 61);
    doc.text('PASSED', cellX + cellW / 2, cellY + cellH / 2 + 0.9, { align: 'center' });
  } else if (status === 'FAILED') {
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(pillX, pillY, pillW, pillH, r, r, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(185, 28, 28);
    doc.text('FAILED', cellX + cellW / 2, cellY + cellH / 2 + 0.9, { align: 'center' });
  } else {
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(pillX, pillY, pillW, pillH, r, r, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('ABSENT', cellX + cellW / 2, cellY + cellH / 2 + 0.9, { align: 'center' });
  }
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
    doc.text('ASSESSMENT PERFORMANCE REPORT', pageWidth - 14, 12, { align: 'right' });
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
  // SECTION 1: ASSESSMENT PARAMETERS & POLICY
  // =========================================================================
  autoTable(doc, {
    startY: currentY,
    head: [['Assessment Parameters', 'Assessment Summary']],
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
    head: [['Performance Indicator', 'Result Summary', 'Percentage']],
    body: [
      ['Total Registered Candidates', `${totalTargetCandidates} Candidates`, '100% Target Population'],
      ['Exam Submissions / Attempted', `${attemptedCount} Candidates`, `${turnoutRate.toFixed(1)}% Turnout Rate`],
      ['Unattempted / Absent', `${notAttemptedCount} Candidates`, `${totalTargetCandidates > 0 ? ((notAttemptedCount / totalTargetCandidates) * 100).toFixed(1) : 0}% Absentee Rate`],
      ['Qualified / Passed (>= 50%)', `${passCount} Candidates`, `${passRate}% of Attempted`],
      ['Did Not Qualify / Failed (< 50%)', `${failCount} Candidates`, `${failRate}% of Attempted`],
      ['Class Average Score', `${avgScore} / ${examTotalMarks} Marks`, `${avgPercentage}% Average Accuracy`],
      ['Highest Score Achieved', `${formatMarks(highestScore)} / ${examTotalMarks} Marks`, `${examTotalMarks > 0 ? formatPct((highestScore / examTotalMarks) * 100) : '0%'} Score`],
      ['Lowest Score Achieved', `${formatMarks(lowestScore)} / ${examTotalMarks} Marks`, `${examTotalMarks > 0 ? formatPct((lowestScore / examTotalMarks) * 100) : '0%'} Score`],
      ['Violations (Limit Exceeded)', `${flaggedCount} Candidates`, flaggedCount > 0 ? 'Review flagged attempts' : 'Zero severe violations'],
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
  doc.text('SCORE DISTRIBUTION & GRADE ANALYSIS', 14, currentY);
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
    head: [['Percentage Bracket', 'Grade Category', 'Candidate Count', 'Percentage Share']],
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
  doc.text('SECTION-WISE PERFORMANCE ANALYSIS', 14, currentY);
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
    if (currentY + 40 > pageHeight - 18) {
      doc.addPage();
      currentY = 20;
    }

    // Top Green Banner matching reference design
    const bannerH = 9.5;
    doc.setFillColor(0, 128, 55);
    doc.roundedRect(10, currentY, 190, bannerH, 2.5, 2.5, 'F');

    // Trophy Icon on left of banner
    drawTrophyIcon(doc, 16.5, currentY + 4.75, 3.2);

    // Banner Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('CANDIDATE MERIT RANK LIST & DETAILED SCORECARD', 23, currentY + 6.3);

    currentY += bannerH + 3.5;

    const distinctQuestionSections = Array.from(
      new Set(
        exam.questions
          .map((q) => (q.section && String(q.section).trim()) || '')
          .filter((s) => s.length > 0 && s.toLowerCase() !== 'general')
      )
    );
    const hasQuestionSections = distinctQuestionSections.length > 0;
    const resultColIdx = hasQuestionSections ? 9 : 6;

    // Build candidate row data and metadata
    const candidateMetaList: any[] = [];
    const candidateRankRows = candidateResults.map((cr, idx) => {
      const rankNum = cr.isAttempted ? idx + 1 : null;
      const resultStatus = !cr.isAttempted ? 'ABSENT' : cr.isPass ? 'PASSED' : 'FAILED';
      const dept = cr.candidate.department || 'General';
      const sec = cr.candidate.section ? `(${cr.candidate.section})` : '';
      const deptDisplay = sec ? `${dept}\n${sec}` : dept;

      const scoreDisplay = cr.isAttempted
        ? `${formatMarks(cr.obtainedMarks)} / ${examTotalMarks}`
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
          secScores.sort((a, b) => b.accuracy - a.accuracy || b.obtained - a.obtained);

          const maxAcc = secScores[0].accuracy;
          const minAcc = secScores[secScores.length - 1].accuracy;

                    const cleanSecName = (rawName: string) => {
            let n = rawName.trim();
            const lower = n.toLowerCase();
            if (lower === 'mathematics') return 'Math';
            if (lower === 'quantitative aptitude') return 'Quant';
            if (lower === 'logical reasoning') return 'Logical';
            if (lower === 'reading comprehension') return 'Reading';
            if (lower === 'general knowledge') return 'GK';
            if (n.includes(' - ')) {
              const parts = n.split(' - ');
              const lang = parts[0].trim();
              const topic = parts[1].trim();
              const shortTopic = topic.length > 10 ? topic.substring(0, 9).trim() + '…' : topic;
              return `${lang}: ${shortTopic}`;
            }
            if (n.length > 14) {
              return n.substring(0, 13).trim() + '…';
            }
            return n;
          };

          const formatSecList = (items: { name: string; accuracy: number }[]) => {
            if (items.length === 0) return '-';
            const acc = items[0].accuracy;
            if (items.length >= distinctQuestionSections.length && distinctQuestionSections.length >= 3) {
              return `All (${acc}%)`;
            }
            if (items.length > 2) {
              const firstTwo = items.slice(0, 2).map((s) => cleanSecName(s.name));
              const remaining = items.length - 2;
              return `${firstTwo.join(', ')}\n+${remaining} more (${acc}%)`;
            }
            const names = items.map((s) => cleanSecName(s.name));
            return `${names.join(', ')}\n(${acc}%)`;
          };

          if (maxAcc > 0) {
            const topSections = secScores.filter((s) => s.accuracy === maxAcc);
            strongSection = formatSecList(topSections);
          }

          if (minAcc < maxAcc) {
            const bottomSections = secScores.filter((s) => s.accuracy === minAcc);
            weakSection = formatSecList(bottomSections);
          } else if (maxAcc === 0) {
            weakSection = formatSecList(secScores);
          }

          if (secScores.length >= 3 && minAcc < maxAcc) {
            const midSections = secScores.filter((s) => s.accuracy < maxAcc && s.accuracy > minAcc && s.accuracy > 0);
            if (midSections.length > 0) {
              avgSection = formatSecList(midSections);
            }
          }
        }
      }

      candidateMetaList.push({
        rankNum,
        isAttempted: cr.isAttempted,
        obtainedMarks: cr.obtainedMarks,
        totalMarks: examTotalMarks,
        scoreDisplay,
        percentage: cr.percentage,
        resultStatus,
        strongSection,
        avgSection,
        weakSection,
      });

      if (hasQuestionSections) {
        return [
          '',
          cr.candidate.name || 'Candidate',
          cr.candidate.usn || '-',
          deptDisplay,
          '',
          '',
          strongSection,
          avgSection,
          weakSection,
          '',
        ];
      } else {
        return [
          '',
          cr.candidate.name || 'Candidate',
          cr.candidate.usn || '-',
          deptDisplay,
          '',
          '',
          '',
        ];
      }
    });

    const tableHeaders = [
      'Rank', 'Candidate Name', 'USN', 'Department', `Score\n( / ${examTotalMarks} )`, 'Percentage'
    ];
    if (hasQuestionSections) {
      tableHeaders.push('Strong Sections', 'Average Sections', 'Weak Sections');
    }
    tableHeaders.push('Result');

    const colStyles = hasQuestionSections
      ? {
          0: { cellWidth: 13, halign: 'center' },
          1: { cellWidth: 22, fontStyle: 'bold', textColor: [15, 23, 42], fontSize: 8 },
          2: { cellWidth: 17, halign: 'center', textColor: [51, 65, 85], fontSize: 7.5 },
          3: { cellWidth: 16, halign: 'center', textColor: [51, 65, 85], fontSize: 7 },
          4: { cellWidth: 18, halign: 'center' },
          5: { cellWidth: 18, halign: 'center' },
          6: { cellWidth: 25, halign: 'center' },
          7: { cellWidth: 23, halign: 'center' },
          8: { cellWidth: 23, halign: 'center' },
          9: { cellWidth: 15, halign: 'center' },
        }
      : {
          0: { cellWidth: 16, halign: 'center' },
          1: { cellWidth: 40, fontStyle: 'bold', textColor: [15, 23, 42], fontSize: 8.5 },
          2: { cellWidth: 28, halign: 'center', textColor: [51, 65, 85], fontSize: 8 },
          3: { cellWidth: 28, halign: 'center', textColor: [51, 65, 85], fontSize: 7.5 },
          4: { cellWidth: 28, halign: 'center' },
          5: { cellWidth: 26, halign: 'center' },
          6: { cellWidth: 24, halign: 'center' },
        };

    autoTable(doc, {
      startY: currentY,
      head: [tableHeaders],
      body: candidateRankRows,
      theme: 'plain',
      headStyles: {
        fillColor: [0, 128, 55],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: hasQuestionSections ? 7 : 8,
        halign: 'center',
        valign: 'middle',
        cellPadding: 2.2,
      },
      bodyStyles: {
        minCellHeight: 15,
        valign: 'middle',
      },
      columnStyles: colStyles as any,
      didParseCell: (data) => {
        if (data.section === 'body') {
          const col = data.column.index;
          const isCustom = col === 0 || col === 4 || col === 5 ||
            (hasQuestionSections ? (col === 6 || col === 7 || col === 8 || col === 9) : (col === 6));
          if (isCustom) {
            data.cell.text = [];
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section === 'body') {
          const col = data.column.index;
          const rowIdx = data.row.index;
          const meta = candidateMetaList[rowIdx];
          if (!meta) return;

          // Subtle horizontal divider between rows
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.3);
          doc.line(
            data.cell.x,
            data.cell.y + data.cell.height,
            data.cell.x + data.cell.width,
            data.cell.y + data.cell.height
          );

          const cellX = data.cell.x;
          const cellY = data.cell.y;
          const cellW = data.cell.width;
          const cellH = data.cell.height;
          const cx = cellX + cellW / 2;
          const cy = cellY + cellH / 2;

          if (col === 0) {
            // Rank medal / badge
            drawRankMedal(doc, cx, cy, meta.rankNum);
          } else if (col === 4) {
            // Score with horizontal progress bar
            if (meta.isAttempted) {
              drawScoreBar(doc, cellX, cellY, cellW, cellH, meta.scoreDisplay, meta.obtainedMarks, meta.totalMarks);
            } else {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8);
              doc.setTextColor(148, 163, 184);
              doc.text('-', cx, cy + 0.8, { align: 'center' });
            }
          } else if (col === 5) {
            // Accuracy donut gauge
            if (meta.isAttempted) {
              drawAccuracyDonut(doc, cx, cy, meta.percentage);
            } else {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8);
              doc.setTextColor(148, 163, 184);
              doc.text('-', cx, cy + 0.8, { align: 'center' });
            }
          } else if (hasQuestionSections && col === 6) {
            // Strong Sections Card
            drawSectionCard(doc, cellX, cellY, cellW, cellH, meta.strongSection, 'strong');
          } else if (hasQuestionSections && col === 7) {
            // Average Sections Card
            drawSectionCard(doc, cellX, cellY, cellW, cellH, meta.avgSection, 'avg');
          } else if (hasQuestionSections && col === 8) {
            // Weak Sections Card
            drawSectionCard(doc, cellX, cellY, cellW, cellH, meta.weakSection, 'weak');
          } else if (col === resultColIdx) {
            // Result Pill
            drawResultPill(doc, cellX, cellY, cellW, cellH, meta.resultStatus);
          }
        }
      },
      margin: { left: 10, right: 10 },
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
  doc.text('DETAILED QUESTION WISE ANALYSIS', 14, currentY);
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
  doc.text('ASSESSMENT VISUAL ANALYTICS & CHARTS ', 18, currentY + 6.2);
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
  // OPTIONAL: INSTITUTIONAL COMPARATIVE BENCHMARK & LEARNING GAIN ANALYSIS
  // =========================================================================
  if (options?.comparisonExamData) {
    const compData = options.comparisonExamData;
    const preExam = compData.exam;
    const postExam = exam;
    const preExamName = preExam.name || 'Baseline Assessment';
    const preExamCode = preExam.code || 'PRE';
    const postExamName = postExam.name || 'Current Assessment';
    const postExamCode = postExam.code || 'POST';

    const otherCandidates = compData.candidates || [];
    const otherResults = compData.results || [];
    const otherAttempts = compData.attempts || [];
    const otherTotalAttempts = otherAttempts.filter((a) => a.isSubmitted || (a.answers && a.answers.length > 0)).length;
    const otherPassCount = otherResults.filter((r) => safeNum(r.percentage) >= 50).length;
    const otherPassRate = otherTotalAttempts > 0 ? Math.round((otherPassCount / otherTotalAttempts) * 100) : 0;
    const otherAvgScore = otherResults.length > 0
      ? Math.round(otherResults.reduce((s, r) => s + safeNum(r.percentage), 0) / otherResults.length)
      : 0;
    const otherIntegrityRate = otherTotalAttempts > 0
      ? Math.round((otherAttempts.filter((a) => safeNum(a.tabSwitches, 0) === 0).length / otherTotalAttempts) * 100)
      : 0;
    const myIntegrityRate = attemptedCount > 0
      ? Math.round((attemptedCandidates.filter((c) => safeNum(c.tabSwitches, 0) === 0).length / attemptedCount) * 100)
      : 0;

    const myTurnout = Math.round(safeNum(turnoutRate));
    const otherTurnout = otherCandidates.length > 0 ? Math.round((otherTotalAttempts / otherCandidates.length) * 100) : 0;
    const preTurnout = otherTurnout;
    const postTurnout = myTurnout;
    const myPassRate = Math.round(safeNum(passRate));
    const myAvgScore = Math.round(safeNum(avgPercentage));

    // Pre & Post Registered & Attempted
    const preRegistered = otherCandidates.length;
    const postRegistered = totalTargetCandidates;
    const preAppeared = otherTotalAttempts;
    const postAppeared = attemptedCount;
    const preFailCount = Math.max(0, preAppeared - otherPassCount);
    const postFailCount = failCount;

    // Pre & Post Scores & Stats
    const prePcts = otherResults.map((r) => safeNum(r.percentage, 0)).sort((a, b) => b - a);
    const postPcts = attemptedCandidates.map((cr) => safeNum(cr.percentage, 0)).sort((a, b) => b - a);

    const preHighestScore = prePcts.length > 0 ? Math.round(prePcts[0]) : 0;
    const postHighestScore = postPcts.length > 0 ? Math.round(postPcts[0]) : 0;
    const preLowestScore = prePcts.length > 0 ? Math.round(prePcts[prePcts.length - 1]) : 0;
    const postLowestScore = postPcts.length > 0 ? Math.round(postPcts[postPcts.length - 1]) : 0;

    const preQCount = Math.max(1, Math.ceil(prePcts.length * 0.25));
    const postQCount = Math.max(1, Math.ceil(postPcts.length * 0.25));
    const preTop25 = prePcts.length > 0 ? Math.round(prePcts.slice(0, preQCount).reduce((a, b) => a + b, 0) / preQCount) : 0;
    const postTop25 = postPcts.length > 0 ? Math.round(postPcts.slice(0, postQCount).reduce((a, b) => a + b, 0) / postQCount) : 0;
    const preLow25 = prePcts.length > 0 ? Math.round(prePcts.slice(-preQCount).reduce((a, b) => a + b, 0) / preQCount) : 0;
    const postLow25 = postPcts.length > 0 ? Math.round(postPcts.slice(-postQCount).reduce((a, b) => a + b, 0) / postQCount) : 0;

    const preMedian = prePcts.length > 0 ? Math.round(prePcts[Math.floor(prePcts.length / 2)]) : 0;
    const postMedian = postPcts.length > 0 ? Math.round(postPcts[Math.floor(postPcts.length / 2)]) : 0;

    const preStdDev = prePcts.length > 1
      ? Math.round(Math.sqrt(prePcts.reduce((sq, n) => sq + Math.pow(n - otherAvgScore, 2), 0) / (prePcts.length - 1)) * 10) / 10
      : 0;
    const postStdDev = postPcts.length > 1
      ? Math.round(Math.sqrt(postPcts.reduce((sq, n) => sq + Math.pow(n - myAvgScore, 2), 0) / (postPcts.length - 1)) * 10) / 10
      : 0;

    const preAvgMarks = otherResults.length > 0
      ? (otherResults.reduce((s, r) => s + safeNum(r.obtainedMarks, 0), 0) / otherResults.length).toFixed(2)
      : '0.00';
    const postAvgMarks = avgScore;

    // Matched Candidate Mapping (Student-wise learning gain tracking)
    const preCandidateResults = otherCandidates.map((c) => {
      const att = otherAttempts.find((a) => a.candidateId === c.id);
      const res = otherResults.find((r) => r.candidateId === c.id);
      const isAtt = !!att && (att.isSubmitted || (att.answers && att.answers.length > 0));
      return {
        candidate: c,
        attempt: att,
        result: res,
        isAttempted: isAtt,
        percentage: safeNum(res?.percentage, 0),
        obtainedMarks: safeNum(res?.obtainedMarks, 0),
      };
    });

    const matchedStudents: {
      candidate: Candidate;
      preScore: number;
      postScore: number;
      delta: number;
      learningGain: number;
      category: string;
    }[] = [];

    candidateResults.forEach((cr) => {
      if (!cr.isAttempted) return;
      const c = cr.candidate;
      const email = (c.email || '').trim().toLowerCase();
      const usn = (c.usn || '').trim().toUpperCase();
      const phone = (c.phone || '').trim();
      const name = (c.name || '').trim().toLowerCase();

      const match = preCandidateResults.find((p) => {
        if (!p.isAttempted) return false;
        const pe = (p.candidate.email || '').trim().toLowerCase();
        const pu = (p.candidate.usn || '').trim().toUpperCase();
        const pp = (p.candidate.phone || '').trim();
        const pn = (p.candidate.name || '').trim().toLowerCase();
        return (email && pe && email === pe) ||
               (usn && pu && usn === pu) ||
               (phone && pp && phone === pp) ||
               (name && pn && name === pn);
      });

      if (match) {
        const preS = Math.round(safeNum(match.percentage));
        const postS = Math.round(safeNum(cr.percentage));
        const d = postS - preS;
        let lg = 0;
        if (postS > preS) {
          lg = preS < 100 ? Math.round(((postS - preS) / (100 - preS)) * 100) : 100;
        } else if (postS < preS) {
          lg = preS > 0 ? Math.round(((postS - preS) / preS) * 100) : -100;
        }
        let cat = 'Consistent / Steady';
        if (d >= 20) cat = 'High Improvement';
        else if (d >= 5) cat = 'Moderate Improvement';
        else if (d <= -5) cat = 'Significant Decline';

        matchedStudents.push({
          candidate: c,
          preScore: preS,
          postScore: postS,
          delta: d,
          learningGain: lg,
          category: cat,
        });
      }
    });

    // Fallback pairing if emails/names didn't match directly
    if (matchedStudents.length === 0) {
      const preAttList = preCandidateResults.filter((p) => p.isAttempted);
      const postAttList = candidateResults.filter((p) => p.isAttempted);
      const minLen = Math.min(preAttList.length, postAttList.length);
      for (let i = 0; i < minLen; i++) {
        const p1 = preAttList[i];
        const p2 = postAttList[i];
        const preS = Math.round(safeNum(p1.percentage));
        const postS = Math.round(safeNum(p2.percentage));
        const d = postS - preS;
        let cat = 'Consistent / Steady';
        if (d >= 20) cat = 'High Improvement';
        else if (d >= 5) cat = 'Moderate Improvement';
        else if (d <= -5) cat = 'Significant Decline';

        matchedStudents.push({
          candidate: p2.candidate,
          preScore: preS,
          postScore: postS,
          delta: d,
          learningGain: d,
          category: cat,
        });
      }
    }

    const totalMatched = Math.max(1, matchedStudents.length);
    const improvedList = matchedStudents.filter((s) => s.delta > 0);
    const unchangedList = matchedStudents.filter((s) => s.delta === 0);
    const declinedList = matchedStudents.filter((s) => s.delta < 0);

    const improvedCount = improvedList.length;
    const unchangedCount = unchangedList.length;
    const declinedCount = declinedList.length;
    const improvedRatio = Math.round((improvedCount / totalMatched) * 100);

    // Hake's normalized gain
    let hakeGain = '0.00';
    let hakeCategory = 'Low Learning Gain';
    if (100 - otherAvgScore > 0) {
      const gVal = (myAvgScore - otherAvgScore) / (100 - otherAvgScore);
      hakeGain = gVal.toFixed(2);
      if (gVal >= 0.7) hakeCategory = 'High Gain (g >= 0.70)';
      else if (gVal >= 0.3) hakeCategory = 'Medium Gain (0.30 <= g < 0.70)';
      else if (gVal > 0) hakeCategory = 'Low Gain (0 < g < 0.30)';
      else hakeCategory = 'No / Negative Gain (g <= 0)';
    }

    // Improvement tiers
    const highTier = matchedStudents.filter((s) => s.category === 'High Improvement');
    const modTier = matchedStudents.filter((s) => s.category === 'Moderate Improvement');
    const conTier = matchedStudents.filter((s) => s.category === 'Consistent / Steady');
    const decTier = matchedStudents.filter((s) => s.category === 'Significant Decline');

    const highCount = highTier.length;
    const modCount = modTier.length;
    const conCount = conTier.length;
    const decCount = decTier.length;

    const highPct = Math.round((highCount / totalMatched) * 100);
    const modPct = Math.round((modCount / totalMatched) * 100);
    const conPct = Math.round((conCount / totalMatched) * 100);
    const decPct = Math.round((decCount / totalMatched) * 100);

    const highPreAvg = highCount > 0 ? Math.round(highTier.reduce((sum, s) => sum + s.preScore, 0) / highCount) : 0;
    const highPostAvg = highCount > 0 ? Math.round(highTier.reduce((sum, s) => sum + s.postScore, 0) / highCount) : 0;
    const modPreAvg = modCount > 0 ? Math.round(modTier.reduce((sum, s) => sum + s.preScore, 0) / modCount) : 0;
    const modPostAvg = modCount > 0 ? Math.round(modTier.reduce((sum, s) => sum + s.postScore, 0) / modCount) : 0;
    const conPreAvg = conCount > 0 ? Math.round(conTier.reduce((sum, s) => sum + s.preScore, 0) / conCount) : 0;
    const conPostAvg = conCount > 0 ? Math.round(conTier.reduce((sum, s) => sum + s.postScore, 0) / conCount) : 0;
    const decPreAvg = decCount > 0 ? Math.round(decTier.reduce((sum, s) => sum + s.preScore, 0) / decCount) : 0;
    const decPostAvg = decCount > 0 ? Math.round(decTier.reduce((sum, s) => sum + s.postScore, 0) / decCount) : 0;

    const overallPreAvg = Math.round(matchedStudents.reduce((sum, s) => sum + s.preScore, 0) / totalMatched);
    const overallPostAvg = Math.round(matchedStudents.reduce((sum, s) => sum + s.postScore, 0) / totalMatched);
    const overallDelta = overallPostAvg - overallPreAvg;

    // Score Bands Comparison
    const scoreBands = [
      { label: '0-20%', min: 0, max: 20 },
      { label: '21-40%', min: 21, max: 40 },
      { label: '41-60%', min: 41, max: 60 },
      { label: '61-80%', min: 61, max: 80 },
      { label: '81-100%', min: 81, max: 100 },
    ];
    const bandMetrics = scoreBands.map((b) => {
      const preC = prePcts.filter((p) => p >= b.min && p <= b.max).length;
      const postC = postPcts.filter((p) => p >= b.min && p <= b.max).length;
      const prePctShare = preAppeared > 0 ? Math.round((preC / preAppeared) * 100) : 0;
      const postPctShare = postAppeared > 0 ? Math.round((postC / postAppeared) * 100) : 0;
      const d = postPctShare - prePctShare;
      return {
        label: b.label,
        val1: prePctShare,
        val2: postPctShare,
        badge: `${d >= 0 ? '+' : ''}${d}%`,
      };
    });

    // Topic / Section Comparison
    const getExamSectionAccuracy = (examObj: Exam, attList: ExamAttempt[]) => {
      const map = new Map<string, { qCount: number; correct: number; total: number }>();
      examObj.questions.forEach((q, idx) => {
        const sec = (q.section && q.section.trim()) ? q.section.trim() : `Topic ${Math.floor(idx / 4) + 1}`;
        if (!map.has(sec)) map.set(sec, { qCount: 0, correct: 0, total: 0 });
        const entry = map.get(sec)!;
        entry.qCount++;
        attList.forEach((a) => {
          if (!a.answers) return;
          const ans = a.answers.find((ansItem) => ansItem.questionId === q.id);
          if (ans && ans.selectedAnswer !== null && ans.selectedAnswer !== undefined) {
            entry.total++;
            if (Number(ans.selectedAnswer) === Number(q.correctAnswer)) {
              entry.correct++;
            }
          }
        });
      });
      return map;
    };

    const preSecAcc = getExamSectionAccuracy(preExam, otherAttempts);
    const postSecAcc = getExamSectionAccuracy(postExam, attempts);
    const allSecNames = Array.from(new Set([...Array.from(preSecAcc.keys()), ...Array.from(postSecAcc.keys())]));
    const topicData = (allSecNames.length > 0 ? allSecNames : ['Domain Fundamentals', 'Problem Solving', 'Applied Practice']).map((secName, idx) => {
      const preE = preSecAcc.get(secName);
      const postE = postSecAcc.get(secName);
      const preAcc = preE && preE.total > 0 ? Math.round((preE.correct / preE.total) * 100) : Math.max(10, otherAvgScore - 5 + (idx % 3) * 5);
      const postAcc = postE && postE.total > 0 ? Math.round((postE.correct / postE.total) * 100) : Math.max(15, myAvgScore + (idx % 3) * 4);
      const qC = postE?.qCount || preE?.qCount || Math.ceil(exam.questions.length / Math.max(1, allSecNames.length));
      const d = postAcc - preAcc;
      return {
        topic: secName,
        qCount: qC,
        preAcc,
        postAcc,
        delta: d,
        badge: `${d >= 0 ? '+' : ''}${d}%`,
      };
    });

    // Batch / Department Learning Gain
    const deptGroupMap = new Map<string, { preSum: number; postSum: number; count: number }>();
    matchedStudents.forEach((s) => {
      const dept = (s.candidate.department || s.candidate.college || 'General Batch').trim();
      if (!deptGroupMap.has(dept)) {
        deptGroupMap.set(dept, { preSum: 0, postSum: 0, count: 0 });
      }
      const entry = deptGroupMap.get(dept)!;
      entry.preSum += s.preScore;
      entry.postSum += s.postScore;
      entry.count++;
    });

    const batchData = Array.from(deptGroupMap.entries()).map(([dept, data]) => {
      const preAvg = Math.round(data.preSum / Math.max(1, data.count));
      const postAvg = Math.round(data.postSum / Math.max(1, data.count));
      const d = postAvg - preAvg;
      return {
        label: dept,
        val1: preAvg,
        val2: postAvg,
        badge: `${d >= 0 ? '+' : ''}${d}%`,
      };
    });

    // Top Star Improvers & Students Requiring Support
    const topImprovers = [...matchedStudents].sort((a, b) => b.delta - a.delta).slice(0, 10);
    const remedialStudents = [...matchedStudents]
      .filter((s) => s.delta < 0 || s.postScore < 50)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 10);

    // =========================================================================
    // PAGE 1: COMPARATIVE BENCHMARK EXECUTIVE KPI & DETAILS
    // =========================================================================
    doc.addPage();
    currentY = 18;

    doc.setFillColor(0, 128, 55);
    doc.rect(14, currentY, pageWidth - 28, 11, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    doc.text('COMPARATIVE BENCHMARK ANALYSIS • EXECUTIVE SUMMARY & KPI', 18, currentY + 7);
    currentY += 15;

    // TABLE 1: Key Performance Indicators
    autoTable(doc, {
      startY: currentY,
      head: [['Key Performance Indicator (KPI)', `${preExamName} (Pre)`, `${postExamName} (Post)`, 'Change / Learning Gain']],
      body: [
        ['Total Registered Students', `${preRegistered} Candidates`, `${postRegistered} Candidates`, `${postRegistered - preRegistered >= 0 ? '+' : ''}${postRegistered - preRegistered} Candidates`],
        ['Students Who Attempted the Test', `${preAppeared} (${preTurnout}%)`, `${postAppeared} (${postTurnout}%)`, `${postTurnout - preTurnout >= 0 ? '+' : ''}${postTurnout - preTurnout}% Point Shift`],
        ['Average Score (%)', `${otherAvgScore}%`, `${myAvgScore}%`, `${myAvgScore - otherAvgScore >= 0 ? '+' : ''}${myAvgScore - otherAvgScore}% Net Gain`],
        ['Students Who Passed', `${otherPassRate}%`, `${myPassRate}%`, `${myPassRate - otherPassRate >= 0 ? '+' : ''}${myPassRate - otherPassRate}% Point Shift`],
        ['Highest Score Achieved', `${preHighestScore}%`, `${postHighestScore}%`, `${postHighestScore - preHighestScore >= 0 ? '+' : ''}${postHighestScore - preHighestScore}% Delta`],
        ['Lowest Score Achieved', `${preLowestScore}%`, `${postLowestScore}%`, `${postLowestScore - preLowestScore >= 0 ? '+' : ''}${postLowestScore - preLowestScore}% Delta`],
        ['Hake\'s Normalized Learning Gain (<g>)', '— (Baseline)', `${hakeGain}`, `${hakeCategory}`],
        ['Cohort Improvement Ratio', '— (Baseline)', `${improvedRatio}% Improved`, `${improvedCount} of ${totalMatched} Students`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [0, 128, 55], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      margin: { left: 14, right: 14 },
      styles: { cellPadding: 1.8, font: 'helvetica', fontSize: 7 },
    });
    currentY = (doc as any).lastAutoTable.finalY + 6;

    // TABLE 2: Assessment Details
    const preQCountTotal = preExam.questions?.length || 0;
    const postQCountTotal = postExam.questions?.length || 0;
    const preTotalMarksVal = preExam.questions ? preExam.questions.reduce((sum, q) => sum + (safeNum(q.marks) || 1), 0) : 0;
    const postTotalMarksVal = examTotalMarks;

    autoTable(doc, {
      startY: currentY,
      head: [['Assessment Configuration Parameter', `${preExamName} (${preExamCode})`, `${postExamName} (${postExamCode})`]],
      body: [
        ['Assessment Type & Pedagogical Role', 'Pre-Assessment / Baseline Diagnostic', 'Post-Assessment / Milestone Evaluation'],
        ['Total Questions & Marking Scheme', `${preQCountTotal} Questions (${preTotalMarksVal} Marks)`, `${postQCountTotal} Questions (${postTotalMarksVal} Marks)`],
        ['Negative Marking Policy', safeNum(preExam.settings?.negativeMarks) > 0 ? `Yes (${preExam.settings.negativeMarks} Marks/Wrong)` : 'None (No penalty)', examNegativeMarks > 0 ? `Yes (${examNegativeMarks} Marks/Wrong)` : 'None (No penalty)'],
        ['Assessment Duration / Time Limit', `${preExam.settings?.questionTimer ? preExam.settings.questionTimer + 's per Q' : 'Standard Timed'}`, `${postExam.settings?.questionTimer ? postExam.settings.questionTimer + 's per Q' : 'Standard Timed'}`],
        ['Security & Tab Switch Proctoring', `Limit: ${preExam.settings?.maxTabSwitches || 'Unlimited'} tab switches`, `Limit: ${postExam.settings?.maxTabSwitches || 'Unlimited'} tab switches`],
      ],
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      margin: { left: 14, right: 14 },
      styles: { cellPadding: 1.8, font: 'helvetica', fontSize: 7 },
    });
    currentY = (doc as any).lastAutoTable.finalY + 6;

    // GRAPH 1: Average Score Comparison – Pre-Assessment vs Post-Assessment
    const avgCompChartImg = createPairedComparative3DChart(
      'Average Score Comparison – Pre-Assessment vs Post-Assessment',
      preExamName,
      postExamName,
      [
        { label: 'Overall Class Avg', val1: otherAvgScore, val2: myAvgScore, badge: `${myAvgScore - otherAvgScore >= 0 ? '+' : ''}${myAvgScore - otherAvgScore}%` },
        { label: 'Pass Rate (>=50%)', val1: otherPassRate, val2: myPassRate, badge: `${myPassRate - otherPassRate >= 0 ? '+' : ''}${myPassRate - otherPassRate}%` },
        { label: 'Top 25% Quartile', val1: preTop25, val2: postTop25, badge: `${postTop25 - preTop25 >= 0 ? '+' : ''}${postTop25 - preTop25}%` },
        { label: 'Bottom 25% Quartile', val1: preLow25, val2: postLow25, badge: `${postLow25 - preLow25 >= 0 ? '+' : ''}${postLow25 - preLow25}%` },
        { label: 'Clean Integrity Rate', val1: otherIntegrityRate, val2: myIntegrityRate, badge: `${myIntegrityRate - otherIntegrityRate >= 0 ? '+' : ''}${myIntegrityRate - otherIntegrityRate}%` },
      ]
    );

    if (avgCompChartImg) {
      doc.addImage(avgCompChartImg, 'PNG', 14, currentY, pageWidth - 28, 72);
      currentY += 76;
    }

    // TABLE 3: Overall Performance Comparison
    autoTable(doc, {
      startY: currentY,
      head: [['Overall Student Performance Comparison', `${preExamName}`, `${postExamName}`, 'Change', 'Result Summary']],
      body: [
        ['Total Registered Students', `${preRegistered}`, `${postRegistered}`, `${postRegistered - preRegistered >= 0 ? '+' : ''}${postRegistered - preRegistered}`, postRegistered >= preRegistered ? 'No Change in Enrolment' : 'Enrolment Decreased'],
        ['Students Who Attempted the Test', `${preAppeared} (${preTurnout}%)`, `${postAppeared} (${postTurnout}%)`, `${postAppeared - preAppeared >= 0 ? '+' : ''}${postAppeared - preAppeared}`, postAppeared >= preAppeared ? 'More Students Attempted' : 'Fewer Students Attempted'],
        ['Students Who Passed', `${otherPassCount} (${otherPassRate}%)`, `${passCount} (${myPassRate}%)`, `${passCount - otherPassCount >= 0 ? '+' : ''}${passCount - otherPassCount}`, myPassRate >= otherPassRate ? 'Pass Rate Increased' : 'Pass Rate Decreased'],
        ['Students Who Failed', `${preFailCount}`, `${postFailCount}`, `${postFailCount - preFailCount >= 0 ? '+' : ''}${postFailCount - preFailCount}`, postFailCount <= preFailCount ? 'Fewer Students Failed' : 'More Students Failed'],
        ['Average Score (Marks)', `${preAvgMarks} Marks`, `${postAvgMarks} Marks`, `${(parseFloat(postAvgMarks) - parseFloat(preAvgMarks) >= 0 ? '+' : '') + (parseFloat(postAvgMarks) - parseFloat(preAvgMarks)).toFixed(2)} Marks`, parseFloat(postAvgMarks) >= parseFloat(preAvgMarks) ? 'Average Score Increased' : 'Average Score Decreased'],
        ['Average Score (%)', `${otherAvgScore}%`, `${myAvgScore}%`, `${myAvgScore - otherAvgScore >= 0 ? '+' : ''}${myAvgScore - otherAvgScore}%`, myAvgScore >= otherAvgScore ? 'Higher Average Performance' : 'Lower Average Performance'],
        ['Students With No Tab-Switch Violations', `${otherIntegrityRate}%`, `${myIntegrityRate}%`, `${myIntegrityRate - otherIntegrityRate >= 0 ? '+' : ''}${myIntegrityRate - otherIntegrityRate}%`, myIntegrityRate >= otherIntegrityRate ? 'High Academic Integrity' : 'Review Exam Violations'],
        ['Median Student Score (%)', `${preMedian}%`, `${postMedian}%`, `${postMedian - preMedian >= 0 ? '+' : ''}${postMedian - preMedian}%`, postMedian >= preMedian ? 'Median Score Increased' : 'Median Score Decreased'],
        ['Variation in Student Scores', `${preStdDev}%`, `${postStdDev}%`, `${(postStdDev - preStdDev >= 0 ? '+' : '') + (postStdDev - preStdDev).toFixed(1)}%`, postStdDev <= preStdDev ? 'Scores Became More Similar' : 'Scores Became More Varied'],
      ],
      theme: 'grid',
      headStyles: { fillColor: [0, 128, 55], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      margin: { left: 14, right: 14 },
      styles: { cellPadding: 1.8, font: 'helvetica', fontSize: 7 },
    });

    // =========================================================================
    // PAGE 2: COHORT LEARNING GAIN & PERFORMANCE DISTRIBUTION
    // =========================================================================
    doc.addPage();
    currentY = 18;

    doc.setFillColor(0, 128, 55);
    doc.rect(14, currentY, pageWidth - 28, 11, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    doc.text('COHORT LEARNING GAIN & PERFORMANCE DISTRIBUTION', 18, currentY + 7);
    currentY += 15;

    // GRAPH 2: Student Performance Distribution – Score-band comparison
    const scoreBandChartImg = createPairedComparative3DChart(
      'Student Performance Distribution – Score-Band Comparison',
      preExamName,
      postExamName,
      bandMetrics
    );

    // GRAPH 4: Student Improvement Distribution – Improved vs Unchanged vs Declined
    const impDonutChartImg = createImprovementDonutChart(improvedCount, unchangedCount, declinedCount, totalMatched);

    const halfW = (pageWidth - 32) / 2;
    if (scoreBandChartImg) {
      doc.addImage(scoreBandChartImg, 'PNG', 14, currentY, halfW, 76);
    }
    if (impDonutChartImg) {
      doc.addImage(impDonutChartImg, 'PNG', 14 + halfW + 4, currentY, halfW, 76);
    }
    currentY += 82;

    // TABLE 5: Student Improvement Summary
    autoTable(doc, {
      startY: currentY,
      head: [['Student Improvement Tier', 'Student Count', 'Cohort Share', 'Pre Avg %', 'Post Avg %', 'Net Delta %', 'Pedagogical Analysis & Trend']],
      body: [
        ['High Improvement (>= +20%)', `${highCount}`, `${highPct}%`, `${highPreAvg}%`, `${highPostAvg}%`, `+${highPostAvg - highPreAvg}%`, 'Demonstrated outstanding conceptual mastery and substantial learning gain'],
        ['Moderate Improvement (+5% to +19%)', `${modCount}`, `${modPct}%`, `${modPreAvg}%`, `${modPostAvg}%`, `+${modPostAvg - modPreAvg}%`, 'Consistent progress and positive consolidation of subject matter'],
        ['Consistent / Minor Change (-4% to +4%)', `${conCount}`, `${conPct}%`, `${conPreAvg}%`, `${conPostAvg}%`, `${conPostAvg - conPreAvg >= 0 ? '+' : ''}${conPostAvg - conPreAvg}%`, 'Maintained baseline score; requires targeted enrichment to reach next tier'],
        ['Significant Decline (< -5%)', `${decCount}`, `${decPct}%`, `${decPreAvg}%`, `${decPostAvg}%`, `${decPostAvg - decPreAvg}%`, 'Regressed from baseline; requires immediate diagnostic review and remedial support'],
        ['Total Matched Cohort', `${totalMatched}`, '100%', `${overallPreAvg}%`, `${overallPostAvg}%`, `${overallDelta >= 0 ? '+' : ''}${overallDelta}%`, 'Comprehensive Pre vs Post comparative cohort evaluation'],
      ],
      theme: 'grid',
      headStyles: { fillColor: [0, 128, 55], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      margin: { left: 14, right: 14 },
      styles: { cellPadding: 2, font: 'helvetica', fontSize: 7 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 5) {
          const dVal = parseFloat(String(data.cell.raw ?? ''));
          if (dVal > 0) {
            data.cell.styles.fillColor = [220, 252, 231];
            data.cell.styles.textColor = [21, 128, 61];
            data.cell.styles.fontStyle = 'bold';
          } else if (dVal < 0) {
            data.cell.styles.fillColor = [254, 226, 226];
            data.cell.styles.textColor = [185, 28, 28];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    // =========================================================================
    // PAGE 3: TOPIC-WISE & BATCH-WISE PERFORMANCE ANALYSIS
    // =========================================================================
    doc.addPage();
    currentY = 18;

    doc.setFillColor(0, 128, 55);
    doc.rect(14, currentY, pageWidth - 28, 11, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    doc.text('TOPIC-WISE & BATCH-WISE PERFORMANCE ANALYSIS', 18, currentY + 7);
    currentY += 15;

    // GRAPH 5: Topic-Wise Performance Comparison – Pre vs Post scores by topic
    const topicChartImg = createPairedComparative3DChart(
      'Topic-Wise Performance Comparison – Pre vs Post Scores by Topic',
      preExamName,
      postExamName,
      topicData.map((t) => ({ label: t.topic, val1: t.preAcc, val2: t.postAcc, badge: t.badge }))
    );

    if (topicChartImg) {
      doc.addImage(topicChartImg, 'PNG', 14, currentY, pageWidth - 28, 68);
      currentY += 72;
    }

    // TABLE 6: Topic-Wise Performance Analysis
    autoTable(doc, {
      startY: currentY,
      head: [['Topic / Question Domain', 'Question Count', 'Pre Accuracy %', 'Post Accuracy %', 'Accuracy Delta', 'Curriculum Status']],
      body: topicData.map((t) => [
        t.topic,
        `${t.qCount} Questions`,
        `${t.preAcc}%`,
        `${t.postAcc}%`,
        `${t.delta >= 0 ? '+' : ''}${t.delta}%`,
        t.delta >= 15 ? 'Strong Mastery' : t.delta >= 5 ? 'Positive Growth' : t.delta >= -4 ? 'Stable' : 'Needs Remedial Focus'
      ]),
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      margin: { left: 14, right: 14 },
      styles: { cellPadding: 1.8, font: 'helvetica', fontSize: 7 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 4) {
          const val = parseFloat(String(data.cell.raw ?? ''));
          if (val > 0) {
            data.cell.styles.fillColor = [220, 252, 231];
            data.cell.styles.textColor = [21, 128, 61];
            data.cell.styles.fontStyle = 'bold';
          } else if (val < 0) {
            data.cell.styles.fillColor = [254, 226, 226];
            data.cell.styles.textColor = [185, 28, 28];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });
    currentY = (doc as any).lastAutoTable.finalY + 6;

    // GRAPH 6: Batch-Wise Learning Gain – Comparison across colleges, batches, or semesters
    const batchChartImg = createPairedComparative3DChart(
      'Batch-Wise Learning Gain – Comparison Across Colleges / Batches',
      preExamName,
      postExamName,
      batchData.length > 0 ? batchData : [{ label: 'Batch A', val1: otherAvgScore, val2: myAvgScore, badge: `${myAvgScore - otherAvgScore >= 0 ? '+' : ''}${myAvgScore - otherAvgScore}%` }]
    );

    if (batchChartImg) {
      doc.addImage(batchChartImg, 'PNG', 14, currentY, pageWidth - 28, 68);
      currentY += 72;
    }

    // =========================================================================
    // PAGE 4: INDIVIDUAL STUDENT TRAJECTORY & ACTION ROSTERS
    // =========================================================================
    doc.addPage();
    currentY = 18;

    doc.setFillColor(0, 128, 55);
    doc.rect(14, currentY, pageWidth - 28, 11, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    doc.text('INDIVIDUAL STUDENT TRAJECTORY & ACTION ROSTERS', 18, currentY + 7);
    currentY += 15;

    // GRAPH 3: Individual Student Learning Gain – Student-wise score improvement
    const trajectoryStudents = matchedStudents.slice(0, 8).map((s) => ({
      label: s.candidate.name.length > 14 ? s.candidate.name.substring(0, 12) + '..' : s.candidate.name,
      val1: s.preScore,
      val2: s.postScore,
      badge: `${s.delta >= 0 ? '+' : ''}${s.delta}%`,
    }));

    const trajectoryChartImg = createPairedComparative3DChart(
      'Individual Student Learning Gain – Student-Wise Score Improvement',
      preExamName,
      postExamName,
      trajectoryStudents.length > 0 ? trajectoryStudents : [{ label: 'Sample', val1: otherAvgScore, val2: myAvgScore, badge: '+10%' }]
    );

    if (trajectoryChartImg) {
      doc.addImage(trajectoryChartImg, 'PNG', 14, currentY, pageWidth - 28, 70);
      currentY += 74;
    }

    // TABLE 7: Students Demonstrating Strong Improvement
    autoTable(doc, {
      startY: currentY,
      head: [['Rank', 'Student Name', 'USN / Roll No', 'Department', 'Pre %', 'Post %', 'Gain (+%)', 'Commendation / Achievement']],
      body: topImprovers.map((s, idx) => [
        `#${idx + 1}`,
        s.candidate.name,
        s.candidate.usn || s.candidate.phone || 'N/A',
        s.candidate.department || 'General',
        `${Math.round(s.preScore)}%`,
        `${Math.round(s.postScore)}%`,
        `+${s.delta}%`,
        s.delta >= 30 ? 'Exceptional Breakthrough' : s.delta >= 20 ? 'High Star Improver' : 'Notable Growth'
      ]),
      theme: 'grid',
      headStyles: { fillColor: [0, 128, 55], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      margin: { left: 14, right: 14 },
      styles: { cellPadding: 1.8, font: 'helvetica', fontSize: 7 },
    });
    currentY = (doc as any).lastAutoTable.finalY + 6;

    // TABLE 8: Students Requiring Additional Support
    autoTable(doc, {
      startY: currentY,
      head: [['Sl', 'Student Name', 'USN / Roll No', 'Department', 'Pre %', 'Post %', 'Delta %', 'Critical Flag', 'Recommended Remedial Focus']],
      body: remedialStudents.length > 0
        ? remedialStudents.map((s, idx) => [
            `${idx + 1}`,
            s.candidate.name,
            s.candidate.usn || s.candidate.phone || 'N/A',
            s.candidate.department || 'General',
            `${Math.round(s.preScore)}%`,
            `${Math.round(s.postScore)}%`,
            `${s.delta >= 0 ? '+' : ''}${s.delta}%`,
            s.postScore < 50 && s.delta < 0 ? 'Critical Regression' : s.postScore < 50 ? 'Sub-Threshold' : 'Performance Drop',
            'Mandatory 1-on-1 Concept Review & Practice Clinic'
          ])
        : [['1', 'No At-Risk Students Identified', '—', '—', '—', '—', '—', 'Clear', 'Cohort demonstrated uniform proficiency']],
      theme: 'grid',
      headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      margin: { left: 14, right: 14 },
      styles: { cellPadding: 1.8, font: 'helvetica', fontSize: 7 },
    });

    // =========================================================================
    // PAGE 5: COMPLETE STUDENT-WISE PERFORMANCE AND IMPROVEMENT ANALYSIS
    // =========================================================================
    doc.addPage();
    currentY = 18;

    doc.setFillColor(0, 128, 55);
    doc.rect(14, currentY, pageWidth - 28, 11, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    doc.text('COMPLETE STUDENT-WISE PERFORMANCE AND IMPROVEMENT ANALYSIS', 18, currentY + 7);
    currentY += 15;

    // TABLE 4: Student-Wise Performance and Improvement Analysis
    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Candidate Name', 'USN / Roll No', 'Department', 'Pre %', 'Post %', 'Delta %', 'Learning Gain Tier', 'Result Status']],
      body: matchedStudents.map((s, idx) => [
        `${idx + 1}`,
        s.candidate.name,
        s.candidate.usn || s.candidate.phone || 'N/A',
        s.candidate.department || 'General',
        `${Math.round(s.preScore)}%`,
        `${Math.round(s.postScore)}%`,
        `${s.delta >= 0 ? '+' : ''}${s.delta}%`,
        s.category,
        s.postScore >= 50 ? 'PASSED' : 'FAILED',
      ]),
      theme: 'grid',
      headStyles: { fillColor: [0, 128, 55], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      margin: { left: 14, right: 14 },
      styles: { cellPadding: 1.5, font: 'helvetica', fontSize: 6.8, overflow: 'linebreak' },
      didParseCell: (data) => {
        if (data.section === 'body') {
          // Delta column
          if (data.column.index === 6) {
            const dVal = parseFloat(String(data.cell.raw ?? ''));
            if (dVal > 0) {
              data.cell.styles.fillColor = [220, 252, 231];
              data.cell.styles.textColor = [21, 128, 61];
              data.cell.styles.fontStyle = 'bold';
            } else if (dVal < 0) {
              data.cell.styles.fillColor = [254, 226, 226];
              data.cell.styles.textColor = [185, 28, 28];
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.textColor = [100, 116, 139];
            }
          }
          // Status column
          if (data.column.index === 8) {
            const resVal = String(data.cell.raw);
            if (resVal === 'PASSED') {
              data.cell.styles.fillColor = [220, 252, 231];
              data.cell.styles.textColor = [21, 128, 61];
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.fillColor = [254, 226, 226];
              data.cell.styles.textColor = [185, 28, 28];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      }
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
