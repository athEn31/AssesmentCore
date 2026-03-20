import { createTextEntryBuilder } from './src/engine/builders/qti21/textEntryBuilder';
import { Question } from './src/engine/types';

async function runTest() {
  const builder = createTextEntryBuilder();
  const q: Question = {
    id: "test-123", 
    upload_id: "upload_0",
    identifier: "test-123", 
    stem: "Solve this", 
    options: [], 
    correct_answer: "9.9", 
    type: "ShortAnswer", 
    validation_status: "Valid"
  };
  const xmlObj = await builder.build(q);
  console.log("=== XML OUTPUT ===");
  console.log(xmlObj.xml);
}

runTest().catch(console.error);
