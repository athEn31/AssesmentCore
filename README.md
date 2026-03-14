# QTI 3.0 Implementation Plan
System: Excel + Images → QTI XML Generator  
Specification Reference: https://www.imsglobal.org/spec/qti/v3p0/impl

---

# 1. Objective

Upgrade the current system that converts **Excel files and image assets into QTI XML** so that it fully supports **QTI 3.0 specification** and produces **valid QTI 3.0 content packages**.

The upgraded system must:

- Generate **QTI 3.0 compliant assessment items**
- Support **assessment tests and sections**
- Embed **images correctly**
- Implement **response processing and scoring**
- Generate **IMS Content Packages**
- Pass **QTI schema validation**

---

# 2. Current System

Current pipeline:

```
Excel File
   ↓
Question Parser
   ↓
Image Mapping
   ↓
Basic QTI XML Generator
```

Current limitations:

- No **assessment-test structure**
- No **content packaging**
- Limited **response processing**
- No **stimulus reuse**
- No **metadata**
- No **validation layer**

---

# 3. Target Architecture

Target pipeline:

```
Excel + Images
       │
       ▼
Excel Parser
       │
       ▼
Question Data Model
       │
       ▼
QTI Item Builder
       │
       ▼
Test Builder
       │
       ▼
Packaging Engine
       │
       ▼
QTI Content Package (.zip)
```

Generated output structure:

```
package.zip

imsmanifest.xml
assessmentTest.xml

items/
   item_001.xml
   item_002.xml

images/
   img1.png
   img2.png
```

---

# 4. Core QTI 3.0 Components

The system must implement the following **QTI structures**.

## 4.1 Assessment Item

Root element for every question.

```
<qti-assessment-item>
```

Required attributes:

```
identifier
title
adaptive
timeDependent
xmlns
```

Required children:

```
qti-response-declaration
qti-outcome-declaration
qti-item-body
qti-response-processing
```

Implementation steps:

1. Create item builder module
2. Map Excel rows to item identifiers
3. Generate XML per item
4. Attach image references

---

# 4.2 Item Body

Contains visible question content.

```
<qti-item-body>
```

Example:

```
<qti-item-body>
   <qti-choice-interaction responseIdentifier="RESPONSE">
      ...
   </qti-choice-interaction>
</qti-item-body>
```

Responsibilities:

- Render question prompt
- Render interactions
- Insert images
- Render mathematical content

---

# 4.3 Response Declaration

Defines how answers are stored.

Example:

```
<qti-response-declaration
 identifier="RESPONSE"
 cardinality="single"
 baseType="identifier">
</qti-response-declaration>
```

Excel mapping:

| Question Type | Cardinality | BaseType |
|---------------|-------------|----------|
Single choice | single | identifier |
Multiple choice | multiple | identifier |
Numeric | single | float |
Text | single | string |

---

# 4.4 Outcome Declaration

Defines scoring variables.

Example:

```
<qti-outcome-declaration
 identifier="SCORE"
 cardinality="single"
 baseType="float">
</qti-outcome-declaration>
```

Required outcomes:

```
SCORE
MAXSCORE
```

---

# 4.5 Response Processing

Defines scoring logic.

Template approach (recommended):

```
<qti-response-processing template="match_correct"/>
```

Supported templates:

```
match_correct
map_response
map_response_point
```

Alternative approach:

Manual processing using:

```
qti-response-condition
qti-set-outcome-value
```

---

# 4.6 Interaction Types

Minimum interactions to support.

### Choice Interaction

```
<qti-choice-interaction>
```

Used for:

- Single answer MCQ

---

### Multiple Choice Interaction

```
cardinality="multiple"
```

Used for:

- Multiple correct answers

---

### Text Entry Interaction

```
<qti-text-entry-interaction>
```

Used for:

- Short answers

---

### Extended Text Interaction

```
<qti-extended-text-interaction>
```

Used for:

- Long responses

---

# 5. Image Handling

Images must be correctly linked inside the QTI package.

Directory structure:

```
images/
   figure1.png
   figure2.png
```

Item body example:

```
<img src="images/figure1.png"/>
```

Implementation algorithm:

```
for each question:
    detect image reference
    locate corresponding image file
    copy image into package/images
    update XML path
```

Images should be referenced **relative to the package root**.

---

# 6. Stimulus Support

