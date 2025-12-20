# Data Model Design Document

**Version:** 3.0
**Last Updated:** 2025-12-19

---

## 1. Overview

This document defines all data structures used in TeachingHelp, including local storage schemas, Google Drive file formats, and the synchronization strategy between them.

### 1.1 Core Hierarchy

```
Academic Year (2024-2025)
└── Course (Earth Science)
    ├── Standards (NGSS standards for this course)
    ├── Units (curriculum backbone)
    │   └── Unit (Plate Tectonics)
    │       └── Assessments (test/quiz definitions)
    └── Sections (groups of students)
        └── Section (Period 1)
            ├── Roster (students)
            └── Assignments (when assessments are given)
                ├── Scantrons
                └── Grades
```

**Key Concepts:**
- **Course** = Curriculum container (what you teach)
- **Section** = Student group (who you teach it to)
- Assessments are created at the Course level, then assigned to Sections
- A teacher may have multiple Sections of the same Course

### 1.2 Storage Locations

| Storage Type | Location | Purpose |
|--------------|----------|---------|
| Local Settings | electron-store | App config, preferences |
| Secure Storage | electron-store (encrypted) | API keys, OAuth tokens |
| Local Cache | electron-store | Cached Drive data |
| Local Drafts | electron-store | Assessment drafts before publish |
| Google Drive | User's Drive | Courses, rosters, assessments, grades |

### 1.3 Key Design Principles

- **Course/Section separation**: Curriculum is shared, rosters are per-section
- **No stored student labels**: Student records contain only identification data
- **Assessment-specific differentiation**: Variants are assigned per-assessment, not per-student
- **Unit-centric organization**: Units serve as the organizational backbone
- **Future-proof for sharing**: Data model supports collaboration (not implemented in MVP)

---

## 2. Local Storage Schema

### 2.1 Settings (Unencrypted)

```typescript
interface LocalSettings {
  // App preferences
  theme: 'dark' | 'light';
  language: 'en';

  // LLM preferences
  llm: {
    defaultProvider: 'openai' | 'anthropic' | 'google';
    defaultModel: string;
    temperature: number;
  };

  // UI preferences
  ui: {
    sidebarCollapsed: boolean;
    lastOpenedCourse: string | null;
    lastOpenedSection: string | null;
    recentCourses: string[];
  };

  // Sync preferences
  sync: {
    autoSyncOnStart: boolean;
    syncIntervalMinutes: number;
    showSyncIndicator: boolean;
  };

  // Window state
  window: {
    width: number;
    height: number;
    x: number | null;
    y: number | null;
    isMaximized: boolean;
  };
}

const DEFAULT_SETTINGS: LocalSettings = {
  theme: 'dark',
  language: 'en',
  llm: {
    defaultProvider: 'openai',
    defaultModel: 'gpt-4',
    temperature: 0.7,
  },
  ui: {
    sidebarCollapsed: false,
    lastOpenedCourse: null,
    lastOpenedSection: null,
    recentCourses: [],
  },
  sync: {
    autoSyncOnStart: true,
    syncIntervalMinutes: 0,
    showSyncIndicator: true,
  },
  window: {
    width: 1200,
    height: 800,
    x: null,
    y: null,
    isMaximized: false,
  },
};
```

### 2.2 Secure Storage (Encrypted)

```typescript
interface SecureStorage {
  // OAuth
  oauth: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    scope: string[];
  } | null;

  // LLM API Keys
  apiKeys: {
    openai?: string;
    anthropic?: string;
    google?: string;
  };

  // User info (from Google)
  user: {
    id: string;
    email: string;
    name: string;
    picture?: string;
  } | null;
}
```

### 2.3 Cache Storage

