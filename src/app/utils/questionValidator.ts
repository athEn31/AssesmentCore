export type ValidationStatus = 'valid' | 'caution' | 'rejected';
export type ErrorLevel = 'critical' | 'warning';

export interface ValidationError {
  field: string;
  message: string;
  level: ErrorLevel;
}

export interface ValidationResult {
  rowId: string;
  rowNumber: number;
  status: ValidationStatus;
  data: Record<string, any>;
  criticalErrors: ValidationError[];
  warnings: ValidationError[];
  detectedType?: string;
  errorCount: number;
  warningCount: number;
  lastValidatedAt: string;
  validationVersion: string;
}

export interface QuestionData {
  id: string;
  [key: string]: any;
}

/**
 * Normalize question data
 */
function normalizeData(data: any): Record<string, any> & { id: string } {
  const normalized: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      normalized[key] = value.trim();
    } else {
      normalized[key] = value;
    }
  }

  return normalized as Record<string, any> & { id: string };
}

/**
 * Automatic question type detection based on data
 */
function detectQuestionTypeInternal(
  row: QuestionData,
  columnMapping: {
    optionCols?: string[];
    answerCol?: string;
    typeCol?: string;
    questionCol?: string;
    orderCol?: string;
  }
): string {
  // If type column exists, use it
  if (columnMapping.typeCol && row[columnMapping.typeCol]) {
    return (row[columnMapping.typeCol] as string).toLowerCase().trim();
  }

  // Detect based on structure
  const hasOptions = columnMapping.optionCols && columnMapping.optionCols.length >= 2;
  const options = columnMapping.optionCols
    ? columnMapping.optionCols.map(col => row[col]).filter(v => v)
    : [];

  // If has order column
  if (columnMapping.orderCol && row[columnMapping.orderCol]) {
    return 'order';
  }

  // If has 2 options that are like yes/no or true/false
  if (options.length === 2) {
    const optionTexts = options.map((o: any) => (o as string).toLowerCase().trim());
    if (
      (optionTexts.includes('true') && optionTexts.includes('false')) ||
      (optionTexts.includes('yes') && optionTexts.includes('no'))
    ) {
      return 'truefalse';
    }
  }

  // If has 4 or more options, likely MCQ
  if (options.length >= 4) {
    return 'mcq';
  }

  // If has 2-3 options, could be MCQ with fewer options
  if (options.length >= 2) {
    return 'mcq';
  }

  // Default to short answer/essay
  return 'shortanswer';
}

/**
 * Validate base required fields (all types)
 */
function validateBaseFields(
  row: QuestionData,
  columnMapping: any
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Identifier
  if (!row.id || (typeof row.id === 'string' && row.id.trim().length === 0)) {
    errors.push({
      field: 'Identifier',
      message: 'Missing unique identifier for question',
      level: 'critical',
    });
  }

  // Question Stem
  const questionCol = columnMapping.questionCol;
  if (!questionCol || !row[questionCol] || (typeof row[questionCol] === 'string' && row[questionCol].trim().length < 5)) {
    errors.push({
      field: 'Question Stem',
      message: 'Question text is missing or too short (minimum 5 characters)',
      level: 'critical',
    });
  }

  // Question Type
  if (!columnMapping.typeCol || !row[columnMapping.typeCol]) {
    // This is determined, not required, so only warning
    errors.push({
      field: 'Question Type',
      message: 'Question type will be auto-detected',
      level: 'warning',
    });
  }

  // Correct Answer (checked per type, so only warning here)
  if (!columnMapping.answerCol || !row[columnMapping.answerCol]) {
    errors.push({
      field: 'Correct Answer',
      message: 'Missing correct answer',
      level: 'critical',
    });
  }

  // Grade/Points
  if (!columnMapping.pointsCol || !row[columnMapping.pointsCol]) {
    errors.push({
      field: 'Grade',
      message: 'Points/Grade value missing',
      level: 'warning',
    });
  }

  // Subject
  if (!columnMapping.subjectCol || !row[columnMapping.subjectCol]) {
    errors.push({
      field: 'Subject',
      message: 'Subject field is empty',
      level: 'warning',
    });
  }

  // Topic
  if (!columnMapping.topicCol || !row[columnMapping.topicCol]) {
    errors.push({
      field: 'Topic',
      message: 'Topic field is empty',
      level: 'warning',
    });
  }

  // Difficulty
  if (!columnMapping.difficultyCol || !row[columnMapping.difficultyCol]) {
    errors.push({
      field: 'Difficulty',
      message: 'Difficulty level missing',
      level: 'warning',
    });
  }

  // Solution (recommended)
  if (!columnMapping.solutionCol || !row[columnMapping.solutionCol]) {
    errors.push({
      field: 'Solution',
      message: 'Solution/Explanation is recommended but not provided',
      level: 'warning',
    });
  }

  return errors;
}

