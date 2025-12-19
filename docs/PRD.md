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

**Purpose:** Create tests from class materials with full teacher control, ability-level differentiation, and randomization capabilities.

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
- **Ability-level differentiation:**
  - Base test created for "Typical" level
  - AI generates differentiated versions for each ability level:
    - **Advanced:** Harder distractors, more complex wording, bonus questions
    - **Typical:** Standard difficulty (base version)
    - **Remedial:** Simplified language, fewer distractors, hint cues
    - **IEP:** Further accommodations (read-aloud compatible, larger text, reduced questions)
  - Teacher can manually adjust any level's version
- **Test randomization:**
  - Each ability level gets randomized versions (A, B, C, D)
  - Randomize question order per version
  - Randomize answer choice order per question
  - Maintain answer key for each ability level + version combination
  - Result: Up to 16 total versions (4 levels × 4 randomizations)
- Export finalized tests to PDF/DOCX

**Supported Question Types:**

| Type | Description | Grading Method |
|------|-------------|----------------|
| Multiple Choice | 4 options (A, B, C, D) | Automatic (bubble detection) |
| True/False | 2 options per question | Automatic (bubble detection) |
| Matching | Grid of options (e.g., 1→A, 2→C) | Automatic (bubble detection) |
| Numeric Fill-in | Digit bubbles for short numeric answers | Automatic (bubble detection) |
| Short Answer | Written response on sheet | Manual or AI-assisted (OCR + LLM evaluation) |
| Essay | Extended written response | Manual or AI-assisted (OCR + LLM evaluation) |

**Note:** Short Answer and Essay types are planned for a future version. Initial release focuses on automatically-gradable types.

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
      "type": "multiple_choice",
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
    },
    {
      "id": "q2",
      "type": "true_false",
      "text": "Electrons have a positive charge.",
      "correct_answer": false,
      "topic": "Atomic Structure",
      "standard_ref": "CHEM.3.1"
    },
    {
      "id": "q3",
      "type": "matching",
      "prompt": "Match each element to its symbol:",
      "pairs": [
        {"left": "1. Carbon", "right": "A. Na"},
        {"left": "2. Sodium", "right": "B. C"},
        {"left": "3. Oxygen", "right": "C. O"}
      ],
      "correct_answers": {"1": "B", "2": "A", "3": "C"},
      "topic": "Elements",
      "standard_ref": "CHEM.2.1"
    }
  ],
  "ability_levels": {
    "advanced": {
      "modifications": "Added bonus question, harder distractors",
      "question_ids": ["q1", "q2", "q3", "q_bonus"]
    },
    "typical": {
      "modifications": null,
      "question_ids": ["q1", "q2", "q3"]
    },
    "remedial": {
      "modifications": "Simplified wording, added hints",
      "question_ids": ["q1_simple", "q2", "q3"]
    },
    "iep": {
      "modifications": "Reduced to 2 questions, larger text",
      "question_ids": ["q1_simple", "q2"]
    }
  },
  "versions": {
    "advanced": [
      {"version_id": "A", "question_order": ["q3", "q1", "q2", "q_bonus"], "answer_keys": {...}},
      {"version_id": "B", "question_order": ["q1", "q_bonus", "q3", "q2"], "answer_keys": {...}}
    ],
    "typical": [
      {"version_id": "A", "question_order": ["q2", "q1", "q3"], "answer_keys": {...}},
      {"version_id": "B", "question_order": ["q3", "q2", "q1"], "answer_keys": {...}}
    ]
  }
}
```

---

### 4.3 Roster Management Module

**Purpose:** Manage student rosters for each class, including ability-level assignments, enabling personalized test generation and scantron creation.

**Features:**
- Create and manage class rosters
- Import student data via paste (from spreadsheet/CSV)
- Store roster data in Google Drive (per class)
- Student data fields:
  - Student ID (unique identifier)
  - First Name
  - Last Name
  - Email (optional)
  - **Ability Level** (advanced, typical, remedial, iep)
- Bulk ability-level assignment (select multiple students)
- Sync roster changes to Google Drive
- Filter/sort students by ability level

**Ability Levels:**

| Level | Description | Test Accommodations |
|-------|-------------|---------------------|
| Advanced | Above grade-level performance | Harder questions, bonus content |
| Typical | Grade-level performance | Standard test (base version) |
| Remedial | Below grade-level, needs support | Simplified language, hints, fewer distractors |
| IEP | Individualized Education Program | Reduced questions, larger text, extended time notation |

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
      "email": "jdoe@school.edu",
      "ability_level": "typical"
    },
    {
      "student_id": "12346",
      "first_name": "Jane",
      "last_name": "Smith",
      "email": "jsmith@school.edu",
      "ability_level": "advanced"
    },
    {
      "student_id": "12347",
      "first_name": "Bob",
      "last_name": "Johnson",
      "email": null,
      "ability_level": "iep"
    }
  ]
}
```