```typescript
interface CacheStorage {
  // Sync metadata
  syncMeta: {
    [key: string]: {
      version: number;
      lastSynced: number;
      driveFileId: string;
    };
  };

  // Cached course list
  courses: CourseSummary[];
  coursesLastSync: number;

  // Cached course data (keyed by courseId)
  courseData: {
    [courseId: string]: {
      course: Course;
      sections: SectionSummary[];
      units: UnitSummary[];
      standards: Standards[];          // Array to support multiple collections
    };
  };

  // Cached section data (keyed by sectionId)
  sectionData: {
    [sectionId: string]: {
      section: Section;
      roster: Roster;
      assignments: AssignmentSummary[];
    };
  };
}

interface CourseSummary {
  id: string;
  name: string;
  subject: string;
  gradeLevel: string;
  academicYear: string;
  sectionCount: number;
  lastModified: number;
  driveFolderId: string;
}

interface SectionSummary {
  id: string;
  courseId: string;
  name: string;
  studentCount: number;
  schedule?: string;
}

interface UnitSummary {
  id: string;
  name: string;
  order: number;
  assessmentCount: number;
}

interface AssignmentSummary {
  id: string;
  assessmentId: string;
  assessmentTitle: string;
  assessmentType: AssessmentType;
  dueDate: string;
  status: AssignmentStatus;
}
```

### 2.4 Draft Storage

```typescript
interface DraftStorage {
  assessmentDrafts: {
    [draftId: string]: AssessmentDraft;
  };
}

interface AssessmentDraft {
  id: string;
  courseId: string;
  unitId: string | null;
  title: string;
  type: AssessmentType;
  createdAt: number;
  updatedAt: number;
  status: 'draft' | 'editing' | 'ready_to_publish';

  assessment: Assessment;

  history: AssessmentSnapshot[];
  historyIndex: number;

  // If editing a published assessment
  sourceAssessmentId?: string;
  sourceVersion?: number;
}

interface AssessmentSnapshot {
  timestamp: number;
  assessment: Assessment;
  description: string;
}
```

---

## 3. Google Drive File Formats

### 3.1 Folder Structure

```
/TeachingHelp/
├── config.json                           # App-level config
│
└── years/
    └── 2024-2025/                        # Academic year folder
        └── courses/
            └── {course-id}/              # e.g., "earth-science"
                ├── meta.json             # Course metadata
                ├── standards/
                │   ├── standards.json    # Parsed standards
                │   └── source/           # Original PDFs
                ├── units/
                │   └── {unit-id}/
                │       ├── meta.json     # Unit metadata
                │       └── assessments/
                │           └── {assessment-id}.json
                ├── materials/            # Teaching materials
                │   └── ...
                └── sections/
                    └── {section-id}/     # e.g., "period-1"
                        ├── meta.json     # Section metadata
                        ├── roster.json   # Student list
                        ├── assignments/
                        │   └── {assignment-id}.json
                        └── grades/
                            └── {assignment-id}-grades.json
```

### 3.2 App Config (config.json)

```typescript
interface AppConfig {
  version: number;
  createdAt: string;
  owner: {
    id: string;
    email: string;
    name: string;
  };
  // Future: collaborators for sharing feature
  collaborators?: Collaborator[];
}

interface Collaborator {
  id: string;
  email: string;
  name: string;
  role: 'viewer' | 'editor';
  addedAt: string;
}
```

### 3.3 Course (meta.json)

```typescript
interface Course {
  id: string;
  name: string;                    // "Earth/Space Science"
  subject: string;                 // "Science"
  gradeLevel: string;              // "6" or "6-8"
  description?: string;
  academicYear: string;            // "2024-2025"

  // Future: for sharing feature
  ownerId: string;
  collaboratorIds?: string[];

  createdAt: string;
  updatedAt: string;
  version: number;
}
```

### 3.4 Section (sections/{section-id}/meta.json)

```typescript
interface Section {
  id: string;
  courseId: string;                // Links to parent course
  name: string;                    // "Period 1", "Block A", etc.
  schedule?: string;               // "MWF 8:00-8:50"
  room?: string;                   // "Room 204"

  createdAt: string;
  updatedAt: string;
  version: number;
}
```

### 3.5 Roster (sections/{section-id}/roster.json)

Students can only be in one section per course.

