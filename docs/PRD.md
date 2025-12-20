## 1\. Executive Summary

TeachingHelp is a cross-platform desktop application (Electron) designed to help K–12 teachers design coherent, standards-aligned units and lessons using a Backward Design framework. Rather than starting with activities, the application guides educators from standards and learning goals to aligned assessments, instructional plans, and feedback systems.

TeachingHelp is built around Universal Design for Learning (UDL) principles, supporting multiple means of engagement, representation, and expression to meet the needs of diverse learners. The platform includes AI-assisted planning tools, automated assessment generation, scantron-style grading, and performance analytics. TeachingHelp integrates with Google Drive for storage and supports multiple LLM providers for AI-powered features.

## 2\. Problem Statement

K–12 teachers spend a disproportionate amount of time managing instructional logistics rather than designing meaningful learning experiences. Common challenges include:

* Translating state and district standards into coherent, standards-aligned units  
* Designing both formative and summative assessments that are intentionally aligned to learning goals  
* Creating assessments where individual questions are clearly connected to specific standards and unit concepts  
* Manually grading paper-based assessments, often under time pressure and without efficient tools for analysis  
* Identifying which standards, concepts, or skills students are struggling with—and where those were taught in the unit

At the same time, increased access to AI tools has made authentic assessment more difficult, pushing many teachers back toward paper-and-pencil formats that are time-intensive to grade but remain essential for instructional integrity.

TeachingHelp addresses these challenges by providing an integrated, standards-aware workflow that supports Backward Design, aligns formative and summative assessments directly to unit instruction, and streamlines grading and analysis—while keeping teachers in full control of instructional decisions and assessment design.

TeachingHelp was conceived to reduce the tension between maintaining assessment integrity and managing the practical realities of teacher workload.

## 3\. Target Users

**Primary Users: Secondary Science Teachers (Grades 6–12)**

TeachingHelp is initially designed for middle and high school science teachers working within standards-based instructional frameworks. These educators typically:

* Teach multiple class sections and/or multiple science courses  
* Work within complex state or district science standards that require synthesis across grade levels  
* Use **Backward Design** to plan units but lack efficient tools to manage alignment across standards, assessments, and instruction  
* Rely on **paper-based assessments** to maintain academic integrity and reduce the impact of AI-enabled cheating and digital distraction  
* Use Google Drive as their primary system for lesson, assessment, and unit document storage across devices

TeachingHelp is designed with an explicit awareness of **teacher cognitive load and executive function demands**, recognizing that many educators:

* Juggle planning, grading, feedback, and data analysis under significant time constraints  
* Manage large volumes of instructional materials spread across units, courses, and years  
* Experience planning fatigue or overwhelm, regardless of technical proficiency  
* Benefit from tools that reduce decision fatigue, surface relevant context, and preserve instructional focus

The application is intended to support teachers with varying levels of technical comfort, prioritizing **clarity, structure, and cognitive offloading** over advanced configuration or complex workflows.

##  4\. Core Modules

### 4.1 Standards Import

**Purpose**

To import, organize, and contextualize secondary science standards in a way that supports **Backward Design**, unit coherence, and standards-referenced assessment.

This module ensures that standards are not treated as a flat checklist, but as the **conceptual backbone** of units, assessments, and instruction.

---

**Key Features**

**Multiple Import Methods**

* Paste a URL to a state or district science standards webpage  
* Upload a PDF of a standards or standards-bundle document  
* Manually paste standards text (for local or custom adaptations)

**AI-Assisted Standards Structuring**

* Uses the configured LLM to parse unstructured standards documents  
* Extracts and organizes standards into a **hierarchical structure**, including:  
  * Domains / disciplinary core ideas  
  * Performance expectations or standards  
  * Grade or course-level scope  
* Identifies standard codes, official descriptions, and key conceptual language  
* Supports **state-specific NGSS adaptations**, which vary widely in formatting

**Teacher Review and Control**

* Teachers review all extracted standards before use  
* Teachers can:  
  * Correct AI misinterpretations  
  * Rename or regroup standards for instructional clarity  
  * Add teacher-facing notes (e.g., “Introduced earlier in Unit 2”)  
