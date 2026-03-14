# QTI 3.0 Phase 3 Complete: Test Structure

## Overview

Phase 3 implements the hierarchical structure for organizing multiple assessment items into a complete test. The system now supports creating assessmentTest.xml files with proper QTI 3.0 structure: AssessmentTest → TestPart → AssessmentSection → ItemRef.

---

## Components Delivered

### 1. Test Structure Types
**File**: `testStructure.ts`

Comprehensive type definitions for the entire test hierarchy.

**Key Interfaces**:
- `AssessmentTest` - Top-level test structure
- `TestPart` - Major test divisions with navigation settings
- `AssessmentSection` - Grouped items with shared settings
- `AssessmentItemRef` - References to individual items
- `TestBuildConfig` - Input configuration for building tests
- `ItemSessionControl` - Controls for item behavior
- `TimeLimits` - Time constraints at various levels
- `TestOutcomeDeclaration` - Test-level outcome variables
- `OutcomeProcessing` - Score aggregation logic

---

### 2. Test Builder
**File**: `testBuilder.ts`

Generates complete assessmentTest.xml files from configuration.

**Key Methods**:
- `build()` - Creates complete test structure
- `toXML()` - Converts test to QTI 3.0 XML
- `buildTestParts()` - Creates test parts with navigation settings
- `buildAssessmentSections()` - Organizes items into sections
- `buildItemRef()` - Creates item references with mappings
- `buildOutcomeProcessing()` - Sets up score aggregation

**Helper Functions**:
- `createTestBuilder(config)` - Factory function
- `buildAssessmentTest(config)` - Quick build and XML generation

---

## Test Hierarchy

```
AssessmentTest (Root)
├── Outcome Declarations (TOTAL_SCORE, PASS, etc.)
├── Time Limits (optional, test-level)
├── TestPart (one or more)
│   ├── Navigation Mode (linear | nonlinear)
│   ├── Submission Mode (individual | simultaneous)
│   ├── Item Session Control
│   ├── Time Limits (optional, part-level)
│   └── AssessmentSection (one or more)
│       ├── Title & Visibility
│       ├── Ordering (shuffle settings)
│       ├── Rubric Blocks (instructions)
│       ├── Time Limits (optional, section-level)
│       └── AssessmentItemRef (one or more)
│           ├── Item HREF (path to XML)
│           ├── Categories
│           ├── Weight
│           ├── Time Limit
│           └── Variable Mappings (SCORE → TOTAL_SCORE)
└── Outcome Processing (score aggregation)
```

---

## Grouping Strategies

The test builder supports multiple strategies for organizing items into sections:

### 1. Single Section (Default)
All items in one section.

```typescript
const config: TestBuildConfig = {
  testIdentifier: 'TEST_001',
  testTitle: 'My Test',
  items: [...],
  groupingStrategy: 'single-section',
};
```

**Generated Structure**:
```
TestPart
└── Section "All Questions"
    ├── Item 1
    ├── Item 2
    └── Item 3
```

### 2. By Category
Items grouped by their category property.

```typescript
const config: TestBuildConfig = {
  testIdentifier: 'TEST_001',
  testTitle: 'Math Test',
  items: [
    { itemIdentifier: 'Q1', category: 'Algebra', ... },
    { itemIdentifier: 'Q2', category: 'Geometry', ... },
    { itemIdentifier: 'Q3', category: 'Algebra', ... },
  ],
  groupingStrategy: 'by-category',
};
```

**Generated Structure**:
```
TestPart
├── Section "Algebra"
│   ├── Item Q1
│   └── Item Q3
└── Section "Geometry"
    └── Item Q2
```

### 3. By Difficulty
Items grouped by difficulty level (Easy/Medium/Hard).

```typescript
const config: TestBuildConfig = {
  testIdentifier: 'TEST_001',
  testTitle: 'Progressive Test',
  items: [
    { itemIdentifier: 'Q1', category: 'easy', ... },
    { itemIdentifier: 'Q2', category: 'medium', ... },
    { itemIdentifier: 'Q3', category: 'hard', ... },
  ],
  groupingStrategy: 'by-difficulty',
};
```

**Generated Structure**:
```
TestPart
├── Section "Easy Questions"
│   └── Item Q1
├── Section "Medium Questions"
│   └── Item Q2
└── Section "Hard Questions"
    └── Item Q3
```

### 4. Custom Sections
Manually define sections with specific items.

```typescript
const config: TestBuildConfig = {
  testIdentifier: 'TEST_001',
  testTitle: 'Custom Test',
  items: [...],
  groupingStrategy: 'custom',
  customSections: [
    {
      identifier: 'SECTION_INTRO',
      title: 'Introduction Questions',
      itemIdentifiers: ['Q1', 'Q2'],
      shuffle: false,
    },
    {
      identifier: 'SECTION_MAIN',
      title: 'Main Assessment',
      itemIdentifiers: ['Q3', 'Q4', 'Q5'],
      shuffle: true,
      timeLimits: { maxTime: 600 },
    },
  ],
};
```