```typescript
interface Roster {
  sectionId: string;
  version: number;
  updatedAt: string;
  students: Student[];
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  studentNumber?: string;          // School-assigned ID
  notes?: string;                  // Teacher's private notes
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 3.6 Unit (units/{unit-id}/meta.json)

```typescript
interface Unit {
  id: string;
  courseId: string;
  name: string;
  description?: string;
  order: number;                   // Display order
  standardRefs: string[];          // e.g., ["MS-ESS2-1", "MS-ESS2-2"]
  estimatedDays?: number;          // Rough planning aid

  createdAt: string;
  updatedAt: string;
  version: number;
}
```

### 3.7 Standards (standards/{standards-id}.json)

> **PLANNED CHANGE:** The current implementation supports only one standards collection
> per course (stored as `standards/standards.json`). This will be refactored to support
> **multiple standards collections** per course, allowing teachers to import standards
> from multiple sources (e.g., NGSS + state-specific standards, or physics + chemistry
> for a combined course). Each collection will have its own ID, source, and metadata.
> The folder structure will change from a single file to multiple files keyed by ID.

```typescript
interface Standards {
  id: string;                      // Unique identifier (NEW)
  courseId: string;
  version: number;
  updatedAt: string;

  source: StandardsSource;

  name: string;                    // Display name for this collection (NEW)
  state: string;                   // "Kansas"
  subject: string;                 // "Science"
  gradeLevel: string;              // "6-8"
  framework: string;               // "NGSS"

  domains: StandardDomain[];
}

interface StandardsSource {
  type: 'url' | 'pdf' | 'manual';
  url?: string;
  filename?: string;
  fetchedAt: string;
}

interface StandardDomain {
  code: string;                    // "MS-ESS2"
  name: string;                    // "Earth's Systems"
  description?: string;
  clusters?: StandardCluster[];
  standards: Standard[];
}

interface StandardCluster {
  code: string;
  name: string;
}

interface Standard {
  code: string;                    // "MS-ESS2-1"
  description: string;
  keywords: string[];
  cluster?: string;
  notes?: string;
}
```

### 3.8 Assessment (units/{unit-id}/assessments/{assessment-id}.json)

Master assessment definition - created at course level, assigned to sections.

```typescript
type AssessmentType =
  | 'test'
  | 'quiz'
  | 'exam'
  | 'benchmark'
  | 'pretest'
  | 'exit_ticket';

interface Assessment {
  id: string;
  courseId: string;
  unitId?: string;

  type: AssessmentType;
  title: string;
  description?: string;
  purpose: 'formative' | 'summative';

  sourceMaterials?: string[];      // Reference materials used

  questions: Question[];
  variants: AssessmentVariants;
  versions: TestVersions;

  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  version: number;
}
```

### 3.9 Question Types

```typescript
type Question =
  | MultipleChoiceQuestion
  | TrueFalseQuestion
  | MatchingQuestion
  | NumericFillInQuestion;

type QuestionType = 'multiple_choice' | 'true_false' | 'matching' | 'numeric_fill_in';

interface BaseQuestion {
  id: string;
  type: QuestionType;
  text: string;
  figure?: QuestionFigure;
  topic?: string;
  standardRef?: string;
  points: number;
  createdAt: string;
}

interface QuestionFigure {
  type: 'image' | 'diagram' | 'table';
  url: string;
  alt: string;
  caption?: string;
}

interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'multiple_choice';
  choices: Choice[];
  correctAnswer: string;
}

interface Choice {
  id: string;                      // 'a', 'b', 'c', 'd'
  text: string;
  isCorrect: boolean;
}

interface TrueFalseQuestion extends BaseQuestion {
  type: 'true_false';
  correctAnswer: boolean;
}

interface MatchingQuestion extends BaseQuestion {
  type: 'matching';
  prompt: string;
  pairs: MatchingPair[];
  correctAnswers: Record<string, string>;
}

interface MatchingPair {
  leftId: string;
  leftText: string;
  rightId: string;
  rightText: string;
}