* Final authority always rests with the teacher

**Instructional Integration**

* Imported standards are available during:  
  * Unit planning (Backward Design)  
  * Lesson planning  
  * Formative and summative assessment creation

* Individual assessment items can be explicitly aligned to one or more standards  
* Standards alignment remains visible throughout planning and grading workflows

**Standards-Referenced Analytics**

* Student performance can be analyzed by:  
  * Standard  
  * Unit  
  * Assessment type (formative vs summative)  
* Enables teachers to see **where standards were taught**, not just where students struggled

**Storage and Transparency**

* Structured standards data is stored as JSON in a class/standards/ folder in Google Drive  
* Original source documents (PDFs or URLs) are preserved for reference and auditability

---

**User Flow**

1. Navigate to **Class Settings → Standards**  
2. Select import method (URL, PDF upload, or paste text)  
3. Application extracts text and sends it to the configured LLM  
4. LLM returns structured standards data  
5. Teacher reviews, edits, and confirms standards  
6. Standards are saved and become available across planning, assessment, and analytics modules

---

**Supported Standards (Initial Scope)**

* Next Generation Science Standards (NGSS)  
* NGSS-aligned state adaptations and bundles (e.g., Kansas)  
* District-specific or locally modified science standards

### 4.2 Test Generation Module

**Purpose**

To support the creation of **intentional, standards-aligned formative and summative assessments** that reflect unit learning goals, preserve academic integrity, and remain manageable for teachers to grade.

This module prioritizes teacher judgment and assessment purpose over automation, using AI as a drafting and support tool—not a decision-maker.

---

### **Core Features**

#### **Standards-First Test Design**

* Tests are created *within the context of a unit* and explicitly aligned to selected standards  
* Each question is tagged to one or more standards and unit concepts  
* Teachers can see which standards are being assessed before finalizing the test  
* Supports balanced assessment across multiple standards rather than over-weighting a single concept  
* If an assessment is created outside of a unit context, the system provides a non-blocking prompt encouraging the teacher to link the assessment to a unit to improve standards alignment and analytics.

---

#### **Teacher-Controlled Question Creation**

* Teachers may:  
  * Write questions manually  
  * Edit AI-drafted questions  
  * Import and adapt questions from existing teacher-created materials (PDFs, DOCX, slides)  
* AI-assisted drafting can be enabled or disabled at any time  
* Teachers retain full editorial control over:  
  * Wording  
  * Difficulty  
  * Distractors  
  * Representations (diagrams, tables, scenarios)  
* Teachers can preview standards coverage and question balance before generating a full draft.

---

#### **Assessment Purpose Awareness**

* Teachers designate an assessment as **formative** or **summative**  
* The system adjusts defaults accordingly:  
  * Formative: fewer questions, targeted standards, feedback emphasis  
  * Summative: broader coverage, versioning, integrity safeguards

(Assessment purpose is informational, not enforced.)

#### **Flexible Differentiation (Non-Labeling)**

Instead of fixed “ability levels,” the system supports **accessible variants**, such as:

* Language-simplified versions  
* Reduced question sets  
* Scaffolded prompts or hints  
* Extended versions with additional challenge items

These variants support Universal Design for Learning (UDL) by offering multiple means of representation and expression without altering learning goals.

Teachers decide:

* Which variants exist  
* Who receives them  
* Whether variants differ in length, complexity, or representation

No variant is labeled as “remedial” or “advanced” in student-facing materials.

#### **Test Versioning & Integrity**

* Supports multiple randomized versions of the same assessment  
* Options include:  
  * Question order randomization  
  * Distractor order randomization  
  * Multiple equivalent test forms (A/B/C/D)  
* Each version maintains a traceable answer key  
* Designed specifically to support **paper-based testing environment**

### **Supported Question Types (Initial Release)**

| Question Type | Notes |
| :---- | :---- |
| Multiple Choice | 4-option default; editable |
| True / False | Optional justification in later versions |
| Matching | Grid-based |
| Numeric fill-in | Short numeric responses |

**Note:** Short answer and essay items are intentionally excluded from automated grading in the initial release. Future versions may support AI-assisted review, but written responses remain teacher-evaluated.

