# TeachingHelp - Product Requirements Document

## 1. Executive Summary

TeachingHelp is a cross-platform desktop application (Electron) designed to streamline the workflow of K-12 teachers by providing AI-assisted lesson planning, automated test generation, scantron-style grading, and performance analytics. The application integrates with Google Drive for storage and supports multiple LLM providers for AI-powered features.

---

## 2. Problem Statement

Teachers spend significant time on:
- Creating lesson plans aligned with state standards
- Developing tests and assessments
- Grading paper-based tests manually
- Identifying which topics students struggle with

TeachingHelp addresses these pain points by providing an integrated workflow that automates repetitive tasks while keeping teachers in full control of educational content.

---

## 3. Target Users

**Primary User: K-12 Teachers**
- Teaches multiple classes/subjects
- Uses Google Drive for document storage
- Administers paper-based tests (to avoid online cheating/distractions)
- Has access to a high-volume document scanner
- May or may not be technically proficient

---

## 4. Core Modules

### 4.1 Lesson Plans Module

**Purpose:** AI-assisted creation of lesson plans, presentations, activities, and quizzes based on state teaching standards.

**Features:**
- Connect to class-specific Google Drive folders
- Import and parse state teaching standards documents
- Agentic AI workflow for lesson plan generation:
  - Step-by-step guided process with prompts and questions
  - Multiple specialized agents for different content types (presentations, activities, quizzes)
  - Free-form prompt support for custom requests
- Export generated materials to Google Drive `class-materials` folder
- Support for reviewing and iterating on generated content

**User Flow:**
1. Select a class from the roster
2. Choose lesson topic or standard to cover
3. Answer guided questions or provide free-form prompt
4. AI generates draft materials (presentation, activities, quiz)
5. Teacher reviews and requests modifications
6. Final materials saved to Google Drive

---

### 4.2 Test Generation Module

**Purpose:** Create multiple-choice tests from class materials with full teacher control and randomization capabilities.

**Features:**
- Import content from `class-materials` folder (PDF, PowerPoint, text files, etc.)
- Agentic AI workflow for question generation:
  - Configurable number of questions
  - Configurable number of distractors (wrong answers)
  - Ability to specify topics to include/exclude
  - Optional AI-generated distractors (can be disabled for manual control)
  - Support for adding figures/illustrations
- **Iterative editing workflow:**
  - Generate initial test draft
  - Export to editable format (JSON/DOCX)
  - Teacher makes manual edits externally
  - Re-import edited test back into app
  - Continue AI-assisted refinement
  - Repeat until satisfied
- Test randomization:
  - Generate multiple versions (A, B, C, D)
  - Randomize question order per version
  - Randomize answer choice order per question
  - Maintain answer key for each version
- Export finalized tests to PDF/DOCX

**Data Model - Test:**
```json
{
  "id": "uuid",
  "title": "Chemistry Unit 3 Test",
  "class_id": "junior-chemistry",
  "created_date": "2025-12-19",
  "questions": [
    {
      "id": "q1",
      "text": "What is the atomic number of Carbon?",
      "figure": null,
      "choices": [
        {"id": "a", "text": "6", "correct": true},
        {"id": "b", "text": "12", "correct": false},
        {"id": "c", "text": "14", "correct": false},
        {"id": "d", "text": "8", "correct": false}
      ],
      "topic": "Atomic Structure",
      "standard_ref": "CHEM.3.2"
    }
  ],
  "versions": [
    {
      "version_id": "A",
      "question_order": ["q3", "q1", "q7", ...],
      "answer_keys": {"q1": "C", "q3": "A", ...}
    }
  ]
}
```

---

### 4.3 Roster Management Module

**Purpose:** Manage student rosters for each class, enabling personalized scantron generation and grade tracking.

**Features:**
- Create and manage class rosters
- Import student data via paste (from spreadsheet/CSV)
- Store roster data in Google Drive (per class)
- Student data fields:
  - Student ID (unique identifier)
  - First Name
  - Last Name
  - Email (optional)
- Sync roster changes to Google Drive

**Data Model - Roster:**
```json
{
  "class_id": "junior-chemistry",
  "class_name": "Junior Chemistry",
  "teacher": "Mrs. Smith",
  "academic_year": "2025-2026",
  "students": [
    {
      "student_id": "12345",
      "first_name": "John",
      "last_name": "Doe",
      "email": "jdoe@school.edu"
    }
  ]
}
```

---

### 4.4 Scantron Generation Module

**Purpose:** Generate personalized answer sheets for each student with embedded identification data.

