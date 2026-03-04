import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Shield,
  Loader2,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import type { AIValidationBatchResult, AIValidationResult } from "../../services/groqValidationService";

interface AIValidationReportProps {
  result: AIValidationBatchResult;
  onProceedExport: () => void;
  onCancel: () => void;
  isExporting: boolean;
}

function getSeverityIcon(severity: string) {
  switch (severity) {
    case 'error':
      return <XCircle className="w-4 h-4 text-[#DC2626] flex-shrink-0" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-[#D97706] flex-shrink-0" />;
    case 'info':
      return <Info className="w-4 h-4 text-[#0F6CBD] flex-shrink-0" />;
    default:
      return <Info className="w-4 h-4 text-[#475569] flex-shrink-0" />;
  }
}

function getSeverityBg(severity: string) {
  switch (severity) {
    case 'error':
      return 'bg-red-50 border-red-200';
    case 'warning':
      return 'bg-amber-50 border-amber-200';
    case 'info':
      return 'bg-blue-50 border-blue-200';
    default:
      return 'bg-gray-50 border-gray-200';
  }
}

function FileValidationCard({ result }: { result: AIValidationResult }) {
  const [isOpen, setIsOpen] = useState(false);
  const errorCount = result.issues.filter(i => i.severity === 'error').length;
  const warningCount = result.issues.filter(i => i.severity === 'warning').length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between p-3 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] cursor-pointer transition-colors">
          <div className="flex items-center gap-3">
            {result.isValid ? (
              <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
            ) : (
              <XCircle className="w-5 h-5 text-[#DC2626]" />
            )}
            <div>
              <span className="font-medium text-[#111827] text-sm">{result.fileName}</span>
              <p className="text-xs text-[#475569]">{result.summary}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={result.score >= 80 ? "default" : result.score >= 50 ? "secondary" : "destructive"}
              className={
                result.score >= 80
                  ? "bg-[#16A34A] text-white"
                  : result.score >= 50
                  ? "bg-[#D97706] text-white"
                  : "bg-[#DC2626] text-white"
              }
            >
              {result.score}/100
            </Badge>
            {errorCount > 0 && (
              <Badge variant="destructive" className="bg-[#DC2626] text-white text-xs">
                {errorCount} error{errorCount > 1 ? 's' : ''}
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge className="bg-[#D97706] text-white text-xs">
                {warningCount} warning{warningCount > 1 ? 's' : ''}
              </Badge>
            )}
            {isOpen ? <ChevronUp className="w-4 h-4 text-[#475569]" /> : <ChevronDown className="w-4 h-4 text-[#475569]" />}
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 ml-8 space-y-2 pb-2">
          {result.issues.length > 0 && (
            <div className="space-y-1">
              {result.issues.map((issue, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 p-2 rounded border text-sm ${getSeverityBg(issue.severity)}`}
                >
                  {getSeverityIcon(issue.severity)}
                  <div>
                    <span className="text-[#111827]">{issue.message}</span>
                    {issue.element && (
                      <span className="ml-2 text-xs text-[#475569] font-mono">({issue.element})</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {result.suggestions.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-[#475569] mb-1">Suggestions:</p>
              <ul className="list-disc list-inside space-y-1">
                {result.suggestions.map((s, idx) => (
                  <li key={idx} className="text-xs text-[#475569]">{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AIValidationReport({ result, onProceedExport, onCancel, isExporting }: AIValidationReportProps) {
  const avgScore = result.results.length > 0
    ? Math.round(result.results.reduce((sum, r) => sum + r.score, 0) / result.results.length)
    : 0;

  return (
    <Card className="border border-[#0F6CBD] bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="w-5 h-5 text-[#0F6CBD]" />
          AI Validation Report
        </CardTitle>
        <p className="text-sm text-[#475569]">
          Powered by Groq AI &bull; Validated at {new Date(result.timestamp).toLocaleTimeString()}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
            <p className="text-2xl font-bold text-[#111827]">{result.totalFiles}</p>
            <p className="text-xs text-[#475569]">Total Files</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-green-50 border border-green-200">
            <p className="text-2xl font-bold text-[#16A34A]">{result.passedFiles}</p>
            <p className="text-xs text-[#475569]">Passed</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-2xl font-bold text-[#DC2626]">{result.failedFiles}</p>
            <p className="text-xs text-[#475569]">Issues Found</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-blue-50 border border-blue-200">
            <p className="text-2xl font-bold text-[#0F6CBD]">{avgScore}</p>
            <p className="text-xs text-[#475569]">Avg Score</p>
          </div>
        </div>

        {/* Overall Status */}
        <div className={`p-3 rounded-lg border ${
          result.overallStatus === 'passed'
            ? 'bg-green-50 border-green-300'
            : result.overallStatus === 'partial'
            ? 'bg-amber-50 border-amber-300'
            : 'bg-red-50 border-red-300'
        }`}>
          <div className="flex items-center gap-2">
            {result.overallStatus === 'passed' ? (
              <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
            ) : result.overallStatus === 'partial' ? (
              <AlertTriangle className="w-5 h-5 text-[#D97706]" />
            ) : (
              <XCircle className="w-5 h-5 text-[#DC2626]" />
            )}
            <span className="font-semibold text-[#111827]">
              {result.overallStatus === 'passed'
                ? 'All files passed AI validation!'
                : result.overallStatus === 'partial'
                ? 'Some files have issues - review recommended'
                : 'Validation found issues in all files'}
            </span>
          </div>
        </div>

        {/* File-by-file results */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {result.results.map((fileResult, idx) => (
            <FileValidationCard key={idx} result={fileResult} />
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-2 border-t border-[#E2E8F0]">
          <Button
            onClick={onProceedExport}
            disabled={isExporting}
            className="bg-[#0F6CBD] hover:bg-[#0B5A9A] active:bg-[#094A7F] text-white font-semibold px-6 rounded-md"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Proceed with Download
              </>
            )}
          </Button>
          <Button
            onClick={onCancel}
            disabled={isExporting}
            variant="outline"
            className="font-semibold px-6 border border-[#334155] text-[#1F2937] hover:bg-[#F1F5F9] rounded-md"
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
