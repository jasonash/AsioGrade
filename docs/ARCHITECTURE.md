# Technical Architecture Document

**Version:** 3.0
**Last Updated:** 2025-12-19

---

## 1. System Overview

TeachingHelp is an Electron-based desktop application using a service-oriented architecture with clear separation between the main process (Node.js backend) and renderer process (React frontend).

### 1.1 Core Data Hierarchy

```
Academic Year (2024-2025)
└── Course (Earth Science)
    ├── Standards (NGSS standards)
    ├── Units (curriculum backbone)
    │   └── Assessments (test/quiz definitions)
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

### 1.2 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            TeachingHelp                                  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                      RENDERER PROCESS                               │ │
│  │                                                                     │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │ │
│  │  │   React UI   │  │   Zustand    │  │      IPC Client          │ │ │
│  │  │  Components  │◄─┤   Stores     │◄─┤  (typed service calls)   │ │ │
│  │  └──────────────┘  └──────────────┘  └────────────┬─────────────┘ │ │
│  └───────────────────────────────────────────────────┼───────────────┘ │
│                                                       │                  │
│  ┌───────────────────────────────────────────────────┼───────────────┐ │
│  │                      PRELOAD SCRIPT               │                │ │
│  │                   (contextBridge API)             │                │ │
│  └───────────────────────────────────────────────────┼───────────────┘ │
│                                                       │ IPC Bridge      │
│  ┌───────────────────────────────────────────────────┼───────────────┐ │
│  │                      MAIN PROCESS                 ▼                │ │
│  │                                                                     │ │
│  │  ┌──────────────────────────────────────────────────────────────┐ │ │
│  │  │                     Service Layer                             │ │ │
│  │  │                                                               │ │ │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │ │ │
│  │  │  │  Drive   │ │   LLM    │ │   PDF    │ │ Storage  │        │ │ │
│  │  │  │ Service  │ │ Service  │ │ Service  │ │ Service  │        │ │ │
│  │  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘        │ │ │
│  │  │       │            │            │            │               │ │ │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │ │ │
│  │  │  │  Auth    │ │  Window  │ │  Grade   │ │  Cache   │        │ │ │
│  │  │  │ Service  │ │ Service  │ │ Service  │ │ Service  │        │ │ │
│  │  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘        │ │ │
│  │  └───────┼──────────┼──────────┼──────────┼────────────────────┘ │ │
│  │          ▼          ▼          ▼          ▼                      │ │
│  │     Google API   LLM APIs   opencv/pdf  electron-store           │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

| Layer | Technology | Version Target |
|-------|------------|----------------|
| Runtime | Electron | 28.x+ |
| UI Framework | React | 18.x |
| Language | TypeScript | 5.x (strict mode) |
| Styling | Material UI (Emotion) | 6.x |
| State Management | Zustand | 4.x |
| Build Tool | Vite | 5.x |
| Packaging | Electron Builder | 24.x |
| PDF Reading | pdf-parse, pdfjs-dist | Latest |
| PDF Writing | pdfkit | Latest |
| Image Processing | opencv-wasm | Latest |
| QR Reading | jsQR | Latest |
| QR Writing | qrcode | Latest |
| Google APIs | googleapis | Latest |
| Local Storage | electron-store | 8.x |
| Testing | Vitest, Playwright | Latest |

---

## 3. Process Architecture

### 3.1 Main Process Responsibilities

The main process handles all I/O operations and security-sensitive tasks:

- **File System Access** - Read/write local files, temp directories
- **Google Drive API** - All Drive operations (OAuth, CRUD)
- **LLM API Calls** - External API requests to OpenAI/Anthropic/Google
- **PDF Processing** - Parsing, image extraction, bubble detection
- **QR Code Operations** - Generation and reading
- **Secure Storage** - API keys, OAuth tokens (encrypted)
- **Window Management** - Creating/managing multiple windows
- **Native Dialogs** - File pickers, confirmations
- **App Lifecycle** - Updates, quit handling, crash recovery

### 3.2 Renderer Process Responsibilities

The renderer process handles UI and user interaction:

- **React Components** - All UI rendering
- **Zustand Stores** - Application state management
- **User Input** - Forms, clicks, keyboard shortcuts
- **Local UI State** - Modals, tooltips, animations
- **Service Calls** - Invoke main process services via IPC

### 3.3 Preload Script

The preload script creates a secure bridge between processes:

```typescript
// preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // Course operations
  course: {
    list: (year: string) => ipcRenderer.invoke('course:list', year),
    get: (courseId: string) => ipcRenderer.invoke('course:get', courseId),
    create: (course: Course) => ipcRenderer.invoke('course:create', course),
    update: (course: Course) => ipcRenderer.invoke('course:update', course),
  },

  // Section operations
  section: {
    list: (courseId: string) => ipcRenderer.invoke('section:list', courseId),
    get: (sectionId: string) => ipcRenderer.invoke('section:get', sectionId),
    create: (section: Section) => ipcRenderer.invoke('section:create', section),
    getRoster: (sectionId: string) => ipcRenderer.invoke('section:getRoster', sectionId),
    saveRoster: (sectionId: string, roster: Roster) =>
      ipcRenderer.invoke('section:saveRoster', sectionId, roster),
  },

  // Assessment operations
  assessment: {
    list: (courseId: string, unitId?: string) =>
      ipcRenderer.invoke('assessment:list', courseId, unitId),
    get: (assessmentId: string) => ipcRenderer.invoke('assessment:get', assessmentId),
    save: (assessment: Assessment) => ipcRenderer.invoke('assessment:save', assessment),
  },

  // Assignment operations (assessment assigned to section)
  assignment: {
    list: (sectionId: string) => ipcRenderer.invoke('assignment:list', sectionId),
    create: (assignment: Assignment) => ipcRenderer.invoke('assignment:create', assignment),
    getGrades: (assignmentId: string) => ipcRenderer.invoke('assignment:getGrades', assignmentId),
  },

  // LLM operations
  llm: {
    complete: (prompt: string, options: LLMOptions) =>
      ipcRenderer.invoke('llm:complete', prompt, options),
    stream: (prompt: string, options: LLMOptions) =>
      ipcRenderer.invoke('llm:stream', prompt, options),
  },

  // PDF operations
  pdf: {
    parseScantron: (filePath: string) =>
      ipcRenderer.invoke('pdf:parseScantron', filePath),
    generateScantron: (data: ScantronGenerationRequest) =>
      ipcRenderer.invoke('pdf:generateScantron', data),
  },

  // Storage operations
  storage: {
    get: (key: string) => ipcRenderer.invoke('storage:get', key),
    set: (key: string, value: unknown) =>
      ipcRenderer.invoke('storage:set', key, value),
  },

  // Event subscriptions
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },
  off: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
});
```

---

## 4. Service Layer Design

### 4.1 Service Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Service Layer                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ AuthService │  │DriveService │  │ LLMService  │         │
│  │             │  │             │  │             │         │
│  │ - login()   │  │ - courses   │  │ - complete()│         │
│  │ - logout()  │  │ - sections  │  │ - stream()  │         │
│  │ - refresh() │  │ - roster    │  │ - embed()   │         │
│  │ - getToken()│  │ - assess.   │  │             │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ PDFService  │  │GradeService │  │CacheService │         │
│  │             │  │             │  │             │         │
│  │ - parse()   │  │ - grade()   │  │ - get()     │         │
│  │ - generate()│  │ - export()  │  │ - set()     │         │
│  │ - detectQR()│  │ - analyze() │  │ - invalidate│         │
│  │ - detectBub│  │             │  │ - sync()    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐                          │
│  │StorageServ. │  │WindowService│                          │
│  │             │  │             │                          │
│  │ - get()     │  │ - create()  │                          │
│  │ - set()     │  │ - close()   │                          │
│  │ - delete()  │  │ - focus()   │                          │
│  │ - encrypt() │  │ - send()    │                          │
│  └─────────────┘  └─────────────┘                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 AuthService

Handles Google OAuth 2.0 authentication flow.

```typescript
interface AuthService {
  login(): Promise<AuthResult>;
  logout(): Promise<void>;
  refreshToken(): Promise<string>;
  getAccessToken(): Promise<string>;
  isAuthenticated(): Promise<boolean>;
  getCurrentUser(): Promise<UserInfo | null>;
}

