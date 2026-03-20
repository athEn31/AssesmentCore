import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import JSZip from "jszip";
import {
  Upload,
  Download,
  FileJson,
  Trash2,
  Plus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Settings,
  Eye,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  XCircle,
  Sparkles,
  Code,
  EyeOff,
  RefreshCw,
  Lock,
  LogIn,
  Check,
  Copy,
  Image,
  FolderOpen,
  Shield,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Progress } from "../../components/ui/progress";
import { Badge } from "../../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../components/ui/collapsible";
import { Switch } from "../../components/ui/switch";
import { Textarea } from "../../components/ui/textarea";
import { ValidationReport } from "../../components/ValidationReport";
import { ValidationReportOptimized } from "../../components/ValidationReportOptimized";
import { AIValidationReport } from "../../components/AIValidationReport";
import { parseFile, detectQuestionColumns } from "../../utils/fileParser";
import { validateAllQuestions, ValidationResult } from "../../utils/questionValidator";
import { validateAllQuestionsChunked, validateRowsSubset } from "../../utils/chunkedValidator";
import { convertToQTIQuestion, generateJSON, generateQTI } from "../../utils/qtiConverter";
import { applyTemplateXmlToGeneratedItem } from "../../utils/templateXmlApplier";
import { TemplateMappingUI } from "../../components/TemplateMappingUI";
import { ExtractedTemplate } from "../../utils/templateFieldExtractor";
import { ColumnMapping, SheetRow } from "../../utils/templateDataMapper";
import { generateQtiFromMappedData } from "../../utils/templateDataMapper";
import { 
  generateAndValidateMCQ, 
  generateAndValidateTextEntry, 
  generateQTIByVersion,
  Question as QTIQuestion 
} from "../../../engine";
import { processXmlMath } from "../../utils/mathmlConverter";
import { replacePlaceholder, hasFeedbackPlaceholders, listPlaceholdersInNode, removePlaceholderSection } from "../../utils/placeholderHandler";
import { useAuth } from "../../../contexts/AuthContext";
import {
  validateBatch as runAIValidation,
  isProviderConfigured,
  getAvailableProviders,
  autoFixXml,
  type AIValidationItem,
  type AIProvider,
} from "../../../services/aiValidationService";

import {
  extractMediaZip,
  validateMediaReferences,
  insertImageIntoQuestionText,
  IMG_SEPARATOR,
  getImagesForPackaging,
  normalizeMediaFilename,
  resolveMediaFileKey,
  validateAnswerInOptions,
  validateUniqueIds,
  MediaFile,
  MediaValidationError,
} from "../../utils/mediaUtils";
import { uploadMediaFilesToSupabase, UploadedMediaUrl } from "../../../services/mediaUploadService";



interface FileData {
  columns: string[];
  rows: Record<string, any>[];
  fileName: string;
}

