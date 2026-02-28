/**
 * Type definitions for QTI engine
 */

export interface Question {
  id: string;
  upload_id: string;
  identifier: string;
  stem: string;
  type: 'MCQ' | 'MSQ' | 'ShortAnswer' | 'OrderInteraction';
  options: string[];
  correct_answer: string;
  validation_status: 'Valid' | 'Caution' | 'Rejected';
  generated_output?: string;
  generation_status?: 'Pending' | 'Success' | 'Failed';
  generation_errors?: GenerationError[];
}

export interface GenerationError {
  code: string;
  message: string;
  details?: any;
}

export interface GenerationSummary {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ questionId: string; error: GenerationError }>;
}

export interface QuestionBuilder {
  generate(question: Question): string;
  validate(xml: string): boolean;
}

export interface XMLValidationError {
  message: string;
  line?: number;
  column?: number;
}
