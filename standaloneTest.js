
function stripMath(text) {
  if (!text) return '';
  let clean = text.replace(/\$\$[\s\S]*?\$\$/g, '');
  clean = clean.replace(/\\\[[\s\S]*?\\\]/g, '');
  clean = clean.replace(/\\\([\s\S]*?\\\)/g, '');
  clean = clean.replace(/\$[^$\n]+\$/g, '');
  clean = clean.replace(/<math[^>]*>[\s\S]*?<\/math>/g, '');
  return clean.replace(/\s+/g, ' ').trim();
}

const testCases = [
  { input: "What is $1/2$?", expected: "What is ?" },
  { input: "Evaluate $\\frac{a}{b}$ and solve", expected: "Evaluate and solve" },
  { input: "Normal text", expected: "Normal text" },
  { input: "Mixed with <math>...</math> tag", expected: "Mixed with tag" }
];

testCases.forEach(tc => {
  const result = stripMath(tc.input);
  console.log(`Input: "${tc.input}"`);
  console.log(`Result: "${result}"`);
  console.log(result.includes('$') || result.includes('<math>') ? "FAIL" : "PASS");
  console.log('---');
});