interface Question {
  id: string;
  question: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

type UploadedUrlMatchField = 'fileName' | 'serialNumber';

function canonicalImageKey(input: string): string {
  const normalized = normalizeMediaFilename(input);
  if (!normalized) return '';

  const dotIndex = normalized.lastIndexOf('.');
  const rawName = dotIndex >= 0 ? normalized.slice(0, dotIndex) : normalized;
  let ext = dotIndex >= 0 ? normalized.slice(dotIndex + 1) : '';
  if (ext === 'jpeg') ext = 'jpg';

  const normalizedName = rawName.replace(/[\s._-]+/g, '');
  return ext ? `${normalizedName}.${ext}` : normalizedName;
}

function applyUploadedUrlsToRowsBySerial(
  rows: Record<string, any>[],
  imageCol: string,
  uploadedUrls: UploadedMediaUrl[]
): { rows: Record<string, any>[]; mappedCount: number } {
  const serialToUrl = new Map<number, string>();
  const fileNameToUrl = new Map<string, string>();
  const canonicalFileNameToUrl = new Map<string, string>();

  uploadedUrls.forEach((entry) => {
    if (entry.serialNumber != null && !serialToUrl.has(entry.serialNumber)) {
      serialToUrl.set(entry.serialNumber, entry.publicUrl);
    }

    const normalizedFileName = normalizeMediaFilename(entry.fileName);
    if (normalizedFileName && !fileNameToUrl.has(normalizedFileName)) {
      fileNameToUrl.set(normalizedFileName, entry.publicUrl);
    }

    const canonical = canonicalImageKey(entry.fileName);
    if (canonical && !canonicalFileNameToUrl.has(canonical)) {
      canonicalFileNameToUrl.set(canonical, entry.publicUrl);
    }
  });

  let mappedCount = 0;
  const mappedRows = rows.map((row, index) => {
    const currentImageValue = row[imageCol] ? String(row[imageCol]).trim() : '';

    // Keep existing URLs untouched.
    if (currentImageValue.startsWith('http://') || currentImageValue.startsWith('https://')) {
      return row;
    }

    // 1) Primary mapping: filename in sheet -> uploaded filename
    const normalizedCurrent = normalizeMediaFilename(currentImageValue);
    let url = normalizedCurrent ? fileNameToUrl.get(normalizedCurrent) : undefined;

    // 1b) Canonical fallback: ignore separators/case and jpg/jpeg differences.
    if (!url) {
      const canonicalCurrent = canonicalImageKey(currentImageValue);
      url = canonicalCurrent ? canonicalFileNameToUrl.get(canonicalCurrent) : undefined;
    }

    // 2) Fallback mapping: row serial number -> filename serial number
    if (!url) {
      const rowSerial = index + 1;
      url = serialToUrl.get(rowSerial);
    }

    if (!url) return row;
    mappedCount += 1;
    return {
      ...row,
      [imageCol]: url,
    };
  });

  return { rows: mappedRows, mappedCount };
}

function appendImageTagForXmlMedia(questionText: string, imageValue: string): string {
  const raw = String(imageValue || '').trim();
  if (!raw) return questionText;

  const isUrl = raw.startsWith('http://') || raw.startsWith('https://');
  const src = isUrl ? raw : `../media/${raw}`;
  const alt = raw;

  // Use the shared separator so builders preserve a standalone image block.
  return `${questionText}${IMG_SEPARATOR}<img src="${src}" alt="${alt}"/>`;
}

function ensureXmlContainsImageTagForXmlMedia(xmlContent: string, imageValue: string): string {
  const raw = String(imageValue || '').trim();
  if (!raw) return xmlContent;

  const isUrl = raw.startsWith('http://') || raw.startsWith('https://');
  const src = isUrl ? raw : `../media/${raw}`;

  // If this exact image source is already present in img/object, do nothing.
  const escapedSrc = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hasImg = new RegExp(`<img\\b[^>]*\\bsrc=["']${escapedSrc}["'][^>]*>`, 'i').test(xmlContent);
  const hasObject = new RegExp(`<object\\b[^>]*\\bdata=["']${escapedSrc}["'][^>]*>`, 'i').test(xmlContent);
  if (hasImg || hasObject) return xmlContent;

  // If no itemBody exists, leave XML untouched.
  if (!xmlContent.includes('</itemBody>')) return xmlContent;

  const imageBlock = `\n    <p><img src="${src}" alt="${raw}"/></p>`;
  return xmlContent.replace('</itemBody>', `${imageBlock}\n  </itemBody>`);
}

export function BatchCreator() {
  const navigate = useNavigate();
  const { isAuthenticated, loading, user, userUsage, trackExport, trackQuestionsConverted } = useAuth();
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [columnMapping, setColumnMapping] = useState<any>(null);
  const [validationResults, setValidationResults] = useState<Map<string, ValidationResult>>(new Map());
  const [outputFormat, setOutputFormat] = useState<string>("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationProgress, setValidationProgress] = useState(0);
  const [validationProgressText, setValidationProgressText] = useState('');
  const [showValidationReport, setShowValidationReport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [editedRows, setEditedRows] = useState<Record<string, any>[]>([]);
  const [exportValidationError, setExportValidationError] = useState<string>("");

  // Media support state
  const [mediaZipFile, setMediaZipFile] = useState<File | null>(null);
  const [mediaFiles, setMediaFiles] = useState<Map<string, MediaFile>>(new Map());
  const [mediaValidationErrors, setMediaValidationErrors] = useState<MediaValidationError[]>([]);
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);
  const [isUploadingMediaUrls, setIsUploadingMediaUrls] = useState(false);
  const [uploadedMediaUrls, setUploadedMediaUrls] = useState<UploadedMediaUrl[]>([]);
  const [mediaUploadError, setMediaUploadError] = useState<string>("");
  const [autoMappedImageRows, setAutoMappedImageRows] = useState<number>(0);
  const [questionMatchColumnForManualMap, setQuestionMatchColumnForManualMap] = useState<string>("");
  const [uploadedUrlMatchField, setUploadedUrlMatchField] = useState<UploadedUrlMatchField>('fileName');
  const [manualMapMessage, setManualMapMessage] = useState<string>("");
  const [exportMode, setExportMode] = useState<'qti-package' | 'xml-media-folder' | "">("");
  const [containsImages, setContainsImages] = useState<"yes" | "no" | "">("");
  const [containsMath, setContainsMath] = useState<"yes" | "no" | "">("");
  const [mathFormat, setMathFormat] = useState<"mathjax" | "mathml" | "">("");
  const [hasTemplateXml, setHasTemplateXml] = useState<"yes" | "no" | "">("");
  const [templateXmlFile, setTemplateXmlFile] = useState<File | null>(null);
  const [templateXmlContent, setTemplateXmlContent] = useState<string>("");
  const [showTemplateMappingUI, setShowTemplateMappingUI] = useState(false);
  const [templateMapping, setTemplateMapping] = useState<ColumnMapping | null>(null);
  const [templateSheetData, setTemplateSheetData] = useState<SheetRow[]>([]);
  const [extractedTemplate, setExtractedTemplate] = useState<ExtractedTemplate | null>(null);
  const [configurationValidationError, setConfigurationValidationError] = useState<string>("");
  const [showConfigErrors, setShowConfigErrors] = useState(false);
  const [reportDatasetName, setReportDatasetName] = useState<string>('');

  // AI Validation state
  const [aiValidationEnabled, setAiValidationEnabled] = useState(false);
  const [aiValidationPhase, setAiValidationPhase] = useState<'idle' | 'ready' | 'running' | 'done'>('idle');
  const [aiValidationResults, setAiValidationResults] = useState<AIValidationItem[]>([]);
  const [aiValidationProgress, setAiValidationProgress] = useState({ current: 0, total: 0 });
  const [generatedXmlItems, setGeneratedXmlItems] = useState<Array<{ fileName: string; xmlContent: string }>>([]);
  const [aiProvider, setAiProvider] = useState<AIProvider>('gemini');
  const [pendingExportContext, setPendingExportContext] = useState<{
    zip: JSZip;
    exportedFiles: Array<{ identifier: string; filename: string; imageFiles?: string[] }>;
    referencedImages: Set<string>;
    exportCount: number;
  } | null>(null);
  const [aiFixingItemNo, setAiFixingItemNo] = useState<number | null>(null);

  // Check if free quota is exhausted
  const canUseFeature = !userUsage || userUsage.exports_count === 0 || userUsage.is_unlimited;
  const canUseAIValidation = !!userUsage?.is_unlimited;

  useEffect(() => {
    if (!canUseAIValidation && aiValidationEnabled) {
      setAiValidationEnabled(false);
      setAiValidationPhase('idle');
      setAiValidationResults([]);
      setGeneratedXmlItems([]);
      setPendingExportContext(null);
    }
  }, [canUseAIValidation, aiValidationEnabled]);

  useEffect(() => {
    // Load template XML content when file changes
    if (templateXmlFile && showTemplateMappingUI) {
      templateXmlFile.text().then((content) => {
        setTemplateXmlContent(content);
      });
    }
  }, [templateXmlFile, showTemplateMappingUI]);

  useEffect(() => {
    if (columnMapping?.imageCol) {
      setQuestionMatchColumnForManualMap(columnMapping.imageCol);
    }
  }, [columnMapping?.imageCol]);

  const readTemplateXmlContent = async (): Promise<string | null> => {
    if (hasTemplateXml !== 'yes') {
      return null;
    }

    if (!templateXmlFile) {
      throw new Error('Template XML is required but no file was uploaded');
    }

    const xml = await templateXmlFile.text();
    if (!xml || xml.trim() === '') {
      throw new Error('Template XML file is empty');
    }

    return xml;
  };

  const applyTemplateIfNeeded = (
    templateXmlContent: string | null,
    xmlContent: string,
    fileName: string,
    row?: Record<string, any>,
  ): string => {
    if (!templateXmlContent) {
      return xmlContent;
    }

    const localName = (nodeName: string): string => {
      const parts = nodeName.split(':');
      return parts[parts.length - 1];
    };

    const getMappedColumnByFieldName = (fieldName: string): string | null => {
      if (!templateMapping || !extractedTemplate) {
        return null;
      }

      const field = extractedTemplate.fields.find(
        (f) => f.name.toLowerCase() === fieldName.toLowerCase()
      );

      if (!field) {
        return null;
      }

      return templateMapping[field.id] || null;
    };

    const findSourceRowForMappedValues = (currentRow?: Record<string, any>): SheetRow | null => {
      if (!currentRow) {
        return null;
      }

      if (!templateSheetData || templateSheetData.length === 0) {
        return currentRow as SheetRow;
      }

      const questionIdColumn = getMappedColumnByFieldName('Question ID');
      if (questionIdColumn) {
        const currentQuestionId = String(currentRow[questionIdColumn] ?? '').trim();
        if (currentQuestionId) {
          const matched = templateSheetData.find(
            (r) => String(r[questionIdColumn] ?? '').trim() === currentQuestionId,
          );
          if (matched) {
            return matched;
          }
        }
      }

      if (currentRow.id) {
        const matchedById = templateSheetData.find((r) => String(r.id ?? '') === String(currentRow.id));
        if (matchedById) {
          return matchedById;
        }
      }

      return currentRow as SheetRow;
    };

    const setInnerXml = (doc: Document, element: Element, xmlFragment: string): void => {
      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }

      if (!xmlFragment || xmlFragment.trim() === '') {
        return;
      }

      const fragmentDoc = new DOMParser().parseFromString(`<root>${xmlFragment}</root>`, 'application/xml');
      if (fragmentDoc.querySelector('parsererror')) {
        element.textContent = xmlFragment;
        return;
      }

      const nodes = Array.from(fragmentDoc.documentElement.childNodes);
      nodes.forEach((node) => element.appendChild(doc.importNode(node, true)));
    };

    const normalizeSubsectionToken = (name: string): string => {
      return name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'subsection';
    };

    const getSubsectionMappings = (parentFieldNames: string[]): Array<{ placeholderName: string; columnName: string }> => {
      if (!templateMapping || !extractedTemplate) {
        return [];
      }

      const parentFieldIds = extractedTemplate.fields
        .filter((f) => parentFieldNames.some((name) => f.name.toLowerCase() === name.toLowerCase()))
        .map((f) => f.id);

      if (parentFieldIds.length === 0) {
        return [];
      }

      const result: Array<{ placeholderName: string; columnName: string }> = [];

      Object.entries(templateMapping).forEach(([key, column]) => {
        if (!column) {
          return;
        }

        parentFieldIds.forEach((parentFieldId) => {
          const prefix = `subsection::${parentFieldId}::`;
          if (key.startsWith(prefix)) {
            const rawToken = key.slice(prefix.length);
            const placeholderName = normalizeSubsectionToken(rawToken);
            if (placeholderName) {
              result.push({ placeholderName, columnName: column });
            }
          }
        });
      });

      return result;
    };

    const getFieldModeByName = (fieldName: string): 'add-column' | 'add-subsections' => {
      if (!templateMapping || !extractedTemplate) {
        return 'add-column';
      }

      const field = extractedTemplate.fields.find((f) => f.name.toLowerCase() === fieldName.toLowerCase());
      if (!field) {
        return 'add-column';
      }

      const mode = templateMapping[`mode::${field.id}`];
      return mode === 'add-subsections' ? 'add-subsections' : 'add-column';
    };

    const applyMappedFeedbackOverrides = (
      templateAppliedXml: string,
      sourceRow: SheetRow | null,
    ): string => {
      if (!sourceRow || !templateMapping || !extractedTemplate) {
        return templateAppliedXml;
      }

      const doc = new DOMParser().parseFromString(templateAppliedXml, 'application/xml');
      if (doc.querySelector('parsererror')) {
        return templateAppliedXml;
      }

      const localName = (nodeName: string): string => {
        const parts = nodeName.split(':');
        return parts[parts.length - 1];
      };

      const elements = Array.from(doc.querySelectorAll('*')) as Element[];
      const feedbackNodes = elements.filter((el) => localName(el.nodeName) === 'modalFeedback');
      const promptNodes = elements.filter((el) => localName(el.nodeName) === 'prompt');

      // Apply globally mapped comment placeholders (anywhere in template XML).
      const placeholderFields = extractedTemplate.fields.filter((field) => field.id.startsWith('placeholder_'));
      placeholderFields.forEach((field) => {
        const token = field.id.replace('placeholder_', '');
        const columnName = templateMapping[field.id];
        if (!columnName) return;
        const value = String(sourceRow[columnName] ?? '');
        replacePlaceholder(
          doc.documentElement,
          token,
          value || null,
          containsMath,
          mathFormat,
          processXmlMath,
        );
      });

      // Apply subsection placeholders in Question Stem/Text Entry Prompt.
      const questionSubsections = getSubsectionMappings(['Question Stem', 'Text Entry Prompt']);
      const questionSubsectionMode =
        getFieldModeByName('Question Stem') === 'add-subsections' ||
        getFieldModeByName('Text Entry Prompt') === 'add-subsections';

      if (questionSubsections.length > 0 || questionSubsectionMode) {
        promptNodes.forEach((promptNode) => {
          const mappedQuestionPlaceholders = new Set<string>();

          questionSubsections.forEach(({ placeholderName, columnName }) => {
            const value = String(sourceRow[columnName] ?? '');
            mappedQuestionPlaceholders.add(placeholderName);

            if (value.trim() === '') {
              removePlaceholderSection(promptNode, placeholderName);
            } else {
              replacePlaceholder(
                promptNode,
                placeholderName,
                value || null,
                containsMath,
                mathFormat,
                processXmlMath,
              );
            }
          });

          // In subsection mode, remove unmapped subsection placeholder sections entirely.
          if (questionSubsectionMode) {
            const allPlaceholders = listPlaceholdersInNode(promptNode);
            allPlaceholders.forEach((name) => {
              const columnName = templateMapping[`placeholder_${name}`];
              if (columnName) {
                mappedQuestionPlaceholders.add(name);
              }
            });
            allPlaceholders
              .filter((name) => !mappedQuestionPlaceholders.has(name))
              .forEach((missingName) => removePlaceholderSection(promptNode, missingName));
          }
        });
      }

      feedbackNodes.forEach((feedbackNode) => {
        const identifier = (feedbackNode.getAttribute('identifier') || '').toLowerCase();
        const isIncorrect = identifier.includes('incorrect') || identifier.includes('wrong');
        const isCorrect = !isIncorrect && identifier.includes('correct');

        // Check if this feedback block has placeholders
        const hasPlaceholders = hasFeedbackPlaceholders(feedbackNode);
        const incorrectSubsections = isIncorrect ? getSubsectionMappings(['Incorrect Feedback']) : [];
        const incorrectSubsectionMode = isIncorrect && getFieldModeByName('Incorrect Feedback') === 'add-subsections';

        if (hasPlaceholders) {
          const mappedIncorrectPlaceholders = new Set<string>();
          const placeholdersInFeedback = listPlaceholdersInNode(feedbackNode);
          placeholdersInFeedback.forEach((placeholderName) => {
            const columnName = templateMapping[`placeholder_${placeholderName}`];
            if (!columnName) return;
            const value = String(sourceRow[columnName] ?? '');
            if (isIncorrect) {
              mappedIncorrectPlaceholders.add(placeholderName);
            }
            replacePlaceholder(
              feedbackNode,
              placeholderName,
              value || null,
              containsMath,
              mathFormat,
              processXmlMath,
            );
          });

          if (isIncorrect) {
            // Also apply subsection mappings created in mapping UI.
            incorrectSubsections.forEach(({ placeholderName, columnName }) => {
              const value = String(sourceRow[columnName] ?? '');
              mappedIncorrectPlaceholders.add(placeholderName);

              if (value.trim() === '') {
                removePlaceholderSection(feedbackNode, placeholderName);
              } else {
                replacePlaceholder(
                  feedbackNode,
                  placeholderName,
                  value || null,
                  containsMath,
                  mathFormat,
                  processXmlMath,
                );
              }
            });

            // In subsection mode, remove any unmapped subsection placeholder sections entirely.
            if (incorrectSubsectionMode) {
              const allPlaceholders = listPlaceholdersInNode(feedbackNode);
              allPlaceholders.forEach((name) => {
                const columnName = templateMapping[`placeholder_${name}`];
                if (columnName) {
                  mappedIncorrectPlaceholders.add(name);
                }
              });
              allPlaceholders
                .filter((name) => !mappedIncorrectPlaceholders.has(name))
                .forEach((missingName) => removePlaceholderSection(feedbackNode, missingName));
            }
          }
        } else if (incorrectSubsections.length === 0) {
          // Fallback: use full block replacement for non-placeholder templates (backward compatibility)
          const correctFeedbackColumn = getMappedColumnByFieldName('Correct Feedback');
          const incorrectFeedbackColumn = getMappedColumnByFieldName('Incorrect Feedback');

          if (isCorrect && correctFeedbackColumn) {
            const rawValue = String(sourceRow[correctFeedbackColumn] ?? '');
            const value = containsMath === 'yes' && mathFormat === 'mathml'
              ? processXmlMath(rawValue)
              : rawValue;
            setInnerXml(doc, feedbackNode, value);
          }

          if (isIncorrect && incorrectFeedbackColumn) {
            const rawValue = String(sourceRow[incorrectFeedbackColumn] ?? '');
            const value = containsMath === 'yes' && mathFormat === 'mathml'
              ? processXmlMath(rawValue)
              : rawValue;
            setInnerXml(doc, feedbackNode, value);
          }
        }
      });

      return new XMLSerializer().serializeToString(doc);
    };

    try {
      const mergedXml = applyTemplateXmlToGeneratedItem(templateXmlContent, xmlContent);
      const sourceRow = findSourceRowForMappedValues(row);
      return applyMappedFeedbackOverrides(mergedXml, sourceRow);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Template XML enforcement failed for ${fileName}: ${message}`);
    }
  };


  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setUploadedFiles([file]);
      setConfigurationValidationError("");
    }
  };

  const handleTemplateUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setTemplateXmlFile(files[0]);
    setConfigurationValidationError("");
    // Show mapping UI after template is uploaded
    setShowTemplateMappingUI(true);
  };

  const handleTemplateMappingComplete = (
    mapping: ColumnMapping,
    sheetRows: SheetRow[],
    template: ExtractedTemplate,
  ) => {
    setTemplateMapping(mapping);
    setTemplateSheetData(sheetRows);
    setExtractedTemplate(template);
    setShowTemplateMappingUI(false);
    setConfigurationValidationError("");
  };

  const handleTemplateMappingCancel = () => {
    setShowTemplateMappingUI(false);
    setTemplateXmlFile(null);
    setTemplateMapping(null);
    setTemplateSheetData([]);
    setExtractedTemplate(null);
  };

  const handleMediaFolderUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingMedia(true);
    setMediaValidationErrors([]);

    try {
      const extracted = new Map<string, MediaFile>();
      const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp'];
      const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
      };

      for (const file of Array.from(files)) {
        const normalizedName = normalizeMediaFilename(file.name);
        const matchedExt = imageExtensions.find(ext => normalizedName.endsWith(ext));
        if (!matchedExt) continue;

        const data = await file.arrayBuffer();
        extracted.set(normalizedName, {
          filename: file.name,
          data,
          type: mimeTypes[matchedExt] || 'application/octet-stream',
        });
      }

      if (extracted.size === 0) {
        throw new Error('No supported image files found in the selected folder');
      }

      setMediaZipFile(null);
      setMediaFiles(extracted);
      setUploadedMediaUrls([]);
      setMediaUploadError("");
      setAutoMappedImageRows(0);

      if (editedRows.length > 0 && columnMapping?.imageCol) {
        const validation = validateMediaReferences(editedRows, columnMapping.imageCol, extracted);
        setMediaValidationErrors(validation.errors);
      }
    } catch (error) {
      console.error('Error processing media folder:', error);
      alert(`Error processing media folder: ${error instanceof Error ? error.message : String(error)}`);
      setMediaFiles(new Map());
      setUploadedMediaUrls([]);
    } finally {
      setIsProcessingMedia(false);
    }
  };

  const validateConfigurationBeforeProceed = (): string[] => {
    const errors: string[] = [];

    if (uploadedFiles.length === 0) {
      errors.push('Please upload a source file');
    }

    if (!outputFormat || outputFormat.trim() === '') {
      errors.push('Please select a QTI version');
    }

    if (!exportMode || exportMode.trim() === '') {
      errors.push('Please select an export format');
    }

    if (!containsImages) {
      errors.push('Please specify whether your data contains images');
    }

    if (!containsMath) {
      errors.push('Please specify whether your data contains math');
    }

    if (containsMath === 'yes' && !mathFormat) {
      errors.push('Please choose the supported math format');
    }

    if (!hasTemplateXml) {
      errors.push('Please specify whether you have a template XML');
    }

    if (hasTemplateXml === 'yes' && !templateXmlFile) {
      errors.push('Please upload the template XML file');
    }

    if (containsImages === 'yes' && mediaFiles.size === 0) {
      errors.push('You selected "contains images = yes". Please upload a media ZIP or media folder.');
    }

    return errors;
  };

  const isConfigurationComplete = (): boolean => {
    if (uploadedFiles.length === 0) return false;
    if (!outputFormat || outputFormat.trim() === '') return false;
    if (!exportMode || exportMode.trim() === '') return false;
    if (!containsImages) return false;
    if (!containsMath) return false;
    if (containsMath === 'yes' && !mathFormat) return false;
    if (!hasTemplateXml) return false;
    if (hasTemplateXml === 'yes' && !templateXmlFile) return false;
    return true;
  };

  const handleProceedToValidation = async () => {
    setShowConfigErrors(true);
    const configErrors = validateConfigurationBeforeProceed();
    if (configErrors.length > 0) {
      setConfigurationValidationError(configErrors[0]);
      return;
    }

    const file = uploadedFiles[0];
    if (!file) {
      setConfigurationValidationError('Please upload a source file');
      return;
    }

    setConfigurationValidationError('');

      try {
        setIsValidating(true);
        setValidationProgress(0);
        setValidationProgressText('Parsing file...');

        // Parse file
        const parsed = await parseFile(file);

        // Detect columns
        const detected = detectQuestionColumns(parsed.columns);
        console.log('Detected column mapping:', detected);
        console.log('Available columns:', parsed.columns);

        if (containsImages === 'yes' && !detected.imageCol) {
          // If we are in XML + Media Folder mode, we might be creating the image column via upload mapping
          if (exportMode === 'xml-media-folder') {
            // Check if we have media files to upload which would create the column
            if (mediaFiles.size > 0) {
              console.log('Image column missing, but media upload is active. Utilizing "Image" as new column.');
              detected.imageCol = "Image";
              if (!parsed.columns.includes("Image")) {
                parsed.columns.push("Image");
                setFileData({...parsed});
              }
            } else {
              setConfigurationValidationError(
                `Image column not detected and no media files selected for upload. Please add a column named Image/Img/Diagram.`
              );
              setIsValidating(false);
              return;
            }
          } else {
            setConfigurationValidationError(
              `Image column not detected. Please add a column named Image/Img/Diagram/Figure/Graphic. Detected columns: ${parsed.columns.join(', ')}`
            );
            setIsValidating(false);
            return;
          }
        }

        let rowsToProcess = [...parsed.rows];

        if (exportMode === 'xml-media-folder' && containsImages === 'yes' && detected.imageCol) {
          setValidationProgress(20);
          setValidationProgressText('Uploading media to Supabase and generating URLs...');
          setIsUploadingMediaUrls(true);
          setMediaUploadError('');

          try {
            const uploadedUrls = await uploadMediaFilesToSupabase(mediaFiles);
            setUploadedMediaUrls(uploadedUrls);

            const { rows: rowsWithUrls, mappedCount } = applyUploadedUrlsToRowsBySerial(
              rowsToProcess,
              detected.imageCol,
              uploadedUrls
            );

            rowsToProcess = rowsWithUrls;
            setAutoMappedImageRows(mappedCount);
          } catch (uploadError) {
            const msg = uploadError instanceof Error ? uploadError.message : String(uploadError);
            setMediaUploadError(msg);
            // Non-blocking fallback: continue validation with original/local image values.
            // This lets users proceed even if Supabase bucket/policies are not ready yet.
            setConfigurationValidationError(
              `Media upload failed, continuing without URL mapping: ${msg}`
            );
            setUploadedMediaUrls([]);
            setAutoMappedImageRows(0);
          } finally {
            setIsUploadingMediaUrls(false);
          }
        } else {
          setUploadedMediaUrls([]);
          setMediaUploadError('');
          setAutoMappedImageRows(0);
        }

        setFileData(parsed);
        setColumnMapping(detected);
        setEditedRows([...rowsToProcess]);

        // Use chunked validation for large datasets (> 500 rows)
        setValidationProgressText(`Validating ${rowsToProcess.length} questions...`);
        let resultsMap: Map<string, ValidationResult>;
        
        if (rowsToProcess.length > 500) {
          resultsMap = await validateAllQuestionsChunked(
            rowsToProcess as any,
            detected,
            500, // Chunk size
            (progress, processedCount) => {
              setValidationProgress(progress);
              setValidationProgressText(`Validated ${processedCount} of ${rowsToProcess.length} questions...`);
            }
          );
        } else {
          // For small datasets, validate all at once
          const results = validateAllQuestions(rowsToProcess as any, detected);
          resultsMap = new Map<string, ValidationResult>();
          results.forEach(result => {
            resultsMap.set(result.rowId, result);
          });
          setValidationProgress(100);
        }

        setValidationResults(resultsMap);
        setShowValidationReport(true);
        setIsValidating(false);
      } catch (error) {
        console.error("Error parsing file:", error);
        alert(`Error parsing file: ${error}`);
        setIsValidating(false);
      }
  };


  const handleDataChange = async (updatedRows: Record<string, any>[]) => {
    setEditedRows(updatedRows);

    // For large datasets, only re-validate the visible rows to reduce computation
    if (updatedRows.length > 1000) {
      // Still validate but don't show progress for inline edits
      const newResults = validateAllQuestions(updatedRows as any, columnMapping);
      const resultsMap = new Map<string, ValidationResult>();
      newResults.forEach(result => {
        resultsMap.set(result.rowId, result);
      });
      setValidationResults(resultsMap);
    } else {
      // For smaller datasets, validate all as before
      const newResults = validateAllQuestions(updatedRows as any, columnMapping);
      const resultsMap = new Map<string, ValidationResult>();
      newResults.forEach(result => {
        resultsMap.set(result.rowId, result);
      });
      setValidationResults(resultsMap);
    }
  };

  const applyManualUploadedUrlMapping = async () => {
    if (!columnMapping?.imageCol) {
      setManualMapMessage('Cannot map URLs: image column is not detected in question sheet.');
      return;
    }

    if (!questionMatchColumnForManualMap) {
      setManualMapMessage('Please select a question-sheet match column.');
      return;
    }

    if (uploadedMediaUrls.length === 0) {
      setManualMapMessage('No uploaded image URLs available to map. Upload media first.');
      return;
    }

    const keyToUrl = new Map<string, string>();

    uploadedMediaUrls.forEach((entry) => {
      if (uploadedUrlMatchField === 'serialNumber') {
        if (entry.serialNumber != null) {
          keyToUrl.set(String(entry.serialNumber), entry.publicUrl);
        }
        return;
      }

      const canonical = canonicalImageKey(entry.fileName);
      if (canonical && !keyToUrl.has(canonical)) {
        keyToUrl.set(canonical, entry.publicUrl);
      }
    });

    let mappedCount = 0;
    const updatedRows = editedRows.map((row, index) => {
      let matchValue = '';

      if (questionMatchColumnForManualMap === '__row_serial__') {
        matchValue = String(index + 1);
      } else {
        const raw = row[questionMatchColumnForManualMap];
        matchValue = raw != null ? String(raw).trim() : '';
      }

      if (!matchValue) return row;

      const key = uploadedUrlMatchField === 'serialNumber'
        ? matchValue
        : canonicalImageKey(matchValue);

      const mappedUrl = key ? keyToUrl.get(key) : undefined;
      if (!mappedUrl) return row;

      mappedCount += 1;
      return {
        ...row,
        [columnMapping.imageCol]: mappedUrl,
      };
    });

    await handleDataChange(updatedRows);
    setManualMapMessage(
      mappedCount > 0
        ? `Manual mapping complete: ${mappedCount} row(s) updated with public URLs.`
        : 'Manual mapping complete: no rows matched the selected mapping columns.'
    );
  };

  // Handle media ZIP upload
  const handleMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setMediaZipFile(file);
    setIsProcessingMedia(true);
    setMediaValidationErrors([]);

    try {
      const extracted = await extractMediaZip(file);
      setMediaFiles(extracted);
      setUploadedMediaUrls([]);
      setMediaUploadError("");
      setAutoMappedImageRows(0);

      // Validate references if we have data loaded
      if (editedRows.length > 0 && columnMapping?.imageCol) {
        const validation = validateMediaReferences(editedRows, columnMapping.imageCol, extracted);
        setMediaValidationErrors(validation.errors);
      }

      setIsProcessingMedia(false);
    } catch (error) {
      console.error('Error processing media ZIP:', error);
      alert(`Error processing media ZIP: ${error instanceof Error ? error.message : String(error)}`);
      setIsProcessingMedia(false);
      setMediaZipFile(null);
      setMediaFiles(new Map());
      setUploadedMediaUrls([]);
    }
  };

  // Validate before export
  const validateBeforeExport = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (containsImages === 'yes') {
      if (!columnMapping?.imageCol) {
        errors.push('Contains images is set to Yes, but no image column was detected. Add Image/Img/Diagram column.');
      }

      if (mediaFiles.size === 0) {
        errors.push('Contains images is set to Yes, but no media ZIP/folder is uploaded.');
      }

      if (columnMapping?.imageCol) {
        const imageCol = columnMapping.imageCol;
        const rowsWithMissingImage = editedRows
          .map((row, idx) => ({ row, rowNumber: idx + 1 }))
          .filter(({ row }) => {
            const imageValue = row[imageCol];
            return !imageValue || String(imageValue).trim() === '';
          })
          .slice(0, 10)
          .map(({ rowNumber }) => rowNumber);

        if (rowsWithMissingImage.length > 0) {
          errors.push(`Contains images is Yes, but image filename is empty for row(s): ${rowsWithMissingImage.join(', ')}${editedRows.length > 10 ? ' ...' : ''}`);
        }
      }
    }

    // Check for duplicate IDs
    const idValidation = validateUniqueIds(editedRows);
    if (!idValidation.valid) {
      idValidation.errors.forEach(e => {
        errors.push(`Row ${e.rowNumber}: ${e.message}`);
      });
    }

    // Check answer in options
    const answerValidation = validateAnswerInOptions(editedRows, columnMapping);
    if (!answerValidation.valid) {
      answerValidation.errors.forEach(e => {
        errors.push(`Row ${e.rowNumber}: ${e.message}`);
      });
    }

    // Check media references only when user explicitly enables images.
    if (containsImages === 'yes') {
      if (columnMapping?.imageCol && mediaFiles.size > 0) {
        const mediaValidation = validateMediaReferences(editedRows, columnMapping.imageCol, mediaFiles);
        if (!mediaValidation.valid) {
          mediaValidation.errors.forEach(e => {
            errors.push(`Row ${e.rowNumber}: ${e.message}`);
          });
        }
      } else if (columnMapping?.imageCol) {
        // Check if any row has a LOCAL image reference but no media ZIP uploaded
        // (Ignore rows that already have full URLs)
        const hasLocalImageRefs = editedRows.some(row => {
          const imageValue = row[columnMapping.imageCol];
          const valStr = imageValue ? String(imageValue).trim() : '';
          // It's a local ref if it's not empty and doesn't look like a URL
          return valStr !== '' && !valStr.startsWith('http://') && !valStr.startsWith('https://');
        });

        if (hasLocalImageRefs && mediaFiles.size === 0) {
          errors.push('Questions reference local images but no media ZIP file was uploaded');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  };

  // Remove duplicate questions - keep first occurrence of each duplicate group
  const handleDeduplicate = () => {
    if (!editedRows || editedRows.length === 0) return;

    const duplicateIds = new Set<string>();
    validationResults.forEach((result, rowId) => {
      if (result.warnings.some(w => w.field === 'Duplicate')) {
        duplicateIds.add(rowId);
      }
    });

    if (duplicateIds.size === 0) {
      alert('No duplicate questions detected');
      return;
    }

    // Group duplicates by fingerprint
    const fingerprintGroups = new Map<string, string[]>();
    editedRows.forEach(row => {
      if (!duplicateIds.has(row.id)) return;
      const result = validationResults.get(row.id);
      if (!result) return;

      // Extract fingerprint from question text for grouping
      const questionText = columnMapping.questionCol ? row[columnMapping.questionCol] : '';
      const fingerprint = String(questionText || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

      if (!fingerprintGroups.has(fingerprint)) {
        fingerprintGroups.set(fingerprint, []);
      }
      fingerprintGroups.get(fingerprint)!.push(row.id);
    });

    // Keep first occurrence of each duplicate group, remove others
    const idsToRemove = new Set<string>();
    fingerprintGroups.forEach((ids) => {
      // Sort by row number and keep the first one
      const sortedIds = ids.sort((a, b) => {
        const aIndex = editedRows.findIndex(r => r.id === a);
        const bIndex = editedRows.findIndex(r => r.id === b);
        return aIndex - bIndex;
      });
      // Remove all but the first
      sortedIds.slice(1).forEach(id => idsToRemove.add(id));
    });

    if (idsToRemove.size === 0) {
      alert('No duplicates to remove');
      return;
    }

    const confirmMessage = `This will remove ${idsToRemove.size} duplicate question(s), keeping the first occurrence of each. Continue?`;
    if (!confirm(confirmMessage)) return;

    // Remove duplicates
    const deduplicatedRows = editedRows.filter(row => !idsToRemove.has(row.id));
    handleDataChange(deduplicatedRows);
    alert(`Successfully removed ${idsToRemove.size} duplicate question(s)`);
  };

  const generateQTIManifest = (
    files: Array<{ identifier: string; filename: string; imageFiles?: string[] }>,
    version: 'qti-1.2' | 'qti-2.1' | 'qti-3.0' = 'qti-2.1'
  ) => {
    const timestamp = new Date().toISOString();
    let resourcesXml = '';
    
    // Generate resource entries based on version
    if (version === 'qti-1.2') {
      // QTI 1.2 uses imsqti_xmlv1p2 as resource type
      files.forEach((file, index) => {
        const resourceId = `res_${file.filename.replace('.xml', '')}`;
        let fileRefs = `\n      <file href="${file.filename}"/>`;
        
        // Add image file references if present
        if (file.imageFiles && file.imageFiles.length > 0) {
          file.imageFiles.forEach(img => {
            fileRefs += `\n      <file href="images/${img}"/>`;
          });
        }
        
        resourcesXml += `\n    <resource identifier="${resourceId}" type="imsqti_xmlv1p2" href="${file.filename}">${fileRefs}\n    </resource>`;
      });
    } else {
      // QTI 2.1 and 3.0 use imsqti_item_xmlvXpX format
      let resourceType = 'imsqti_item_xmlv2p1';
      if (version === 'qti-3.0') {
        resourceType = 'imsqti_item_xmlv3p0';
      }
      
      files.forEach((file, index) => {
        const resourceId = `res_${file.filename.replace('.xml', '')}`;
        let fileRefs = `\n      <file href="${file.filename}"/>`;
        
        // Add image file references if present
        if (file.imageFiles && file.imageFiles.length > 0) {
          file.imageFiles.forEach(img => {
            fileRefs += `\n      <file href="images/${img}"/>`;
          });
        }
        
        resourcesXml += `\n    <resource identifier="${resourceId}" type="${resourceType}" href="${file.filename}">${fileRefs}\n    </resource>`;
      });
    }

    let manifest = '';

    // Generate manifest based on version
    if (version === 'qti-1.2') {
      manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST-QTI-12" 
          xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
          xmlns:imsmd="http://www.imsglobal.org/xsd/imsmd_v1p2"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 http://www.imsglobal.org/xsd/imscp_v1p1.xsd">
  <metadata>
    <schema>IMS Content</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations/>
  <resources>${resourcesXml}
  </resources>
</manifest>`;
    } else if (version === 'qti-3.0') {
      manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
          xmlns:imsqti="http://www.imsglobal.org/xsd/imsqti_v3p0"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 http://www.imsglobal.org/xsd/imscp_v1p1/imscp_v1p1.xsd http://www.imsglobal.org/xsd/imsqti_v3p0 http://www.imsglobal.org/xsd/qti/qtiv3p0/imsqti_v3p0.xsd"
          identifier="QTI_EXPORT_MANIFEST"
          version="1.0">

  <metadata>
    <schema>IMS Content Packaging</schema>
    <schemaversion>1.1</schemaversion>
    <created>${timestamp}</created>
  </metadata>

  <organizations/>

  <resources>${resourcesXml}
  </resources>
</manifest>`;
    } else {
      // QTI 2.1 (default)
      manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
          xmlns:imsqti="http://www.imsglobal.org/xsd/imsqti_v2p1"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 http://www.imsglobal.org/xsd/imscp_v1p1/imscp_v1p1.xsd http://www.imsglobal.org/xsd/imsqti_v2p1 http://www.imsglobal.org/xsd/qti/qtiv2p1/imsqti_v2p1.xsd"
          identifier="QTI_EXPORT_MANIFEST"
          version="1.0">

  <metadata>
    <schema>IMS Content Packaging</schema>
    <schemaversion>1.1</schemaversion>
    <created>${timestamp}</created>
  </metadata>

  <organizations/>

  <resources>${resourcesXml}
  </resources>
</manifest>`;
    }

    return manifest;
  };

  const exportToQTI = async () => {
    if (!fileData || !columnMapping) return;

    // Validate required selection fields
    if (!outputFormat || outputFormat.trim() === "") {
      setExportValidationError("Please select a QTI version (1.2, 2.1, or 3.0)");
      return;
    }

    if (!exportMode || exportMode.trim() === "") {
      setExportValidationError("Please select an export format (QTI Package or XML + Media Folder)");
      return;
    }

    setExportValidationError("");

    // Save form data for LMS export
    saveFormDataToLocalStorage();

    // Configure MathML generation mode for QTI


    setIsExporting(true);

    try {
      // Validate before export
      const preExportValidation = validateBeforeExport();
      if (!preExportValidation.valid) {
        const errorMessage = `Export validation failed:\n\n${preExportValidation.errors.slice(0, 10).join('\n')}${preExportValidation.errors.length > 10 ? `\n\n...and ${preExportValidation.errors.length - 10} more errors` : ''}`;
        alert(errorMessage);
        setIsExporting(false);
        return;
      }

      const templateXmlContent = await readTemplateXmlContent();

      const zip = new JSZip();
      let exportCount = 0;
      const exportedFiles: Array<{ identifier: string; filename: string; imageFiles?: string[] }> = [];
      const xmlFilesForValidation: Array<{ fileName: string; xmlContent: string }> = [];
      const referencedImages = new Set<string>();

      for (const row of editedRows) {
        const validationResult = validationResults.get(row.id);
        
        // Skip questions with rejected status (critical errors)
        if (validationResult?.status === 'rejected') {
          continue;
        }
        
        const questionType = validationResult?.detectedType || 'shortanswer';
        const itemNumber = String(exportCount + 1).padStart(3, '0');
        const safeItemIdentifier = `item_${itemNumber}`;
        const fileName = `${safeItemIdentifier}.xml`;

        // Get image filename for this question
        const imageFilename = columnMapping?.imageCol ? row[columnMapping.imageCol] : undefined;
        const imageFilenameStr = imageFilename ? String(imageFilename).trim() : '';
        const normalizedImageKey = imageFilenameStr
          ? (resolveMediaFileKey(mediaFiles, imageFilenameStr) || normalizeMediaFilename(imageFilenameStr))
          : '';
        const matchedMediaFile = normalizedImageKey ? mediaFiles.get(normalizedImageKey) : undefined;
        const resolvedImageFilename = matchedMediaFile?.filename || imageFilenameStr;
        const itemImageFiles: string[] = [];
        
        if (normalizedImageKey) {
          referencedImages.add(normalizedImageKey);
          if (matchedMediaFile?.filename) {
            itemImageFiles.push(matchedMediaFile.filename);
          } else if (resolvedImageFilename) {
            itemImageFiles.push(resolvedImageFilename);
          }
        }

        // Get question text with image inserted
        const originalQuestionText = (row[columnMapping.questionCol] as string) || '';
        const questionTextWithImage = insertImageIntoQuestionText(originalQuestionText, resolvedImageFilename);

        try {
          let xmlContent = '';

          if (questionType === 'mcq') {
            const optionValues = columnMapping.optionCols
              ?.map((col: string) => row[col])
              .filter((v: any) => v !== null && v !== undefined && v !== '') || [];

            const qtiQuestion: QTIQuestion = {
              id: row.id || `q-${Date.now()}`,
              upload_id: 'batch-export',
              identifier: safeItemIdentifier,
              stem: questionTextWithImage,
              type: 'MCQ',
              options: optionValues.map((v: any) => String(v)),
              correct_answer: (row[columnMapping.answerCol] as string) || 'A',
              correctAnswer: (row[columnMapping.answerCol] as string) || 'A',
              validation_status: (validationResult?.status as string) === 'valid' ? 'Valid' : 'Caution',
            };

            const result = await generateQTIByVersion(
              qtiQuestion, 
              outputFormat as 'qti-1.2' | 'qti-2.1' | 'qti-3.0',
              'MCQ'
            );
            if ('error' in result) {
              const oldQti = convertToQTIQuestion(row, 'mcq', columnMapping);
              oldQti.id = safeItemIdentifier;
              oldQti.questionText = questionTextWithImage;
              xmlContent = (await generateQTI(oldQti, outputFormat === 'qti-1.2' ? '1.2' : outputFormat === 'qti-3.0' ? '3.0' : '2.1', 'xml')).xml || '';
            } else {
              xmlContent = result.xml;
            }
          } else if (questionType === 'shortanswer') {
            const qtiQuestion: QTIQuestion = {
              id: row.id || `q-${Date.now()}`,
              upload_id: 'batch-export',
              identifier: safeItemIdentifier,
              stem: questionTextWithImage,
              type: 'ShortAnswer',
              options: [],
              correct_answer: (row[columnMapping.answerCol] as string) || '',
              correctAnswer: (row[columnMapping.answerCol] as string) || '',
              validation_status: (validationResult?.status as string) === 'valid' ? 'Valid' : 'Caution',
            };

            const result = await generateQTIByVersion(
              qtiQuestion,
              outputFormat as 'qti-1.2' | 'qti-2.1' | 'qti-3.0',
              'ShortAnswer'
            );
            if ('error' in result) {
              const oldQti = convertToQTIQuestion(row, 'shortanswer', columnMapping);
              oldQti.id = safeItemIdentifier;
              oldQti.questionText = questionTextWithImage;
              xmlContent = (await generateQTI(oldQti, outputFormat === 'qti-1.2' ? '1.2' : outputFormat === 'qti-3.0' ? '3.0' : '2.1', 'xml')).xml || '';
            } else {
              xmlContent = result.xml;
            }
          } else {
            const oldQti = convertToQTIQuestion(row, questionType, columnMapping);
            oldQti.id = safeItemIdentifier;
            oldQti.questionText = questionTextWithImage;
            xmlContent = (await generateQTI(oldQti, outputFormat === 'qti-1.2' ? '1.2' : outputFormat === 'qti-3.0' ? '3.0' : '2.1', 'xml')).xml || '';
          }

          xmlContent = applyTemplateIfNeeded(templateXmlContent, xmlContent, fileName, row);

          zip.file(fileName, xmlContent);
          exportedFiles.push({ identifier: safeItemIdentifier, filename: fileName, imageFiles: itemImageFiles.length > 0 ? itemImageFiles : undefined });
          xmlFilesForValidation.push({ fileName, xmlContent });
          exportCount++;
        } catch (error) {
          if (templateXmlContent) {
            throw error;
          }

          console.warn(`Error generating QTI for row ${row.id}:`, error);
          const oldQti = convertToQTIQuestion(row, questionType, columnMapping);
          oldQti.id = safeItemIdentifier;
          oldQti.questionText = questionTextWithImage;
          const xml = (await generateQTI(oldQti, outputFormat === 'qti-1.2' ? '1.2' : outputFormat === 'qti-3.0' ? '3.0' : '2.1', 'xml')).xml || '';
          zip.file(fileName, xml);
          exportedFiles.push({ identifier: safeItemIdentifier, filename: fileName, imageFiles: itemImageFiles.length > 0 ? itemImageFiles : undefined });
          xmlFilesForValidation.push({ fileName, xmlContent: xml });
          exportCount++;
        }
      }

      if (exportCount === 0) {
        alert('No valid questions to export');
        setIsExporting(false);
        return;
      }

      // ── AI Validation intercept ──────────────────────────────
      if (aiValidationEnabled && canUseAIValidation) {
        // Store context so we can resume after AI validation
        setGeneratedXmlItems(xmlFilesForValidation);
        setPendingExportContext({ zip, exportedFiles, referencedImages, exportCount });
        setAiValidationProgress({ current: 0, total: xmlFilesForValidation.length });
        setAiValidationPhase('running');
        setIsExporting(false);

        try {
          const results = await runAIValidation(
            xmlFilesForValidation,
            outputFormat,
            aiProvider,
            (current, total) => setAiValidationProgress({ current, total }),
          );

          // Convert any AI-suggested LaTeX back to MathML
          const processedResults = results.map(item => ({
            ...item,
            xmlContent: processXmlMath(item.xmlContent)
          }));
          
          setAiValidationResults(processedResults);
          setAiValidationPhase('done');
        } catch (error) {
          alert('AI validation failed: ' + (error instanceof Error ? error.message : String(error)));
          setAiValidationPhase('idle');
        }
        return; // Don't download yet — user will review and click "Download Valid Items"
      }

      // ── Normal (non-AI) export path ──────────────────────────
      if (referencedImages.size > 0 && mediaFiles.size > 0) {
        const imagesFolder = zip.folder('images');
        if (imagesFolder) {
          referencedImages.forEach(lowerFilename => {
            const mediaFile = mediaFiles.get(lowerFilename);
            if (mediaFile) {
              imagesFolder.file(mediaFile.filename, mediaFile.data);
            }
          });
        }
      }

      // Generate and add imsmanifest.xml
      const manifestXml = generateQTIManifest(
        exportedFiles,
        outputFormat as 'qti-1.2' | 'qti-2.1' | 'qti-3.0'
      );
      zip.file('imsmanifest.xml', manifestXml);

      const blob = await zip.generateAsync({ type: 'blob' });
      downloadZipBlob(blob, exportCount);
    } catch (error) {
      console.error("Export error:", error);
      alert("Error exporting to QTI format: " + (error instanceof Error ? error.message : String(error)));
      setIsExporting(false);
    } finally {
      // Reset MathML mode

    }
  };

  // Download the prepared zip blob
  const downloadZipBlob = async (blob: Blob, count: number) => {
    setIsExporting(true);
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `qti-export-${new Date().toISOString().slice(0, 10)}-${count}questions.zip`;
      link.click();
      URL.revokeObjectURL(url);

      // Track for authenticated users
      if (isAuthenticated) {
        await trackExport();
        await trackQuestionsConverted(count);
      } else {
        // Track for anonymous users in localStorage
        const currentCount = parseInt(localStorage.getItem('localQuestionsConverted') || '0', 10);
        localStorage.setItem('localQuestionsConverted', (currentCount + count).toString());
      }

      alert(`✓ Successfully exported ${count} questions in ZIP file`);
    } finally {
      setIsExporting(false);
    }
  };

