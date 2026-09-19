import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getExamByCode, getExamAccessStatus, registerCandidate, isDuplicateCandidate } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/Header';

const CandidateRegister = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [accessMessage, setAccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', phone: '', college: '', usn: '', department: '', section: '' });
  const [errors, setErrors] = useState({ name: '', email: '', phone: '' });

  // Load exam data
  useEffect(() => {
    const loadExam = async () => {
      if (!code) return;

      try {
        const access = await getExamAccessStatus(code);

        if (access.status === 'not_started') {
          setAccessMessage('Exam not yet active');
        } else if (access.status === 'expired') {
          setAccessMessage('Exam expired');
        } else if (access.status === 'inactive' || access.status === 'invalid') {
          setAccessMessage('Invalid exam code or inactive exam');
        } else {
          setExam(access.exam);
          setAccessMessage('');
        }
      } catch (error) {
        setAccessMessage('Error loading exam');
        console.error('Error loading exam:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadExam();
  }, [code]);

  const validateName = (name: string) => {
    if (!name.trim()) return 'Name is required';
    if (!/^[a-zA-Z\s'-]+$/.test(name.trim())) return 'Name can only contain letters, spaces, hyphens, and apostrophes';
    if (name.trim().length < 2) return 'Name must be at least 2 characters long';
    return '';
  };

  const validateEmail = (email: string) => {
    if (!email.trim()) return 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) return 'Please enter a valid email address';
    return '';
  };

  const validatePhone = (phone: string) => {
    if (!phone.trim()) return 'Phone number is required';
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone.trim())) return 'Please enter a valid 10-digit phone number starting with 6-9';
    return '';
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Loading exam...</p>
      </div>
    );
  }

  if (accessMessage) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{accessMessage}</p>
        <Button onClick={() => navigate('/')}>Go Home</Button>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Exam not found or inactive</p>
        <Button onClick={() => navigate('/')}>Go Home</Button>
      </div>
    );
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    const nameError = validateName(form.name);
    const emailError = validateEmail(form.email);
    const phoneError = validatePhone(form.phone);

    setErrors({ name: nameError, email: emailError, phone: phoneError });

    if (nameError || emailError || phoneError) {
      toast.error('Please fix the validation errors');
      return;
    }

    if (Object.values(form).some(v => !v.trim())) {
      toast.error('Fill all fields');
      return;
    }

    // Enter fullscreen immediately from the user gesture before any async work starts.
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {
        // Browser may block fullscreen; exam can still proceed.
      });
    }

    // Check for duplicate candidate with same USN and Department
    const isDuplicate = await isDuplicateCandidate(exam.id, form.usn, form.department);
    if (isDuplicate) {
      toast.error('A student with this USN and Department has already registered for this exam');
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
      return;
    }

    const candidate = await registerCandidate({ ...form, examId: exam.id });
    if (candidate) {
      toast.success('Registered! Starting exam...');
      navigate(`/exam/${code}/take`, { state: { candidateId: candidate.id, examId: exam.id } });
    } else {
      toast.error('Registration failed');
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    }
  };

  const update = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (key === 'name') setErrors(prev => ({ ...prev, name: '' }));
    if (key === 'email') setErrors(prev => ({ ...prev, email: '' }));
    if (key === 'phone') setErrors(prev => ({ ...prev, phone: '' }));
  };

  return (
    <div className="min-h-screen pt-20 bg-background">
      <Header title="Register for Exam">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
      </Header>
      <div className="flex items-center justify-center p-4">
        <Card className="w-full max-w-lg animate-fade-in">
          <CardHeader>
            <CardTitle>Candidate Registration</CardTitle>
            <CardDescription>
              Exam: <span className="font-semibold">{exam.name}</span> · {exam.questions.length} questions · {exam.settings.duration} min
            </CardDescription>
          </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { key: 'name', label: 'Full Name', placeholder: 'Atom' },
                { key: 'email', label: 'Email', placeholder: 'atom@example.com', type: 'email' },
                { key: 'phone', label: 'Phone', placeholder: '0123456789', type: 'tel' },
                { key: 'college', label: 'College Name', placeholder: 'ABC University' },
                { key: 'usn', label: 'USN / Roll No', placeholder: '1AB20CS001' },
                { key: 'department', label: 'Department', placeholder: 'Computer Science' },
                { key: 'section', label: 'Section', placeholder: 'A' },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key} className="space-y-2">
                  <Label>{label}</Label>
                  <Input
                    type={type || 'text'}
                    placeholder={placeholder}
                    value={(form as any)[key]}
                    onChange={e => update(key, e.target.value)}
                    required
                    className={errors[key as keyof typeof errors] ? 'border-red-500' : ''}
                  />
                  {errors[key as keyof typeof errors] && (
                    <p className="text-sm text-red-500">{errors[key as keyof typeof errors]}</p>
                  )}
                </div>
              ))}
            </div>
            <Button type="submit" className="w-full" size="lg">Start Exam</Button>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default CandidateRegister;