---

### 4.4 Scantron Generation Module

**Purpose:** Generate personalized answer sheets for each student with embedded identification data, automatically matched to their ability level.

**Features:**
- Generate scantron sheets linked to specific tests
- **Automatic ability-level matching:**
  - System reads student's ability level from roster
  - Generates scantron with correct number of questions for that level
  - Assigns appropriate test version (level + randomization)
- Each scantron includes:
  - QR code containing: Student ID, Class ID, Test ID, **Ability Level**, Version (A/B/C/D), Date
  - Human-readable header: Student Name, Class Name, Date, Level, Version
  - Answer bubbles appropriate for question types (A/B/C/D for MC, T/F for true/false, grid for matching)
- Batch generation for entire class roster (grouped by ability level for easy distribution)
- Export to PDF for printing
- Support for variable number of questions per ability level

**Scantron Layout:**
```
┌─────────────────────────────────────────────────┐
│ [QR CODE]   Mrs. Smith Chemistry                │
│             December 19, 2025                   │
│             Student: John Doe (ID: 12345)       │
│             Level: Typical | Version: A         │
├─────────────────────────────────────────────────┤
│  1. ○A  ○B  ○C  ○D      14. ○A  ○B  ○C  ○D     │
│  2. ○A  ○B  ○C  ○D      15. ○A  ○B  ○C  ○D     │
│  3. ○A  ○B  ○C  ○D      16. ○A  ○B  ○C  ○D     │
│  ...                     ...                    │
└─────────────────────────────────────────────────┘
```

**QR Code Data Structure:**
```json
{
  "sid": "12345",
  "cid": "junior-chemistry",
  "tid": "test-uuid",
  "lvl": "typical",
  "ver": "A",
  "dt": "2025-12-19"
}
```

---

### 4.5 Grading Module

**Purpose:** Scan completed scantron sheets and automatically grade tests, accounting for ability-level differentiation.

**Features:**
- Import scanned PDF (single PDF with multiple pages/students)
- PDF processing pipeline:
  - Split PDF into individual pages
  - Detect and decode QR code on each page
  - Extract student ID, test ID, **ability level**, version from QR
  - Detect filled bubbles using image processing
  - Compare against correct answer key for that **ability level + version** combination
- Support for multiple question types:
  - Multiple choice: Detect single filled bubble (A/B/C/D)
  - True/False: Detect T or F bubble
  - Matching: Detect grid selections
  - Numeric fill-in: Detect digit bubbles
- Grade calculation and reporting:
  - Raw score (correct/total)
  - Percentage score
  - Per-question results (for analytics)
  - **Scores are comparable across ability levels** (percentage-based)
- Export grades to Google Sheets in class folder
- Handle edge cases:
  - Multiple bubbles filled (flag for review)
  - No bubble filled (mark as skipped)
  - QR code unreadable (flag for manual review)
  - Student ability level mismatch (wrong test version distributed)

