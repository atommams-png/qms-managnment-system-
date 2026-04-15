# 📊 Excel Report Sheets - Visual Guide

## Sheet 1: 📊 Summary Dashboard

```
┌────────────────────────────────────────────────────────────┐
│                   📊 EXAM SUMMARY                          │
├────────────────────────────────────────────────────────────┤
│ Exam Name          | Advanced Number Theory                │
│ Exam Code          | ABC1234                              │
│                                                            │
│ 📈 STATISTICS                                             │
│ Total Questions    | 50                                   │
│ Total Candidates   | 100                                  │
│ Candidates Completed | 95                                 │
│ Pass Count (≥50%)  | 72                                   │
│ Fail Count (<50%)  | 23                                   │
│ Pass Percentage    | 75.79%                               │
│                                                            │
│ 🎯 PERFORMANCE                                            │
│ Average Percentage | 68.50%                               │
│ Average Marks      | 34.25/50                             │
│ Highest Score      | 48/50                                │
│ Lowest Score       | 15/50                                │
│                                                            │
│ ⚙️ SETTINGS                                               │
│ Duration (minutes) | 60                                   │
│ Marks per Question | 1                                    │
│ Negative Marks     | 0                                    │
│ Question Timer     | 0 (Off)                              │
│ Fullscreen Mode    | Yes                                  │
│ Tab Switch Detection | Yes                                │
└────────────────────────────────────────────────────────────┘
```

---

## Sheet 2: 📋 Detailed Results

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ 📋 DETAILED RESULTS                                                                 │
├─────┬──────────────┬─────────┬──────────┬────┬───┬───┬──┬────┬──────┬─────┬──────┤
│  #  │ Student Name │ Email   │ USN      │ ✓  │ ✗ │ ? │Mrk│ %  │ Status│ Type │ Tabs │
├─────┼──────────────┼─────────┼──────────┼────┼───┼───┼──┼────┼──────┼─────┼──────┤
│ 1   │ John Doe     │ john@.. │ 1GA21... │ 42 │ 5 │ 3 │ 42│ 84 │ ✅ P │Normal│ 0    │
│ 2   │ Jane Smith   │ jane@.. │ 1GA21... │ 38 │ 8 │ 4 │ 38│ 76 │ ✅ P │Normal│ 1    │
│ 3   │ Mike Jones   │ mike@.. │ 1GA21... │ 28 │ 15│ 7 │ 28│ 56 │ ✅ P │Submitted(3)│ 3 │
│ 4   │ Sarah Brown  │ sar@..  │ 1GA21... │ 18 │ 25│ 7 │ 18│ 36 │ ❌ F │Normal│ 0    │
│ 5   │ Alex Davis   │ ale@..  │ 1GA21... │ 25 │ 18│ 7 │ 25│ 50 │ ✅ P │Submitted(5)│ 5 │
└─────┴──────────────┴─────────┴──────────┴────┴───┴───┴──┴────┴──────┴─────┴──────┘

Color Coding:
🟢 PASS (✅) - Percentage ≥ 50%
🔴 FAIL (❌) - Percentage < 50%

Status Indicators:
✅ P = PASS
❌ F = FAIL
"Normal" = No tab switches
"Submitted(X)" = X tab switches detected
```

---

## Sheet 3: 👥 Candidates List

```
┌──────┬──────────────┬──────────────┬────────────┬──────┬────────┬──────┬──────┬──────────┬──────────┐
│  #   │ Name         │ Email        │ Department │ USN  │ College│ Sec  │Phone │ Reg Date │ Exam Taken│
├──────┼──────────────┼──────────────┼────────────┼──────┼────────┼──────┼──────┼──────────┼──────────┤
│  1   │ John Doe     │ john@col.edu │ CSE        │ 1GA21│ ABC Col│ A    │9876..│2026-03-07│ Yes     │
│  2   │ Jane Smith   │ jane@col.edu │ CSE        │ 1GA21│ ABC Col│ A    │9876..│2026-03-07│ Yes     │
│  3   │ Bob Wilson   │ bob@col.edu  │ ECE        │ 1GA21│ ABC Col│ B    │9876..│2026-03-08│ No      │
│  4   │ Sarah Brown  │ sar@col.edu  │ CSE        │ 1GA21│ ABC Col│ A    │9876..│2026-03-07│ Yes     │
│  5   │ Alex Davis   │ ale@col.edu  │ ME         │ 1GA21│ ABC Col│ C    │9876..│2026-03-09│ Yes     │
└──────┴──────────────┴──────────────┴────────────┴──────┴────────┴──────┴──────┴──────────┴──────────┘