interface AuthResult {
  success: boolean;
  user?: UserInfo;
  error?: string;
}

interface UserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}
```

**OAuth Scopes Required:**
- `https://www.googleapis.com/auth/drive.file` - Access app-created files
- `https://www.googleapis.com/auth/drive.readonly` - Read class materials
- `https://www.googleapis.com/auth/spreadsheets` - Write grades

### 4.3 DriveService

Handles all Google Drive operations with Course/Section hierarchy.

```typescript
interface DriveService {
  // App initialization
  ensureAppFolder(): Promise<string>;
  ensureYearFolder(year: string): Promise<string>;

  // Course operations
  listCourses(year: string): Promise<CourseSummary[]>;
  getCourse(courseId: string): Promise<Course>;
  createCourse(course: Course): Promise<string>;
  updateCourse(course: Course): Promise<void>;
  deleteCourse(courseId: string): Promise<void>;

  // Section operations
  listSections(courseId: string): Promise<SectionSummary[]>;
  getSection(sectionId: string): Promise<Section>;
  createSection(courseId: string, section: Section): Promise<string>;
  updateSection(section: Section): Promise<void>;
  deleteSection(sectionId: string): Promise<void>;

  // Roster operations (per section)
  getRoster(sectionId: string): Promise<Roster>;
  saveRoster(sectionId: string, roster: Roster): Promise<void>;

  // Unit operations (per course)
  listUnits(courseId: string): Promise<UnitSummary[]>;
  getUnit(unitId: string): Promise<Unit>;
  createUnit(courseId: string, unit: Unit): Promise<string>;
  updateUnit(unit: Unit): Promise<void>;

  // Assessment operations (per course/unit)
  listAssessments(courseId: string, unitId?: string): Promise<AssessmentSummary[]>;
  getAssessment(assessmentId: string): Promise<Assessment>;
  saveAssessment(assessment: Assessment): Promise<void>;
  publishAssessment(assessmentId: string): Promise<void>;

  // Assignment operations (assessment assigned to section)
  listAssignments(sectionId: string): Promise<AssignmentSummary[]>;
  getAssignment(assignmentId: string): Promise<Assignment>;
  createAssignment(assignment: Assignment): Promise<string>;
  updateAssignment(assignment: Assignment): Promise<void>;

  // Grade operations
  getAssignmentGrades(assignmentId: string): Promise<AssignmentGrades>;
  saveAssignmentGrades(grades: AssignmentGrades): Promise<void>;

  // Standards operations
  getStandards(courseId: string): Promise<Standards>;
  saveStandards(courseId: string, standards: Standards): Promise<void>;
}
```

