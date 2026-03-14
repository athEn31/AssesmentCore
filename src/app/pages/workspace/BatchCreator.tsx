import { useState, useEffect } from "react";
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
import { 
  generateAndValidateMCQ, 
  generateAndValidateTextEntry, 
  generateQTIByVersion,
  Question as QTIQuestion 
} from "../../../engine";
import { processXmlMath } from "../../utils/mathmlConverter";
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
  getImagesForPackaging,
  validateAnswerInOptions,
  validateUniqueIds,
  MediaFile,
  MediaValidationError,
} from "../../utils/mediaUtils";



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
  const [exportMode, setExportMode] = useState<'qti-package' | 'xml-media-folder' | "">("");
  const [containsImages, setContainsImages] = useState<"yes" | "no" | "">("");
  const [containsMath, setContainsMath] = useState<"yes" | "no" | "">("");
  const [mathFormat, setMathFormat] = useState<"mathjax" | "mathml" | "">("");
  const [hasTemplateXml, setHasTemplateXml] = useState<"yes" | "no" | "">("");
  const [templateXmlFile, setTemplateXmlFile] = useState<File | null>(null);
  const [configurationValidationError, setConfigurationValidationError] = useState<string>("");
  const [showConfigErrors, setShowConfigErrors] = useState(false);

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
        const lowerName = file.name.toLowerCase();
        const matchedExt = imageExtensions.find(ext => lowerName.endsWith(ext));
        if (!matchedExt) continue;

        const data = await file.arrayBuffer();
        extracted.set(lowerName, {
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

      if (editedRows.length > 0 && columnMapping?.imageCol) {
        const validation = validateMediaReferences(editedRows, columnMapping.imageCol, extracted);
        setMediaValidationErrors(validation.errors);
      }
    } catch (error) {
      console.error('Error processing media folder:', error);
      alert(`Error processing media folder: ${error instanceof Error ? error.message : String(error)}`);
      setMediaFiles(new Map());
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
        setFileData(parsed);

        // Detect columns
        const detected = detectQuestionColumns(parsed.columns);
        console.log('Detected column mapping:', detected);
        console.log('Available columns:', parsed.columns);
        setColumnMapping(detected);
        setEditedRows([...parsed.rows]);

        // Use chunked validation for large datasets (> 500 rows)
        setValidationProgressText(`Validating ${parsed.rows.length} questions...`);
        let resultsMap: Map<string, ValidationResult>;
        
        if (parsed.rows.length > 500) {
          resultsMap = await validateAllQuestionsChunked(
            parsed.rows as any,
            detected,
            500, // Chunk size
            (progress, processedCount) => {
              setValidationProgress(progress);
              setValidationProgressText(`Validated ${processedCount} of ${parsed.rows.length} questions...`);
            }
          );
        } else {
          // For small datasets, validate all at once
          const results = validateAllQuestions(parsed.rows as any, detected);
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
    }
  };

  // Validate before export
  const validateBeforeExport = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

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

    // Check media references
    if (columnMapping?.imageCol && mediaFiles.size > 0) {
      const mediaValidation = validateMediaReferences(editedRows, columnMapping.imageCol, mediaFiles);
      if (!mediaValidation.valid) {
        mediaValidation.errors.forEach(e => {
          errors.push(`Row ${e.rowNumber}: ${e.message}`);
        });
      }
    } else if (columnMapping?.imageCol) {
      // Check if any row has an image reference but no media ZIP uploaded
      const hasImageRefs = editedRows.some(row => {
        const imageValue = row[columnMapping.imageCol];
        return imageValue && String(imageValue).trim() !== '';
      });
      if (hasImageRefs && mediaFiles.size === 0) {
        errors.push('Questions reference images but no media ZIP file was uploaded');
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
        const itemImageFiles: string[] = [];
        
        if (imageFilenameStr) {
          referencedImages.add(imageFilenameStr.toLowerCase());
          itemImageFiles.push(imageFilenameStr);
        }

        // Get question text with image inserted
        const originalQuestionText = (row[columnMapping.questionCol] as string) || '';
        const questionTextWithImage = insertImageIntoQuestionText(originalQuestionText, imageFilenameStr);

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

          zip.file(fileName, xmlContent);
          exportedFiles.push({ identifier: safeItemIdentifier, filename: fileName, imageFiles: itemImageFiles.length > 0 ? itemImageFiles : undefined });
          xmlFilesForValidation.push({ fileName, xmlContent });
          exportCount++;
        } catch (error) {
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
          referencedImages.add(imageFilenameStr.toLowerCase());
        }

        // For XML+Media mode, use relative path from xml/ to media/
        const originalQuestionText = (row[columnMapping.questionCol] as string) || '';
        const questionTextWithImage = imageFilenameStr 
          ? `${originalQuestionText}<br/><img src="../media/${imageFilenameStr}" alt="${imageFilenameStr}" />`
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

          xmlFolder.file(fileName, xmlContent);
          xmlFilesForValidation.push({ fileName, xmlContent });
          exportCount++;
        } catch (error) {
          console.warn(`Error generating XML for row ${row.id}:`, error);
          const oldQti = convertToQTIQuestion(row, questionType, columnMapping);
          oldQti.id = safeItemIdentifier;
          oldQti.questionText = questionTextWithImage;
          const xml = (await generateQTI(oldQti, outputFormat === 'qti-1.2' ? '1.2' : outputFormat === 'qti-3.0' ? '3.0' : '2.1', 'xml')).xml || '';
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

          itemsToValidate.push({ fileName, xmlContent });
        } catch (error) {
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
      const isXmlMedia = exportMode === 'xml-media';
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
    };
    validationResults.forEach(result => {
      stats[result.status]++;
      // Count questions with duplicate warnings
      if (result.warnings.some(w => w.field === 'Duplicate')) {
        stats.duplicates++;
      }
    });
    return stats;
  };

  const stats = getValidationStats();

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
          <div className="flex gap-2">
            {fileData && (
              <Button
                variant="outline"
                onClick={() => setShowValidationReport(!showValidationReport)}
                className="border border-[#334155] text-[#1F2937] hover:bg-[#F1F5F9] rounded-md"
              >
                <Eye className="w-4 h-4 mr-2" />
                {showValidationReport ? 'Hide' : 'Show'} Report
              </Button>
            )}
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
                    <SelectTrigger className={outputFormat === "" && showConfigErrors ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select QTI version" />
                    </SelectTrigger>
                    <SelectContent>
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
                    <SelectTrigger className={exportMode === "" && showConfigErrors ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select export format" />
                    </SelectTrigger>
                    <SelectContent>
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
                    <SelectTrigger className={containsImages === "" && showConfigErrors ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select yes or no" />
                    </SelectTrigger>
                    <SelectContent>
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
                    <SelectTrigger className={containsMath === "" && showConfigErrors ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select yes or no" />
                    </SelectTrigger>
                    <SelectContent>
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
                      <SelectTrigger className={mathFormat === "" && showConfigErrors ? "border-red-500" : ""}>
                        <SelectValue placeholder="Select math format" />
                      </SelectTrigger>
                      <SelectContent>
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
                    <SelectTrigger className={hasTemplateXml === "" && showConfigErrors ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select yes or no" />
                    </SelectTrigger>
                    <SelectContent>
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
                </CardContent>
              </Card>

              <div className="ml-4 flex flex-col gap-2">
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
