# Code Exam Guard - Database Architecture Diagram

## Entity Relationship Diagram (ERD)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DATABASE SCHEMA                              │
└─────────────────────────────────────────────────────────────────────┘

                          ┌──────────────┐
                          │    admins    │
                          ├──────────────┤
                          │ id (PK)      │
                          │ username     │
                          │ password     │
                          │ created_at   │
                          │ updated_at   │
                          └──────────────┘
                                 |
                                 | creates
                                 ↓
                          ┌──────────────┐
                          │    exams     │
                          ├──────────────┤
                          │ id (PK)      │ ◄──────────┐
                          │ name         │            │
                          │ code (UNIQUE)│            │
                          │ settings*    │            │ references
                          │ is_active    │            │
                          │ created_at   │            │
                          └──────────────┘            │
                                 │                     │
                ┌────────────────┼────────────────┐   │
                │                │                │   │
         has (1:M)        has (1:M)          has (1:M)│
                │                │                │   │
                ↓                ↓                ↓   │
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │  questions   │ │  candidates  │ │exam_attempts │
        ├──────────────┤ ├──────────────┤ ├──────────────┤
        │id (PK)       │ │id (PK)       │ │id (PK)       │
        │exam_id (FK)──┼─→│exam_id (FK)──┼─→│exam_id (FK)──┘
        │type          │ │name          │ │candidate_id (FK)
        │text          │ │email         │ │answers (JSON)*
        │image_url     │ │phone         │ │started_at    │
        │options(JSON)*│ │college       │ │submitted_at  │
        │correct_ans   │ │usn (UNIQUE)  │ │tab_switches  │
        │optionImages* │ │department    │ │is_submitted  │
        │display_order │ │registered_at │ └──────────────┘
        └──────────────┘ └──────────────┘        │
                                │                │
                                │         calculates
                                │                │
                                │                ↓
                                │        ┌──────────────┐
                                └───────→│exam_results  │
                                         ├──────────────┤
                                         │id (PK)       │
                                         │attempt_id(FK)◄── unique
                                         │candidate_id  │
                                         │exam_id       │
                                         │correct_ans   │
                                         │wrong_ans     │
                                         │unanswered    │
                                         │total_marks   │
                                         │obtained_marks│
                                         │percentage    │
                                         │calculated_at │
                                         └──────────────┘

* = JSON or aggregated fields
PK = Primary Key
FK = Foreign Key
(1:M) = One-to-Many relationship
```

## Table Details and Cardinality

```
admins (1) ──creates──→ (M) exams
         no delete cascade (preserve admin history)

exams (1) ──contains──→ (M) questions
       cascade delete (delete exam = delete questions)

exams (1) ──registers──→ (M) candidates
      cascade delete (delete exam = remove candidate records)

exams (1) ──has──→ (M) exam_attempts
       cascade delete

candidates (1) ──takes──→ (M) exam_attempts
           cascade delete

exam_attempts (1) ──produces──→ (1) exam_results
             cascade delete, unique constraint

Constraints:
- exams.code → UNIQUE (each exam has unique code)
- candidates → UNIQUE(exam_id, usn, department) (prevent duplicates)
- exam_attempts → UNIQUE(candidate_id, exam_id) (one attempt per exam)
- exam_results → UNIQUE(attempt_id) (one result per attempt)
```

## Data Flow Diagram

```
┌──────────────┐
│   ADMIN      │
│   Creates    │
│   Exam       │
└──────┬───────┘
       │
       ├─→ Exam Config
       │   ├─ Duration
       │   ├─ Marks
       │   ├─ Negative marks
       │   └─ Settings...
       │
       └─→ Add Questions
           ├─ MCQ
           ├─ MCQ with Images
           └─ True/False


┌──────────────┐
│  CANDIDATE   │
│  Registers   │
│  for Exam    │
└──────┬───────┘
       │
       ├─→ Candidate Record
       │   ├─ Name, Email
       │   ├─ USN, Department
       │   └─ College
       │
       └─→ Starts Exam
           └─→ exam_attempt created
               ├─ started_at: NOW()
               ├─ answers: []
               ├─ status: in-progress
               │
               └─→ During Exam
                   ├─ answers JSON updated
                   ├─ tab_switches tracked
                   │
                   └─→ Submit Exam
                       ├─ is_submitted: 1
                       ├─ submitted_at: NOW()
                       │
                       └─→ Calculate Result
                           ├─ exam_results created
                           ├─ Correct answers: count
                           ├─ Wrong answers: count
                           ├─ Marks: calculate
                           ├─ Percentage: calculate
                           │
                           └─→ Show Results
                               ├─ Score
                               ├─ Percentage
                               ├─ Ranking
                               └─ Analytics
```

## Index Strategy

```
Table: admins
├─ PRIMARY KEY (id)
└─ UNIQUE INDEX (username) → Fast login lookups

Table: exams
├─ PRIMARY KEY (id)
├─ UNIQUE INDEX (code) → Fast exam lookup by code
├─ INDEX (is_active) → Filter active exams
└─ INDEX (created_at) → Sort/filter by creation date

Table: questions
├─ PRIMARY KEY (id)
├─ FOREIGN KEY (exam_id) → References exams(id)
├─ INDEX (exam_id) → Find questions for exam
├─ INDEX (type) → Filter by question type
└─ COMPOSITE INDEX (exam_id, display_order) → Order questions