**Data Model - Grade Record:**
```json
{
  "test_id": "uuid",
  "student_id": "12345",
  "ability_level": "typical",
  "version": "A",
  "date_graded": "2025-12-20",
  "raw_score": 18,
  "total_questions": 20,
  "percentage": 90.0,
  "answers": {
    "q1": {"type": "multiple_choice", "selected": "C", "correct": true},
    "q2": {"type": "true_false", "selected": "F", "correct": false},
    "q3": {"type": "matching", "selected": {"1": "B", "2": "A", "3": "C"}, "correct": true}
  },
  "flagged_questions": [],
  "needs_review": false
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

### 4.7 Standards Import Module

**Purpose:** Import and structure state teaching standards from various sources (URLs, PDFs) using AI-assisted extraction.

**Features:**
- **Multiple import methods:**
  - Paste URL to state standards webpage
  - Upload PDF of standards document
  - Manual entry/paste of standards text
- **AI-powered extraction:**
  - Uses configured LLM to parse unstructured standards documents
  - Extracts hierarchical structure (domains, clusters, standards)
  - Identifies standard codes, descriptions, and grade levels
  - Handles various state formats (each state structures differently)
- **Review and edit:**
  - Teacher reviews extracted standards
  - Can correct any AI misinterpretations
  - Add notes or custom groupings
- **Storage:**
  - Structured JSON saved to class `standards/` folder in Google Drive
  - Original source document preserved for reference
- **Integration:**
  - Standards available when creating lessons and tests
  - Questions/content can be tagged to specific standards
  - Analytics can report mastery by standard

**User Flow:**
1. Navigate to class settings → Standards
2. Choose import method (URL, PDF upload, or paste)
3. If URL: App fetches page content, sends to LLM for parsing
4. If PDF: App extracts text, sends to LLM for parsing
5. LLM returns structured standards data
6. Teacher reviews/edits extracted standards
7. Save to Google Drive

**Data Model - Standards:**
```json
{
  "class_id": "junior-chemistry",
  "source": {
    "type": "url",
    "url": "https://community.ksde.gov/science/...",
    "fetched_date": "2025-12-19"
  },
  "state": "Kansas",
  "subject": "Science",
  "grade_level": "11",
  "domains": [
    {
      "code": "HS-PS1",
      "name": "Matter and Its Interactions",
      "standards": [
        {
          "code": "HS-PS1-1",
          "description": "Use the periodic table as a model to predict the relative properties of elements based on the patterns of electrons in the outermost energy level of atoms.",
          "keywords": ["periodic table", "elements", "electrons", "properties"]
        },
        {
          "code": "HS-PS1-2",
          "description": "Construct and revise an explanation for the outcome of a simple chemical reaction based on the outermost electron states of atoms, trends in the periodic table, and knowledge of the patterns of chemical properties.",
          "keywords": ["chemical reaction", "electrons", "periodic table"]
        }
      ]
    }
  ]
}
```

**Supported State Standards Formats:**
- Next Generation Science Standards (NGSS)
- Common Core State Standards
- State-specific variations
- Custom/local standards

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
3. Configure: # questions, question types, # distractors, topics
4. AI generates initial draft (Typical level)
5. Review in app, request changes via chat
6. Export to DOCX for manual editing
7. Re-import edited version
8. Continue AI refinement (repeat 5-7 as needed)
9. Finalize base test
10. AI generates differentiated versions (Advanced, Remedial, IEP)
11. Teacher reviews/adjusts each ability level version
12. Generate randomized versions (A/B/C/D) for each ability level
13. Generate scantron sheets for class (auto-matched to student ability levels)

### 7.4 Grade Tests
1. Scan completed scantrons (creates PDF via school scanner or phone PDF app)
2. Import PDF into app
3. App processes each page:
   - Read QR → identify student, ability level, and version
   - Detect answers (bubbles, T/F, matching grids)
   - Compare to correct answer key for that level + version
4. Review flagged sheets (errors, mismatches)
5. Export grades to Google Sheets
6. View analytics (including ability-level breakdowns)

---

## 8. Security & Privacy Considerations

- **Student Data:** Stored in teacher's own Google Drive (teacher controls access)
- **API Keys:** Encrypted in local storage, never transmitted
- **OAuth Tokens:** Stored securely, refreshed automatically
- **No Cloud Backend:** All processing local, no data sent to our servers
- **FERPA Compliance:** Teacher maintains control of student records

---

## 9. Future Considerations (Out of Scope for v1)

- **AI-assisted grading for written responses** (Short Answer, Essay)
  - OCR to extract handwritten text
  - LLM evaluation against rubric
  - Teacher confirmation/adjustment of suggested scores
- Collaborative features (multiple teachers)
- Integration with LMS (Google Classroom, Canvas)
- Mobile companion app
- Voice input for lesson planning
- Automatic standards alignment detection from materials

---

## 10. Success Metrics

- Time saved per test creation (target: 75% reduction)
- Grading accuracy (target: 99%+ for clean scans)
- User satisfaction (teacher feedback)
- Adoption rate among pilot users

---

## 11. Resolved Design Decisions

| Question | Decision |
|----------|----------|
| **Standards Format** | PDF from state websites; AI-assisted extraction via URL or upload |
| **Scanner Requirements** | Modern school scanners and phone PDF apps are sufficient; no special DPI requirements |
| **Offline Mode** | Not supported; app requires internet for Google Drive and LLM features |
| **Question Types** | V1: Multiple choice, True/False, Matching, Numeric fill-in (auto-graded). Future: Short answer, Essay (AI-assisted grading) |
| **Ability Levels** | 4 levels (Advanced, Typical, Remedial, IEP) stored per student in roster; tests auto-differentiated |
| **LLM Providers** | Support OpenAI, Anthropic, and Google from day one |

## 12. Open Questions

1. **Standards Caching:** Should we cache/refresh standards periodically, or only on-demand?
2. **Test Export Format:** What specific DOCX structure works best for teacher editing?
3. **Grade Weighting:** Should different ability levels have grade weighting options?

---

## 13. Appendix

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

1. **Foundation:** Electron app shell, Google OAuth, folder structure, LLM provider abstraction
2. **Roster:** Class/student management with ability levels, Drive sync
3. **Standards Import:** URL/PDF import, AI extraction, structured storage
4. **Test Gen:** Question generation (multiple types), ability-level differentiation, iterative editing, randomization
5. **Scantron:** Sheet generation with QR codes, ability-level matching
6. **Grading:** PDF import, bubble/answer detection, grading engine with level-aware keys
7. **Analytics:** Reports and insights, ability-level breakdowns
8. **Lesson Plans:** Agentic AI workflows, standards integration (most complex, last)

---

*Document Version: 1.1*
*Last Updated: 2025-12-19*
