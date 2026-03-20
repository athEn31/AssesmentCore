import { useState, useRef } from "react";
import {
  Upload,
  Play,
  Download,
  FileCode,
  FileJson,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Archive,
  FolderOpen,
  Eraser,
  ChevronLeft,
  ChevronRight,
  List,
  Sparkles,
} from "lucide-react";
import JSZip from "jszip";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Textarea } from "../../components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { cn } from "../../components/ui/utils";
import { MathMLRenderer } from "../../components/MathMLRenderer";

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
  textEntryExpectedLength?: number;
  choices?: ParsedChoice[];
  correctAnswer?: string;
  correctAnswers?: string[];
  feedbackText?: string;
  correctFeedback?: string;
  incorrectFeedback?: string;
}

// ── XML helpers ────────────────────────────────────────────────────────────────

const serializer = new XMLSerializer();

/**
 * Serialize an XML element's child nodes to an HTML string, preserving
 * markup such as `<math>`, `<p>`, `<span>`, etc.  This is the key fix:
 * `.textContent` strips all tags (including MathML), whereas this keeps them.
 */
function getInnerHTML(el: Element): string {
  let html = '';
  for (let i = 0; i < el.childNodes.length; i++) {
    html += serializer.serializeToString(el.childNodes[i]);
  }
  // XMLSerializer adds xmlns declarations on every element; strip them so the
  // HTML output is clean for the browser to render via MathMLRenderer.
  return html
    .replace(/ xmlns="[^"]*"/g, '')
    .trim();
}

/**
 * Get the inner HTML of an element, but strip out child elements that match
 * certain tag names (e.g. feedbackBlock, qti-modal-feedback) so their text
 * doesn't pollute the stem.
 */
function getInnerHTMLExcluding(el: Element, excludeSelectors: string[]): string {
  // Clone so we don't mutate the parsed document
  const clone = el.cloneNode(true) as Element;
  for (const sel of excludeSelectors) {
    clone.querySelectorAll(sel).forEach(node => node.parentNode?.removeChild(node));
  }
  return getInnerHTML(clone);
}

const FEEDBACK_SELECTORS = 'feedbackBlock, modalFeedback, qti-modal-feedback, qti-feedback-block';

function isIncorrectFeedbackNode(node: Element): boolean {
  const identifier = (node.getAttribute('identifier') || '').toLowerCase();
  const outcomeIdentifier = (
    node.getAttribute('outcomeIdentifier')
    || node.getAttribute('outcome-identifier')
    || ''
  ).toLowerCase();

  return (
    identifier === 'incorrect'
    || identifier.includes('incorrect')
    || identifier.includes('wrong')
    || outcomeIdentifier.includes('incorrect')
    || outcomeIdentifier.includes('wrong')
  );
}

function isCorrectFeedbackNode(node: Element): boolean {
  const identifier = (node.getAttribute('identifier') || '').toLowerCase();
  const outcomeIdentifier = (
    node.getAttribute('outcomeIdentifier')
    || node.getAttribute('outcome-identifier')
    || ''
  ).toLowerCase();

  if (isIncorrectFeedbackNode(node)) {
    return false;
  }

  return (
    identifier === 'correct'
    || identifier.includes('correct')
    || outcomeIdentifier.includes('correct')
  );
}

function extractFeedback(item: Element, itemBody: Element | null): {
  feedbackText: string;
  correctFeedback: string;
  incorrectFeedback: string;
} {
  let feedbackText = '';
  let correctFeedback = '';
  let incorrectFeedback = '';

  const itemBodyFeedbacks = itemBody ? Array.from(itemBody.querySelectorAll(FEEDBACK_SELECTORS)) : [];
  const itemLevelFeedbacks = Array.from(item.querySelectorAll(FEEDBACK_SELECTORS));

  const seen = new Set<Element>();
  const allFeedbacks = [...itemBodyFeedbacks, ...itemLevelFeedbacks].filter((fb) => {
    if (seen.has(fb)) return false;
    seen.add(fb);
    return true;
  });

  for (const fb of allFeedbacks) {
    const text = getInnerHTML(fb).trim();
    if (!text) continue;

    if (isIncorrectFeedbackNode(fb) && !incorrectFeedback) {
      incorrectFeedback = text;
      continue;
    }

    if (isCorrectFeedbackNode(fb) && !correctFeedback) {
      correctFeedback = text;
      continue;
    }

    if (!feedbackText) {
      feedbackText = text;
    }
  }

  return { feedbackText, correctFeedback, incorrectFeedback };
}

