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
    return String(row[columnMapping.typeCol]).toLowerCase().trim();
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
    const optionTexts = options.map((o: any) => String(o).toLowerCase().trim());
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
  const uniqueOptions = new Set(optionValues.map((o: any) => String(o).toLowerCase().trim()));
  if (uniqueOptions.size < optionValues.length) {
    errors.push({
      field: 'Options',
      message: 'Duplicate options detected',
      level: 'warning',
    });
  }

  // Check correct answer exists
  if (columnMapping.answerCol && !row[columnMapping.answerCol]) {
    errors.push({
      field: 'Correct Answer',
      message: 'Correct answer is missing',
      level: 'critical',
    });
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

  // Check correct answers exist
  if (columnMapping.answerCol && row[columnMapping.answerCol]) {
    const answersText = String(row[columnMapping.answerCol]).trim();
    
    if (!answersText) {
      errors.push({
        field: 'Correct Answers',
        message: 'No correct answers specified',
        level: 'critical',
      });
    }
  } else if (columnMapping.answerCol) {
    errors.push({
      field: 'Correct Answers',
      message: 'No correct answers specified',
      level: 'critical',
    });
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
    const answer = String(row[columnMapping.answerCol]).trim();
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

  const orderItems = String(row[columnMapping.orderCol]).split(',').filter(item => item.trim().length > 0);

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
  if (!rows || rows.length === 0) return [];
  
  // First, detect duplicates across all questions
  const duplicates = detectDuplicates(rows, columnMapping);

  // Validate each question and add duplicate warnings
  return rows.map((row, index) => {
    if (!row) return null; // Safety check
    const result = validateQuestionRow(row, index + 1, columnMapping);
    
    // Add duplicate warning if this question is a duplicate
    if (row.id && duplicates.has(row.id)) {
      const duplicateIds = duplicates.get(row.id)!;
      const duplicateRowNumbers = duplicateIds
        .map(id => {
          const idx = rows.findIndex(r => r && r.id === id);
          return idx !== -1 ? idx + 1 : null;
        })
        .filter(n => n !== null)
        .sort((a, b) => a! - b!);

      const duplicateWarning: ValidationError = {
        field: 'Duplicate',
        message: `Duplicate question detected. Also appears in row(s): ${duplicateRowNumbers.join(', ')}`,
        level: 'warning',
      };

      // Add to warnings if not already present
      if (!result.warnings.some(w => w.field === 'Duplicate')) {
        result.warnings.unshift(duplicateWarning); // Add at the beginning for visibility
        result.warningCount = result.warnings.length;
        
        // Update status if currently valid
        if (result.status === 'valid') {
          result.status = 'caution';
        }
      }
    }

    return result;
  }).filter(r => r !== null) as ValidationResult[];
}

/**
 * Generate a fingerprint for a question to detect duplicates
 * Uses question text and options (if MCQ) for matching
 */
function getQuestionFingerprint(
  row: QuestionData,
  columnMapping: any
): string {
  const questionText = columnMapping.questionCol 
    ? (row[columnMapping.questionCol] || '')
    : '';
  
  // Normalize: lowercase, remove extra spaces, trim
  let fingerprint = String(questionText)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  // For MCQ, include options in fingerprint for more precise matching
  if (columnMapping.optionCols && columnMapping.optionCols.length > 0) {
    const options = columnMapping.optionCols
      .map((col: string) => row[col] != null ? String(row[col]) : '')
      .filter((opt: string) => String(opt).trim() !== '')
      .map((opt: string) => String(opt).toLowerCase().replace(/\s+/g, ' ').trim())
      .sort() // Sort to handle option order variations
      .join('||');
    
    if (options) {
      fingerprint += '::OPTIONS::' + options;
    }
  }

  return fingerprint;
}

/**
 * Detect duplicate questions in a batch
 * Returns a Map of row IDs to arrays of duplicate row IDs
 */
function detectDuplicates(
  rows: QuestionData[],
  columnMapping: any
): Map<string, string[]> {
  const fingerprintMap = new Map<string, string[]>();
  const duplicateMap = new Map<string, string[]>();

  if (!rows) return duplicateMap;

  // Build fingerprint map
  rows.forEach(row => {
    if (!row || !row.id) return;
    const fingerprint = getQuestionFingerprint(row, columnMapping);
    if (!fingerprint) return; // Skip if no question text

    if (!fingerprintMap.has(fingerprint)) {
      fingerprintMap.set(fingerprint, []);
    }
    fingerprintMap.get(fingerprint)!.push(row.id);
  });


  // Find duplicates (fingerprints with more than 1 question)
  fingerprintMap.forEach((rowIds, fingerprint) => {
    if (rowIds.length > 1) {
      // All questions with this fingerprint are duplicates of each other
      rowIds.forEach(rowId => {
        duplicateMap.set(rowId, rowIds.filter(id => id !== rowId));
      });
    }
  });

  return duplicateMap;
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
