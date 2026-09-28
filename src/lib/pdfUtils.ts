import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Exam, Candidate, ExamResult, ExamAttempt } from './types';

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
    ctx.font = 'bold 20px Inter, sans-serif';
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
    ctx.font = 'bold 18px Inter, sans-serif';
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
  ctx.font = 'bold 30px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, 40, 60);

  ctx.fillStyle = '#059669';
  ctx.font = 'bold 18px Inter, system-ui, sans-serif';
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
    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${count}`, bx + barWidth / 2 + depth / 2, by - depth - 16);

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.fillText(`(${pctShare}%)`, bx + barWidth / 2 + depth / 2, by - depth + 6);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 20px Inter, sans-serif';
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
  ctx.font = 'bold 36px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const passRate = (passCount + failCount) > 0 ? Math.round((passCount / (passCount + failCount)) * 100) : 0;
  ctx.fillText(`${passRate}%`, 700, 410);

  ctx.fillStyle = '#059669';
  ctx.font = 'bold 18px Inter, sans-serif';
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
    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${sec.accuracy}%`, bx + barWidth / 2 + depth / 2, by - depth - 16);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 18px Inter, sans-serif';
    const label = sec.name.length > 18 ? sec.name.substring(0, 16) + '...' : sec.name;
    ctx.fillText(label, bx + barWidth / 2, floorY + 40);

    ctx.fillStyle = '#64748b';
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText(`${sec.questionsCount} Qs (${sec.maxMarks}M)`, bx + barWidth / 2, floorY + 65);
    ctx.restore();
  });

  return canvas.toDataURL('image/png');
}

/**
 * Chart 4: 3D Question-Wise Accuracy & Performance Chart
 */
function createQuestionWisePerformanceChart(
  questionStats: { qNumber: number; section: string; accuracy: number; difficulty: string }[]
): string {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1400, questionStats.length * 100 + 200);
  canvas.height = 760;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  generateChartHeader(
    ctx,
    canvas.width,
    '3D Question-Wise Performance & Item Difficulty Analysis',
    'Accuracy distribution and difficulty tier classification per question'
  );

  const floorY = 600;
  const chartStartX = 100;
  const chartWidth = canvas.width - 200;
  const count = questionStats.length;
  const barWidth = Math.min(80, Math.max(36, (chartWidth - 20 * (count - 1)) / count));
  const depth = 20;
  const maxHeight = 360;
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

  questionStats.forEach((q, i) => {
    const color = q.difficulty === 'Easy' ? '#059669' : q.difficulty === 'Challenging' ? '#e11d48' : '#d97706';
    const barHeight = Math.max(10, (q.accuracy / 100) * maxHeight);
    const bx = chartStartX + i * (barWidth + spacing);
    const by = floorY - barHeight;

    draw3DBarOnCanvas(ctx, bx, by, barWidth, barHeight, depth, color);

    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${q.accuracy}%`, bx + barWidth / 2 + depth / 2, by - depth - 10);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 17px Inter, sans-serif';
    ctx.fillText(`Q${q.qNumber}`, bx + barWidth / 2, floorY + 32);

    ctx.fillStyle = '#64748b';
    ctx.font = '12px Inter, sans-serif';
    const secShort = q.section.length > 8 ? q.section.substring(0, 7) + '.' : q.section;
    ctx.fillText(secShort, bx + barWidth / 2, floorY + 54);
    ctx.restore();
  });

  return canvas.toDataURL('image/png');
}

/**
 * Chart 5: 3D Department-wise Performance Chart
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
    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${d.avgScore}%`, bx + barWidth / 2 + depth / 2, by - depth - 16);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 18px Inter, sans-serif';
    const label = d.department.length > 18 ? d.department.substring(0, 16) + '...' : d.department;
    ctx.fillText(label, bx + barWidth / 2, floorY + 40);

    ctx.fillStyle = '#64748b';
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText(`${d.count} Candidate${d.count !== 1 ? 's' : ''}`, bx + barWidth / 2, floorY + 65);
    ctx.restore();
  });

  return canvas.toDataURL('image/png');
}