### 4.4 LLMService

Provider-agnostic LLM abstraction.

```typescript
interface LLMService {
  complete(request: LLMRequest): Promise<LLMResponse>;
  stream(request: LLMRequest): AsyncGenerator<string>;
  getProviders(): LLMProvider[];
  testConnection(provider: LLMProvider): Promise<boolean>;
}

interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  provider?: 'openai' | 'anthropic' | 'google';
  model?: string;
}

interface LLMResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  model: string;
  provider: string;
}

type LLMProvider = {
  id: 'openai' | 'anthropic' | 'google';
  name: string;
  models: string[];
  configured: boolean;
};
```

### 4.5 PDFService

Handles PDF processing for scantron grading.

```typescript
interface PDFService {
  parseScantronPDF(filePath: string): Promise<ParsedScantron[]>;
  extractPage(pdfPath: string, pageNum: number): Promise<Buffer>;
  detectQRCode(imageBuffer: Buffer): Promise<ScantronQRData | null>;
  detectBubbles(imageBuffer: Buffer, template: BubbleTemplate): Promise<BubbleResults>;
  generateScantronPDF(data: ScantronGenerationRequest): Promise<Buffer>;
  exportAssessmentToPDF(assessment: Assessment, options: ExportOptions): Promise<Buffer>;
}

interface ParsedScantron {
  pageNumber: number;
  qrData: ScantronQRData | null;
  answers: DetectedAnswer[];
  confidence: number;
  flags: string[];
  rawImage: Buffer;
}
```

### 4.6 GradeService

Handles grading logic and analytics.

```typescript
interface GradeService {
  // Grading
  gradeScantron(parsed: ParsedScantron, assessment: Assessment, assignment: Assignment): GradeResult;
  gradeBatch(scantrons: ParsedScantron[], assessment: Assessment, assignment: Assignment): BatchGradeResult;

  // Export
  exportToSheets(sectionId: string, grades: GradeRecord[]): Promise<void>;
  exportToCSV(grades: GradeRecord[]): Promise<string>;

  // Analytics (standards-referenced)
  analyzeAssignment(assignmentId: string): Promise<AssignmentAnalytics>;
  analyzeStudent(studentId: string, sectionId: string): Promise<StudentAnalytics>;
  analyzeSection(sectionId: string): Promise<SectionAnalytics>;
  analyzeCourse(courseId: string): Promise<CourseAnalytics>;
  analyzeByStandard(courseId: string, standardRef: string): Promise<StandardAnalytics>;
}
```