interface NumericFillInQuestion extends BaseQuestion {
  type: 'numeric_fill_in';
  correctAnswer: number;
  tolerance?: number;
  unit?: string;
}
```

### 3.10 Assessment Variants (UDL Support)

```typescript
interface AssessmentVariants {
  enabled: boolean;
  variants: AssessmentVariant[];
}

interface AssessmentVariant {
  id: string;
  name: string;                    // Teacher-facing only
  description: string;
  config: VariantConfig;
  questionIds: string[];           // Which questions included
}

interface VariantConfig {
  fontSize?: 'normal' | 'large' | 'extra-large';
  modifications: QuestionModification[];
}

interface QuestionModification {
  questionId: string;
  textOverride?: string;
  choicesOverride?: Choice[];
  hintsAdded?: string[];
}
```

### 3.11 Test Versions (Randomization)

```typescript
interface TestVersions {
  base: VersionSet;
  byVariant: {
    [variantId: string]: VersionSet;
  };
}

interface VersionSet {
  enabled: boolean;
  versions: TestVersion[];
}

interface TestVersion {
  versionId: 'A' | 'B' | 'C' | 'D';
  seed: number;
  questionOrder: string[];
  choiceOrders: Record<string, string[]>;
  answerKey: AnswerKey;
}

interface AnswerKey {
  [questionNumber: number]: {
    questionId: string;
    correctAnswer: string | boolean | Record<string, string> | number;
    questionType: QuestionType;
  };
}
```

### 3.12 Assignment (sections/{section-id}/assignments/{assignment-id}.json)

When an assessment is given to a specific section.

```typescript
type AssignmentStatus =
  | 'draft'           // Not yet assigned
  | 'assigned'        // Given to students
  | 'collecting'      // Collecting responses
  | 'grading'         // Grading in progress
  | 'graded';         // Complete

interface Assignment {
  id: string;
  sectionId: string;
  assessmentId: string;

  assignedDate?: string;           // When assigned (ISO date)
  dueDate?: string;                // When due (ISO date)
  status: AssignmentStatus;

  studentAssignments: StudentAssignment[];

  createdAt: string;
  updatedAt: string;
  version: number;
}

interface StudentAssignment {
  studentId: string;
  variantId?: string;              // null = base assessment
  versionId: 'A' | 'B' | 'C' | 'D';
}
```

### 3.13 Grade Records (sections/{section-id}/grades/{assignment-id}-grades.json)

```typescript
interface AssignmentGrades {
  assignmentId: string;
  sectionId: string;
  assessmentId: string;
  gradedAt: string;

  records: GradeRecord[];
  stats: GradeStats;
}

interface GradeRecord {
  id: string;
  studentId: string;
  assignmentId: string;
  variantId?: string;
  versionId: 'A' | 'B' | 'C' | 'D';

  gradedAt: string;
  scannedAt: string;

  rawScore: number;
  totalQuestions: number;
  percentage: number;
  points: number;
  maxPoints: number;

  answers: AnswerResult[];

  flags: GradeFlag[];
  needsReview: boolean;
  reviewNotes?: string;

  scantronPageNumber: number;
  scantronFileId?: string;
}

interface AnswerResult {
  questionNumber: number;
  questionId: string;
  questionType: QuestionType;
  selected: string | string[] | boolean | number | null;
  confidence: number;
  correct: boolean;
  partialCredit?: number;
  multipleSelected: boolean;
  unclear: boolean;
}

interface GradeFlag {
  type: 'multiple_bubbles' | 'no_answer' | 'qr_error' | 'variant_mismatch' | 'low_confidence';
  questionNumber?: number;
  message: string;
}

interface GradeStats {
  totalStudents: number;
  averageScore: number;
  medianScore: number;
  highScore: number;
  lowScore: number;
  standardDeviation: number;

  byVariant: Record<string, {
    count: number;
    average: number;
  }>;

  byQuestion: Record<string, {
    correctCount: number;
    incorrectCount: number;
    skippedCount: number;
    percentCorrect: number;
  }>;

  byStandard: Record<string, {
    questionCount: number;
    averageCorrect: number;
  }>;
}
```

### 3.14 Scantron Data

```typescript
interface ScantronGenerationRequest {
  assignmentId: string;
  sectionId: string;
  options: ScantronOptions;
}