// ── QTI XML Parser ─────────────────────────────────────────────────────────────

function parseQTIXml(xmlString: string): ParsedQuestion[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString.trim(), 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid XML: ' + parseError.textContent);
  }

  const questions: ParsedQuestion[] = [];

  let items = doc.querySelectorAll('assessmentItem');
  if (items.length === 0) {
    items = doc.querySelectorAll('qti-assessment-item');
  }

  const itemsToProcess = items.length > 0 ? Array.from(items) : [doc.documentElement];

  for (const item of itemsToProcess) {
    if (item.tagName === 'parsererror') continue;

    const identifier = item.getAttribute('identifier') || 'unknown';
    const title = item.getAttribute('title') || 'Untitled Question';

    let choiceInteraction = item.querySelector('choiceInteraction');
    if (!choiceInteraction) {
      choiceInteraction = item.querySelector('qti-choice-interaction');
    }

    let textEntryInteraction = item.querySelector('textEntryInteraction');
    if (!textEntryInteraction) {
      textEntryInteraction = item.querySelector('qti-text-entry-interaction');
    }

    if (choiceInteraction) {
      let prompt = choiceInteraction.querySelector('prompt');
      if (!prompt) {
        prompt = choiceInteraction.querySelector('qti-prompt');
      }

      let itemBody = item.querySelector('itemBody');
      if (!itemBody) {
        itemBody = item.querySelector('qti-item-body');
      }

      let stem = '';
      if (prompt) {
        stem = getInnerHTML(prompt);
      } else if (itemBody) {
        const pTags = itemBody.querySelectorAll('p, qti-content-body > *');
        for (const p of Array.from(pTags)) {
          if (!p.closest(FEEDBACK_SELECTORS)) {
            const html = getInnerHTML(p);
            if (html) {
              stem += (stem ? '<br/>' : '') + html;
            }
          }
        }
      }

      let simpleChoices = choiceInteraction.querySelectorAll('simpleChoice');
      if (simpleChoices.length === 0) {
        simpleChoices = choiceInteraction.querySelectorAll('qti-simple-choice');
      }

      const choices: ParsedChoice[] = Array.from(simpleChoices).map(choice => ({
        identifier: choice.getAttribute('identifier') || '',
        content: getInnerHTML(choice),
      }));

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

      const { feedbackText, correctFeedback, incorrectFeedback } = extractFeedback(item, itemBody);

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
      const expectedLengthAttr = textEntryInteraction.getAttribute('expectedLength')
        || textEntryInteraction.getAttribute('expected-length');
      const parsedExpectedLength = expectedLengthAttr ? Number(expectedLengthAttr) : NaN;
      const expectedLength = Number.isFinite(parsedExpectedLength) && parsedExpectedLength > 0
        ? Math.round(parsedExpectedLength)
        : undefined;

      let itemBody = item.querySelector('itemBody');
      if (!itemBody) {
        itemBody = item.querySelector('qti-item-body');
      }

      let stem = '';
      if (itemBody) {
        const pTags = itemBody.querySelectorAll('p, qti-content-body > *');
        for (const p of Array.from(pTags)) {
          if (!p.closest(FEEDBACK_SELECTORS)) {
            const html = getInnerHTML(p);
            if (html) {
              stem += (stem ? '<br/>' : '') + html;
            }
          }
        }
        if (!stem) {
          // Fallback: serialize the itemBody excluding interactions and feedback
          stem = getInnerHTMLExcluding(itemBody, [
            'textEntryInteraction', 'qti-text-entry-interaction',
            'feedbackBlock', 'modalFeedback', 'qti-modal-feedback', 'qti-feedback-block',
          ]);
        }
      }

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

      const { feedbackText, correctFeedback, incorrectFeedback } = extractFeedback(item, itemBody);

      questions.push({
        identifier,
        title,
        type: 'textentry',
        stem,
        textEntryExpectedLength: expectedLength,
        correctAnswers,
        feedbackText,
        correctFeedback,
        incorrectFeedback,
      });
    }
  }

  return questions;
}