---

## Navigation Modes

### Linear Navigation
Candidates proceed sequentially, cannot skip forward or return to previous items.

```typescript
const config: TestBuildConfig = {
  testIdentifier: 'TEST_001',
  testTitle: 'Linear Test',
  navigationMode: 'linear',
  items: [...],
};
```

**Use Cases**: Exams where question order matters, prevent looking ahead

### Nonlinear Navigation
Candidates can navigate freely between items, skip questions, and review.

```typescript
const config: TestBuildConfig = {
  testIdentifier: 'TEST_001',
  testTitle: 'Flexible Test',
  navigationMode: 'nonlinear',
  allowReview: true,
  items: [...],
};
```

**Use Cases**: Practice tests, surveys, formative assessments

---

## Submission Modes

### Individual Submission
Each item is submitted immediately after answering.

```typescript
const config: TestBuildConfig = {
  submissionMode: 'individual',
  showFeedback: true, // Show feedback after each item
};
```

**Characteristics**:
- Immediate scoring and feedback
- Cannot change answers after submission
- Suitable for learning contexts

### Simultaneous Submission
All items submitted together at test end.

```typescript
const config: TestBuildConfig = {
  submissionMode: 'simultaneous',
  allowReview: true, // Review before final submission
};
```

**Characteristics**:
- No feedback until test completion
- Can revise answers before submitting
- Suitable for high-stakes exams

---

## Item Session Control

Controls behavior of all items in the test.

```typescript
const config: TestBuildConfig = {
  maxAttempts: 2,           // Allow 2 attempts per item
  showFeedback: true,       // Show feedback after submission
  allowReview: true,        // Allow reviewing items
  showSolution: false,      // Hide solutions until test end
  items: [...],
};
```

**Options**:
- `maxAttempts` - Number of attempts per item (0 = unlimited)
- `showFeedback` - Display feedback immediately
- `allowReview` - Enable review/navigation
- `showSolution` - Show correct answers
- `allowSkipping` - Allow skipping items
- `validateResponses` - Validate before accepting

---

## Variable Mappings & Score Aggregation

Item scores are automatically mapped to test-level outcomes.

### Automatic Mapping
Each item's `SCORE` outcome is mapped to `TOTAL_SCORE`:

```typescript
const itemRef: AssessmentItemRef = {
  identifier: 'Q001',
  href: 'items/Q001.xml',
  weight: 2.0, // This item worth 2 points
  variableMappings: [
    {
      sourceIdentifier: 'SCORE',      // From item
      targetIdentifier: 'TOTAL_SCORE', // To test
      transform: 'multiply',
      transformValue: 2.0,             // Apply weight
    }
  ]
};
```

### Test Outcomes
The test builder creates standard outcome declarations:

**TOTAL_SCORE**: Sum of all item scores
```xml
<qti-outcome-declaration 
  identifier="TOTAL_SCORE" 
  cardinality="single" 
  base-type="float"
  normal-maximum="10.0"
  normal-minimum="0">
  <qti-default-value>
    <qti-value>0</qti-value>
  </qti-default-value>
</qti-outcome-declaration>
```

**PASS**: Boolean pass/fail (60% threshold)
```xml
<qti-outcome-declaration 
  identifier="PASS" 
  cardinality="single" 
  base-type="boolean">
  <qti-default-value>
    <qti-value>false</qti-value>
  </qti-default-value>
</qti-outcome-declaration>
```

**PERCENT_SCORE**: Normalized 0-100 score (optional)
```xml
<qti-outcome-declaration 
  identifier="PERCENT_SCORE" 
  cardinality="single" 
  base-type="float"
  normal-maximum="100"
  normal-minimum="0">
  <qti-default-value>
    <qti-value>0</qti-value>
  </qti-default-value>
</qti-outcome-declaration>
```

### Outcome Processing
Test-level logic to compute pass/fail and percentage:

```xml
<qti-outcome-processing>
  <!-- Set PASS to true if TOTAL_SCORE >= 60% of max -->
  <qti-set-outcome-value identifier="PASS">
    <qti-gte>
      <qti-variable identifier="TOTAL_SCORE" />
      <qti-product>
        <qti-variable identifier="TOTAL_SCORE" property="normalMaximum" />
        <qti-base-value base-type="float">0.6</qti-base-value>
      </qti-product>
    </qti-gte>
  </qti-set-outcome-value>
  
  <!-- Calculate percentage score -->
  <qti-set-outcome-value identifier="PERCENT_SCORE">
    <qti-product>
      <qti-divide>
        <qti-variable identifier="TOTAL_SCORE" />
        <qti-variable identifier="TOTAL_SCORE" property="normalMaximum" />
      </qti-divide>
      <qti-base-value base-type="float">100</qti-base-value>
    </qti-product>
  </qti-set-outcome-value>
</qti-outcome-processing>
```