/**
 * Validate MCQ type question
 */
function validateMCQ(
  row: QuestionData,
  columnMapping: any,
  errors: ValidationError[]
): void {
  // Check options
  if (!columnMapping.optionCols || columnMapping.optionCols.length < 2) {
    errors.push({
      field: 'Options',
      message: 'No option columns found for MCQ (minimum 2 required)',
      level: 'critical',
    });
    return;
  }

  const optionValues = columnMapping.optionCols
    .map((col: string) => row[col])
    .filter((v: any) => v !== null && v !== undefined && v !== '');

  if (optionValues.length < 2) {
    errors.push({
      field: 'Options',
      message: `Not enough options provided (found ${optionValues.length}, need at least 2)`,
      level: 'critical',
    });
  } else if (optionValues.length === 2) {
    errors.push({
      field: 'Options',
      message: 'Only 2 options in MCQ (3 or more recommended)',
      level: 'warning',
    });
  }

  // Check for duplicate options
  const uniqueOptions = new Set(optionValues.map((o: any) => (o as string).toLowerCase().trim()));
  if (uniqueOptions.size < optionValues.length) {
    errors.push({
      field: 'Options',
      message: 'Duplicate options detected',
      level: 'warning',
    });
  }

  // Check option text length
  optionValues.forEach((opt: any, idx: number) => {
    if ((opt as string).length < 3) {
      errors.push({
        field: `Option ${idx + 1}`,
        message: 'Option text too short (minimum 3 characters)',
        level: 'warning',
      });
    }
  });

  // Check correct answer
  if (columnMapping.answerCol && row[columnMapping.answerCol]) {
    const correctAnswer = (row[columnMapping.answerCol] as string).trim().toUpperCase();
    const validAnswers = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const validNumbers = ['1', '2', '3', '4', '5', '6', '7', '8'];

    if (!validAnswers.includes(correctAnswer) && !validNumbers.includes(correctAnswer)) {
      errors.push({
        field: 'Correct Answer',
        message: `Invalid correct answer format: "${correctAnswer}" (use A-H or 1-8)`,
        level: 'critical',
      });
    } else {
      const answerIndex = validAnswers.includes(correctAnswer)
        ? validAnswers.indexOf(correctAnswer)
        : parseInt(correctAnswer) - 1;

      if (answerIndex >= optionValues.length) {
        errors.push({
          field: 'Correct Answer',
          message: `Correct answer (${correctAnswer}) exceeds number of options (${optionValues.length})`,
          level: 'critical',
        });
      }
    }
  }
}

/**
 * Validate MSQ (Multiple Select) type question
 */
function validateMSQ(
  row: QuestionData,
  columnMapping: any,
  errors: ValidationError[]
): void {
  // Check options (need at least 2)
  if (!columnMapping.optionCols || columnMapping.optionCols.length < 2) {
    errors.push({
      field: 'Options',
      message: 'No option columns found for MSQ (minimum 2 required)',
      level: 'critical',
    });
    return;
  }

  const optionValues = columnMapping.optionCols
    .map((col: string) => row[col])
    .filter((v: any) => v !== null && v !== undefined && v !== '');

  if (optionValues.length < 2) {
    errors.push({
      field: 'Options',
      message: `Not enough options (found ${optionValues.length}, need at least 2)`,
      level: 'critical',
    });
  } else if (optionValues.length === 2) {
    errors.push({
      field: 'Options',
      message: 'Only 2 options in MSQ (3 or more recommended)',
      level: 'warning',
    });
  }

  // Check correct answers format
  if (columnMapping.answerCol && row[columnMapping.answerCol]) {
    const answers = (row[columnMapping.answerCol] as string).split(',').map(a => a.trim().toUpperCase());
    const validAnswers = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

    const validNumbers = ['1', '2', '3', '4', '5', '6', '7', '8'];

    if (answers.length === 0) {
      errors.push({
        field: 'Correct Answers',
        message: 'No correct answers specified',
        level: 'critical',
      });
    } else if (answers.length === 1) {
      errors.push({
        field: 'Correct Answers',
        message: 'MSQ should have multiple correct answers (use comma-separated list)',
        level: 'warning',
      });
    }

    // Validate each answer format
    const invalidAnswers = answers.filter(
      ans => !validAnswers.includes(ans) && !validNumbers.includes(ans)
    );

    if (invalidAnswers.length > 0) {
      errors.push({
        field: 'Correct Answers',
        message: `Invalid answer format: "${invalidAnswers.join(', ')}" (use A-H or 1-8, comma-separated)`,
        level: 'critical',
      });
    }
  }
}

