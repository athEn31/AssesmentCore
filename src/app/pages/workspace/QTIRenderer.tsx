import { useState, useRef } from "react";
import { Upload, Play, Download, FileJson, AlertCircle, CheckCircle2, Code, FileText } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Textarea } from "../../components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ParsedChoice {
  identifier: string;
  content: string;
}

interface ParsedQuestion {
  identifier: string;
  title: string;
  type: 'mcq' | 'textentry';
  stem: string;
  choices?: ParsedChoice[];
  correctAnswer?: string;
  correctAnswers?: string[];  // for text entry (could have multiple)
  feedbackText?: string;  // generic feedback (backward compat)
  correctFeedback?: string;  // feedback for correct answer
  incorrectFeedback?: string;  // feedback for incorrect answer
}

// ── QTI XML Parser ─────────────────────────────────────────────────────────────

function parseQTIXml(xmlString: string): ParsedQuestion[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString.trim(), 'application/xml');

  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid XML: ' + parseError.textContent);
  }

  const questions: ParsedQuestion[] = [];

  // Support both standard QTI and QTI 3.0 ASI formats
  let items = doc.querySelectorAll('assessmentItem');
  if (items.length === 0) {
    items = doc.querySelectorAll('qti-assessment-item');
  }

  // If no assessmentItem found, treat the root as one
  const itemsToProcess = items.length > 0 ? Array.from(items) : [doc.documentElement];

  for (const item of itemsToProcess) {
    if (item.tagName === 'parsererror') continue;

    // Support both camelCase and kebab-case attributes
    const identifier = item.getAttribute('identifier') || 'unknown';
    const title = item.getAttribute('title') || 'Untitled Question';

    // Determine question type by looking at interactions (support both formats)
    let choiceInteraction = item.querySelector('choiceInteraction');
    if (!choiceInteraction) {
      choiceInteraction = item.querySelector('qti-choice-interaction');
    }

    let textEntryInteraction = item.querySelector('textEntryInteraction');
    if (!textEntryInteraction) {
      textEntryInteraction = item.querySelector('qti-text-entry-interaction');
    }

    if (choiceInteraction) {
      // ── MCQ ──
      let prompt = choiceInteraction.querySelector('prompt');
      if (!prompt) {
        prompt = choiceInteraction.querySelector('qti-prompt');
      }

      let itemBody = item.querySelector('itemBody');
      if (!itemBody) {
        itemBody = item.querySelector('qti-item-body');
      }

      // Get stem: either from <prompt> or from <p> inside itemBody
      let stem = '';
      if (prompt) {
        stem = prompt.textContent?.trim() || '';
      } else if (itemBody) {
        const pTags = itemBody.querySelectorAll('p, qti-content-body > *');
        for (const p of Array.from(pTags)) {
          // Skip feedback blocks
          if (!p.closest('feedbackBlock') && !p.closest('qti-modal-feedback')) {
            const text = p.textContent?.trim() || '';
            if (text) {
              stem += (stem ? '\n' : '') + text;
            }
          }
        }
      }

      // Get choices (support both formats)
      let simpleChoices = choiceInteraction.querySelectorAll('simpleChoice');
      if (simpleChoices.length === 0) {
        simpleChoices = choiceInteraction.querySelectorAll('qti-simple-choice');
      }

      const choices: ParsedChoice[] = Array.from(simpleChoices).map(choice => ({
        identifier: choice.getAttribute('identifier') || '',
        content: choice.textContent?.trim() || '',
      }));

      // Get correct answer from responseDeclaration (support both formats)
      let correctAnswer = '';
      let responseDecl = item.querySelector('responseDeclaration');
      if (!responseDecl) {
        responseDecl = item.querySelector('qti-response-declaration');
      }

      if (responseDecl) {
        let correctValue = responseDecl.querySelector('correctResponse > value');
        if (!correctValue) {
          correctValue = responseDecl.querySelector('qti-correct-response > qti-value');
        }
        if (correctValue) {
          correctAnswer = correctValue.textContent?.trim() || '';
        }
      }

      // Get feedback (support both formats and separate CORRECT/INCORRECT)
      let feedbackText = '';
      let correctFeedback = '';
      let incorrectFeedback = '';

      // Try to get modal feedbacks with identifiers
      const allFeedbacks = itemBody?.querySelectorAll('feedbackBlock, qti-modal-feedback') || [];
      for (const fb of Array.from(allFeedbacks)) {
        const identifier = fb.getAttribute('identifier') || '';
        const text = fb.textContent?.trim() || '';
        
        if (identifier.toLowerCase().includes('correct') || identifier === 'CORRECT') {
          correctFeedback = text;
        } else if (identifier.toLowerCase().includes('incorrect') || identifier === 'INCORRECT') {
          incorrectFeedback = text;
        } else if (!feedbackText) {
          // Generic feedback fallback
          feedbackText = text;
        }
      }

      // Fallback to first feedback if no specific ones found
      if (!feedbackText && !correctFeedback && !incorrectFeedback) {
        const feedback = item.querySelector('feedbackBlock, qti-modal-feedback');
        if (feedback) {
          feedbackText = feedback.textContent?.trim() || '';
        }
      }

      questions.push({
        identifier,
        title,
        type: 'mcq',
        stem,
        choices,
        correctAnswer,
        feedbackText,
        correctFeedback,
        incorrectFeedback,
      });

    } else if (textEntryInteraction) {
      // ── Text Entry ──
      let itemBody = item.querySelector('itemBody');
      if (!itemBody) {
        itemBody = item.querySelector('qti-item-body');
      }

      let stem = '';
      if (itemBody) {
        // Extract text content before the interaction
        const allText = itemBody.textContent?.trim() || '';
        // Get text nodes and p tags, excluding feedback
        const pTags = itemBody.querySelectorAll('p, qti-content-body > *');
        for (const p of Array.from(pTags)) {
          if (!p.closest('feedbackBlock') && !p.closest('qti-modal-feedback')) {
            const text = p.textContent?.trim() || '';
            if (text) {
              stem += (stem ? '\n' : '') + text;
            }
          }
        }
        // Fallback: if no p tags found, use text before interaction
        if (!stem) {
          const textNodes = Array.from(itemBody.childNodes)
            .filter(node => node.nodeType === 3) // Text nodes
            .map(node => node.textContent?.trim())
            .filter(text => text && text.length > 0);
          stem = textNodes.join(' ');
        }
      }

      // Get correct answer(s) from responseDeclaration (support both formats)
      const correctAnswers: string[] = [];
      let responseDecl = item.querySelector('responseDeclaration');
      if (!responseDecl) {
        responseDecl = item.querySelector('qti-response-declaration');
      }

      if (responseDecl) {
        let values = responseDecl.querySelectorAll('correctResponse > value');
        if (values.length === 0) {
          values = responseDecl.querySelectorAll('qti-correct-response > qti-value');
        }
        values.forEach(v => {
          const text = v.textContent?.trim();
          if (text) correctAnswers.push(text);
        });
      }

      let feedbackText = '';
      let correctFeedback = '';
      let incorrectFeedback = '';

      // Try to get modal feedbacks with identifiers
      const allFeedbacks = itemBody?.querySelectorAll('feedbackBlock, qti-modal-feedback') || [];
      for (const fb of Array.from(allFeedbacks)) {
        const identifier = fb.getAttribute('identifier') || '';
        const text = fb.textContent?.trim() || '';
        
        if (identifier.toLowerCase().includes('correct') || identifier === 'CORRECT') {
          correctFeedback = text;
        } else if (identifier.toLowerCase().includes('incorrect') || identifier === 'INCORRECT') {
          incorrectFeedback = text;
        } else if (!feedbackText) {
          // Generic feedback fallback
          feedbackText = text;
        }
      }

      // Fallback to first feedback if no specific ones found
      if (!feedbackText && !correctFeedback && !incorrectFeedback) {
        const feedback = item.querySelector('feedbackBlock, qti-modal-feedback');
        if (feedback) {
          feedbackText = feedback.textContent?.trim() || '';
        }
      }

      questions.push({
        identifier,
        title,
        type: 'textentry',
        stem,
        correctAnswers,
        feedbackText,
        correctFeedback,
        incorrectFeedback,
      });
    }
  }

  return questions;
}