---

## Time Limits

Time limits can be set at three levels:

### 1. Test Level
Total time for entire test:
```typescript
const config: TestBuildConfig = {
  timeLimits: {
    maxTime: 3600, // 1 hour total
  },
};
```

### 2. Section Level
Time for a specific section:
```typescript
customSections: [
  {
    identifier: 'SECTION_1',
    title: 'Quick Fire Round',
    itemIdentifiers: ['Q1', 'Q2', 'Q3'],
    timeLimits: {
      maxTime: 300, // 5 minutes for this section
    },
  }
]
```

### 3. Item Level
Time for individual item:
```typescript
items: [
  {
    itemIdentifier: 'Q001',
    itemHref: 'items/Q001.xml',
    timeLimit: 60, // 60 seconds for this item
  }
]
```

**Cascading**: If an item has no time limit, section limit applies. If section has no limit, test limit applies.

---

## Rubric Blocks

Instructional text displayed to candidates:

```typescript
customSections: [
  {
    identifier: 'SECTION_1',
    title: 'Essay Questions',
    itemIdentifiers: ['Q1', 'Q2'],
    rubric: '<p>Read each question carefully. Provide detailed answers with examples.</p>',
  }
]
```

**Generated XML**:
```xml
<qti-assessment-section identifier="SECTION_1" title="Essay Questions">
  <qti-rubric-block view="candidate">
    <p>Read each question carefully. Provide detailed answers with examples.</p>
  </qti-rubric-block>
  <!-- items... -->
</qti-assessment-section>
```

---

## Complete Usage Example

```typescript
import { buildAssessmentTest, TestBuildConfig } from './qti3';

// Define test configuration
const config: TestBuildConfig = {
  testIdentifier: 'MATH_FINAL_2024',
  testTitle: 'Mathematics Final Exam 2024',
  toolName: 'AC Question Bank',
  toolVersion: '1.0.0',
  
  // Test settings
  navigationMode: 'nonlinear',
  submissionMode: 'simultaneous',
  maxAttempts: 1,
  showFeedback: false,
  allowReview: true,
  showSolution: false,
  aggregateScores: true,
  normalizeScores: true,
  
  // Time limit: 2 hours
  timeLimits: {
    maxTime: 7200,
  },
  
  // Items to include
  items: [
    {
      itemIdentifier: 'Q001',
      itemHref: 'items/Q001.xml',
      title: 'Algebra - Linear Equations',
      category: 'Algebra',
      weight: 1.0,
      required: true,
    },
    {
      itemIdentifier: 'Q002',
      itemHref: 'items/Q002.xml',
      title: 'Geometry - Triangles',
      category: 'Geometry',
      weight: 1.5,
      required: true,
    },
    {
      itemIdentifier: 'Q003',
      itemHref: 'items/Q003.xml',
      title: 'Calculus - Derivatives',
      category: 'Calculus',
      weight: 2.0,
      required: true,
      timeLimit: 600, // 10 minutes for this item
    },
  ],
  
  // Group by category
  groupingStrategy: 'by-category',
};

// Generate XML
const testXML = buildAssessmentTest(config);

// Save to file
// fs.writeFileSync('assessmentTest.xml', testXML);
```

**Generated Structure**:
```
assessmentTest.xml
├── TOTAL_SCORE outcome (max: 4.5)
├── PASS outcome (60% threshold)
├── PERCENT_SCORE outcome
└── TestPart (nonlinear, simultaneous)
    ├── Section "Algebra"
    │   └── Q001 (weight: 1.0)
    ├── Section "Geometry"
    │   └── Q002 (weight: 1.5)
    └── Section "Calculus"
        └── Q003 (weight: 2.0, limit: 600s)
```

---

## Integration with Phase 1 & 2

### Connecting Items to Tests

1. **Build Items** (Phase 1):
```typescript
import { buildAssessmentItem } from './qti3';

const items = questions.map(q => buildAssessmentItem({
  questionType: q.type,
  question: q,
  imageFolderPath: './images',
}));

// Save items to files: items/Q001.xml, items/Q002.xml, etc.
```

2. **Build Test** (Phase 3):
```typescript
import { buildAssessmentTest } from './qti3';

const testConfig: TestBuildConfig = {
  testIdentifier: 'TEST_001',
  testTitle: 'My Test',
  items: items.map(item => ({
    itemIdentifier: item.assessmentItem.identifier,
    itemHref: `items/${item.assessmentItem.identifier}.xml`,
    weight: 1.0,
  })),
};

const testXML = buildAssessmentTest(testConfig);
// Save to assessmentTest.xml
```

