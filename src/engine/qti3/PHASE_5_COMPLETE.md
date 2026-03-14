# QTI 3.0 Phase 5 Complete: Metadata Mapping

## Overview

Phase 5 implements comprehensive metadata mapping from Excel/question data to QTI 3.0 LOM (Learning Object Metadata) format. The system now automatically extracts and embeds rich metadata in assessment items, enabling better cataloging, searching, and organization of questions in LMS platforms.

---

## Component Delivered

### Metadata Mapper
**File**: `metadataMapper.ts` (~650 lines)

Complete metadata extraction and LOM XML generation system.

**Key Features**:
- Extract metadata from various Excel column names (case-insensitive)
- Map to IEEE LOM (Learning Object Metadata) standard
- Support for hierarchical classifications (Subject → Topic → Subtopic)
- Bloom's Taxonomy integration
- Curriculum and standards mapping
- Rights management
- Automatic XML generation

---

## Metadata Fields

### 1. Identification
- `identifier` - Unique question ID
- `title` - Question title/text
- `language` - Content language (default: 'en')

### 2. Educational
- `subject` - Subject area (e.g., "Mathematics", "Science")
- `topic` - Topic within subject (e.g., "Algebra", "Linear Equations")
- `subtopic` - More specific topic (e.g., "Solving Single Variable")
- `difficulty` - Question difficulty ("easy", "medium", "hard")
- `learningObjective` - What the question assesses
- `bloomLevel` - Bloom's Taxonomy level (e.g., "Remember", "Understand", "Apply")
- `gradeLevel` - Target grade (e.g., "Grade 9", "High School")

### 3. Classification
- `curriculum` - Curriculum system (e.g., "Common Core", "IB", "NCERT")
- `standard` - Specific standard code (e.g., "CCSS.MATH.9.A.1")

### 4. Content
- `keywords` - Array of search keywords
- `tags` - Array of custom tags
- `description` - Question description

### 5. Technical
- `author` - Question author name
- `organization` - Creating organization
- `version` - Question version
- `created` - Creation date
- `modified` - Last modification date

### 6. Educational Context
- `typicalLearningTime` - Expected time in seconds
- `interactivityLevel` - "low", "medium", "high"
- `interactivityType` - "active", "expositive", "mixed"

### 7. Rights
- `copyrightNotice` - Copyright statement
- `license` - License type (e.g., "CC BY-SA 4.0")

---

## Extraction from Excel

The metadata mapper automatically extracts metadata from Excel columns with flexible naming:

### Example Excel Structure

| Question | Subject | Topic | Difficulty | Tags | Bloom Level | Author |
|----------|---------|-------|------------|------|-------------|--------|
| What is 2+2? | Mathematics | Arithmetic | Easy | basic,math | Remember | John Doe |
| Capital of France? | Geography | Europe | Medium | capitals,cities | Remember | Jane Smith |

### Supported Column Names

The mapper recognizes multiple column name variations (case-insensitive):

- **Subject**: `subject`, `Subject`
- **Topic**: `topic`, `Topic`
- **Difficulty**: `difficulty`, `Difficulty`
- **Keywords**: `keywords`, `Keywords`
- **Tags**: `tags`, `Tags`
- **Bloom**: `bloomLevel`, `Bloom Level`, `bloom`
- **Grade**: `gradeLevel`, `Grade Level`, `grade`
- **Author**: `author`, `Author`
- **Curriculum**: `curriculum`, `Curriculum`
- **Standard**: `standard`, `Standard`

### Array Parsing

String arrays support multiple delimiters:
- Comma: `"algebra, geometry, trigonometry"`
- Semicolon: `"algebra; geometry; trigonometry"`
- Pipe: `"algebra | geometry | trigonometry"`

---

## Generated LOM XML

### Example Output