/**
 * Chart 6: 3D Exam Integrity & Proctoring Breakdown Chart
 */
function createIntegrityChart(
  tabSwitchBuckets: { label: string; count: number; tag: string }[],
  totalAttempted: number
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
    '3D Proctoring & Exam Integrity Distribution',
    'Candidate distribution by tab-switch frequency and security compliance'
  );

  const colors = ['#059669', '#3b82f6', '#f59e0b', '#e11d48'];
  const maxCount = Math.max(1, ...tabSwitchBuckets.map((b) => b.count));
  const floorY = 620;
  const chartStartX = 140;
  const chartWidth = canvas.width - 280;
  const count = tabSwitchBuckets.length;
  const barWidth = 140;
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

  tabSwitchBuckets.forEach((b, i) => {
    const color = colors[i % colors.length];
    const barHeight = Math.max(12, (b.count / maxCount) * maxHeight);
    const bx = chartStartX + i * (barWidth + spacing);
    const by = floorY - barHeight;

    draw3DBarOnCanvas(ctx, bx, by, barWidth, barHeight, depth, color);

    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${b.count}`, bx + barWidth / 2 + depth / 2, by - depth - 16);

    const share = totalAttempted > 0 ? ((b.count / totalAttempted) * 100).toFixed(1) : '0';
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.fillText(`(${share}%)`, bx + barWidth / 2 + depth / 2, by - depth + 6);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText(b.label, bx + barWidth / 2, floorY + 40);

    ctx.fillStyle = color;
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillText(`[${b.tag}]`, bx + barWidth / 2, floorY + 65);
    ctx.restore();
  });

  return canvas.toDataURL('image/png');
}

export interface PdfExportOptions {
  filteredCandidates?: Candidate[];
  isFiltered?: boolean;
}

/**
 * Generate and download a Complete Comprehensive PDF Report for the Exam
 */
export async function exportExamDetailedPdfReport(
  exam: Exam,
  candidates: Candidate[],
  results: ExamResult[],
  attempts: ExamAttempt[],
  options?: PdfExportOptions
) {
  const isFiltered = options?.isFiltered ?? false;
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
      ['Exam Submissions / Attempted', `${attemptedCount} Candidates`, `${totalTargetCandidates > 0 ? ((attemptedCount / totalTargetCandidates) * 100).toFixed(1) : 0}% Turnout Rate`],
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
    styles: { cellPadding: 2, font: 'helvetica' },
  });

  // =========================================================================
  // SECTION 5: COMPLETE CANDIDATE EXAMINATION RESULTS & SCORECARD (NO CUTOFF)
  // =========================================================================
  doc.addPage();
  currentY = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 128, 55);
  doc.text('CANDIDATE MERIT RANK LIST & DETAILED SCORECARD', 10, currentY);
  currentY += 4.5;

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

    return [
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
      resultStatus,
      cr.isAttempted ? `${cr.tabSwitches}` : '-',
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['Rank', 'Candidate Name', 'Email Address', 'USN', 'Dept', 'Status', 'Corr', 'Wrong', 'Score', 'Accuracy', 'Result', 'Tabs']],
    body: candidateRankRows,
    theme: 'striped',
    headStyles: {
      fillColor: [0, 128, 55],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 8, fontStyle: 'bold', textColor: [0, 128, 55], halign: 'center', fontSize: 7.5 },
      1: { cellWidth: 25, fontStyle: 'bold', textColor: [30, 41, 59], fontSize: 7.5 },
      2: { cellWidth: 28, textColor: [71, 85, 105], fontSize: 7 },
      3: { cellWidth: 15, textColor: [71, 85, 105], fontSize: 7 },
      4: { cellWidth: 14, textColor: [71, 85, 105], fontSize: 7 },
      5: { cellWidth: 18, textColor: [51, 65, 85], fontSize: 7 },
      6: { cellWidth: 10, fontStyle: 'bold', textColor: [0, 128, 55], halign: 'center', fontSize: 7.5 },
      7: { cellWidth: 11, fontStyle: 'bold', textColor: [225, 29, 72], halign: 'center', fontSize: 7.5 },
      8: { cellWidth: 18, fontStyle: 'bold', textColor: [30, 41, 59], halign: 'center', fontSize: 7.5 },
      9: { cellWidth: 14, fontStyle: 'bold', textColor: [0, 128, 55], halign: 'center', fontSize: 7.5 },
      10: { cellWidth: 18, fontStyle: 'bold', halign: 'center', fontSize: 7.5 },
      11: { cellWidth: 9, textColor: [100, 116, 139], halign: 'center', fontSize: 7.5 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 10) {
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
    margin: { left: 10, right: 10 },
    styles: { cellPadding: 1.8, font: 'helvetica', overflow: 'linebreak' },
  });

  // =========================================================================
  // SECTION 6: COMPREHENSIVE QUESTION-WISE DEEP DIVE ANALYSIS (ITEM LEVEL)
  // =========================================================================
  doc.addPage();
  currentY = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 128, 55);
  doc.text('QUESTION-LEVEL INTELLIGENCE & ITEM ANALYSIS SUMMARY', 14, currentY);
  currentY += 4.5;

  const questionStatsData: { qNumber: number; section: string; accuracy: number; difficulty: string }[] = [];
  const questionAnalysisList: any[] = [];

  const questionSummaryTableRows = exam.questions.map((q, idx) => {
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

    questionStatsData.push({
      qNumber: idx + 1,
      section: q.section || 'General',
      accuracy,
      difficulty: diff,
    });

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

    const previewText = (q.text || '').replace(/\s+/g, ' ').substring(0, 48) + (q.text.length > 48 ? '...' : '');

    return [
      `Q${idx + 1}`,
      q.section || 'General',
      previewText,
      `Key: ${correctKeyChar}`,
      `+${q.marks || 1} / -${q.negativeMarks ?? examNegativeMarks}`,
      diff,
      `${qCorrect} (${accuracy}%)`,
      `${qWrong} (${wrongPct}%)`,
      `${qSkipped}`,
    ];
  });

  // Question Summary Table
  autoTable(doc, {
    startY: currentY,
    head: [['Q#', 'Section', 'Question Preview', 'Key', 'Marks', 'Tier', 'Correct (%)', 'Wrong (%)', 'Skip']],
    body: questionSummaryTableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [5, 150, 105],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    columnStyles: {
      0: { cellWidth: 10, fontStyle: 'bold', textColor: [0, 128, 55], halign: 'center', fontSize: 7 },
      1: { cellWidth: 22, textColor: [51, 65, 85], fontSize: 7 },
      2: { cellWidth: 'auto', textColor: [30, 41, 59], fontSize: 7 },
      3: { cellWidth: 16, fontStyle: 'bold', textColor: [0, 128, 55], halign: 'center', fontSize: 7 },
      4: { cellWidth: 18, textColor: [71, 85, 105], halign: 'center', fontSize: 7 },
      5: { cellWidth: 20, fontStyle: 'bold', textColor: [30, 41, 59], halign: 'center', fontSize: 7 },
      6: { cellWidth: 20, fontStyle: 'bold', textColor: [0, 128, 55], halign: 'center', fontSize: 7 },
      7: { cellWidth: 20, fontStyle: 'bold', textColor: [225, 29, 72], halign: 'center', fontSize: 7 },
      8: { cellWidth: 12, textColor: [100, 116, 139], halign: 'center', fontSize: 7 },
    },
    margin: { left: 14, right: 14 },
    styles: { cellPadding: 1.8, font: 'helvetica' },
  });

  // =========================================================================
  // DETAILED QUESTION-BY-QUESTION INDIVIDUAL BREAKDOWN CARDS
  // =========================================================================
  doc.addPage();
  currentY = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 128, 55);
  doc.text('DETAILED QUESTION-BY-QUESTION ITEM BREAKDOWN', 14, currentY);
  currentY += 6;

  questionAnalysisList.forEach((qa) => {
    if (currentY + 68 > pageHeight - 18) {
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
    const splitQText = doc.splitTextToSize(`"${qa.question.text}"`, pageWidth - 32);
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

  // --- LAST PAGE 1: 3D Score Distribution Chart & 3D Pass/Fail Donut ---
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

  // Graph 1: 3D Score Distribution Chart
  const scoreDistChartImg = createScoreDistributionChart(
    attemptedCandidates.map((c) => safeNum(c.percentage)),
    attemptedCount
  );
  if (scoreDistChartImg) {
    const chartHeight = 84;
    doc.addImage(scoreDistChartImg, 'PNG', 14, currentY, pageWidth - 28, chartHeight);
    currentY += chartHeight + 8;
  }

  // Graph 2: 3D Pass vs Fail Qualification Donut
  const passFailDonutImg = createPassFailDonutChart(passCount, failCount, notAttemptedCount, totalTargetCandidates);
  if (passFailDonutImg) {
    const chartHeight = 84;
    doc.addImage(passFailDonutImg, 'PNG', 14, currentY, (pageWidth - 32) / 2, chartHeight);
  }

  // Graph 3: 3D Section-Wise Accuracy Performance Chart
  const sectionChartImg = createSectionAccuracyChart(sectionStats);
  if (sectionChartImg) {
    const chartHeight = 84;
    doc.addImage(sectionChartImg, 'PNG', 14 + (pageWidth - 32) / 2 + 4, currentY, (pageWidth - 32) / 2, chartHeight);
  }

  // --- LAST PAGE 2: Question-Wise 3D Chart, Department 3D Chart & Proctoring 3D Chart ---
  doc.addPage();
  currentY = 20;

  // Graph 4: 3D Question-Wise Accuracy & Performance Chart
  const questionWiseChartImg = createQuestionWisePerformanceChart(questionStatsData);
  if (questionWiseChartImg) {
    const chartHeight = 84;
    doc.addImage(questionWiseChartImg, 'PNG', 14, currentY, pageWidth - 28, chartHeight);
    currentY += chartHeight + 8;
  }

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

  // Graph 5: 3D Department-Wise Performance Chart
  const deptChartImg = createDepartmentPerformanceChart(deptStats);
  if (deptChartImg) {
    const chartHeight = 84;
    doc.addImage(deptChartImg, 'PNG', 14, currentY, (pageWidth - 32) / 2, chartHeight);
  }

  // Integrity Stats Data
  const tabBuckets = [
    { label: '0 Switches', count: attemptedCandidates.filter((c) => safeNum(c.tabSwitches) === 0).length, tag: 'Clean' },
    { label: '1-2 Switches', count: attemptedCandidates.filter((c) => safeNum(c.tabSwitches) >= 1 && safeNum(c.tabSwitches) <= 2).length, tag: 'Minor' },
    { label: '3-5 Switches', count: attemptedCandidates.filter((c) => safeNum(c.tabSwitches) >= 3 && safeNum(c.tabSwitches) <= 5).length, tag: 'Warning' },
    { label: '6+ Switches', count: attemptedCandidates.filter((c) => safeNum(c.tabSwitches) >= 6).length, tag: 'Exceeded' },
  ];

  // Graph 6: 3D Exam Integrity & Proctoring Distribution Chart
  const integrityChartImg = createIntegrityChart(tabBuckets, attemptedCount);
  if (integrityChartImg) {
    const chartHeight = 84;
    doc.addImage(integrityChartImg, 'PNG', 14 + (pageWidth - 32) / 2 + 4, currentY, (pageWidth - 32) / 2, chartHeight);
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
