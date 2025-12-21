# Grading Engine Redesign: Research & Implementation Plan

**Created:** 2025-12-20
**Priority:** CRITICAL - Must be next task
**Status:** Research & Planning

---

## Executive Summary

The current grading engine has three critical flaws that make it unreliable for production use:

1. **Illegible QR codes are silently skipped** - Pages with damaged QR codes don't appear in results
2. **Bubble detection is fundamentally broken** - Uses circle detection instead of fill analysis, assumes perfect scan alignment
3. **QR codes are too dense** - Storing 8 fields with full UUIDs creates fragile QR codes

This document outlines a research-backed redesign that will make the grading system robust and trustworthy.

---

## Table of Contents

1. [Problem Analysis](#problem-analysis)
2. [Research: Industry Approaches](#research-industry-approaches)
3. [Proposed Architecture](#proposed-architecture)
4. [Implementation Phases](#implementation-phases)
5. [Testing Strategy](#testing-strategy)
6. [Risk Assessment](#risk-assessment)

---

## Problem Analysis

### Problem 1: Silent Page Skipping

**Location:** `src/main/services/grade.service.ts:718-729`

**Current Behavior:**
```typescript
if (!page.qrData) {
  flags.push({ type: 'qr_error', ... })
  needsReview = true
  continue  // ← Page disappears from results
}
```

**Impact:**
- Teacher uploads 30 scantrons
- 2 have damaged QR codes
- System reports "28 students graded"
- Teacher has no idea which 2 students are missing

**Root Cause:**
- No mechanism to track "unidentified pages"
- No detection of whether a page is actually a scantron vs random document

### Problem 2: Bubble Detection Failure

**Location:** `src/main/services/grade.service.ts:465-567`

**Current Approach:**
1. Load image as grayscale
2. Apply Gaussian blur
3. Run HoughCircles to detect circular shapes
4. Map detected circles to expected grid positions
5. Check fill percentage of detected circles

**Why This Fails:**

| Issue | Description |
|-------|-------------|
| **HoughCircles detects edges** | It finds circle outlines in gradient images. Empty bubbles (thin outlines) are easier to detect than filled bubbles (solid dark circles with no gradient). |
| **Assumes perfect alignment** | Expected positions calculated from PDF coordinates. Scanned documents have margin shifts, skew, and DPI variations. |
| **No perspective correction** | Even 2-3 degree rotation causes bubble positions to drift 30+ pixels at page edges. |
| **Circle detection is noise-sensitive** | Coffee stains, fold marks, scanner artifacts create false positive circles. |

**Evidence of Failure:**
- Test PDF with 6 pages, 0 bubbles detected
- This is 0% accuracy - the algorithm is not working at all

### Problem 3: QR Code Density

**Current QR Payload:** ~200-250 characters
```json
{
  "v": 1,
  "sid": "550e8400-e29b-41d4-a716-446655440000",
  "secid": "550e8400-e29b-41d4-a716-446655440001",
  "aid": "550e8400-e29b-41d4-a716-446655440002",
  "uid": "550e8400-e29b-41d4-a716-446655440003",
  "ver": "A",
  "dt": "2025-01-15",
  "qc": 25
}
```

**Impact:**
- Dense QR codes have smaller modules (the black/white squares)
- Smaller modules are harder to scan reliably
- Scratches, poor print quality, or low-resolution scans cause read failures

**Proposed Minimal Payload:** ~80 characters
```json
{"v":1,"aid":"assignment-uuid","sid":"student-uuid"}
```
- Everything else can be looked up from the assignment record
- Reduces QR density by ~60%
- Use error correction level 'H' (highest) for maximum reliability

---

## Research: Industry Approaches

### How Commercial Scantron Systems Work

Commercial systems (Scantron, Remark OMR, GradeCam) use these techniques:

#### 1. Registration Mark Detection (Alignment)

**What:** Special marks in known positions used to compute page transformation.

**Our Implementation:** We already have 4 different registration marks in corners:
- Top-left: L-shape
- Top-right: Filled square
- Bottom-left: Filled circle
- Bottom-right: L-shape (inverted)

**Algorithm:**
1. Detect each mark using template matching or contour analysis
2. Compute homography (perspective transform) from detected positions to ideal positions
3. Warp entire image to correct alignment
4. Now all bubble positions are predictable

**Library Support:**
- `opencv-wasm` has `cv.findHomography()` and `cv.warpPerspective()`
- This is exactly what these functions are designed for

#### 2. Region-Based Fill Detection (Not Circle Detection)

**What:** Sample rectangular regions at known positions and measure darkness.

**Algorithm:**
1. After alignment correction, calculate exact pixel coordinates for each bubble
2. Extract a small rectangular region (e.g., 20x20 pixels) centered on expected bubble position
3. Calculate mean intensity of region
4. Compare to threshold (e.g., < 100 = filled, > 200 = empty)

**Advantages:**
- Works regardless of bubble shape (circles, ovals, rectangles)
- Not fooled by partial fills or stray marks
- Much faster than circle detection
- Deterministic - same input always gives same output

#### 3. Adaptive Thresholding

**What:** Instead of fixed threshold, calculate per-page threshold based on known empty bubbles.

**Algorithm:**
1. Sample all bubble positions
2. Sort by darkness
3. For a 25-question test with 4 choices, expect ~25 filled and ~75 empty
4. Use the gap between 25th and 26th darkest to set threshold
5. This handles variations in print darkness and scan contrast

#### 4. Confidence Scoring

**What:** Don't just say "filled" or "empty" - provide confidence level.

**Algorithm:**
- If bubble is clearly dark (< 80) or clearly light (> 180): high confidence
- If bubble is in the middle range (80-180): low confidence, flag for review
- If multiple bubbles for same question are filled: flag for review

### Reference Implementations

| System | Approach | Open Source? |
|--------|----------|--------------|
| GradeCam | Template matching + adaptive threshold | No |
| Remark OMR | Registration marks + region sampling | No |
| OpenOMR | Corner detection + grid fitting | Yes (Python) |
| OMR-Scanner | ArUco markers + perspective transform | Yes (Python) |

**Key Insight:** All reliable systems use registration marks for alignment first, then simple region sampling for detection. None use HoughCircles.

---

## Proposed Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Scantron Processing Pipeline                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. PDF → Pages          2. Page Analysis         3. Results    │
│  ┌──────────────┐       ┌────────────────┐       ┌───────────┐  │
│  │ mupdf        │──────▶│ Per-Page       │──────▶│ Aggregate │  │
│  │ Extract PNG  │       │ Processing     │       │ & Report  │  │
│  └──────────────┘       └────────────────┘       └───────────┘  │
│                                │                                 │
│                                ▼                                 │
│                    ┌───────────────────────┐                    │
│                    │ 2a. Registration      │                    │
│                    │ - Find 4 corner marks │                    │
│                    │ - Compute homography  │                    │
│                    │ - Warp to normalize   │                    │
│                    └───────────────────────┘                    │
│                                │                                 │
│                                ▼                                 │
│                    ┌───────────────────────┐                    │
│                    │ 2b. QR Code           │                    │
│                    │ - Extract QR region   │                    │
│                    │ - Decode with zxing   │                    │
│                    │ - Fallback rotations  │                    │
│                    └───────────────────────┘                    │
│                                │                                 │
│                                ▼                                 │
│                    ┌───────────────────────┐                    │
│                    │ 2c. Bubble Detection  │                    │
│                    │ - Sample known regions│                    │
│                    │ - Adaptive threshold  │                    │
│                    │ - Confidence scoring  │                    │
│                    └───────────────────────┘                    │
│                                │                                 │
│                                ▼                                 │
│                    ┌───────────────────────┐                    │
│                    │ 2d. Page Classification│                   │
│                    │ - Is this a scantron? │                    │
│                    │ - Track all pages     │                    │
│                    │ - Flag unidentified   │                    │
│                    └───────────────────────┘                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Details

#### Component 1: Registration Mark Detection

**Input:** Raw page image (PNG buffer)
**Output:** Transformation matrix + confidence

```typescript
interface RegistrationResult {
  found: boolean
  confidence: number  // 0-1, how confident we found all marks
  transform: number[] // 3x3 homography matrix
  isUpsideDown: boolean
  corners: {
    topLeft: { x: number; y: number } | null
    topRight: { x: number; y: number } | null
    bottomLeft: { x: number; y: number } | null
    bottomRight: { x: number; y: number } | null
  }
}
```

**Detection Strategy:**
1. Convert to grayscale and threshold to binary
2. Find contours in the image
3. For each expected corner position (with tolerance):
   - Top-left: Look for L-shaped contour (2 perpendicular lines)
   - Top-right: Look for filled square contour
   - Bottom-left: Look for filled circle contour
   - Bottom-right: Look for L-shaped contour (inverted)
4. If 3+ corners found, compute homography
5. If only 2 corners found, estimate the others from page dimensions

**Fallback:**
- If no registration marks found, assume the page is not a scantron
- Still try QR detection (might be a test page without marks from an older version)

#### Component 2: Page Normalization

**Input:** Raw image + transform matrix
**Output:** Normalized image (fixed dimensions, aligned)

```typescript
// Target dimensions (matches PDF at 150 DPI)
const NORMALIZED_WIDTH = 1275   // 8.5" × 150 DPI
const NORMALIZED_HEIGHT = 1650  // 11" × 150 DPI
```

**Process:**
1. Apply perspective transform using `cv.warpPerspective()`
2. Result is a perfectly aligned image where bubble positions are predictable

#### Component 3: QR Code Extraction

**Input:** Normalized image
**Output:** Student/assignment identification or error

```typescript
interface QRResult {
  found: boolean
  data: MinimalQRData | null
  error?: string
  region: { x: number; y: number; width: number; height: number }
}

interface MinimalQRData {
  v: 1
  aid: string  // Assignment ID
  sid: string  // Student ID
}
```

**Detection Strategy:**
1. Extract QR region from known position (after normalization, position is fixed)
2. Apply 2x upscale for reliability
3. Run zxing-wasm QR detection
4. If fails, try rotated 180° (page upside down)
5. Parse JSON and validate schema version

#### Component 4: Bubble Detection

**Input:** Normalized image + question count
**Output:** Detected answers with confidence

```typescript
interface BubbleResult {
  questionNumber: number
  answers: {
    label: 'A' | 'B' | 'C' | 'D'
    darkness: number      // 0-255 mean intensity
    filled: boolean
    confidence: number    // 0-1
  }[]
  selected: string | null
  flags: ('multiple' | 'unclear' | 'none')[]
}
```

**Detection Strategy:**
1. Calculate exact pixel coordinates for each bubble center (known from PDF layout)
2. For each bubble position:
   - Extract 15x15 pixel region centered on bubble
   - Calculate mean intensity (0=black, 255=white)
3. Compute adaptive threshold:
   - Collect all intensities
   - Find natural gap between filled and empty
   - Typical: filled < 100, empty > 180
4. Apply threshold and calculate confidence:
   - Very dark (< 60): filled, high confidence
   - Dark (60-100): filled, medium confidence
   - Gray (100-150): unclear, flag for review
   - Light (150-200): empty, medium confidence
   - Very light (> 200): empty, high confidence

#### Component 5: Page Classification

**Input:** Registration result + QR result
**Output:** Page type and processing status

```typescript
type PageType =
  | 'valid_scantron'      // Has marks + readable QR
  | 'unidentified_scantron' // Has marks, QR unreadable
  | 'blank_page'          // No marks, no content
  | 'unknown_document'    // Has content but not a scantron

interface PageClassification {
  type: PageType
  pageNumber: number
  shouldIncludeInResults: boolean
  requiresManualReview: boolean
}
```

**Classification Logic:**
```
Has registration marks?
├─ Yes → Has valid QR?
│        ├─ Yes → valid_scantron
│        └─ No  → unidentified_scantron (flag for review!)
└─ No  → Has significant content?
         ├─ Yes → unknown_document (warn user)
         └─ No  → blank_page (ignore)
```

### Data Flow Example

**Happy Path:**
1. Teacher uploads 30-page PDF
2. Each page processed:
   - Registration marks found → 100% confidence
   - Page warped to normalized coordinates
   - QR decoded → student identified
   - 25 bubbles sampled → answers extracted
3. Result: 30 grade records, 0 flagged

**Degraded Path:**
1. Teacher uploads 30-page PDF
2. Page 15: QR code scratched
   - Registration marks found → page is a scantron
   - QR decode fails → flag as unidentified
   - Bubbles still detected → answers preserved
3. Result: 29 identified, 1 unidentified flagged for review
4. Teacher manually selects student from dropdown
5. System merges answer data with manual identification

---

## Implementation Phases

### Phase 1: QR Code Simplification (1-2 hours)

**Goal:** Reduce QR density by 60% for better scan reliability

**Changes:**

1. **Update `ScantronQRData` interface** (`src/shared/types/scantron.types.ts`):
```typescript
export interface ScantronQRData {
  v: 1          // Schema version (keep for forwards compatibility)
  aid: string   // Assignment ID (required)
  sid: string   // Student ID (required)
}
```

2. **Update PDF generation** (`src/main/services/pdf.service.ts`):
```typescript
const qrData: ScantronQRData = {
  v: 1,
  aid: assignmentId,
  sid: student.studentId
}

// Use highest error correction
const qrDataUrl = await QRCode.toDataURL(JSON.stringify(qrData), {
  width: qrSize,
  margin: 2,  // Increase quiet zone
  errorCorrectionLevel: 'H'  // Changed from 'M'
})
```

3. **Update grade service** to look up section/unit/assessment from assignment:
```typescript
// In processScantronPDF, after QR decode:
const assignment = await driveService.getAssignment(qrData.aid)
const sectionId = assignment.sectionId
const unitId = assignment.unitId
// etc.
```

**Validation:**
- Generate new scantrons with simplified QR
- Visually confirm QR is less dense
- Test scanning with debug script

### Phase 2: Registration Mark Detection (2-3 hours)

**Goal:** Reliably find corner marks and compute page alignment

**New Module:** `src/main/services/registration.service.ts`

**Implementation:**
1. Template matching for each mark type
2. Contour analysis as fallback
3. Homography computation
4. Confidence scoring

**Validation:**
- Test with straight scans
- Test with rotated scans (5°, 10°)
- Test with upside-down scans
- Test with missing marks (coffee stain on corner)

### Phase 3: Position-Based Bubble Detection (2-3 hours)

**Goal:** Replace HoughCircles with direct region sampling

**Changes to `grade.service.ts`:**
1. After normalization, calculate exact bubble coordinates
2. Sample 15x15 pixel regions
3. Compute mean intensity
4. Apply adaptive threshold
5. Generate confidence scores

**Validation:**
- Test with clean scans (expect >98% accuracy)
- Test with noisy scans (expect >95% accuracy)
- Test with partial erasures
- Test with stray marks

### Phase 4: Unidentified Page Handling (1-2 hours)

**Goal:** Never silently skip pages

**Changes:**
1. Add `UnidentifiedPage` type to results
2. Track all pages with their classification
3. Include unidentified pages in UI for manual assignment
4. Build "Assign Student" dropdown in review UI

**Validation:**
- Scan document with intentionally damaged QR
- Confirm page appears in review queue
- Confirm manual assignment works

### Phase 5: End-to-End Testing (2-3 hours)

**Goal:** Validate complete pipeline

**Test Cases:**
1. Perfect conditions (clean print, good scan)
2. Degraded print quality
3. Low-resolution scan (100 DPI instead of 150)
4. Skewed scan (up to 10°)
5. Upside-down pages
6. Mixed orientation in same PDF
7. Damaged QR codes
8. Multiple bubbles filled
9. Light/uncertain marks
10. Blank pages mixed in

---

## Testing Strategy

### Unit Tests

| Component | Test Cases |
|-----------|------------|
| Registration Detection | Find marks in ideal image, rotated, skewed, partial |
| QR Parsing | Valid JSON, invalid JSON, wrong schema version |
| Bubble Sampling | Clear fills, partial fills, empty, stray marks |
| Threshold Calculation | Normal distribution, bimodal, edge cases |

### Integration Tests

| Scenario | Expected Result |
|----------|-----------------|
| 30 clean pages | 30 records, 0 flags |
| 30 pages, 1 damaged QR | 29 identified, 1 unidentified flagged |
| 30 pages, 2 upside down | 30 records (auto-corrected), 0 flags |
| 30 pages with partial marks | 30 records, ~5 flagged for review |

### Test Data Creation

**Needed:**
1. Generate test scantrons with known answers
2. Print and scan with various quality levels
3. Introduce controlled damage (scratches, folds, stains)
4. Create ground truth file mapping pages to expected answers

### Accuracy Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| QR Detection Rate | > 99% | (pages with readable QR) / (total pages with undamaged QR) |
| Page Classification Accuracy | 100% | (correctly classified pages) / (total pages) |
| Bubble Detection Accuracy | > 98% | (correct answers) / (total answers) |
| False Positive Rate | < 0.5% | (incorrectly marked filled) / (actually empty) |
| Processing Speed | < 500ms/page | Total time / page count |

---

## Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| opencv-wasm doesn't support warpPerspective | Low | High | Verified: it does support it |
| Registration marks not visible after scanning | Low | High | Test with real scans before finalizing mark design |
| Adaptive threshold fails on edge cases | Medium | Medium | Include manual threshold override in review UI |
| Different scanners produce very different results | Medium | Medium | Test with 2-3 scanner types, add calibration if needed |

### Process Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Underestimating implementation time | Medium | Medium | Build prototype first, validate each phase |
| Breaking existing functionality | Low | High | Keep old code until new code is validated |
| Missing edge cases | Medium | High | Comprehensive test data set with real scans |

---

## Appendix A: Coordinate Reference

### PDF Layout (at 72 DPI)

```
Page: 612 x 792 points (8.5" x 11")
Margin: 50 points

Registration Marks:
- Top-left: (25, 25) - (45, 45)  [L-shape]
- Top-right: (567, 25) - (587, 45)  [filled square]
- Bottom-left: (25, 747) - (45, 767)  [filled circle]
- Bottom-right: (567, 747) - (587, 767)  [L-shape inverted]

QR Code:
- Position: (50, ~120)
- Size: 80 x 80 points

Bubble Grid:
- Start Y: ~210 points (after QR + instructions)
- Row height: 24 points
- Bubble spacing: 22 points
- Bubble radius: 7 points
- Questions per column: 25
```

### Scanned Layout (at 150 DPI)

```
Multiply all coordinates by (150/72) = 2.083

Page: 1275 x 1650 pixels
Margin: 104 pixels

Registration Marks (approximate centers):
- Top-left: (52, 52)
- Top-right: (1223, 52)
- Bottom-left: (52, 1598)
- Bottom-right: (1223, 1598)

Bubble Grid:
- Start Y: ~437 pixels
- Row height: 50 pixels
- Bubble spacing: 46 pixels
- Bubble radius: 15 pixels
```

---

## Appendix B: OpenCV-WASM Functions Needed

| Function | Purpose | Documentation |
|----------|---------|---------------|
| `cv.cvtColor` | Convert to grayscale | Already used |
| `cv.threshold` | Binary thresholding | For mark detection |
| `cv.findContours` | Find shapes | For registration marks |
| `cv.boundingRect` | Get contour bounds | For mark classification |
| `cv.findHomography` | Compute perspective transform | For page alignment |
| `cv.warpPerspective` | Apply transform | For page normalization |
| `cv.matchTemplate` | Template matching | Alternative mark detection |

All functions are available in opencv-wasm 4.x.

---

## Appendix C: QR Code Error Correction Levels

| Level | Recovery Capacity | Use Case |
|-------|-------------------|----------|
| L | 7% | Maximum data, minimal damage expected |
| M | 15% | Balance (current setting) |
| Q | 25% | Higher damage tolerance |
| H | 30% | Maximum damage tolerance (recommended) |

With smaller payload + level H, QR codes will be significantly more reliable.

---

## Next Steps

1. **Review this document** - Confirm approach makes sense
2. **Build Phase 1** - Simplify QR code (quick win, immediate improvement)
3. **Create test data set** - Print and scan test documents
4. **Build Phase 2** - Registration mark detection
5. **Build Phase 3** - Position-based bubble detection
6. **Build Phase 4** - Unidentified page handling
7. **Run Phase 5** - End-to-end validation

**Estimated Total Time:** 8-12 hours of focused development

**Success Criteria:**
- 99%+ QR detection rate on undamaged codes
- 98%+ bubble detection accuracy
- 0% silent page skipping
- All edge cases handled with appropriate flags
