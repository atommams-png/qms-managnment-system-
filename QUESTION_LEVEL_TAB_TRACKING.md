# 📍 Question-Level Tab Switch Tracking - ADDED

## ✨ What's New

The **Tab Switch Analysis sheet** now tracks **which question the tab switch occurred at**!

---

## 🎯 New Question-Related Columns (4 NEW!)

```
BEFORE: No question tracking

AFTER: ⭐ Complete Question Tracking ⭐
├─ Q Attempted        (Total questions attempted)
├─ Q Skipped         (Total questions skipped/not answered)
├─ Approx Q During Switch  (Which question had the switch)
└─ Avg Sec/Q         (Average seconds spent per question)
```

---

## 📊 New Tab Switch Sheet Structure (Now 21 Columns!)

```
Columns 1-7:   Student Information
├─ #
├─ Student Name
├─ USN
├─ Email
├─ College
├─ Department
└─ Section

Columns 8-10:  Security Data
├─ Tab Switches
├─ Max Allowed
└─ Exceeded (✗ YES / ✓ NO)

Columns 11-14: 📍 QUESTION TRACKING (NEW!) ⭐
├─ Q Attempted      (How many answered)
├─ Q Skipped        (How many left blank)
├─ Approx Q During Switch    (Which Q had switch)
└─ Avg Sec/Q        (Time per question)

Columns 15-21: Performance & Status
├─ Total Time (min)
├─ Score
├─ Percentage
├─ Status
├─ Suspicious
├─ Risk Level
└─ Notes (includes question reference)
```

---

## 💡 How It Works

### **Calculation Logic:**

```
1. Count total questions in exam
2. Count questions attempted by student
3. Calculate: Q Skipped = Total - Attempted
4. Calculate: Avg time per question
5. Estimate: Which question during switch
   └─ Formula: (TabSwitches × AvgTimePerQ) / 60 = Approx Question Number
```

### **Example Calculation:**

```
Student: John
├─ Exam has: 50 questions
├─ Total exam time: 30 minutes = 1800 seconds
├─ Avg time per question: 1800 / 50 = 36 seconds
├─ Tab switches: 2
├─ Approx when: (2 × 36) / 60 = 1.2 minutes into exam
├─ Approx Q during: Q1 (in question 1)
└─ Interpretation: Switched tabs very early (during Q1)

Student: Lisa
├─ Exam has: 50 questions
├─ Total exam time: 30 minutes = 1800 seconds
├─ Avg time per question: 1800 / 50 = 36 seconds
├─ Tab switches: 8
├─ Approx when: (8 × 36) / 60 = 4.8 minutes into exam
├─ Approx Q during: Q5 (around question 5)
└─ Interpretation: Switched tabs while answering Q4-Q5
```

---

## 📋 Example Output

```
┌───┬──────────────┬────┬──────┬────┬───┬────────────┬──────┬────────┬─────┬─────────────────┬────────┐
│ # │ Student Name │USN │Email │Col │Sec│Tab Swit..  │Q Att │Q Skip  │Approx Q During..│Avg Sec│
├───┼──────────────┼────┼──────┼────┼───┼────────────┼──────┼────────┼─────┼─────────────────┼────────┤
│ 1 │ John Doe     │1GA │john..│ABC │ A │ 0 (Normal) │ 50   │  0     │ N/A │ 36              │
│ 2 │ Jane Smith   │1GA │jane..│ABC │ A │ 1          │ 50   │  0     │ Q1  │ 36              │
│ 3 │ Mike Jones   │1GA │mike..│ECE │ B │ 8 ⚠️       │ 48   │  2     │ Q5  │ 36              │
│ 4 │ Lisa Chen    │1GA │lis.. │XYZ │ A │ 12 🚨      │ 45   │  5     │ Q7  │ 36              │
│ 5 │ Tom Harris   │1GA │tom.. │XYZ │ C │ 3          │ 35   │ 15     │ Q2  │ 51              │
└───┴──────────────┴────┴──────┴────┴───┴────────────┴──────┴────────┴─────┴─────────────────┴────────┘
```

**Analysis:**
```
John:  No switches (normal submission)
Jane:  1 switch during Q1 (early distraction)
Mike:  8 switches during Q5 (mid-exam issues, but answered most)
Lisa:  12 switches during Q7 + 5 skipped (major distraction)
Tom:   3 switches, slower pace (51 sec/Q), but low engagement (15 skipped)
```

---

## 🔍 What Each Column Shows

### **Q Attempted**
```
Shows: How many questions student actually answered

Example: 50 out of 50
         48 out of 50 (2 left blank)
         35 out of 50 (15 skipped)

Use: Identify disengagement
     High skipped = not completing exam
```

