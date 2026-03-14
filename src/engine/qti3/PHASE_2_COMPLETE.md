# QTI 3.0 Phase 2 Complete: Scoring & Response Processing

## Overview

Phase 2 implementation adds comprehensive scoring, outcome mapping, and feedback capabilities to the QTI 3.0 item builders. All components are fully integrated into both MCQ and Text Entry builders.

---

## Components Delivered

### 1. Response Processing Builder
**File**: `responseProcessingBuilder.ts`

Generates response processing logic using templates and custom rules.

**Key Methods**:
- `buildMatchCorrect()` - Standard correct-answer matching (MCQ)
- `buildMapResponse()` - Point mapping for each response (partial credit)
- `buildMultipleAcceptableAnswers()` - Case-insensitive multi-answer matching (text entry)
- `buildWithPartialCredit()` - Advanced partial credit scenarios
- `buildPatternMatch()` - Regex/pattern-based validation

**Example Usage**:
```typescript
import { ResponseProcessingBuilder } from './responseProcessingBuilder';

const rpXML = ResponseProcessingBuilder.buildMatchCorrect({
  responseIdentifier: 'RESPONSE',
  correctIdentifier: 'CORRECT_RESPONSE'
});
```

---

### 2. Outcome Mapper
**File**: `outcomeMapper.ts`

Maps question metadata to QTI outcome declarations with support for points, difficulty, time limits, and completion tracking.

**Key Methods**:
- `buildStandardOutcomes()` - SCORE and MAXSCORE declarations
- `buildExtendedOutcomes()` - Additional metadata (difficulty, weight, time)
- `mapResponseWithPoints()` - Points mapping for each response choice
- `createPartialCreditMapping()` - Partial credit configuration

**Helper Functions**:
- `getOutcomesFromMetadata(metadata)` - Quick outcome generation from question metadata
- `validateOutcomes(outcomes)` - Ensure outcome declarations are valid

**Example Usage**:
```typescript
import { getOutcomesFromMetadata } from './outcomeMapper';

const outcomes = getOutcomesFromMetadata({
  points: 2,
  difficulty: 'medium',
  weight: 1.5,
  timeLimit: 120
});
```

---

### 3. Feedback Builder
**File**: `feedbackBuilder.ts`

Generates modal feedback elements with conditional display rules based on outcome values.

**Key Methods**:
- `build(config)` - Single feedback item
- `buildMultiple(configs)` - Multiple feedback items
- `fromExplanation(text, identifier)` - Convert explanation text to feedback
- `buildHint(hintText)` - Generate hint feedback
- `buildSolution(solutionText)` - Generate solution feedback

**Helper Functions**:
- `createFeedbackFromQuestion(question)` - Auto-generate feedback from question explanation
- `validateFeedback(feedback)` - Ensure feedback structure is valid

**Example Usage**:
```typescript
import { FeedbackBuilder, createFeedbackFromQuestion } from './feedbackBuilder';

// Auto-generate from question
const feedbacks = createFeedbackFromQuestion({
  explanation: 'This is the correct answer because...'
});

// Manual construction
const feedback = new FeedbackBuilder()
  .build({
    identifier: 'CORRECT_FEEDBACK',
    outcomeIdentifier: 'SCORE',
    showWhen: 'greater-than-or-equal',
    threshold: 1,
    title: 'Correct!',
    content: 'Well done!'
  });
```

---

## Integration with Item Builders

Both `mcqItemBuilder.ts` and `textEntryItemBuilder.ts` now use Phase 2 components:

### MCQ Items
```typescript
// Old way (deprecated)
// const outcomeDeclarations = this.buildOutcomeDeclarations();

// New way
import { getOutcomesFromMetadata } from './outcomeMapper';
import { ResponseProcessingBuilder } from './responseProcessingBuilder';
import { createFeedbackFromQuestion } from './feedbackBuilder';

const outcomeDeclarations = getOutcomesFromMetadata({
  points: question.points || 1,
  difficulty: question.difficulty,
});

const responseProcessing = {
  xml: ResponseProcessingBuilder.buildMatchCorrect({
    responseIdentifier: 'RESPONSE',
    correctIdentifier: 'CORRECT_RESPONSE'
  })
};

const feedbacks = question.explanation
  ? createFeedbackFromQuestion({ explanation: question.explanation })
  : undefined;
```

### Text Entry Items
```typescript
// Multiple acceptable answers with case-insensitive matching
const responseProcessing = {
  xml: ResponseProcessingBuilder.buildMultipleAcceptableAnswers({
    responseIdentifier: 'RESPONSE',
    acceptableAnswers: this.normalizeAnswers(question.correctAnswer),
    points: question.points || 1,
    caseSensitive: false
  })
};
```

