
import { convertTextWithMath } from './src/app/utils/mathmlConverter';

const testCases = [
  "Evaluate $1/2 + 3/4$",
  "Solve $x^2 + y_1 = 0$",
  "Matrix: $\\begin{matrix} 1 & 2 \\\\ 3 & 4 \\end{matrix}$",
  "Inline: \\( a^2 + b^2 = c^2 \\)"
];

console.log("--- MATHML REFRACTOR TEST ---\n");

testCases.forEach(input => {
  console.log(`Input: ${input}`);
  const output = convertTextWithMath(input);
  console.log(`Output:\n${output}\n`);
  
  if (output.includes('m:')) {
    console.error("FAIL: Contains m: prefix");
  } else if (!output.includes('xmlns="http://www.w3.org/1998/Math/MathML"')) {
    console.error("FAIL: Missing default namespace");
  } else if (output.includes('<semantics>') || output.includes('<annotation>')) {
    console.error("FAIL: Contains semantics or annotation");
  } else {
    console.log("PASS!");
  }
  console.log("----------------------------\n");
});
