
import { convertToQTIQuestion } from './src/app/utils/qtiConverter';
import { stripMath } from './src/app/utils/mathmlConverter';

console.log("--- TITLE GENERATION TEST ---\n");

const columnMapping = {
  questionCol: 'QuestionText',
  titleCol: 'Title'
};

const testCases = [
  {
    row: { id: '1', QuestionText: 'What is $1/2$?', Title: 'Fraction Question' },
    desc: 'Using explicit title column'
  },
  {
    row: { id: '2', QuestionText: 'Evaluate $\\frac{a}{b}$' },
    desc: 'Fallback to question stem (stripping math)'
  },
  {
    row: { id: '3', QuestionText: 'Another questio with $ math $ and text' },
    desc: 'Stripping math from stem'
  }
];

testCases.forEach(tc => {
  console.log(`Test: ${tc.desc}`);
  const q = convertToQTIQuestion(tc.row, 'mcq', columnMapping);
  console.log(`Generated Title: "${q.title}"`);
  console.log('----------------------------\n');
});

console.log("Direct stripMath test:");
console.log(`"Solve $x^2 + y = 0$" -> "${stripMath("Solve $x^2 + y = 0$")}"`);