### **Export & Editing Workflow**

1. Generate initial draft inside TeachingHelp  
2. Export to editable formats (DOCX, Google Docs)  
3. Teacher edits as needed  
4. Re-import final version for grading and analytics  
5. Answer keys and standard alignment remain synchronized

### **4.5 Grading Module**

**Purpose**

To streamline the grading of paper-based assessments through scantron-style automation while preserving **teacher oversight, instructional intent, and assessment integrity**.  
This module is designed to reduce grading time and cognitive load without removing professional judgment from the evaluation process.

---

### **Core Features**

#### **Scan-Based Grading Workflow**

* Import scanned PDFs containing multiple student answer sheets  
* Supports common teacher workflows using:  
  * Classroom scanners  
  * Multi-page PDFs  
* Automatically splits PDFs into individual student pages

---

#### **Answer Detection & Matching**

* Detects and decodes QR codes on each page to identify:  
  * Student ID  
  * Test ID  
  * Test version  
  * Assigned assessment variant (if applicable)

* Uses image processing to detect filled responses for supported question types:  
  * Multiple choice (single filled bubble)  
  * True / False  
  * Matching  
  * Numeric fill-in (digit bubbles)

* Compares detected responses against the correct answer key for the corresponding test version

---

#### **Teacher Review & Flagging**

* Automatically flags responses requiring attention, including:  
  * Multiple bubbles filled  
  * No response detected  
  * Unreadable or missing QR code  
  * Test version or variant mismatch

* Flagged items are presented for **teacher review**, not auto-scored

* Teachers can override automated results before finalizing grades

---

#### **Score Calculation (Teacher-Transparent)**

* Calculates:  
  * Raw score (correct / total)  
  * Percentage score

* Per-question correctness is stored for later analysis

* When multiple assessment variants exist:  
  * Scores are reported within the context of the assigned variant  
  * Comparisons across variants are **informational, not enforced**

(Teacher interpretation is always required.)  
---

#### **Standards-Referenced Results**

* Each graded question retains its standard alignment

* Enables later analysis of:  
  * Performance by standard  
  * Patterns across assessments and units

* Grading results remain connected to instructional context

---

#### **Export & Record Management**

* Finalized grades can be exported to Google Sheets within the class folder

* Grade records include:  
  * Student identifiers  
  * Test version  
  * Final score  
  * Flags requiring review  
* Designed for easy transfer into district gradebooks

---

### **Design Principles**

* Automation supports efficiency, not authority  
* All grading decisions remain teacher-controlled  
* Paper-based assessments are treated as a first-class workflow, not a workaround

### **4.6 Analytics Module**

**Purpose**

To help teachers interpret assessment results in order to reflect on instruction, identify patterns, and make informed decisions about reteaching, pacing, and unit revision.

Analytics are designed to **support professional judgment**, not replace it.

---

### **Core Features**

#### **Multiple Views of Performance**

Analytics can be viewed by:

* Individual student  
* Entire class or section  
* Specific assessment  
* Standard or unit concept

These views allow teachers to shift between **student-level support** and **instructional-level reflection**.

---

#### **Instructionally Meaningful Patterns**

The system surfaces patterns such as:

* Questions frequently missed across a class  
* Standards showing lower performance within a specific assessment  
* Changes in performance across time or repeated assessments

Patterns are presented as **signals for teacher review**, not automated conclusions.

---

#### **Context-Aware Standards Analysis**

* Standards performance is always displayed:  
  * In the context of specific assessments  
  * Linked back to the unit where the standard was taught

* “Mastery” indicators reflect performance on assessed items only and are not treated as permanent student attributes

---

#### **Assessment Quality Feedback**

* Question-level analytics identify:  
  * Items frequently missed  
  * Items with unusual response distributions

* Designed to help teachers evaluate:  
  * Question clarity  
  * Distractor quality  
  * Alignment between instruction and assessment

---

#### **Trends Over Time**

* Track performance patterns across:  
  * Multiple assessments  
  * Multiple units  
  * Time periods

* Supports reflection on:  
  * Growth  
  * Retention  
  * Pacing decisions