### **Q Skipped**
```
Shows: How many questions left blank

Example: 0 (completed all)
         2 (rushed, missed 2)
         5 (distracted, incomplete)
        15 (major disengagement)

Use: Identify incomplete attempts
     High skip = not focusing on exam
```

### **Approx Q During Switch** ⭐ KEY COLUMN
```
Shows: Which question approximates when switch occurred

Example: Q1   = Very early (in question 1)
         Q5   = Early-mid exam
         Q15  = Mid exam
         Q25  = Late mid exam
         Q45  = Near end

Use: Pinpoint when distraction happened
     Early switches = Less impact
     Late switches = More questions affected
```

### **Avg Sec/Q**
```
Shows: Average seconds spent per question

Example: 30 sec/Q = Fast pace
         36 sec/Q = Normal pace
         50 sec/Q = Slow, careful
         60+ sec/Q = Very slow, confused

Analysis with Tab Switches:
├─ Fast + Many switches = Rushing, distracted
├─ Normal + Many switches = Intermittent issues
├─ Slow + Many switches = Struggling + confused
└─ Slow + No switches = Genuinely working hard
```

---

## 💡 Real-World Analysis Examples

### **Example 1: Tab Switch Early in Exam**

```
Student: John
├─ Tab Switches: 3
├─ Approx Q During: Q2
├─ Q Attempted: 50/50 (all answered)
├─ Avg Sec/Q: 35 seconds
├─ Score: 45/50 (90%)
├─ Status: ✅ PASS

Analysis:
✓ Early switch (Q2) = minor issue
✓ Completed all questions = focused after switch
✓ Good time per question = not rushing
✓ High score = switches didn't impact grade

Conclusion: Normal submission with temporary distraction
Action: ACCEPT - Minor issue, good recovery
```

### **Example 2: Tab Switch During Middle Questions**

```
Student: Mike
├─ Tab Switches: 8
├─ Approx Q During: Q20
├─ Q Attempted: 48/50 (skipped 2)
├─ Avg Sec/Q: 30 seconds
├─ Score: 42/50 (84%)
├─ Status: ✅ PASS

Analysis:
⚠️ Multiple switches mid-exam (Q20) = concerning
⚠️ Skipped 2 questions = incomplete
⚠️ Fast pace (30 sec/Q) = possible rushing
✓ High score anyway = still good

Conclusion: Distracted mid-exam but managed well
Action: MONITOR - Flag for re-exam if pattern continues
```

### **Example 3: Tab Switch Late + Low Engagement**

```
Student: Lisa
├─ Tab Switches: 12 🚨
├─ Approx Q During: Q35
├─ Q Attempted: 35/50 (skipped 15!)
├─ Avg Sec/Q: 25 seconds
├─ Score: 20/50 (40%)
├─ Status: ❌ FAIL

Analysis:
🚨 Many switches late-exam (Q35) = major issue
🚨 Skipped 15 questions = disengaged
🚨 Very fast (25 sec/Q) = rushing/panicking
🚨 Low score = affected grade significantly

Conclusion: Major security concern + poor performance
Action: INVESTIGATE - Possible cheating attempt that failed
        OR student overwhelmed/confused
```

### **Example 4: No Switches but Questions Skipped**

```
Student: Tom
├─ Tab Switches: 0 ✓
├─ Q Attempted: 40/50 (skipped 10)
├─ Avg Sec/Q: 45 seconds
├─ Score: 25/50 (50%)
├─ Status: ✅ PASS (barely)

Analysis:
✓ No switches = focused, no cheating
⚠️ Skipped 10 questions = didn't attempt
⚠️ Slow pace (45 sec/Q) = struggling
⚠️ Marginal pass = poor understanding

Conclusion: Struggling student, not cheating
Action: SUPPORT - Offer tutoring/remedial help
        Academic support needed, not disciplinary
```

---

## 📊 Interpretation Guide

### **Tab Switch Timing vs Impact:**

```
Switch at Q1-Q5:
├─ Timing: Very early
├─ Impact: Minimal (many questions left)
└─ Risk: LOW (if switches ≤ 3)

Switch at Q15-Q25:
├─ Timing: Mid exam
├─ Impact: Moderate (half exam affected)
└─ Risk: MEDIUM (if switches 3-8)

Switch at Q35-Q50:
├─ Timing: Late exam
├─ Impact: High (few questions left)
└─ Risk: HIGH (if switches ≥ 8)
```

### **Skipped Questions Pattern:**

```
0-2 skipped:   ✓ Excellent engagement
3-5 skipped:   ✓ Good completion
6-10 skipped:  ⚠️ Some disengagement
11+ skipped:   🚨 Major disengagement (needs review)
```

---

## 🎯 Admin Action Guide

### **When You See Tab Switches:**