Table: candidates
├─ PRIMARY KEY (id)
├─ FOREIGN KEY (exam_id) → References exams(id)
├─ UNIQUE COMPOSITE INDEX (exam_id, usn, department) → Prevent duplicates
├─ INDEX (exam_id) → Find candidates for exam
├─ INDEX (usn) → Fast student lookup
├─ INDEX (email) → Student email lookup
└─ INDEX (registered_at) → Timeline queries

Table: exam_attempts
├─ PRIMARY KEY (id)
├─ FOREIGN KEY (candidate_id) → References candidates(id)
├─ FOREIGN KEY (exam_id) → References exams(id)
├─ UNIQUE COMPOSITE INDEX (candidate_id, exam_id) → One per exam
├─ INDEX (candidate_id) → Find attempts for student
├─ INDEX (exam_id) → Find attempts for exam
├─ INDEX (is_submitted) → Filter completed exams
└─ INDEX (started_at) → Timeline queries

Table: exam_results
├─ PRIMARY KEY (id)
├─ UNIQUE FOREIGN KEY (attempt_id) → One result per attempt
├─ FOREIGN KEY (candidate_id)
├─ FOREIGN KEY (exam_id)
├─ INDEX (candidate_id) → Student results
├─ INDEX (exam_id) → Exam statistics
├─ INDEX (percentage) → Ranking/sorting by score
└─ INDEX (calculated_at) → Timeline queries
```

## Views Summary

```
┌──────────────────────────────────┐
│   v_candidate_results            │
├──────────────────────────────────┤
│ Joins: exam_results              │
│        + candidates              │
│        + exams                   │
│                                  │
│ Provides: Complete result data   │
│ - Candidate name, email, USN     │
│ - Exam name, code                │
│ - Scores, marks, percentage      │
│ - Timestamps                     │
│                                  │
│ Use: Reports, dashboards, exports│
└──────────────────────────────────┘

┌──────────────────────────────────┐
│   v_exam_statistics              │
├──────────────────────────────────┤
│ Aggregates: exams table          │
│             + candidates         │
│             + questions          │
│             + results            │
│                                  │
│ Provides: Exam-level analytics   │
│ - Total candidates               │
│ - Average percentage             │
│ - Question count                 │
│ - Pass/fail rates                │
│                                  │
│ Use: Admin dashboard, analytics  │
└──────────────────────────────────┘
```

## JSON Field Structures

```
questions.options (JSON Array)
[
  "Option A",
  "Option B",
  "Option C",
  "Option D"
]

questions.option_images (JSON Array)
[
  "data:image/jpeg;base64,...",
  "data:image/jpeg;base64,...",
  "https://example.com/img3.jpg",
  null
]

exam_attempts.answers (JSON Array)
[
  {
    "questionId": "uuid-1",
    "selectedAnswer": 0
  },
  {
    "questionId": "uuid-2",
    "selectedAnswer": null
  },
  {
    "questionId": "uuid-3",
    "selectedAnswer": 2
  }
]
```

## Query Performance Analysis

```
Fast Queries (< 10ms):
├─ Find exam by code: INDEX (code) ✓
├─ Get student by USN: INDEX (usn) ✓
├─ List questions for exam: COMPOSITE INDEX (exam_id, display_order) ✓
├─ Check student result: UNIQUE (attempt_id) ✓
└─ Find active exams: INDEX (is_active) ✓

Medium Queries (10-100ms):
├─ Get exam statistics: GROUP BY with JOINs
├─ List candidates for exam: INDEX (exam_id) ✓
├─ Rank student in exam: ORDER BY percentage (INDEX) ✓
└─ Export results: Full result scan with JOINs

Slow Queries (> 100ms):
├─ Complex analytics: Multiple GROUP BY
├─ Full data exports: Large dataset scans
└─ Historical analysis: Date range queries

Optimization Tips:
├─ Use EXPLAIN to analyze queries
├─ Add covering indexes for frequent queries
├─ Consider materialized views for heavy aggregations
└─ Archive old results to separate table
```

## Backup & Recovery Structure

```
Regular Backup Points:
├─ Full dump: Daily
├─ Incremental: Every 6 hours
└─ Point-in-time: Enabled with binary logs

Recovery Scenarios:
├─ Lost exam: DELETE can be undone with backup
├─ Corrupted result: RecalculateResult() from exam_attempt
├─ Student complained: View audit trail from timestamps
└─ Accidental delete: Restore from backup

Data Integrity Checks:
├─ Foreign keys ensure referential integrity ✓
├─ Unique constraints prevent duplicates ✓
├─ Check constraints validate values
└─ Triggers (optional) for audit trails
```

---

## Legend

```
PK = Primary Key (unique identifier)
FK = Foreign Key (reference to another table)
UNIQUE = Must be unique in the database
INDEX = Database index for faster queries
JSON = JSON-formatted data (flexible structure)
(1:M) = One-to-Many relationship
(1:1) = One-to-One relationship
CASCADE = Delete child records when parent deleted
REFERENCES = Foreign key points to this table
```

---

**Created:** March 2026
**Version:** 1.0
**Last Updated:** When schema was created