---

#### **Planning Feedback Loop (Non-Automated)**

* When creating new units or lessons, the system can:  
  * Surface relevant prior assessment patterns  
  * Highlight standards that may benefit from additional emphasis or review

The system **does not automatically prescribe instruction**. All planning decisions remain teacher-directed.

---

### **Report Types**

1. **Class Performance Summary**  
   * Overall score distributions and trends (descriptive, not evaluative)

2. **Standards Performance Report**  
   * Performance by standard within specific assessments and units

3. **Student Progress Report**  
   * Individual student performance across time and assessments

4. **Question Analysis Report**  
   * Item-level patterns to support assessment refinement

---

### **Design Principles**

* Analytics provide visibility, not judgment  
* Context is preserved at every level  
* Data is descriptive, not punitive  
* Teacher interpretation is central

### **4.3 Roster Management Module**

**Purpose**

To manage student rosters for each class in a simple, secure, and instructionally neutral way that supports assessment workflows without embedding instructional labels or judgments into student records.

---

### **Core Features**

#### **Class Roster Management**

* Create and manage rosters for each class or section  
* Import student data via paste or CSV (from SIS exports or spreadsheets)  
* Store roster data in Google Drive on a per-class basis

---

#### **Student Data Fields (Minimal by Design)**

* Student ID (unique identifier used for grading and analytics)  
* First name  
* Last name  
* Email (optional)

The roster intentionally avoids storing instructional labels, ability levels, or special education identifiers.

TeachingHelp does not store IEP, 504, disability status, or other protected student classifications. Accommodation decisions remain assessment-specific and teacher-managed.

---

#### **Assessment Assignment Support**

* When generating an assessment, teachers assign:  
  * Test versions (A/B/C/D)  
  * Assessment variants (if used)  
* Assignment happens **per assessment**, not at the roster level  
* Supports bulk assignment for efficiency

This design allows flexibility without permanently labeling students.

---

#### **Scantron & Grading Integration**

* Student IDs are embedded in scantron QR codes for accurate identification  
* Grading workflows reference:  
  * Student ID  
  * Test ID  
  * Test version  
* Variant information is associated with the assessment, not the student record

---

#### **Roster Sync & Updates**

* Roster updates sync automatically with Google Drive  
* Supports student adds, drops, and section changes without data loss

---

### **Design Principles**

* Student records remain instructionally neutral  
* Differentiation is contextual, not permanent  
* Privacy and dignity are preserved  
* Teachers retain full control at the assessment level

**4.4 Scantron Generation Module**

**Purpose**

To generate personalized answer sheets for paper-based assessments with embedded identification data, ensuring accurate grading while preserving student privacy and instructional flexibility.

Scantron generation is driven by **assessment design**, not student labels.

---

### **Core Features**

#### **Assessment-Linked Scantron Generation**

* Generate scantron sheets linked to a specific assessment  
* Each scantron corresponds to:  
  * A student  
  * A test ID  
  * A test version (A/B/C/D)  
  * An assessment variant (if used)

---

#### **Assessment-Based Variant Assignment**

* During assessment setup, teachers assign:  
  * Test versions  
  * Assessment variants (e.g., reduced items, scaffolded prompts)  
* Scantrons reflect the assigned assessment configuration  
  Variant assignment is:  
  * Assessment-specific  
  * Changeable  
  * Invisible in student-facing materials

---

#### **Embedded Identification (QR Code)**

Each scantron includes a QR code containing:

* Student ID  
* Class ID  
* Test ID  
* Test version  
  Assessment variant ID (if applicable)  
* Date

This data enables accurate grading without encoding instructional judgments into student records.

---

#### **Human-Readable Header**

* Displays:  
  * Student name  
  * Class name  
  * Date  
  * Test version  
* Does **not** display variant labels or instructional classifications

---

#### **Answer Sheet Layout**

* Automatically generates appropriate answer formats based on question types:  
  * Multiple choice (A/B/C/D)  
  * True / False  
  * Matching grids  
  * Numeric fill-in bubbles  
* Supports variable numbers of questions per assessment variant

---

#### **Batch Generation & Export**