/**
 * Validate Text Entry type question
 */
function validateShortAnswer(
  row: QuestionData,
  columnMapping: any,
  errors: ValidationError[]
): void {
  // Text entry should not have options
  if (columnMapping.optionCols && columnMapping.optionCols.length > 0) {
    const hasOption = columnMapping.optionCols.some((col: string) => row[col]);
    if (hasOption) {
      errors.push({
        field: 'Options',
        message: 'Text entry type should not have options',
        level: 'critical',
      });
    }
  }

  // Check if answer exists and is meaningful
  if (columnMapping.answerCol && row[columnMapping.answerCol]) {
    const answer = (row[columnMapping.answerCol] as string).trim();
    if (answer.length < 2) {
      errors.push({
        field: 'Correct Answer',
        message: 'Expected answer is too short',
        level: 'warning',
      });
    }
  }

  // Numeric tolerance check
  const answerValue = columnMapping.answerCol ? row[columnMapping.answerCol] : null;
  if (answerValue && !isNaN(answerValue)) {
    if (!columnMapping.toleranceCol || !row[columnMapping.toleranceCol]) {
      errors.push({
        field: 'Tolerance',
        message: 'Numeric answer should have tolerance value',
        level: 'warning',
      });
    }
  }
}

/**
 * Validate Order Interaction type question
 */
function validateOrder(
  row: QuestionData,
  columnMapping: any,
  errors: ValidationError[]
): void {
  // Check if order items exist
  if (!columnMapping.orderCol || !row[columnMapping.orderCol]) {
    errors.push({
      field: 'Order Items',
      message: 'No items found for ordering',
      level: 'critical',
    });
    return;
  }

  const orderItems = (row[columnMapping.orderCol] as string).split(',').filter(item => item.trim().length > 0);

  if (orderItems.length < 2) {
    errors.push({
      field: 'Order Items',
      message: `Insufficient items for ordering (found ${orderItems.length}, need at least 2)`,
      level: 'critical',
    });
  }
}

/**
 * Validate a single question row
 */
function validateQuestionRow(
  row: QuestionData,
  rowNumber: number,
  columnMapping: any
): ValidationResult {
  const normalized = normalizeData(row);
  const questionType = detectQuestionTypeInternal(normalized, columnMapping);
  const allErrors: ValidationError[] = [];

  // 1. Normalize data
  // 2. Run base validation
  const baseErrors = validateBaseFields(normalized, columnMapping);
  allErrors.push(...baseErrors);

  // 3. Run question-type validation
  switch (questionType) {
    case 'mcq':
      validateMCQ(normalized, columnMapping, allErrors);
      break;
    case 'msq':
      validateMSQ(normalized, columnMapping, allErrors);
      break;
    case 'shortanswer':
    case 'textentry':
      validateShortAnswer(normalized, columnMapping, allErrors);
      break;
    case 'order':
      validateOrder(normalized, columnMapping, allErrors);
      break;
  }

  // 4. Collect critical errors and warnings
  const criticalErrors = allErrors.filter(e => e.level === 'critical');
  const warnings = allErrors.filter(e => e.level === 'warning');

  // 5. Assign Status
  let status: ValidationStatus = 'valid';
  if (criticalErrors.length > 0) {
    status = 'rejected';
  } else if (warnings.length > 0) {
    status = 'caution';
  }

  // 6. Return enriched row
  return {
    rowId: row.id,
    rowNumber,
    status,
    data: normalized,
    criticalErrors,
    warnings,
    detectedType: questionType,
    errorCount: criticalErrors.length,
    warningCount: warnings.length,
    lastValidatedAt: new Date().toISOString(),
    validationVersion: '1.0',
  };
}

/**
 * Validate all questions in batch (stateless, pure function)
 */
export function validateAllQuestions(
  rows: QuestionData[],
  columnMapping: any
): ValidationResult[] {
  return rows.map((row, index) =>
    validateQuestionRow(row, index + 1, columnMapping)
  );
}

/**
 * Validate a single row after user edit
 */
export function validateSingleRow(
  row: QuestionData,
  rowNumber: number,
  columnMapping: any
): ValidationResult {
  return validateQuestionRow(row, rowNumber, columnMapping);
}

/**
 * Detect question type from row data (exported for public use)
 */
export function detectQuestionType(
  row: QuestionData,
  columnMapping: any
): string {
  return detectQuestionTypeInternal(row, columnMapping);
}
