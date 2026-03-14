/**
 * QTI 3.0 Test Structure Types
 * Defines the hierarchy: AssessmentTest → TestPart → AssessmentSection → ItemRef
 */

/**
 * Assessment Item Reference
 * References an individual assessment item within a section
 */
export interface AssessmentItemRef {
  identifier: string;           // Unique reference ID
  href: string;                  // Relative path to item XML (e.g., "items/Q001.xml")
  title?: string;                // Optional display title
  category?: string[];           // Categories for reporting/filtering
  required?: boolean;            // Whether item must be attempted
  fixed?: boolean;               // Whether position is fixed in adaptive tests
  
  // Item session control
  maxAttempts?: number;          // Max attempts allowed (0 = unlimited)
  showFeedback?: boolean;        // Whether to show feedback
  allowReview?: boolean;         // Allow review before submission
  showSolution?: boolean;        // Show solution after attempts
  
  // Weights and metadata
  weight?: number;               // Item weight for scoring
  timeLimit?: number;            // Time limit in seconds
  
  // Variable mappings (for outcome aggregation)
  variableMappings?: VariableMapping[];
}

/**
 * Variable Mapping
 * Maps outcomes from items to test-level variables
 */
export interface VariableMapping {
  sourceIdentifier: string;      // Outcome identifier from item (e.g., "SCORE")
  targetIdentifier: string;      // Test variable identifier (e.g., "TOTAL_SCORE")
  transform?: 'identity' | 'multiply' | 'add' | 'custom';
  transformValue?: number;       // Value for transform (e.g., weight multiplier)
}

/**
 * Assessment Section
 * Groups related items together with shared settings
 */
export interface AssessmentSection {
  identifier: string;            // Unique section ID
  title: string;                 // Section title displayed to user
  visible?: boolean;             // Whether section title is visible
  keepTogether?: boolean;        // Keep all items on same page
  
  // Selection and ordering
  selection?: ItemSelection;     // Rules for selecting subset of items
  ordering?: ItemOrdering;       // Rules for ordering items
  
  // Item references
  assessmentItemRefs: AssessmentItemRef[];
  
  // Nested sections (optional)
  assessmentSections?: AssessmentSection[];
  
  // Rubric and pre-conditions
  rubricBlocks?: RubricBlock[];  // Instructional content
  preCondition?: string;         // Condition to show section
  branchRules?: BranchRule[];    // Conditional branching
  
  // Time limits
  timeLimits?: TimeLimits;
}

/**
 * Item Selection
 * Rules for selecting a subset of items from a section
 */
export interface ItemSelection {
  select: number;                // Number of items to select
  withReplacement?: boolean;     // Allow same item multiple times
  extensions?: Record<string, any>;
}

/**
 * Item Ordering
 * Rules for ordering items within a section
 */
export interface ItemOrdering {
  shuffle: boolean;              // Randomize order
  extensions?: Record<string, any>;
}

/**
 * Rubric Block
 * Instructional or informational content displayed in section
 */
export interface RubricBlock {
  view?: 'author' | 'candidate' | 'proctor' | 'scorer' | 'testConstructor' | 'tutor';
  content: string;               // HTML content
  styleClass?: string;
}

/**
 * Branch Rule
 * Conditional navigation to different sections
 */
export interface BranchRule {
  target: string;                // Target section identifier
  condition: string;             // Expression to evaluate
}

/**
 * Time Limits
 * Time constraints for section or test part
 */
export interface TimeLimits {
  minTime?: number;              // Minimum seconds before submission allowed
  maxTime?: number;              // Maximum seconds before forced submission
  allowLateSubmission?: boolean; // Allow submission after maxTime
}

/**
 * Test Part
 * Major division of an assessment test
 */
export interface TestPart {
  identifier: string;            // Unique test part ID
  navigationMode: 'linear' | 'nonlinear'; // Navigation style
  submissionMode: 'individual' | 'simultaneous'; // When items are submitted
  
  // Pre-conditions and branching
  preCondition?: string;
  branchRules?: BranchRule[];
  
  // Item session control (applies to all items)
  itemSessionControl?: ItemSessionControl;
  
  // Time limits
  timeLimits?: TimeLimits;
  
  // Sections
  assessmentSections: AssessmentSection[];
  
  // Test feedback
  testFeedbacks?: TestFeedback[];
}

/**
 * Item Session Control
 * Controls behavior of item sessions
 */