* Generate scantrons for an entire class or selected students  
* Export to PDF for printing  
* Supports efficient classroom distribution without revealing variants  
* When printing, scantrons are sorted alphabetically by student name, regardless of test version or variant.

---

### **Scantron Layout Principles**

* Clear spacing for reliable scanning  
  High-contrast bubbles  
  Consistent margins for school scanners  
* Student anonymity preserved beyond name and ID

---

### **Design Principles**

* Scantrons reflect assessments, not student identity  
* Differentiation is contextual and temporary  
* Student dignity and privacy are preserved  
* Paper-based testing is a first-class workflow

{

  "sid": "12345",

  "cid": "junior-chemistry",

  "tid": "test-uuid",

  "ver": "A",

  "variant": "v2",

  "dt": "2025-12-19"

}

## **5\. Technical Architecture**

### **5.1 Platform & Framework**

* **Runtime:** Electron (cross-platform desktop application supporting macOS, Windows, and Linux)  
* **Frontend:** React \+ TypeScript  
* **Styling:** Material UI v6 with Emotion  
* **State Management:** React Context or Zustand  
  **Build Tool:** Vite or Electron Forge

TeachingHelp is designed as a desktop application to support local file access, PDF scanning workflows, and paper-based assessment practices commonly used in secondary classrooms.

---

### **5.2 Backend / Services (Within Electron)**

* **Main Process (Node.js):**  
  * File system access  
  * PDF processing  
  * Image processing for scantron detection  
  * Google API interactions

* **Renderer Process:** React-based user interface  
* **IPC:** Electron IPC for secure communication between processes

All core functionality runs locally on the teacher’s device to preserve performance, privacy, and control.

---

### **5.3 External Integrations**

#### **Google Drive API**

* **Authentication:** OAuth 2.0  
* **Scopes Required:**  
  * drive.file – Access files created by the application  
  * drive.readonly – Read teacher-selected instructional materials  
  * spreadsheets – Write grade exports to Google Sheets  
* OAuth tokens are stored securely using encrypted local storage

All instructional materials, assessments, and grade exports remain in **teacher-controlled Google Drive folders**. TeachingHelp does not move or duplicate files outside of the teacher’s Drive.

---

#### **LLM Providers**

TeachingHelp supports multiple large language model providers. Users supply their own API keys.

| Provider | API Type | Models |
| ----- | ----- | ----- |
| OpenAI | REST API | GPT-4, GPT-4-turbo |
| Anthropic | REST API | Claude 3.5 Sonnet, Claude 3 Opus |
| Google | REST API | Gemini Pro, Gemini Ultra |

* LLM access is implemented via an abstract interface to remain provider-agnostic  
* Users select their preferred provider in application settings  
* API keys are stored locally in encrypted storage

##### **Instructional Guardrails for AI Usage**

* LLMs are used exclusively to assist with drafting, parsing, and organizational tasks (e.g., standards extraction, question drafting).  
* AI outputs are always reviewable and editable by the teacher.  
* No instructional, grading, or evaluative decisions are made autonomously by the system.

---

### **5.4 PDF Processing**

* **PDF Parsing:** pdf-lib, pdf-parse, or pdfjs-dist  
* **Image Processing:** sharp, jimp, or opencv4nodejs  
* **QR Code Handling:** jsQR (reading), qrcode (generation)  
* **PDF Generation:** pdfkit or puppeteer

PDF processing occurs locally to support scantron workflows without uploading student assessment data to external services.

---

### **5.5 Data Storage**

* **Local Storage:**  
  * JSON files via electron-store (application settings, cache, session state)

* **Cloud Storage:**  
  * Google Drive for rosters, instructional materials, assessments, and grade exports

* **Data Formats:**  
  * JSON for internal data representation  
  * PDF / DOCX for teacher-facing exports

The application intentionally minimizes stored student data and **does not store special education status, disability classifications, or other protected student attributes**. Accommodation and differentiation decisions remain assessment-specific and teacher-managed.

---

### **Design Principles**

* Teacher data ownership is preserved  
* Local-first processing supports privacy and performance  
* AI assists but does not decide  
* Paper-based assessment workflows are first-class, not secondary