Stimulus allows shared content for multiple items.

Example use cases:

- Reading passages
- Shared diagrams
- Case studies

Element:

```
<qti-assessment-stimulus>
```

Structure:

```
stimulus.xml
items reference stimulus
```

---

# 7. Assessment Test Structure

Items must be organized into tests.

Root:

```
<qti-assessment-test>
```

Structure:

```
AssessmentTest
 └ TestPart
      └ AssessmentSection
            └ ItemRef
```

Example:

```
<qti-assessment-test>
   <qti-test-part>
      <qti-assessment-section>
         <qti-assessment-item-ref identifier="item1"/>
      </qti-assessment-section>
   </qti-test-part>
</qti-assessment-test>
```

---

# 8. IMS Content Packaging

The system must generate **IMS Content Packages**.

Required file:

```
imsmanifest.xml
```

Example resource entry:

```
<resource
 identifier="item1"
 type="imsqti_item_xmlv3p0"
 href="items/item1.xml">
</resource>
```

Manifest responsibilities:

- Register items
- Register test
- Register images

---

# 9. Metadata Mapping

Metadata improves interoperability.

Excel → Metadata mapping:

| Excel Column | Metadata |
|---------------|---------|
Subject | classification |
Topic | keyword |
Difficulty | difficulty |
Tags | keyword |

Metadata example:

```
<qti-metadata>
   <qti-entry key="difficulty">medium</qti-entry>
</qti-metadata>
```

---

# 10. Accessibility

QTI 3 requires accessibility support.

Implementation:

- alt text for images
- semantic HTML
- readable math markup

Example:

```
<img src="images/force.png" alt="Force diagram"/>
```

---

# 11. Validation

Generated packages must pass validation.

Validation checks:

- XML schema compliance
- manifest correctness
- interaction validity
- response processing correctness

Validation tools:

- QTI validators
- LMS import tests

---

# 12. Performance Strategy

Large datasets (100k+ questions) require optimization.

Strategies:

```
parallel XML generation
stream-based writing
image caching
batch packaging
```

---

# 13. Development Phases

## Phase 1 — Core Item Generation

Implement:

- qti-assessment-item
- item-body
- basic interactions

---

## Phase 2 — Scoring System ✅ COMPLETE

**Status**: Complete (MCQ + Text Entry)

**Implemented**:
- ✅ Response declarations with correct identifiers and cardinality
- ✅ Outcome declarations (SCORE, MAXSCORE) with metadata support
- ✅ Response processing templates (match_correct, map_response, string matching)
- ✅ Partial credit scoring with mapping
- ✅ Modal feedback integration (correct/incorrect/partial/hints/solutions)
- ✅ Pattern matching support for text entry
- ✅ Case-insensitive answer matching

**Files Created**:
- `src/engine/qti3/responseProcessingBuilder.ts` - Response processing logic and templates
- `src/engine/qti3/outcomeMapper.ts` - Outcome declarations with metadata mapping
- `src/engine/qti3/feedbackBuilder.ts` - Modal feedback generation

**Integration**: Both MCQ and Text Entry builders now use Phase 2 components for scoring, outcomes, and feedback

---

## Phase 3 — Test Structure ✅ COMPLETE

**Status**: Complete

**Implemented**:
- ✅ AssessmentTest root structure with metadata
- ✅ TestPart with navigation and submission modes
- ✅ AssessmentSection with grouping and ordering
- ✅ AssessmentItemRef with variable mappings
- ✅ Item session control (attempts, feedback, review)
- ✅ Test-level outcome declarations (TOTAL_SCORE, PASS, PERCENT_SCORE)
- ✅ Outcome processing with score aggregation
- ✅ Time limits at test, part, and section levels
- ✅ Multiple grouping strategies (single, by-category, by-difficulty, custom)
- ✅ Shuffle/ordering support
- ✅ Rubric blocks for instructions

**Files Created**:
- `src/engine/qti3/testStructure.ts` - Type definitions for test hierarchy
- `src/engine/qti3/testBuilder.ts` - Assessment test XML generation

**Features**:
- Flexible grouping strategies for organizing items into sections
- Automatic score aggregation with variable mappings
- Pass/fail determination based on threshold
- Support for linear and non-linear navigation
- Individual and simultaneous submission modes

---

## Phase 4 — Packaging ✅ COMPLETE

