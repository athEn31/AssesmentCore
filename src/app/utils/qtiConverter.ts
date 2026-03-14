import { createQTIParaWithMath, createQTIChoiceWithMath, convertTextWithMath, stripMath } from './mathmlConverter';

export interface QTIQuestion {
  id: string;
  type: string;
  title: string;
  questionText: string;
  options?: Array<{
    id: string;
    label: string;
    content: string;
    correct?: boolean;
  }>;
  correctAnswer?: string;
  explanation?: string;
  points?: number;
  difficulty?: string;
  metadata?: Record<string, any>;
}

export interface QTIOutput {
  version: string;
  xml?: string;
  json?: any;
}

/**
 * Convert parsed question row to QTI question object
 */
export function convertToQTIQuestion(
  row: any,
  questionType: string,
  columnMapping: any
): QTIQuestion {
  // Determine title: 1. Use title col if exists, 2. Fallback to stripped question text
  let title = '';
  if (columnMapping.titleCol && row[columnMapping.titleCol]) {
    title = row[columnMapping.titleCol].toString();
  } else {
    const rawQuestion = row[columnMapping.questionCol] || '';
    title = stripMath(rawQuestion).substring(0, 100) || `Question ${row.id}`;
  }

  const question: QTIQuestion = {
    id: row.id || `q_${Date.now()}`,
    type: questionType,
    title,
    questionText: row[columnMapping.questionCol] || '',
    metadata: {},
  };

  // Extract metadata
  if (columnMapping.pointsCol && row[columnMapping.pointsCol]) {
    question.points = parseFloat(row[columnMapping.pointsCol]);
  }

  if (columnMapping.difficultyCol && row[columnMapping.difficultyCol]) {
    question.difficulty = row[columnMapping.difficultyCol];
  }

  if (columnMapping.solutionCol && row[columnMapping.solutionCol]) {
    question.explanation = row[columnMapping.solutionCol];
  }

  // Process based on type
  switch (questionType) {
    case 'mcq':
      processMCQQuestion(question, row, columnMapping);
      break;
    case 'truefalse':
      processTrueFalseQuestion(question, row, columnMapping);
      break;
    case 'shortanswer':
      processShortAnswerQuestion(question, row, columnMapping);
      break;
  }

  return question;
}

/**
 * Process MCQ question
 */
function processMCQQuestion(question: QTIQuestion, row: any, columnMapping: any): void {
  question.options = [];

  const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  columnMapping.optionCols.forEach((col: string, index: number) => {
    const content = row[col];
    if (content && index < optionLabels.length) {
      question.options!.push({
        id: optionLabels[index],
        label: `Option ${optionLabels[index]}`,
        content: content.toString(),
      });
    }
  });

  // Set correct answer
  if (columnMapping.answerCol && row[columnMapping.answerCol]) {
    const rawAnswer = String(row[columnMapping.answerCol]).toUpperCase().trim();
    const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    let correctId = '';

    if (optionLabels.includes(rawAnswer)) {
      correctId = rawAnswer;
    } else if (/^[1-8]$/.test(rawAnswer)) {
      correctId = optionLabels[parseInt(rawAnswer) - 1];
    }

    if (correctId) {
      question.correctAnswer = correctId;

      // Mark correct option
      if (question.options) {
        question.options.forEach(opt => {
          opt.correct = opt.id === correctId;
        });
      }
    }
  }
}

/**
 * Process True/False question
 */
function processTrueFalseQuestion(question: QTIQuestion, row: any, columnMapping: any): void {
  question.options = [
    { id: 'T', label: 'True', content: 'True' },
    { id: 'F', label: 'False', content: 'False' },
  ];

  if (columnMapping.answerCol && row[columnMapping.answerCol]) {
    const answer = String(row[columnMapping.answerCol]).toLowerCase().trim();
    const correctId = ['true', 't', 'yes', 'y'].includes(answer) ? 'T' : 'F';
    question.correctAnswer = correctId;
    question.options.forEach(opt => {
      opt.correct = opt.id === correctId;
    });
  }
}

/**
 * Process Short Answer question
 */
function processShortAnswerQuestion(question: QTIQuestion, row: any, columnMapping: any): void {
  if (columnMapping.answerCol && row[columnMapping.answerCol]) {
    question.correctAnswer = row[columnMapping.answerCol].toString();
  }
}

/**
 * Generate QTI 2.1 XML format
 */
