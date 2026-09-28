import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Exam, ExamResult, Candidate, ExamAttempt } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Sparkles, Sliders, BarChart3, PieChart as PieChartIcon, TrendingUp, ShieldCheck, Layers, Table as TableIcon, HelpCircle, CheckCircle2, XCircle, MinusCircle, FileQuestion, Filter, Eye, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { exportExamDetailedPdfReport } from '@/lib/pdfUtils';
import { toast } from 'sonner';

interface ExamResults3DAnalyticsProps {
  exam: Exam;
  candidates: Candidate[];
  results: ExamResult[];
  attempts: ExamAttempt[];
  getSectionScoresData: (attempt: ExamAttempt) => { section: string; obtained: number; total: number; percent: number }[];
  getSubmissionStatus: (attempt: ExamAttempt | undefined) => string;
}

// Tooltip data interface
interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  title: string;
  valueText: string;
  color: string;
  details: { label: string; value: string | number }[];
}

export const ExamResults3DAnalytics: React.FC<ExamResults3DAnalyticsProps> = ({
  exam,
  candidates,
  results,
  attempts,
  getSectionScoresData,
  getSubmissionStatus,
}) => {
  // Chart view modes for prebuilt cards
  const [scoreDistView, setScoreDistView] = useState<'3d-bar' | 'table'>('3d-bar');
  const [sectionView, setSectionView] = useState<'3d-bar' | 'table'>('3d-bar');
  const [passFailView, setPassFailView] = useState<'3d-donut' | 'table'>('3d-donut');
  const [deptView, setDeptView] = useState<'3d-bar' | 'table'>('3d-bar');
  const [integrityView, setIntegrityView] = useState<'3d-bar' | 'table'>('3d-bar');

  // Question-wise 3D Analytics state
  const [questionView, setQuestionView] = useState<'3d-bar' | 'table'>('3d-bar');
  const [questionSectionFilter, setQuestionSectionFilter] = useState<string>('all');
  const [questionMetric, setQuestionMetric] = useState<'accuracy' | 'correct' | 'avgScore'>('accuracy');
  const [hoveredQuestionIdx, setHoveredQuestionIdx] = useState<number | null>(null);
  const [questionTooltip, setQuestionTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, title: '', valueText: '', color: '', details: [] });
  const [selectedQuestionForModal, setSelectedQuestionForModal] = useState<any | null>(null);

  // Custom Graph Builder State
  const [customChartType, setCustomChartType] = useState<'3d-bar' | '3d-donut'>('3d-bar');
  const [customDimension, setCustomDimension] = useState<'department' | 'college' | 'section' | 'scoreBracket' | 'passFail' | 'tabSwitches'>('department');
  const [customMetric, setCustomMetric] = useState<'avgPercentage' | 'avgScore' | 'candidateCount' | 'avgCorrect' | 'avgWrong' | 'avgTabSwitches'>('avgPercentage');
  const [customColorTheme, setCustomColorTheme] = useState<'emerald' | 'blue' | 'amber' | 'purple' | 'multi'>('emerald');

  // Interactive Hover Tooltip State for each canvas
  const [scoreTooltip, setScoreTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, title: '', valueText: '', color: '', details: [] });
  const [sectionTooltip, setSectionTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, title: '', valueText: '', color: '', details: [] });
  const [passFailTooltip, setPassFailTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, title: '', valueText: '', color: '', details: [] });
  const [deptTooltip, setDeptTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, title: '', valueText: '', color: '', details: [] });
  const [integrityTooltip, setIntegrityTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, title: '', valueText: '', color: '', details: [] });
  const [customTooltip, setCustomTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, title: '', valueText: '', color: '', details: [] });

  // Hover item tracking for redraw highlights
  const [hoveredScoreIdx, setHoveredScoreIdx] = useState<number | null>(null);
  const [hoveredSectionIdx, setHoveredSectionIdx] = useState<number | null>(null);
  const [hoveredPassFailIdx, setHoveredPassFailIdx] = useState<number | null>(null);
  const [hoveredDeptIdx, setHoveredDeptIdx] = useState<number | null>(null);
  const [hoveredIntegrityIdx, setHoveredIntegrityIdx] = useState<number | null>(null);
  const [hoveredCustomIdx, setHoveredCustomIdx] = useState<number | null>(null);

  // Canvas Refs
  const scoreDistCanvasRef = useRef<HTMLCanvasElement>(null);
  const sectionCanvasRef = useRef<HTMLCanvasElement>(null);
  const passFailCanvasRef = useRef<HTMLCanvasElement>(null);
  const deptCanvasRef = useRef<HTMLCanvasElement>(null);
  const integrityCanvasRef = useRef<HTMLCanvasElement>(null);
  const customCanvasRef = useRef<HTMLCanvasElement>(null);
  const questionCanvasRef = useRef<HTMLCanvasElement>(null);

  // Hit boundaries storage for mouse interaction
  const scoreDistHitBoxes = useRef<{ x: number; y: number; w: number; h: number; data: any }[]>([]);
  const sectionHitBoxes = useRef<{ x: number; y: number; w: number; h: number; data: any }[]>([]);
  const passFailHitSlices = useRef<{ startAngle: number; endAngle: number; r: number; innerR: number; cx: number; cy: number; data: any }[]>([]);
  const deptHitBoxes = useRef<{ x: number; y: number; w: number; h: number; data: any }[]>([]);
  const integrityHitBoxes = useRef<{ x: number; y: number; w: number; h: number; data: any }[]>([]);
  const customHitBoxes = useRef<{ x: number; y: number; w: number; h: number; data: any }[]>([]);
  const customHitSlices = useRef<{ startAngle: number; endAngle: number; r: number; innerR: number; cx: number; cy: number; data: any }[]>([]);
  const questionHitBoxes = useRef<{ x: number; y: number; w: number; h: number; data: any }[]>([]);

  // -----------------------------------------------------------------
  // UNIFIED CANDIDATE PERFORMANCE PIPELINE
  // -----------------------------------------------------------------
  const candidateAnalytics = useMemo(() => {
    const examNegativeMarks = exam.settings?.negativeMarks ?? 0;
    const totalExamQuestions = exam.questions?.length || 0;
    const totalMaxMarks = exam.questions?.reduce((sum, q) => sum + (q.marks || 1), 0) || totalExamQuestions || 1;

    return candidates.map(candidate => {
      const result = results.find(r => r.candidateId === candidate.id);
      const attempt = attempts.find(a => a.candidateId === candidate.id || (result && a.id === result.attemptId));
      const status = getSubmissionStatus(attempt);

      let percentage = 0;
      let obtainedMarks = 0;
      let correctAnswers = 0;
      let wrongAnswers = 0;
      let attemptedCount = 0;
      let hasAttempted = Boolean(attempt && attempt.answers && attempt.answers.length > 0);

      const resPct = result && result.percentage !== null && result.percentage !== undefined ? Number(result.percentage) : NaN;
      const resMarks = result && result.obtainedMarks !== null && result.obtainedMarks !== undefined ? Number(result.obtainedMarks) : NaN;

      if (result && Number.isFinite(resPct)) {
        percentage = resPct;
        obtainedMarks = Number.isFinite(resMarks) ? resMarks : 0;
        correctAnswers = Number(result.correctAnswers) || 0;
        wrongAnswers = Number(result.wrongAnswers) || 0;
        attemptedCount = attempt ? (attempt.answers?.length || 0) : 0;
      } else if (attempt && attempt.answers && attempt.answers.length > 0) {
        attemptedCount = attempt.answers.length;
        let scoreSum = 0;

        exam.questions.forEach(q => {
          const qMarks = q.marks || 1;
          const ans = attempt.answers.find(a => a.questionId === q.id);
          if (ans && ans.selectedAnswer !== null && ans.selectedAnswer !== undefined) {
            if (ans.selectedAnswer === q.correctAnswer) {
              scoreSum += qMarks;
              correctAnswers++;
            } else {
              const neg = typeof q.negativeMarks === 'number' ? q.negativeMarks : examNegativeMarks;
              scoreSum -= neg;
              wrongAnswers++;
            }
          }
        });

        obtainedMarks = Math.max(0, scoreSum);
        percentage = totalMaxMarks > 0 ? Math.round((obtainedMarks / totalMaxMarks) * 1000) / 10 : 0;
      }

      return {
        candidate,
        attempt,
        result,
        status,
        hasAttempted,
        percentage,
        obtainedMarks,
        totalMaxMarks,
        correctAnswers,
        wrongAnswers,
        attemptedCount,
        tabSwitches: attempt?.tabSwitches || 0,
        department: candidate.department || 'General',
        college: candidate.college || 'Default College',
        section: candidate.section || 'General',
      };
    });
  }, [candidates, results, attempts, exam, getSubmissionStatus]);

  const attemptedAnalytics = useMemo(() => {
    return candidateAnalytics.filter(c => c.hasAttempted);
  }, [candidateAnalytics]);

  // -----------------------------------------------------------------
  // QUESTION-WISE PERFORMANCE ANALYTICS PIPELINE
  // -----------------------------------------------------------------
  const questionAnalytics = useMemo(() => {
    if (!exam?.questions || exam.questions.length === 0) return [];
    const totalAttemptsCount = attemptedAnalytics.length;
    const examNegMarks = exam.settings?.negativeMarks ?? 0;

    return exam.questions.map((q, qIdx) => {
      const qNumber = qIdx + 1;
      const section = q.section || 'General';
      const qMarks = q.marks || 1;
      const qNeg = typeof q.negativeMarks === 'number' ? q.negativeMarks : examNegMarks;
      const options = Array.isArray(q.options) ? q.options : [];
      const optionCounts = options.map(() => 0);

      let correctCount = 0;
      let wrongCount = 0;
      let unansweredCount = 0;
      let totalPoints = 0;

      const candidatesCorrect: string[] = [];
      const candidatesWrong: string[] = [];
      const candidatesSkipped: string[] = [];

      attemptedAnalytics.forEach(c => {
        const candidateName = c.candidate.name;
        const ans = c.attempt?.answers?.find(a => a.questionId === q.id);
        if (!ans || ans.selectedAnswer === null || ans.selectedAnswer === undefined) {
          unansweredCount++;
          candidatesSkipped.push(candidateName);
        } else {
          const chosen = Number(ans.selectedAnswer);
          if (chosen >= 0 && chosen < optionCounts.length) {
            optionCounts[chosen]++;
          }
          if (chosen === Number(q.correctAnswer)) {
            correctCount++;
            totalPoints += qMarks;
            candidatesCorrect.push(candidateName);
          } else {
            wrongCount++;
            totalPoints -= qNeg;
            candidatesWrong.push(candidateName);
          }
        }
      });

      const accuracy = totalAttemptsCount > 0 ? Math.round((correctCount / totalAttemptsCount) * 100) : 0;
      const wrongPct = totalAttemptsCount > 0 ? Math.round((wrongCount / totalAttemptsCount) * 100) : 0;
      const unansweredPct = totalAttemptsCount > 0 ? Math.round((unansweredCount / totalAttemptsCount) * 100) : 0;
      const avgPoints = totalAttemptsCount > 0 ? Number((totalPoints / totalAttemptsCount).toFixed(2)) : 0;

      let difficulty: 'Easy' | 'Moderate' | 'Challenging' = 'Moderate';
      let color = '#d97706'; // amber
      if (accuracy >= 75) {
        difficulty = 'Easy';
        color = '#059669'; // emerald
      } else if (accuracy < 50) {
        difficulty = 'Challenging';
        color = '#e11d48'; // rose
      }

      return {
        q,
        qNumber,
        qId: q.id,
        text: q.text,
        section,
        qMarks,
        qNeg,
        correctAnswer: q.correctAnswer,
        correctAnswerText: options[q.correctAnswer] || `Option ${q.correctAnswer + 1}`,
        options,
        optionCounts,
        totalAttempts: totalAttemptsCount,
        correctCount,
        wrongCount,
        unansweredCount,
        accuracy,
        wrongPct,
        unansweredPct,
        avgPoints,
        difficulty,
        color,
        candidatesCorrect,
        candidatesWrong,
        candidatesSkipped
      };
    });
  }, [exam.questions, attemptedAnalytics, exam.settings]);

  const questionSections = useMemo(() => {
    return Array.from(new Set(exam.questions?.map(q => q.section || 'General') || []));
  }, [exam.questions]);

  // Overall calculations
  const totalCandidates = candidates.length;
  const totalAttempts = attemptedAnalytics.length;
  
  const avgPercentage = totalAttempts > 0 
    ? (attemptedAnalytics.reduce((sum, c) => sum + c.percentage, 0) / totalAttempts).toFixed(1)
    : '0';
  const highestPercentage = totalAttempts > 0 
    ? Math.max(...attemptedAnalytics.map(c => c.percentage)).toFixed(1)
    : '0';
  const lowestPercentage = totalAttempts > 0 
    ? Math.min(...attemptedAnalytics.map(c => c.percentage)).toFixed(1)
    : '0';
  const passCount = attemptedAnalytics.filter(c => c.percentage >= 50).length;
  const passRate = totalAttempts > 0 ? ((passCount / totalAttempts) * 100).toFixed(1) : '0';
  const limitExceededCount = candidateAnalytics.filter(c => c.status === 'Limit Exceeded').length;

  // -------------------------------------------------------------
  // HIGH-DPI CANVAS PNG EXPORT
  // -------------------------------------------------------------
  const exportCanvasToPNG = (canvas: HTMLCanvasElement | null, chartTitle: string, filename: string) => {
    if (!canvas) {
      toast.error('Unable to export chart image');
      return;
    }

    try {
      const scale = 2;
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvas.width * scale;
      exportCanvas.height = (canvas.height + 100) * scale;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) return;

      ctx.scale(scale, scale);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, exportCanvas.width / scale, exportCanvas.height / scale);

      const headerGrad = ctx.createLinearGradient(0, 0, exportCanvas.width / scale, 0);
      headerGrad.addColorStop(0, '#064e3b');
      headerGrad.addColorStop(0.5, '#059669');
      headerGrad.addColorStop(1, '#10b981');
      ctx.fillStyle = headerGrad;
      ctx.fillRect(0, 0, exportCanvas.width / scale, 8);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 16px Inter, system-ui, sans-serif';
      ctx.fillText(chartTitle, 24, 38);

      ctx.fillStyle = '#059669';
      ctx.font = '12px Inter, system-ui, sans-serif';
      ctx.fillText(`Exam: ${exam.name} (Code: ${exam.code}) • Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 24, 58);

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(24, 72);
      ctx.lineTo(canvas.width - 24, 72);
      ctx.stroke();

      ctx.drawImage(canvas, 0, 78);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.fillText(`ATOM / QMS 3D Analytics Engine`, 24, canvas.height + 90);

      const dataUrl = exportCanvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${filename}_3D_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`Exported "${chartTitle}" as High-Res 3D PNG`);
    } catch (e) {
      console.error('Export error:', e);
      toast.error('Failed to export chart image');
    }
  };

  // -------------------------------------------------------------
  // 3D RENDERING ENGINE HELPERS
  // -------------------------------------------------------------
  const adjustColorBrightness = (hex: string, percent: number) => {
    if (!hex || typeof hex !== 'string') return '#059669';
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    let num = parseInt(cleanHex, 16);
    if (isNaN(num)) num = 0x059669;
    let r = (num >> 16) + Math.round(2.55 * percent);
    let g = ((num >> 8) & 0x00FF) + Math.round(2.55 * percent);
    let b = (num & 0x0000FF) + Math.round(2.55 * percent);
    return `rgb(${Math.min(255, Math.max(0, r))}, ${Math.min(255, Math.max(0, g))}, ${Math.min(255, Math.max(0, b))})`;
  };

  const draw3DBar = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    depth: number,
    colorHex: string,
    isHovered: boolean = false
  ) => {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(depth)) return;
    if (height <= 0 || width <= 0) return;

    try {
      const hoverLift = isHovered ? 6 : 0;
      const curY = y - hoverLift;
      const baseColor = isHovered ? adjustColorBrightness(colorHex, 20) : colorHex;

      // 1. Ambient Ground Shadow
      ctx.save();
      ctx.fillStyle = isHovered ? 'rgba(0, 0, 0, 0.22)' : 'rgba(0, 0, 0, 0.08)';
      ctx.beginPath();
      const rx = Math.max(1, width / 2 + depth / 3 + (isHovered ? 3 : 0));
      const ry = Math.max(1, depth / 2.2);
      ctx.ellipse(x + width / 2 + depth / 2, y + height + depth / 3, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2. Right Side 3D Face
      ctx.save();
      ctx.fillStyle = adjustColorBrightness(baseColor, -35);
      ctx.beginPath();
      ctx.moveTo(x + width, curY);
      ctx.lineTo(x + width + depth, curY - depth);
      ctx.lineTo(x + width + depth, curY + height - depth);
      ctx.lineTo(x + width, curY + height);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = isHovered ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.12)';
      ctx.lineWidth = isHovered ? 1.5 : 0.8;
      ctx.stroke();
      ctx.restore();

      // 3. Top 3D Face
      ctx.save();
      ctx.fillStyle = adjustColorBrightness(baseColor, 40);
      ctx.beginPath();
      ctx.moveTo(x, curY);
      ctx.lineTo(x + depth, curY - depth);
      ctx.lineTo(x + width + depth, curY - depth);
      ctx.lineTo(x + width, curY);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(255,255,255,0.6)';
      ctx.lineWidth = isHovered ? 2 : 1;
      ctx.stroke();
      ctx.restore();

      // 4. Front Face
      ctx.save();
      const frontGrad = ctx.createLinearGradient(x, curY, x + width, curY + height);
      frontGrad.addColorStop(0, adjustColorBrightness(baseColor, 15));
      frontGrad.addColorStop(1, adjustColorBrightness(baseColor, -15));
      ctx.fillStyle = frontGrad;
      ctx.beginPath();
      ctx.rect(x, curY, width, height);
      ctx.fill();
      ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(0,0,0,0.15)';
      ctx.lineWidth = isHovered ? 2 : 0.8;
      ctx.stroke();

      if (width > 6 && height > 4) {
        const glossGrad = ctx.createLinearGradient(x, curY, x + width * 0.45, curY);
        glossGrad.addColorStop(0, isHovered ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.38)');
        glossGrad.addColorStop(1, 'rgba(255,255,255,0.0)');
        ctx.fillStyle = glossGrad;
        ctx.fillRect(x + 1, curY + 1, width * 0.35, Math.max(1, height - 2));
      }

      if (isHovered) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 1, curY - 1, width + 2, height + 2);
      }

      ctx.restore();
    } catch (e) {
      console.warn('draw3DBar error:', e);
    }
  };

  const draw3DFloorGrid = (ctx: CanvasRenderingContext2D, width: number, floorY: number, depth: number) => {
    if (!Number.isFinite(width) || !Number.isFinite(floorY) || !Number.isFinite(depth)) return;
    ctx.save();
    
    const floorGrad = ctx.createLinearGradient(0, floorY - depth, 0, floorY);
    floorGrad.addColorStop(0, '#f1f5f9');
    floorGrad.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = floorGrad;
    
    ctx.beginPath();
    ctx.moveTo(35, floorY);
    ctx.lineTo(35 + depth, floorY - depth);
    ctx.lineTo(width - 35 + depth, floorY - depth);
    ctx.lineTo(width - 35, floorY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.stroke();

    const gridCount = 8;
    for (let i = 0; i <= gridCount; i++) {
      const gx = 35 + (i / gridCount) * (width - 70);
      ctx.beginPath();
      ctx.moveTo(gx, floorY);
      ctx.lineTo(gx + depth, floorY - depth);
      ctx.stroke();
    }

    ctx.restore();
  };

  const draw3DDonutChart = (
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
    thickness: number,
    innerRadius: number,
    data: { label: string; value: number; color: string; count?: number; percentStr?: string }[],
    hoveredIdx: number | null = null,
    hitStorage?: React.MutableRefObject<any[]>
  ) => {
    if (!Number.isFinite(centerX) || !Number.isFinite(centerY) || !Number.isFinite(radius) || radius <= 0) return;
    const safeData = data.filter(d => Number.isFinite(d.value) && d.value > 0);
    const total = safeData.reduce((sum, d) => sum + d.value, 0);

    if (hitStorage) hitStorage.current = [];

    if (!Number.isFinite(total) || total <= 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No data available', centerX, centerY);
      return;
    }

    try {
      const startAngleBase = -Math.PI / 2;
      const ySquish = 0.58;

      for (let t = thickness; t >= 0; t -= 2) {
        let currentAngle = startAngleBase;
        safeData.forEach((slice, sIdx) => {
          const sliceAngle = (slice.value / total) * Math.PI * 2;
          if (!Number.isFinite(sliceAngle) || sliceAngle <= 0) return;

          const isHovered = hoveredIdx === sIdx;
          const lift = isHovered ? 6 : 0;
          const darkShade = isHovered 
            ? adjustColorBrightness(slice.color, -10 - (t / thickness) * 15)
            : adjustColorBrightness(slice.color, -35 - (t / thickness) * 20);

          ctx.save();
          ctx.fillStyle = t === 0 ? (isHovered ? adjustColorBrightness(slice.color, 15) : slice.color) : darkShade;
          ctx.beginPath();
          ctx.ellipse(centerX, centerY + t - lift, radius, radius * ySquish, 0, currentAngle, currentAngle + sliceAngle);
          ctx.ellipse(centerX, centerY + t - lift, innerRadius, innerRadius * ySquish, 0, currentAngle + sliceAngle, currentAngle, true);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          currentAngle += sliceAngle;
        });
      }

      let currentAngle = startAngleBase;
      safeData.forEach((slice, sIdx) => {
        const sliceAngle = (slice.value / total) * Math.PI * 2;
        if (!Number.isFinite(sliceAngle) || sliceAngle <= 0) return;

        const isHovered = hoveredIdx === sIdx;
        const lift = isHovered ? 6 : 0;
        const curCY = centerY - lift;
        const midAngle = currentAngle + sliceAngle / 2;

        if (hitStorage) {
          hitStorage.current.push({
            startAngle: currentAngle,
            endAngle: currentAngle + sliceAngle,
            r: radius,
            innerR: innerRadius,
            cx: centerX,
            cy: curCY,
            data: slice,
            index: sIdx
          });
        }

        ctx.save();
        const topGrad = ctx.createRadialGradient(centerX, curCY, Math.max(0, innerRadius), centerX, curCY, Math.max(1, radius));
        topGrad.addColorStop(0, adjustColorBrightness(slice.color, isHovered ? 40 : 25));
        topGrad.addColorStop(1, isHovered ? adjustColorBrightness(slice.color, 15) : slice.color);
        ctx.fillStyle = topGrad;
        ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(255,255,255,0.7)';
        ctx.lineWidth = isHovered ? 2.5 : 1.2;

        ctx.beginPath();
        ctx.ellipse(centerX, curCY, radius, radius * ySquish, 0, currentAngle, currentAngle + sliceAngle);
        ctx.ellipse(centerX, curCY, innerRadius, innerRadius * ySquish, 0, currentAngle + sliceAngle, currentAngle, true);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        const labelDist = radius + 32;
        const lx = centerX + Math.cos(midAngle) * labelDist;
        const ly = curCY + Math.sin(midAngle) * (labelDist * ySquish);
        const percentStr = slice.percentStr || `${((slice.value / total) * 100).toFixed(1)}%`;

        ctx.fillStyle = isHovered ? '#047857' : '#0f172a';
        ctx.font = isHovered ? 'bold 12px Inter, sans-serif' : 'bold 11px Inter, sans-serif';
        ctx.textAlign = lx > centerX ? 'left' : 'right';
        ctx.fillText(`${slice.label}: ${slice.value} (${percentStr})`, lx, ly);

        ctx.strokeStyle = slice.color;
        ctx.lineWidth = isHovered ? 2.2 : 1.4;
        ctx.beginPath();
        ctx.moveTo(centerX + Math.cos(midAngle) * radius, curCY + Math.sin(midAngle) * (radius * ySquish));
        ctx.lineTo(lx, ly);
        ctx.stroke();

        currentAngle += sliceAngle;
      });

      ctx.fillStyle = '#064e3b';
      ctx.font = 'bold 22px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${total}`, centerX, centerY - 2);
      ctx.fillStyle = '#059669';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText('TOTAL', centerX, centerY + 16);
    } catch (e) {
      console.warn('draw3DDonutChart error:', e);
    }
  };

  // -------------------------------------------------------------
  // CANVAS DRAW HOOKS
  // -------------------------------------------------------------

  // 1. Score Distribution 3D Chart
  useEffect(() => {
    const render = () => {
      const canvas = scoreDistCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);
      scoreDistHitBoxes.current = [];

      const brackets = [
        { label: '0-20%', min: 0, max: 20, color: '#ef4444', desc: 'Needs Improvement' },
        { label: '21-40%', min: 21, max: 40, color: '#f97316', desc: 'Below Average' },
        { label: '41-60%', min: 41, max: 60, color: '#eab308', desc: 'Average' },
        { label: '61-80%', min: 61, max: 80, color: '#10b981', desc: 'Good' },
        { label: '81-100%', min: 81, max: 100, color: '#059669', desc: 'Outstanding' },
      ];

      const data = brackets.map(b => {
        const cands = attemptedAnalytics.filter(c => c.percentage >= b.min && c.percentage <= b.max);
        return { ...b, count: cands.length, cands };
      });

      const maxCount = Math.max(...data.map(d => d.count), 1);
      const floorY = height - 60;
      const chartHeight = height - 120;
      const depth = 24;

      draw3DFloorGrid(ctx, width, floorY, depth);

      const count = data.length;
      const barWidth = Math.max(24, Math.min(58, (width - 120) / count - 20));
      const spacing = (width - 120) / count;

      data.forEach((item, idx) => {
        const isHovered = hoveredScoreIdx === idx;
        const x = 60 + idx * spacing + (spacing - barWidth) / 2;
        const barH = maxCount > 0 ? (item.count / maxCount) * chartHeight : 0;
        const y = floorY - barH;

        scoreDistHitBoxes.current.push({
          x: x - 4,
          y: Math.min(floorY - 20, y - depth),
          w: barWidth + depth + 8,
          h: Math.max(30, barH + depth + 20),
          data: {
            title: `Score Range: ${item.label}`,
            valueText: `${item.count} Candidate${item.count !== 1 ? 's' : ''}`,
            color: item.color,
            details: [
              { label: 'Rating', value: item.desc },
              { label: 'Share', value: `${totalAttempts > 0 ? ((item.count / totalAttempts) * 100).toFixed(1) : 0}% of submissions` },
              { label: 'Score Range', value: `${item.min}% to ${item.max}%` },
            ]
          }
        });

        if (barH > 0) {
          draw3DBar(ctx, x, y, barWidth, barH, depth, item.color, isHovered);
        }

        ctx.fillStyle = isHovered ? '#047857' : '#0f172a';
        ctx.font = isHovered ? 'bold 14px Inter, sans-serif' : 'bold 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${item.count}`, x + barWidth / 2 + depth / 2, Math.min(floorY - 8, y - depth - (isHovered ? 12 : 6)));

        ctx.fillStyle = isHovered ? '#047857' : '#334155';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText(item.label, x + barWidth / 2, floorY + 18);

        ctx.fillStyle = '#64748b';
        ctx.font = '9px Inter, sans-serif';
        ctx.fillText(item.desc, x + barWidth / 2, floorY + 32);
      });
    };

    render();
    const animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [attemptedAnalytics, hoveredScoreIdx, totalAttempts, scoreDistView]);

  // 2. Section-wise 3D Analytics Chart
  useEffect(() => {
    const render = () => {
      const canvas = sectionCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);
      sectionHitBoxes.current = [];

      const sectionMap = new Map<string, { totalObtained: number; totalMax: number; count: number }>();
      attempts.forEach(a => {
        const secList = getSectionScoresData(a);
        if (Array.isArray(secList)) {
          secList.forEach(s => {
            const secName = s.section || 'General';
            const existing = sectionMap.get(secName) || { totalObtained: 0, totalMax: 0, count: 0 };
            existing.totalObtained += Number.isFinite(s.obtained) ? s.obtained : 0;
            existing.totalMax += Number.isFinite(s.total) ? s.total : 0;
            existing.count += 1;
            sectionMap.set(secName, existing);
          });
        }
      });

      const data = Array.from(sectionMap.entries()).map(([section, s]) => {
        const avgObt = s.count > 0 ? s.totalObtained / s.count : 0;
        const maxMarks = s.count > 0 ? s.totalMax / s.count : 1;
        const avgPct = maxMarks > 0 ? Math.round((avgObt / maxMarks) * 100) : 0;
        return { 
          section, 
          avgObt: Number.isFinite(avgObt) ? avgObt : 0, 
          maxMarks: Number.isFinite(maxMarks) ? maxMarks : 1, 
          avgPct: Number.isFinite(avgPct) ? avgPct : 0,
          attemptsCount: s.count
        };
      });

      if (data.length === 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '13px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No section-wise data available for this exam', width / 2, height / 2);
        return;
      }

      const floorY = height - 60;
      const chartHeight = height - 120;
      const depth = 22;

      draw3DFloorGrid(ctx, width, floorY, depth);

      const count = data.length;
      const barWidth = Math.max(18, Math.min(48, (width - 120) / count - (count > 8 ? 8 : 15)));
      const spacing = (width - 120) / count;
      const colors = ['#059669', '#2563eb', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#10b981', '#6366f1'];

      data.forEach((item, idx) => {
        const isHovered = hoveredSectionIdx === idx;
        const x = 60 + idx * spacing + (spacing - barWidth) / 2;
        const barH = (item.avgPct / 100) * chartHeight;
        const y = floorY - barH;
        const color = colors[idx % colors.length];

        sectionHitBoxes.current.push({
          x: x - 4,
          y: Math.min(floorY - 20, y - depth),
          w: barWidth + depth + 8,
          h: Math.max(30, barH + depth + 20),
          data: {
            title: `Section: ${item.section}`,
            valueText: `${item.avgPct}% Avg Accuracy`,
            color,
            details: [
              { label: 'Avg Marks', value: `${item.avgObt.toFixed(1)} / ${item.maxMarks.toFixed(0)} marks` },
              { label: 'Evaluated Attempts', value: item.attemptsCount },
              { label: 'Accuracy Band', value: item.avgPct >= 75 ? 'High' : item.avgPct >= 50 ? 'Moderate' : 'Needs Focus' }
            ]
          }
        });

        if (barH > 0) {
          draw3DBar(ctx, x, y, barWidth, barH, depth, color, isHovered);
        }

        ctx.fillStyle = isHovered ? '#047857' : '#0f172a';
        ctx.font = isHovered ? 'bold 13px Inter, sans-serif' : 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${item.avgPct}%`, x + barWidth / 2 + depth / 2, Math.min(floorY - 8, y - depth - (isHovered ? 10 : 6)));

        const maxChars = count > 8 ? 7 : 12;
        const displaySec = item.section.length > maxChars ? `${item.section.slice(0, maxChars - 2)}..` : item.section;
        ctx.fillStyle = isHovered ? '#047857' : '#0f172a';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.fillText(displaySec, x + barWidth / 2, floorY + 18);

        ctx.fillStyle = '#64748b';
        ctx.font = '9px Inter, sans-serif';
        ctx.fillText(`${item.avgObt.toFixed(1)}m`, x + barWidth / 2, floorY + 30);
      });
    };

    render();
    const animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [attempts, hoveredSectionIdx, getSectionScoresData, sectionView]);

  // 3. Pass vs Fail 3D Donut Chart
  useEffect(() => {
    const render = () => {
      const canvas = passFailCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const passed = passCount;
      const failed = Math.max(0, totalAttempts - passed);
      const unattempted = Math.max(0, totalCandidates - totalAttempts);

      const data = [
        { label: 'Passed (≥50%)', value: passed, color: '#059669', percentStr: `${totalAttempts > 0 ? ((passed / totalAttempts) * 100).toFixed(1) : 0}%` },
        { label: 'Failed (<50%)', value: failed, color: '#e11d48', percentStr: `${totalAttempts > 0 ? ((failed / totalAttempts) * 100).toFixed(1) : 0}%` },
      ];
      if (unattempted > 0) {
        data.push({ label: 'Not Attempted', value: unattempted, color: '#94a3b8', percentStr: `${totalCandidates > 0 ? ((unattempted / totalCandidates) * 100).toFixed(1) : 0}%` });
      }

      draw3DDonutChart(ctx, width / 2, height / 2 + 5, 95, 26, 52, data, hoveredPassFailIdx, passFailHitSlices);
    };

    render();
    const animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [passCount, totalAttempts, totalCandidates, hoveredPassFailIdx, passFailView]);

  // 4. Department Performance 3D Chart
  useEffect(() => {
    const render = () => {
      const canvas = deptCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);
      deptHitBoxes.current = [];

      const deptMap = new Map<string, { count: number; totalPct: number; passCount: number }>();
      candidateAnalytics.forEach(c => {
        const dept = c.department || 'General';
        const existing = deptMap.get(dept) || { count: 0, totalPct: 0, passCount: 0 };
        existing.count += 1;
        if (c.hasAttempted) {
          existing.totalPct += c.percentage;
          if (c.percentage >= 50) existing.passCount += 1;
        }
        deptMap.set(dept, existing);
      });

      const data = Array.from(deptMap.entries()).map(([dept, d]) => ({
        dept,
        count: d.count,
        avgPct: d.count > 0 ? Math.round(d.totalPct / d.count) : 0,
        passCount: d.passCount,
      }));

      if (data.length === 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '13px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No department data available', width / 2, height / 2);
        return;
      }

      const floorY = height - 60;
      const chartHeight = height - 120;
      const depth = 22;

      draw3DFloorGrid(ctx, width, floorY, depth);

      const count = data.length;
      const barWidth = Math.max(18, Math.min(50, (width - 120) / count - (count > 8 ? 8 : 15)));
      const spacing = (width - 120) / count;
      const colors = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#db2777', '#0891b2'];

      data.forEach((item, idx) => {
        const isHovered = hoveredDeptIdx === idx;
        const x = 60 + idx * spacing + (spacing - barWidth) / 2;
        const barH = (item.avgPct / 100) * chartHeight;
        const y = floorY - barH;
        const color = colors[idx % colors.length];

        deptHitBoxes.current.push({
          x: x - 4,
          y: Math.min(floorY - 20, y - depth),
          w: barWidth + depth + 8,
          h: Math.max(30, barH + depth + 20),
          data: {
            title: `Dept: ${item.dept}`,
            valueText: `${item.avgPct}% Avg Score`,
            color,
            details: [
              { label: 'Enrolled Candidates', value: item.count },
              { label: 'Passed Count', value: `${item.passCount} passed` },
              { label: 'Pass Rate', value: `${item.count > 0 ? ((item.passCount / item.count) * 100).toFixed(1) : 0}%` }
            ]
          }
        });

        if (barH > 0) {
          draw3DBar(ctx, x, y, barWidth, barH, depth, color, isHovered);
        }

        ctx.fillStyle = isHovered ? '#047857' : '#0f172a';
        ctx.font = isHovered ? 'bold 13px Inter, sans-serif' : 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${item.avgPct}%`, x + barWidth / 2 + depth / 2, Math.min(floorY - 8, y - depth - (isHovered ? 10 : 6)));

        const maxChars = count > 8 ? 6 : 10;
        const displayDept = item.dept.length > maxChars ? `${item.dept.slice(0, maxChars - 1)}..` : item.dept;
        ctx.fillStyle = isHovered ? '#047857' : '#0f172a';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.fillText(displayDept, x + barWidth / 2, floorY + 18);

        ctx.fillStyle = '#64748b';
        ctx.font = '9px Inter, sans-serif';
        ctx.fillText(`${item.count} cand.`, x + barWidth / 2, floorY + 30);
      });
    };

    render();
    const animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [candidateAnalytics, hoveredDeptIdx, deptView]);

  // 5. Anti-Cheat / Integrity 3D Analytics
  useEffect(() => {
    const render = () => {
      const canvas = integrityCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);
      integrityHitBoxes.current = [];

      const zeroSwitches = candidateAnalytics.filter(c => c.hasAttempted && c.tabSwitches === 0).length;
      const lowSwitches = candidateAnalytics.filter(c => c.hasAttempted && c.tabSwitches >= 1 && c.tabSwitches <= 2).length;
      const midSwitches = candidateAnalytics.filter(c => c.hasAttempted && c.tabSwitches >= 3 && c.tabSwitches <= 5).length;
      const highSwitches = candidateAnalytics.filter(c => c.hasAttempted && c.tabSwitches >= 6).length;

      const data = [
        { label: '0 Switches (Clean Focus)', count: zeroSwitches, color: '#059669', desc: '100% Proctored Integrity' },
        { label: '1-2 Minor Switches', count: lowSwitches, color: '#2563eb', desc: 'Acceptable Window Deviation' },
        { label: '3-5 Moderate Switches', count: midSwitches, color: '#f59e0b', desc: 'Warning Threshold Reached' },
        { label: '6+ Critical Violations', count: highSwitches, color: '#e11d48', desc: 'Limit Exceeded Flagged' },
      ];

      const maxCount = Math.max(...data.map(d => d.count), 1);
      const floorY = height - 60;
      const chartHeight = height - 120;
      const depth = 24;

      draw3DFloorGrid(ctx, width, floorY, depth);

      const count = data.length;
      const barWidth = Math.max(26, Math.min(58, (width - 120) / count - 20));
      const spacing = (width - 120) / count;

      data.forEach((item, idx) => {
        const isHovered = hoveredIntegrityIdx === idx;
        const x = 60 + idx * spacing + (spacing - barWidth) / 2;
        const barH = maxCount > 0 ? (item.count / maxCount) * chartHeight : 0;
        const y = floorY - barH;

        integrityHitBoxes.current.push({
          x: x - 4,
          y: Math.min(floorY - 20, y - depth),
          w: barWidth + depth + 8,
          h: Math.max(30, barH + depth + 20),
          data: {
            title: `Security Band: ${item.label}`,
            valueText: `${item.count} Candidate${item.count !== 1 ? 's' : ''}`,
            color: item.color,
            details: [
              { label: 'Proctoring Flag', value: item.desc },
              { label: 'Percentage', value: `${totalAttempts > 0 ? ((item.count / totalAttempts) * 100).toFixed(1) : 0}% of submissions` }
            ]
          }
        });

        if (barH > 0) {
          draw3DBar(ctx, x, y, barWidth, barH, depth, item.color, isHovered);
        }

        ctx.fillStyle = isHovered ? '#047857' : '#0f172a';
        ctx.font = isHovered ? 'bold 14px Inter, sans-serif' : 'bold 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${item.count}`, x + barWidth / 2 + depth / 2, Math.min(floorY - 8, y - depth - (isHovered ? 12 : 6)));

        ctx.fillStyle = isHovered ? '#047857' : '#0f172a';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText(item.label, x + barWidth / 2, floorY + 18);

        ctx.fillStyle = '#64748b';
        ctx.font = '9px Inter, sans-serif';
        ctx.fillText(item.desc, x + barWidth / 2, floorY + 32);
      });
    };

    render();
    const animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [candidateAnalytics, hoveredIntegrityIdx, totalAttempts, integrityView]);

  // 6. Custom Graph Builder Real-time Rendering
  useEffect(() => {
    const render = () => {
      const canvas = customCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);
      customHitBoxes.current = [];
      customHitSlices.current = [];

      const groups = new Map<string, { totalVal: number; count: number; items: any[] }>();

      candidateAnalytics.forEach(c => {
        let groupKey = 'Other';

        if (customDimension === 'department') {
          groupKey = c.department || 'General';
        } else if (customDimension === 'college') {
          groupKey = c.college ? (c.college.length > 15 ? `${c.college.slice(0, 12)}..` : c.college) : 'Default';
        } else if (customDimension === 'section') {
          groupKey = c.section ? `Sec ${c.section}` : 'General';
        } else if (customDimension === 'scoreBracket') {
          if (!c.hasAttempted) groupKey = 'Unattempted';
          else if (c.percentage >= 80) groupKey = '80-100%';
          else if (c.percentage >= 60) groupKey = '60-79%';
          else if (c.percentage >= 40) groupKey = '40-59%';
          else groupKey = '0-39%';
        } else if (customDimension === 'passFail') {
          groupKey = c.hasAttempted && c.percentage >= 50 ? 'Pass (≥50%)' : 'Fail (<50%)';
        } else if (customDimension === 'tabSwitches') {
          const sw = c.tabSwitches;
          groupKey = sw === 0 ? '0 Switches' : sw <= 2 ? '1-2 Switches' : '3+ Switches';
        }

        let metricVal = 0;
        if (customMetric === 'avgPercentage') metricVal = c.percentage;
        else if (customMetric === 'avgScore') metricVal = c.obtainedMarks;
        else if (customMetric === 'candidateCount') metricVal = 1;
        else if (customMetric === 'avgCorrect') metricVal = c.correctAnswers;
        else if (customMetric === 'avgWrong') metricVal = c.wrongAnswers;
        else if (customMetric === 'avgTabSwitches') metricVal = c.tabSwitches;

        const existing = groups.get(groupKey) || { totalVal: 0, count: 0, items: [] };
        existing.totalVal += Number.isFinite(metricVal) ? metricVal : 0;
        existing.count += 1;
        existing.items.push(c);
        groups.set(groupKey, existing);
      });

      const paletteMap = {
        emerald: ['#059669', '#10b981', '#34d399', '#047857', '#065f46'],
        blue: ['#2563eb', '#3b82f6', '#60a5fa', '#1d4ed8', '#1e40af'],
        amber: ['#d97706', '#f59e0b', '#fbbf24', '#b45309', '#78350f'],
        purple: ['#7c3aed', '#8b5cf6', '#a78bfa', '#6d28d9', '#4c1d95'],
        multi: ['#059669', '#2563eb', '#7c3aed', '#f59e0b', '#ec4899', '#06b6d4'],
      };
      const colors = paletteMap[customColorTheme] || paletteMap.emerald;

      const chartData = Array.from(groups.entries()).map(([label, g], i) => {
        let finalVal = 0;
        if (customMetric === 'candidateCount') {
          finalVal = g.count;
        } else if (g.count > 0) {
          finalVal = g.totalVal / g.count;
        }
        if (!Number.isFinite(finalVal)) finalVal = 0;

        return {
          label,
          value: Math.round(finalVal * 10) / 10,
          color: colors[i % colors.length],
          count: g.count,
        };
      });

      if (chartData.length === 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '13px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No data available for the selected custom dimensions', width / 2, height / 2);
        return;
      }

      if (customChartType === '3d-donut') {
        draw3DDonutChart(ctx, width / 2, height / 2 + 10, 110, 30, 58, chartData, hoveredCustomIdx, customHitSlices);
      } else {
        const maxVal = Math.max(...chartData.map(d => (Number.isFinite(d.value) ? d.value : 0)), 1);
        const floorY = height - 60;
        const chartHeight = height - 120;
        const depth = 24;

        draw3DFloorGrid(ctx, width, floorY, depth);

        const count = chartData.length;
        const barWidth = Math.max(20, Math.min(56, (width - 120) / count - (count > 8 ? 8 : 15)));
        const spacing = (width - 120) / count;

        chartData.forEach((item, idx) => {
          const isHovered = hoveredCustomIdx === idx;
          const val = Number.isFinite(item.value) ? item.value : 0;
          const x = 60 + idx * spacing + (spacing - barWidth) / 2;
          const barH = maxVal > 0 ? (val / maxVal) * chartHeight : 0;
          const y = floorY - barH;

          customHitBoxes.current.push({
            x: x - 4,
            y: Math.min(floorY - 20, y - depth),
            w: barWidth + depth + 8,
            h: Math.max(30, barH + depth + 20),
            data: {
              title: `${customDimension.toUpperCase()}: ${item.label}`,
              valueText: `${val}${customMetric === 'avgPercentage' ? '%' : ''} (${customMetric})`,
              color: item.color,
              details: [
                { label: 'Candidates in Group', value: item.count },
                { label: 'Selected Measure', value: customMetric }
              ]
            }
          });

          if (barH > 0) {
            draw3DBar(ctx, x, y, barWidth, barH, depth, item.color, isHovered);
          }

          ctx.fillStyle = isHovered ? '#047857' : '#0f172a';
          ctx.font = isHovered ? 'bold 14px Inter, sans-serif' : 'bold 12px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`${val}${customMetric === 'avgPercentage' ? '%' : ''}`, x + barWidth / 2 + depth / 2, Math.min(floorY - 8, y - depth - (isHovered ? 12 : 6)));

          const maxChars = count > 8 ? 6 : 12;
          const displayLabel = item.label.length > maxChars ? `${item.label.slice(0, maxChars - 2)}..` : item.label;
          ctx.fillStyle = isHovered ? '#047857' : '#0f172a';
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.fillText(displayLabel, x + barWidth / 2, floorY + 18);
        });
      }
    };

    render();
    const animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [candidateAnalytics, customChartType, customDimension, customMetric, customColorTheme, hoveredCustomIdx]);

  // 6. Question-wise 3D Column Chart
  useEffect(() => {
    const render = () => {
      const canvas = questionCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);
      questionHitBoxes.current = [];

      const filtered = questionSectionFilter === 'all'
        ? questionAnalytics
        : questionAnalytics.filter(q => q.section === questionSectionFilter);

      if (filtered.length === 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '13px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No questions found for the selected section filter', width / 2, height / 2);
        return;
      }

      const floorY = height - 65;
      const chartHeight = height - 130;
      const depth = 22;

      draw3DFloorGrid(ctx, width, floorY, depth);

      const count = filtered.length;
      const availableWidth = width - 120;
      const spacing = availableWidth / count;
      const barWidth = Math.max(16, Math.min(44, spacing - 14));

      filtered.forEach((item, idx) => {
        const isHovered = hoveredQuestionIdx === idx;
        const x = 60 + idx * spacing + (spacing - barWidth) / 2;

        let valuePct = item.accuracy;
        let valueLabel = `${item.accuracy}%`;
        if (questionMetric === 'correct') {
          valuePct = totalAttempts > 0 ? (item.correctCount / totalAttempts) * 100 : 0;
          valueLabel = `${item.correctCount}/${totalAttempts}`;
        } else if (questionMetric === 'avgScore') {
          valuePct = item.qMarks > 0 ? Math.max(0, Math.min(100, (item.avgPoints / item.qMarks) * 100)) : 0;
          valueLabel = `${item.avgPoints > 0 ? '+' : ''}${item.avgPoints}m`;
        }

        const barH = (Math.max(2, valuePct) / 100) * chartHeight;
        const y = floorY - barH;

        questionHitBoxes.current.push({
          x: x - 4,
          y: Math.min(floorY - 20, y - depth),
          w: barWidth + depth + 8,
          h: Math.max(30, barH + depth + 20),
          data: {
            title: `Q${item.qNumber}: ${item.section}`,
            valueText: `${item.accuracy}% Accuracy (${item.correctCount}/${item.totalAttempts} Correct)`,
            color: item.color,
            questionData: item,
            details: [
              { label: 'Question', value: item.text.length > 55 ? `${item.text.slice(0, 52)}...` : item.text },
              { label: 'Difficulty', value: item.difficulty },
              { label: 'Correct', value: `${item.correctCount} (${item.accuracy}%)` },
              { label: 'Incorrect', value: `${item.wrongCount} (${item.wrongPct}%)` },
              { label: 'Skipped', value: `${item.unansweredCount} (${item.unansweredPct}%)` },
              { label: 'Marks', value: `+${item.qMarks} / -${item.qNeg}` },
              { label: 'Avg Score', value: `${item.avgPoints} pts` },
              { label: 'Correct Ans', value: `Option ${item.correctAnswer + 1}: ${item.correctAnswerText.slice(0, 30)}` },
            ]
          }
        });

        draw3DBar(ctx, x, y, barWidth, barH, depth, item.color, isHovered);

        // Top value label
        ctx.fillStyle = isHovered ? '#047857' : '#0f172a';
        ctx.font = isHovered ? 'bold 12px Inter, sans-serif' : 'bold 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(valueLabel, x + barWidth / 2 + depth / 2, Math.min(floorY - 8, y - depth - (isHovered ? 10 : 5)));

        // Bottom Q-number label
        ctx.fillStyle = isHovered ? '#047857' : '#0f172a';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText(`Q${item.qNumber}`, x + barWidth / 2, floorY + 18);

        // Difficulty tag below Q#
        ctx.fillStyle = item.color;
        ctx.font = 'bold 9px Inter, sans-serif';
        const diffShort = item.difficulty === 'Challenging' ? 'Hard' : item.difficulty === 'Moderate' ? 'Med' : 'Easy';
        ctx.fillText(diffShort, x + barWidth / 2, floorY + 31);
      });
    };

    render();
    const animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [questionAnalytics, hoveredQuestionIdx, questionSectionFilter, questionMetric, totalAttempts, questionView]);

  // -------------------------------------------------------------
  // MOUSE INTERACTION HANDLERS
  // -------------------------------------------------------------
  const handleQuestionClick = (
    e: React.MouseEvent<HTMLCanvasElement>,
    canvasRef: React.RefObject<HTMLCanvasElement>,
    hitBoxes: React.MutableRefObject<{ x: number; y: number; w: number; h: number; data: any }[]>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    for (let i = 0; i < hitBoxes.current.length; i++) {
      const b = hitBoxes.current[i];
      if (mouseX >= b.x && mouseX <= b.x + b.w && mouseY >= b.y && mouseY <= b.y + b.h) {
        if (b.data?.questionData) {
          setSelectedQuestionForModal(b.data.questionData);
        }
        break;
      }
    }
  };

  const handleBarMouseMove = (
    e: React.MouseEvent<HTMLCanvasElement>,
    canvasRef: React.RefObject<HTMLCanvasElement>,
    hitBoxes: React.MutableRefObject<{ x: number; y: number; w: number; h: number; data: any }[]>,
    setHoverIdx: (idx: number | null) => void,
    setTooltip: React.Dispatch<React.SetStateAction<TooltipState>>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    let foundIdx: number | null = null;
    let foundData: any = null;

    for (let i = 0; i < hitBoxes.current.length; i++) {
      const b = hitBoxes.current[i];
      if (mouseX >= b.x && mouseX <= b.x + b.w && mouseY >= b.y && mouseY <= b.y + b.h) {
        foundIdx = i;
        foundData = b.data;
        break;
      }
    }

    setHoverIdx(foundIdx);

    if (foundIdx !== null && foundData) {
      setTooltip({
        visible: true,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        title: foundData.title,
        valueText: foundData.valueText,
        color: foundData.color,
        details: foundData.details || []
      });
    } else {
      setTooltip(prev => ({ ...prev, visible: false }));
    }
  };

  const handleDonutMouseMove = (
    e: React.MouseEvent<HTMLCanvasElement>,
    canvasRef: React.RefObject<HTMLCanvasElement>,
    hitSlices: React.MutableRefObject<any[]>,
    setHoverIdx: (idx: number | null) => void,
    setTooltip: React.Dispatch<React.SetStateAction<TooltipState>>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    let foundIdx: number | null = null;
    let foundData: any = null;

    for (let i = 0; i < hitSlices.current.length; i++) {
      const s = hitSlices.current[i];
      const dx = mouseX - s.cx;
      const dy = (mouseY - s.cy) / 0.58;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist >= s.innerR - 8 && dist <= s.r + 14) {
        let angle = Math.atan2(dy, dx);
        if (angle < -Math.PI / 2) angle += Math.PI * 2;
        if (angle >= s.startAngle && angle <= s.endAngle) {
          foundIdx = s.index;
          foundData = s.data;
          break;
        }
      }
    }

    setHoverIdx(foundIdx);

    if (foundIdx !== null && foundData) {
      setTooltip({
        visible: true,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        title: foundData.label,
        valueText: `${foundData.value} (${foundData.percentStr || ''})`,
        color: foundData.color,
        details: [
          { label: 'Category', value: foundData.label },
          { label: 'Value / Count', value: foundData.value },
        ]
      });
    } else {
      setTooltip(prev => ({ ...prev, visible: false }));
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ------------------------------------------------------------- */}
      {/* OVERVIEW QUICK METRICS BANNER */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <Card className="bg-gradient-to-br from-emerald-600 to-emerald-800 text-white shadow-md border-0">
          <CardContent className="p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-emerald-100 uppercase tracking-wider">Avg Score %</span>
            <span className="text-2xl font-black mt-1">{avgPercentage}%</span>
            <span className="text-[10px] text-emerald-200 mt-1">Across {totalAttempts} submissions</span>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-md border-0">
          <CardContent className="p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-blue-100 uppercase tracking-wider">Pass Rate</span>
            <span className="text-2xl font-black mt-1">{passRate}%</span>
            <span className="text-[10px] text-blue-200 mt-1">{passCount} passed (≥50%)</span>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-600 to-purple-800 text-white shadow-md border-0">
          <CardContent className="p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-purple-100 uppercase tracking-wider">Top Score</span>
            <span className="text-2xl font-black mt-1">{highestPercentage}%</span>
            <span className="text-[10px] text-purple-200 mt-1">Lowest: {lowestPercentage}%</span>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-600 to-amber-800 text-white shadow-md border-0">
          <CardContent className="p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-amber-100 uppercase tracking-wider">Submissions</span>
            <span className="text-2xl font-black mt-1">{totalAttempts}</span>
            <span className="text-[10px] text-amber-200 mt-1">{totalCandidates} total candidates</span>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-teal-600 to-teal-800 text-white shadow-md border-0">
          <CardContent className="p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-teal-100 uppercase tracking-wider">Sections</span>
            <span className="text-2xl font-black mt-1">{new Set(exam.questions.map(q => q.section || 'General')).size}</span>
            <span className="text-[10px] text-teal-200 mt-1">{exam.questions.length} total questions</span>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-600 to-rose-800 text-white shadow-md border-0">
          <CardContent className="p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-rose-100 uppercase tracking-wider">Limit Exceeded</span>
            <span className="text-2xl font-black mt-1">{limitExceededCount}</span>
            <span className="text-[10px] text-rose-200 mt-1">Tab violation submits</span>
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3D GRAPH CARDS GRID */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* ⭐ QUESTION-WISE 3D COLUMN ANALYSIS CARD ⭐ */}
        <Card className="col-span-1 lg:col-span-2 border-emerald-300 shadow-lg overflow-hidden bg-white relative">
          <CardHeader className="bg-white pb-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-emerald-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-emerald-600 text-white font-bold text-[11px] px-2 py-0.5 shadow-2xs">
                  Question-Level Intelligence
                </Badge>
                <span className="text-xs font-semibold text-emerald-800">
                  {questionAnalytics.length} Questions Evaluated
                </span>
              </div>
              <CardTitle className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-emerald-700" />
                3D Column Question-Wise Performance Analysis
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Interactive isometric columns representing question accuracy, difficulty rating, and candidate response distribution
              </CardDescription>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Section Filter */}
              {questionSections.length > 1 && (
                <div className="flex items-center gap-1.5 bg-gray-50/90 border border-gray-200 rounded-lg px-2 py-1 text-xs">
                  <Filter className="h-3.5 w-3.5 text-emerald-700" />
                  <span className="text-muted-foreground text-[11px]">Section:</span>
                  <select
                    value={questionSectionFilter}
                    onChange={(e) => setQuestionSectionFilter(e.target.value)}
                    className="bg-transparent font-bold text-gray-900 focus:outline-none cursor-pointer text-xs"
                  >
                    <option value="all">All Sections ({questionAnalytics.length})</option>
                    {questionSections.map(sec => (
                      <option key={sec} value={sec}>
                        {sec} ({questionAnalytics.filter(q => q.section === sec).length})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Metric Toggle */}
              <div className="flex items-center gap-1.5 bg-gray-50/90 border border-gray-200 rounded-lg px-2 py-1 text-xs">
                <span className="text-muted-foreground text-[11px]">Metric:</span>
                <select
                  value={questionMetric}
                  onChange={(e) => setQuestionMetric(e.target.value as any)}
                  className="bg-transparent font-bold text-gray-900 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="accuracy">Accuracy %</option>
                  <option value="correct">Correct Count</option>
                  <option value="avgScore">Average Marks</option>
                </select>
              </div>

              {/* View Toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuestionView(questionView === '3d-bar' ? 'table' : '3d-bar')}
                className={`h-7 px-2.5 text-xs font-semibold transition-all ${
                  questionView === 'table'
                    ? 'bg-[#008037] text-white hover:bg-[#00682c] shadow-xs border-[#008037]'
                    : 'bg-white border-emerald-300 text-emerald-900 hover:bg-emerald-50 shadow-2xs'
                }`}
              >
                {questionView === '3d-bar' ? (
                  <>
                    <TableIcon className="h-3.5 w-3.5 mr-1" /> Table View
                  </>
                ) : (
                  <>
                    <BarChart3 className="h-3.5 w-3.5 mr-1" /> 3D Graph
                  </>
                )}
              </Button>

              {/* PNG Export */}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportCanvasToPNG(
                    questionCanvasRef.current,
                    'Question-wise Performance Analysis (3D Chart)',
                    'Question_Wise_Analysis'
                  )
                }
                className="h-7 px-2 gap-1 text-xs bg-white border-emerald-300 text-emerald-900 hover:bg-emerald-50 shadow-2xs"
              >
                <Download className="h-3.5 w-3.5" /> PNG
              </Button>

              {/* Complete PDF Report Export */}
              <Button
                size="sm"
                onClick={async () => {
                  const toastId = toast.loading('Generating comprehensive exam PDF report...');
                  try {
                    await exportExamDetailedPdfReport(exam, candidates, results, attempts);
                    toast.success('Complete PDF Report downloaded successfully!', { id: toastId });
                  } catch (err) {
                    console.error('PDF generation error:', err);
                    toast.error('Failed to generate PDF report: ' + ((err as Error).message || 'Unknown error'), { id: toastId });
                  }
                }}
                className="h-7 px-2.5 gap-1.5 text-xs bg-[#008037] text-white hover:bg-black font-bold shadow-xs cursor-pointer inline-flex items-center"
              >
                <FileText className="h-3.5 w-3.5 text-white" />
                <span className="text-white font-bold">PDF Report</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-4 relative">
            {/* Quick Legend Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-2 border-b border-emerald-100 text-xs">
              <div className="flex items-center gap-4">
                <span className="font-bold text-gray-700 text-[11px]">Difficulty Tiers:</span>
                <span className="flex items-center gap-1.5 text-emerald-800 font-semibold text-[11px]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#059669]" />
                  Easy (≥75% Accuracy)
                </span>
                <span className="flex items-center gap-1.5 text-amber-800 font-semibold text-[11px]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#d97706]" />
                  Moderate (50-74%)
                </span>
                <span className="flex items-center gap-1.5 text-rose-800 font-semibold text-[11px]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#e11d48]" />
                  Challenging (&lt;50%)
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground italic">
                Tip: Click any 3D column or table row to inspect choice distribution
              </span>
            </div>

            {/* 3D Canvas View */}
            <div className={questionView === '3d-bar' ? 'w-full overflow-x-auto relative pb-2' : 'hidden'}>
              <div className="min-w-fit flex items-center justify-center relative mx-auto">
                <canvas
                  ref={questionCanvasRef}
                  width={Math.max(860, (questionSectionFilter === 'all' ? questionAnalytics.length : questionAnalytics.filter(q => q.section === questionSectionFilter).length) * 68)}
                  height={350}
                  onMouseMove={(e) =>
                    handleBarMouseMove(
                      e,
                      questionCanvasRef,
                      questionHitBoxes,
                      setHoveredQuestionIdx,
                      setQuestionTooltip
                    )
                  }
                  onMouseLeave={() => {
                    setHoveredQuestionIdx(null);
                    setQuestionTooltip((prev) => ({ ...prev, visible: false }));
                  }}
                  onClick={(e) => handleQuestionClick(e, questionCanvasRef, questionHitBoxes)}
                  className="rounded-lg cursor-pointer"
                />

                {/* 3D Tooltip */}
                {questionTooltip.visible && (
                  <div
                    className="absolute pointer-events-none z-30 bg-slate-950/95 backdrop-blur-md text-white p-3.5 rounded-xl shadow-2xl border border-emerald-500/50 text-xs transform -translate-x-1/2 -translate-y-full mb-3 min-w-[240px] max-w-[320px]"
                    style={{ left: questionTooltip.x, top: questionTooltip.y }}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-emerald-400 mb-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: questionTooltip.color }}
                      />
                      {questionTooltip.title}
                    </div>
                    <div className="text-base font-extrabold text-white mb-1.5">
                      {questionTooltip.valueText}
                    </div>
                    <div className="space-y-1 border-t border-slate-700/80 pt-1.5 text-[11px] text-slate-300">
                      {questionTooltip.details.map((d, i) => (
                        <div key={i} className="flex justify-between gap-3">
                          <span className="text-slate-400 shrink-0">{d.label}:</span>
                          <span className="font-semibold text-white truncate text-right">
                            {d.value}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 pt-1 border-t border-slate-800 text-[10px] text-emerald-300 text-center font-semibold">
                      Click column to inspect choice breakdown
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Table View */}
            <div className={questionView === 'table' ? 'overflow-x-auto block' : 'hidden'}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-emerald-100/80 text-emerald-950 font-bold border-b border-emerald-200">
                    <th className="py-2.5 px-3 text-center w-12">Q#</th>
                    <th className="py-2.5 px-3 text-left">Section</th>
                    <th className="py-2.5 px-3 text-left min-w-[200px]">Question Preview</th>
                    <th className="py-2.5 px-3 text-center">Difficulty</th>
                    <th className="py-2.5 px-3 text-center">Correct</th>
                    <th className="py-2.5 px-3 text-center">Wrong</th>
                    <th className="py-2.5 px-3 text-center">Skipped</th>
                    <th className="py-2.5 px-3 text-center">Accuracy</th>
                    <th className="py-2.5 px-3 text-center">Avg Score</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100">
                  {(questionSectionFilter === 'all'
                    ? questionAnalytics
                    : questionAnalytics.filter((q) => q.section === questionSectionFilter)
                  ).map((q) => (
                    <tr
                      key={q.qId}
                      className="hover:bg-emerald-50/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedQuestionForModal(q)}
                    >
                      <td className="py-2.5 px-3 text-center font-bold text-emerald-800">
                        Q{q.qNumber}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-gray-800">
                        <span className="bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px]">
                          {q.section}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-900 max-w-[280px] truncate" title={q.text}>
                        {q.text}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge
                          className={`text-[10px] py-0.5 px-2 ${
                            q.difficulty === 'Easy'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : q.difficulty === 'Challenging'
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}
                        >
                          {q.difficulty}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-emerald-700">
                        {q.correctCount} <span className="text-[10px] text-gray-500 font-normal">({q.accuracy}%)</span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-rose-600">
                        {q.wrongCount} <span className="text-[10px] text-gray-500 font-normal">({q.wrongPct}%)</span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-semibold text-gray-600">
                        {q.unansweredCount}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-2 rounded-full"
                              style={{
                                width: `${q.accuracy}%`,
                                backgroundColor: q.color
                              }}
                            />
                          </div>
                          <span className="font-extrabold text-xs" style={{ color: q.color }}>
                            {q.accuracy}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-gray-900">
                        {q.avgPoints > 0 ? `+${q.avgPoints}` : q.avgPoints} / {q.qMarks}
                      </td>
                      <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          onClick={() => setSelectedQuestionForModal(q)}
                          className="h-6 px-2.5 text-[11px] font-bold text-white bg-[#008037] hover:bg-black border border-[#008037] shadow-xs gap-1 inline-flex items-center justify-center rounded-md cursor-pointer transition-colors"
                        >
                          <Eye className="h-3 w-3 text-white" />
                          <span className="text-white font-bold">Inspect</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 1. Score Distribution 3D Bar Chart */}
        <Card className="border-emerald-200 shadow-md overflow-hidden bg-white relative">
          <CardHeader className="bg-white pb-3 flex flex-row items-center justify-between border-b border-emerald-100">
            <div>
              <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-emerald-700" />
                3D Score Distribution
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Candidate count grouped by score percentage brackets
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setScoreDistView(scoreDistView === '3d-bar' ? 'table' : '3d-bar')}
                className={`h-7 px-2.5 text-xs font-semibold transition-all ${
                  scoreDistView === 'table'
                    ? 'bg-[#008037] text-white hover:bg-[#00682c] shadow-xs border-[#008037]'
                    : 'bg-white border-emerald-300 text-emerald-900 hover:bg-emerald-50 shadow-2xs'
                }`}
              >
                {scoreDistView === '3d-bar' ? <TableIcon className="h-3.5 w-3.5 mr-1" /> : <BarChart3 className="h-3.5 w-3.5 mr-1" />}
                {scoreDistView === '3d-bar' ? 'Table View' : '3D Graph'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportCanvasToPNG(scoreDistCanvasRef.current, 'Score Distribution (3D Chart)', 'Score_Distribution')}
                className="h-7 px-2 gap-1 text-xs bg-white border-emerald-300 text-emerald-900 hover:bg-emerald-50 shadow-2xs"
              >
                <Download className="h-3.5 w-3.5" /> PNG
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 relative">
            {/* Always mounted canvas container */}
            <div className={scoreDistView === '3d-bar' ? 'w-full flex items-center justify-center relative' : 'hidden'}>
              <canvas
                ref={scoreDistCanvasRef}
                width={560}
                height={320}
                onMouseMove={(e) => handleBarMouseMove(e, scoreDistCanvasRef, scoreDistHitBoxes, setHoveredScoreIdx, setScoreTooltip)}
                onMouseLeave={() => { setHoveredScoreIdx(null); setScoreTooltip(prev => ({ ...prev, visible: false })); }}
                className="max-w-full h-auto rounded-lg cursor-pointer"
              />
              {scoreTooltip.visible && (
                <div
                  className="absolute pointer-events-none z-30 bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-xl shadow-2xl border border-emerald-500/40 text-xs transform -translate-x-1/2 -translate-y-full mb-3"
                  style={{ left: scoreTooltip.x, top: scoreTooltip.y }}
                >
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: scoreTooltip.color }} />
                    {scoreTooltip.title}
                  </div>
                  <div className="text-base font-extrabold text-white mb-1.5">{scoreTooltip.valueText}</div>
                  <div className="space-y-0.5 border-t border-slate-700/80 pt-1 text-[11px] text-slate-300">
                    {scoreTooltip.details.map((d, i) => (
                      <div key={i} className="flex justify-between gap-3">
                        <span className="text-slate-400">{d.label}:</span>
                        <span className="font-semibold text-white">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Table Container */}
            <div className={scoreDistView === 'table' ? 'overflow-x-auto block' : 'hidden'}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-emerald-50 text-emerald-950 font-bold border-b">
                    <th className="py-2.5 px-3 text-left">Bracket</th>
                    <th className="py-2.5 px-3 text-left">Performance</th>
                    <th className="py-2.5 px-3 text-center">Candidates</th>
                    <th className="py-2.5 px-3 text-center">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100">
                  {[
                    { b: '0-20%', d: 'Needs Improvement', min: 0, max: 20 },
                    { b: '21-40%', d: 'Below Average', min: 21, max: 40 },
                    { b: '41-60%', d: 'Average', min: 41, max: 60 },
                    { b: '61-80%', d: 'Good', min: 61, max: 80 },
                    { b: '81-100%', d: 'Outstanding', min: 81, max: 100 },
                  ].map(row => {
                    const count = attemptedAnalytics.filter(c => c.percentage >= row.min && c.percentage <= row.max).length;
                    return (
                      <tr key={row.b} className="hover:bg-emerald-50/40">
                        <td className="py-2 px-3 font-semibold">{row.b}</td>
                        <td className="py-2 px-3 text-gray-700">{row.d}</td>
                        <td className="py-2 px-3 text-center font-bold text-emerald-800">{count}</td>
                        <td className="py-2 px-3 text-center text-gray-600">{totalAttempts > 0 ? ((count / totalAttempts) * 100).toFixed(1) : 0}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 2. Section-wise 3D Performance Chart */}
        <Card className="border-emerald-200 shadow-md overflow-hidden bg-white relative">
          <CardHeader className="bg-white pb-3 flex flex-row items-center justify-between border-b border-emerald-100">
            <div>
              <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-700" />
                3D Section-wise Accuracy
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Average accuracy and score achieved per exam section
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSectionView(sectionView === '3d-bar' ? 'table' : '3d-bar')}
                className={`h-7 px-2.5 text-xs font-semibold transition-all ${
                  sectionView === 'table'
                    ? 'bg-[#008037] text-white hover:bg-[#00682c] shadow-xs border-[#008037]'
                    : 'bg-white border-emerald-300 text-emerald-900 hover:bg-emerald-50 shadow-2xs'
                }`}
              >
                {sectionView === '3d-bar' ? <TableIcon className="h-3.5 w-3.5 mr-1" /> : <BarChart3 className="h-3.5 w-3.5 mr-1" />}
                {sectionView === '3d-bar' ? 'Table View' : '3D Graph'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportCanvasToPNG(sectionCanvasRef.current, 'Section-wise Performance (3D Chart)', 'Section_Performance')}
                className="h-7 px-2 gap-1 text-xs bg-white border-emerald-300 text-emerald-900 hover:bg-emerald-50 shadow-2xs"
              >
                <Download className="h-3.5 w-3.5" /> PNG
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 relative">
            <div className={sectionView === '3d-bar' ? 'w-full flex items-center justify-center relative' : 'hidden'}>
              <canvas
                ref={sectionCanvasRef}
                width={560}
                height={320}
                onMouseMove={(e) => handleBarMouseMove(e, sectionCanvasRef, sectionHitBoxes, setHoveredSectionIdx, setSectionTooltip)}
                onMouseLeave={() => { setHoveredSectionIdx(null); setSectionTooltip(prev => ({ ...prev, visible: false })); }}
                className="max-w-full h-auto rounded-lg cursor-pointer"
              />
              {sectionTooltip.visible && (
                <div
                  className="absolute pointer-events-none z-30 bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-xl shadow-2xl border border-emerald-500/40 text-xs transform -translate-x-1/2 -translate-y-full mb-3"
                  style={{ left: sectionTooltip.x, top: sectionTooltip.y }}
                >
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sectionTooltip.color }} />
                    {sectionTooltip.title}
                  </div>
                  <div className="text-base font-extrabold text-white mb-1.5">{sectionTooltip.valueText}</div>
                  <div className="space-y-0.5 border-t border-slate-700/80 pt-1 text-[11px] text-slate-300">
                    {sectionTooltip.details.map((d, i) => (
                      <div key={i} className="flex justify-between gap-3">
                        <span className="text-slate-400">{d.label}:</span>
                        <span className="font-semibold text-white">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className={sectionView === 'table' ? 'overflow-x-auto block' : 'hidden'}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-emerald-50 text-emerald-950 font-bold border-b">
                    <th className="py-2.5 px-3 text-left">Section</th>
                    <th className="py-2.5 px-3 text-center">Evaluated</th>
                    <th className="py-2.5 px-3 text-center">Accuracy %</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100">
                  {Array.from(new Set(exam.questions.map(q => q.section || 'General'))).map(secName => {
                    const relevantScores: number[] = [];
                    attempts.forEach(a => {
                      const secList = getSectionScoresData(a);
                      const match = secList.find(s => s.section === secName);
                      if (match) relevantScores.push(match.percent);
                    });
                    const avg = relevantScores.length > 0 ? Math.round(relevantScores.reduce((a, b) => a + b, 0) / relevantScores.length) : 0;
                    return (
                      <tr key={secName} className="hover:bg-emerald-50/40">
                        <td className="py-2 px-3 font-semibold text-gray-900">{secName}</td>
                        <td className="py-2 px-3 text-center font-mono">{relevantScores.length} attempts</td>
                        <td className="py-2 px-3 text-center font-bold text-emerald-700">{avg}%</td>
                        <td className="py-2 px-3 text-center">
                          <Badge variant={avg >= 50 ? 'default' : 'destructive'} className="text-[10px]">
                            {avg >= 50 ? 'Satisfactory' : 'Needs Review'}
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

        {/* 3. Pass vs Fail 3D Donut Chart */}
        <Card className="border-emerald-200 shadow-md overflow-hidden bg-white relative">
          <CardHeader className="bg-white pb-3 flex flex-row items-center justify-between border-b border-emerald-100">
            <div>
              <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-emerald-700" />
                3D Pass vs Fail Rate
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Overall qualification proportion (Pass threshold ≥50%)
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPassFailView(passFailView === '3d-donut' ? 'table' : '3d-donut')}
                className={`h-7 px-2.5 text-xs font-semibold transition-all ${
                  passFailView === 'table'
                    ? 'bg-[#008037] text-white hover:bg-[#00682c] shadow-xs border-[#008037]'
                    : 'bg-white border-emerald-300 text-emerald-900 hover:bg-emerald-50 shadow-2xs'
                }`}
              >
                {passFailView === '3d-donut' ? <TableIcon className="h-3.5 w-3.5 mr-1" /> : <PieChartIcon className="h-3.5 w-3.5 mr-1" />}
                {passFailView === '3d-donut' ? 'Table View' : '3D Donut'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportCanvasToPNG(passFailCanvasRef.current, 'Pass vs Fail Rate (3D Donut)', 'Pass_Fail_Rate')}
                className="h-7 px-2 gap-1 text-xs bg-white border-emerald-300 text-emerald-900 hover:bg-emerald-50 shadow-2xs"
              >
                <Download className="h-3.5 w-3.5" /> PNG
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 relative">
            <div className={passFailView === '3d-donut' ? 'w-full flex items-center justify-center relative' : 'hidden'}>
              <canvas
                ref={passFailCanvasRef}
                width={560}
                height={320}
                onMouseMove={(e) => handleDonutMouseMove(e, passFailCanvasRef, passFailHitSlices, setHoveredPassFailIdx, setPassFailTooltip)}
                onMouseLeave={() => { setHoveredPassFailIdx(null); setPassFailTooltip(prev => ({ ...prev, visible: false })); }}
                className="max-w-full h-auto rounded-lg cursor-pointer"
              />
              {passFailTooltip.visible && (
                <div
                  className="absolute pointer-events-none z-30 bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-xl shadow-2xl border border-emerald-500/40 text-xs transform -translate-x-1/2 -translate-y-full mb-3"
                  style={{ left: passFailTooltip.x, top: passFailTooltip.y }}
                >
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: passFailTooltip.color }} />
                    {passFailTooltip.title}
                  </div>
                  <div className="text-base font-extrabold text-white mb-1.5">{passFailTooltip.valueText}</div>
                </div>
              )}
            </div>

            <div className={passFailView === 'table' ? 'overflow-x-auto block' : 'hidden'}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-emerald-50 text-emerald-950 font-bold border-b">
                    <th className="py-2.5 px-3 text-left">Status</th>
                    <th className="py-2.5 px-3 text-center">Criteria</th>
                    <th className="py-2.5 px-3 text-center">Candidates</th>
                    <th className="py-2.5 px-3 text-center">Percentage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100">
                  <tr className="hover:bg-emerald-50/40">
                    <td className="py-2 px-3 font-semibold text-emerald-800">Passed</td>
                    <td className="py-2 px-3 text-center font-mono">Score ≥ 50%</td>
                    <td className="py-2 px-3 text-center font-bold text-emerald-700">{passCount}</td>
                    <td className="py-2 px-3 text-center font-semibold text-emerald-700">{passRate}%</td>
                  </tr>
                  <tr className="hover:bg-rose-50/40">
                    <td className="py-2 px-3 font-semibold text-rose-800">Failed</td>
                    <td className="py-2 px-3 text-center font-mono">Score &lt; 50%</td>
                    <td className="py-2 px-3 text-center font-bold text-rose-700">{Math.max(0, totalAttempts - passCount)}</td>
                    <td className="py-2 px-3 text-center font-semibold text-rose-700">
                      {totalAttempts > 0 ? (((totalAttempts - passCount) / totalAttempts) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50/40">
                    <td className="py-2 px-3 font-semibold text-gray-700">Not Attempted</td>
                    <td className="py-2 px-3 text-center font-mono">No submission</td>
                    <td className="py-2 px-3 text-center font-bold text-gray-700">{Math.max(0, totalCandidates - totalAttempts)}</td>
                    <td className="py-2 px-3 text-center font-semibold text-gray-600">
                      {totalCandidates > 0 ? (((totalCandidates - totalAttempts) / totalCandidates) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 4. Department Performance 3D Chart */}
        <Card className="border-emerald-200 shadow-md overflow-hidden bg-white relative">
          <CardHeader className="bg-white pb-3 flex flex-row items-center justify-between border-b border-emerald-100">
            <div>
              <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Layers className="h-4 w-4 text-emerald-700" />
                3D Department-wise Performance
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Average percentage comparison by candidate department
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeptView(deptView === '3d-bar' ? 'table' : '3d-bar')}
                className={`h-7 px-2.5 text-xs font-semibold transition-all ${
                  deptView === 'table'
                    ? 'bg-[#008037] text-white hover:bg-[#00682c] shadow-xs border-[#008037]'
                    : 'bg-white border-emerald-300 text-emerald-900 hover:bg-emerald-50 shadow-2xs'
                }`}
              >
                {deptView === '3d-bar' ? <TableIcon className="h-3.5 w-3.5 mr-1" /> : <BarChart3 className="h-3.5 w-3.5 mr-1" />}
                {deptView === '3d-bar' ? 'Table View' : '3D Graph'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportCanvasToPNG(deptCanvasRef.current, 'Department Performance (3D Chart)', 'Department_Performance')}
                className="h-7 px-2 gap-1 text-xs bg-white border-emerald-300 text-emerald-900 hover:bg-emerald-50 shadow-2xs"
              >
                <Download className="h-3.5 w-3.5" /> PNG
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 relative">
            <div className={deptView === '3d-bar' ? 'w-full flex items-center justify-center relative' : 'hidden'}>
              <canvas
                ref={deptCanvasRef}
                width={560}
                height={320}
                onMouseMove={(e) => handleBarMouseMove(e, deptCanvasRef, deptHitBoxes, setHoveredDeptIdx, setDeptTooltip)}
                onMouseLeave={() => { setHoveredDeptIdx(null); setDeptTooltip(prev => ({ ...prev, visible: false })); }}
                className="max-w-full h-auto rounded-lg cursor-pointer"
              />
              {deptTooltip.visible && (
                <div
                  className="absolute pointer-events-none z-30 bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-xl shadow-2xl border border-emerald-500/40 text-xs transform -translate-x-1/2 -translate-y-full mb-3"
                  style={{ left: deptTooltip.x, top: deptTooltip.y }}
                >
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: deptTooltip.color }} />
                    {deptTooltip.title}
                  </div>
                  <div className="text-base font-extrabold text-white mb-1.5">{deptTooltip.valueText}</div>
                  <div className="space-y-0.5 border-t border-slate-700/80 pt-1 text-[11px] text-slate-300">
                    {deptTooltip.details.map((d, i) => (
                      <div key={i} className="flex justify-between gap-3">
                        <span className="text-slate-400">{d.label}:</span>
                        <span className="font-semibold text-white">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className={deptView === 'table' ? 'overflow-x-auto block' : 'hidden'}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-emerald-50 text-emerald-950 font-bold border-b">
                    <th className="py-2.5 px-3 text-left">Department</th>
                    <th className="py-2.5 px-3 text-center">Candidates</th>
                    <th className="py-2.5 px-3 text-center">Avg Score %</th>
                    <th className="py-2.5 px-3 text-center">Pass Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100">
                  {Array.from(new Set(candidateAnalytics.map(c => c.department))).map(dept => {
                    const deptCands = candidateAnalytics.filter(c => c.department === dept);
                    const attempted = deptCands.filter(c => c.hasAttempted);
                    const avg = attempted.length > 0 ? Math.round(attempted.reduce((s, c) => s + c.percentage, 0) / attempted.length) : 0;
                    const passC = attempted.filter(c => c.percentage >= 50).length;
                    return (
                      <tr key={dept} className="hover:bg-emerald-50/40">
                        <td className="py-2 px-3 font-semibold text-gray-900">{dept}</td>
                        <td className="py-2 px-3 text-center font-mono">{deptCands.length}</td>
                        <td className="py-2 px-3 text-center font-bold text-emerald-700">{avg}%</td>
                        <td className="py-2 px-3 text-center text-gray-700">{passC} / {attempted.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 5. Anti-Cheating & Tab Switch 3D Analysis */}
        <Card className="border-emerald-200 shadow-md overflow-hidden bg-white lg:col-span-2 relative">
          <CardHeader className="bg-white pb-3 flex flex-row items-center justify-between border-b border-emerald-100">
            <div>
              <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-700" />
                3D Exam Integrity & Tab Switch Violations
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Distribution of candidate focus interruptions and proctoring security events
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIntegrityView(integrityView === '3d-bar' ? 'table' : '3d-bar')}
                className={`h-7 px-2.5 text-xs font-semibold transition-all ${
                  integrityView === 'table'
                    ? 'bg-[#008037] text-white hover:bg-[#00682c] shadow-xs border-[#008037]'
                    : 'bg-white border-emerald-300 text-emerald-900 hover:bg-emerald-50 shadow-2xs'
                }`}
              >
                {integrityView === '3d-bar' ? <TableIcon className="h-3.5 w-3.5 mr-1" /> : <BarChart3 className="h-3.5 w-3.5 mr-1" />}
                {integrityView === '3d-bar' ? 'Table View' : '3D Graph'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportCanvasToPNG(integrityCanvasRef.current, 'Exam Integrity & Tab Switches (3D Chart)', 'Integrity_Analytics')}
                className="h-7 px-2 gap-1 text-xs bg-white border-emerald-300 text-emerald-900 hover:bg-emerald-50 shadow-2xs"
              >
                <Download className="h-3.5 w-3.5" /> PNG
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 relative">
            <div className={integrityView === '3d-bar' ? 'w-full flex items-center justify-center relative' : 'hidden'}>
              <canvas
                ref={integrityCanvasRef}
                width={840}
                height={300}
                onMouseMove={(e) => handleBarMouseMove(e, integrityCanvasRef, integrityHitBoxes, setHoveredIntegrityIdx, setIntegrityTooltip)}
                onMouseLeave={() => { setHoveredIntegrityIdx(null); setIntegrityTooltip(prev => ({ ...prev, visible: false })); }}
                className="max-w-full h-auto rounded-lg cursor-pointer"
              />
              {integrityTooltip.visible && (
                <div
                  className="absolute pointer-events-none z-30 bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-xl shadow-2xl border border-emerald-500/40 text-xs transform -translate-x-1/2 -translate-y-full mb-3"
                  style={{ left: integrityTooltip.x, top: integrityTooltip.y }}
                >
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: integrityTooltip.color }} />
                    {integrityTooltip.title}
                  </div>
                  <div className="text-base font-extrabold text-white mb-1.5">{integrityTooltip.valueText}</div>
                  <div className="space-y-0.5 border-t border-slate-700/80 pt-1 text-[11px] text-slate-300">
                    {integrityTooltip.details.map((d, i) => (
                      <div key={i} className="flex justify-between gap-3">
                        <span className="text-slate-400">{d.label}:</span>
                        <span className="font-semibold text-white">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className={integrityView === 'table' ? 'overflow-x-auto block' : 'hidden'}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-emerald-50 text-emerald-950 font-bold border-b">
                    <th className="py-2.5 px-3 text-left">Switch Count</th>
                    <th className="py-2.5 px-3 text-left">Security Rating</th>
                    <th className="py-2.5 px-3 text-center">Candidates</th>
                    <th className="py-2.5 px-3 text-center">Proctoring Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100">
                  {[
                    { l: '0 Switches', r: 'Clean Proctored Submission', c: candidateAnalytics.filter(c => c.hasAttempted && c.tabSwitches === 0).length, tag: 'Clean' },
                    { l: '1-2 Switches', r: 'Minor Focus Interruptions', c: candidateAnalytics.filter(c => c.hasAttempted && c.tabSwitches >= 1 && c.tabSwitches <= 2).length, tag: 'Low' },
                    { l: '3-5 Switches', r: 'Moderate Deviation', c: candidateAnalytics.filter(c => c.hasAttempted && c.tabSwitches >= 3 && c.tabSwitches <= 5).length, tag: 'Warning' },
                    { l: '6+ Switches', r: 'Limit Exceeded Violations', c: candidateAnalytics.filter(c => c.hasAttempted && c.tabSwitches >= 6).length, tag: 'Exceeded' },
                  ].map(row => (
                    <tr key={row.l} className="hover:bg-emerald-50/40">
                      <td className="py-2 px-3 font-semibold text-gray-900">{row.l}</td>
                      <td className="py-2 px-3 text-gray-700">{row.r}</td>
                      <td className="py-2 px-3 text-center font-bold text-emerald-800">{row.c}</td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant={row.tag === 'Exceeded' ? 'destructive' : row.tag === 'Warning' ? 'secondary' : 'default'} className="text-[10px]">
                          {row.tag}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 6. INTERACTIVE 3D CUSTOM GRAPH BUILDER */}
      {/* ----------------------------------------------------------------- */}
      <Card className="border-2 border-primary/30 shadow-lg overflow-hidden bg-white">
        <CardHeader className="bg-gradient-to-r from-emerald-100 via-emerald-50 to-green-100 pb-4 border-b border-emerald-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-black text-emerald-950 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Custom 3D Graph Builder
              </CardTitle>
              <CardDescription className="text-xs text-emerald-800 mt-0.5">
                Generate tailored multi-dimensional 3D charts with full interactive tooltips and 1-click PNG image export
              </CardDescription>
            </div>
            <Button
              onClick={() => exportCanvasToPNG(customCanvasRef.current, `Custom 3D Graph (${customDimension} vs ${customMetric})`, 'Custom_3D_Graph')}
              className="bg-primary text-white hover:bg-primary/90 shadow-md gap-2 text-xs font-bold"
            >
              <Download className="h-4 w-4" /> Export Custom 3D PNG
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Controls Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
            {/* Chart Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-emerald-950 flex items-center gap-1">
                <Sliders className="h-3.5 w-3.5 text-primary" /> 3D Chart Type
              </label>
              <select
                aria-label="Select 3D Chart Type"
                value={customChartType}
                onChange={(e) => setCustomChartType(e.target.value as any)}
                className="w-full h-9 rounded-lg border border-emerald-200 bg-white px-2.5 text-xs font-semibold text-gray-800 shadow-xs focus:ring-2 focus:ring-primary"
              >
                <option value="3d-bar">3D Column / Cylinder Chart</option>
                <option value="3d-donut">3D Extruded Donut Chart</option>
              </select>
            </div>

            {/* Group By Dimension */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-emerald-950">Group Dimension (X-Axis)</label>
              <select
                aria-label="Select Group Dimension"
                value={customDimension}
                onChange={(e) => setCustomDimension(e.target.value as any)}
                className="w-full h-9 rounded-lg border border-emerald-200 bg-white px-2.5 text-xs font-semibold text-gray-800 shadow-xs focus:ring-2 focus:ring-primary"
              >
                <option value="department">By Department</option>
                <option value="college">By College</option>
                <option value="section">By Section</option>
                <option value="scoreBracket">By Score Range (0-100%)</option>
                <option value="passFail">By Pass / Fail Status</option>
                <option value="tabSwitches">By Tab Switches</option>
              </select>
            </div>

            {/* Metric / Value */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-emerald-950">Metric / Measure (Y-Axis)</label>
              <select
                aria-label="Select Metric"
                value={customMetric}
                onChange={(e) => setCustomMetric(e.target.value as any)}
                className="w-full h-9 rounded-lg border border-emerald-200 bg-white px-2.5 text-xs font-semibold text-gray-800 shadow-xs focus:ring-2 focus:ring-primary"
              >
                <option value="avgPercentage">Average Percentage (%)</option>
                <option value="avgScore">Average Obtained Marks</option>
                <option value="candidateCount">Candidate Count</option>
                <option value="avgCorrect">Average Correct Answers</option>
                <option value="avgWrong">Average Wrong Answers</option>
                <option value="avgTabSwitches">Average Tab Switches</option>
              </select>
            </div>

            {/* 3D Color Theme */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-emerald-950">3D Color Theme</label>
              <select
                aria-label="Select 3D Color Theme"
                value={customColorTheme}
                onChange={(e) => setCustomColorTheme(e.target.value as any)}
                className="w-full h-9 rounded-lg border border-emerald-200 bg-white px-2.5 text-xs font-semibold text-gray-800 shadow-xs focus:ring-2 focus:ring-primary"
              >
                <option value="emerald">Emerald 3D Green</option>
                <option value="blue">Royal Sapphire Blue</option>
                <option value="purple">Neon Amethyst Purple</option>
                <option value="amber">Warm Topaz Amber</option>
                <option value="multi">Vibrant Multi-Color</option>
              </select>
            </div>
          </div>

          {/* Rendered Custom Canvas Container */}
          <div className="flex flex-col items-center justify-center p-4 border border-emerald-100 rounded-xl bg-slate-50/50 relative">
            <canvas
              ref={customCanvasRef}
              width={760}
              height={360}
              onMouseMove={(e) => {
                if (customChartType === '3d-donut') {
                  handleDonutMouseMove(e, customCanvasRef, customHitSlices, setHoveredCustomIdx, setCustomTooltip);
                } else {
                  handleBarMouseMove(e, customCanvasRef, customHitBoxes, setHoveredCustomIdx, setCustomTooltip);
                }
              }}
              onMouseLeave={() => { setHoveredCustomIdx(null); setCustomTooltip(prev => ({ ...prev, visible: false })); }}
              className="max-w-full h-auto rounded-lg shadow-xs bg-white cursor-pointer"
            />
            {/* Custom Tooltip */}
            {customTooltip.visible && (
              <div
                className="absolute pointer-events-none z-30 bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-xl shadow-2xl border border-emerald-500/40 text-xs transform -translate-x-1/2 -translate-y-full mb-3"
                style={{ left: customTooltip.x, top: customTooltip.y }}
              >
                <div className="flex items-center gap-1.5 font-bold text-emerald-400 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: customTooltip.color }} />
                  {customTooltip.title}
                </div>
                <div className="text-base font-extrabold text-white mb-1.5">{customTooltip.valueText}</div>
                {customTooltip.details && customTooltip.details.length > 0 && (
                  <div className="space-y-0.5 border-t border-slate-700/80 pt-1 text-[11px] text-slate-300">
                    {customTooltip.details.map((d, i) => (
                      <div key={i} className="flex justify-between gap-3">
                        <span className="text-slate-400">{d.label}:</span>
                        <span className="font-semibold text-white">{d.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Question Inspection Modal */}
      {selectedQuestionForModal && (
        <Dialog open={!!selectedQuestionForModal} onOpenChange={(open) => !open && setSelectedQuestionForModal(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 font-bold">
                  Question {selectedQuestionForModal.qNumber}
                </Badge>
                <Badge className="bg-primary text-white">
                  {selectedQuestionForModal.section}
                </Badge>
                <Badge
                  className={
                    selectedQuestionForModal.difficulty === 'Easy'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : selectedQuestionForModal.difficulty === 'Challenging'
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }
                >
                  {selectedQuestionForModal.difficulty}
                </Badge>
                <span className="text-xs text-muted-foreground ml-auto font-mono">
                  Marks: +{selectedQuestionForModal.qMarks} / -{selectedQuestionForModal.qNeg}
                </span>
              </div>
              <DialogTitle className="text-base font-bold text-gray-900 mt-2 text-left">
                {selectedQuestionForModal.text}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground text-left">
                Detailed candidate response breakdown and choice frequency analysis
              </DialogDescription>
            </DialogHeader>

            {/* Metrics Row */}
            <div className="grid grid-cols-4 gap-2 my-2 text-center text-xs">
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                <p className="text-[11px] font-semibold text-emerald-800">Accuracy</p>
                <p className="text-lg font-extrabold text-emerald-700">{selectedQuestionForModal.accuracy}%</p>
              </div>
              <div className="p-2.5 rounded-lg bg-green-50 border border-green-200">
                <p className="text-[11px] font-semibold text-green-800">Correct</p>
                <p className="text-lg font-extrabold text-green-700">
                  {selectedQuestionForModal.correctCount} / {selectedQuestionForModal.totalAttempts}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200">
                <p className="text-[11px] font-semibold text-rose-800">Incorrect</p>
                <p className="text-lg font-extrabold text-rose-700">
                  {selectedQuestionForModal.wrongCount} / {selectedQuestionForModal.totalAttempts}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-[11px] font-semibold text-slate-700">Skipped</p>
                <p className="text-lg font-extrabold text-slate-700">
                  {selectedQuestionForModal.unansweredCount} / {selectedQuestionForModal.totalAttempts}
                </p>
              </div>
            </div>

            {/* Options Distribution */}
            <div className="space-y-2 mt-2">
              <h5 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Candidate Choice Breakdown</h5>
              <div className="space-y-2">
                {selectedQuestionForModal.options.map((opt: string, optIdx: number) => {
                  const count = selectedQuestionForModal.optionCounts[optIdx] || 0;
                  const pct = selectedQuestionForModal.totalAttempts > 0
                    ? Math.round((count / selectedQuestionForModal.totalAttempts) * 100)
                    : 0;
                  const isCorrect = optIdx === Number(selectedQuestionForModal.correctAnswer);

                  return (
                    <div
                      key={optIdx}
                      className={`p-2.5 rounded-lg border transition-all text-xs ${
                        isCorrect
                          ? 'bg-emerald-50/80 border-emerald-300'
                          : count > 0
                          ? 'bg-rose-50/50 border-rose-200'
                          : 'bg-gray-50/60 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] ${
                            isCorrect ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'
                          }`}>
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span className="font-semibold text-gray-900">{opt}</span>
                          {isCorrect && (
                            <Badge className="bg-emerald-600 text-white text-[10px] py-0 px-1.5 h-4">
                              ✓ Correct Answer
                            </Badge>
                          )}
                        </div>
                        <span className="font-bold text-gray-800 font-mono">
                          {count} candidate{count !== 1 ? 's' : ''} ({pct}%)
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full ${isCorrect ? 'bg-emerald-500' : 'bg-rose-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Candidate Names Lists */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
              <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/30">
                <span className="font-bold text-emerald-900 flex items-center gap-1.5 mb-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Answered Correctly ({selectedQuestionForModal.candidatesCorrect.length})
                </span>
                {selectedQuestionForModal.candidatesCorrect.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {selectedQuestionForModal.candidatesCorrect.map((name: string, nI: number) => (
                      <span key={nI} className="bg-white border border-emerald-200 px-2 py-0.5 rounded text-[11px] text-emerald-950 font-medium">
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-400 italic">None</span>
                )}
              </div>

              <div className="p-2.5 rounded-lg border border-rose-200 bg-rose-50/30">
                <span className="font-bold text-rose-900 flex items-center gap-1.5 mb-1.5">
                  <XCircle className="h-3.5 w-3.5 text-rose-600" />
                  Answered Incorrectly ({selectedQuestionForModal.candidatesWrong.length})
                </span>
                {selectedQuestionForModal.candidatesWrong.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {selectedQuestionForModal.candidatesWrong.map((name: string, nI: number) => (
                      <span key={nI} className="bg-white border border-rose-200 px-2 py-0.5 rounded text-[11px] text-rose-950 font-medium">
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-400 italic">None</span>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