interface ScantronOptions {
  paperSize: 'letter' | 'a4';
  includeNameField: boolean;
  includeInstructions: boolean;
  bubbleStyle: 'circle' | 'oval';
}

interface ScantronQRData {
  v: 1;                            // Schema version
  sid: string;                     // Student ID
  secid: string;                   // Section ID
  aid: string;                     // Assignment ID
  ver: 'A' | 'B' | 'C' | 'D';
  var?: string;                    // Variant ID
  dt: string;                      // Date
  qc: number;                      // Question count
}

interface ParsedScantron {
  pageNumber: number;
  success: boolean;
  qrData: ScantronQRData | null;
  qrError?: string;
  answers: DetectedBubble[];
  confidence: number;
  processingTimeMs: number;
  flags: string[];
}

interface DetectedBubble {
  questionNumber: number;
  row: number;
  column: number;
  bubbles: {
    id: string;
    filled: boolean;
    confidence: number;
  }[];
  selected: string | null;
  multipleDetected: boolean;
}
```

---

## 4. TypeScript Type Definitions

### 4.1 File Structure

```
src/shared/types/
├── index.ts                 # Re-exports all types
├── common.types.ts          # Shared utilities
├── settings.types.ts        # Local settings
├── auth.types.ts            # Authentication
├── course.types.ts          # Course definitions
├── section.types.ts         # Section definitions
├── roster.types.ts          # Student roster
├── unit.types.ts            # Unit definitions
├── standards.types.ts       # Teaching standards
├── assessment.types.ts      # Assessment definitions
├── question.types.ts        # Question types
├── variant.types.ts         # Assessment variants
├── assignment.types.ts      # Assignments
├── grade.types.ts           # Grading
├── scantron.types.ts        # Scantron generation/parsing
├── analytics.types.ts       # Analytics/reports
└── api.types.ts             # Service API interfaces
```

### 4.2 Common Types

```typescript
// Branded types for IDs
type Brand<K, T> = K & { __brand: T };

export type StudentId = Brand<string, 'StudentId'>;
export type CourseId = Brand<string, 'CourseId'>;
export type SectionId = Brand<string, 'SectionId'>;
export type UnitId = Brand<string, 'UnitId'>;
export type AssessmentId = Brand<string, 'AssessmentId'>;
export type AssignmentId = Brand<string, 'AssignmentId'>;
export type QuestionId = Brand<string, 'QuestionId'>;
export type VariantId = Brand<string, 'VariantId'>;

// Result type
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

// Pagination
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Base interfaces
export interface Timestamps {
  createdAt: string;
  updatedAt: string;
}

export interface Versioned {
  version: number;
}

export interface Entity extends Timestamps, Versioned {
  id: string;
}

// Assessment purpose
export type AssessmentPurpose = 'formative' | 'summative';
```

---

## 5. Sync Strategy

### 5.1 Sync State Machine

```
┌──────────────────────────────────────────────────────┐
│                 Sync State Machine                    │
├──────────────────────────────────────────────────────┤
│                                                       │
│                    ┌──────────┐                       │
│                    │  SYNCED  │                       │
│                    └────┬─────┘                       │
│                         │                             │
│          ┌──────────────┼──────────────┐             │
│          ▼              ▼              ▼              │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│    │ LOCAL    │  │ REMOTE   │  │ CHECKING │         │
│    │ CHANGE   │  │ CHANGE   │  │          │         │
│    └────┬─────┘  └────┬─────┘  └────┬─────┘         │
│         │             │             │                 │
│         ▼             ▼             ▼                 │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│    │ PUSHING  │  │ PULLING  │  │ COMPARING│         │
│    └────┬─────┘  └────┬─────┘  └────┬─────┘         │
│         │             │             │                 │
│         └─────────────┴──────┬──────┘                │
│                              ▼                        │
│                       ┌──────────┐                   │
│                       │  SYNCED  │                   │
│                       └──────────┘                   │
│                                                       │
│  Error States:                                        │
│  - CONFLICT → Resolve → SYNCED                       │
│  - OFFLINE → Queue → SYNCED when online              │
│  - ERROR → Retry with backoff                        │
│                                                       │
└──────────────────────────────────────────────────────┘
```

### 5.2 Conflict Resolution

```typescript
interface SyncConflict {
  type: 'version_conflict' | 'deleted_remotely' | 'deleted_locally';
  entityType: 'course' | 'section' | 'roster' | 'assessment' | 'assignment' | 'unit';
  entityId: string;
  localVersion: number;
  remoteVersion: number;
  localData: unknown;
  remoteData: unknown;
}

