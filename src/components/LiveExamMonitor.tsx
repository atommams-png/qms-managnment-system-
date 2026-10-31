import { parseExamScheduleDate } from '@/lib/dateUtils';
import { autoSubmitExpiredAttempts } from '@/lib/store';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Exam, Candidate, ExamAttempt, ExamResult } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import DeviceBadge from '@/components/DeviceBadge';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Laptop,
  Pause,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  Smartphone,
  Tablet,
  User,
  Wifi,
  WifiOff,
  XCircle,
  Zap,
  LayoutGrid,
  Table as TableIcon,
  Copy,
  ChevronRight,
  HelpCircle,
  Layers,
  Cpu,
  Monitor
} from 'lucide-react';
import { toast } from 'sonner';

interface LiveExamMonitorProps {
  exam: Exam;
  candidates: Candidate[];
  attempts: ExamAttempt[];
  results: ExamResult[];
  onRefresh: () => Promise<void>;
  isRefreshing?: boolean;
}

interface EnrichedLiveCandidate {
  candidate: Candidate;
  attempt?: ExamAttempt;
  result?: ExamResult;
  status: 'live' | 'limit_exceeded' | 'tab_alert' | 'submitted' | 'not_started';
  statusLabel: string;
  isLive: boolean;
  isSubmitted: boolean;
  isNotStarted: boolean;
  tabSwitches: number;
  maxTabSwitches: number;
  isLimitExceeded: boolean;
  hasTabViolation: boolean;
  answeredCount: number;
  totalQuestions: number;
  progressPct: number;
  deviceType: string;
  deviceName: string;
  deviceOs: string;
  isDesktopMode: boolean;
  deviceInfo: any;
  startedAt?: string;
  submittedAt?: string | null;
  updatedAt?: string | null;
  lastActiveFormatted: string;
  timeElapsedFormatted: string;
  isHeartbeatActive: boolean;
}

