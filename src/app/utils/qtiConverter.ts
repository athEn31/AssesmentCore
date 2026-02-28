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
  const question: QTIQuestion = {
    id: row.id || `q_${Date.now()}`,
    type: questionType,
    title: row[columnMapping.questionCol]?.substring(0, 100) || `Question ${row.id}`,
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
    const rawAnswer = (row[columnMapping.answerCol] as string).toUpperCase().trim();
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
    const answer = (row[columnMapping.answerCol] as string).toLowerCase().trim();
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
export function generateQTI21XML(question: QTIQuestion): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
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
    <div>
      <p>${escapeXml(question.questionText)}</p>`;

  if ((question.type === 'mcq' || question.type === 'truefalse') && question.options) {
    xml += `
      <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">`;
    question.options.forEach(option => {
      xml += `
        <simpleChoice identifier="${option.id}">${escapeXml(option.content)}</simpleChoice>`;
    });
    xml += `
      </choiceInteraction>`;
  } else if (question.type === 'shortanswer') {
    xml += `
      <textEntryInteraction responseIdentifier="RESPONSE" expectedLength="20" />`;
  }

  xml += `
    </div>`;

  if (question.explanation) {
    xml += `
    <feedbackBlock identifier="fb1" outcomeIdentifier="ANSWER_FEEDBACK" showHide="show">
      <p>${escapeXml(question.explanation)}</p>
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
export function generateQTI22XML(question: QTIQuestion): string {
  // Similar structure to QTI 2.1 with minor namespace differences
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
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
    <div>
      <p>${escapeXml(question.questionText)}</p>`;

  if ((question.type === 'mcq' || question.type === 'truefalse') && question.options) {
    xml += `
      <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">`;
    question.options.forEach(option => {
      xml += `
        <simpleChoice identifier="${option.id}">${escapeXml(option.content)}</simpleChoice>`;
    });
    xml += `
      </choiceInteraction>`;
  } else if (question.type === 'shortanswer') {
    xml += `
      <textEntryInteraction responseIdentifier="RESPONSE" expectedLength="20" />`;
  }

  xml += `
    </div>`;

  if (question.explanation) {
    xml += `
    <feedbackBlock identifier="fb1" outcomeIdentifier="ANSWER_FEEDBACK" showHide="show">
      <p>${escapeXml(question.explanation)}</p>
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
export function generateQTI(
  question: QTIQuestion,
  version: string = '2.1',
  format: 'xml' | 'json' = 'xml'
): QTIOutput {
  const output: QTIOutput = {
    version,
  };

  if (format === 'xml' || format === undefined) {
    if (version === '2.2') {
      output.xml = generateQTI22XML(question);
    } else {
      output.xml = generateQTI21XML(question);
    }
  } else if (format === 'json') {
    output.json = question;
  }

  return output;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  if (!text) return '';
  return text
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
