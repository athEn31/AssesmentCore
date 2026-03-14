/**
 * QTI 3.0 Type Definitions
 * Core data structures for QTI 3.0 assessment items
 */

export type InteractionType = 'choice' | 'textEntry' | 'extended' | 'stimulus';
export type Cardinality = 'single' | 'multiple' | 'ordered' | 'record';
export type BaseType = 'identifier' | 'string' | 'integer' | 'float' | 'boolean' | 'file';

/**
 * QTI Assessment Item - Root structure for a question
 */
export interface QTIAssessmentItem {
  // Attributes
  identifier: string; // Unique ID for this item (e.g., "item_001")
  title: string; // Question title/name
  adaptive: boolean; // Whether item is adaptive
  timeDependent: boolean; // Whether time affects scoring
  
  // Core elements
  responseDeclaration: ResponseDeclaration;
  outcomeDeclarations: OutcomeDeclaration[];
  itemBody: ItemBody;
  responseProcessing: ResponseProcessing;
  feedbacks?: ModalFeedback[];
  
  // Metadata (flexible to support both simple and full LOM metadata)
  metadata?: any; // ItemMetadata | QuestionMetadata from metadataMapper
}

/**
 * Response Declaration - Defines how responses are stored
 */
export interface ResponseDeclaration {
  identifier: string; // Usually "RESPONSE"
  cardinality: Cardinality; // 'single' for MCQ, 'multiple' for multi-select
  baseType: BaseType; // 'identifier' for choices, 'string' for text
  correctResponse?: {
    values: string[]; // Correct answer(s)
  };
  mapping?: {
    caseSensitive?: boolean;
    defaultValue?: number;
    mappingEntries: Array<{
      mapKey: string;
      mappedValue: number;
    }>;
  };
}

/**
 * Outcome Declaration - Defines scoring variables
 */
export interface OutcomeDeclaration {
  identifier: string; // e.g., "SCORE", "MAXSCORE"
  cardinality: Cardinality; // Usually 'single'
  baseType: BaseType; // Usually 'float'
  defaultValue?: string | number;
}

/**
 * Item Body - Visible question content
 */
export interface ItemBody {
  content: string; // Raw XML content or HTML markup
  interactions: Interaction[];
}

/**
 * Base Interaction interface
 */
export interface Interaction {
  type: InteractionType;
  responseIdentifier: string;
  content: string; // XML content of the interaction
}

/**
 * Choice Interaction - MCQ or Multiple Select
 */
export interface ChoiceInteraction extends Interaction {
  type: 'choice';
  maxChoices: number; // 1 for MCQ, 0 or more for multi-select
  shuffle: boolean;
  choices: Choice[];
}

/**
 * Choice option
 */
export interface Choice {
  identifier: string; // A, B, C, D, etc.
  content: string; // Option text/HTML
  fixed?: boolean;
}

/**
 * Text Entry Interaction - Short answer
 */
export interface TextEntryInteraction extends Interaction {
  type: 'textEntry';
  expectedLength?: number;
  patternMask?: string;
  format?: 'plain' | 'html' | 'mathml';
}

/**
 * Response Processing - Scoring logic
 */
export interface ResponseProcessing {
  template?: string; // e.g., "match_correct", "map_response"
  xml?: string; // Custom response processing XML
}

/**
 * Modal Feedback - Feedback shown based on response
 */
export interface ModalFeedback {
  identifier: string;
  showHide: 'show' | 'hide';
  content: string;
  outcomeIdentifier?: string; // When to show this feedback
}

/**
 * Item Metadata
 */
export interface ItemMetadata {
  difficulty?: 'easy' | 'medium' | 'hard';
  subject?: string;
  topic?: string;
  keywords?: string[];
  [key: string]: any;
}

// Import QuestionMetadata from metadataMapper for full metadata support
// ItemMetadata is kept for backward compatibility
// Use QuestionMetadata from metadataMapper.ts for complete LOM support

/**
 * Excel Question Row (Input format)
 */
export interface ExcelQuestionRow {
  id?: string;
  question: string; // Question text
  type: 'mcq' | 'textEntry'; // Question type
  options?: string[]; // For MCQ: [optionA, optionB, optionC, optionD]
  correctAnswer: string; // For MCQ: "A", For text: "answer text"
  explanation?: string;
  points?: number;
  difficulty?: string;
  images?: string[]; // Image filenames referenced
  stimulusId?: string; // Shared stimulus identifier
  stimulusHref?: string; // Optional explicit path (e.g., stimuli/S1.xml)
  stimulusIdentifier?: string; // Alternate key for shared stimulus id
  sharedStimulusId?: string; // Alternate key for shared stimulus id
  [key: string]: any;
}

/**
 * QTI Item Builder Input
 */
export interface ItemBuilderInput {
  questionData: ExcelQuestionRow;
  questionType: 'mcq' | 'textEntry';
  imageMap?: Map<string, string>; // filename -> filepath
}

/**
 * QTI Item Builder Output
 */
export interface ItemBuilderOutput {
  xml: string; // Complete assessment item XML
  itemId: string;
  images: string[]; // Image files referenced
  errors?: string[];
}
