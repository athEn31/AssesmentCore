import { generateAndValidateTextEntry, Question } from './src/engine/index';

const testQuestion: Question = {
  id: 'text-001',
  upload_id: 'test',
  identifier: 'TEXT_Q1',
  stem: 'What is the chemical formula for water?',
  type: 'ShortAnswer',
  options: [],
  correct_answer: 'H2O',
  validation_status: 'Valid',
};

const result = generateAndValidateTextEntry(testQuestion);
if ('xml' in result) {
  console.log(result.xml);
} else {
  console.error('Error:', result.error);
}