export interface ItemSessionControl {
  maxAttempts?: number;          // Max attempts (0 = unlimited)
  showFeedback?: boolean;        // Show feedback immediately
  allowReview?: boolean;         // Allow review
  showSolution?: boolean;        // Show solutions
  allowComment?: boolean;        // Allow candidate comments
  allowSkipping?: boolean;       // Allow skipping items
  validateResponses?: boolean;   // Validate before submission
}

/**
 * Test Feedback
 * Feedback shown at test part or test level
 */
export interface TestFeedback {
  identifier: string;
  outcomeIdentifier: string;     // Which outcome to check
  showHide: 'show' | 'hide';
  title?: string;
  access: 'atEnd' | 'during';
  content: string;               // HTML content
}

/**
 * Outcome Declaration (Test Level)
 * Declares test-level outcome variables
 */
export interface TestOutcomeDeclaration {
  identifier: string;
  cardinality: 'single' | 'multiple' | 'ordered' | 'record';
  baseType?: 'boolean' | 'integer' | 'float' | 'string' | 'identifier';
  view?: ('author' | 'candidate' | 'proctor' | 'scorer' | 'testConstructor' | 'tutor')[];
  interpretation?: string;
  longInterpretation?: string;
  normalMaximum?: number;
  normalMinimum?: number;
  masteryValue?: number;
  defaultValue?: any;
  externalScored?: string;       // External scoring system reference
}

/**
 * Outcome Processing (Test Level)
 * Aggregates item outcomes into test outcomes
 */
export interface OutcomeProcessing {
  outcomeRules: OutcomeRule[];
}

/**
 * Outcome Rule
 * Single rule in outcome processing
 */
export interface OutcomeRule {
  type: 'setOutcomeValue' | 'lookupOutcomeValue' | 'outcomeCondition';
  identifier?: string;
  expression?: string;
  conditions?: OutcomeCondition[];
}

/**
 * Outcome Condition
 * Conditional outcome processing
 */
export interface OutcomeCondition {
  condition: string;
  rules: OutcomeRule[];
}

/**
 * Assessment Test
 * Top-level test structure
 */
export interface AssessmentTest {
  identifier: string;            // Unique test ID
  title: string;                 // Test title
  toolName?: string;             // Authoring tool
  toolVersion?: string;          // Tool version
  
  // Outcome declarations
  outcomeDeclarations?: TestOutcomeDeclaration[];
  
  // Test parts
  testParts: TestPart[];
  
  // Outcome processing (score aggregation)
  outcomeProcessing?: OutcomeProcessing;
  
  // Test feedback
  testFeedbacks?: TestFeedback[];
  
  // Time limits (entire test)
  timeLimits?: TimeLimits;
}

/**
 * Test Build Configuration
 * Input for building an assessment test
 */
export interface TestBuildConfig {
  testIdentifier: string;
  testTitle: string;
  toolName?: string;
  toolVersion?: string;
  
  // Items to include
  items: TestItemConfig[];
  
  // Grouping strategy
  groupingStrategy?: 'single-section' | 'by-category' | 'by-difficulty' | 'custom';
  customSections?: SectionConfig[];
  
  // Test-level settings
  navigationMode?: 'linear' | 'nonlinear';
  submissionMode?: 'individual' | 'simultaneous';
  maxAttempts?: number;
  showFeedback?: boolean;
  allowReview?: boolean;
  showSolution?: boolean;
  shuffle?: boolean;
  
  // Time limits
  timeLimits?: TimeLimits;
  
  // Scoring
  aggregateScores?: boolean;     // Compute total score
  normalizeScores?: boolean;     // Normalize to 0-100
}

/**
 * Test Item Configuration
 * Describes how an item should be included in the test
 */
export interface TestItemConfig {
  itemIdentifier: string;        // Item ID (e.g., "Q001")
  itemHref: string;              // Path to item XML (e.g., "items/Q001.xml")
  title?: string;
  category?: string;             // For grouping (e.g., "Math", "Easy")
  required?: boolean;
  weight?: number;
  maxAttempts?: number;
  timeLimit?: number;
}

/**
 * Section Configuration
 * Custom section definition
 */
export interface SectionConfig {
  identifier: string;
  title: string;
  itemIdentifiers: string[];     // Which items to include
  shuffle?: boolean;
  timeLimits?: TimeLimits;
  rubric?: string;               // Instructional text
}