📌 Tracking: Shows which students registered but didn't take exam
```

---

## Sheet 4: ❓ Questions & Options

```
┌───┬────────────────────────┬────────┬─────────┬───┬──────────┬──────────┬──────────┬──────────┬────┐
│ # │ Question               │ Type   │ Section │ M │ Opt A    │ Opt B    │ Opt C    │ Opt D    │Ans│
├───┼────────────────────────┼────────┼─────────┼───┼──────────┼──────────┼──────────┼──────────┼────┤
│ 1 │ What is 2^3 mod 5?     │ MCQ    │ Modular │ 1 │ 1        │ 2        │ 3        │ 4        │ D  │
│ 2 │ Prime number property? │ MCQ    │ Number  │ 1 │ Even     │ Odd      │ Prime    │ Composite│ C  │
│ 3 │ GCD of 12 and 18?      │ MCQ    │ Number  │ 1 │ 2        │ 3        │ 6        │ 12       │ C  │
│ 4 │ LCM definition...      │ MCQ    │ Number  │ 1 │ Minimum  │ Maximum  │ Smallest │ Largest  │ A  │
│ 5 │ Is 17 prime?           │ T/F    │ Prime   │ 1 │ True     │ False    │ -        │ -        │ A  │
└───┴────────────────────────┴────────┴─────────┴───┴──────────┴──────────┴──────────┴──────────┴────┘

Legend: MCQ = Multiple Choice | T/F = True/False | M = Marks | Ans = Correct Answer
```

---

## Sheet 5: 📈 Analytics - Top & Bottom 5

```
┌──────┬──────────────────┬──────────────┬─────────────┬──────────┐
│ Rank │ Type             │ Student      │ Score       │ %        │
├──────┼──────────────────┼──────────────┼─────────────┼──────────┤
│  1   │ Top Performer    │ John Doe     │ 48/50       │ 96%      │
│  2   │ Top Performer    │ Jane Smith   │ 46/50       │ 92%      │
│  3   │ Top Performer    │ Alice Miller │ 45/50       │ 90%      │
│  4   │ Top Performer    │ Bob Lee      │ 43/50       │ 86%      │
│  5   │ Top Performer    │ Sarah Brown  │ 42/50       │ 84%      │
│      │                  │              │             │          │
│  1   │ Need Improvement │ Tom Harris   │ 15/50       │ 30%      │
│  2   │ Need Improvement │ Lisa White   │ 18/50       │ 36%      │
│  3   │ Need Improvement │ Mark Green   │ 22/50       │ 44%      │
│  4   │ Need Improvement │ Emma Davis   │ 25/50       │ 50%      │
│  5   │ Need Improvement │ Jack Wilson  │ 28/50       │ 56%      │
└──────┴──────────────────┴──────────────┴─────────────┴──────────┘

🎯 Use Case: Recognition & Support Planning
```

---

## Sheet 6: 🔍 Tab Switch Analysis

```
┌──────────────┬───────────┬─────────────┬────────┬───────┬────────────┐
│ Student      │ Tab Swit  │ Total Time  │ Score  │Status │ Suspicious │
├──────────────┼───────────┼─────────────┼────────┼───────┼────────────┤
│ John Doe     │ 0         │ 1800s (30m) │ 48/50  │ ✅ P  │ No         │
│ Jane Smith   │ 1         │ 1650s (27m) │ 46/50  │ ✅ P  │ No         │
│ Mike Jones   │ 3         │ 1800s (30m) │ 28/50  │ ✅ P  │ No         │
│ Sarah Brown  │ 0         │ 1500s (25m) │ 18/50  │ ❌ F  │ No         │
│ Alex Davis   │ 8         │ 1400s (23m) │ 25/50  │ ✅ P  │ ⚠️ YES     │
│ Lisa Chen    │ 12        │ 1200s (20m) │ 20/50  │ ❌ F  │ ⚠️ YES     │
│ Tom Harris   │ 2         │ 1750s (29m) │ 15/50  │ ❌ F  │ No         │
└──────────────┴───────────┴─────────────┴────────┴───────┴────────────┘