```xml
<assessmentItem identifier="Q001" title="What is 2+2?" ...>
  
  <qti-metadata>
    <lom:lom xmlns:lom="http://ltsc.ieee.org/xsd/LOM">
      
      <!-- General Section -->
      <lom:general>
        <lom:identifier>
          <lom:catalog>URI</lom:catalog>
          <lom:entry>Q001</lom:entry>
        </lom:identifier>
        <lom:title>
          <lom:string language="en">What is 2+2?</lom:string>
        </lom:title>
        <lom:language>en</lom:language>
        <lom:keyword>
          <lom:string language="en">arithmetic</lom:string>
        </lom:keyword>
        <lom:keyword>
          <lom:string language="en">basic</lom:string>
        </lom:keyword>
      </lom:general>
      
      <!-- Lifecycle Section -->
      <lom:lifeCycle>
        <lom:version>
          <lom:string language="en">1.0</lom:string>
        </lom:version>
        <lom:contribute>
          <lom:role>
            <lom:source>LOMv1.0</lom:source>
            <lom:value>author</lom:value>
          </lom:role>
          <lom:entity>
            <vcard:vcard xmlns:vcard="urn:ietf:params:xml:ns:vcard-4.0">
              <vcard:fn><vcard:text>John Doe</vcard:text></vcard:fn>
              <vcard:org><vcard:text>Example School</vcard:text></vcard:org>
            </vcard:vcard>
          </lom:entity>
          <lom:date>
            <lom:dateTime>2024-03-07T10:00:00Z</lom:dateTime>
          </lom:date>
        </lom:contribute>
      </lom:lifeCycle>
      
      <!-- Educational Section -->
      <lom:educational>
        <lom:interactivityType>
          <lom:source>LOMv1.0</lom:source>
          <lom:value>active</lom:value>
        </lom:interactivityType>
        <lom:learningResourceType>
          <lom:source>LOMv1.0</lom:source>
          <lom:value>assessment item</lom:value>
        </lom:learningResourceType>
        <lom:difficulty>
          <lom:source>LOMv1.0</lom:source>
          <lom:value>very easy</lom:value>
        </lom:difficulty>
        <lom:typicalLearningTime>
          <lom:duration>PT60S</lom:duration>
        </lom:typicalLearningTime>
        <lom:context>
          <lom:source>LOMv1.0</lom:source>
          <lom:value>Grade 3</lom:value>
        </lom:context>
      </lom:educational>
      
      <!-- Classification Section -->
      <lom:classification>
        <lom:purpose>
          <lom:source>LOMv1.0</lom:source>
          <lom:value>discipline</lom:value>
        </lom:purpose>
        <lom:taxonPath>
          <lom:source>
            <lom:string language="en">Subject</lom:string>
          </lom:source>
          <lom:taxon>
            <lom:id>Mathematics</lom:id>
            <lom:entry>
              <lom:string language="en">Mathematics</lom:string>
            </lom:entry>
            <!-- Nested topic -->
            <lom:taxon>
              <lom:id>Arithmetic</lom:id>
              <lom:entry>
                <lom:string language="en">Arithmetic</lom:string>
              </lom:entry>
            </lom:taxon>
          </lom:taxon>
        </lom:taxonPath>
      </lom:classification>
      
      <!-- Bloom's Taxonomy -->
      <lom:classification>
        <lom:purpose>
          <lom:source>LOMv1.0</lom:source>
          <lom:value>educational level</lom:value>
        </lom:purpose>
        <lom:taxonPath>
          <lom:source>
            <lom:string language="en">Bloom's Taxonomy</lom:string>
          </lom:source>
          <lom:taxon>
            <lom:id>Remember</lom:id>
            <lom:entry>
              <lom:string language="en">Remember</lom:string>
            </lom:entry>
          </lom:taxon>
        </lom:taxonPath>
      </lom:classification>
      
      <!-- Rights Section -->
      <lom:rights>
        <lom:copyrightAndOtherRestrictions>
          <lom:source>LOMv1.0</lom:source>
          <lom:value>yes</lom:value>
        </lom:copyrightAndOtherRestrictions>
        <lom:description>
          <lom:string language="en">© 2024 Example School</lom:string>
        </lom:description>
      </lom:rights>
      
    </lom:lom>
  </qti-metadata>
  
  <!-- Response declaration, item body, etc. -->
  ...
</assessmentItem>
```