3. **Package** (Phase 4 - Next):
```typescript
// Next phase: Create IMS Content Package
// - imsmanifest.xml (references test + items)
// - ZIP packaging
```

---

## XML Output Format

Example generated assessmentTest.xml:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-test
  xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqtiasi_v3p0 https://purl.imsglobal.org/spec/qti/v3p0/schema/xsd/imsqti_asiv3p0_v1p0.xsd"
  identifier="TEST_001"
  title="Sample Test"
  tool-name="AC Question Bank"
  tool-version="1.0.0">
  
  <qti-outcome-declaration identifier="TOTAL_SCORE" cardinality="single" base-type="float" normal-maximum="3.0" normal-minimum="0">
    <qti-default-value>
      <qti-value>0</qti-value>
    </qti-default-value>
  </qti-outcome-declaration>
  
  <qti-outcome-declaration identifier="PASS" cardinality="single" base-type="boolean">
    <qti-default-value>
      <qti-value>false</qti-value>
    </qti-default-value>
  </qti-outcome-declaration>
  
  <qti-test-part identifier="PART_1" navigation-mode="linear" submission-mode="individual">
    <qti-item-session-control max-attempts="1" show-feedback="true" allow-review="true" show-solution="false" allow-skipping="true" validate-responses="false" />
    
    <qti-assessment-section identifier="SECTION_1" title="All Questions" visible="true">
      <qti-assessment-item-ref identifier="Q001" href="items/Q001.xml">
        <qti-variable-mapping source-identifier="SCORE" target-identifier="TOTAL_SCORE" />
      </qti-assessment-item-ref>
      
      <qti-assessment-item-ref identifier="Q002" href="items/Q002.xml">
        <qti-variable-mapping source-identifier="SCORE" target-identifier="TOTAL_SCORE" />
      </qti-assessment-item-ref>
      
      <qti-assessment-item-ref identifier="Q003" href="items/Q003.xml">
        <qti-variable-mapping source-identifier="SCORE" target-identifier="TOTAL_SCORE" />
      </qti-assessment-item-ref>
    </qti-assessment-section>
  </qti-test-part>
  
  <qti-outcome-processing>
    <qti-set-outcome-value identifier="PASS">
      <qti-gte>
        <qti-variable identifier="TOTAL_SCORE" />
        <qti-product>
          <qti-variable identifier="TOTAL_SCORE" property="normalMaximum" />
          <qti-base-value base-type="float">0.6</qti-base-value>
        </qti-product>
      </qti-gte>
    </qti-set-outcome-value>
  </qti-outcome-processing>
  
</qti-assessment-test>
```

---

## Testing Phase 3

### Test Cases

1. **Single section test**
   - All items in one section
   - Linear navigation
   - Individual submission

2. **Multi-section by category**
   - Items grouped by subject
   - Nonlinear navigation
   - Simultaneous submission

3. **Custom sections with rubrics**
   - Manually defined sections
   - Section-level time limits
   - Instructional rubric blocks

4. **Weighted items**
   - Different point values per item
   - Correct score aggregation
   - Pass/fail threshold (60%)

5. **Time limits at multiple levels**
   - Test-level: 1 hour
   - Section-level: 20 minutes
   - Item-level: 5 minutes

6. **Shuffle ordering**
   - Section with shuffle enabled
   - Verify `<qti-ordering shuffle="true">`

---

## Next Steps: Phase 4

With Phase 3 complete, we can now proceed to Phase 4: IMS Content Packaging

**Phase 4 Goals**:
- Create `imsmanifest.xml` file
- Register all resources (test, items, images)
- Implement IMS Content Package structure
- ZIP packaging with correct directory layout
- Validate complete package

**Files to Create**:
- `src/engine/qti3/manifestBuilder.ts` - IMS manifest generation
- `src/engine/qti3/packageBuilder.ts` - ZIP package creation
- `src/engine/qti3/resourceRegistry.ts` - Resource management

---

## Phase 3 Summary

✅ **Test Structure** - Complete hierarchical organization  
✅ **TestPart** - Navigation and submission modes  
✅ **AssessmentSection** - Grouping with 4 strategies  
✅ **AssessmentItemRef** - Item references with mappings  
✅ **Outcome Declarations** - TOTAL_SCORE, PASS, PERCENT_SCORE  
✅ **Outcome Processing** - Score aggregation and pass/fail  
✅ **Item Session Control** - Attempts, feedback, review settings  
✅ **Time Limits** - Multi-level time constraints  
✅ **Rubric Blocks** - Instructional content  
✅ **Variable Mappings** - Automatic score aggregation  
✅ **XML Generation** - Full QTI 3.0 compliant assessmentTest.xml  

**Status**: Phase 3 is complete. The system can now create complete assessment tests that organize multiple items into a test structure with proper navigation, scoring, and time management.
