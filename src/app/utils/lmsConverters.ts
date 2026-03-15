/**
 * LMS (Learning Management System) format converters
 * Converts validated question data to various LMS-specific formats
 *
 * Column mapping shape from BatchCreator:
 *   questionCol  – column name for question text
 *   answerCol    – column name for correct answer
 *   optionCols   – string[] of column names for options (e.g. ["Option A","Option B",…])
 *   solutionCol  – column name for explanation / feedback
 *   typeCol      – column name for question type
 *   pointsCol    – column name for grade/points
 */

// ---------------------------------------------------------------------------
// Helper: read a value from a row using a column name
// ---------------------------------------------------------------------------
function col(row: any, colName: string | undefined): string {
  if (!colName) return "";
  const val = row[colName];
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

// ---------------------------------------------------------------------------
// Moodle XML
// ---------------------------------------------------------------------------

/**
 * Converts questions to Moodle XML format
 */
export function convertToMoodleXML(
  editedRows: any[],
  columnMapping: any,
  validationResults: Map<string, any>
): string {
  // Filter out rejected questions
  const validQuestions = editedRows.filter(
    (row) => validationResults.get(row.id)?.status !== "rejected"
  );

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += "<quiz>\n\n";

  validQuestions.forEach((question, index) => {
    const questionNumber = index + 1;
    const questionType = detectQuestionType(question, columnMapping);

    if (questionType === "MCQ" || questionType === "MSQ") {
      xml += buildMoodleMultiChoice(question, columnMapping, questionType, questionNumber);
    } else if (questionType === "ESSAY") {
      xml += buildMoodleEssay(question, columnMapping, questionNumber);
    } else {
      xml += buildMoodleShortAnswer(question, columnMapping, questionNumber);
    }
  });

  xml += "</quiz>\n";
  return xml;
}

/**
 * Builds Moodle multiple-choice question
 */
function buildMoodleMultiChoice(
  question: any,
  columnMapping: any,
  questionType: string,
  questionNumber: number
): string {
  const questionText = col(question, columnMapping.questionCol);
  const correctAnswer = col(question, columnMapping.answerCol);
  const explanation = col(question, columnMapping.solutionCol);
  const points = col(question, columnMapping.pointsCol) || "1";

  // Gather option values from optionCols array
  const optionCols: string[] = columnMapping.optionCols || [];
  const options = optionCols.map((c: string) => col(question, c)).filter(Boolean);

  // Figure out which option index is correct
  const answerIndex = getAnswerIndex(correctAnswer, options);

  const isSingle = questionType !== "MSQ";
  const nameText = questionText ? questionText.substring(0, 80) : `Question ${questionNumber}`;

  let xml = '  <question type="multichoice">\n';
  xml += `    <name>\n      <text>${escapeXML(nameText)}</text>\n    </name>\n`;
  xml += `    <questiontext format="html">\n      <text><![CDATA[${questionText}]]></text>\n    </questiontext>\n`;
  xml += `    <generalfeedback format="html">\n      <text><![CDATA[${explanation}]]></text>\n    </generalfeedback>\n`;
  xml += `    <defaultgrade>${escapeXML(points)}</defaultgrade>\n`;
  xml += `    <penalty>0.3333333</penalty>\n`;
  xml += `    <hidden>0</hidden>\n`;
  xml += `    <single>${isSingle ? "true" : "false"}</single>\n`;
  xml += `    <shuffleanswers>0</shuffleanswers>\n`;
  xml += `    <answernumbering>abc</answernumbering>\n`;
  xml += `    <correctfeedback format="html">\n      <text><![CDATA[Correct]]></text>\n    </correctfeedback>\n`;
  xml += `    <partiallycorrectfeedback format="html">\n      <text><![CDATA[Partially correct]]></text>\n    </partiallycorrectfeedback>\n`;
  xml += `    <incorrectfeedback format="html">\n      <text><![CDATA[Incorrect]]></text>\n    </incorrectfeedback>\n`;
  xml += `    <showstandardinstruction>0</showstandardinstruction>\n`;

  options.forEach((optText, idx) => {
    const isCorrect = idx === answerIndex;
    const fraction = isCorrect ? "100" : "0";
    xml += `    <answer fraction="${fraction}" format="html">\n`;
    xml += `      <text><![CDATA[${optText}]]></text>\n`;
    xml += `      <feedback format="html">\n        <text><![CDATA[${isCorrect ? "Correct" : ""}]]></text>\n      </feedback>\n`;
    xml += `    </answer>\n`;
  });

  xml += "  </question>\n\n";
  return xml;
}

/**
 * Builds Moodle essay question
 */
function buildMoodleEssay(
  question: any,
  columnMapping: any,
  questionNumber: number
): string {
  const questionText = col(question, columnMapping.questionCol);
  const explanation = col(question, columnMapping.solutionCol);
  const points = col(question, columnMapping.pointsCol) || "1";
  const nameText = questionText ? questionText.substring(0, 80) : `Question ${questionNumber}`;

  let xml = '  <question type="essay">\n';
  xml += `    <name>\n      <text>${escapeXML(nameText)}</text>\n    </name>\n`;
  xml += `    <questiontext format="html">\n      <text><![CDATA[${questionText}]]></text>\n    </questiontext>\n`;
  xml += `    <generalfeedback format="html">\n      <text><![CDATA[${explanation}]]></text>\n    </generalfeedback>\n`;
  xml += `    <defaultgrade>${escapeXML(points)}</defaultgrade>\n`;
  xml += `    <responseformat>editor</responseformat>\n`;
  xml += `    <responserequired>1</responserequired>\n`;
  xml += `    <responsefieldlines>15</responsefieldlines>\n`;
  xml += `    <attachments>0</attachments>\n`;

  if (explanation) {
    xml += `    <graderinfo format="html">\n      <text><![CDATA[${explanation}]]></text>\n    </graderinfo>\n`;
  }

  xml += "  </question>\n\n";
  return xml;
}

/**
 * Builds Moodle short-answer question
 */
function buildMoodleShortAnswer(
  question: any,
  columnMapping: any,
  questionNumber: number
): string {
  const questionText = col(question, columnMapping.questionCol);
  const correctAnswer = col(question, columnMapping.answerCol);
  const explanation = col(question, columnMapping.solutionCol);
  const points = col(question, columnMapping.pointsCol) || "1";
  const nameText = questionText ? questionText.substring(0, 80) : `Question ${questionNumber}`;

  let xml = '  <question type="shortanswer">\n';
  xml += `    <name>\n      <text>${escapeXML(nameText)}</text>\n    </name>\n`;
  xml += `    <questiontext format="html">\n      <text><![CDATA[${questionText}]]></text>\n    </questiontext>\n`;
  xml += `    <generalfeedback format="html">\n      <text><![CDATA[${explanation}]]></text>\n    </generalfeedback>\n`;
  xml += `    <defaultgrade>${escapeXML(points)}</defaultgrade>\n`;
  xml += `    <penalty>0.3333333</penalty>\n`;
  xml += `    <hidden>0</hidden>\n`;
  xml += `    <usecase>0</usecase>\n`;
  xml += `    <answer fraction="100" format="moodle_auto_format">\n`;
  xml += `      <text><![CDATA[${correctAnswer}]]></text>\n`;
  xml += `      <feedback format="html">\n        <text><![CDATA[Correct]]></text>\n      </feedback>\n`;
  xml += `    </answer>\n`;

  xml += "  </question>\n\n";
  return xml;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Detects question type from the row data using the column mapping.
 * Uses validation results' detectedType when available, otherwise
 * checks whether options are present.
 */
function detectQuestionType(question: any, columnMapping: any): string {
  // Check if optionCols exist and have non-empty values in this row
  const optionCols: string[] = columnMapping.optionCols || [];
  const filledOptions = optionCols.filter((c: string) => col(question, c) !== "");

  if (filledOptions.length >= 2) {
    const correctAnswer = col(question, columnMapping.answerCol);
    // Multiple correct answers → MSQ
    if (correctAnswer.includes(",") || correctAnswer.includes(";")) {
      return "MSQ";
    }
    return "MCQ";
  }

  // If a correct answer is supplied but there are no options → short answer
  const answer = col(question, columnMapping.answerCol);
  if (answer) {
    return "SHORT_ANSWER";
  }

  return "ESSAY";
}

/**
 * Resolves the correct-answer value to a 0-based option index.
 * Accepts letter (A-H), number (1-8), or the full option text.
 */
function getAnswerIndex(answer: string, options: string[]): number {
  if (!answer) return 0;
  const normalized = String(answer).toUpperCase().trim();

  // Single letter A-H
  if (/^[A-H]$/.test(normalized)) {
    return normalized.charCodeAt(0) - 65; // A=0, B=1 …
  }
  // Single digit 1-8
  if (/^[1-8]$/.test(normalized)) {
    return parseInt(normalized, 10) - 1;
  }
  // Full-text match
  const idx = options.findIndex(
    (o) => String(o).toLowerCase().trim() === String(answer).toLowerCase().trim()
  );
  if (idx !== -1) return idx;

  return 0; // default to first option
}

/**
 * Escapes XML special characters (used only in <name> and attribute values;
 * question body uses CDATA sections instead).
 */
export function escapeXML(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Converts questions to QTI 2.1 format (generic format for Canvas, etc.)
 * Placeholder for future implementation
 */
export function convertToQTI21(
  editedRows: any[],
  columnMapping: any,
  validationResults: Map<string, any>
): string {
  // TODO: Implement QTI 2.1 conversion
  console.warn("QTI 2.1 conversion not yet implemented");
  return "";
}

/**
 * Converts questions to Canvas format
 * Placeholder for future implementation
 */
export function convertToCanvas(
  editedRows: any[],
  columnMapping: any,
  validationResults: Map<string, any>
): string {
  const validQuestions = editedRows.filter(
    (row) => validationResults.get(row.id)?.status !== "rejected"
  );

  const assessmentId = `assessment_${Date.now()}`;

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<questestinterop>\n';
  xml += `  <assessment ident="${assessmentId}" title="Canvas Question Export">\n`;
  xml += '    <section ident="root_section">\n';

  validQuestions.forEach((question, index) => {
    const itemId = `item_${index + 1}`;
    const questionText = col(question, columnMapping.questionCol);
    const correctAnswer = col(question, columnMapping.answerCol);
    const explanation = col(question, columnMapping.solutionCol);
    const points = col(question, columnMapping.pointsCol) || "1";
    const detectedType = detectQuestionType(question, columnMapping);

    xml += `      <item ident="${escapeXML(itemId)}" title="${escapeXML(
      questionText.substring(0, 80) || `Question ${index + 1}`
    )}">\n`;
    xml += '        <itemmetadata>\n';
    xml += '          <qtimetadata>\n';
    xml += `            <qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${escapeXML(points)}</fieldentry></qtimetadatafield>\n`;
    xml += '          </qtimetadata>\n';
    xml += '        </itemmetadata>\n';
    xml += '        <presentation>\n';
    xml += `          <material><mattext texttype="text/html"><![CDATA[${questionText}]]></mattext></material>\n`;

    if (detectedType === "MCQ" || detectedType === "MSQ") {
      const optionCols: string[] = columnMapping.optionCols || [];
      const options = optionCols.map((c: string) => col(question, c)).filter(Boolean);
      const answerIndex = getAnswerIndex(correctAnswer, options);

      xml += '          <response_lid ident="response1" rcardinality="Single">\n';
      xml += '            <render_choice>\n';
      options.forEach((optText, optIdx) => {
        const optIdent = `opt_${String.fromCharCode(65 + optIdx)}`;
        xml += `              <response_label ident="${optIdent}">\n`;
        xml += `                <material><mattext texttype="text/plain"><![CDATA[${optText}]]></mattext></material>\n`;
        xml += '              </response_label>\n';
      });
      xml += '            </render_choice>\n';
      xml += '          </response_lid>\n';

      const correctOptIdent = `opt_${String.fromCharCode(65 + answerIndex)}`;
      xml += '        </presentation>\n';
      xml += '        <resprocessing>\n';
      xml += '          <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>\n';
      xml += '          <respcondition continue="No">\n';
      xml += '            <conditionvar>\n';
      xml += `              <varequal respident="response1">${correctOptIdent}</varequal>\n`;
      xml += '            </conditionvar>\n';
      xml += '            <setvar action="Set" varname="SCORE">100</setvar>\n';
      xml += '          </respcondition>\n';
      xml += '        </resprocessing>\n';
    } else {
      xml += '          <response_str ident="response1" rcardinality="Single">\n';
      xml += '            <render_fib fibtype="String" prompt="Box" />\n';
      xml += '          </response_str>\n';
      xml += '        </presentation>\n';
      xml += '        <resprocessing>\n';
      xml += '          <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>\n';
      xml += '          <respcondition continue="No">\n';
      xml += '            <conditionvar>\n';
      xml += `              <varequal respident="response1">${escapeXML(correctAnswer)}</varequal>\n`;
      xml += '            </conditionvar>\n';
      xml += '            <setvar action="Set" varname="SCORE">100</setvar>\n';
      xml += '          </respcondition>\n';
      xml += '        </resprocessing>\n';
    }

    if (explanation) {
      xml += '        <itemfeedback ident="general_fb">\n';
      xml += `          <material><mattext texttype="text/html"><![CDATA[${explanation}]]></mattext></material>\n`;
      xml += '        </itemfeedback>\n';
    }

    xml += '      </item>\n';
  });

  xml += '    </section>\n';
  xml += '  </assessment>\n';
  xml += '</questestinterop>\n';

  return xml;
}

/**
 * Converts questions to Blackboard format
 * Placeholder for future implementation
 */
export function convertToBlackboard(
  editedRows: any[],
  columnMapping: any,
  validationResults: Map<string, any>
): string {
  // TODO: Implement Blackboard conversion
  console.warn("Blackboard conversion not yet implemented");
  return "";
}

/**
 * Converts questions to D2L Brightspace format
 * Placeholder for future implementation
 */
export function convertToD2L(
  editedRows: any[],
  columnMapping: any,
  validationResults: Map<string, any>
): string {
  // TODO: Implement D2L conversion
  console.warn("D2L conversion not yet implemented");
  return "";
}

/**
 * Converts questions to SCORM format
 * Placeholder for future implementation
 */
export function convertToSCORM(
  editedRows: any[],
  columnMapping: any,
  validationResults: Map<string, any>
): string {
  // TODO: Implement SCORM conversion
  console.warn("SCORM conversion not yet implemented");
  return "";
}
