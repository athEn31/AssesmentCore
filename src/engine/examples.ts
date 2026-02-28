/**
 * QTI Engine - Example Usage & Testing
 * Demonstrates how to use the QTI generation engine
 */

import {
  generateMCQXml,
  generateAndValidateMCQ,
  generateQTIForUpload,
  validateQuestionsForGeneration,
  generateBatchReport,
  Question,
} from './index';

/**
 * Example 1: Generate QTI XML for a simple MCQ question
 */
function exampleBasicMCQ(): void {
  console.log('=== Example 1: Basic MCQ Generation ===\n');

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

  try {
    const xml = generateMCQXml(question);
    console.log('Generated QTI XML:');
    console.log(xml);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
  }

  console.log('\n');
}

/**
 * Example 2: Generate and validate MCQ
 */
function exampleValidation(): void {
  console.log('=== Example 2: Generation with Validation ===\n');

  const question: Question = {
    id: 'Q002',
    upload_id: 'UPLOAD_001',
    identifier: 'BIO_002',
    stem: 'Which organelle is responsible for energy production in cells?',
    type: 'MCQ',
    options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi Apparatus'],
    correct_answer: 'B',
    validation_status: 'Valid',
  };

  const result = generateAndValidateMCQ(question);

  if ('error' in result) {
    console.error('Generation failed:', result.error.message);
  } else {
    console.log('✓ Generation successful');
    console.log('XML Length:', result.xml.length);
    console.log('First 200 chars:', result.xml.substring(0, 200) + '...');
  }

  console.log('\n');
}

/**
 * Example 3: Batch generation with error handling
 */
async function exampleBatchGeneration(): Promise<void> {
  console.log('=== Example 3: Batch Generation ===\n');

  const questions: Question[] = [
    {
      id: 'Q003',
      upload_id: 'UPLOAD_002',
      identifier: 'CHEM_001',
      stem: 'What is the chemical formula for water?',
      type: 'MCQ',
      options: ['H2O', 'O2', 'CO2', 'H2O2'],
      correct_answer: 'A',
      validation_status: 'Valid',
    },
    {
      id: 'Q004',
      upload_id: 'UPLOAD_002',
      identifier: 'MATH_001',
      stem: 'What is 2 + 2?',
      type: 'MCQ',
      options: ['3', '4', '5', '6'],
      correct_answer: 'B',
      validation_status: 'Valid',
    },
    {
      id: 'Q005',
      upload_id: 'UPLOAD_002',
      identifier: 'ENG_001',
      stem: 'Which is correct?',
      type: 'MCQ',
      options: ['Option A', 'Option B'],
      correct_answer: 'Z', // Invalid - will fail
      validation_status: 'Valid',
    },
  ];

  const summary = await generateQTIForUpload(questions);

  console.log('Batch Summary:');
  console.log(`Total: ${summary.total}`);
  console.log(`Success: ${summary.success}`);
  console.log(`Failed: ${summary.failed}`);

  if (summary.errors.length > 0) {
    console.log('\nErrors:');
    summary.errors.forEach((err) => {
      console.log(`- ${err.questionId}: ${err.error.message}`);
    });
  }

  console.log('\n' + generateBatchReport(summary));
  console.log('\n');
}

/**
 * Example 4: Validate questions before generation
 */
function exampleValidateQuestions(): void {
  console.log('=== Example 4: Pre-Generation Validation ===\n');

  const questions: Question[] = [
    {
      id: 'Q006',
      upload_id: 'UPLOAD_003',
      identifier: 'VALID_Q',
      stem: 'Valid question?',
      type: 'MCQ',
      options: ['Yes', 'No', 'Maybe', 'Unknown'],
      correct_answer: 'A',
      validation_status: 'Valid',
    },
    {
      id: 'Q007',
      upload_id: 'UPLOAD_003',
      identifier: 'INVALID_Q',
      stem: 'Invalid question?',
      type: 'MCQ',
      options: ['Yes', 'No'], // Too few options
      correct_answer: 'Z',
      validation_status: 'Caution', // Not Valid status
    },
  ];

  const result = validateQuestionsForGeneration(questions);

  console.log('Validation Result:');
  console.log(`Valid: ${result.valid}`);

  if (result.errors.length > 0) {
    console.log('Found issues:');
    result.errors.forEach((err) => {
      console.log(`- ${err}`);
    });
  }

  console.log('\n');
}

/**
 * Example 5: Error handling for invalid questions
 */
function exampleErrorHandling(): void {
  console.log('=== Example 5: Error Handling ===\n');

  const invalidQuestions: Question[] = [
    {
      id: 'ERR_001',
      upload_id: 'UPLOAD_004',
      identifier: '', // Missing identifier
      stem: 'Test?',
      type: 'MCQ',
      options: ['A', 'B'],
      correct_answer: 'A',
      validation_status: 'Valid',
    },
    {
      id: 'ERR_002',
      upload_id: 'UPLOAD_004',
      identifier: 'TEST',
      stem: '', // Missing stem
      type: 'MCQ',
      options: ['A', 'B'],
      correct_answer: 'A',
      validation_status: 'Valid',
    },
    {
      id: 'ERR_003',
      upload_id: 'UPLOAD_004',
      identifier: 'TEST3',
      stem: 'Test?',
      type: 'MCQ',
      options: ['A'], // Too few options
      correct_answer: 'A',
      validation_status: 'Valid',
    },
  ];

  console.log('Testing error handling for invalid questions:\n');

  invalidQuestions.forEach((question) => {
    const result = generateAndValidateMCQ(question);
    if ('error' in result) {
      console.log(`✗ ${question.identifier || 'Unknown'}`);
      console.log(`  Error: ${result.error.message}`);
    }
  });

  console.log('\n');
}

/**
 * Example 6: Using with numeric answer identifiers
 */
function exampleNumericAnswers(): void {
  console.log('=== Example 6: Numeric Answer Identifiers ===\n');

  const question: Question = {
    id: 'Q008',
    upload_id: 'UPLOAD_005',
    identifier: 'TEST_NUMERIC',
    stem: 'Choose the correct option?',
    type: 'MCQ',
    options: [
      'First option',
      'Second option',
      'Third option',
      'Fourth option',
    ],
    correct_answer: '3', // Using numeric identifier instead of letter
    validation_status: 'Valid',
  };

  const result = generateAndValidateMCQ(question);

  if ('error' in result) {
    console.error('Error:', result.error.message);
  } else {
    console.log('✓ Generated successfully with numeric identifier');
    // Check that correct answer is properly converted
    if (result.xml.includes('<value>C</value>')) {
      console.log('✓ Correctly mapped "3" to "C"');
    }
  }

  console.log('\n');
}

/**
 * Run all examples
 */
export async function runAllExamples(): Promise<void> {
  console.clear();
  console.log('╔════════════════════════════════════════════╗');
  console.log('║     QTI Generation Engine Examples         ║');
  console.log('╚════════════════════════════════════════════╝\n');

  exampleBasicMCQ();
  exampleValidation();
  await exampleBatchGeneration();
  exampleValidateQuestions();
  exampleErrorHandling();
  exampleNumericAnswers();

  console.log('╔════════════════════════════════════════════╗');
  console.log('║          Examples Completed                ║');
  console.log('╚════════════════════════════════════════════╝\n');
}

// Uncomment to run examples:
// runAllExamples().catch(console.error);