  // Export as XML + Media Folder (without manifest or QTI packaging)
  const exportXmlMediaFolder = async () => {
    if (!fileData || !columnMapping) return;

    // Validate required selection fields
    if (!outputFormat || outputFormat.trim() === "") {
      setExportValidationError("Please select a QTI version (1.2, 2.1, or 3.0)");
      return;
    }

    if (!exportMode || exportMode.trim() === "") {
      setExportValidationError("Please select an export format (QTI Package or XML + Media Folder)");
      return;
    }

    setExportValidationError("");

    // Configure MathML generation mode for QTI


    setIsExporting(true);

    try {
      // Validate before export
      const preExportValidation = validateBeforeExport();
      if (!preExportValidation.valid) {
        const errorMessage = `Export validation failed:\n\n${preExportValidation.errors.slice(0, 10).join('\n')}${preExportValidation.errors.length > 10 ? `\n\n...and ${preExportValidation.errors.length - 10} more errors` : ''}`;
        alert(errorMessage);
        setIsExporting(false);
        return;
      }

      const templateXmlContent = await readTemplateXmlContent();

      const zip = new JSZip();
      const xmlFolder = zip.folder('xml');
      const mediaFolder = zip.folder('media');
      
      if (!xmlFolder || !mediaFolder) {
        throw new Error('Failed to create folders');
      }

      let exportCount = 0;
      const referencedImages = new Set<string>();
      const xmlFilesForValidation: Array<{ fileName: string; xmlContent: string }> = [];

      for (const row of editedRows) {
        const validationResult = validationResults.get(row.id);
        
        if (validationResult?.status === 'rejected') {
          continue;
        }
        
        const questionType = validationResult?.detectedType || 'shortanswer';
        const itemNumber = String(exportCount + 1).padStart(5, '0');
        const safeItemIdentifier = `item_${itemNumber}`;
        const fileName = `${safeItemIdentifier}.xml`;

        // Get image filename for this question
        const imageFilename = columnMapping?.imageCol ? row[columnMapping.imageCol] : undefined;
        const imageFilenameStr = imageFilename ? String(imageFilename).trim() : '';
        
        if (imageFilenameStr) {
          if (!imageFilenameStr.startsWith('http://') && !imageFilenameStr.startsWith('https://')) {
            referencedImages.add(imageFilenameStr.toLowerCase());
          }
        }

        // For XML+Media mode, preserve image as a dedicated stem block with URL/local path.
        const originalQuestionText = (row[columnMapping.questionCol] as string) || '';
        const questionTextWithImage = imageFilenameStr
          ? appendImageTagForXmlMedia(originalQuestionText, imageFilenameStr)
          : originalQuestionText;

        try {
          let xmlContent = '';

          if (questionType === 'mcq') {
            const optionValues = columnMapping.optionCols
              ?.map((col: string) => row[col])
              .filter((v: any) => v !== null && v !== undefined && v !== '') || [];

            const qtiQuestion: QTIQuestion = {
              id: row.id || `q-${Date.now()}`,
              upload_id: 'batch-export',
              identifier: safeItemIdentifier,
              stem: questionTextWithImage,
              type: 'MCQ',
              options: optionValues.map((v: any) => String(v)),
              correct_answer: (row[columnMapping.answerCol] as string) || 'A',
              validation_status: (validationResult?.status as string) === 'valid' ? 'Valid' : 'Caution',
            };

            const result = await generateQTIByVersion(
              qtiQuestion, 
              outputFormat as 'qti-1.2' | 'qti-2.1' | 'qti-3.0',
              'MCQ'
            );
            if ('error' in result) {
              const oldQti = convertToQTIQuestion(row, 'mcq', columnMapping);
              oldQti.id = safeItemIdentifier;
              oldQti.questionText = questionTextWithImage;
              xmlContent = (await generateQTI(oldQti, outputFormat === 'qti-1.2' ? '1.2' : outputFormat === 'qti-3.0' ? '3.0' : '2.1', 'xml')).xml || '';
            } else {
              xmlContent = result.xml;
            }
          } else if (questionType === 'shortanswer') {
            const qtiQuestion: QTIQuestion = {
              id: row.id || `q-${Date.now()}`,
              upload_id: 'batch-export',
              identifier: safeItemIdentifier,
              stem: questionTextWithImage,
              type: 'ShortAnswer',
              options: [],
              correct_answer: (row[columnMapping.answerCol] as string) || '',
              validation_status: (validationResult?.status as string) === 'valid' ? 'Valid' : 'Caution',
            };

            const result = await generateQTIByVersion(
              qtiQuestion,
              outputFormat as 'qti-1.2' | 'qti-2.1' | 'qti-3.0',
              'ShortAnswer'
            );
            if ('error' in result) {
              const oldQti = convertToQTIQuestion(row, 'shortanswer', columnMapping);
              oldQti.id = safeItemIdentifier;
              oldQti.questionText = questionTextWithImage;
              xmlContent = (await generateQTI(oldQti, outputFormat === 'qti-1.2' ? '1.2' : outputFormat === 'qti-3.0' ? '3.0' : '2.1', 'xml')).xml || '';
            } else {
              xmlContent = result.xml;
            }
          } else {
            const oldQti = convertToQTIQuestion(row, questionType, columnMapping);
            oldQti.id = safeItemIdentifier;
            oldQti.questionText = questionTextWithImage;
            xmlContent = (await generateQTI(oldQti, outputFormat === 'qti-1.2' ? '1.2' : outputFormat === 'qti-3.0' ? '3.0' : '2.1', 'xml')).xml || '';
          }

          xmlContent = applyTemplateIfNeeded(templateXmlContent, xmlContent, fileName, row);
          xmlContent = ensureXmlContainsImageTagForXmlMedia(xmlContent, imageFilenameStr);
          xmlFolder.file(fileName, xmlContent);
          xmlFilesForValidation.push({ fileName, xmlContent });
          exportCount++;
        } catch (error) {
          if (templateXmlContent) {
            throw error;
          }

          console.warn(`Error generating XML for row ${row.id}:`, error);
          const oldQti = convertToQTIQuestion(row, questionType, columnMapping);
          oldQti.id = safeItemIdentifier;
          oldQti.questionText = questionTextWithImage;
          let xml = (await generateQTI(oldQti, outputFormat === 'qti-1.2' ? '1.2' : outputFormat === 'qti-3.0' ? '3.0' : '2.1', 'xml')).xml || '';
          xml = ensureXmlContainsImageTagForXmlMedia(xml, imageFilenameStr);
          xmlFolder.file(fileName, xml);
          xmlFilesForValidation.push({ fileName, xmlContent: xml });
          exportCount++;
        }
      }

      if (exportCount === 0) {
        alert('No valid questions to export');
        setIsExporting(false);
        return;
      }

      // ── AI Validation intercept ──────────────────────────────
      if (aiValidationEnabled && canUseAIValidation) {
        setGeneratedXmlItems(xmlFilesForValidation);
        setPendingExportContext({ zip, exportedFiles: [], referencedImages, exportCount });
        setAiValidationProgress({ current: 0, total: xmlFilesForValidation.length });
        setAiValidationPhase('running');
        setIsExporting(false);

        try {
          const results = await runAIValidation(
            xmlFilesForValidation,
            outputFormat,
            aiProvider,
            (current, total) => setAiValidationProgress({ current, total }),
          );

          // Convert any AI-suggested LaTeX back to MathML
          const processedResults = results.map(item => ({
            ...item,
            xmlContent: processXmlMath(item.xmlContent)
          }));
          
          setAiValidationResults(processedResults);
          setAiValidationPhase('done');
        } catch (error) {
          alert('AI validation failed: ' + (error instanceof Error ? error.message : String(error)));
          setAiValidationPhase('idle');
        }
        return;
      }

      // ── Normal (non-AI) export path ──────────────────────────
      // Add images to media folder
      if (referencedImages.size > 0 && mediaFiles.size > 0) {
        referencedImages.forEach(lowerFilename => {
          const mediaFile = mediaFiles.get(lowerFilename);
          if (mediaFile) {
            mediaFolder.file(mediaFile.filename, mediaFile.data);
          }
        });
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      
      // Download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `xml-media-export-${new Date().toISOString().slice(0, 10)}-${exportCount}questions.zip`;
      link.click();
      URL.revokeObjectURL(url);

      // Track for authenticated users
      if (isAuthenticated) {
        await trackExport();
        await trackQuestionsConverted(exportCount);
      } else {
        const currentCount = parseInt(localStorage.getItem('localQuestionsConverted') || '0', 10);
        localStorage.setItem('localQuestionsConverted', (currentCount + exportCount).toString());
      }

      alert(`✓ Successfully exported ${exportCount} questions in XML + Media format`);
    } catch (error) {
      console.error("Export error:", error);
      alert("Error exporting: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      // Reset MathML mode

      setIsExporting(false);
    }
  };


  // Save form data to localStorage for LMS export
  const saveFormDataToLocalStorage = () => {
    try {
      const dataToSave = {
        editedRows,
        columnMapping,
        validationResults: Array.from(validationResults.entries()), // Convert Map to array for JSON serialization
      };
      localStorage.setItem('batchCreatorData', JSON.stringify(dataToSave));
    } catch (error) {
      console.error('Error saving form data to localStorage:', error);
    }
  };

  const exportToJSON = async () => {
    if (!fileData || !columnMapping) return;

    // Validate required selection fields
    if (!outputFormat || outputFormat.trim() === "") {
      setExportValidationError("Please select a QTI version (1.2, 2.1, or 3.0)");
      return;
    }

    setExportValidationError("");

    // Save form data for LMS export
    saveFormDataToLocalStorage();

    setIsExporting(true);
    try {
      const qtiQuestions = editedRows
        .filter(row => {
          const validationResult = validationResults.get(row.id);
          // Skip questions with rejected status (critical errors)
          return validationResult?.status !== 'rejected';
        })
        .map(row => {
          const validationResult = validationResults.get(row.id);
          const questionType = validationResult?.detectedType || 'shortanswer';
          return convertToQTIQuestion(row, questionType, columnMapping);
        });

      const json = generateJSON(qtiQuestions);
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `qti-export-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);

      // Track the export
      await trackExport();

      alert(`✓ Successfully exported ${qtiQuestions.length} questions as JSON`);
    } catch (error) {
      console.error("Export error:", error);
      alert("Error exporting to JSON format");
    } finally {
      setIsExporting(false);
    }
  };

  // ── AI Validation Callbacks ────────────────────────────────────────────────

  const handleStartAIValidation = async () => {
    // Configure MathML generation mode for QTI

    setAiValidationPhase('running');
    try {
      const templateXmlContent = await readTemplateXmlContent();

      // Generate XML items for validation
      const itemsToValidate: Array<{ fileName: string; xmlContent: string }> = [];

      // Use valid + caution items for validation
      const itemsForGeneration = editedRows
        .map((row, idx) => ({ row, idx }))
        .filter(({ row }) => {
          const result = validationResults.get(row.id);
          return result && (result.status === 'valid' || result.status === 'caution');
        });

      for (let i = 0; i < itemsForGeneration.length; i++) {
        const { row, idx } = itemsForGeneration[i];
        const itemNumber = String(i + 1).padStart(3, '0');
        const safeItemIdentifier = `item_${itemNumber}`;
        const fileName = `${safeItemIdentifier}.xml`;

        try {
          const validationResult = validationResults.get(row.id);
          const questionType = validationResult?.detectedType || 'shortanswer';

          let xmlContent = '';

          if (questionType === 'mcq') {
            const optionValues = columnMapping.optionCols
              ?.map((col: string) => row[col])
              .filter((v: any) => v !== null && v !== undefined && v !== '') || [];

            const qtiQuestion: QTIQuestion = {
              id: row.id || `q-${Date.now()}`,
              upload_id: 'ai-validation',
              identifier: safeItemIdentifier,
              stem: (row[columnMapping.questionCol] as string) || '',
              type: 'MCQ',
              options: optionValues.map((v: any) => String(v)),
              correct_answer: (row[columnMapping.answerCol] as string) || 'A',
              validation_status: 'Valid',
            };

            const result = await generateQTIByVersion(
              qtiQuestion,
              outputFormat as 'qti-1.2' | 'qti-2.1' | 'qti-3.0',
              'MCQ',
            );
            if ('error' in result) {
              const oldQti = convertToQTIQuestion(row, 'mcq', columnMapping);
              oldQti.id = safeItemIdentifier;
              xmlContent = (await generateQTI(
                oldQti,
                outputFormat === 'qti-1.2' ? '1.2' : outputFormat === 'qti-3.0' ? '3.0' : '2.1',
                'xml',
              )).xml || '';
            } else {
              xmlContent = result.xml;
            }
          } else if (questionType === 'shortanswer') {
            const qtiQuestion: QTIQuestion = {
              id: row.id || `q-${Date.now()}`,
              upload_id: 'ai-validation',
              identifier: safeItemIdentifier,
              stem: (row[columnMapping.questionCol] as string) || '',
              type: 'ShortAnswer',
              options: [],
              correct_answer: (row[columnMapping.answerCol] as string) || '',
              validation_status: 'Valid',
            };

            const result = await generateQTIByVersion(
              qtiQuestion,
              outputFormat as 'qti-1.2' | 'qti-2.1' | 'qti-3.0',
              'ShortAnswer',
            );
            if ('error' in result) {
              const oldQti = convertToQTIQuestion(row, 'shortanswer', columnMapping);
              oldQti.id = safeItemIdentifier;
              xmlContent = (await generateQTI(
                oldQti,
                outputFormat === 'qti-1.2' ? '1.2' : outputFormat === 'qti-3.0' ? '3.0' : '2.1',
                'xml',
              )).xml || '';
            } else {
              xmlContent = result.xml;
            }
          } else {
            const oldQti = convertToQTIQuestion(row, questionType, columnMapping);
            oldQti.id = safeItemIdentifier;
            xmlContent = (await generateQTI(
              oldQti,
              outputFormat === 'qti-1.2' ? '1.2' : outputFormat === 'qti-3.0' ? '3.0' : '2.1',
              'xml',
            )).xml || '';
          }

          xmlContent = applyTemplateIfNeeded(templateXmlContent, xmlContent, fileName, row);

          itemsToValidate.push({ fileName, xmlContent });
        } catch (error) {
          if (templateXmlContent) {
            throw error;
          }

          console.error(`Error generating XML for item ${i + 1}:`, error);
        }
      }

      if (itemsToValidate.length === 0) {
        alert('No items could be generated for validation');
        setAiValidationPhase('idle');
        return;
      }

      setGeneratedXmlItems(itemsToValidate);
      
      // Store context so download button works
      const zip = new JSZip();
      const referencedImages = new Set<string>();
      itemsForGeneration.forEach(({ row }) => {
        const imageFilename = columnMapping?.imageCol ? row[columnMapping.imageCol] : undefined;
        if (imageFilename) referencedImages.add(String(imageFilename).trim().toLowerCase());
      });
      setPendingExportContext({ zip, exportedFiles: [], referencedImages, exportCount: itemsToValidate.length });

      // Run AI validation
      const results = await runAIValidation(
        itemsToValidate,
        outputFormat,
        aiProvider,
        (current, total) => setAiValidationProgress({ current, total }),
      );

      // Convert any AI-suggested LaTeX back to MathML
      const processedResults = results.map(item => ({
        ...item,
        xmlContent: processXmlMath(item.xmlContent)
      }));

      setAiValidationResults(processedResults);
      setAiValidationPhase('done');
    } catch (error) {
      console.error('AI validation error:', error);
      alert('Validation failed: ' + (error instanceof Error ? error.message : String(error)));
      setAiValidationPhase('idle');
    } finally {
      // Reset MathML mode

    }
  };

  const handleAIItemXmlChange = (itemNo: number, newXml: string) => {
    const updated = [...generatedXmlItems];
    if (updated[itemNo]) {
      updated[itemNo].xmlContent = newXml;
      setGeneratedXmlItems(updated);
    }
  };

  const handleAIAutoFix = async (itemNo: number) => {
    const current = generatedXmlItems[itemNo];
    if (!current) return;

    try {
      setAiFixingItemNo(itemNo);
      const fixedXml = await autoFixXml(
        aiProvider,
        current.xmlContent,
        outputFormat || 'qti-3.0',
      );

      // Convert any LaTeX in AI's output back to MathML
      const processedXml = processXmlMath(fixedXml);

      // Update generated XML items
      const updatedGenerated = [...generatedXmlItems];
      updatedGenerated[itemNo] = { ...updatedGenerated[itemNo], xmlContent: processedXml };
      setGeneratedXmlItems(updatedGenerated);

      // Also update validation result copy so UI shows latest XML
      const updatedResults = [...aiValidationResults];
      const existing = updatedResults.find(i => i.itemNo === itemNo);
      if (existing) {
        existing.xmlContent = processedXml;
        setAiValidationResults([...updatedResults]);
      }
    } catch (error) {
      alert('AI fix failed: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setAiFixingItemNo(null);
    }
  };

  const handleAIRevalidate = async () => {
    // Configure MathML generation mode for QTI

    setAiValidationPhase('running');
    try {
      const results = await runAIValidation(
        generatedXmlItems,
        outputFormat,
        aiProvider,
        (current, total) => setAiValidationProgress({ current, total }),
      );

      // Convert any AI-suggested LaTeX back to MathML
      const processedResults = results.map(item => ({
        ...item,
        xmlContent: processXmlMath(item.xmlContent)
      }));

      setAiValidationResults(processedResults);
      setAiValidationPhase('done');
    } catch (error) {
      alert('Re-validation failed: ' + (error instanceof Error ? error.message : String(error)));
      setAiValidationPhase('done');
    } finally {
      // Reset MathML mode

    }
  };

  const handleAIDownloadValid = async () => {
    if (!pendingExportContext) return;

    setIsExporting(true);
    try {
      const validItems = aiValidationResults
        .map((result, idx) => ({ ...result, idx }))
        .filter((item) => item.isValid);

      if (validItems.length === 0) {
        alert('No valid items to download');
        setIsExporting(false);
        return;
      }

      const { zip, referencedImages: allReferencedImages } = pendingExportContext;

      // Rebuild ZIP with only valid items
      const filteredZ = new JSZip();
      
      // Determine folder structure based on exportMode
      const isXmlMedia = exportMode === 'xml-media-folder';
      const xmlFolder = isXmlMedia ? filteredZ.folder('xml') : filteredZ;
      const mediaFolder = isXmlMedia ? filteredZ.folder('media') : filteredZ.folder('images');

      if (isXmlMedia && (!xmlFolder || !mediaFolder)) {
        throw new Error('Failed to create folders in ZIP');
      }

      validItems.forEach((item) => {
        // Use consistent padding (3 for QTI Package, 5 for XML+Media as seen in builders)
        const padding = isXmlMedia ? 5 : 3;
        const fileName = `item_${String(item.idx + 1).padStart(padding, '0')}.xml`;
        
        if (isXmlMedia && xmlFolder) {
          (xmlFolder as any).file(fileName, item.xmlContent);
        } else {
          filteredZ.file(fileName, item.xmlContent);
        }
      });

      // Add images if needed
      if (allReferencedImages.size > 0 && mediaFiles.size > 0 && mediaFolder) {
        allReferencedImages.forEach((lowerFilename) => {
          const mediaFile = mediaFiles.get(lowerFilename);
          if (mediaFile) {
            (mediaFolder as any).file(mediaFile.filename, mediaFile.data);
          }
        });
      }

      // For QTI package mode, add manifest
      if (exportMode === 'qti-package') {
        const manifestXml = generateQTIManifest(
          validItems.map((_, idx) => ({
            identifier: `item_${String(idx + 1).padStart(3, '0')}`,
            filename: `item_${String(idx + 1).padStart(3, '0')}.xml`,
          })),
          outputFormat as 'qti-1.2' | 'qti-2.1' | 'qti-3.0',
        );
        filteredZ.file('imsmanifest.xml', manifestXml);
      }

      const blob = await filteredZ.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `qti-export-validated-${new Date().toISOString().slice(0, 10)}-${validItems.length}questions.zip`;
      link.click();
      URL.revokeObjectURL(url);

      // Track the export
      if (isAuthenticated) {
        await trackExport();
        await trackQuestionsConverted(validItems.length);
      } else {
        const currentCount = parseInt(localStorage.getItem('localQuestionsConverted') || '0', 10);
        localStorage.setItem('localQuestionsConverted', (currentCount + validItems.length).toString());
      }

      alert(`✓ Successfully exported ${validItems.length} valid questions`);
      setAiValidationPhase('idle');
      setGeneratedXmlItems([]);
      setPendingExportContext(null);
    } catch (error) {
      console.error('Download error:', error);
      alert('Error downloading: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsExporting(false);
    }
  };

  const handleAICancel = () => {
    setAiValidationPhase('idle');
    setGeneratedXmlItems([]);
    setPendingExportContext(null);
    setAiValidationResults([]);
    setAiValidationProgress({ current: 0, total: 0 });
  };

  const revalidateAll = async () => {
    setIsValidating(true);
    setValidationProgress(0);
    setValidationProgressText('Re-validating all questions...');

    let resultsMap: Map<string, ValidationResult>;
    
    if (editedRows.length > 500) {
      // Use chunked validation for large datasets
      resultsMap = await validateAllQuestionsChunked(
        editedRows as any,
        columnMapping,
        500,
        (progress, processedCount) => {
          setValidationProgress(progress);
          setValidationProgressText(`Re-validated ${processedCount} of ${editedRows.length} questions...`);
        }
      );
    } else {
      // For smaller datasets, validate all at once
      const results = validateAllQuestions(editedRows as any, columnMapping);
      resultsMap = new Map<string, ValidationResult>();
      results.forEach(result => {
        resultsMap.set(result.rowId, result);
      });
      setValidationProgress(100);
    }

    setValidationResults(resultsMap);
    setIsValidating(false);
  };

  const getValidationStats = () => {
    const stats = {
      valid: 0,
      caution: 0,
      rejected: 0,
      total: validationResults.size,
      duplicates: 0,
      missingAnswers: 0,
      formattingIssues: 0,
    };
    validationResults.forEach(result => {
      stats[result.status]++;

      const issues = [...result.criticalErrors, ...result.warnings];
      const hasDuplicate = issues.some(issue => issue.field === 'Duplicate');
      const hasMissingAnswer = issues.some(
        issue => issue.field === 'Correct Answer' || issue.field === 'Correct Answers'
      );
      const hasFormattingIssue = issues.some(
        issue =>
          issue.field !== 'Duplicate' &&
          issue.field !== 'Correct Answer' &&
          issue.field !== 'Correct Answers'
      );

      if (hasDuplicate) {
        stats.duplicates++;
      }

      if (hasMissingAnswer) {
        stats.missingAnswers++;
      }

      if (hasFormattingIssue) {
        stats.formattingIssues++;
      }
    });
    return stats;
  };

  const escapeHtml = (value: unknown): string => {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const handleDownloadValidationReport = () => {
    const reportStats = getValidationStats();
    const total = Math.max(1, reportStats.total);
    const readyQuestions = reportStats.valid + reportStats.caution;
    const needsReview = reportStats.caution + reportStats.rejected;
    const duplicatePercentageValue = (reportStats.duplicates / total) * 100;
    const needsReviewPercentageValue = (needsReview / total) * 100;
    const duplicatePercentage = duplicatePercentageValue.toFixed(1);
    const needsReviewPercentage = needsReviewPercentageValue.toFixed(1);

    const duplicateRows = Array.from(validationResults.values())
      .filter((result) => result.warnings.some((warning) => warning.field === 'Duplicate'))
      .sort((a, b) => a.rowNumber - b.rowNumber);

    const duplicateQuestionMap = new Map<string, { label: string; rows: number[] }>();
    duplicateRows.forEach((result) => {
      const sourceRow = editedRows.find((row) => row.id === result.rowId);
      const rawQuestion = columnMapping?.questionCol
        ? String(sourceRow?.[columnMapping.questionCol] || '').trim()
        : '';
      const key = rawQuestion.toLowerCase().replace(/\s+/g, ' ').trim() || `row-${result.rowNumber}`;

      if (!duplicateQuestionMap.has(key)) {
        duplicateQuestionMap.set(key, {
          label: rawQuestion || `Question at row ${result.rowNumber}`,
          rows: [],
        });
      }

      duplicateQuestionMap.get(key)!.rows.push(result.rowNumber);
    });

    const duplicateQuestionDetails = Array.from(duplicateQuestionMap.values())
      .map((entry) => ({
        label: entry.label,
        rows: Array.from(new Set(entry.rows)).sort((a, b) => a - b),
      }))
      .filter((entry) => entry.rows.length > 1)
      .sort((a, b) => a.rows[0] - b.rows[0]);

    const duplicateDetailsHtml = duplicateQuestionDetails.length
      ? `<ul class="list">${duplicateQuestionDetails
          .map(
            (entry) => `<li><strong>${escapeHtml(entry.label)}</strong> - appeared ${entry.rows.length} times (rows: ${entry.rows.join(', ')})</li>`
          )
          .join('')}</ul>`
      : 'No duplicate groups found.';

    const flaggedRows = editedRows
      .map((row) => {
        const result = validationResults.get(row.id);
        if (!result) return null;

        const issues = [...result.criticalErrors, ...result.warnings];
        if (issues.length === 0) return null;

        const issueLabels = issues.map((issue) => {
          if (issue.field === 'Duplicate') return 'Duplicate Questions';
          if (issue.field === 'Correct Answer' || issue.field === 'Correct Answers') return 'Missing Critical Data';
          return 'Formatting Issues';
        });

        const uniqueIssueLabels = Array.from(new Set(issueLabels));

        return {
          rowNumber: result.rowNumber,
          questionId: row.id || '-',
          questionText: columnMapping?.questionCol ? String(row[columnMapping.questionCol] || '') : '',
          categories: uniqueIssueLabels.join(', '),
          messages: issues.map((issue) => `${issue.field}: ${issue.message}`).join(' | '),
        };
      })
      .filter((row): row is {
        rowNumber: number;
        questionId: string;
        questionText: string;
        categories: string;
        messages: string;
      } => row !== null)
      .sort((a, b) => a.rowNumber - b.rowNumber);

    const datasetName = reportDatasetName.trim() || fileData?.fileName || 'Untitled Dataset';
    const currentDate = new Date().toLocaleDateString();

    const appendixRowsHtml = flaggedRows.length
      ? flaggedRows
          .map(
            (entry) => `
              <tr>
                <td>${entry.rowNumber}</td>
                <td>${escapeHtml(entry.questionId)}</td>
                <td>${escapeHtml(entry.categories)}</td>
                <td>${escapeHtml(entry.questionText || '-')}</td>
                <td>${escapeHtml(entry.messages)}</td>
              </tr>`
          )
          .join('')
      : `
        <tr>
          <td colspan="5">No issues found.</td>
        </tr>`;

    const reportHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>AssessmentCore Report</title>
    <style>
      @page { size: A4; margin: 14mm; }
      body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; color: #0f172a; line-height: 1.4; }
      .container { max-width: 980px; margin: 0 auto; }
      .header { border-bottom: 2px solid #0f6cbd; padding-bottom: 10px; margin-bottom: 14px; }
      .title { font-size: 22px; font-weight: 700; color: #0f6cbd; margin: 0; }
      .meta { margin-top: 6px; font-size: 13px; color: #334155; }
      .section { margin-top: 14px; border: 1px solid #dbe4ef; border-radius: 8px; padding: 12px; }
      .section h2 { margin: 0 0 10px; font-size: 16px; color: #0f172a; }
      .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
      .tile { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; }
      .tile .label { font-size: 12px; color: #475569; }
      .tile .value { font-size: 18px; font-weight: 700; color: #0f172a; }
      .issues { width: 100%; border-collapse: collapse; font-size: 12px; }
      .issues th, .issues td { border: 1px solid #dbe4ef; padding: 6px; text-align: left; vertical-align: top; }
      .issues th { background: #f1f5f9; }
      .list { margin: 0; padding-left: 18px; }
      .warning-list { margin: 8px 0 0; padding-left: 20px; color: #b45309; }
      .muted { color: #475569; }
      .appendix-title { margin-top: 18px; font-size: 16px; }
      .print-note { margin-top: 10px; font-size: 11px; color: #64748b; }
      @media print {
        .print-note { display: none; }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <header class="header">
        <h1 class="title">AssessmentCore - Question Bank Processing Report</h1>
        <div class="meta"><strong>Dataset:</strong> ${escapeHtml(datasetName)}</div>
        <div class="meta"><strong>Date:</strong> ${escapeHtml(currentDate)}</div>
      </header>

      <section class="section">
        <h2>Executive Summary</h2>
        <div class="grid">
          <div class="tile"><div class="label">Total Questions</div><div class="value">${reportStats.total}</div></div>
          <div class="tile"><div class="label">Ready For Use</div><div class="value">${readyQuestions}</div></div>
          <div class="tile"><div class="label">Rejected</div><div class="value">${reportStats.rejected}</div></div>
          <div class="tile"><div class="label">Duplicate Count</div><div class="value">${reportStats.duplicates}</div></div>
          <div class="tile"><div class="label">Duplicate Percentage</div><div class="value">${duplicatePercentage}%</div></div>
          <div class="tile"><div class="label">Needs Review</div><div class="value">${needsReview}</div></div>
          <div class="tile"><div class="label">Needs Review Percentage</div><div class="value">${needsReviewPercentage}%</div></div>
        </div>
        <ul class="warning-list">
          <li>⚠ Dataset is not ready for direct LMS import</li>
          <li>⚠ High risk of errors if uploaded without cleaning</li>
        </ul>
      </section>

      <section class="section">
        <h2>Key Issues</h2>
        <table class="issues">
          <thead>
            <tr>
              <th>Issue Type</th>
              <th>Count</th>
              <th>Description</th>
              <th>Examples</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Duplicate Questions</td>
              <td>${reportStats.duplicates}</td>
              <td>Duplicate questions detected in the dataset.</td>
              <td>${duplicateDetailsHtml}</td>
            </tr>
            <tr>
              <td>Missing Critical Data</td>
              <td>${reportStats.missingAnswers}</td>
              <td>Questions missing correct answers cannot be imported into LMS.</td>
              <td>-</td>
            </tr>
            <tr>
              <td>Formatting Issues</td>
              <td>${reportStats.formattingIssues}</td>
              <td>Inconsistent structure detected across multiple questions.</td>
              <td>-</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>Processing Actions</h2>
        <ul class="list">
          <li>Duplicate detection and tagging</li>
          <li>Validation of required fields</li>
          <li>Standardization of structure</li>
          <li>Preparation of LMS-ready output</li>
        </ul>
      </section>

      <section class="section">
        <h2>Output</h2>
        <ul class="list">
          <li>Cleaned Dataset</li>
          <li>QTI Package</li>
          <li>JSON Output</li>
        </ul>
      </section>

      <section class="section">
        <h2>Impact</h2>
        <p class="muted">Without automation, approximately ${needsReviewPercentage}% of this dataset would require manual cleaning.</p>
        <p class="muted">For larger datasets (10,000+ questions), this translates to several hours or days of manual effort.</p>
        <p class="muted">AssessmentCore eliminates this effort and ensures LMS-ready compatibility.</p>
      </section>

      <section class="section">
        <h2>Next Steps</h2>
        <p class="muted">We can process your full dataset and deliver fully structured, LMS-ready question banks.</p>
        <p class="muted">Contact us to get a processing estimate.</p>
      </section>

      <h2 class="appendix-title">Appendix: All Issues (Sorted By Row Number)</h2>
      <table class="issues">
        <thead>
          <tr>
            <th>Row #</th>
            <th>Question ID</th>
            <th>Category</th>
            <th>Question</th>
            <th>Issue Details</th>
          </tr>
        </thead>
        <tbody>${appendixRowsHtml}</tbody>
      </table>

      <div class="print-note">This report will open the browser print dialog automatically. Choose Save as PDF to download.</div>
    </div>
    <script>
      window.onload = function () {
        setTimeout(function () {
          window.print();
        }, 250);
      };
    </script>
  </body>
</html>`;

    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
      alert('Popup blocked. Please allow popups and try again to generate the PDF report.');
      return;
    }

    reportWindow.document.open();
    reportWindow.document.write(reportHtml);
    reportWindow.document.close();
  };

  const stats = getValidationStats();
  const imageUrlTableRows = useMemo(() => {
    if (exportMode !== 'xml-media-folder') return [];
    if (containsImages !== 'yes') return [];
    if (!columnMapping?.imageCol) return [];

    const imageCol = columnMapping.imageCol as string;
    const fileNameToUrl = new Map<string, string>();
    const serialToUrl = new Map<number, string>();
    const canonicalFileNameToUrl = new Map<string, string>();

    uploadedMediaUrls.forEach((entry) => {
      const normalizedName = normalizeMediaFilename(entry.fileName);
      if (normalizedName && !fileNameToUrl.has(normalizedName)) {
        fileNameToUrl.set(normalizedName, entry.publicUrl);
      }

      const canonical = canonicalImageKey(entry.fileName);
      if (canonical && !canonicalFileNameToUrl.has(canonical)) {
        canonicalFileNameToUrl.set(canonical, entry.publicUrl);
      }

      if (entry.serialNumber != null && !serialToUrl.has(entry.serialNumber)) {
        serialToUrl.set(entry.serialNumber, entry.publicUrl);
      }
    });

    return editedRows
      .map((row, index) => {
        const rowSerial = index + 1;
        const imageValue = row[imageCol] ? String(row[imageCol]).trim() : '';
        const isExistingUrl = imageValue.startsWith('http://') || imageValue.startsWith('https://');

        let mappedUrl = '';
        if (isExistingUrl) {
          mappedUrl = imageValue;
        } else if (imageValue) {
          const normalized = normalizeMediaFilename(imageValue);
          mappedUrl = normalized ? (fileNameToUrl.get(normalized) || '') : '';

          if (!mappedUrl) {
            const canonical = canonicalImageKey(imageValue);
            mappedUrl = canonical ? (canonicalFileNameToUrl.get(canonical) || '') : '';
          }

          if (!mappedUrl) {
            mappedUrl = serialToUrl.get(rowSerial) || '';
          }
        }

        const status: 'mapped' | 'existing' | 'missing' | 'empty' =
          mappedUrl && isExistingUrl
            ? 'existing'
            : mappedUrl
              ? 'mapped'
              : imageValue
                ? 'missing'
                : 'empty';

        return {
          rowSerial,
          imageValue,
          mappedUrl,
          status,
        };
      })
      .filter((entry) => entry.imageValue || entry.mappedUrl);
  }, [exportMode, containsImages, columnMapping, editedRows, uploadedMediaUrls]);

  // Loading state
  if (loading) {
    return (
      <div className="h-full bg-[#F8FAFC] flex items-center justify-center">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-[#475569]">Loading...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not authenticated - show registration prompt
  if (!isAuthenticated) {
    return (
      <div className="h-full bg-[#F8FAFC] flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-[#0F6CBD]" />
              Authentication Required
            </CardTitle>
            <CardDescription>
              Register or login to use Batch QTI Creator
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-[#F0F9FF] border-[#0F6CBD]">
              <AlertCircle className="h-4 w-4 text-[#0F6CBD]" />
              <AlertTitle className="text-[#1F2937]">Free Trial Available</AlertTitle>
              <AlertDescription className="text-[#475569] text-sm">
                Get 1 free QTI export when you sign up! Perfect for testing our batch conversion features.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <Button
                onClick={() => navigate('/auth/register')}
                className="w-full bg-[#0F6CBD] hover:bg-[#0d4a94] text-white font-medium"
                size="lg"
              >
                <LogIn className="mr-2 h-4 w-4" />
                Create Account
              </Button>

              <Button
                onClick={() => navigate('/auth/login')}
                variant="outline"
                className="w-full border-[#E2E8F0] text-[#0F6CBD] hover:bg-[#F1F5F9]"
                size="lg"
              >
                Sign In
              </Button>
            </div>

            <div className="pt-4 border-t border-[#E2E8F0]">
              <h3 className="font-semibold text-[#1F2937] mb-3">What you get:</h3>
              <ul className="space-y-2 text-sm text-[#475569]">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>1 free QTI export per month on free plan</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Support for up to 100 questions</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Unlimited batch validation</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Feature quota exhausted - show pricing page
  if (!canUseFeature) {
    return (
      <div className="h-full bg-[#F8FAFC] flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#0F6CBD]" />
              Upgrade Your Plan
            </CardTitle>
            <CardDescription>
              You've used your free export quota
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-[#FEF3C7] border-[#FBBF24]">
              <AlertTriangle className="h-4 w-4 text-[#D97706]" />
              <AlertTitle className="text-[#1F2937]">Quota Reached</AlertTitle>
              <AlertDescription className="text-[#475569] text-sm">
                {userUsage?.is_unlimited ? (
                  "You have unlimited exports."
                ) : (
                  `You have ${userUsage?.exports_count || 0} export(s) this month. Upgrade to continue using Batch Creator.`
                )}
              </AlertDescription>
            </Alert>

            <div className="bg-[#F1F5F9] rounded-lg p-4 space-y-3">
              <div>
                <h3 className="font-semibold text-[#1F2937] mb-2">Professional Plan includes:</h3>
                <ul className="space-y-2 text-sm text-[#475569]">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Unlimited QTI exports</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Support for 1000+ questions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Advanced validation & templates</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Priority email support</span>
                  </li>
                </ul>
              </div>
            </div>

            <Button
              disabled
              className="w-full bg-[#94A3B8] text-white font-medium cursor-not-allowed"
              size="lg"
            >
              Pricing Not Available
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#F8FAFC]">
      {/* Template Mapping UI Modal */}
      {showTemplateMappingUI && templateXmlFile && uploadedFiles[0] && templateXmlContent && (
          <div className="fixed inset-0 bg-[#F8FAFC]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl my-auto cursor-default">
            <TemplateMappingUI
              templateXml={templateXmlContent}
              sheetFile={uploadedFiles[0]}
              selectedQtiVersion={
                outputFormat === "qti-1.2"
                  ? "1.2"
                  : outputFormat === "qti-2.1"
                  ? "2.1"
                  : outputFormat === "qti-3.0"
                  ? "3.0"
                  : outputFormat === "json"
                  ? "JSON"
                  : ""
              }
              onMappingComplete={handleTemplateMappingComplete}
              onCancel={handleTemplateMappingCancel}
            />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-[#FFFFFF] border-b border-[#E2E8F0] px-6 h-28 flex items-center">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">Batch QTI Creator</h1>
            <p className="text-[#475569] mt-1">Convert multiple questions to QTI format in one go</p>
            <p className="text-xs text-[#94A3B8] mt-2">
              {userUsage?.is_unlimited ? (
                "Unlimited exports enabled"
              ) : (
                `Free trial - ${userUsage?.exports_count === 0 ? '1' : '0'} export(s) remaining this month`
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {!fileData ? (
          // Upload Section
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Upload File
                </CardTitle>
                <CardDescription>
                  Upload your CSV or Excel file with questions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <label
                  htmlFor="file-upload"
                  className="block w-full cursor-pointer"
                >
                  <div className="border border-dashed border-[#E2E8F0] rounded-lg p-8 text-center hover:border-[#0F6CBD] transition-colors">
                    <Upload className="w-12 h-12 text-[#94A3B8] mx-auto mb-3" />
                    <p className="text-sm font-medium text-[#475569]">Click to upload or drag and drop</p>
                    <p className="text-xs text-[#94A3B8] mt-2">
                      CSV, XLSX, or JSON files (Max 10MB)
                    </p>
                  </div>
                  <input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    accept=".csv,.xlsx,.xls,.json"
                  />
                </label>

                {uploadedFiles.length > 0 && (
                  <div className="bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg p-4">
                    <p className="text-sm font-medium text-[#1F2937] mb-2">File Information</p>
                    {uploadedFiles.map((file, idx) => (
                      <div key={idx} className="text-sm text-[#1F2937]">
                        <p><strong>{file.name}</strong></p>
                        <p className="text-xs text-[#94A3B8]">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    ))}
                  </div>
                )}

                {containsImages === 'yes' && (
                  <div className="border-t border-[#E2E8F0] pt-4 space-y-3">
                    <p className="text-sm font-medium text-[#334155]">Media Files</p>

                    <label
                      htmlFor="media-upload-initial"
                      className="block w-full cursor-pointer"
                    >
                      <div className="border border-dashed border-[#E2E8F0] rounded-lg p-4 text-center hover:border-[#0F6CBD] transition-colors">
                        <Image className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
                        <p className="text-sm font-medium text-[#475569]">Upload Media File (ZIP)</p>
                        <p className="text-xs text-[#94A3B8] mt-1">
                          ZIP containing images (PNG, JPG, GIF, SVG)
                        </p>
                      </div>
                      <input
                        id="media-upload-initial"
                        type="file"
                        className="hidden"
                        onChange={handleMediaUpload}
                        accept=".zip"
                      />
                    </label>

                    <label
                      htmlFor="media-folder-upload-initial"
                      className="block w-full cursor-pointer"
                    >
                      <div className="border border-dashed border-[#E2E8F0] rounded-lg p-4 text-center hover:border-[#0F6CBD] transition-colors">
                        <FolderOpen className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
                        <p className="text-sm font-medium text-[#475569]">Upload Media Folder</p>
                        <p className="text-xs text-[#94A3B8] mt-1">
                          Select a folder that contains image files
                        </p>
                      </div>
                      <input
                        id="media-folder-upload-initial"
                        type="file"
                        className="hidden"
                        multiple
                        onChange={handleMediaFolderUpload}
                        accept=".png,.jpg,.jpeg,.gif,.svg,.webp,.bmp"
                        {...({ webkitdirectory: 'true', directory: 'true' } as any)}
                      />
                    </label>

                    {isProcessingMedia && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-[#475569]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Extracting media files...
                      </div>
                    )}

                    {isUploadingMediaUrls && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-[#475569]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading media to Supabase and generating URLs...
                      </div>
                    )}

                    {(mediaZipFile || mediaFiles.size > 0) && !isProcessingMedia && (
                      <div className="bg-[#F0FDF4] border border-[#16A34A] rounded-lg p-3 mt-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                          <span className="text-sm font-medium text-[#166534]">
                            {mediaZipFile ? mediaZipFile.name : 'Media folder selected'}
                          </span>
                        </div>
                        <p className="text-xs text-[#166534] mt-1">
                          {mediaFiles.size} image(s) loaded
                        </p>
                      </div>
                    )}

                    {mediaUploadError && (
                      <Alert className="bg-[#FEF2F2] border-red-500">
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        <AlertTitle className="text-red-900">Media Upload Error</AlertTitle>
                        <AlertDescription className="text-red-700 text-sm">
                          {mediaUploadError}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {hasTemplateXml === 'yes' && (
                  <div className="border-t border-[#E2E8F0] pt-4 space-y-3">
                    <p className="text-sm font-medium text-[#334155]">Template XML</p>
                    <label
                      htmlFor="template-xml-upload"
                      className="block w-full cursor-pointer"
                    >
                      <div className="border border-dashed border-[#E2E8F0] rounded-lg p-4 text-center hover:border-[#0F6CBD] transition-colors">
                        <FileText className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
                        <p className="text-sm font-medium text-[#475569]">Upload Template XML</p>
                        <p className="text-xs text-[#94A3B8] mt-1">
                          XML template that generated items should follow
                        </p>
                      </div>
                      <input
                        id="template-xml-upload"
                        type="file"
                        className="hidden"
                        onChange={handleTemplateUpload}
                        accept=".xml"
                      />
                    </label>

                    {templateXmlFile && (
                      <div className="bg-[#F0F9FF] border border-[#0F6CBD] rounded-lg p-3">
                        <p className="text-sm font-medium text-[#0C4A6E]">{templateXmlFile.name}</p>
                      </div>
                    )}
                  </div>
                )}

                {isValidating && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-[#475569]">
                      <span>{validationProgressText || 'Processing file...'}</span>
                      <span>{Math.round(validationProgress)}%</span>
                    </div>
                    <Progress value={validationProgress} />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Configuration
                </CardTitle>
                <CardDescription>
                  Set up your export settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#334155] mb-2">
                    QTI Version <span className="text-red-500 font-bold">*</span>
                  </label>
                  <Select value={outputFormat} onValueChange={(v) => {
                    setOutputFormat(v);
                    setExportValidationError("");
                    setConfigurationValidationError("");
                  }}>
                    <SelectTrigger
                      className={`border border-[#E2E8F0] bg-white ${outputFormat === "" && showConfigErrors ? "border-red-500" : ""}`}
                    >
                      <SelectValue placeholder="Select QTI version" />
                    </SelectTrigger>
                    <SelectContent className="border border-[#E2E8F0] bg-white shadow-lg">
                      <SelectItem value="qti-1.2">QTI 1.2</SelectItem>
                      <SelectItem value="qti-2.1">QTI 2.1</SelectItem>
                      <SelectItem value="qti-3.0">QTI 3.0</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                    </SelectContent>
                  </Select>
                  {outputFormat === "" && showConfigErrors && !exportValidationError && (
                    <p className="text-xs text-red-500 mt-1">QTI version is required</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#334155] mb-2">
                    Export Format <span className="text-red-500 font-bold">*</span>
                  </label>
                  <Select value={exportMode} onValueChange={(v) => {
                    setExportMode(v as 'qti-package' | 'xml-media-folder');
                    setExportValidationError("");
                    setConfigurationValidationError("");
                  }}>
                    <SelectTrigger
                      className={`border border-[#E2E8F0] bg-white ${exportMode === "" && showConfigErrors ? "border-red-500" : ""}`}
                    >
                      <SelectValue placeholder="Select export format" />
                    </SelectTrigger>
                    <SelectContent className="border border-[#E2E8F0] bg-white shadow-lg">
                      <SelectItem value="qti-package">QTI Package (ZIP with manifest)</SelectItem>
                      <SelectItem value="xml-media-folder">XML + Media Folder</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    {exportMode === 'qti-package' 
                      ? 'Creates importable QTI package with imsmanifest.xml'
                      : exportMode === 'xml-media-folder'
                      ? 'Creates separate xml/ and media/ folders without manifest'
                      : 'Select a format to see description'}
                  </p>
                  {exportMode === "" && showConfigErrors && !exportValidationError && (
                    <p className="text-xs text-red-500 mt-1">Export format is required</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#334155] mb-2">
                    Does your data contain images? <span className="text-red-500 font-bold">*</span>
                  </label>
                  <Select value={containsImages} onValueChange={(v) => {
                    setContainsImages(v as "yes" | "no");
                    setConfigurationValidationError("");
                    if (v === 'no') {
                      setMediaZipFile(null);
                      setMediaFiles(new Map());
                      setMediaValidationErrors([]);
                    }
                  }}>
                    <SelectTrigger
                      className={`border border-[#E2E8F0] bg-white ${containsImages === "" && showConfigErrors ? "border-red-500" : ""}`}
                    >
                      <SelectValue placeholder="Select yes or no" />
                    </SelectTrigger>
                    <SelectContent className="border border-[#E2E8F0] bg-white shadow-lg">
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#334155] mb-2">
                    Does your data contain math? <span className="text-red-500 font-bold">*</span>
                  </label>
                  <Select value={containsMath} onValueChange={(v) => {
                    setContainsMath(v as "yes" | "no");
                    setConfigurationValidationError("");
                    if (v === 'no') {
                      setMathFormat("");
                    }
                  }}>
                    <SelectTrigger
                      className={`border border-[#E2E8F0] bg-white ${containsMath === "" && showConfigErrors ? "border-red-500" : ""}`}
                    >
                      <SelectValue placeholder="Select yes or no" />
                    </SelectTrigger>
                    <SelectContent className="border border-[#E2E8F0] bg-white shadow-lg">
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {containsMath === 'yes' && (
                  <div>
                    <label className="block text-sm font-medium text-[#334155] mb-2">
                      Choose the supported format <span className="text-red-500 font-bold">*</span>
                    </label>
                    <Select value={mathFormat} onValueChange={(v) => {
                      setMathFormat(v as "mathjax" | "mathml");
                      setConfigurationValidationError("");
                    }}>
                      <SelectTrigger
                        className={`border border-[#E2E8F0] bg-white ${mathFormat === "" && showConfigErrors ? "border-red-500" : ""}`}
                      >
                        <SelectValue placeholder="Select math format" />
                      </SelectTrigger>
                      <SelectContent className="border border-[#E2E8F0] bg-white shadow-lg">
                        <SelectItem value="mathjax">MathJax</SelectItem>
                        <SelectItem value="mathml">MathML</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-[#334155] mb-2">
                    Do you have template XML that items should follow? <span className="text-red-500 font-bold">*</span>
                  </label>
                  <Select value={hasTemplateXml} onValueChange={(v) => {
                    setHasTemplateXml(v as "yes" | "no");
                    setConfigurationValidationError("");
                    if (v === 'no') {
                      setTemplateXmlFile(null);
                    }
                  }}>
                    <SelectTrigger
                      className={`border border-[#E2E8F0] bg-white ${hasTemplateXml === "" && showConfigErrors ? "border-red-500" : ""}`}
                    >
                      <SelectValue placeholder="Select yes or no" />
                    </SelectTrigger>
                    <SelectContent className="border border-[#E2E8F0] bg-white shadow-lg">
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {configurationValidationError && (
                  <Alert className="bg-[#FEF2F2] border-red-500">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <AlertTitle className="text-red-900">Configuration Required</AlertTitle>
                    <AlertDescription className="text-red-700 text-sm">
                      {configurationValidationError}
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handleProceedToValidation}
                  disabled={isValidating || !isConfigurationComplete()}
                  className="w-full bg-[#0F6CBD] hover:bg-[#0B5A9A] active:bg-[#094A7F] text-white font-semibold rounded-md"
                  title={!isConfigurationComplete() ? 'Complete all required configuration fields to proceed' : ''}
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Proceed to Validation
                    </>
                  )}
                </Button>

                {exportValidationError && (
                  <Alert className="bg-[#FEF2F2] border-red-500">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <AlertTitle className="text-red-900">Missing Required Fields</AlertTitle>
                    <AlertDescription className="text-red-700 text-sm">
                      {exportValidationError}
                    </AlertDescription>
                  </Alert>
                )}

                <Alert className="bg-[#F1F5F9] border-[#E2E8F0]">
                  <FileJson className="h-4 w-4 text-[#0F6CBD]" />
                  <AlertTitle className="text-[#1F2937]">Smart Detection</AlertTitle>
                  <AlertDescription className="text-[#475569] text-sm">
                    Your columns and question types will be automatically detected from the file
                  </AlertDescription>
                </Alert>

                <Alert className="bg-[#F0FDF4] border-[#16A34A]">
                  <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                  <AlertTitle className="text-[#166534]">Validation</AlertTitle>
                  <AlertDescription className="text-[#166534] text-sm">
                    Questions will be validated for completeness and correctness
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        ) : (
          // Results Section
          <div className="space-y-6">
            {exportMode === 'xml-media-folder' && containsImages === 'yes' && (
              <>
                {mediaUploadError && (
                  <Alert className="bg-[#FEF2F2] border-red-500">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <AlertTitle className="text-red-900">Image URL Mapping Not Applied</AlertTitle>
                    <AlertDescription className="text-red-700 text-sm">
                      {mediaUploadError}
                    </AlertDescription>
                  </Alert>
                )}

                {!mediaUploadError && uploadedMediaUrls.length === 0 && mediaFiles.size > 0 && (
                  <Alert className="bg-[#FFFBEB] border-[#F59E0B]">
                    <AlertTriangle className="h-4 w-4 text-[#B45309]" />
                    <AlertTitle className="text-[#78350F]">No Image URLs Generated</AlertTitle>
                    <AlertDescription className="text-[#92400E] text-sm">
                      Images are loaded, but no public URLs were generated during validation. Your rows are currently using local image values.
                    </AlertDescription>
                  </Alert>
                )}

                {uploadedMediaUrls.length > 0 && (
                  <Alert className="bg-[#F0FDF4] border-[#16A34A]">
                    <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                    <AlertTitle className="text-[#166534]">Image URL Mapping Applied</AlertTitle>
                    <AlertDescription className="text-[#166534] text-sm">
                      {uploadedMediaUrls.length} URL(s) generated and {autoMappedImageRows} row(s) mapped in the image column.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-[#475569] text-sm mb-1">Total Questions</p>
                    <p className="text-3xl font-bold text-[#111827]">{stats.total}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-[#475569] text-sm mb-1 flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                      Valid
                    </p>
                    <p className="text-3xl font-bold text-[#16A34A]">{stats.valid}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-[#475569] text-sm mb-1 flex items-center justify-center gap-1">
                      <AlertCircle className="w-4 h-4 text-[#D97706]" />
                      Caution
                    </p>
                    <p className="text-3xl font-bold text-[#D97706]">{stats.caution}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-[#475569] text-sm mb-1 flex items-center justify-center gap-1">
                      <XCircle className="w-4 h-4 text-[#DC2626]" />
                      Rejected
                    </p>
                    <p className="text-3xl font-bold text-[#DC2626]">{stats.rejected}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-[#475569] text-sm mb-1 flex items-center justify-center gap-1">
                      <Copy className="w-4 h-4 text-[#F59E0B]" />
                      Duplicates
                    </p>
                    <p className="text-3xl font-bold text-[#F59E0B]">{stats.duplicates}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* File Info Card */}
            <div className="flex justify-between items-center">
              <Card className="flex-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileJson className="w-5 h-5" />
                    File Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-[#475569]">File Name</p>
                      <p className="font-medium text-[#111827]">{fileData?.fileName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-[#475569]">Total Rows</p>
                      <p className="font-medium text-[#111827]">{fileData?.rows.length || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-[#475569]">Columns Detected</p>
                      <p className="font-medium text-[#111827]">{fileData?.columns.length || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-[#475569]">Can Process</p>
                      <p className="font-medium text-[#16A34A]">{stats.valid + stats.caution}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-[#475569] mb-1">Dataset Name (for PDF report)</p>
                    <Input
                      value={reportDatasetName}
                      onChange={(event) => setReportDatasetName(event.target.value)}
                      placeholder={fileData?.fileName || 'Enter dataset name'}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="ml-4 flex flex-col gap-2">
                <Button
                  onClick={handleDownloadValidationReport}
                  variant="outline"
                  className="font-semibold border border-[#0F6CBD] text-[#0F6CBD] hover:bg-[#EFF6FF] rounded-md"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF Report
                </Button>

                <Button
                  onClick={() => setShowValidationReport(!showValidationReport)}
                  variant={showValidationReport ? "default" : "outline"}
                  className={
                    showValidationReport
                      ? "font-semibold bg-[#0F6CBD] hover:bg-[#0B5A9A] active:bg-[#094A7F] text-white rounded-md"
                      : "font-semibold border border-[#334155] text-[#1F2937] hover:bg-[#F1F5F9] rounded-md"
                  }
                >
                  {showValidationReport ? (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Hide Details
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-4 h-4 mr-2" />
                      View Details
                    </>
                  )}
                </Button>

                {stats.duplicates > 0 && (
                  <Button
                    onClick={handleDeduplicate}
                    variant="outline"
                    className="font-semibold border border-[#F59E0B] text-[#F59E0B] hover:bg-[#FEF3C7] rounded-md"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Remove Duplicates ({stats.duplicates})
                  </Button>
                )}
              </div>
            </div>

            {exportMode === 'xml-media-folder' && containsImages === 'yes' && columnMapping?.imageCol && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Image className="w-5 h-5" />
                    Image and URL Mapping
                  </CardTitle>
                  <CardDescription>
                    Validation-stage table of image values and corresponding public URLs.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="border border-[#E2E8F0] rounded-lg p-3 bg-[#F8FAFC] space-y-3">
                    <p className="text-sm font-medium text-[#334155]">
                      Manual Mapping (Uploaded Image URL Table {'->'} Question Sheet)
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-[#64748B] mb-1">Question Sheet Match Column</label>
                        <Select
                          value={questionMatchColumnForManualMap}
                          onValueChange={(v) => setQuestionMatchColumnForManualMap(v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select question match column" />
                          </SelectTrigger>
                          <SelectContent className="border border-[#E2E8F0] bg-white shadow-lg">
                            <SelectItem value="__row_serial__">Row Serial (#)</SelectItem>
                            {(fileData?.columns || []).map((col) => (
                              <SelectItem key={`manual-map-col-${col}`} value={col}>{col}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="block text-xs text-[#64748B] mb-1">Uploaded URL Table Match Column</label>
                        <Select
                          value={uploadedUrlMatchField}
                          onValueChange={(v) => setUploadedUrlMatchField(v as UploadedUrlMatchField)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select uploaded table column" />
                          </SelectTrigger>
                          <SelectContent className="border border-[#E2E8F0] bg-white shadow-lg">
                            <SelectItem value="fileName">Image File Name</SelectItem>
                            <SelectItem value="serialNumber">Serial Number</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-end">
                        <Button
                          type="button"
                          className="w-full bg-[#0F6CBD] hover:bg-[#0B5A9A] text-white"
                          onClick={applyManualUploadedUrlMapping}
                          disabled={uploadedMediaUrls.length === 0 || !questionMatchColumnForManualMap}
                        >
                          Apply Manual Mapping
                        </Button>
                      </div>
                    </div>

                    <p className="text-xs text-[#64748B]">
                      Target column in question sheet: <span className="font-semibold">{columnMapping.imageCol}</span>
                    </p>

                    {manualMapMessage && (
                      <Alert className="bg-[#FFFFFF] border-[#CBD5E1]">
                        <AlertCircle className="h-4 w-4 text-[#0F6CBD]" />
                        <AlertDescription className="text-sm text-[#334155]">
                          {manualMapMessage}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  <div className="text-sm text-[#334155]">
                    {imageUrlTableRows.filter(r => r.mappedUrl).length} row(s) have URL values and {imageUrlTableRows.filter(r => r.status === 'missing').length} row(s) are pending mapping.
                  </div>
                  <div className="overflow-x-auto border border-[#E2E8F0] rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F8FAFC] text-[#334155]">
                        <tr>
                          <th className="text-left px-3 py-2 border-b border-[#E2E8F0]">Row Serial</th>
                          <th className="text-left px-3 py-2 border-b border-[#E2E8F0]">Image</th>
                          <th className="text-left px-3 py-2 border-b border-[#E2E8F0]">Image URL</th>
                          <th className="text-left px-3 py-2 border-b border-[#E2E8F0]">Status</th>
                          <th className="text-left px-3 py-2 border-b border-[#E2E8F0]">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {imageUrlTableRows.map((entry, idx) => (
                          <tr key={`${entry.rowSerial}-${idx}`} className="odd:bg-white even:bg-[#FCFDFF]">
                            <td className="px-3 py-2 border-b border-[#F1F5F9]">
                              {entry.rowSerial}
                            </td>
                            <td className="px-3 py-2 border-b border-[#F1F5F9]">{entry.imageValue || '-'}</td>
                            <td className="px-3 py-2 border-b border-[#F1F5F9] break-all text-[#0F6CBD]">
                              {entry.mappedUrl || '-'}
                            </td>
                            <td className="px-3 py-2 border-b border-[#F1F5F9]">
                              {entry.status === 'existing' ? (
                                <Badge className="bg-[#E0F2FE] text-[#0C4A6E]">Existing URL</Badge>
                              ) : entry.status === 'mapped' ? (
                                <Badge className="bg-[#DCFCE7] text-[#166534]">Mapped</Badge>
                              ) : entry.status === 'missing' ? (
                                <Badge className="bg-[#FEF3C7] text-[#92400E]">Not Mapped</Badge>
                              ) : (
                                <Badge variant="outline">Empty</Badge>
                              )}
                            </td>
                            <td className="px-3 py-2 border-b border-[#F1F5F9]">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={!entry.mappedUrl}
                                onClick={() => {
                                  if (entry.mappedUrl && navigator?.clipboard?.writeText) {
                                    navigator.clipboard.writeText(entry.mappedUrl);
                                  }
                                }}
                              >
                                Copy URL
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {imageUrlTableRows.length === 0 && (
                          <tr>
                            <td className="px-3 py-3 text-[#64748B]" colSpan={6}>
                              No image values found in rows yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Validation Report - BEFORE Export Section */}
            {showValidationReport && fileData && (
              editedRows.length > 1000 ? (
                <ValidationReportOptimized
                  columns={fileData.columns}
                  rows={editedRows}
                  validationResults={validationResults}
                  onDataChange={handleDataChange}
                />
              ) : (
                <ValidationReport
                  columns={fileData.columns}
                  rows={editedRows}
                  validationResults={validationResults}
                  onDataChange={handleDataChange}
                />
              )
            )}

            {/* Actions - Export Section */}
            {aiValidationEnabled && aiValidationPhase !== 'idle' ? (
              // AI Validation Report
              <AIValidationReport
                phase={aiValidationPhase as 'ready' | 'running' | 'done'}
                items={aiValidationResults}
                totalItems={editedRows.filter((row) => {
                  const result = validationResults.get(row.id);
                  return result && (result.status === 'valid' || result.status === 'caution');
                }).length}
                availableProviders={getAvailableProviders()}
                currentProvider={aiProvider}
                onProviderChange={setAiProvider}
                onStartValidation={handleStartAIValidation}
                onItemXmlChange={handleAIItemXmlChange}
                onItemAutoFix={handleAIAutoFix}
                onRevalidate={handleAIRevalidate}
                onDownloadValid={handleAIDownloadValid}
                onCancel={handleAICancel}
                isRevalidating={aiValidationPhase === 'running'}
                isDownloading={isExporting}
                fixingItemNo={aiFixingItemNo}
                progress={aiValidationPhase === 'running' ? aiValidationProgress : undefined}
              />
            ) : (
              // Export Card
              <Card className="border border-[#0F6CBD] bg-[#F8FAFC]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="w-5 h-5 text-[#0F6CBD]" />
                    Generate QTI/JSON Files
                  </CardTitle>

                  {/* AI Validation Toggle */}
                  {getAvailableProviders().length > 0 && (
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#E2E8F0]">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-[#0F6CBD]" />
                        <span className="text-sm font-medium text-[#111827]">
                          AI Validation
                          {!canUseAIValidation && " (Unlimited plan only)"}
                        </span>
                      </div>
                      <Switch
                        checked={aiValidationEnabled}
                        disabled={!canUseAIValidation}
                        onCheckedChange={(checked) => {
                          setAiValidationEnabled(checked);
                          if (checked) {
                            setAiValidationPhase('ready');
                          } else {
                            setAiValidationPhase('idle');
                            setAiValidationResults([]);
                            setGeneratedXmlItems([]);
                            setPendingExportContext(null);
                          }
                        }}
                      />
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert className="bg-[#FFFFFF] border-[#E2E8F0]">
                  <FileJson className="h-4 w-4 text-[#0F6CBD]" />
                  <AlertTitle className="text-[#1F2937]">Ready to Export</AlertTitle>
                  <AlertDescription className="text-[#475569] text-sm">
                    <span className="font-semibold text-[#16A34A]">{stats.valid + stats.caution} questions</span> ready to export ({stats.valid} valid, {stats.caution} with warnings) • <span className="font-semibold text-[#DC2626]">{stats.rejected} rejected</span>
                    {stats.duplicates > 0 && (
                      <span> • <span className="font-semibold text-[#F59E0B]">{stats.duplicates} duplicates detected</span></span>
                    )}
                  </AlertDescription>
                </Alert>

                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={exportMode === 'qti-package' ? exportToQTI : exportXmlMediaFolder}
                    disabled={isExporting || (stats.valid + stats.caution) === 0 || !outputFormat || !exportMode}
                    className={`font-semibold px-6 rounded-md ${
                      !outputFormat || !exportMode
                        ? "bg-[#94A3B8] text-white cursor-not-allowed"
                        : "bg-[#0F6CBD] hover:bg-[#0B5A9A] active:bg-[#094A7F] text-white"
                    }`}
                    size="lg"
                    title={!outputFormat || !exportMode ? "Please select both QTI version and export format" : ""}
                  >
                    {isExporting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Exporting...
                      </>
                    ) : exportMode === 'qti-package' ? (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Export {outputFormat ? outputFormat.toUpperCase() : "QTI"} Package
                      </>
                    ) : (
                      <>
                        <FolderOpen className="w-4 h-4 mr-2" />
                        Export XML + Media
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={exportToJSON}
                    disabled={isExporting || (stats.valid + stats.caution) === 0 || !outputFormat}
                    variant="outline"
                    className={`font-semibold px-6 rounded-md ${
                      !outputFormat
                        ? "border-[#94A3B8] text-[#94A3B8] cursor-not-allowed"
                        : "border border-[#334155] text-[#1F2937] hover:bg-[#F1F5F9]"
                    }`}
                    size="lg"
                    title={!outputFormat ? "Please select QTI version" : ""}
                  >
                    {isExporting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <FileJson className="w-4 h-4 mr-2" />
                        Export as JSON
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={revalidateAll}
                    disabled={isValidating}
                    variant="outline"
                    className="font-semibold px-6 border border-[#334155] text-[#1F2937] hover:bg-[#F1F5F9] rounded-md"
                    size="lg"
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Revalidating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Revalidate
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={() => {
                      setFileData(null);
                      setUploadedFiles([]);
                      setValidationResults(new Map());
                      setShowValidationReport(false);
                      setMediaZipFile(null);
                      setMediaFiles(new Map());
                      setMediaValidationErrors([]);
                      setContainsImages("");
                      setContainsMath("");
                      setMathFormat("");
                      setHasTemplateXml("");
                      setTemplateXmlFile(null);
                      setConfigurationValidationError("");
                      setShowConfigErrors(false);
                    }}
                    variant="ghost"
                    className="font-semibold px-6 text-[#0F6CBD] hover:bg-[#E0F2FE] rounded-md"
                    size="lg"
                  >
                    Start Over
                  </Button>
                </div>
              </CardContent>
            </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