```
STEP 1: Check "Approx Q During Switch"
├─ Early Q (1-10)? → Probably OK, minor distraction
├─ Mid Q (15-35)? → Concerning, investigate
└─ Late Q (40-50)? → High risk, review now

STEP 2: Check "Q Skipped"
├─ 0 skipped? → Despite switches, completed exam (focused)
├─ 5+ skipped? → Distraction affected performance
└─ 10+ skipped? → Major disengagement (flag)

STEP 3: Compare Score vs Risk
├─ High switches + High score? → Suspicious (external help?)
├─ High switches + Low score? → Either overwhelmed or cheating failed
└─ High switches + Normal score? → Distracted but manageable

STEP 4: Make Decision
├─ LOW risk: ACCEPT
├─ MEDIUM risk: MONITOR (watch pattern in future)
└─ HIGH risk: INVESTIGATE / REVIEW
```

---

## 📊 New Notes Column Enhancement

The **Notes** column now automatically includes question reference:

```
BEFORE:
"Exceeded by 5 switches"

AFTER:
"Exceeded by 5 switches near Q20" ⭐
"Exceeded by 9 switches near Q35" ⭐
"Normal submission"
```

This helps instantly see WHERE during the exam the issue occurred!

---

## 🎁 Benefits

✅ **Pinpoint When Switches Occurred** - Know which question
✅ **Completion Analysis** - See what was skipped
✅ **Pace Assessment** - Understand answer speed
✅ **Pattern Recognition** - Identify cheating vs distraction
✅ **Automated Notes** - Questions mentioned in notes
✅ **Risk Scoring** - Better fraud detection
✅ **Timeline Context** - When during exam happened

---

## 📈 Complete 21-Column Sheet Now Includes:

```
Student Details (7 columns):
✓ Name, USN, Email, College, Dept, Section

Security Data (3 columns):
✓ Tab Switches, Max Allowed, Exceeded

📍 QUESTION TRACKING (4 NEW columns):
✓ Q Attempted - Questions answered
✓ Q Skipped - Questions not answered
✓ Approx Q During Switch - Which question number
✓ Avg Sec/Q - Time per question

Performance (7 columns):
✓ Total Time, Score, Percentage, Status
✓ Suspicious, Risk Level, Notes (with Q reference)
```

---

## 🚀 How to Use in Excel

### **Quick Analysis:**

1. **Find Problem Students:**
   ```
   Sort by: Approx Q During Switch (ascending)
   ↓
   See who switched early (Q1-5) vs late (Q40-50)
   ```

2. **Identify Disengagement:**
   ```
   Sort by: Q Skipped (descending)
   ↓
   See who didn't complete exam
   ```

3. **Detect Rushing:**
   ```
   Filter: Avg Sec/Q < 20 AND Tab Switches > 3
   ↓
   Find students rushing + distracted
   ```

4. **Find Suspicious Patterns:**
   ```
   Filter: Tab Switches > Max AND Score ≥ 80%
   ↓
   High switches but perfect score = possible help
   ```

---

## 📝 Example Reports

### **Report: "Which Question Caused Issues?"**

```
| Student | Switch # | At Question | Q Skipped | Score | Status |
|---------|----------|-------------|-----------|-------|--------|
| John    | 0        | None        | 0         | 45/50 | PASS   |
| Jane    | 1        | Q5          | 0         | 46/50 | PASS   |
| Mike    | 8        | Q20         | 2         | 42/50 | PASS   |
| Lisa    | 12       | Q35         | 5         | 20/50 | FAIL   |

Insight: Lisa's late-exam switches (Q35) correlates with skipped (5) + low score
```

### **Report: "Engagement Quality"**

```
High Engagement (0-2 q Skipped):
├─ John: 0 switches, 50/50 answered ✓
├─ Jane: 1 switch, 50/50 answered ✓
└─ Mike: 8 switches, 48/50 answered ✓

Low Engagement (5+ Q Skipped):
└─ Lisa: 12 switches, 35/50 answered (15 skipped) 🚨
```

---

## ✅ Features Summary

**Now You Can Track:**
✅ How many questions student attempted
✅ How many questions were skipped
✅ At which question the tab switch occurred
✅ Average time spent per question
✅ Complete timeline of exam attempt
✅ Correlation between switches and completion
✅ Automatic notes with question reference

---

## 🎯 Next Export Will Include:

```
✓ All 21 columns (was 17)
✓ Question-level tracking
✓ Skipped question count
✓ Approximate switch timing
✓ Auto-generated notes with Q reference
✓ Complete engagement analysis
```

---

**Update Complete!** 🎉

Your Tab Switch sheet now has **complete question-level tracking**, allowing you to see exactly which question the student was on when they switched tabs!

Next export will automatically include all question tracking data!