### 4.7 CacheService

Manages local caching of Drive data.

```typescript
interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  invalidate(pattern: string): Promise<void>;
  getLastSync(key: string): Promise<Date | null>;
  markSynced(key: string): Promise<void>;
  needsSync(key: string): Promise<boolean>;
}
```

### 4.8 StorageService

Handles secure local storage.

```typescript
interface StorageService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  getSecure<T>(key: string): Promise<T | null>;
  setSecure<T>(key: string, value: T): Promise<void>;
  deleteSecure(key: string): Promise<void>;
  saveDraft(draftId: string, draft: AssessmentDraft): Promise<void>;
  getDraft(draftId: string): Promise<AssessmentDraft | null>;
  listDrafts(): Promise<DraftSummary[]>;
  deleteDraft(draftId: string): Promise<void>;
}
```

### 4.9 WindowService

Manages Electron windows for multi-window support.

```typescript
interface WindowService {
  createMainWindow(): Promise<void>;
  openAssessmentEditor(assessmentId: string): Promise<void>;
  openRosterViewer(sectionId: string): Promise<void>;
  openGradingResults(assignmentId: string): Promise<void>;
  closeWindow(windowId: string): Promise<void>;
  focusWindow(windowId: string): Promise<void>;
  getOpenWindows(): WindowInfo[];
  sendToWindow(windowId: string, channel: string, data: unknown): void;
  broadcast(channel: string, data: unknown): void;
}
```

---

## 5. Module Architecture

### 5.1 File Structure

```
src/
├── main/                          # Main process code
│   ├── services/                  # Service implementations
│   │   ├── auth.service.ts
│   │   ├── drive.service.ts
│   │   ├── llm/
│   │   │   ├── llm.service.ts
│   │   │   └── providers/
│   │   │       ├── openai.provider.ts
│   │   │       ├── anthropic.provider.ts
│   │   │       └── google.provider.ts
│   │   ├── pdf.service.ts
│   │   ├── grade.service.ts
│   │   ├── cache.service.ts
│   │   ├── storage.service.ts
│   │   └── window.service.ts
│   ├── ipc/                       # IPC handlers
│   │   └── handlers.ts
│   └── index.ts                   # Entry point
│
├── renderer/                      # Renderer process code
│   └── src/
│       ├── components/            # React components
│       │   ├── common/            # Shared components
│       │   ├── course/            # Course management
│       │   ├── section/           # Section/roster components
│       │   ├── assessment/        # Assessment creation
│       │   ├── assignment/        # Assignment management
│       │   ├── scantron/          # Scantron generation
│       │   ├── grading/           # Grading components
│       │   ├── analytics/         # Analytics components
│       │   └── standards/         # Standards import
│       ├── stores/                # Zustand stores
│       │   ├── auth.store.ts
│       │   ├── course.store.ts
│       │   ├── section.store.ts
│       │   ├── assessment.store.ts
│       │   ├── assignment.store.ts
│       │   └── ui.store.ts
│       ├── hooks/                 # Custom React hooks
│       ├── pages/                 # Page components
│       │   ├── Dashboard.tsx
│       │   ├── CourseView.tsx
│       │   ├── SectionView.tsx
│       │   ├── AssessmentEditor.tsx
│       │   └── ...
│       ├── App.tsx
│       └── main.tsx
│
├── shared/                        # Shared between processes
│   ├── types/                     # TypeScript interfaces
│   │   ├── course.types.ts
│   │   ├── section.types.ts
│   │   ├── roster.types.ts
│   │   ├── assessment.types.ts
│   │   ├── assignment.types.ts
│   │   ├── grade.types.ts
│   │   └── ...
│   ├── constants/
│   └── utils/
│
├── preload/
│   └── index.ts
│
└── assets/
    ├── icons/
    └── fonts/
```

### 5.2 Module Dependencies