**Features:**
- Generate scantron sheets linked to specific tests
- Each scantron includes:
  - QR code containing: Student ID, Class ID, Test ID, Version (A/B/C/D), Date
  - Human-readable header: Student Name, Class Name, Date, Version
  - Answer bubbles (A, B, C, D) for each question
- Batch generation for entire class roster
- Export to PDF for printing
- Support for variable number of questions

**Scantron Layout:**
```
┌─────────────────────────────────────────────────┐
│ [QR CODE]   Mrs. Smith Chemistry                │
│             December 19, 2025 - Version A       │
│             Student: John Doe (ID: 12345)       │
├─────────────────────────────────────────────────┤
│  1. ○A  ○B  ○C  ○D      14. ○A  ○B  ○C  ○D     │
│  2. ○A  ○B  ○C  ○D      15. ○A  ○B  ○C  ○D     │
│  3. ○A  ○B  ○C  ○D      16. ○A  ○B  ○C  ○D     │
│  ...                     ...                    │
└─────────────────────────────────────────────────┘
```

---

### 4.5 Grading Module

**Purpose:** Scan completed scantron sheets and automatically grade tests.

**Features:**
- Import scanned PDF (single PDF with multiple pages/students)
- PDF processing pipeline:
  - Split PDF into individual pages
  - Detect and decode QR code on each page
  - Extract student ID, test ID, version from QR
  - Detect filled bubbles using image processing
  - Compare against answer key for that version
- Grade calculation and reporting:
  - Raw score (correct/total)
  - Percentage score
  - Per-question results (for analytics)
- Export grades to Google Sheets in class folder
- Handle edge cases:
  - Multiple bubbles filled
  - No bubble filled
  - QR code unreadable (flag for manual review)

**Data Model - Grade Record:**
```json
{
  "test_id": "uuid",
  "student_id": "12345",
  "version": "A",
  "date_graded": "2025-12-20",
  "raw_score": 18,
  "total_questions": 20,
  "percentage": 90.0,
  "answers": {
    "q1": {"selected": "C", "correct": true},
    "q2": {"selected": "A", "correct": false},
    ...
  }
}
```

---

### 4.6 Analytics Module

**Purpose:** Analyze student performance to identify areas needing attention.

**Features:**
- Performance reports by:
  - Individual student
  - Entire class
  - Specific test
  - Topic/standard
- Identify struggling topics:
  - Questions with high failure rates
  - Standards with low mastery
- Trend analysis over time
- Export reports to PDF
- **Feedback loop to Lesson Plans:**
  - Surface struggling topics when creating new lessons
  - Suggest focus areas based on analytics data

**Report Types:**
1. **Class Performance Summary** - Overall scores, distribution, averages
2. **Topic Mastery Report** - Which standards/topics are mastered vs. need work
3. **Student Progress Report** - Individual student performance over time
4. **Question Analysis** - Which questions were most missed (test quality feedback)

---

## 5. Technical Architecture

### 5.1 Platform & Framework

- **Runtime:** Electron (cross-platform: macOS, Windows, Linux)
- **Frontend:** React + TypeScript
- **Styling:** Tailwind CSS (or similar utility-first framework)
- **State Management:** React Context or Zustand
- **Build Tool:** Vite or Electron Forge

### 5.2 Backend/Services (within Electron)

- **Main Process:** Node.js for file system, PDF processing, Google API calls
- **Renderer Process:** React UI
- **IPC:** Electron IPC for communication between processes

### 5.3 External Integrations

#### Google Drive API
- OAuth 2.0 authentication flow
- Scopes required:
  - `drive.file` - Access files created by app
  - `drive.readonly` - Read class materials
  - `spreadsheets` - Write grades to Google Sheets
- Store OAuth tokens securely (electron-store with encryption)

#### LLM Providers
Support for multiple providers (user provides API key):

| Provider | API | Models |
|----------|-----|--------|
| OpenAI | REST API | GPT-4, GPT-4-turbo |
| Anthropic | REST API | Claude 3.5 Sonnet, Claude 3 Opus |
| Google | REST API | Gemini Pro, Gemini Ultra |

- Abstract LLM interface for provider-agnostic code
- User selects preferred provider in settings
- API keys stored securely (encrypted local storage)

### 5.4 PDF Processing

- **PDF Parsing:** pdf-lib, pdf-parse, or pdfjs-dist
- **Image Processing:** sharp, jimp, or opencv4nodejs
- **QR Code:** jsQR (reading), qrcode (generation)
- **PDF Generation:** pdfkit or puppeteer

