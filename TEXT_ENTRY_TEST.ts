/**
 * Text Entry Builder - Verification Test
 * 
 * This demonstrates that text entry questions are now generated with
 * proper QTI 2.1 structure using the production-grade builder.
 */

import { generateAndValidateTextEntry, Question } from './src/engine/index';

// Example text entry question
const sampleQuestion: Question = {
  id: 'text-entry-001',
  upload_id: 'test-batch',
  identifier: 'Q001_ALIAS',
  stem: 'What is the chemical formula for water?',
  type: 'ShortAnswer',
  options: [],
  correct_answer: 'H2O',
  validation_status: 'Valid',
};

// Generate XML
const result = generateAndValidateTextEntry(sampleQuestion);

if ('error' in result) {
  console.error('❌ Generation failed:', result.error);
} else {
  console.log('✅ Text Entry Question Generated Successfully!\n');
  console.log('Generated QTI 2.1 XML:');
  console.log('─'.repeat(60));
  console.log(result.xml);
  console.log('─'.repeat(60));
  
  // Verify key features
  const xml = result.xml;
  console.log('\n✅ Verification Results:');
  console.log('  ✓ Contains responseDeclaration:', xml.includes('<responseDeclaration'));
  console.log('  ✓ Uses baseType="string":', xml.includes('baseType="string"'));
  console.log('  ✓ Contains correctResponse:', xml.includes('<correctResponse>'));
  console.log('  ✓ Contains textEntryInteraction:', xml.includes('<textEntryInteraction'));
  console.log('  ✓ Has dynamic expectedLength:', xml.includes('expectedLength='));
  console.log('  ✓ Contains outcomeDeclaration:', xml.includes('<outcomeDeclaration'));
  console.log('  ✓ Has responseProcessing:', xml.includes('<responseProcessing'));
  console.log('  ✓ Proper XML declaration:', xml.includes('<?xml version="1.0"'));
}