---

## Integration with Item Builders

### Automatic Metadata Extraction

Both MCQ and Text Entry builders now automatically extract and embed metadata:

```typescript
import { buildAssessmentItem } from './qti3';

const question = {
  id: 'Q001',
  question: 'What is 2+2?',
  type: 'mcq',
  choices: ['2', '3', '4', '5'],
  correctAnswer: '4',
  
  // Metadata fields (extracted automatically)
  subject: 'Mathematics',
  topic: 'Arithmetic',
  difficulty: 'easy',
  tags: 'basic, addition',
  bloomLevel: 'Remember',
  gradeLevel: 'Grade 3',
  author: 'John Doe',
  organization: 'Example School',
  learningObjective: 'Assess basic addition skills',
  typicalLearningTime: 60,
};

const result = buildAssessmentItem({
  questionType: 'mcq',
  question,
  imageFolderPath: './images',
});

// result.xml now includes complete LOM metadata
```

### Custom Metadata

You can also provide custom metadata programmatically:

```typescript
import { MetadataMapper, QuestionMetadata } from './qti3';

const customMetadata: QuestionMetadata = {
  identifier: 'Q001',
  title: 'Custom Question',
  subject: 'Science',
  topic: 'Physics',
  subtopic: 'Mechanics',
  difficulty: 'hard',
  bloomLevel: 'Analyze',
  keywords: ['motion', 'velocity', 'acceleration'],
  learningObjective: 'Analyze motion in one dimension',
  typicalLearningTime: 300, // 5 minutes
  author: 'Dr. Smith',
  organization: 'Physics Department',
  curriculum: 'Next Generation Science Standards',
  standard: 'HS-PS2-1',
  copyrightNotice: '© 2024 University',
  license: 'CC BY-NC-SA 4.0',
};

// Convert to LOM XML
const lomXML = MetadataMapper.toQTIMetadata(customMetadata).lomXML;
```

---

## Hierarchical Classifications

### Subject Taxonomy

The mapper supports multi-level taxonomies:

```typescript
const metadata = {
  subject: 'Mathematics',           // Level 1
  topic: 'Algebra',                 // Level 2
  subtopic: 'Linear Equations',     // Level 3
};
```

**Generated Structure**:
```xml
<lom:taxonPath>
  <lom:taxon>
    <lom:id>Mathematics</lom:id>
    <lom:entry>Mathematics</lom:entry>
    <lom:taxon>
      <lom:id>Algebra</lom:id>
      <lom:entry>Algebra</lom:entry>
      <lom:taxon>
        <lom:id>Linear Equations</lom:id>
        <lom:entry>Linear Equations</lom:entry>
      </lom:taxon>
    </lom:taxon>
  </lom:taxon>
</lom:taxonPath>
```

---

## Difficulty Mapping

Difficulty values are normalized to LOM standard:

| Input | Output (LOM) |
|-------|--------------|
| "easy" | "very easy" |
| "medium" | "medium" |
| "hard" | "very difficult" |

---

## Time Duration Format

Time values are converted to ISO 8601 duration format:

| Seconds | ISO 8601 Duration |
|---------|-------------------|
| 30 | PT30S |
| 60 | PT1M |
| 90 | PT1M30S |
| 300 | PT5M |
| 3600 | PT1H |

---

## Bloom's Taxonomy Levels

Supported levels:
- Remember
- Understand
- Apply
- Analyze
- Evaluate
- Create

---

## Benefits of Metadata

### 1. Better Search & Discovery
- Find questions by subject, topic, difficulty
- Filter by keywords and tags
- Search by author or organization

### 2. LMS Integration
- Standards-compliant metadata for LMS platforms
- Automatic cataloging and organization
- Integration with learning analytics

### 3. Reporting & Analytics
- Track question usage by subject/topic
- Analyze difficulty distribution
- Monitor author contributions

### 4. Curriculum Alignment
- Map questions to standards
- Track curriculum coverage
- Ensure alignment with learning objectives