type ConflictResolution =
  | { strategy: 'use_local' }
  | { strategy: 'use_remote' }
  | { strategy: 'merge'; mergedData: unknown }
  | { strategy: 'duplicate'; keepBoth: true };
```

### 5.3 Cache TTL

```typescript
const CACHE_TTL = {
  courses: 5 * 60 * 1000,        // 5 minutes
  sections: 5 * 60 * 1000,       // 5 minutes
  roster: 5 * 60 * 1000,         // 5 minutes
  standards: 60 * 60 * 1000,     // 1 hour
  units: 5 * 60 * 1000,          // 5 minutes
  assessments: 5 * 60 * 1000,    // 5 minutes
  assignments: 5 * 60 * 1000,    // 5 minutes
  grades: 0,                     // Always fresh
};
```

---

## 6. Data Validation

### 6.1 Validation with Zod

```typescript
import { z } from 'zod';

const StudentSchema = z.object({
  id: z.string().min(1),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  studentNumber: z.string().optional(),
  notes: z.string().optional(),
  active: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const AssessmentTypeSchema = z.enum([
  'test',
  'quiz',
  'exam',
  'benchmark',
  'pretest',
  'exit_ticket',
]);

const AssignmentStatusSchema = z.enum([
  'draft',
  'assigned',
  'collecting',
  'grading',
  'graded',
]);
```

### 6.2 Validation Rules

| Entity | Rules |
|--------|-------|
| Student ID | Non-empty, unique within section |
| Email | Valid format or null |
| Question Count | 1-100 per assessment |
| Choice Count | 2-6 per question |
| Version | A, B, C, or D |
| Academic Year | Format: YYYY-YYYY |
| Dates | ISO 8601 format |

---

## 7. Performance Considerations

### 7.1 Data Size Estimates

| Entity | Typical | Maximum |
|--------|---------|---------|
| Roster | 5KB (30 students) | 50KB (300 students) |
| Unit | 2KB | 10KB |
| Assessment | 50KB (30 questions) | 500KB (100 questions + images) |
| Standards | 100KB | 1MB |
| Grades (per assignment) | 20KB | 200KB |
| Scanned PDF | 2MB/page | 50MB |

### 7.2 Optimization Strategies

- **Lazy loading**: Load questions on demand
- **Pagination**: Paginate large rosters (> 100 students)
- **Compression**: Compress large JSON before upload
- **Thumbnails**: Store image thumbnails for figures
- **Incremental sync**: Only sync changed entities

---

## 8. Schema Versioning

```typescript
interface SchemaVersion {
  local: number;
  drive: number;
}

const CURRENT_SCHEMA: SchemaVersion = {
  local: 3,    // Updated for Course/Section model
  drive: 3,    // Updated for Course/Section model
};
```

---

## 9. Design Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Folder structure | Nested (sections inside courses) | Keeps related data together, easier to copy courses |
| Section naming | Flexible (teacher chooses) | Schools use different conventions |
| Assessment types | Multiple (test, quiz, exam, benchmark, pretest, exit_ticket) | Covers common use cases |
| Sharing | Designed for, not implemented | Future-proofs without overbuilding |
| Year handling | Manual archive | Teacher controls timing |
| Multi-section students | No | Simplifies data model, covers 99% of cases |

---

*Document Version: 3.0*
*Last Updated: 2025-12-19*
*Changes: Course/Section hierarchy, assessment types, assignment workflow, folder structure*
