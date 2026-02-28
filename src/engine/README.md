# QTI Generation Engine

Production-ready QTI 2.1 generation engine for MCQ (Multiple Choice Questions) with comprehensive validation, XML generation, and error handling.

## Project Structure

```
src/engine/
├── types.ts                 # Type definitions
├── xmlUtils.ts             # XML utility functions (escaping, validation)
├── xmlValidator.ts         # XML parsing and validation
├── generationService.ts    # Batch generation orchestration
├── index.ts                # Main exports
├── examples.ts             # Usage examples
└── builders/
    └── qti21/
        └── mcqBuilder.ts   # QTI 2.1 MCQ builder
```

## Features

### ✅ Production-Ready Implementation
- **Builder Pattern**: Clean, extensible architecture for question builders
- **Comprehensive Validation**: Input validation + XML structure validation
- **Error Handling**: Structured error objects with detailed messages
- **XML Generation**: Programmatic construction (no string replace)
- **XML Special Characters**: Automatic escaping of &, <, >, ", '

### ✅ Supported Question Types
- **MCQ (Multiple Choice Questions)**: Single correct answer (A-H or 1-8 identifiers)
- **Future Support**: MSQ, Text Entry, Order Interaction (Stage 2+)

### ✅ QTI 2.1 Compliance
- Proper XML namespaces
- ResponseDeclaration with correctResponse
- ItemBody with choiceInteraction
- SimpleChoice elements with identifiers
- All required attributes (identifier, title, adaptive, timeDependent)

## Usage

### Basic MCQ Generation

```typescript
import { generateAndValidateMCQ, Question } from '@/engine';

const question: Question = {
  id: 'Q001',
  upload_id: 'UPLOAD_001',
  identifier: 'PHY_001',
  stem: 'What is the SI unit of force?',
  type: 'MCQ',
  options: ['Newton', 'Joule', 'Pascal', 'Watt'],
  correct_answer: 'A',
  validation_status: 'Valid',
};

const result = generateAndValidateMCQ(question);

if ('error' in result) {
  console.error('Failed:', result.error.message);
} else {
  console.log('XML:', result.xml);
}
```

### Batch Generation

```typescript
import { generateQTIForUpload, validateQuestionsForGeneration } from '@/engine';

const questions: Question[] = [...];

// Validate before generation
const validation = validateQuestionsForGeneration(questions);
if (!validation.valid) {
  console.error('Issues found:', validation.errors);
}

// Generate batch
const summary = await generateQTIForUpload(questions);
console.log(`Success: ${summary.success}, Failed: ${summary.failed}`);
```

### Using the Builder Directly

```typescript
import { createMCQBuilder } from '@/engine/builders/qti21/mcqBuilder';

const builder = createMCQBuilder();
const xml = builder.generate(question);

if (builder.validate(xml)) {
  console.log('Valid QTI XML');
}
```

## Type Definitions

### Question
```typescript
interface Question {
  id: string;
  upload_id: string;
  identifier: string;          // Unique question ID (e.g., "PHY_001")
  stem: string;               // Question text
  type: 'MCQ' | 'MSQ' | ...;
  options: string[];          // Multiple choice options
  correct_answer: string;     // A-H or 1-8
  validation_status: 'Valid' | 'Caution' | 'Rejected';
  generated_output?: string;
  generation_status?: 'Pending' | 'Success' | 'Failed';
  generation_errors?: GenerationError[];
}
```

### GenerationError
```typescript
interface GenerationError {
  code: string;                   // Unique error code
  message: string;                // Human-readable message
  details?: any;                  // Additional context
}
```

## Error Handling

### Error Codes

| Code | Meaning | Severity |
|------|---------|----------|
| `INVALID_STATUS` | Question not in 'Valid' status | Warning |
| `UNSUPPORTED_TYPE` | Question type not supported (only MCQ in v1) | Warning |
| `MCQ_GENERATION_ERROR` | General MCQ generation failure | Critical |
| `XML_VALIDATION_FAILED` | Generated XML didn't pass validation | Critical |
| `GENERATION_ERROR` | Unexpected generation error | Critical |