🚨 WARNING INDICATORS:
- Tab Switches > Max Limit → ⚠️ Flagged as SUSPICIOUS
- Time vs Switches Pattern → Identify cheating attempts
- Score Correlation → Check performance vs switches

Example: Alex Davis (8 switches) at limit, Lisa Chen (12 switches) EXCEEDED limit
```

---

## Sheet 7: 📑 Section-wise Performance

```
┌──────────────────┬───────────┬────────────┬────────────────┐
│ Section          │ Questions │ Total Mark │ Avg % Correct  │
├──────────────────┼───────────┼────────────┼────────────────┤
│ Number Theory    │ 15        │ 15         │ 82%            │
│ Modular Arithm.  │ 12        │ 12         │ 75%            │
│ GCD/LCM          │ 10        │ 10         │ 68%            │
│ Prime Numbers    │ 8         │ 8          │ 85%            │
│ Divisibility     │ 5         │ 5          │ 60%            │
└──────────────────┴───────────┴────────────┴────────────────┘

📊 INTERPRETATION:
High Performance    → Prime Numbers (85%)
Needs Improvement   → Divisibility (60%)

💡 USE: Plan curriculum focus areas
```

---

## 🎨 Color Scheme in Excel

```
HEADER ROWS:
├─ Sheet Names: Dark Blue, White Text
├─ Column Headers: Light Blue, Bold
└─ Section Headers: Green, Bold

DATA ROWS:
├─ PASS (✅): Light Green Background
├─ FAIL (❌): Light Red Background
├─ SUSPICIOUS (⚠️): Light Yellow Background
└─ NORMAL: White Background

TEXT STYLING:
├─ Headers: Bold, 12pt Font
├─ Data: Regular, 11pt Font
├─ Emojis: For quick visual scanning
└─ Numbers: Right-aligned, Bold for important metrics
```

---

## 📋 Complete File Structure Example

```
📂 Advanced_Number_Theory_Report_2026-03-14.xlsx
│
├─ 📊 Summary
│  └─ Exam overview, statistics, settings
│
├─ 📋 Results
│  └─ Student scores, pass/fail, submission type, tab switches
│
├─ 👥 Candidates
│  └─ All registered students, participation status
│
├─ ❓ Questions
│  └─ Question paper with answers
│
├─ 📈 Analytics
│  └─ Top 5 & Bottom 5 performers
│
├─ 🔍 Tab Switches
│  └─ Security analysis, fraud detection data
│
└─ 📑 Sections
   └─ Performance by topic/section
```

---

## 💡 Data Interpretation Guide

### **Summary Dashboard**
- Quick overview of exam performance
- Identify pass rate and average scores
- Check exam settings validity

### **Detailed Results**
- Individual student performance
- Red flag students (FAIL)
- Tab switch patterns
- Submission integrity

### **Candidates List**
- Track registration vs participation
- Identify no-shows
- Contact for feedback

### **Questions**
- Verify question accuracy post-exam
- Reference for disputes
- Analysis for future improvements

### **Analytics**
- Recognize top performers
- Plan intervention for struggling students
- Calibrate difficulty level

### **Tab Switches**
- Detect cheating attempts
- Identify suspicious patterns
- Document exam integrity
- Correlate switches with scores

### **Sections**
- Identify weak topics
- Plan focused teaching
- Balance curriculum
- Benchmark by section

---

## 🚀 Export & Share

**Download Steps:**
1. Exam Management Page
2. Results Tab
3. Click "Export Excel Report"
4. File saves as: `ExamName_Report_YYYY-MM-DD.xlsx`

**Share With:**
- ✅ Faculty for review
- ✅ Administrators for records
- ✅ Students (anonymized sections)
- ✅ Parents for updates
- ✅ Compliance/Audit teams

---

**All 7 sheets provide comprehensive exam analytics in one professional file!** 📊🎉
