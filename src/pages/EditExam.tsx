import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getAdminSession, getExam, updateExam } from '@/lib/store';
import { ExamSettings } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import Header from '@/components/Header';
import { toast } from 'sonner';
import { getExamScheduleDateParts } from '@/lib/dateUtils';

const EditExam = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const scheduleRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState('');
  const [settings, setSettings] = useState<ExamSettings | null>(null);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const today = new Date().toLocaleDateString('en-CA');

  const isValidDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime());
  };

  const isValidTime = (value: string) => {
    if (!/^\d{2}:\d{2}$/.test(value)) return false;
    const [h, m] = value.split(':').map(Number);
    return h >= 0 && h < 24 && m >= 0 && m < 60;
  };

  useEffect(() => {
    if (!getAdminSession()) {
      navigate('/admin');
      return;
    }

    if (!id) {
      navigate('/admin/dashboard');
      return;
    }

    const loadExam = async () => {
      try {
        const exam = await getExam(id);
        if (!exam) {
          toast.error('Exam not found');
          navigate('/admin/dashboard');
          return;
        }

        setName(exam.name);
        setSettings(exam.settings);

        if (exam.startDateTime) {
          const parts = getExamScheduleDateParts(exam.startDateTime);
          if (parts) {
            setStartDate(parts.date);
            setStartTime(parts.time);
          }
        }

        if (exam.endDateTime) {
          const parts = getExamScheduleDateParts(exam.endDateTime);
          if (parts) {
            setEndDate(parts.date);
            setEndTime(parts.time);
          }
        }

        setIsLoading(false);

        // If arriving via #schedule, scroll after content is loaded.
        if (window.location.hash === '#schedule') {
          setTimeout(() => {
            scheduleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        }
      } catch (error) {
        console.error('Error loading exam:', error);
        toast.error('Error loading exam');
        navigate('/admin/dashboard');
      }
    };

    loadExam();
  }, [id, navigate]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !name.trim() || !settings) {
      toast.error('Please fill all required fields');
      return;
    }

    const exam = await getExam(id);
    if (!exam) {
      toast.error('Exam not found');
      return;
    }

    // Update exam with new details
    if (!startDate || !startTime || !endDate || !endTime) {
      toast.error('Schedule values are required');
      return;
    }

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      toast.error('Enter a valid date');
      return;
    }

    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      toast.error('Enter a valid time');
      return;
    }

    const startDateTime = `${startDate} ${startTime}:00`;
    const endDateTime = `${endDate} ${endTime}:00`;

   const now = new Date();

const todayDate = new Date();
todayDate.setHours(0, 0, 0, 0);

const startDay = new Date(`${startDate}T00:00:00`);
const endDay = new Date(`${endDate}T00:00:00`);

const startDateTimeObj = new Date(`${startDate}T${startTime}:00`);
const endDateTimeObj = new Date(`${endDate}T${endTime}:00`);
    if (startDay.getTime() < todayDate.getTime()) {
      toast.error('Start date cannot be in the past');
      return;
    }

    if (startDay.getTime() === todayDate.getTime() && startDateTimeObj.getTime() <= now.getTime()) {
      toast.error('Start time cannot be in the past');
      return;
    }

    if (endDay.getTime() < todayDate.getTime()) {
      toast.error('End date cannot be in the past');
      return;
    }

    if (endDay.getTime() === todayDate.getTime() && endDateTimeObj.getTime() <= now.getTime()) {
      toast.error('End time cannot be in the past');
      return;
    }

    if (startDate === endDate && endTime <= startTime) {
      toast.error('For same day, end time must be after start time');
      return;
    }

    if (startDateTimeObj.getTime() >= endDateTimeObj.getTime()) {
      toast.error('Start date/time must be before end date/time');
      return;
    }

    const updatedExam = {
      ...exam,
      name: name.trim(),
      settings,
      startDateTime,
      endDateTime,
    };

    try {
      const ok = await updateExam(updatedExam);
      if (!ok) {
        toast.error('Failed to update exam details');
        return;
      }
      toast.success('Exam details updated successfully');
      navigate(`/admin/exam/${id}`);
    } catch (error) {
      toast.error('Error updating exam');
      console.error(error);
    }
  };

  const updateSetting = <K extends keyof ExamSettings>(key: K, value: ExamSettings[K]) => {
    if (settings) {
      setSettings(prev => ({ ...prev, [key]: value }));
    }
  };

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  if (!settings) {
    return <div className="flex min-h-screen items-center justify-center">Error loading exam</div>;
  }

  return (
    <div className="min-h-screen pt-20 bg-background">
      <Header title="Edit Exam Details">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/exam/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </Header>

      <main className="container max-w-2xl py-8 animate-fade-in">
        <form onSubmit={handleUpdate} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Exam Details</CardTitle>
              <CardDescription>Basic information about the exam (admin only)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Exam Name</Label>
                <Input
                  placeholder="e.g. Mathematics Mid-Term"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Duration (minutes)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={settings.duration}
                    onChange={e => updateSetting('duration', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Marks per Question</Label>
                  <Input
                    type="number"
                    min={1}
                    value={settings.marksPerQuestion}
                    onChange={e => updateSetting('marksPerQuestion', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Negative Marks</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.25}
                    value={settings.negativeMarks}
                    onChange={e => updateSetting('negativeMarks', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Question Timer (sec, 0=off)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={settings.questionTimer}
                    onChange={e => updateSetting('questionTimer', Number(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security & Features</CardTitle>
              <CardDescription>Configure exam behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'showResult' as const, label: 'Show Result to Students', desc: 'Students can see results after submission' },
                { key: 'randomOrder' as const, label: 'Random Question Order', desc: 'Shuffle questions for each candidate' },
                { key: 'fullscreenMode' as const, label: 'Fullscreen Mode', desc: 'Force fullscreen during exam' },
                { key: 'tabSwitchDetection' as const, label: 'Tab Switch Detection', desc: 'Detect and log tab switches' },
                { key: 'navigationPanel' as const, label: 'Navigation Panel', desc: 'Show question navigation sidebar' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch
                    checked={settings[key] as boolean}
                    onCheckedChange={v => updateSetting(key, v)}
                  />
                </div>
              ))}
              {settings.tabSwitchDetection && (
                <div className="space-y-2">
                  <Label>Max Tab Switches (auto-submit after)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={settings.maxTabSwitches}
                    onChange={e => updateSetting('maxTabSwitches', Number(e.target.value))}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <div ref={scheduleRef} id="schedule" />
          <Card>
            <CardHeader>
              <CardTitle>Schedule</CardTitle>
              <CardDescription>Set exam availability window</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Exam Start Date</Label>
                <Input
                  type="date"
                  min={today}
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  required
                  inputMode="numeric"
                  pattern="\d{4}-\d{2}-\d{2}"
                />
              </div>
              <div className="space-y-2">
                <Label>Exam Start Time</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  required
                  step={60}
                />
              </div>
              <div className="space-y-2">
                <Label>Exam End Date</Label>
                <Input type="date" min={startDate || today} value={endDate} onChange={e => setEndDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Exam End Time</Label>
                <Input
                  type="time"
                  min={startDate === endDate ? (startTime || '00:00') : '00:00'}
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  required
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" className="flex-1" size="lg">
              Save Changes
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              size="lg"
              onClick={() => navigate(`/admin/exam/${id}`)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default EditExam;