```
┌─────────────────────────────────────────────────────────────┐
│                      Module Dependencies                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                    ┌──────────────┐                         │
│                    │   Lessons    │                         │
│                    │   (Phase 8)  │                         │
│                    └──────┬───────┘                         │
│                           │                                  │
│            ┌──────────────┼──────────────┐                  │
│            ▼              ▼              ▼                   │
│     ┌──────────┐   ┌──────────┐   ┌──────────┐             │
│     │Analytics │   │   Unit   │   │Assessment│             │
│     │(Phase 7) │   │ Planning │   │ Creation │             │
│     └────┬─────┘   │ (Phase 3)│   │ (Phase 4)│             │
│          │         └────┬─────┘   └────┬─────┘             │
│          │              │              │                     │
│          │         ┌────▼─────┐       │                     │
│          │         │ Standards│◄──────┘                     │
│          │         │ (Phase 3)│                             │
│          │         └──────────┘                             │
│          │                                                   │
│          │         ┌──────────┐                             │
│          │         │ Scantron │◄──────────────┐             │
│          │         │ (Phase 5)│               │             │
│          │         └────┬─────┘               │             │
│          │              │                     │             │
│          │         ┌────▼─────┐         ┌─────┴────┐        │
│          └────────►│ Grading  │         │  Course  │        │
│                    │ (Phase 6)│◄────────│  Setup   │        │
│                    └──────────┘         │ (Phase 2)│        │
│                                         └────┬─────┘        │
│                                              │              │
│                                         ┌────▼─────┐        │
│                                         │Foundation│        │
│                                         │ (Phase 1)│        │
│                                         └──────────┘        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Data Flow Architecture

### 6.1 Google Drive Folder Structure

```
/TeachingHelp/
├── config.json                           # App config
│
└── years/
    └── 2024-2025/
        └── courses/
            └── {course-id}/
                ├── meta.json             # Course metadata
                ├── standards/
                │   ├── standards.json
                │   └── source/
                ├── units/
                │   └── {unit-id}/
                │       ├── meta.json
                │       └── assessments/
                │           └── {assessment-id}.json
                ├── materials/
                └── sections/
                    └── {section-id}/
                        ├── meta.json
                        ├── roster.json
                        ├── assignments/
                        │   └── {assignment-id}.json
                        └── grades/
                            └── {assignment-id}-grades.json
```

### 6.2 Sync Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                     Data Sync Flow                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  LOCAL (electron-store)              CLOUD (Google Drive)   │
│  ┌─────────────────────┐            ┌─────────────────────┐ │
│  │                     │            │                     │ │
│  │  Settings (local)   │            │  /TeachingHelp/     │ │
│  │  API Keys (secure)  │            │    └── years/       │ │
│  │  OAuth Tokens       │◄──sync────►│        └── courses/ │ │
│  │  Cache              │            │            └── ...  │ │
│  │  Assessment Drafts  │            │                     │ │
│  │                     │            │                     │ │
│  └─────────────────────┘            └─────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Sync Rules                            ││
│  ├─────────────────────────────────────────────────────────┤│
│  │ Data Type        │ Direction      │ Trigger             ││
│  │──────────────────┼────────────────┼─────────────────────││
│  │ Settings         │ Local only     │ N/A                 ││
│  │ API Keys         │ Local only     │ N/A                 ││
│  │ Courses          │ Bidirectional  │ On change + start   ││
│  │ Sections         │ Bidirectional  │ On change + start   ││
│  │ Rosters          │ Bidirectional  │ On change + start   ││
│  │ Standards        │ Bidirectional  │ On demand + start   ││
│  │ Assess. (draft)  │ Local only     │ N/A (until publish) ││
│  │ Assess. (pub)    │ Bidirectional  │ On publish, on open ││
│  │ Assignments      │ Bidirectional  │ On change           ││
│  │ Grades           │ Write-through  │ Immediate           ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Multi-Device Sync

```
┌─────────────────────────────────────────────────────────────┐
│                Multi-Device Sync Strategy                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  WORK COMPUTER                      HOME COMPUTER           │
│  ┌─────────────┐                   ┌─────────────┐          │
│  │ Local Cache │                   │ Local Cache │          │
│  │             │                   │             │          │
│  │ course v3   │                   │ course v2   │ (stale)  │
│  │ roster v5   │                   │ roster v4   │ (stale)  │
│  └──────┬──────┘                   └──────┬──────┘          │
│         │                                 │                  │
│         └────────────┬────────────────────┘                  │
│                      ▼                                       │
│              ┌──────────────┐                                │
│              │ Google Drive │                                │
│              │              │                                │
│              │ course v3    │ (source of truth)             │
│              │ roster v5    │                                │
│              └──────────────┘                                │
│                                                              │
│  Strategy:                                                   │
│  1. Each file has: { version: number, updatedAt: string }   │
│  2. On app start: compare local vs Drive version            │
│  3. If Drive newer: pull and update local cache             │
│  4. Conflict: Drive wins (last write wins)                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Security Architecture