export async function generateQTI21XML(question: QTIQuestion): Promise<string> {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:m="http://www.w3.org/1998/Math/MathML"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p1 http://www.imsglobal.org/xsd/qti/qtiv2p1/imsqti_v2p1.xsd"
  identifier="${question.id}"
  title="${escapeXml(question.title)}"
  adaptive="false"
  timeDependent="false">`;

  // Response declaration
  if (question.type === 'mcq' || question.type === 'truefalse') {
    xml += `
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>${question.correctAnswer}</value>
    </correctResponse>
  </responseDeclaration>`;
  } else if (question.type === 'shortanswer') {
    xml += `
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string">
    <correctResponse>
      <value>${escapeXml(question.correctAnswer || '')}</value>
    </correctResponse>
  </responseDeclaration>`;
  } else {
    // Fallback: if type is not recognized but we have a correct answer, treat as text entry
    if (question.correctAnswer) {
      xml += `
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string">
    <correctResponse>
      <value>${escapeXml(question.correctAnswer)}</value>
    </correctResponse>
  </responseDeclaration>`;
    }
  }

  // Outcome declaration
  xml += `
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0</value>
    </defaultValue>
  </outcomeDeclaration>`;

  // Item body
  xml += `
  <itemBody>
    <div>`;

  // Add question text — always use MathML-safe conversion
  const questionContent = convertTextWithMath(question.questionText);
  xml += `
      <p>${questionContent}</p>`;

  if ((question.type === 'mcq' || question.type === 'truefalse') && question.options) {
    xml += `
      <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">`;
    for (const option of question.options) {
      // Always convert option content for MathML safety
      const optionContent = convertTextWithMath(option.content);
      xml += `
        <simpleChoice identifier="${option.id}">${optionContent}</simpleChoice>`;
    }
    xml += `
      </choiceInteraction>`;
  } else if (question.type === 'shortanswer' || !question.options) {
    // Text entry for shortanswer type or if no options (fallback)
    const answerLength = question.correctAnswer?.length || 20;
    const expectedLength = Math.max(20, Math.min(answerLength + 10, 500));
    xml += `
      <textEntryInteraction responseIdentifier="RESPONSE" expectedLength="${expectedLength}">
        <prompt>Enter your answer:</prompt>
      </textEntryInteraction>`;
  }

  xml += `
    </div>`;

  // Add explanation — always use MathML-safe conversion
  if (question.explanation) {
    const explanationContent = convertTextWithMath(question.explanation);
    xml += `
    <feedbackBlock identifier="fb1" outcomeIdentifier="ANSWER_FEEDBACK" showHide="show">
      <p>${explanationContent}</p>
    </feedbackBlock>`;
  }

  xml += `
  </itemBody>

  <responseProcessing template="http://www.imsglobal.org/xsd/imsqti_v2p1/imsqti_v2p1_outcomes_v1p0.xml" />
</assessmentItem>`;

  return xml;
}

/**
 * Generate QTI 2.2 XML format
 */
export async function generateQTI22XML(question: QTIQuestion): Promise<string> {
  // Similar structure to QTI 2.1 with minor namespace differences
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:m="http://www.w3.org/1998/Math/MathML"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
  identifier="${question.id}"
  title="${escapeXml(question.title)}"
  adaptive="false"
  timeDependent="false">`;

  // Response declaration
  if (question.type === 'mcq' || question.type === 'truefalse') {
    xml += `
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>${question.correctAnswer}</value>
    </correctResponse>
  </responseDeclaration>`;
  } else if (question.type === 'shortanswer') {
    xml += `
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string">
    <correctResponse>
      <value>${escapeXml(question.correctAnswer || '')}</value>
    </correctResponse>
  </responseDeclaration>`;
  } else {
    // Fallback: if type is not recognized but we have a correct answer, treat as text entry
    if (question.correctAnswer) {
      xml += `
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string">
    <correctResponse>
      <value>${escapeXml(question.correctAnswer)}</value>
    </correctResponse>
  </responseDeclaration>`;
    }
  }

  // Outcome declaration
  xml += `
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>${question.points || 1}</value>
    </defaultValue>
  </outcomeDeclaration>`;

  // Item body
  xml += `
  <itemBody>
    <div>`;

  // Add question text — always use MathML-safe conversion
  const questionContent22 = convertTextWithMath(question.questionText);
  xml += `
      <p>${questionContent22}</p>`;

  if ((question.type === 'mcq' || question.type === 'truefalse') && question.options) {
    xml += `
      <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">`;
    for (const option of question.options) {
      // Always convert option content for MathML safety
      const optionContent = convertTextWithMath(option.content);
      xml += `
        <simpleChoice identifier="${option.id}">${optionContent}</simpleChoice>`;
    }
    xml += `
      </choiceInteraction>`;
  } else if (question.type === 'shortanswer' || !question.options) {
    // Text entry for shortanswer type or if no options (fallback)
    const answerLength = question.correctAnswer?.length || 20;
    const expectedLength = Math.max(20, Math.min(answerLength + 10, 500));
    xml += `
      <textEntryInteraction responseIdentifier="RESPONSE" expectedLength="${expectedLength}">
        <prompt>Enter your answer:</prompt>
      </textEntryInteraction>`;
  }

  xml += `
    </div>`;

  // Add explanation — always use MathML-safe conversion
  if (question.explanation) {
    const explanationContent22 = convertTextWithMath(question.explanation);
    xml += `
    <feedbackBlock identifier="fb1" outcomeIdentifier="ANSWER_FEEDBACK" showHide="show">
      <p>${explanationContent22}</p>
    </feedbackBlock>`;
  }

  xml += `
  </itemBody>

  <responseProcessing template="http://www.imsglobal.org/xsd/imsqti_v2p2/imsqti_v2p2_outcomes_v2p0.xml" />
</assessmentItem>`;

  return xml;
}

/**
 * Generate QTI output in requested format
 */
export async function generateQTI(
  question: QTIQuestion,
  version: string = '2.1',
  format: 'xml' | 'json' = 'xml'
): Promise<QTIOutput> {
  const output: QTIOutput = {
    version,
  };

  if (format === 'xml' || format === undefined) {
    if (version === '2.2') {
      output.xml = await generateQTI22XML(question);
    } else {
      output.xml = await generateQTI21XML(question);
    }
  } else if (format === 'json') {
    output.json = question;
  }

  return output;
}


/**
 * Escape XML special characters
 */
export function escapeXml(text: string): string {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate JSON output for all questions
 */
export function generateJSON(questions: QTIQuestion[]): any {
  return {
    version: '1.0',
    questions: questions.map(q => ({
      id: q.id,
      type: q.type,
      title: q.title,
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      points: q.points,
      difficulty: q.difficulty,
      metadata: q.metadata,
    })),
  };
}
