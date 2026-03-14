
import { stripMath } from './src/app/utils/mathmlConverter';
console.log(`Input: "Evaluate $1/2$"`);
console.log(`Result: "${stripMath("Evaluate $1/2$")}"`);
console.log(`Input: "Solve $x^2 + y = 0$ now"`);
console.log(`Result: "${stripMath("Solve $x^2 + y = 0$ now")}"`);