### 5. Rights Management
- Clear copyright and licensing information
- Track authorship and versions
- Manage intellectual property

---

## Usage Examples

### Example 1: Basic Metadata

```typescript
const question = {
  question: 'What is the capital of France?',
  type: 'textEntry',
  correctAnswer: 'Paris',
  subject: 'Geography',
  topic: 'Europe',
  difficulty: 'easy',
};

// Metadata automatically extracted and embedded
```

### Example 2: Rich Metadata

```typescript
const question = {
  question: 'Solve: 2x + 3 = 11',
  type: 'textEntry',
  correctAnswer: '4',
  
  // Educational
  subject: 'Mathematics',
  topic: 'Algebra',
  subtopic: 'Linear Equations',
  difficulty: 'medium',
  learningObjective: 'Solve single-variable linear equations',
  bloomLevel: 'Apply',
  gradeLevel: 'Grade 8',
  
  // Classification
  curriculum: 'Common Core',
  standard: 'CCSS.MATH.8.EE.C.7',
  
  // Content
  keywords: ['algebra', 'equations', 'solving'],
  tags: ['practice', 'homework'],
  
  // Technical
  author: 'Ms. Johnson',
  organization: 'Lincoln Middle School',
  version: '2.1',
  
  // Context
  typicalLearningTime: 120, // 2 minutes
  
  // Rights
  license: 'CC BY 4.0',
};
```

### Example 3: Extract from Excel Row

```typescript
import { extractMetadata } from './qti3';

const excelRow = {
  Question: 'Capital of Italy?',
  Subject: 'Geography',
  Topic: 'Europe',
  Difficulty: 'Easy',
  Keywords: 'capitals, cities, Europe',
  'Bloom Level': 'Remember',
  Author: 'John Doe',
};

const metadata = extractMetadata(excelRow);
// Automatically maps column names to metadata fields
```

---

## Testing Phase 5

### Test Cases

1. **Basic metadata extraction**
   - Subject, topic, difficulty
   - Verify LOM XML structure

2. **Keywords and tags**
   - Multiple delimiters (comma, semicolon, pipe)
   - Array parsing

3. **Hierarchical classification**
   - Subject → Topic → Subtopic
   - Nested taxonomy structure

4. **Bloom's Taxonomy**
   - All six levels
   - Proper XML classification

5. **Time duration**
   - Various time formats
   - ISO 8601 conversion

6. **Rights management**
   - Copyright notice
   - License information

7. **Excel column variations**
   - Case-insensitive matching
   - Multiple column name formats

8. **Integration with builders**
   - MCQ with metadata
   - Text Entry with metadata
   - Verify XML output

---

## Next Steps: Phase 6

With Phase 5 complete, we can now proceed to Phase 6: Stimulus Support

**Phase 6 Goals**:
- Support shared stimulus content (passages, diagrams)
- Link multiple items to same stimulus
- Implement `qti-assessment-stimulus` elements
- Useful for reading comprehension, case studies, data interpretation

**Files to Create**:
- `src/engine/qti3/stimulusBuilder.ts` - Stimulus content builder
- Update item builders to reference stimuli

---

## Phase 5 Summary

✅ **Metadata Mapper** - Complete LOM metadata extraction and XML generation  
✅ **Excel Integration** - Flexible column name recognition  
✅ **Educational Metadata** - Subject, topic, difficulty, Bloom's taxonomy  
✅ **Classification** - Hierarchical taxonomies and standards mapping  
✅ **Lifecycle Metadata** - Author, organization, version, dates  
✅ **Rights Management** - Copyright and licensing  
✅ **Builder Integration** - Automatic metadata embedding in items  
✅ **LOM Compliance** - IEEE LOM standard XML structure  
✅ **Time Format** - ISO 8601 duration conversion  
✅ **Array Parsing** - Multiple delimiter support  

**Status**: Phase 5 is complete. Assessment items now include rich, standards-compliant metadata that enables better cataloging, search, analytics, and LMS integration.
