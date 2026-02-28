/**
 * QTI Engine - Quick Start Guide
 * 
 * This file demonstrates the complete workflow of the QTI generation system
 * and how all components work together.
 */

import {
  Question,
  GenerationSummary,
  createMCQBuilder,
  generateMCQXml,
  generateAndValidateMCQ,
  generateQTIForUpload,
  validateQuestionsForGeneration,
  generateBatchReport,
  validateXml,
  escapeXml,
} from './index';

/**
 * WORKFLOW 1: Single Question Generation
 * 
 * Typical flow for generating QTI XML for a single question
 */
function quickStartSingleQuestion() {
  // Step 1: Create a question object
  const question: Question = {
    id: 'Q001',
    upload_id: 'UPLOAD_001',
    identifier: 'MATH_001',
    stem: 'What is the value of 2 + 2?',
    type: 'MCQ',
    options: ['3', '4', '5', '6'],
    correct_answer: 'B',
    validation_status: 'Valid',
  };

  // Step 2: Generate and validate
  const result = generateAndValidateMCQ(question);

  // Step 3: Check result
  if ('error' in result) {
    console.error('Generation failed:', result.error.message);
    return;
  }

  // Step 4: Use the XML
  console.log('Generated XML:', result.xml);
  console.log('XML Length:', result.xml.length, 'bytes');
}

/**
 * WORKFLOW 2: Batch Question Processing
 * 
 * Typical flow for generating QTI XML for multiple questions
 */
async function quickStartBatchProcessing() {
  // Step 1: Prepare questions (from file upload, database, etc.)
  const questions: Question[] = [
    {
      id: 'Q001',
      upload_id: 'BATCH_001',
      identifier: 'Q_001',
      stem: 'Question 1?',
      type: 'MCQ',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 'A',
      validation_status: 'Valid',
    },
    {
      id: 'Q002',
      upload_id: 'BATCH_001',
      identifier: 'Q_002',
      stem: 'Question 2?',
      type: 'MCQ',
      options: ['Yes', 'No', 'Maybe'],
      correct_answer: 'B',
      validation_status: 'Valid',
    },
  ];

  // Step 2: Pre-validate all questions before generation
  const validation = validateQuestionsForGeneration(questions);

  if (!validation.valid) {
    console.error('Validation errors found:');
    validation.errors.forEach((err) => console.error(`  - ${err}`));
    return;
  }

  // Step 3: Generate QTI for all questions
  const summary = await generateQTIForUpload(questions);

  // Step 4: Check summary
  console.log('Generation Summary:');
  console.log(`  Total: ${summary.total}`);
  console.log(`  Success: ${summary.success}`);
  console.log(`  Failed: ${summary.failed}`);

  if (summary.errors.length > 0) {
    console.log('Errors:');
    summary.errors.forEach((err) => {
      console.log(`  - ${err.questionId}: ${err.error.message}`);
    });
  }
}

/**
 * WORKFLOW 3: Using the Builder Directly
 * 
 * For advanced use cases where you need fine-grained control
 */
function quickStartBuilderPattern() {
  // Step 1: Create builder
  const builder = createMCQBuilder();

  // Step 2: Create question
  const question: Question = {
    id: 'Q001',
    upload_id: 'DIRECT_001',
    identifier: 'DIRECT_Q001',
    stem: 'Test question?',
    type: 'MCQ',
    options: ['Option 1', 'Option 2', 'Option 3'],
    correct_answer: 'A',
    validation_status: 'Valid',
  };

  // Step 3: Generate XML
  try {
    const xml = builder.generate(question);
    console.log('Generated XML:', xml);

    // Step 4: Validate XML
    const isValid = builder.validate(xml);
    console.log('XML is valid:', isValid);

    // Alternative: Get detailed validation errors
    const errors = validateXml(xml);
    if (errors.length > 0) {
      console.error('Validation errors:', errors);
    }
  } catch (error) {
    console.error('Generation failed:', error);
  }
}

/**
 * WORKFLOW 4: Error Handling
 * 
 * Demonstrates comprehensive error handling patterns
 */