### 7.1 Security Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Layer 1: Process Isolation                               ││
│  │ - Renderer has no direct Node.js access                 ││
│  │ - contextIsolation: true                                 ││
│  │ - nodeIntegration: false                                 ││
│  │ - sandbox: true                                          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Layer 2: IPC Whitelist                                   ││
│  │ - Only predefined channels exposed via preload          ││
│  │ - Input validation on all IPC handlers                  ││
│  │ - No arbitrary code execution paths                      ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Layer 3: Secure Storage                                  ││
│  │ - API keys encrypted with electron-store encryption     ││
│  │ - OAuth tokens in secure storage                         ││
│  │ - No sensitive data in plain text files                 ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Layer 4: Network Security                                ││
│  │ - HTTPS only for all external requests                  ││
│  │ - CSP headers configured                                 ││
│  │ - No loading of remote content in renderer              ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Electron Security Configuration

```typescript
const mainWindow = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    preload: path.join(__dirname, 'preload.js'),
    webSecurity: true,
  },
});

mainWindow.webContents.on('will-navigate', (event, url) => {
  if (!url.startsWith('file://')) {
    event.preventDefault();
  }
});

mainWindow.webContents.setWindowOpenHandler(() => {
  return { action: 'deny' };
});
```

---

## 8. Error Handling Strategy

### 8.1 Error Categories

| Category | Examples | Handling |
|----------|----------|----------|
| Network | API timeout, no internet | Retry with backoff, show offline indicator |
| Auth | Token expired, revoked | Auto-refresh, prompt re-login if needed |
| Drive | File not found, quota exceeded | Show specific error, suggest fix |
| LLM | Rate limit, invalid response | Retry, fallback provider, show error |
| PDF | Corrupt file, QR unreadable | Flag for review, show specific error |
| Validation | Invalid input, type mismatch | Show inline validation errors |

### 8.2 Error Response Format

```typescript
interface ServiceError {
  code: string;
  message: string;
  details?: unknown;
  recoverable: boolean;
  suggestedAction?: string;
}
```

---

## 9. Testing Strategy

### 9.1 Test Types

| Type | Tool | Coverage Target |
|------|------|-----------------|
| Unit | Vitest | Services, utils, stores |
| Component | Vitest + Testing Library | React components |
| Integration | Vitest | IPC handlers, service chains |
| E2E | Playwright | Critical user flows |

### 9.2 Test Organization

```
tests/
├── unit/
│   ├── services/
│   │   ├── drive.service.test.ts
│   │   ├── llm.service.test.ts
│   │   └── grade.service.test.ts
│   └── utils/
├── integration/
│   ├── ipc.test.ts
│   └── sync.test.ts
├── e2e/
│   ├── auth.spec.ts
│   ├── course-creation.spec.ts
│   ├── assessment-creation.spec.ts
│   └── grading.spec.ts
└── fixtures/
    ├── sample-roster.json
    ├── sample-assessment.json
    └── sample-scantron.pdf
```

---

## 10. Performance Considerations

### 10.1 Targets

| Metric | Target |
|--------|--------|
| App startup | < 3 seconds |
| Course list load | < 500ms (cached) |
| Assessment generation (AI) | < 30 seconds |
| PDF page processing | < 2 seconds/page |
| UI interactions | < 100ms response |

### 10.2 Optimization Strategies

- **Lazy loading** - Load modules on demand
- **Virtual lists** - For large student rosters
- **Background processing** - PDF processing in worker
- **Caching** - Aggressive local caching of Drive data
- **Debouncing** - AI calls, search inputs
- **Code splitting** - Separate bundles per module

---

## 11. Deployment Architecture

### 11.1 Build Targets

| Platform | Format | Auto-update |
|----------|--------|-------------|
| macOS | DMG, ZIP | electron-updater |
| Windows | NSIS installer, portable | electron-updater |
| Linux | AppImage, deb | electron-updater |

### 11.2 Update Strategy

- **Channel:** Stable releases only
- **Frequency:** Manual check + prompt on startup
- **Rollback:** Keep previous version for manual rollback

---

*Document Version: 3.0*
*Last Updated: 2025-12-19*
*Changes: Course/Section hierarchy, updated DriveService, IPC structure, folder layout*