## **6\. Data Hierarchy: Course vs Section**

TeachingHelp distinguishes between **Courses** (curriculum) and **Sections** (student groups):

| Concept | Definition | Examples |
|---------|------------|----------|
| **Course** | What you teach - the curriculum container | "Earth Science", "Chemistry", "Physics" |
| **Section** | Who you teach it to - a group of students | "Period 1", "Block A", "3rd Hour" |

A teacher might teach the same **Course** (e.g., Earth Science) to multiple **Sections** (Period 1, Period 2, Period 5). The curriculum, units, standards, and assessments are shared across all sections of a course. Only the roster and grades differ per section.

**Key implications:**
- Assessments are created at the **Course** level (curriculum)
- Assessments are assigned to **Sections** (student groups)
- Grades are recorded per **Section** per **Assignment**
- A student can only be in one Section of a Course

---

## **7\. Google Drive Folder Structure**

TeachingHelp uses a clear, minimal, and teacher-centered Google Drive folder structure organized by academic year and course. All instructional artifacts remain under teacher control and are stored in human-readable formats wherever possible.

---

### **Folder Structure**

```
/TeachingHelp/
├── config.json                           # App-level config
│
└── years/
    └── 2024-2025/                        # Academic year
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
                └── sections/
                    └── {section-id}/     # e.g., "period-1"
                        ├── meta.json     # Section metadata
                        ├── roster.json   # Student list
                        ├── assignments/
                        │   └── {assignment-id}.json
                        └── grades/
                            └── {assignment-id}-grades.json
```

---

### **Design Principles**

* Google Drive contains only teacher-authored instructional artifacts and exports
* Application settings and authentication data are stored locally, not in Drive
* Original standards documents are preserved alongside structured representations
* Units serve as the organizational spine for instruction, assessment, and analytics
* Courses contain shared curriculum; Sections contain student-specific data
* Folder naming is human-readable and stable over time
* Academic year folders allow for archiving and fresh starts

---

### **Benefits of This Structure**

* Mirrors how teachers naturally think about curriculum (courses → units → assessments)
* Separates curriculum (shared) from student data (per-section)
* Reduces cognitive load and file sprawl
* Supports Backward Design by anchoring assessments and analytics to units
* Allows teachers to inspect, share, or move materials without breaking the app
* Enables copying courses to new years without copying grades
* Remains compatible with district Google Drive policies and workflows

## **8\. User Flows**

TeachingHelp user flows are designed to minimize cognitive load, support iterative planning, and preserve teacher control at every stage. AI assistance is optional and reviewable throughout all workflows.

---

### **8.1 First-Time Setup**

1. Launch the application
2. Sign in with Google (OAuth flow)
3. Application creates /TeachingHelp/ folder in Google Drive if it does not already exist
4. Teacher selects preferred LLM provider and enters API key (optional; can be configured later)
5. Teacher creates first course

---

### **8.2 Create a Course**

1. Enter course name (e.g., "Earth Science") and grade level
2. Application creates course folder structure in Google Drive
3. Upload or paste state/district science standards documents
4. Review and confirm parsed standards
5. Create units within the course
6. Course curriculum is ready

---

### **8.3 Create a Section**

1. Select a course
2. Create a new section (e.g., "Period 1", "Block A")
3. Enter schedule and room info (optional)
4. Import student roster via paste or CSV
5. Section is ready for assignments

No instructional labels or student classifications are stored at the roster level.

---

### **8.4 Create an Assessment (Iterative Flow)**

1. Select course → select unit → "Create Assessment"
2. Select standards to be assessed
3. Choose assessment type (test, quiz, exam, benchmark, pretest, exit ticket)
4. Choose assessment purpose (formative or summative)
5. Configure assessment structure:
   * Question types
   * Number of questions
   * Topics or concepts
6. Generate initial draft (AI-assisted or teacher-authored)
7. Review and edit draft within the app
8. Export to DOCX or Google Docs for optional manual editing
9. Re-import edited version
10. Repeat refinement cycle as needed
11. Publish assessment (now available to assign to sections)

---

### **8.5 Configure Assessment Variants (Optional)**

