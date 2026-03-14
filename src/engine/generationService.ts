/**
 * QTI Generation Service
 * Orchestrates the generation of QTI XML for questions
 * Coordinates database operations and builder execution
 */

import { Question, GenerationSummary, GenerationError } from './types';
import { generateAndValidateMCQ } from './builders/qti21/mcqBuilder';
import { generateAndValidateMCQ12 } from './builders/qti12/mcqBuilder';
import { generateAndValidateMCQ30 } from './builders/qti30/mcqBuilder';
import { generateAndValidateTextEntry } from './builders/qti21/textEntryBuilder';
import { generateAndValidateTextEntry12 } from './builders/qti12/textEntryBuilder';
import { generateAndValidateTextEntry30 } from './builders/qti30/textEntryBuilder';

/**
 * Generate QTI XML based on question type and version
 */
export async function generateQTIByVersion(
  question: Question,
  version: 'qti-1.2' | 'qti-2.1' | 'qti-3.0' = 'qti-2.1',
  questionType: 'MCQ' | 'ShortAnswer' = 'MCQ'
): Promise<{ xml: string } | { error: GenerationError }> {
  // Route to the correct builder based on version and type
  if (questionType === 'MCQ') {
    switch (version) {
      case 'qti-1.2':
        return generateAndValidateMCQ12(question);
      case 'qti-2.1':
        return generateAndValidateMCQ(question);
      case 'qti-3.0':
        return generateAndValidateMCQ30(question);
      default:
        return generateAndValidateMCQ(question);
    }
  } else if (questionType === 'ShortAnswer') {
    switch (version) {
      case 'qti-1.2':
        return generateAndValidateTextEntry12(question);
      case 'qti-2.1':
        return generateAndValidateTextEntry(question);
      case 'qti-3.0':
        return generateAndValidateTextEntry30(question);
      default:
        return generateAndValidateTextEntry(question);
    }
  }

  return {
    error: {
      code: 'UNSUPPORTED_TYPE',
      message: `Question type '${questionType}' is not supported`,
    },
  };
}

/**
 * Generate QTI for a single question
 * Updates generation status based on success/failure
 */
export async function generateQTIForQuestion(
  question: Question
): Promise<{ question: Question; error?: GenerationError }> {
  try {
    // Only generate for Valid MCQ questions
    if (question.validation_status !== 'Valid') {
      return {
        question,
        error: {
          code: 'INVALID_STATUS',
          message: `Question validation status is '${question.validation_status}', not 'Valid'`,
        },
      };
    }

    if (question.type !== 'MCQ') {
      return {
        question,
        error: {
          code: 'UNSUPPORTED_TYPE',
          message: `Question type '${question.type}' is not supported in this version (only MCQ)`,
        },
      };
    }

    // Generate XML based on question type
    const result = await generateAndValidateMCQ(question);

    if ('error' in result) {
      return {
        question,
        error: result.error,
      };
    }

    // Update question with generated output
    const updatedQuestion: Question = {
      ...question,
      generated_output: result.xml,
      generation_status: 'Success',
      generation_errors: undefined,
    };

    return { question: updatedQuestion };
  } catch (error) {
    const generationError: GenerationError = {
      code: 'GENERATION_ERROR',
      message: error instanceof Error ? error.message : String(error),
      details: error,
    };

    return {
      question,
      error: generationError,
    };
  }
}

/**
 * Generate QTI for multiple questions from an upload
 * This function processes a batch of questions and returns a summary
 *
 * In a real implementation, this would:
 * 1. Fetch questions from Supabase
 * 2. Generate QTI for each
 * 3. Update database with results
 *
 * For now, it processes an in-memory array of questions
 */
export async function generateQTIForUpload(
  questions: Question[]
): Promise<GenerationSummary> {
  const summary: GenerationSummary = {
    total: questions.length,
    success: 0,
    failed: 0,
    errors: [],
  };

  for (const question of questions) {
    const result = await generateQTIForQuestion(question);

    if (result.error) {
      summary.failed++;
      summary.errors.push({
        questionId: question.id,
        error: result.error,
      });
    } else {
      summary.success++;

      // In a real implementation, you would update the database here:
      // await updateQuestionInDatabase(result.question)
    }
  }

  return summary;
}

/**
 * Generate QTI batch report with detailed statistics
 */
export function generateBatchReport(summary: GenerationSummary): string {
  const lines: string[] = [
    'QTI Generation Report',
    '='.repeat(50),
    `Total Questions: ${summary.total}`,
    `Successfully Generated: ${summary.success}`,
    `Failed: ${summary.failed}`,
    `Success Rate: ${summary.total > 0 ? ((summary.success / summary.total) * 100).toFixed(2) : 0}%`,
  ];

  if (summary.errors.length > 0) {
    lines.push('');
    lines.push('Errors:');
    lines.push('-'.repeat(50));
    for (const error of summary.errors) {
      lines.push(`Question ID: ${error.questionId}`);
      lines.push(`Code: ${error.error.code}`);
      lines.push(`Message: ${error.error.message}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Validate if all questions in upload are eligible for generation
 */
export function validateQuestionsForGeneration(
  questions: Question[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const question of questions) {
    if (question.validation_status !== 'Valid') {
      errors.push(
        `Question ${question.identifier}: Invalid validation status '${question.validation_status}'`
      );
    }

    if (question.type !== 'MCQ') {
      errors.push(
        `Question ${question.identifier}: Unsupported type '${question.type}' (only MCQ supported)`
      );
    }

    if (!question.options || question.options.length < 2) {
      errors.push(
        `Question ${question.identifier}: Insufficient options (need at least 2)`
      );
    }

    if (!question.correct_answer) {
      errors.push(
        `Question ${question.identifier}: No correct answer specified`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