### Example Error Handling

```typescript
const result = generateAndValidateMCQ(question);

if ('error' in result) {
  switch (result.error.code) {
    case 'INVALID_STATUS':
      console.log('Question needs validation first');
      break;
    case 'XML_VALIDATION_FAILED':
      console.log('Generated XML is malformed');
      break;
    default:
      console.error('Unknown error:', result.error);
  }
}
```

## XML Output Format

Generated QTI 2.1 XML follows this structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1"
  identifier="PHY_001"
  title="Question Title"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>A</value>
    </correctResponse>
  </responseDeclaration>

  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="true" maxChoices="1">
      <prompt>Question Stem</prompt>
      <simpleChoice identifier="A">Option A Text</simpleChoice>
      <simpleChoice identifier="B">Option B Text</simpleChoice>
      <simpleChoice identifier="C">Option C Text</simpleChoice>
      <simpleChoice identifier="D">Option D Text</simpleChoice>
    </choiceInteraction>
  </itemBody>

</assessmentItem>
```

## Validation Rules

### Input Validation
1. **Identifier**: Required, non-empty
2. **Stem**: Required, non-empty question text
3. **Options**: Array with minimum 2 items
4. **Correct Answer**: 
   - Required, non-empty
   - Format: Single letter (A-Z) or single digit (1-26)
   - Must correspond to an option index

### XML Validation
1. Valid XML syntax
2. Root element is `assessmentItem`
3. Required attributes: `xmlns`, `identifier`
4. Required child elements: `responseDeclaration`, `itemBody`
5. ResponseDeclaration contains `correctResponse`
6. ItemBody contains `choiceInteraction`
7. ChoiceInteraction contains `simpleChoice` elements (minimum 2)

## Integration with Existing App

### With ValidationReport Component
```typescript
import { generateAndValidateMCQ } from '@/engine';

// After validation shows results
const generateQTI = (row: any) => {
  const qtiQuestion: Question = {
    id: row.id,
    upload_id: 'batch',
    identifier: row.questionId,
    stem: row.question,
    type: 'MCQ',
    options: row.options || [],
    correct_answer: row.correctAnswer || 'A',
    validation_status: 'Valid',
  };

  return generateAndValidateMCQ(qtiQuestion);
};
```

### With QTIRenderer Component
```typescript
// Already integrated in QTIRenderer.tsx
// Uses generateAndValidateMCQ for consistent generation
```

### With BatchCreator Component
```typescript
// Already integrated in BatchCreator.tsx
// Falls back to old converter for non-MCQ types
```

## Performance Considerations

- **Parsing**: Single-pass XML validation (O(n))
- **Generation**: Linear time complexity relative to option count
- **Memory**: Lightweight string-based generation (no DOM manipulation)
- **Batch Processing**: Sequential processing (can be parallelized in future)

## Future Enhancements

- [ ] MSQ (Multiple Select Questions) generator
- [ ] Text Entry/Short Answer generator
- [ ] Order Interaction generator
- [ ] Matching Interaction generator
- [ ] ZIP packaging for multiple questions
- [ ] Database integration (Supabase)
- [ ] API route handler
- [ ] Parallel batch processing
- [ ] XML parsing library for Node.js (xmldom)

## Development Notes

### Adding New Question Type Builder

1. Create builder in `builders/qti21/[type]Builder.ts`
2. Implement `QuestionBuilder` interface
3. Add validation logic specific to type
4. Update `generationService.ts` to handle new type
5. Export from `index.ts`

Example structure:
```typescript
class MSQBuilder implements QuestionBuilder {
  generate(question: Question): string { ... }
  validate(xml: string): boolean { ... }
}

export function createMSQBuilder(): QuestionBuilder {
  return new MSQBuilder();
}
```

## Testing

Run examples with:
```typescript
import { runAllExamples } from '@/engine/examples';
runAllExamples();
```

Examples cover:
- Basic MCQ generation
- Validation with errors
- Batch processing
- Pre-generation validation
- Error handling
- Numeric identifiers