1. Teacher chooses whether to create assessment variants
2. If enabled, teacher defines variants (e.g., reduced items, scaffolded language)
3. Review and edit each variant
4. Assign test versions (A/B/C/D) for integrity and randomization
5. Confirm final assessment configuration

Variants are assessment-specific and are not visible in student-facing materials.

---

### **8.6 Assign Assessment to Section**

1. Select section → "Assign Assessment"
2. Choose from published assessments in the course
3. Set assigned date and due date
4. Assign variants to students (if using variants)
5. Test versions (A/B/C/D) are auto-randomized within each variant
6. Assignment is created and ready for scantron generation

---

### **8.7 Generate Scantron Sheets**

1. Select assignment (assessment + section)
2. Generate scantron sheets with embedded QR codes
3. Scantrons are sorted alphabetically by student name for printing
4. Export scantrons to PDF for classroom use

---

### **8.8 Grade Assessments**

1. Scan completed scantrons using school scanner or phone PDF app
2. Import scanned PDF into TeachingHelp
3. Application processes each page:
   * Reads QR code (student ID, section ID, assignment ID, version, variant)
   * Detects marked responses
   * Matches responses to correct answer key
4. Flagged responses (ambiguous marks, mismatches) are surfaced for teacher review
5. Teacher reviews and confirms final scores
6. Grades are saved to the assignment
7. Export grades to Google Sheets

---

### **8.9 View Analytics & Reflect**

1. View analytics by:
   * Student
   * Section
   * Course (aggregate across sections)
   * Assessment
   * Standard or unit
2. Review question-level patterns and standards performance
3. Use insights to:
   * Adjust future instruction
   * Revise assessments
   * Inform unit planning

Analytics provide descriptive insight and do not prescribe instructional decisions.

---

### **Design Notes**

* Teachers can exit and resume any workflow at any stage  
* All AI-generated content is reviewable and editable  
* Differentiation is contextual, optional, and teacher-controlled  
* Paper-based assessment workflows are fully supported

**8\. Security & Privacy Considerations**

TeachingHelp is designed to support paper-based classroom workflows while minimizing risk, preserving teacher control, and protecting student privacy.

* **Student Data Storage:** Student roster, assessments, and grade exports are stored in the teacher’s Google Drive in the /TeachingHelp/ folder structure. Teachers control sharing and access permissions through Google Drive.  
* **Data Minimization:** TeachingHelp stores only the minimum student data needed for identification and grading (e.g., student ID and name).  
  * TeachingHelp **does not store** IEP/504 status, disability classifications, or other protected student attributes.  
* **Local-First Processing:** PDF processing, scantron detection, grading logic, and analytics calculations occur locally on the teacher’s device whenever possible.  
* **No TeachingHelp Cloud Backend:** TeachingHelp does not send student rosters, assessment scans, or grades to TeachingHelp-controlled servers.  
* **LLM Data Handling:** When teachers use AI-assisted features, the application may transmit teacher-selected instructional content (e.g., standards text or teacher-provided materials) to the configured LLM provider.  
  * AI usage is **optional** and teacher-controlled.  
  * Teachers can disable AI features to avoid transmitting content externally.  
  * The application does not use AI providers to autonomously assign grades or make evaluative decisions.

* **API Keys & Tokens:**  
  * LLM API keys are stored locally using encrypted local storage.  
  * Google OAuth tokens are stored locally and refreshed securely.

* **FERPA Alignment:** TeachingHelp is designed to help teachers maintain control of student educational records and to minimize disclosure. Teachers remain responsible for Google Drive permissions and local device security.

---

## **9\. Future Considerations (Out of Scope for v1)**

The following features are intentionally deferred beyond the initial release:

* **AI-assisted grading for written responses (Short Answer, Essay):**  
  * OCR to extract handwritten text  
  * Optional rubric-based scoring suggestions  
  * Teacher confirmation and override required

* **Collaborative workflows (multiple teachers / shared units)**  
* **LMS integrations** (e.g., Google Classroom, Canvas)  
* **Mobile companion app**  
* **Voice input for lesson planning**  
* **Enhanced standards alignment support** (e.g., semi-automatic tagging suggestions, improved crosswalk tools)