function quickStartErrorHandling() {
  // Invalid questions that will fail
  const invalidQuestions: Question[] = [
    {
      id: 'ERR_001',
      upload_id: 'ERRORS',
      identifier: '', // Missing identifier
      stem: 'Test?',
      type: 'MCQ',
      options: ['A', 'B'],
      correct_answer: 'A',
      validation_status: 'Valid',
    },
    {
      id: 'ERR_002',
      upload_id: 'ERRORS',
      identifier: 'Q2',
      stem: 'Test?',
      type: 'MCQ',
      options: ['A'], // Too few options
      correct_answer: 'A',
      validation_status: 'Valid',
    },
    {
      id: 'ERR_003',
      upload_id: 'ERRORS',
      identifier: 'Q3',
      stem: 'Test?',
      type: 'MCQ',
      options: ['A', 'B'],
      correct_answer: 'Z', // Invalid answer
      validation_status: 'Valid',
    },
  ];

  console.log('Testing error handling:\n');

  invalidQuestions.forEach((question) => {
    const result = generateAndValidateMCQ(question);

    if ('error' in result) {
      console.log(`❌ ${question.identifier || 'Unknown'}`);
      console.log(`   Code: ${result.error.code}`);
      console.log(`   Message: ${result.error.message}\n`);
    }
  });
}

/**
 * WORKFLOW 5: XML Special Character Handling
 * 
 * Shows how special characters are automatically escaped
 */
function quickStartSpecialCharacters() {
  const question: Question = {
    id: 'Q_SPECIAL',
    upload_id: 'SPECIAL',
    identifier: 'Q_SPECIAL_001',
    stem: 'Which is true: A & B < C or A > B & "C" is false?',
    type: 'MCQ',
    options: [
      "Option with & ampersand",
      'Option with < less than',
      'Option with > greater than',
      'Option with " quote',
    ],
    correct_answer: 'A',
    validation_status: 'Valid',
  };

  const result = generateAndValidateMCQ(question);

  if ('error' in result) {
    console.error('Error:', result.error.message);
    return;
  }

  // Check that special characters are escaped
  console.log('Generated XML:');
  console.log(result.xml);

  // Verify escaping
  if (result.xml.includes('&amp;')) {
    console.log('✓ Ampersands properly escaped');
  }
  if (result.xml.includes('&lt;')) {
    console.log('✓ Less-than signs properly escaped');
  }
  if (result.xml.includes('&gt;')) {
    console.log('✓ Greater-than signs properly escaped');
  }
  if (result.xml.includes('&quot;')) {
    console.log('✓ Quotes properly escaped');
  }
}

/**
 * WORKFLOW 6: Integration with Application
 * 
 * Shows how to integrate QTI generation into your application flow
 */
function quickStartApplicationIntegration() {
  // Simulate receiving data from validation system
  const validatedData = {
    questionId: 'Q001',
    questionText: 'What is 2+2?',
    options: ['3', '4', '5', '6'],
    correctAnswer: 'B',
    validationStatus: 'Valid', // From ValidationReport
    detectedType: 'mcq', // From ValidationReport
  };

  // Convert to engine format
  const question: Question = {
    id: validatedData.questionId,
    upload_id: 'app-integration',
    identifier: validatedData.questionId,
    stem: validatedData.questionText,
    type: 'MCQ',
    options: validatedData.options,
    correct_answer: validatedData.correctAnswer,
    validation_status: validatedData.validationStatus as any,
  };

  // Generate QTI
  const result = generateAndValidateMCQ(question);

  if ('error' in result) {
    console.error('Failed to generate QTI:', result.error.message);
    // Send error to UI/database
    return {
      success: false,
      error: result.error,
    };
  }

  // Return successful generation
  return {
    success: true,
    xml: result.xml,
    questionId: question.id,
    size: result.xml.length,
  };
}

/**
 * MAIN: Run all workflows
 */
export function runQuickStart() {
  console.clear();
  console.log('╔═════════════════════════════════════════╗');
  console.log('║   QTI Engine - Quick Start Workflows    ║');
  console.log('╚═════════════════════════════════════════╝\n');

  console.log('📋 WORKFLOW 1: Single Question\n');
  quickStartSingleQuestion();

  console.log('\n📋 WORKFLOW 2: Batch Processing\n');
  quickStartBatchProcessing().catch(console.error);

  console.log('\n📋 WORKFLOW 3: Builder Pattern\n');
  quickStartBuilderPattern();

  console.log('\n📋 WORKFLOW 4: Error Handling\n');
  quickStartErrorHandling();

  console.log('\n📋 WORKFLOW 5: Special Characters\n');
  quickStartSpecialCharacters();

  console.log('\n📋 WORKFLOW 6: Application Integration\n');
  const result = quickStartApplicationIntegration();
  console.log('Result:', result);

  console.log('\n╔═════════════════════════════════════════╗');
  console.log('║        All Workflows Completed         ║');
  console.log('╚═════════════════════════════════════════╝\n');
}

// Uncomment to run:
// runQuickStart();
