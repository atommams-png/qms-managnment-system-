import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "./pages/Landing";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import CreateExam from "./pages/CreateExam";
import EditExam from "./pages/EditExam";
import ExamManage from "./pages/ExamManage";
import CandidateRegister from "./pages/CandidateRegister";
import TakeExam from "./pages/TakeExam";
import ExamResultPage from "./pages/ExamResultPage";
import NotFound from "./pages/NotFound";
import { initStore } from "./lib/store";

initStore();

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/create-exam" element={<CreateExam />} />
          <Route path="/admin/exam" element={<AdminDashboard />} />
          <Route path="/admin/exam/:id" element={<ExamManage />} />
          <Route path="/admin/exam/:id/edit-details" element={<EditExam />} />
          <Route path="/admin/exam/:id/*" element={<ExamManage />} />
          <Route path="/exam/:code/register" element={<CandidateRegister />} />
          <Route path="/exam/:code/take" element={<TakeExam />} />
          <Route path="/exam/:code/result" element={<ExamResultPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