---

## **10\. Success Metrics**

Success will be evaluated using a combination of efficiency, accuracy, and teacher trust indicators:

* **Time saved on assessment creation** (target: meaningful reduction compared to current workflow; measured via pilot teacher self-report \+ usage telemetry where appropriate)  
* **Time saved on grading** (target: significant reduction for scantron-based assessments)  
* **Grading accuracy** (target: ≥ 99% accuracy on clean scans; tracked via spot-check and teacher-confirmed review corrections)  
* **Teacher trust and usability** (target: high satisfaction ratings and qualitative feedback from pilot teachers)  
* **Adoption and retention in pilot group** (target: continued use across multiple assessments/units)

---

## **11\. Resolved Design Decisions**

| Question | Decision |
| ----- | ----- |
| Standards Format | Import from state/district sources (URL, PDF, paste). Preserve original source and store a structured representation for use in planning and assessment alignment. |
| Scanner Requirements | Modern school scanners and phone PDF scanning apps are sufficient. The system should handle typical classroom-quality scans and flag pages needing review. |
| Offline Mode | Not supported in v1. Internet is required for Google Drive access and optional LLM features. Core grading/processing may be local, but sync requires connectivity. |
| Question Types (v1) | Multiple choice, True/False, Matching, Numeric fill-in (auto-graded). Written response types are deferred (see Future Considerations). |
| Differentiation Model | Differentiation is supported through **assessment-specific variants** (e.g., reduced items, simplified language, scaffolds). Variants are assigned per assessment and are not stored as permanent student labels. |
| LLM Providers | Support multiple providers (OpenAI, Anthropic, Google) via a provider-agnostic interface; teachers supply their own API keys. |

## **12\. Open Questions**

1. **Standards Caching:** Should the application cache standards locally and refresh on-demand, or periodically re-fetch and re-parse source documents when available?

2. **Test Export Format:** What DOCX / Google Docs structure best supports teacher editing while preserving answer key syncing and standard alignment?

3. **Variant Equivalency & Reporting:** If assessment variants differ in length or scaffolding, what reporting language best preserves context and avoids misleading comparisons?

4. **District Gradebook Workflow:** What export formats (CSV/Sheets templates) best match common district gradebook import needs?

---

## **13\. Appendix**

### **A. Technology Stack Summary**

| Layer | Technology |
| ----- | ----- |
| Runtime | Electron |
| UI Framework | React |
| Language | TypeScript (strict mode) |
| Styling | Material UI (Emotion) |
| State | React Context / Zustand |
| PDF Read | pdf-parse, pdfjs-dist |
| PDF Write | pdfkit, puppeteer |
| Image Processing | sharp, opencv4nodejs |
| QR Codes | jsQR, qrcode |
| Google APIs | googleapis npm package |
| LLM Integration | Provider-specific SDKs (via abstraction layer) |
| Local Storage | electron-store |
| Build | Electron Forge / Vite |

### **B. Milestones (High-Level)**

1. **Foundation:** Electron application shell, Google OAuth, Drive folder creation, provider abstraction, local encrypted storage

2. **Course & Section Setup:** Create courses with academic year, create sections within courses, roster import per section, standards import (URL/PDF/paste), structured standards storage

3. **Unit Planning Backbone:** Unit creation and organization within course structure (units as primary organizing spine for curriculum)

4. **Assessment Creation:** Standards-linked assessment drafting at course level, editing workflow, export/re-import, versioning (A/B/C/D), assessment types (test, quiz, exam, benchmark, pretest, exit ticket)

5. **Assignment & Scantron:** Assign assessments to sections, generate scantrons with QR codes (student ID + section ID + assignment ID + version + variant), alphabetized printing output

6. **Grading Engine:** Scan import, bubble detection, answer matching, flagging for review, grade export per assignment

7. **Analytics:** Descriptive performance views by section/course/student/assessment/standard; question analysis; planning feedback surfacing

8. **Lesson Planning (Deferred / Later):** Guided lesson planning workflows and deeper integration (most complex; after assessment pipeline is stable)