**Status**: Complete

**Implemented**:
- ✅ Resource registry for managing all package resources
- ✅ IMS manifest builder (imsmanifest.xml generation)
- ✅ Package builder with JSZip integration
- ✅ Automatic resource registration and dependency tracking
- ✅ Support for tests, items, and images
- ✅ Proper IMS Content Package structure
- ✅ Package validation with error reporting
- ✅ Package statistics (file counts, sizes)
- ✅ Multiple output formats (blob, arraybuffer, nodebuffer, uint8array)
- ✅ Compression level control

**Files Created**:
- `src/engine/qti3/resourceRegistry.ts` - Resource management and dependency tracking
- `src/engine/qti3/manifestBuilder.ts` - IMS manifest XML generation
- `src/engine/qti3/packageBuilder.ts` - ZIP package creation with JSZip

**Package Structure**:
```
package.zip
├── imsmanifest.xml (resource catalog)
├── assessmentTest.xml (from Phase 3)
├── items/
│   ├── Q001.xml
│   ├── Q002.xml
│   └── ...
└── images/
    ├── image1.png
    ├── image2.jpg
    └── ...
```

**Features**:
- Automatic dependency tracking between resources
- Validation of package structure before ZIP creation
- Support for metadata in manifest
- Organizations support (optional hierarchical structure)
- Duplicate image detection with warnings
- Comprehensive error handling

---

## Phase 5 — Metadata ✅ COMPLETE

**Status**: Complete

**Implemented**:
- ✅ Comprehensive metadata mapper with LOM (Learning Object Metadata) support
- ✅ Extract metadata from Excel columns (Subject, Topic, Difficulty, Tags, etc.)
- ✅ Map to QTI 3.0 metadata structures
- ✅ Support for educational classifications (subject hierarchy, curriculum, standards)
- ✅ Bloom's Taxonomy integration
- ✅ Lifecycle metadata (author, organization, version, dates)
- ✅ Rights management (copyright, license)
- ✅ Interactivity and learning time metadata
- ✅ Integration with MCQ and Text Entry builders
- ✅ Automatic metadata XML generation in item files

**Files Created**:
- `src/engine/qti3/metadataMapper.ts` - Complete LOM metadata mapping system

**Metadata Fields Supported**:
- **Identification**: identifier, title, language
- **Educational**: subject, topic, subtopic, difficulty, learning objective, Bloom level, grade level
- **Classification**: curriculum, standards, taxonomies
- **Content**: keywords, tags, description
- **Technical**: author, organization, version, created/modified dates
- **Educational Context**: typical learning time, interactivity level/type
- **Rights**: copyright notice, license

**Integration**: Both MCQ and Text Entry builders now automatically extract metadata from question data and include complete LOM XML in generated items.

---

## Phase 6 — Stimulus ✅ COMPLETE

**Status**: Complete

**Implemented**:
- ✅ Shared stimulus XML builder for QTI 3.0 (`assessmentStimulus`)
- ✅ Item-to-stimulus references via `assessmentStimulusRef`
- ✅ Stimulus package support (`stimuli/` folder in ZIP)
- ✅ Stimulus resources in `imsmanifest.xml`
- ✅ Item dependency mapping to shared stimuli
- ✅ Stimulus image support with manifest dependencies

**Files Added/Updated**:
- `src/engine/qti3/stimulusBuilder.ts`
- `src/engine/qti3/packageBuilder.ts`
- `src/engine/qti3/resourceRegistry.ts`
- `src/engine/qti3/mcqItemBuilder.ts`
- `src/engine/qti3/textEntryItemBuilder.ts`
- `src/engine/qti3/types.ts`
- `src/engine/qti3/index.ts`

---

# 14. Success Criteria

The system is considered complete when:

- Excel questions convert correctly
- Images appear correctly in items
- Generated XML passes QTI validation
- Content packages import into LMS
- Response scoring works correctly

---

# 15. Risks

Potential challenges:

- Incorrect response processing logic
- Image path errors
- LMS compatibility issues
- Metadata inconsistencies

Mitigation:

- Use template scoring
- Strict schema validation
- Controlled packaging process

---

# 16. Future Extensions

Possible enhancements:

- Technology Enhanced Items
- Adaptive testing
- Portable Custom Interactions
- Result reporting
- Analytics