// ── MCQ Renderer Component ─────────────────────────────────────────────────────

function MCQRenderer({ question }: { question: ParsedQuestion }) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const handleCheck = () => {
    if (selectedAnswer) setShowResult(true);
  };

  const handleReset = () => {
    setSelectedAnswer(null);
    setShowResult(false);
  };

  const isCorrect = selectedAnswer === question.correctAnswer;

  return (
    <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="inline-block px-3 py-1 bg-[#E0F2FE] text-[#0F6CBD] rounded-full text-xs font-semibold">
          MCQ
        </span>
        <span className="text-xs text-[#94A3B8]">{question.identifier}</span>
      </div>

      <h3 className="text-lg font-semibold text-[#111827] mb-5">{question.stem}</h3>

      <div className="space-y-2">
        {question.choices?.map((choice) => {
          const isSelected = selectedAnswer === choice.identifier;
          const isCorrectChoice = choice.identifier === question.correctAnswer;

          let borderClass = 'border-[#E2E8F0] hover:border-[#0F6CBD] hover:bg-[#F8FAFC]';
          if (showResult && isCorrectChoice) {
            borderClass = 'border-[#16A34A] bg-[#F0FDF4]';
          } else if (showResult && isSelected && !isCorrectChoice) {
            borderClass = 'border-[#DC2626] bg-[#FEF2F2]';
          } else if (isSelected && !showResult) {
            borderClass = 'border-[#0F6CBD] bg-[#E0F2FE]';
          }

          return (
            <label
              key={choice.identifier}
              className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${borderClass}`}
            >
              <input
                type="radio"
                name={`answer-${question.identifier}`}
                className="w-4 h-4 accent-[#0F6CBD]"
                checked={isSelected}
                onChange={() => {
                  if (!showResult) {
                    setSelectedAnswer(choice.identifier);
                  }
                }}
                disabled={showResult}
              />
              <span className="font-medium text-[#475569] min-w-[20px]">{choice.identifier}.</span>
              <span className="text-[#111827] flex-1">{choice.content}</span>
              {showResult && isCorrectChoice && (
                <CheckCircle2 className="w-5 h-5 text-[#16A34A] flex-shrink-0" />
              )}
              {showResult && isSelected && !isCorrectChoice && (
                <AlertCircle className="w-5 h-5 text-[#DC2626] flex-shrink-0" />
              )}
            </label>
          );
        })}
      </div>

      <div className="mt-5 flex gap-2">
        <Button
          onClick={handleCheck}
          disabled={!selectedAnswer || showResult}
          className="bg-[#0F6CBD] hover:bg-[#0B5A9A] text-white rounded-md"
        >
          Check Answer
        </Button>
        {showResult && (
          <Button variant="outline" onClick={handleReset} className="border-[#E2E8F0] rounded-md">
            Try Again
          </Button>
        )}
      </div>

      {showResult && (
        <div className={`mt-4 p-3 rounded-lg ${isCorrect ? 'bg-[#F0FDF4] text-[#166534]' : 'bg-[#FEF2F2] text-[#991B1B]'}`}>
          <p className="font-semibold">{isCorrect ? '✓ Correct!' : '✗ Incorrect'}</p>
          {!isCorrect && question.correctAnswer && (
            <p className="text-sm mt-1">
              The correct answer is: <strong>{question.correctAnswer}</strong>
            </p>
          )}
          {isCorrect && question.correctFeedback && (
            <p className="text-sm mt-2 opacity-90">{question.correctFeedback}</p>
          )}
          {!isCorrect && question.incorrectFeedback && (
            <p className="text-sm mt-2 opacity-90">{question.incorrectFeedback}</p>
          )}
          {!question.correctFeedback && !question.incorrectFeedback && question.feedbackText && (
            <p className="text-sm mt-1 opacity-80">{question.feedbackText}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Text Entry Renderer Component ──────────────────────────────────────────────

function TextEntryRenderer({ question }: { question: ParsedQuestion }) {
  const [userAnswer, setUserAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);

  const handleCheck = () => {
    if (userAnswer.trim()) setShowResult(true);
  };

  const handleReset = () => {
    setUserAnswer('');
    setShowResult(false);
  };

  const isCorrect = question.correctAnswers?.some(
    ans => ans.toLowerCase().trim() === userAnswer.toLowerCase().trim()
  ) || false;

  return (
    <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="inline-block px-3 py-1 bg-[#FEF3C7] text-[#92400E] rounded-full text-xs font-semibold">
          Text Entry
        </span>
        <span className="text-xs text-[#94A3B8]">{question.identifier}</span>
      </div>

      <h3 className="text-lg font-semibold text-[#111827] mb-5">{question.stem}</h3>

      <input
        type="text"
        value={userAnswer}
        onChange={(e) => { if (!showResult) setUserAnswer(e.target.value); }}
        placeholder="Type your answer here..."
        disabled={showResult}
        className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F6CBD] text-[#111827]"
      />

      <div className="mt-5 flex gap-2">
        <Button
          onClick={handleCheck}
          disabled={!userAnswer.trim() || showResult}
          className="bg-[#0F6CBD] hover:bg-[#0B5A9A] text-white rounded-md"
        >
          Check Answer
        </Button>
        {showResult && (
          <Button variant="outline" onClick={handleReset} className="border-[#E2E8F0] rounded-md">
            Try Again
          </Button>
        )}
      </div>

      {showResult && (
        <div className={`mt-4 p-3 rounded-lg ${isCorrect ? 'bg-[#F0FDF4] text-[#166534]' : 'bg-[#FEF2F2] text-[#991B1B]'}`}>
          <p className="font-semibold">{isCorrect ? '✓ Correct!' : '✗ Incorrect'}</p>
          {!isCorrect && question.correctAnswers && question.correctAnswers.length > 0 && (
            <p className="text-sm mt-1">
              Expected answer: <strong>{question.correctAnswers.join(' / ')}</strong>
            </p>
          )}
          {isCorrect && question.correctFeedback && (
            <p className="text-sm mt-2 opacity-90">{question.correctFeedback}</p>
          )}
          {!isCorrect && question.incorrectFeedback && (
            <p className="text-sm mt-2 opacity-90">{question.incorrectFeedback}</p>
          )}
          {!question.correctFeedback && !question.incorrectFeedback && question.feedbackText && (
            <p className="text-sm mt-1 opacity-80">{question.feedbackText}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sample XML ─────────────────────────────────────────────────────────────────

const SAMPLE_MCQ_XML = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1"
  identifier="q_geography_01"
  title="Capital of France"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>B</value>
    </correctResponse>
  </responseDeclaration>

  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <prompt>What is the capital of France?</prompt>
      <simpleChoice identifier="A">London</simpleChoice>
      <simpleChoice identifier="B">Paris</simpleChoice>
      <simpleChoice identifier="C">Berlin</simpleChoice>
      <simpleChoice identifier="D">Madrid</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

const SAMPLE_TEXTENTRY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1"
  identifier="q_math_01"
  title="Basic Addition"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string">
    <correctResponse>
      <value>4</value>
    </correctResponse>
  </responseDeclaration>

  <itemBody>
    <div>
      <p>What is 2 + 2?</p>
      <textEntryInteraction responseIdentifier="RESPONSE" expectedLength="10" />
    </div>
  </itemBody>
</assessmentItem>`;

// ── Main QTI Renderer Page ─────────────────────────────────────────────────────

export function QTIRenderer() {
  const [qtiInput, setQtiInput] = useState("");
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [hasRendered, setHasRendered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRender = () => {
    setParseError(null);
    setParsedQuestions([]);
    setHasRendered(true);

    const input = qtiInput.trim();
    if (!input) {
      setParseError('Please enter some QTI XML content.');
      return;
    }

    try {
      const questions = parseQTIXml(input);
      if (questions.length === 0) {
        setParseError('No supported question types found. Make sure your XML contains <choiceInteraction> or <textEntryInteraction>.');
        return;
      }
      setParsedQuestions(questions);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Failed to parse QTI XML');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setQtiInput(content);

      // Auto-render after upload
      setParseError(null);
      setParsedQuestions([]);
      setHasRendered(true);

      try {
        const questions = parseQTIXml(content);
        if (questions.length === 0) {
          setParseError('No supported question types found in the uploaded file.');
          return;
        }
        setParsedQuestions(questions);
      } catch (error) {
        setParseError(error instanceof Error ? error.message : 'Failed to parse uploaded file');
      }
    };
    reader.readAsText(file);
  };

  const loadSample = (type: 'mcq' | 'textentry' | 'both') => {
    let xml = '';
    if (type === 'mcq') xml = SAMPLE_MCQ_XML;
    else if (type === 'textentry') xml = SAMPLE_TEXTENTRY_XML;
    else xml = SAMPLE_MCQ_XML + '\n\n' + SAMPLE_TEXTENTRY_XML;

    setQtiInput(xml);
    setParseError(null);
    setHasRendered(true);

    try {
      const questions = parseQTIXml(xml);
      setParsedQuestions(questions);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Failed to parse sample');
    }
  };

  const handleDownloadXml = () => {
    if (!qtiInput.trim()) return;
    const blob = new Blob([qtiInput], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qti-export-${Date.now()}.xml`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-[#FFFFFF] border-b border-[#E2E8F0] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">QTI Renderer</h1>
            <p className="text-[#475569] mt-1">Paste or upload QTI XML to preview how questions will appear to students</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => loadSample('mcq')}
              className="border border-[#334155] text-[#1F2937] hover:bg-[#F1F5F9] rounded-md text-sm"
            >
              <Code className="w-4 h-4 mr-1" />
              MCQ Sample
            </Button>
            <Button
              variant="outline"
              onClick={() => loadSample('textentry')}
              className="border border-[#334155] text-[#1F2937] hover:bg-[#F1F5F9] rounded-md text-sm"
            >
              <FileText className="w-4 h-4 mr-1" />
              Text Entry Sample
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-180px)]">
          {/* Input Panel */}
          <Card className="flex flex-col border border-[#E2E8F0] bg-[#FFFFFF]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                QTI XML Input
              </CardTitle>
              <CardDescription>
                Paste QTI XML or upload an .xml file
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <Textarea
                placeholder={'<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" ...>\n  ...\n</assessmentItem>'}
                value={qtiInput}
                onChange={(e) => setQtiInput(e.target.value)}
                className="flex-1 font-mono text-sm min-h-[300px]"
              />
              <div className="mt-4 flex gap-2">
                <Button
                  onClick={handleRender}
                  className="flex-1 bg-[#0F6CBD] hover:bg-[#0B5A9A] active:bg-[#094A7F] text-white rounded-md"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Render QTI
                </Button>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="border border-[#334155] text-[#1F2937] hover:bg-[#F1F5F9] rounded-md"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload XML
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xml"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </CardContent>
          </Card>

          {/* Preview Panel */}
          <Card className="flex flex-col border border-[#E2E8F0] bg-[#FFFFFF] overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileJson className="w-5 h-5" />
                Live Preview
              </CardTitle>
              <CardDescription>
                Interactive preview of the rendered question
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              {!hasRendered && (
                <div className="h-full flex items-center justify-center text-[#94A3B8]">
                  <div className="text-center">
                    <FileJson className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Paste QTI XML and click "Render QTI" to preview</p>
                    <p className="text-sm mt-2">Supports MCQ and Text Entry question types</p>
                  </div>
                </div>
              )}

              {hasRendered && parseError && (
                <Alert variant="destructive" className="border-[#DC2626] bg-[#FEF2F2]">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Parse Error</AlertTitle>
                  <AlertDescription>{parseError}</AlertDescription>
                </Alert>
              )}

              {hasRendered && parsedQuestions.length > 0 && (
                <div className="space-y-6">
                  <Alert className="bg-[#F0FDF4] border-[#16A34A]">
                    <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                    <AlertTitle className="text-[#166534]">
                      Parsed {parsedQuestions.length} question{parsedQuestions.length > 1 ? 's' : ''} successfully
                    </AlertTitle>
                    <AlertDescription className="text-[#166534]">
                      {parsedQuestions.filter(q => q.type === 'mcq').length} MCQ,{' '}
                      {parsedQuestions.filter(q => q.type === 'textentry').length} Text Entry
                    </AlertDescription>
                  </Alert>

                  {parsedQuestions.map((question, index) => (
                    <div key={`${question.identifier}-${index}`}>
                      {question.type === 'mcq' && <MCQRenderer question={question} />}
                      {question.type === 'textentry' && <TextEntryRenderer question={question} />}
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    className="w-full border border-[#334155] text-[#1F2937] hover:bg-[#F1F5F9] rounded-md"
                    onClick={handleDownloadXml}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download XML
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
