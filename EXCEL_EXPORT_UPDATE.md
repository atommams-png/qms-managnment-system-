# 📊 Excel Export Update - Complete

## Overview
Updated the result sheet download in ExamManage (Overview) with comprehensive question-level analytics, student details, and strategic data visualization.

---

## 📋 New Sheet Structure (9 Total Sheets)

### **Sheet 1: Summary Dashboard**
- Exam information and statuses
- Statistics (candidates, completion count, pass/fail)
- Performance metrics (average percentage, marks)
- Settings (duration, marks, negative marks, tab switch detection)

### **Sheet 2: Overview Questions** ✨ NEW
**Question-Level Analytics**
| Column | Description |
|--------|-------------|
| # | Question number |
| Question | Question text (truncated) |
| Type | MCQ, True/False, Reading Comprehension |
| **Question Accuracy** | % of correct answers across all students |
| **Avg Time (sec)** | Average time students spent on this question |
| **Correct** | Count of correct responses |
| **Incorrect** | Count of wrong responses |
| **Unattempted** | Count of unattempted/skipped responses |
| Section | Question section/category |
| Marks | Points for this question |

### **Sheet 3: Student Details**
- Student information (Name, Email, College, USN, Department, Section)
- Tab switches count
- Section-wise scores
- Correct/Wrong/Score information
- Submission status (Completed exam / Limit exceed)

### **Sheet 4: Student Questions Details** ✨ NEW
**Per-Student, Per-Question Breakdown with Color-Coding**

**Columns:**
- Name, Email, College, USN, Department, Section, Status
- Q1, Q2, Q3... (one column per question)
- Total Correct, Total Wrong, Total Unattempted

**Answer Indicators:**
- **C** = Green background (Correct answer)
- **W** = Red background (Wrong answer)
- **U** = Yellow background (Unattempted/Skipped)
- **B** = Blue background (Reserved for tab switch markers)

**Example Display:**
```
Name    | Email           | Q1 | Q2 | Q3 | Q4 | Total Correct
--------|-----------------|----|----|----|----|---------------
John    | john@mail.com   | C  | W  | C  | U  | 2
Sarah   | sarah@mail.com  | C  | C  | U  | W  | 2
```
  
### **Sheet 5: Candidates**
- Candidate list with registration details
- Phone, college, USN, department, section
- Registration date
- Whether exam was taken

### **Sheet 6: Questions**
- Full question details
- All options (A, B, C, D)
- Correct answer
- Question type and marks

### **Sheet 7: Performance Analytics**
- Top 5 performers with scores
- Bottom 5 performers needing improvement
- Ranked by percentage

### **Sheet 8: Tab Switch Analysis** 🔍 ENHANCED
| Column | Description |
|--------|-------------|
| Submission Status | "Completed exam" or "Limit exceed" |
| Tab Switches | Number of tab switches detected |
| Max Allowed | System limit (from exam settings) |
| Exceeded | YES if limit was exceeded |
| Q Attempted | Questions answered |
| Q Skipped | Questions not attempted |
| Avg Sec/Q | Average seconds per question |
| Suspicious | YES if limit exceeded (fraud indicator) |
| Risk Level | LOW, MEDIUM, or HIGH |
| Notes | Detailed explanation of submission |

### **Sheet 9: Section-wise Performance**
- Performance breakdown by section
- Questions per section
- Total marks per section
- Average accuracy per section

---

## 🎯 Key Features

### ✅ Data Filtering
- Only shows submissions with status: **"Completed exam"** or **"Limit exceed"**
- Excludes non-submitted attempts
- Filtered throughout all calculations

### 🎨 Color Coding
Answers are color-coded for quick visual analysis:
- **Green**: Correct ✓
- **Red**: Wrong ✗
- **Yellow**: Unattempted ⊘
- **Blue**: Fraud marker (tab switch indicator)

### 📊 Question Analytics
Each question now includes:
- Accuracy percentage
- Average time spent (in seconds)
- Count of correct/incorrect/unattempted responses

### 🚨 Tab Switch Detection
- Clearly identifies submissions exceeding the limit
- Calculates risk level based on switch count
- Provides detailed notes for suspicious submissions

### 👥 Student Question Details
- Detailed per-student analysis
- Visual color indicators for each answer
- Total counts of correct/wrong/unattempted per student

---

## 📥 How to Use

1. **Go to Exam Overview** in Admin Dashboard
2. **Click "Export Excel Report"** button
3. **File downloads automatically** with format: `{ExamName}_Report_{Date}.xlsx`

---

## 🔄 Status Mappings

| Submission Status | Meaning |
|------------------|---------|
| **Completed exam** | Student submitted within allowed tab switches |
| **Limit exceed** | Student exceeded maximum tab switches (fraud indication) |

---

## 📈 Data Calculation Logic

### Question Accuracy
```
Accuracy = (Correct Answers / (Correct + Incorrect)) × 100%
```

### Average Time per Question
```
Average = Total Time Spent / Total Attempts
```

### Risk Level
- **LOW**: 0 or 1-2 tab switches
- **MEDIUM**: 3-5 tab switches
- **HIGH**: 6+ tab switches

---

## 💡 Use Cases

1. **Identify Difficult Questions**: Use Sheet 2 to find questions with low accuracy
2. **Spot Fraudulent Activity**: Use Sheet 8 to identify "Limit exceed" submissions
3. **Student Performance Analysis**: Use Sheet 4 to see patterns in each student's answers
4. **Section Performance**: Use Sheet 9 to evaluate section difficulty
5. **Quick Overview**: Sheet 1 provides instant exam statistics

---

## ✨ What Changed

### New Data Points
✅ Question accuracy per question
✅ Average time per question (across all students)
✅ Unattempted question counts
✅ Per-student question-by-question breakdown
✅ Submission status (Completed / Limit exceed)
✅ Color-coded answer indicators

### Updated Calculations
✅ All sheets now filter by submission status
✅ Analytics use only valid (submitted) attempts
✅ Tab switch detection includes status flag

---

## 🔧 Technical Details

**File**: `src/lib/excelUtils.ts`

**New Functions:**
- `getSubmissionStatus()` - Determines exam submission status
- `getColorForAnswer()` - Returns color code for answers
- `getQuestionStats()` - Calculates question-level statistics

**Updated Function:**
- `exportExamResultsToExcel()` - Enhanced with new sheets and filtering

---

## 📝 Notes

- All color coding follows accessibility best practices
- Yellow used for unattempted (clear visibility on white background)
- Headers use ATOM QMS branding (#008037 green)
- Columns auto-size for readability
- Data filtered consistently across all sheets