export const LiveExamMonitor: React.FC<LiveExamMonitorProps> = ({
  exam,
  candidates,
  attempts,
  results,
  onRefresh,
  isRefreshing = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(5);
  const [countdown, setCountdown] = useState(5);
  const [isManualSpinning, setIsManualSpinning] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<EnrichedLiveCandidate | null>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Clock tick to keep relative times and countdown updated
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      if (autoRefresh) {
        setCountdown(prev => {
          if (prev <= 1) {
            onRefresh().catch(() => {});
            return refreshIntervalSec;
          }
          return prev - 1;
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [autoRefresh, refreshIntervalSec, onRefresh]);

  // Reset countdown when interval changes
  useEffect(() => {
    setCountdown(refreshIntervalSec);
  }, [refreshIntervalSec]);

  const handleManualRefresh = async () => {
    setIsManualSpinning(true);
    setCountdown(refreshIntervalSec);
    try {
      await onRefresh();
      toast.success('Live monitor updated', { duration: 1500 });
    } catch {
      toast.error('Failed to refresh data');
    } finally {
      setTimeout(() => setIsManualSpinning(false), 500);
    }
  };

  // Helper to format relative time
  const formatTimeAgo = (dateStr?: string | null): { formatted: string; isActive: boolean } => {
    if (!dateStr) return { formatted: 'Never', isActive: false };
    const date = new Date(dateStr);
    const diffMs = currentTime.getTime() - date.getTime();
    if (diffMs < 0) return { formatted: 'Just now', isActive: true };

    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 20) return { formatted: 'Just now', isActive: true };
    if (diffSec < 60) return { formatted: `${diffSec}s ago`, isActive: true };

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return { formatted: `${diffMin}m ago`, isActive: diffMin < 2 };

    const diffHrs = Math.floor(diffMin / 60);
    return { formatted: `${diffHrs}h ago`, isActive: false };
  };

  // Helper to format elapsed duration
  const formatDuration = (startStr?: string, endStr?: string | null): string => {
    if (!startStr) return '-';
    const start = new Date(startStr);
    const end = endStr ? new Date(endStr) : currentTime;
    const diffMs = Math.max(0, end.getTime() - start.getTime());
    const totalSec = Math.floor(diffMs / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const maxTabSwitches = exam?.settings?.maxTabSwitches ?? 3;
  const totalQuestions = exam?.questions?.length || 0;

  const isExamExpired = useMemo(() => {
    if (!exam?.endDateTime) return false;
    const endDate = parseExamScheduleDate(exam.endDateTime);
    return Boolean(endDate && new Date() > endDate);
  }, [exam?.endDateTime]);

  // Auto-submit expired attempts on component mount/detect
  useEffect(() => {
    if (isExamExpired && attempts.some(a => !a.isSubmitted)) {
      autoSubmitExpiredAttempts(exam.id)
        .then(res => {
          if (res.submittedCount > 0) {
            toast.info(`Auto-submitted ${res.submittedCount} attempts from expired exam`);
            onRefresh();
          }
        })
        .catch(() => {});
    }
  }, [isExamExpired, exam?.id, attempts]);

  // Build list of all candidates merged with attempts and results
  const allLiveCandidates: EnrichedLiveCandidate[] = useMemo(() => {
    // Map existing candidates
    const mapped: EnrichedLiveCandidate[] = candidates.map(candidate => {
      const attempt = attempts.find(a => a.candidateId === candidate.id);
      const result = results.find(r => r.candidateId === candidate.id || (attempt && r.attemptId === attempt.id));

      const startedAt = attempt?.startedAt;
      const submittedAt = attempt?.submittedAt;
      const updatedAt = attempt?.updatedAt || attempt?.startedAt;

      const durationMins = exam?.settings?.duration || 0;
      const isDurationExpired = Boolean(
        durationMins > 0 && startedAt &&
        (Date.now() > new Date(startedAt).getTime() + durationMins * 60 * 1000 + 60000)
      );
      const isExpired = isExamExpired || isDurationExpired;

      const tabSwitches = attempt?.tabSwitches ?? 0;
      const isLimitExceeded = maxTabSwitches > 0 && tabSwitches >= maxTabSwitches;
      const isAutoSubmittedExpired = Boolean(attempt && !attempt.isSubmitted && !result && isExpired);
      const isSubmitted = Boolean(attempt?.isSubmitted || result || isAutoSubmittedExpired);
      const isLive = Boolean(attempt && !isSubmitted && !isExpired);
      const isNotStarted = !attempt;
      const hasTabViolation = tabSwitches > 0;

      let status: EnrichedLiveCandidate['status'] = 'not_started';
      let statusLabel = 'Not Started';

      if (isLimitExceeded) {
        status = 'limit_exceeded';
        statusLabel = 'Limit Exceeded';
      } else if (isLive) {
        status = hasTabViolation ? 'tab_alert' : 'live';
        statusLabel = hasTabViolation ? 'Tab Alert' : 'Live Active';
      } else if (isAutoSubmittedExpired) {
        status = 'submitted';
        statusLabel = 'Auto-submitted (Expired)';
      } else if (isSubmitted) {
        status = 'submitted';
        statusLabel = 'Submitted';
      }

      const answeredCount = attempt?.answers
        ? attempt.answers.filter(a => a.selectedAnswer !== null && a.selectedAnswer !== undefined).length
        : 0;

      const progressPct = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

      const deviceType = attempt?.deviceType || candidate.deviceType || 'desktop';
      const deviceName = attempt?.deviceName || candidate.deviceName || 'Desktop';
      const deviceOs = attempt?.deviceOs || candidate.deviceOs || '';
      const isDesktopMode = Boolean(attempt?.isDesktopMode ?? candidate.isDesktopMode);
      const deviceInfo = attempt?.deviceInfo || candidate.deviceInfo;

      const { formatted: lastActiveFormatted, isActive: isHeartbeatActive } = formatTimeAgo(updatedAt);
      const timeElapsedFormatted = formatDuration(startedAt, submittedAt);

      return {
        candidate,
        attempt,
        result,
        status,
        statusLabel,
        isLive,
        isSubmitted,
        isNotStarted,
        tabSwitches,
        maxTabSwitches,
        isLimitExceeded,
        hasTabViolation,
        answeredCount,
        totalQuestions,
        progressPct,
        deviceType,
        deviceName,
        deviceOs,
        isDesktopMode,
        deviceInfo,
        startedAt,
        submittedAt,
        updatedAt,
        lastActiveFormatted,
        timeElapsedFormatted,
        isHeartbeatActive: isLive && isHeartbeatActive
      };
    });

    // Also include attempts that might not have matching candidate in candidates state
    const candidateIds = new Set(candidates.map(c => c.id));
    attempts.forEach(attempt => {
      if (!candidateIds.has(attempt.candidateId)) {
        const result = results.find(r => r.attemptId === attempt.id || r.candidateId === attempt.candidateId);
        const durationMins = exam?.settings?.duration || 0;
        const isDurationExpired = Boolean(
          durationMins > 0 && attempt.startedAt &&
          (Date.now() > new Date(attempt.startedAt).getTime() + durationMins * 60 * 1000 + 60000)
        );
        const isExpired = isExamExpired || isDurationExpired;

        const tabSwitches = attempt.tabSwitches ?? 0;
        const isLimitExceeded = maxTabSwitches > 0 && tabSwitches >= maxTabSwitches;
        const isAutoSubmittedExpired = Boolean(!attempt.isSubmitted && !result && isExpired);
        const isSubmitted = Boolean(attempt.isSubmitted || result || isAutoSubmittedExpired);
        const isLive = Boolean(!isSubmitted && !isExpired);
        const hasTabViolation = tabSwitches > 0;

        let status: EnrichedLiveCandidate['status'] = 'live';
        let statusLabel = 'Live Active';
        if (isLimitExceeded) {
          status = 'limit_exceeded';
          statusLabel = 'Limit Exceeded';
        } else if (isLive && hasTabViolation) {
          status = 'tab_alert';
          statusLabel = 'Tab Alert';
        } else if (isAutoSubmittedExpired) {
          status = 'submitted';
          statusLabel = 'Auto-submitted (Expired)';
        } else if (isSubmitted) {
          status = 'submitted';
          statusLabel = 'Submitted';
        }

        const answeredCount = attempt.answers
          ? attempt.answers.filter(a => a.selectedAnswer !== null && a.selectedAnswer !== undefined).length
          : 0;

        const progressPct = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

        const syntheticCandidate: Candidate = {
          id: attempt.candidateId,
          examId: attempt.examId,
          name: attempt.candidateDeviceName || 'Student',
          email: '',
          phone: '',
          college: '',
          usn: '',
          department: '',
          section: '',
          registeredAt: attempt.startedAt,
          deviceType: attempt.deviceType,
          deviceName: attempt.deviceName,
          deviceOs: attempt.deviceOs,
          isDesktopMode: attempt.isDesktopMode,
          deviceInfo: attempt.deviceInfo
        };

        const { formatted: lastActiveFormatted, isActive: isHeartbeatActive } = formatTimeAgo(attempt.updatedAt || attempt.startedAt);

        mapped.push({
          candidate: syntheticCandidate,
          attempt,
          result,
          status,
          statusLabel,
          isLive,
          isSubmitted,
          isNotStarted: false,
          tabSwitches,
          maxTabSwitches,
          isLimitExceeded,
          hasTabViolation,
          answeredCount,
          totalQuestions,
          progressPct,
          deviceType: attempt.deviceType || 'desktop',
          deviceName: attempt.deviceName || 'Desktop',
          deviceOs: attempt.deviceOs || '',
          isDesktopMode: Boolean(attempt.isDesktopMode),
          deviceInfo: attempt.deviceInfo,
          startedAt: attempt.startedAt,
          submittedAt: attempt.submittedAt,
          updatedAt: attempt.updatedAt,
          lastActiveFormatted,
          timeElapsedFormatted: formatDuration(attempt.startedAt, attempt.submittedAt),
          isHeartbeatActive: isLive && isHeartbeatActive
        });
      }
    });

    return mapped;
  }, [candidates, attempts, results, maxTabSwitches, totalQuestions, currentTime]);

  // Summary Metrics
  const summary = useMemo(() => {
    const total = allLiveCandidates.length;
    const liveActive = allLiveCandidates.filter(c => c.isLive).length;
    const limitExceeded = allLiveCandidates.filter(c => c.isLimitExceeded).length;
    const tabViolations = allLiveCandidates.filter(c => c.hasTabViolation).length;
    const desktopModeBypass = allLiveCandidates.filter(c => c.isDesktopMode).length;
    const mobileDevices = allLiveCandidates.filter(c => {
      const label = (c.deviceName || '').toLowerCase();
      const type = (c.deviceType || '').toLowerCase();
      return type === 'mobile' || label.includes('android') || label.includes('iphone') || label.includes('phone');
    }).length;
    const submitted = allLiveCandidates.filter(c => c.isSubmitted).length;
    const notStarted = allLiveCandidates.filter(c => c.isNotStarted).length;

    return {
      total,
      liveActive,
      limitExceeded,
      tabViolations,
      desktopModeBypass,
      mobileDevices,
      submitted,
      notStarted
    };
  }, [allLiveCandidates]);

  // Departments list for filter
  const departments = useMemo(() => {
    const depts = new Set<string>();
    allLiveCandidates.forEach(c => {
      if (c.candidate.department) depts.add(c.candidate.department.trim());
    });
    return Array.from(depts).filter(Boolean).sort();
  }, [allLiveCandidates]);

  // Filtered candidates
  const filteredCandidates = useMemo(() => {
    return allLiveCandidates.filter(c => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = c.candidate.name?.toLowerCase().includes(q);
        const usnMatch = c.candidate.usn?.toLowerCase().includes(q);
        const emailMatch = c.candidate.email?.toLowerCase().includes(q);
        const deptMatch = c.candidate.department?.toLowerCase().includes(q);
        if (!nameMatch && !usnMatch && !emailMatch && !deptMatch) return false;
      }

      // Status Filter
      if (statusFilter === 'live' && !c.isLive) return false;
      if (statusFilter === 'limit_exceeded' && !c.isLimitExceeded) return false;
      if (statusFilter === 'tab_violations' && !c.hasTabViolation) return false;
      if (statusFilter === 'desktop_bypass' && !c.isDesktopMode) return false;
      if (statusFilter === 'submitted' && !c.isSubmitted) return false;
      if (statusFilter === 'not_started' && !c.isNotStarted) return false;

      // Device Filter
      if (deviceFilter !== 'all') {
        const dType = (c.deviceType || '').toLowerCase();
        const dName = (c.deviceName || '').toLowerCase();
        const dOs = (c.deviceOs || '').toLowerCase();

        if (deviceFilter === 'desktop' && (dType === 'mobile' || dType === 'tablet' || c.isDesktopMode)) return false;
        if (deviceFilter === 'android_desktop_mode' && !(dOs.includes('android') && c.isDesktopMode)) return false;
        if (deviceFilter === 'iphone_desktop_mode' && !(dOs.includes('ios') && c.isDesktopMode)) return false;
        if (deviceFilter === 'android' && !dOs.includes('android')) return false;
        if (deviceFilter === 'iphone' && !(dOs.includes('ios') || dName.includes('iphone'))) return false;
        if (deviceFilter === 'tablet' && dType !== 'tablet') return false;
      }

      // Dept Filter
      if (deptFilter !== 'all' && c.candidate.department !== deptFilter) return false;

      return true;
    });
  }, [allLiveCandidates, searchQuery, statusFilter, deviceFilter, deptFilter]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. Live Radar Top Bar & Polling Controls */}
      <div className="bg-gradient-to-r from-emerald-900 via-[#008037] to-teal-800 rounded-2xl p-4 sm:p-5 text-white shadow-lg border border-emerald-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center h-11 w-11 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 shadow-inner">
            <span className="animate-ping absolute inline-flex h-7 w-7 rounded-full bg-emerald-400 opacity-70" />
            <Activity className="h-6 w-6 text-emerald-300 relative z-10" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                Live Exam Monitor & Proctoring Radar
              </h2>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-emerald-100/90 mt-0.5">
              Real-time telemetry tracking: device hardware, desktop-mode spoofing, tab switch violations, and question progress.
            </p>
          </div>
        </div>

        {/* Control Buttons & Auto-Refresh */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Auto Refresh Toggle */}
          <div className="flex items-center gap-1.5 bg-black/25 backdrop-blur-md border border-white/15 px-3 py-1.5 rounded-xl">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer ${
                autoRefresh ? 'text-emerald-300' : 'text-zinc-300 hover:text-white'
              }`}
              title={autoRefresh ? 'Auto-refresh active' : 'Auto-refresh paused'}
            >
              {autoRefresh ? (
                <>
                  <Pause className="h-3.5 w-3.5 text-emerald-300" />
                  <span>Syncing {countdown}s</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 text-amber-300" />
                  <span>Paused</span>
                </>
              )}
            </button>

            {/* Select interval */}
            <select
              value={refreshIntervalSec}
              onChange={e => setRefreshIntervalSec(Number(e.target.value))}
              aria-label="Refresh Interval"
              className="bg-white/10 text-white text-xs rounded border border-white/20 px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
            >
              <option value={3} className="text-black">3s</option>
              <option value={5} className="text-black">5s</option>
              <option value={10} className="text-black">10s</option>
              <option value={30} className="text-black">30s</option>
            </select>
          </div>

          {/* Manual Refresh Button */}
          <Button
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing || isManualSpinning}
            className="bg-white text-emerald-900 hover:bg-emerald-50 font-bold shadow-md cursor-pointer h-9 px-3.5 gap-1.5 text-xs transition-transform active:scale-95"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#008037] ${isRefreshing || isManualSpinning ? 'animate-spin' : ''}`} />
            <span>Refresh Now</span>
          </Button>

          {/* View Mode Toggle */}
          <div className="bg-black/25 backdrop-blur-md border border-white/15 p-0.5 rounded-xl flex items-center">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'cards' ? 'bg-white text-emerald-950 shadow-sm' : 'text-white/80 hover:text-white'
              }`}
              title="Card View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-emerald-950 shadow-sm' : 'text-white/80 hover:text-white'
              }`}
              title="Table View"
            >
              <TableIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Key Telemetry Metrics Grid (KPI Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Candidates */}
        <Card
          onClick={() => setStatusFilter('all')}
          className={`cursor-pointer transition-all border-emerald-200/80 shadow-xs hover:shadow-md hover:border-emerald-400 ${
            statusFilter === 'all' ? 'ring-2 ring-emerald-500 bg-emerald-50/70' : 'bg-white'
          }`}
        >
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-emerald-700 text-xs font-bold mb-1">
              <User className="h-3.5 w-3.5" />
              <span>Enrolled</span>
            </div>
            <p className="text-2xl font-black text-gray-900">{summary.total}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Total registered</p>
          </CardContent>
        </Card>

        {/* Live Active Now */}
        <Card
          onClick={() => setStatusFilter('live')}
          className={`cursor-pointer transition-all border-emerald-200 shadow-xs hover:shadow-md hover:border-emerald-500 ${
            statusFilter === 'live' ? 'ring-2 ring-emerald-600 bg-emerald-100/70' : 'bg-emerald-50/40'
          }`}
        >
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-emerald-800 text-xs font-bold mb-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
              </span>
              <span>Live Active</span>
            </div>
            <p className="text-2xl font-black text-emerald-700">{summary.liveActive}</p>
            <p className="text-[10px] text-emerald-800/80 mt-0.5">Taking exam right now</p>
          </CardContent>
        </Card>

        {/* Tab Switch Limit Exceeded */}
        <Card
          onClick={() => setStatusFilter('limit_exceeded')}
          className={`cursor-pointer transition-all border-rose-200 shadow-xs hover:shadow-md hover:border-rose-400 ${
            statusFilter === 'limit_exceeded' ? 'ring-2 ring-rose-500 bg-rose-50' : 'bg-rose-50/30'
          }`}
        >
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-rose-700 text-xs font-bold mb-1">
              <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
              <span>Exceeded Limit</span>
            </div>
            <p className="text-2xl font-black text-rose-600">{summary.limitExceeded}</p>
            <p className="text-[10px] text-rose-700 mt-0.5">Auto-locked/Violated</p>
          </CardContent>
        </Card>

        {/* Tab Switch Warnings */}
        <Card
          onClick={() => setStatusFilter('tab_violations')}
          className={`cursor-pointer transition-all border-amber-200 shadow-xs hover:shadow-md hover:border-amber-400 ${
            statusFilter === 'tab_violations' ? 'ring-2 ring-amber-500 bg-amber-50' : 'bg-amber-50/30'
          }`}
        >
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-amber-800 text-xs font-bold mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              <span>Tab Switches</span>
            </div>
            <p className="text-2xl font-black text-amber-700">{summary.tabViolations}</p>
            <p className="text-[10px] text-amber-800 mt-0.5">&gt; 0 Tab switches</p>
          </CardContent>
        </Card>

        {/* Desktop Mode Bypass Alert */}
        <Card
          onClick={() => setStatusFilter('desktop_bypass')}
          className={`cursor-pointer transition-all border-amber-300 shadow-xs hover:shadow-md hover:border-amber-500 ${
            statusFilter === 'desktop_bypass' ? 'ring-2 ring-amber-600 bg-amber-100/50' : 'bg-amber-50/40'
          }`}
        >
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-amber-900 text-xs font-bold mb-1">
              <Zap className="h-3.5 w-3.5 text-amber-600 animate-bounce" />
              <span>Desktop Bypass</span>
            </div>
            <p className="text-2xl font-black text-amber-900">{summary.desktopModeBypass}</p>
            <p className="text-[10px] text-amber-800 mt-0.5">Mobile in desktop site</p>
          </CardContent>
        </Card>

        {/* Submitted / Completed */}
        <Card
          onClick={() => setStatusFilter('submitted')}
          className={`cursor-pointer transition-all border-blue-200 shadow-xs hover:shadow-md hover:border-blue-400 ${
            statusFilter === 'submitted' ? 'ring-2 ring-blue-500 bg-blue-50' : 'bg-blue-50/30'
          }`}
        >
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-blue-700 text-xs font-bold mb-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
              <span>Submitted</span>
            </div>
            <p className="text-2xl font-black text-blue-700">{summary.submitted}</p>
            <p className="text-[10px] text-blue-800 mt-0.5">Finished exams</p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Search and Multi-Filter Controls */}
      <div className="bg-white border border-emerald-200/90 rounded-xl p-3.5 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-emerald-700" />
            <Input
              placeholder="Search by student name, USN, email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 text-xs h-9 border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            aria-label="Filter by Live Status"
            className="text-xs h-9 rounded-md border border-emerald-200 bg-white px-2.5 font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="all">Status: All Candidates ({summary.total})</option>
            <option value="live">🟢 Live Active ({summary.liveActive})</option>
            <option value="limit_exceeded">🔴 Limit Exceeded ({summary.limitExceeded})</option>
            <option value="tab_violations">🟡 Tab Violations ({summary.tabViolations})</option>
            <option value="desktop_bypass">⚡ Desktop Mode Bypass ({summary.desktopModeBypass})</option>
            <option value="submitted">🔵 Submitted ({summary.submitted})</option>
            <option value="not_started">⚪ Not Started ({summary.notStarted})</option>
          </select>

          {/* Device Filter */}
          <select
            value={deviceFilter}
            onChange={e => setDeviceFilter(e.target.value)}
            aria-label="Filter by Device"
            className="text-xs h-9 rounded-md border border-emerald-200 bg-white px-2.5 font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="all">Device: All Devices</option>
            <option value="desktop">💻 Laptop / PC</option>
            <option value="android_desktop_mode">⚡ Android (Desktop Site Mode)</option>
            <option value="android">📱 Android (Mobile Browser)</option>
            <option value="iphone_desktop_mode">⚡ iPhone (Desktop Site Mode)</option>
            <option value="iphone">🍏 iPhone (Mobile Safari)</option>
            <option value="tablet">📟 Tablet / iPad</option>
          </select>

          {/* Department Filter */}
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            aria-label="Filter by Department"
            className="text-xs h-9 rounded-md border border-emerald-200 bg-white px-2.5 font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="all">Department: All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>

        {/* Filter Badges & Count */}
        <div className="flex flex-wrap items-center justify-between text-xs text-gray-500 pt-1 border-t border-emerald-100">
          <div>
            Showing <strong className="text-gray-900">{filteredCandidates.length}</strong> of{' '}
            <strong className="text-gray-900">{allLiveCandidates.length}</strong> candidates
            {(statusFilter !== 'all' || deviceFilter !== 'all' || deptFilter !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setDeviceFilter('all');
                  setDeptFilter('all');
                  setSearchQuery('');
                }}
                className="ml-2 text-emerald-700 underline font-semibold hover:text-emerald-900 cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] text-gray-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> Active
            </span>
            <span className="flex items-center gap-1 text-[11px] text-gray-600">
              <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" /> Warning
            </span>
            <span className="flex items-center gap-1 text-[11px] text-gray-600">
              <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" /> Exceeded
            </span>
            <span className="flex items-center gap-1 text-[11px] text-gray-600">
              <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" /> Submitted
            </span>
          </div>
        </div>
      </div>

      {/* 4. Candidates Grid / Table Display */}
      {filteredCandidates.length === 0 ? (
        <Card className="border-emerald-200 bg-emerald-50/20">
          <CardContent className="py-12 text-center text-gray-500">
            <Activity className="h-8 w-8 text-emerald-600 mx-auto mb-2 opacity-50" />
            <p className="font-semibold text-gray-800">No candidates match current filter</p>
            <p className="text-xs text-gray-500 mt-1">Try relaxing your search terms or filters.</p>
          </CardContent>
        </Card>
      ) : viewMode === 'cards' ? (
        /* Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCandidates.map((c, idx) => {
            const hasExceeded = c.isLimitExceeded;
            const isWarning = c.hasTabViolation && !hasExceeded;

            return (
              <div
                key={c.candidate.id || idx}
                className={`bg-white rounded-xl p-3.5 shadow-xs hover:shadow-md transition-all border flex flex-col justify-between gap-3 relative overflow-hidden ${
                  hasExceeded
                    ? 'border-rose-400 ring-1 ring-rose-200 bg-rose-50/10'
                    : isWarning
                    ? 'border-amber-300 ring-1 ring-amber-100 bg-amber-50/10'
                    : c.isLive
                    ? 'border-emerald-300 hover:border-emerald-500'
                    : 'border-emerald-200/90 hover:border-emerald-400'
                }`}
              >
                {/* Desktop Site Bypass Warning Banner */}
                {c.isDesktopMode && (
                  <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md flex items-center justify-between shadow-xs">
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      Mobile Desktop Site Mode Detected
                    </span>
                    <span className="text-[9px] bg-white/20 px-1 rounded">Bypass Attempt</span>
                  </div>
                )}

                {/* Card Header: Candidate Info & Status Pill */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-extrabold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                        #{idx + 1}
                      </span>
                      <h4 className="text-sm font-bold text-gray-900 truncate" title={c.candidate.name}>
                        {c.candidate.name}
                      </h4>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-0.5 truncate">
                      <span className="font-mono font-semibold text-emerald-700">{c.candidate.usn || 'No USN'}</span>
                      {c.candidate.department && <span>• {c.candidate.department}</span>}
                      {c.candidate.section && <span>({c.candidate.section})</span>}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0 flex items-center">
                    {c.isLimitExceeded ? (
                      <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-2xs flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        Limit Exceeded
                      </span>
                    ) : c.isLive ? (
                      <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-2xs flex items-center gap-1">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                        </span>
                        Live Active
                      </span>
                    ) : c.isSubmitted ? (
                      <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-2xs flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {c.statusLabel === 'Auto-submitted (Expired)' ? 'Auto-submitted (Expired)' : 'Submitted'}
                      </span>
                    ) : (
                      <span className="bg-gray-200 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Not Started
                      </span>
                    )}
                  </div>
                </div>

                {/* Device & Hardware Telemetry Badge */}
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-gray-50 border border-gray-200">
                  <span className="text-[10px] font-bold uppercase text-gray-600 shrink-0">Device:</span>
                  <DeviceBadge
                    deviceLabel={c.deviceName}
                    deviceType={c.deviceType}
                    deviceOs={c.deviceOs}
                    isDesktopMode={c.isDesktopMode}
                    deviceInfo={c.deviceInfo}
                    size="sm"
                  />
                </div>

                {/* Tab Switches & Violation Gauge */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] font-semibold text-gray-700 flex items-center gap-1">
                      <AlertTriangle className={`h-3 w-3 ${
                        hasExceeded ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-emerald-600'
                      }`} />
                      <span>Tab Switches:</span>
                    </span>
                    <span className={`font-mono font-extrabold text-xs ${
                      hasExceeded ? 'text-rose-600' : isWarning ? 'text-amber-700' : 'text-emerald-700'
                    }`}>
                      {c.tabSwitches} / {c.maxTabSwitches}
                    </span>
                  </div>
                  {/* Gauge Bar */}
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        hasExceeded
                          ? 'bg-rose-600'
                          : isWarning
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{
                        width: `${Math.min(100, (c.tabSwitches / (c.maxTabSwitches || 1)) * 100)}%`
                      }}
                    />
                  </div>
                </div>

                {/* Questions Answered Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] font-semibold text-gray-700">Exam Progress:</span>
                    <span className="font-mono font-bold text-gray-900 text-[11px]">
                      {c.answeredCount} / {c.totalQuestions} ({c.progressPct}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200">
                    <div
                      className="h-full bg-primary transition-all duration-300 rounded-full"
                      style={{ width: `${c.progressPct}%` }}
                    />
                  </div>
                </div>

                {/* Card Footer: Live Details Action */}
                <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                  <div className="text-[10px] text-gray-500">
                    {c.isSubmitted && c.result ? (
                      <span className="font-bold text-gray-800">
                        Score: {c.result.obtainedMarks}/{c.result.totalMarks} ({c.result.percentage}%)
                      </span>
                    ) : c.startedAt ? (
                      <span>Started: {new Date(c.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    ) : (
                      <span>Awaiting test launch</span>
                    )}
                  </div>

                  <Button
                    size="sm"
                    onClick={() => setSelectedCandidate(c)}
                    className="h-7 px-3 text-[11px] font-bold text-white bg-[#008037] hover:bg-black border border-[#008037] shadow-xs gap-1.5 cursor-pointer transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5 text-white" />
                    <span className="text-white font-bold">Inspect Telemetry</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <Card className="border-emerald-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-emerald-50/80 text-emerald-950 uppercase font-black tracking-wider text-[11px] border-b border-emerald-200">
                <tr>
                  <th className="px-3.5 py-3">#</th>
                  <th className="px-3.5 py-3">Candidate</th>
                  <th className="px-3.5 py-3">Status</th>
                  <th className="px-3.5 py-3">Detected Device & Mode</th>
                  <th className="px-3.5 py-3 text-center">Tab Switches</th>
                  <th className="px-3.5 py-3 text-center">Questions Progress</th>
                  <th className="px-3.5 py-3 text-center">Heartbeat</th>
                  <th className="px-3.5 py-3 text-center">Time</th>
                  <th className="px-3.5 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100 bg-white">
                {filteredCandidates.map((c, idx) => {
                  return (
                    <tr
                      key={c.candidate.id || idx}
                      className={`hover:bg-emerald-50/40 transition-colors ${
                        c.isLimitExceeded ? 'bg-rose-50/20' : c.isDesktopMode ? 'bg-amber-50/15' : ''
                      }`}
                    >
                      <td className="px-3.5 py-3 font-bold text-emerald-800">
                        #{idx + 1}
                      </td>

                      <td className="px-3.5 py-3">
                        <div className="font-bold text-gray-900">{c.candidate.name}</div>
                        <div className="text-[11px] text-gray-500 font-mono">
                          {c.candidate.usn || '-'} {c.candidate.department ? `• ${c.candidate.department}` : ''}
                        </div>
                      </td>

                      <td className="px-3.5 py-3">
                        {c.isLimitExceeded ? (
                          <Badge variant="destructive" className="text-[10px] font-black">
                            Limit Exceeded
                          </Badge>
                        ) : c.isLive ? (
                          <Badge className="bg-emerald-600 text-white text-[10px] font-black flex items-center gap-1 w-fit">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                            </span>
                            Live Active
                          </Badge>
                        ) : c.isSubmitted ? (
                          <Badge className="bg-blue-600 text-white text-[10px] font-bold">
                            Submitted
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-gray-500">
                            Not Started
                          </Badge>
                        )}
                      </td>

                      <td className="px-3.5 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          <DeviceBadge
                            deviceLabel={c.deviceName}
                            deviceType={c.deviceType}
                            deviceOs={c.deviceOs}
                            isDesktopMode={c.isDesktopMode}
                            deviceInfo={c.deviceInfo}
                            size="sm"
                          />
                          {c.isDesktopMode && (
                            <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
                              Desktop Site Bypass
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-3.5 py-3 text-center">
                        <span className={`font-mono font-black text-xs ${
                          c.isLimitExceeded
                            ? 'text-rose-600'
                            : c.hasTabViolation
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}>
                          {c.tabSwitches} / {c.maxTabSwitches}
                        </span>
                      </td>

                      <td className="px-3.5 py-3 text-center">
                        <div className="font-mono font-bold text-xs">
                          {c.answeredCount}/{c.totalQuestions} ({c.progressPct}%)
                        </div>
                        <div className="w-20 mx-auto bg-gray-100 rounded-full h-1.5 overflow-hidden border border-gray-200 mt-1">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${c.progressPct}%` }}
                          />
                        </div>
                      </td>

                      <td className="px-3.5 py-3 text-center">
                        {c.isLive ? (
                          <span className={`text-[10px] font-semibold flex items-center justify-center gap-1 ${
                            c.isHeartbeatActive ? 'text-emerald-700' : 'text-gray-500'
                          }`}>
                            {c.isHeartbeatActive ? (
                              <>
                                <Wifi className="h-3 w-3 text-emerald-600 animate-pulse" />
                                <span>Active</span>
                              </>
                            ) : (
                              <>
                                <WifiOff className="h-3 w-3 text-gray-400" />
                                <span>{c.lastActiveFormatted}</span>
                              </>
                            )}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400">-</span>
                        )}
                      </td>

                      <td className="px-3.5 py-3 text-center font-mono text-[11px] text-gray-700">
                        {c.timeElapsedFormatted}
                      </td>

                      <td className="px-3.5 py-3 text-center">
                        <Button
                          size="sm"
                          onClick={() => setSelectedCandidate(c)}
                          className="h-7 w-7 p-0 text-white bg-[#008037] hover:bg-black rounded-lg cursor-pointer flex items-center justify-center transition-colors"
                          title="Inspect Telemetry"
                        >
                          <Eye className="h-4 w-4 text-white" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 5. Deep Inspection Dialog for Selected Candidate */}
      {selectedCandidate && (
        <Dialog open={Boolean(selectedCandidate)} onOpenChange={open => !open && setSelectedCandidate(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-gray-900 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-emerald-600" />
                  <span>Student Live Telemetry Inspector</span>
                </div>
                {selectedCandidate.isLimitExceeded ? (
                  <Badge variant="destructive" className="font-extrabold text-xs">
                    Limit Exceeded
                  </Badge>
                ) : selectedCandidate.isLive ? (
                  <Badge className="bg-emerald-600 text-white font-extrabold text-xs">
                    Live In Progress
                  </Badge>
                ) : selectedCandidate.isSubmitted ? (
                  <Badge className="bg-blue-600 text-white font-extrabold text-xs">
                    Submitted
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-gray-500 font-extrabold text-xs">
                    Not Started
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                Detailed proctoring diagnostics, device fingerprint, tab violations, and real-time question responses.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {/* Student Identity Card */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5">
                <h3 className="text-base font-extrabold text-gray-900">{selectedCandidate.candidate.name}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs text-gray-700 mt-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-500 w-14 shrink-0">USN:</span>
                    <span className="font-medium text-gray-900">{selectedCandidate.candidate.usn || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-500 w-14 shrink-0">Email:</span>
                    <span className="font-medium text-gray-900 truncate" title={selectedCandidate.candidate.email}>{selectedCandidate.candidate.email || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-500 w-14 shrink-0">Dept:</span>
                    <span className="font-medium text-gray-900">{selectedCandidate.candidate.department || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-500 w-14 shrink-0">Section:</span>
                    <span className="font-medium text-gray-900">{selectedCandidate.candidate.section || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Desktop Mode Spoofing Alert Banner */}
              {selectedCandidate.isDesktopMode && (
                <div className="bg-amber-100 border border-amber-300 rounded-xl p-3 text-amber-900 flex items-start gap-2.5">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold text-amber-950">Mobile &quot;Desktop Site&quot; Mode Detected</p>
                    <p className="mt-0.5 text-amber-800">
                      The candidate is using a mobile phone ({selectedCandidate.deviceOs || 'Android/iOS'}) with the browser&apos;s &quot;Desktop Site / Desktop Version&quot; setting turned on to spoof a PC. The detector identified hardware GPU touchpoints and screen dimensions.
                    </p>
                  </div>
                </div>
              )}

              {/* Hardware & Security Telemetry Grid */}
              <div className="bg-white border border-gray-200 rounded-xl p-3.5 space-y-2.5">
                <h4 className="text-xs font-black uppercase text-gray-700 flex items-center gap-1.5">
                  <Monitor className="h-3.5 w-3.5 text-emerald-700" />
                  Device & Hardware Telemetry
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                    <span className="text-[10px] font-semibold text-gray-500 block">Detected Device</span>
                    <span className="font-bold text-gray-900">{selectedCandidate.deviceName}</span>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                    <span className="text-[10px] font-semibold text-gray-500 block">Operating System</span>
                    <span className="font-bold text-gray-900">{selectedCandidate.deviceOs || 'Unknown'}</span>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                    <span className="text-[10px] font-semibold text-gray-500 block">Desktop Mode Bypass</span>
                    <span className={`font-bold ${selectedCandidate.isDesktopMode ? 'text-amber-600' : 'text-emerald-700'}`}>
                      {selectedCandidate.isDesktopMode ? 'YES (Detected)' : 'No (Standard)'}
                    </span>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-lg border border-gray-100 col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-semibold text-gray-500 block">GPU Unmasked Renderer</span>
                    <span className="font-mono text-[10px] text-gray-800 truncate block" title={selectedCandidate.deviceInfo?.gpuRenderer}>
                      {selectedCandidate.deviceInfo?.gpuRenderer || 'N/A'}
                    </span>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                    <span className="text-[10px] font-semibold text-gray-500 block">Max Touch Points</span>
                    <span className="font-bold text-gray-900">{selectedCandidate.deviceInfo?.maxTouchPoints ?? 'N/A'}</span>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                    <span className="text-[10px] font-semibold text-gray-500 block">Screen Resolution</span>
                    <span className="font-mono font-bold text-gray-900">
                      {selectedCandidate.deviceInfo?.screenWidth
                        ? `${selectedCandidate.deviceInfo.screenWidth} × ${selectedCandidate.deviceInfo.screenHeight}`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tab Switch Violations Box */}
              <div className="bg-white border border-gray-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-gray-700 flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
                    Tab Switch Violations Audit
                  </h4>
                  <span className={`font-mono font-extrabold text-sm ${
                    selectedCandidate.isLimitExceeded ? 'text-rose-600' : 'text-emerald-700'
                  }`}>
                    {selectedCandidate.tabSwitches} / {selectedCandidate.maxTabSwitches} switches
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden border border-gray-200">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      selectedCandidate.isLimitExceeded
                        ? 'bg-rose-600'
                        : selectedCandidate.hasTabViolation
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{
                      width: `${Math.min(100, (selectedCandidate.tabSwitches / (selectedCandidate.maxTabSwitches || 1)) * 100)}%`
                    }}
                  />
                </div>
                <p className="text-[11px] text-gray-500">
                  {selectedCandidate.isLimitExceeded
                    ? '⚠️ Candidate reached the maximum permitted tab switches and was locked out or auto-submitted.'
                    : selectedCandidate.hasTabViolation
                    ? `⚠️ Candidate has switched tabs ${selectedCandidate.tabSwitches} time(s). Close monitoring advised.`
                    : '✓ Zero tab switches detected. Full compliance.'}
                </p>
              </div>

              {/* Question by Question Response Matrix */}
              <div className="bg-white border border-gray-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-gray-700 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-emerald-700" />
                    Question Responses Matrix ({selectedCandidate.answeredCount} / {exam.questions.length} answered)
                  </h4>
                  <span className="text-xs font-bold text-emerald-800">{selectedCandidate.progressPct}% Complete</span>
                </div>

                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 pt-1">
                  {exam.questions.map((q, qIndex) => {
                    const ans = selectedCandidate.attempt?.answers?.find(a => a.questionId === q.id);
                    const isAnswered = ans && ans.selectedAnswer !== null && ans.selectedAnswer !== undefined;

                    return (
                      <div
                        key={q.id || qIndex}
                        className={`p-2 rounded-lg text-center border transition-all ${
                          isAnswered
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                            : 'bg-gray-50 border-gray-200 text-gray-400'
                        }`}
                        title={`Q${qIndex + 1}: ${isAnswered ? `Answered (Option ${(ans.selectedAnswer as number) + 1})` : 'Not answered'}`}
                      >
                        <div className="text-[10px] text-gray-500">Q{qIndex + 1}</div>
                        <div className="text-xs font-black mt-0.5">
                          {isAnswered ? `✓` : `○`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <Button
                size="sm"
                onClick={() => setSelectedCandidate(null)}
                className="text-xs font-bold text-white bg-[#008037] hover:bg-black px-4 cursor-pointer"
              >
                Close Inspector
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default LiveExamMonitor;