// ── Feedback Block ─────────────────────────────────────────────────────────────

function FeedbackBlock({ isCorrect, question }: { isCorrect: boolean; question: ParsedQuestion }) {
  const correctChoice = question.type === 'mcq'
    ? question.choices?.find((choice) => choice.identifier === question.correctAnswer)
    : null;

  return (
    <div
      className={cn(
        "mt-4 flex items-start gap-2 rounded-xl p-3 transition-all duration-300",
        isCorrect
          ? "bg-white border-2 border-[#22C55E]"
          : "bg-white border-2 border-[#EF4444]"
      )}
    >
      {isCorrect ? (
        <CheckCircle2 className="w-5 h-5 text-[#475569] mt-0.5 flex-shrink-0" />
      ) : (
        <XCircle className="w-5 h-5 text-[#475569] mt-0.5 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[#111827]">
          {isCorrect ? "Correct!" : "Incorrect"}
        </p>
        {!isCorrect && question.type === 'mcq' && question.correctAnswer && (
          <div className="text-sm mt-1 text-[#111827]">
            <p>The correct answer is:</p>
            {correctChoice?.content ? (
              <MathMLRenderer content={correctChoice.content} className="mt-1 font-medium" inline />
            ) : (
              <strong>{question.correctAnswer}</strong>
            )}
          </div>
        )}
        {!isCorrect && question.type === 'textentry' && question.correctAnswers && question.correctAnswers.length > 0 && (
          <p className="text-sm mt-1 text-[#111827]">
            Expected answer: <strong>{question.correctAnswers.join(' / ')}</strong>
          </p>
        )}
        {isCorrect && question.correctFeedback && (
          <MathMLRenderer content={question.correctFeedback} className="text-sm mt-1.5" />
        )}
        {!isCorrect && question.incorrectFeedback && (
          <MathMLRenderer content={question.incorrectFeedback} className="text-sm mt-1.5" />
        )}
        {!question.correctFeedback && !question.incorrectFeedback && question.feedbackText && (
          <MathMLRenderer content={question.feedbackText} className="text-sm mt-1.5 opacity-90" />
        )}
      </div>
    </div>
  );
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
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-block px-2.5 py-0.5 bg-[#E0F2FE] text-[#0F6CBD] rounded-full text-xs font-semibold">
          MCQ
        </span>
        <span className="text-xs text-[#94A3B8] font-mono">{question.identifier}</span>
      </div>

      <MathMLRenderer content={question.stem} className="text-base font-normal text-[#111827] mb-4 leading-relaxed" />

      <div className="space-y-2.5">
        {question.choices?.map((choice, index) => {
          const isSelected = selectedAnswer === choice.identifier;
          const isCorrectChoice = choice.identifier === question.correctAnswer;
          const choiceLabel = index < 26 ? String.fromCharCode(65 + index) : `${index + 1}`;

          return (
            <button
              key={choice.identifier}
              type="button"
              onClick={() => {
                if (!showResult) setSelectedAnswer(choice.identifier);
              }}
              disabled={showResult}
              className={cn(
                "w-full flex items-center gap-3 p-4 border rounded-xl text-left transition-all duration-200",
                showResult && isCorrectChoice && "border-[#16A34A] bg-[#F0FDF4]",
                showResult && isSelected && !isCorrectChoice && "border-[#DC2626] bg-[#FEF2F2]",
                showResult && !isCorrectChoice && !isSelected && "border-[#E2E8F0] opacity-60",
                !showResult && isSelected && "border-[#0F6CBD] bg-[#EFF6FF] shadow-sm",
                !showResult && !isSelected && "border-[#E2E8F0] hover:border-[#94A3B8] hover:bg-[#F8FAFC]",
              )}
            >
              {/* Custom radio circle */}
              <div
                className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200",
                  showResult && isCorrectChoice && "border-[#16A34A] bg-[#16A34A]",
                  showResult && isSelected && !isCorrectChoice && "border-[#DC2626] bg-[#DC2626]",
                  showResult && !isCorrectChoice && !isSelected && "border-[#D1D5DB]",
                  !showResult && isSelected && "border-[#0F6CBD] bg-[#0F6CBD]",
                  !showResult && !isSelected && "border-[#CBD5E1]",
                )}
              >
                {showResult && isCorrectChoice && (
                  <CheckCircle2 className="w-3 h-3 text-white" />
                )}
                {showResult && isSelected && !isCorrectChoice && (
                  <XCircle className="w-3 h-3 text-white" />
                )}
                {!showResult && isSelected && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>

              <span className="font-medium text-[#64748B] min-w-[20px] text-sm">{choiceLabel}.</span>
              <MathMLRenderer content={choice.content} className="text-[#111827] flex-1 text-sm" inline />
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex gap-2">
        <Button
          onClick={handleCheck}
          disabled={!selectedAnswer || showResult}
          className="bg-[#0F6CBD] hover:bg-[#0B5A9A] text-white rounded-lg px-5"
        >
          Check Answer
        </Button>
        {showResult && (
          <Button variant="outline" onClick={handleReset} className="rounded-lg border-[#E2E8F0]">
            Try Again
          </Button>
        )}
      </div>

      {showResult && <FeedbackBlock isCorrect={isCorrect} question={question} />}
    </div>
  );
}

// ── Text Entry Renderer Component ──────────────────────────────────────────────

function TextEntryRenderer({ question }: { question: ParsedQuestion }) {
  const [userAnswer, setUserAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);

  const expectedLength = question.textEntryExpectedLength;
  // Keep width responsive while honoring XML-provided expected length.
  const dynamicWidth = expectedLength
    ? `min(100%, ${Math.max(12, Math.min(expectedLength + 2, 80))}ch)`
    : undefined;

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
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-block px-2.5 py-0.5 bg-[#FEF3C7] text-[#92400E] rounded-full text-xs font-semibold">
          Text Entry
        </span>
        <span className="text-xs text-[#94A3B8] font-mono">{question.identifier}</span>
      </div>

      <MathMLRenderer content={question.stem} className="text-base font-normal text-[#111827] mb-4 leading-relaxed" />

      <input
        type="text"
        value={userAnswer}
        size={expectedLength}
        onChange={(e) => { if (!showResult) setUserAnswer(e.target.value); }}
        onKeyDown={(e) => { if (e.key === 'Enter' && userAnswer.trim() && !showResult) handleCheck(); }}
        placeholder="Type your answer here..."
        disabled={showResult}
        style={dynamicWidth ? { width: dynamicWidth } : undefined}
        className="max-w-full px-4 py-3 border border-[#E2E8F0] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6CBD] focus:border-transparent text-[#111827] text-sm transition-all duration-200 placeholder:text-[#94A3B8]"
      />

      <div className="mt-5 flex gap-2">
        <Button
          onClick={handleCheck}
          disabled={!userAnswer.trim() || showResult}
          className="bg-[#0F6CBD] hover:bg-[#0B5A9A] text-white rounded-lg px-5"
        >
          Check Answer
        </Button>
        {showResult && (
          <Button variant="outline" onClick={handleReset} className="rounded-lg border-[#E2E8F0]">
            Try Again
          </Button>
        )}
      </div>

      {showResult && <FeedbackBlock isCorrect={isCorrect} question={question} />}
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

// ── Question Navigator ─────────────────────────────────────────────────────────

function QuestionNavigator({
  questions,
  activeIndex,
  showAll,
  onSelect,
  onToggleShowAll,
}: {
  questions: ParsedQuestion[];
  activeIndex: number;
  showAll: boolean;
  onSelect: (index: number) => void;
  onToggleShowAll: () => void;
}) {
  if (questions.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 pb-4 border-b border-[#E2E8F0] mb-5">
      <div className="flex items-center gap-1.5 flex-1 flex-wrap">
        {questions.map((q, i) => (
          <button
            key={`${q.identifier}-${i}`}
            type="button"
            onClick={() => {
              if (showAll) return;
              onSelect(i);
            }}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-all duration-200",
              !showAll && i === activeIndex
                ? "bg-[#0F6CBD] text-white shadow-sm"
                : !showAll
                  ? "bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]"
                  : "bg-[#F1F5F9] text-[#475569] cursor-default"
            )}
          >
            Q{i + 1}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        {!showAll && questions.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={activeIndex === 0}
              onClick={() => onSelect(activeIndex - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-[#94A3B8] min-w-[3rem] text-center">
              {activeIndex + 1}/{questions.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={activeIndex === questions.length - 1}
              onClick={() => onSelect(activeIndex + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleShowAll}
          className="text-xs h-7 px-2 text-[#475569]"
        >
          <List className="w-3.5 h-3.5 mr-1" />
          {showAll ? "Single" : "All"}
        </Button>
      </div>
    </div>
  );
}

// ── Main QTI Renderer Page ─────────────────────────────────────────────────────

export function QTIRenderer() {
  const [qtiInput, setQtiInput] = useState("");
  const [inputMode, setInputMode] = useState<'xml' | 'zip' | 'folder' | 'json'>('xml');
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [hasRendered, setHasRendered] = useState(false);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [showAllQuestions, setShowAllQuestions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const parseAndRenderXml = (xml: string, noQuestionError: string) => {
    setParseError(null);
    setParsedQuestions([]);
    setHasRendered(true);
    setActiveQuestionIndex(0);
    setShowAllQuestions(false);

    const input = xml.trim();
    if (!input) {
      setParseError('Please enter some QTI XML content.');
      return;
    }

    try {
      const questions = parseQTIXml(input);
      if (questions.length === 0) {
        setParseError(noQuestionError);
        return;
      }
      setParsedQuestions(questions);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Failed to parse QTI XML');
    }
  };

  const handleRender = () => {
    if (inputMode === 'json') {
      const raw = qtiInput.trim();
      if (!raw) {
        setParseError('Please enter JSON content.');
        setHasRendered(true);
        setParsedQuestions([]);
        return;
      }

      try {
        const parsedJson = JSON.parse(raw);
        const xml = typeof parsedJson === 'string'
          ? parsedJson
          : parsedJson.xml || parsedJson.qtiXml || parsedJson.qti || parsedJson.content;

        if (typeof xml !== 'string') {
          setParseError('JSON must contain XML string in one of: xml, qtiXml, qti, or content.');
          setHasRendered(true);
          setParsedQuestions([]);
          return;
        }

        parseAndRenderXml(xml, 'No supported question types found in the JSON payload.');
      } catch {
        setParseError('Invalid JSON input.');
        setHasRendered(true);
        setParsedQuestions([]);
      }
      return;
    }

    parseAndRenderXml(
      qtiInput,
      'No supported question types found. Make sure your XML contains <choiceInteraction> or <textEntryInteraction>.'
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setQtiInput(content);
      setInputMode('xml');
      parseAndRenderXml(content, 'No supported question types found in the uploaded file.');
    };
    reader.readAsText(file);
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const zip = await JSZip.loadAsync(file);
      const xmlFiles = Object.values(zip.files).filter(
        (zipFile) => !zipFile.dir && zipFile.name.toLowerCase().endsWith('.xml')
      );

      if (xmlFiles.length === 0) {
        setHasRendered(true);
        setParsedQuestions([]);
        setParseError('No .xml files found inside the ZIP archive.');
        return;
      }

      const firstXml = await xmlFiles[0].async('string');
      setQtiInput(firstXml);
      setInputMode('xml');
      parseAndRenderXml(firstXml, 'No supported question types found in the ZIP XML file.');
    } catch {
      setHasRendered(true);
      setParsedQuestions([]);
      setParseError('Failed to read ZIP archive.');
    }
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((file) =>
      file.name.toLowerCase().endsWith('.xml')
    );

    if (files.length === 0) {
      setHasRendered(true);
      setParsedQuestions([]);
      setParseError('No .xml files found in the selected folder.');
      return;
    }

    try {
      const firstXml = await files[0].text();
      setQtiInput(firstXml);
      setInputMode('xml');
      parseAndRenderXml(firstXml, 'No supported question types found in the folder XML file.');
    } catch {
      setHasRendered(true);
      setParsedQuestions([]);
      setParseError('Failed to read folder contents.');
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

  const handleLoadSample = (type: 'mcq' | 'textentry') => {
    const xml = type === 'mcq' ? SAMPLE_MCQ_XML : SAMPLE_TEXTENTRY_XML;
    setQtiInput(xml);
    setInputMode('xml');
    parseAndRenderXml(xml, 'Failed to parse sample XML.');
  };

  const handleClear = () => {
    setQtiInput("");
    setParsedQuestions([]);
    setParseError(null);
    setHasRendered(false);
    setActiveQuestionIndex(0);
    setShowAllQuestions(false);
  };

  const questionsToRender = showAllQuestions
    ? parsedQuestions
    : parsedQuestions.length > 0
      ? [parsedQuestions[activeQuestionIndex]]
      : [];

  return (
    <div className="h-full bg-[#F8FAFC] flex flex-col">
      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E2E8F0] px-5 py-2.5 flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#0F6CBD] rounded-lg flex items-center justify-center">
            <FileCode className="w-4.5 h-4.5 text-white" />
          </div>
          <h1 className="text-lg font-semibold text-[#111827]">QTI Preview</h1>
          {parsedQuestions.length > 0 && (
            <Badge variant="secondary" className="bg-[#E0F2FE] text-[#0F6CBD] hover:bg-[#E0F2FE] text-xs">
              {parsedQuestions.length} question{parsedQuestions.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadXml}
            disabled={!qtiInput.trim()}
            className="text-xs h-8 border-[#E2E8F0]"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Download XML
          </Button>
        </div>
      </div>

      {/* ── Panels ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden p-4">
        <PanelGroup direction="horizontal" className="h-full">
          {/* ── Left: Input ─────────────────────────────────── */}
          <Panel defaultSize={38} minSize={25} className="flex flex-col min-w-0">
            <Card className="flex-1 flex flex-col min-h-0 shadow-sm border-[#E2E8F0] bg-white overflow-hidden">
              <CardContent className="flex-1 flex flex-col overflow-hidden p-4">
                <Tabs
                  value={inputMode}
                  onValueChange={(value) => setInputMode(value as 'xml' | 'zip' | 'folder' | 'json')}
                  className="flex-1 flex flex-col min-h-0"
                >
                  <TabsList className="grid grid-cols-4 bg-[#F1F5F9] flex-shrink-0 h-9">
                    <TabsTrigger value="xml" className="text-xs">XML</TabsTrigger>
                    <TabsTrigger value="zip" className="text-xs">ZIP</TabsTrigger>
                    <TabsTrigger value="folder" className="text-xs">Folder</TabsTrigger>
                    <TabsTrigger value="json" className="text-xs">JSON</TabsTrigger>
                  </TabsList>

                  {/* XML Tab */}
                  <TabsContent value="xml" className="mt-3 flex-1 flex flex-col overflow-hidden data-[state=inactive]:hidden min-h-0">
                    <Textarea
                      placeholder="Paste QTI XML here..."
                      value={qtiInput}
                      onChange={(e) => setQtiInput(e.target.value)}
                      className="flex-1 font-mono text-sm min-h-0 !field-sizing-normal resize-none border-[#E2E8F0] focus-visible:ring-[#0F6CBD] bg-[#FAFBFC]"
                    />
                    <div className="mt-3 flex gap-2 flex-shrink-0">
                      <Button onClick={handleRender} className="bg-[#0F6CBD] hover:bg-[#0B5A9A] text-white rounded-lg px-5">
                        <Play className="w-4 h-4 mr-1.5" />
                        Preview
                      </Button>
                      <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="rounded-lg border-[#E2E8F0]">
                        <Upload className="w-4 h-4 mr-1.5" />
                        Upload
                      </Button>
                      {qtiInput && (
                        <Button variant="ghost" onClick={handleClear} className="rounded-lg text-[#94A3B8]">
                          <Eraser className="w-4 h-4 mr-1.5" />
                          Clear
                        </Button>
                      )}
                    </div>
                  </TabsContent>

                  {/* ZIP Tab */}
                  <TabsContent value="zip" className="mt-3 flex-1 flex flex-col data-[state=inactive]:hidden overflow-hidden min-h-0">
                    <button
                      type="button"
                      onClick={() => zipInputRef.current?.click()}
                      className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[#CBD5E1] rounded-xl text-[#475569] hover:border-[#0F6CBD] hover:bg-[#F8FAFC] transition-all duration-200 cursor-pointer group"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] flex items-center justify-center mb-4 group-hover:bg-[#E0F2FE] transition-colors">
                        <Archive className="w-7 h-7 text-[#64748B] group-hover:text-[#0F6CBD] transition-colors" />
                      </div>
                      <p className="font-medium text-sm text-[#334155]">Click to upload ZIP archive</p>
                      <p className="text-xs text-[#94A3B8] mt-1">Containing QTI XML files</p>
                    </button>
                  </TabsContent>

                  {/* Folder Tab */}
                  <TabsContent value="folder" className="mt-3 flex-1 flex flex-col data-[state=inactive]:hidden overflow-hidden min-h-0">
                    <button
                      type="button"
                      onClick={() => folderInputRef.current?.click()}
                      className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[#CBD5E1] rounded-xl text-[#475569] hover:border-[#0F6CBD] hover:bg-[#F8FAFC] transition-all duration-200 cursor-pointer group"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] flex items-center justify-center mb-4 group-hover:bg-[#E0F2FE] transition-colors">
                        <FolderOpen className="w-7 h-7 text-[#64748B] group-hover:text-[#0F6CBD] transition-colors" />
                      </div>
                      <p className="font-medium text-sm text-[#334155]">Click to select a folder</p>
                      <p className="text-xs text-[#94A3B8] mt-1">With one or more QTI XML files</p>
                    </button>
                  </TabsContent>

                  {/* JSON Tab */}
                  <TabsContent value="json" className="mt-3 flex-1 flex flex-col overflow-hidden data-[state=inactive]:hidden min-h-0">
                    <Textarea
                      placeholder={'Paste JSON here...\n\nSupported fields: xml, qtiXml, qti, content'}
                      value={qtiInput}
                      onChange={(e) => setQtiInput(e.target.value)}
                      className="flex-1 font-mono text-sm min-h-0 !field-sizing-normal resize-none border-[#E2E8F0] focus-visible:ring-[#0F6CBD] bg-[#FAFBFC]"
                    />
                    <div className="mt-3 flex gap-2 flex-shrink-0">
                      <Button onClick={handleRender} className="bg-[#0F6CBD] hover:bg-[#0B5A9A] text-white rounded-lg px-5">
                        <Play className="w-4 h-4 mr-1.5" />
                        Preview
                      </Button>
                      {qtiInput && (
                        <Button variant="ghost" onClick={handleClear} className="rounded-lg text-[#94A3B8]">
                          <Eraser className="w-4 h-4 mr-1.5" />
                          Clear
                        </Button>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </Panel>

          {/* ── Resize Handle ──────────────────────────────── */}
          <PanelResizeHandle className="w-2 mx-1 rounded-full bg-[#E2E8F0] hover:bg-[#0F6CBD] transition-colors cursor-col-resize" />

          {/* ── Right: Preview ─────────────────────────────── */}
          <Panel defaultSize={62} minSize={35} className="flex flex-col min-w-0">
            <Card className="flex-1 flex flex-col min-h-0 shadow-sm border-[#E2E8F0] bg-white overflow-y-hidden overflow-x-visible">
              <CardContent className="flex-1 flex flex-col overflow-y-hidden overflow-x-visible p-0">
                {/* Empty State */}
                {!hasRendered && (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center max-w-xs">
                      <div className="w-20 h-20 rounded-2xl bg-[#F1F5F9] flex items-center justify-center mx-auto mb-5">
                        <FileJson className="w-10 h-10 text-[#CBD5E1]" />
                      </div>
                      <p className="text-[#475569] font-medium mb-1">No preview yet</p>
                      <p className="text-sm text-[#94A3B8] mb-5">
                        Paste QTI XML in the editor and click Preview, or try a sample
                      </p>
                      <div className="flex gap-2 justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLoadSample('mcq')}
                          className="text-xs rounded-lg border-[#E2E8F0]"
                        >
                          MCQ Example
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLoadSample('textentry')}
                          className="text-xs rounded-lg border-[#E2E8F0]"
                        >
                          Text Entry Example
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error State */}
                {hasRendered && parseError && (
                  <div className="p-5">
                    <Alert variant="destructive" className="border-[#FECACA] bg-[#FEF2F2]">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Parse Error</AlertTitle>
                      <AlertDescription className="text-sm">{parseError}</AlertDescription>
                    </Alert>
                  </div>
                )}

                {/* Questions */}
                {hasRendered && parsedQuestions.length > 0 && (
                  <div className="flex-1 flex flex-col overflow-y-hidden overflow-x-visible">
                    {/* Navigator */}
                    <div className="px-5 pt-5 flex-shrink-0">
                      <QuestionNavigator
                        questions={parsedQuestions}
                        activeIndex={activeQuestionIndex}
                        showAll={showAllQuestions}
                        onSelect={setActiveQuestionIndex}
                        onToggleShowAll={() => setShowAllQuestions(!showAllQuestions)}
                      />
                    </div>

                    {/* Question Content */}
                    <div className="flex-1 overflow-y-auto px-5 pb-5">
                      <div className="space-y-8">
                        {questionsToRender.map((question, index) => {
                          const realIndex = showAllQuestions ? index : activeQuestionIndex;
                          return (
                            <div
                              key={`${question.identifier}-${realIndex}`}
                              className={cn(
                                "rounded-xl border border-[#E2E8F0] bg-[#FAFBFC] p-5",
                                showAllQuestions && "shadow-sm"
                              )}
                            >
                              {showAllQuestions && (
                                <div className="text-xs font-medium text-[#94A3B8] mb-3">
                                  Question {realIndex + 1} of {parsedQuestions.length}
                                </div>
                              )}
                              {question.type === 'mcq' && <MCQRenderer question={question} />}
                              {question.type === 'textentry' && <TextEntryRenderer question={question} />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </Panel>
        </PanelGroup>
      </div>

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept=".xml" onChange={handleFileUpload} className="hidden" />
      <input ref={zipInputRef} type="file" accept=".zip" onChange={handleZipUpload} className="hidden" />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        // @ts-ignore
        webkitdirectory=""
        onChange={handleFolderUpload}
        className="hidden"
      />
    </div>
  );
}