---

## Metadata Support

The outcome mapper now supports extracting and mapping metadata from question objects:

| Question Property | Outcome/Metadata | Description |
|-------------------|------------------|-------------|
| `points` | MAXSCORE outcome | Maximum points for the question |
| `difficulty` | difficulty metadata | Easy/Medium/Hard |
| `weight` | weight metadata | Question importance multiplier |
| `timeLimit` | timeLimits metadata | Seconds allowed for answer |
| `partialCredit` | Outcome mapping | Points awarded per choice |

**Example Question Object**:
```typescript
const question = {
  id: 'Q001',
  questionText: 'What is 2+2?',
  type: 'mcq',
  choices: ['3', '4', '5'],
  correctAnswer: '4',
  points: 2,
  difficulty: 'easy',
  weight: 1.0,
  timeLimit: 60,
  explanation: 'Basic arithmetic: 2+2=4'
};
```

---

## Response Processing Templates

### 1. Match Correct (MCQ)
Compares student response to correct answer. Standard template for single-correct-answer questions.

### 2. Map Response (Partial Credit)
Maps each response choice to point values. Useful for "select all that apply" scenarios.

### 3. Multiple Acceptable Answers (Text Entry)
Case-insensitive matching against multiple acceptable text answers. Example: "USA", "United States", "United States of America"

### 4. Pattern Match
Validates responses using regex patterns. Example: email validation, numeric ranges.

### 5. Custom Logic
Supports custom response rules via `buildCustom()` method for advanced scenarios.

---

## Feedback Types

### Modal Feedback
Displayed as overlay/popup after answer submission:
- **Correct Feedback** - Shown when SCORE ≥ threshold
- **Incorrect Feedback** - Shown when SCORE = 0
- **Partially Correct** - Shown when 0 < SCORE < max
- **Hints** - Available before answer submission
- **Solutions** - Shown after all attempts exhausted

### Inline Feedback (Future)
To be implemented in Phase 6 for real-time validation.

---

## Validation Features

All builders include validation:
- `validateOutcomes()` - Ensures outcome declarations are well-formed
- `validateFeedback()` - Checks feedback structure and references
- Builder validate() methods check integration consistency

---

## XML Generation

Updated XML generation methods:
- `outcomeDeclarationsToXML()` - Converts outcomes to QTI XML
- `responseProcessingToXML()` - Inserts response processing logic
- `feedbackToXML()` - Generates modalFeedback elements
- `itemToXML()` - Orchestrates full item XML generation

---

## Testing Phase 2

### Test Cases Needed
1. **MCQ with correct/incorrect feedback**
   - Question with 4 choices, 1 correct
   - Verify match_correct template
   - Verify SCORE outcome updates

2. **MCQ with partial credit**
   - Multiple correct answers
   - Different points per choice
   - Verify map_response template

3. **Text Entry with multiple answers**
   - Case insensitive matching
   - Multiple acceptable answers
   - Verify stringMatch conditions

4. **Metadata mapping**
   - Points, difficulty, weight, time
   - Verify outcome declarations
   - Verify metadata elements

5. **Feedback generation**
   - From explanation field
   - Custom hints/solutions
   - Conditional display rules

---

## Next Steps: Phase 3

With Phase 2 complete, we can now proceed to Phase 3: Test Structure

**Phase 3 Goals**:
- Create `AssessmentTest` wrapper for multiple items
- Implement `TestPart` structure
- Add `AssessmentSection` for grouping items
- Generate item references with scoring settings
- Create `assessmentTest.xml` file

**Files to Create**:
- `src/engine/qti3/testBuilder.ts` - Assessment test XML generation
- `src/engine/qti3/testStructure.ts` - Test hierarchy types and builders
- `src/engine/qti3/itemRefBuilder.ts` - Item reference configuration

---

## Phase 2 Summary

✅ **Response Processing** - Template-based and custom logic supported  
✅ **Outcome Declarations** - SCORE/MAXSCORE with metadata mapping  
✅ **Feedback System** - Modal feedback with conditional display  
✅ **Metadata Integration** - Points, difficulty, time, weight support  
✅ **Partial Credit** - Multiple scoring scenarios supported  
✅ **Text Matching** - Case-insensitive multi-answer support  
✅ **Builder Integration** - Both MCQ and Text Entry updated  
✅ **XML Generation** - Full QTI 3.0 compliant output  

**Status**: Phase 2 is complete and ready for testing. All scoring, outcome, and feedback capabilities are now available for MCQ and Text Entry question types.
