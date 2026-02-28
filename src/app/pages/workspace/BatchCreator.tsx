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
  ArrowRight
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
import { Textarea } from "../../components/ui/textarea";
import { ValidationReport } from "../../components/ValidationReport";
import { parseFile, detectQuestionColumns } from "../../utils/fileParser";
import { validateAllQuestions, ValidationResult } from "../../utils/questionValidator";
import { convertToQTIQuestion, generateJSON, generateQTI } from "../../utils/qtiConverter";
import { generateAndValidateMCQ, Question as QTIQuestion } from "../../../engine";
import { useAuth } from "../../../contexts/AuthContext";


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
  const { isAuthenticated, loading, user, userUsage, trackExport } = useAuth();
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [columnMapping, setColumnMapping] = useState<any>(null);
  const [validationResults, setValidationResults] = useState<Map<string, ValidationResult>>(new Map());
  const [outputFormat, setOutputFormat] = useState("qti-2.1");
  const [isValidating, setIsValidating] = useState(false);
  const [validationProgress, setValidationProgress] = useState(0);
  const [showValidationReport, setShowValidationReport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [editedRows, setEditedRows] = useState<Record<string, any>[]>([]);

  // Check if free quota is exhausted
  const canUseFeature = !userUsage || userUsage.exports_count === 0;


  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setUploadedFiles([file]);

      try {
        setIsValidating(true);
        setValidationProgress(0);

        // Parse file
        const parsed = await parseFile(file);
        setFileData(parsed);

        // Detect columns
        const detected = detectQuestionColumns(parsed.columns);
        setColumnMapping(detected);
        setEditedRows([...parsed.rows]);

        // Simulate validation progress
        for (let i = 0; i <= 100; i += 25) {
          await new Promise(resolve => setTimeout(resolve, 200));
          setValidationProgress(i);
        }

        // Validate all questions
        const results = validateAllQuestions(parsed.rows as any, detected);
        const resultsMap = new Map<string, ValidationResult>();
        results.forEach(result => {
          resultsMap.set(result.rowId, result);
        });
        setValidationResults(resultsMap);
        setShowValidationReport(true);

        setIsValidating(false);
      } catch (error) {
        console.error("Error parsing file:", error);
        alert(`Error parsing file: ${error}`);
        setIsValidating(false);
      }
    }
  };


  const handleDataChange = (updatedRows: Record<string, any>[]) => {
    setEditedRows(updatedRows);

    // Re-validate after edit
    const newResults = validateAllQuestions(updatedRows as any, columnMapping);
    const resultsMap = new Map<string, ValidationResult>();
    newResults.forEach(result => {
      resultsMap.set(result.rowId, result);
    });
    setValidationResults(resultsMap);
  };

  const exportToQTI = async () => {
    if (!fileData || !columnMapping) return;

    setIsExporting(true);
    try {
      const zip = new JSZip();
      let exportCount = 0;

      for (const row of editedRows) {
        const validationResult = validationResults.get(row.id);
        const questionType = validationResult?.detectedType || 'shortanswer';

        try {
          if (questionType === 'mcq') {
            // Use the production QTI builder for MCQ
            const qtiQuestion: QTIQuestion = {
              id: row.id || `q-${Date.now()}`,
              upload_id: 'batch-export',
              identifier: (row[columnMapping.questionCol] as string)?.substring(0, 50) || `q-${row.id}`,
              stem: (row[columnMapping.questionCol] as string) || '',
              type: 'MCQ',
              options: columnMapping.optionCols?.map((col: string) => row[col] || '') || [],
              correct_answer: (row[columnMapping.answerCol] as string) || 'A',
              validation_status: (validationResult?.status as string) === 'valid' ? 'Valid' : 'Caution',
            };

            const result = generateAndValidateMCQ(qtiQuestion);
            if ('error' in result) {
              console.warn(`Failed to generate MCQ for ${qtiQuestion.identifier}:`, result.error.message);
              // Fall back to old converter
              const oldQti = convertToQTIQuestion(row, 'mcq', columnMapping);
              const fallbackXml = generateQTI(oldQti, '2.1', 'xml').xml || '';
              const fileName = `${qtiQuestion.identifier || `Q${exportCount + 1}`}.xml`;
              zip.file(fileName, fallbackXml);
              exportCount++;
            } else {
              const fileName = `${qtiQuestion.identifier || `Q${exportCount + 1}`}.xml`;
              zip.file(fileName, result.xml);
              exportCount++;
            }
          } else {
            // Use old converter for other types
            const oldQti = convertToQTIQuestion(row, questionType, columnMapping);
            const xml = generateQTI(oldQti, '2.1', 'xml').xml || '';
            const identifier = row[columnMapping.questionCol]?.substring(0, 50) || `q-${row.id}`;
            const fileName = `${identifier || `Q${exportCount + 1}`}.xml`;
            zip.file(fileName, xml);
            exportCount++;
          }
        } catch (error) {
          console.warn(`Error generating QTI for row ${row.id}:`, error);
          // Fallback to old converter
          const oldQti = convertToQTIQuestion(row, questionType, columnMapping);
          const xml = generateQTI(oldQti, '2.1', 'xml').xml || '';
          const identifier = row[columnMapping.questionCol]?.substring(0, 50) || `q-${row.id}`;
          const fileName = `${identifier || `Q${exportCount + 1}`}.xml`;
          zip.file(fileName, xml);
          exportCount++;
        }
      }

      // Generate ZIP file and download
      if (exportCount > 0) {
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `qti-export-${new Date().toISOString().slice(0, 10)}-${exportCount}questions.zip`;
        link.click();
        URL.revokeObjectURL(url);

        // Track the export
        await trackExport();

        alert(`✓ Successfully exported ${exportCount} questions in ZIP file`);

        // If this was the first export, redirect to pricing page
        if (canUseFeature) {
          setTimeout(() => {
            navigate('/pricing');
          }, 2000);
        }
      } else {
        alert('No valid questions to export');
      }
    } catch (error) {
      console.error("Export error:", error);
      alert("Error exporting to QTI format: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsExporting(false);
    }
  };

  const exportToJSON = async () => {
    if (!fileData || !columnMapping) return;

    setIsExporting(true);
    try {
      const qtiQuestions = editedRows.map(row => {
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
    } catch (error) {
      console.error("Export error:", error);
      alert("Error exporting to JSON format");
    } finally {
      setIsExporting(false);
    }
  };

  const revalidateAll = async () => {
    setIsValidating(true);
    setValidationProgress(0);

    for (let i = 0; i <= 100; i += 25) {
      await new Promise(resolve => setTimeout(resolve, 100));
      setValidationProgress(i);
    }

    const results = validateAllQuestions(editedRows as any, columnMapping);
    const resultsMap = new Map<string, ValidationResult>();
    results.forEach(result => {
      resultsMap.set(result.rowId, result);
    });
    setValidationResults(resultsMap);
    setIsValidating(false);
  };

  const getValidationStats = () => {
    const stats = {
      valid: 0,
      caution: 0,
      rejected: 0,
      total: validationResults.size,
    };
    validationResults.forEach(result => {
      stats[result.status]++;
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
                You have {userUsage?.exports_count || 0} export(s) this month. Upgrade to continue using Batch Creator.
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
              onClick={() => navigate('/pricing')}
              className="w-full bg-[#0F6CBD] hover:bg-[#0d4a94] text-white font-medium"
              size="lg"
            >
              View Pricing Plans
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-[#FFFFFF] border-b border-[#E2E8F0] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">Batch QTI Creator</h1>
            <p className="text-[#475569] mt-1">Convert multiple questions to QTI format in one go</p>
            <p className="text-xs text-[#94A3B8] mt-2">Free trial - {userUsage?.exports_count === 0 ? '1' : '0'} export(s) remaining this month</p>
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

                {isValidating && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-[#475569]">
                      <span>Processing file...</span>
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
                    Output Format
                  </label>
                  <Select value={outputFormat} onValueChange={setOutputFormat}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="qti-2.1">QTI 2.1</SelectItem>
                      <SelectItem value="qti-2.2">QTI 2.2</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              </div>
            </div>

            {/* Validation Report - BEFORE Export Section */}
            {showValidationReport && fileData && (
              <ValidationReport
                columns={fileData.columns}
                rows={editedRows}
                validationResults={validationResults}
                onDataChange={handleDataChange}
              />
            )}

            {/* Actions - Export Section */}
            <Card className="border border-[#0F6CBD] bg-[#F8FAFC]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="w-5 h-5 text-[#0F6CBD]" />
                  Generate QTI/JSON Files
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="bg-[#FFFFFF] border-[#E2E8F0]">
                  <FileJson className="h-4 w-4 text-[#0F6CBD]" />
                  <AlertTitle className="text-[#1F2937]">Ready to Export</AlertTitle>
                  <AlertDescription className="text-[#475569] text-sm">
                    <span className="font-semibold text-[#16A34A]">{stats.valid} valid</span> questions ready to export • <span className="font-semibold text-[#D97706]">{stats.caution} caution</span> • <span className="font-semibold text-[#DC2626]">{stats.rejected} rejected</span>
                  </AlertDescription>
                </Alert>

                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={exportToQTI}
                    disabled={isExporting || stats.valid === 0}
                    className="bg-[#0F6CBD] hover:bg-[#0B5A9A] active:bg-[#094A7F] text-white font-semibold px-6 rounded-md"
                    size="lg"
                  >
                    {isExporting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Export as {outputFormat.toUpperCase()}
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={exportToJSON}
                    disabled={isExporting || stats.valid === 0}
                    variant="outline"
                    className="font-semibold px-6 border border-[#334155] text-[#1F2937] hover:bg-[#F1F5F9] rounded-md"
                    size="lg"
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
          </div>
        )}
      </div>
    </div>
  );
}