### 5.5 Data Storage

- **Local:** JSON files via electron-store (settings, cache)
- **Cloud:** Google Drive (rosters, materials, grades)
- **Format:** JSON for internal data, PDF/DOCX for exports

---

## 6. Google Drive Folder Structure

```
/TeachingHelp/
├── settings.json                    # App-wide settings
├── {class-folder}/                  # e.g., "junior-chemistry"
│   ├── roster.json                  # Student roster for this class
│   ├── standards/                   # State teaching standards
│   │   └── chemistry-standards.pdf
│   ├── class-materials/             # Lesson materials (generated + legacy)
│   │   ├── unit-1-atoms/
│   │   ├── unit-2-bonding/
│   │   └── legacy/                  # Imported legacy materials
│   ├── tests/                       # Generated tests
│   │   └── 2025-12-19-unit3.json
│   └── grades/                      # Grade records
│       └── grades.xlsx              # Google Sheet with all grades
```

---

## 7. User Flows

### 7.1 First-Time Setup
1. Launch app
2. Sign in with Google (OAuth flow)
3. App creates `/TeachingHelp/` folder in Drive (if not exists)
4. Configure LLM provider and API key
5. Create first class

### 7.2 Create a Class
1. Enter class name (e.g., "Junior Chemistry")
2. App creates folder structure in Drive
3. Upload or paste state standards documents
4. Paste student roster from spreadsheet
5. Class ready for use

### 7.3 Generate a Test (Iterative Flow)
1. Select class → "Create Test"
2. Choose materials to base test on
3. Configure: # questions, # distractors, topics
4. AI generates initial draft
5. Review in app, request changes via chat
6. Export to DOCX for manual editing
7. Re-import edited version
8. Continue AI refinement (repeat 5-7 as needed)
9. Finalize and generate versions A/B/C/D
10. Generate scantron sheets for class

### 7.4 Grade Tests
1. Scan completed scantrons (creates PDF)
2. Import PDF into app
3. App processes each page:
   - Read QR → identify student + version
   - Detect answers → compare to key
4. Review flagged sheets (errors)
5. Export grades to Google Sheets
6. View analytics

---

## 8. Security & Privacy Considerations

- **Student Data:** Stored in teacher's own Google Drive (teacher controls access)
- **API Keys:** Encrypted in local storage, never transmitted
- **OAuth Tokens:** Stored securely, refreshed automatically
- **No Cloud Backend:** All processing local, no data sent to our servers
- **FERPA Compliance:** Teacher maintains control of student records

---

## 9. Future Considerations (Out of Scope for v1)

- Collaborative features (multiple teachers)
- Integration with LMS (Google Classroom, Canvas)
- Mobile companion app
- Voice input for lesson planning
- Handwritten answer detection (beyond bubbles)
- Automatic standards alignment detection

---

## 10. Success Metrics

- Time saved per test creation (target: 75% reduction)
- Grading accuracy (target: 99%+ for clean scans)
- User satisfaction (teacher feedback)
- Adoption rate among pilot users

---

## 11. Open Questions

1. **Standards Format:** What format are state standards typically in? (PDF, structured data?)
2. **Scanner Requirements:** What DPI/quality is needed for reliable bubble detection?
3. **Offline Mode:** How much functionality should work without internet?
4. **Test Formats:** Should we support question types beyond multiple choice in future?

---

## 12. Appendix

### A. Technology Stack Summary

| Layer | Technology |
|-------|------------|
| Runtime | Electron |
| UI Framework | React |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS |
| State | React Context / Zustand |
| PDF Read | pdf-parse, pdfjs-dist |
| PDF Write | pdfkit, puppeteer |
| Image Processing | sharp, opencv4nodejs |
| QR Codes | jsQR, qrcode |
| Google APIs | googleapis npm package |
| LLM Integration | Provider-specific SDKs |
| Local Storage | electron-store |
| Build | Electron Forge / Vite |

### B. Milestones (High-Level)

1. **Foundation:** Electron app shell, Google OAuth, folder structure
2. **Roster:** Class/student management, Drive sync
3. **Test Gen:** Question generation, manual editing workflow, randomization
4. **Scantron:** Sheet generation with QR codes
5. **Grading:** PDF import, bubble detection, grading engine
6. **Analytics:** Reports and insights
7. **Lesson Plans:** Agentic AI workflows (most complex, last)

---

*Document Version: 1.0*
*Last Updated: 2025-12-19*
