import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  Shield,
  Loader2,
  Download,
  RefreshCw,
  Check,
  X,
  Pencil,
  Play,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { cn } from "./ui/utils";
import type { AIValidationItem, AIValidationIssue, AIProvider } from "../../services/aiValidationService";

// ── Props ──────────────────────────────────────────────────────────────────────

interface AIValidationReportProps {
  phase: 'ready' | 'running' | 'done';
  items: AIValidationItem[];
  totalItems?: number;
  availableProviders: AIProvider[];
  currentProvider: AIProvider;
  onProviderChange: (provider: AIProvider) => void;
  onStartValidation: () => Promise<void>;
  onItemXmlChange: (itemNo: number, newXml: string) => void;
  onItemAutoFix: (itemNo: number) => Promise<void>;
  onRevalidate: () => Promise<void>;
  onDownloadValid: () => Promise<void>;
  onCancel: () => void;
  isRevalidating: boolean;
  isDownloading: boolean;
  fixingItemNo?: number | null;
  progress?: { current: number; total: number };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function severityIcon(severity: AIValidationIssue['severity']) {
  switch (severity) {
    case 'error':
      return <XCircle className="w-3.5 h-3.5 text-[#DC2626] flex-shrink-0" />;
    case 'warning':
      return <AlertTriangle className="w-3.5 h-3.5 text-[#D97706] flex-shrink-0" />;
    case 'info':
      return <Info className="w-3.5 h-3.5 text-[#0F6CBD] flex-shrink-0" />;
  }
}

function severityBg(severity: AIValidationIssue['severity']) {
  switch (severity) {
    case 'error':
      return 'bg-red-50 border-red-200';
    case 'warning':
      return 'bg-amber-50 border-amber-200';
    case 'info':
      return 'bg-blue-50 border-blue-200';
  }
}

// ── Row Component ──────────────────────────────────────────────────────────────

function ValidationRow({
  item,
  onXmlChange,
  onAutoFix,
  isFixing,
}: {
  item: AIValidationItem;
  onXmlChange: (newXml: string) => void;
  onAutoFix: () => void;
  isFixing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  // Ensure issues is an array
  const issues = Array.isArray(item.issues) ? item.issues : [];
  const hasErrors = issues.some((i) => i && i.severity === 'error');
  const hasWarnings = issues.some((i) => i && i.severity === 'warning');

  const startEdit = () => {
    setEditValue(item.xmlContent ?? '');
    setEditing(true);
  };

  const saveEdit = () => {
    onXmlChange(editValue);
    setEditing(false);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditValue('');
  };

  // Truncate XML for display
  const displayXml = (item.xmlContent ?? '').length > 120
    ? (item.xmlContent ?? '').slice(0, 120) + '...'
    : (item.xmlContent ?? '');

  return (
    <>
      {/* Main row */}
      <tr
        className={cn(
          "border-b border-[#E2E8F0] transition-colors",
          item.isValid ? "hover:bg-green-50/40" : "hover:bg-red-50/40",
          !item.isValid && "bg-red-50/20",
        )}
      >
        {/* Item No. */}
        <td className="px-4 py-3 text-sm font-medium text-[#111827] w-[100px]">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-2 hover:text-[#0F6CBD]"
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            Item {item.itemNo + 1}
          </button>
        </td>

        {/* Validated (yes/no) */}
        <td className="px-4 py-3 text-center w-[120px]">
          {item.isValid ? (
            <Badge className="bg-[#16A34A] text-white text-xs hover:bg-[#16A34A]">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Yes
            </Badge>
          ) : (
            <Badge className="bg-[#DC2626] text-white text-xs hover:bg-[#DC2626]">
              <XCircle className="w-3 h-3 mr-1" />
              No
            </Badge>
          )}
        </td>

        {/* Details summary */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            {hasErrors && (
              <span className="inline-flex items-center gap-1 text-xs text-[#DC2626]">
                <XCircle className="w-3 h-3" />
                {issues.filter((i) => i && i.severity === 'error').length} error{issues.filter((i) => i && i.severity === 'error').length > 1 ? 's' : ''}
              </span>
            )}
            {hasWarnings && (
              <span className="inline-flex items-center gap-1 text-xs text-[#D97706]">
                <AlertTriangle className="w-3 h-3" />
                {issues.filter((i) => i && i.severity === 'warning').length} warning{issues.filter((i) => i && i.severity === 'warning').length > 1 ? 's' : ''}
              </span>
            )}
            {!hasErrors && !hasWarnings && (
              <span className="text-xs text-[#16A34A] font-medium">{String(item.summary || 'Valid')}</span>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded detail row with editable XML */}
      {expanded && (
        <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <td colSpan={3} className="px-6 py-4">
            <div className="space-y-4">
              {/* XML Content Section */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#475569] uppercase">Raw XML</p>
                {!editing ? (
                  <div className="flex items-start gap-2 group">
                    <div className="flex-1 bg-white border border-[#E2E8F0] rounded p-3 overflow-x-auto">
                      <code className="text-xs text-[#475569] font-mono whitespace-pre-wrap break-all">
                        {item.xmlContent}
                      </code>
                    </div>
                    <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-1">
                      <button
                        type="button"
                        onClick={startEdit}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded hover:bg-white"
                        title="Edit XML"
                      >
                        <Pencil className="w-4 h-4 text-[#0F6CBD]" />
                      </button>
                      <button
                        type="button"
                        onClick={onAutoFix}
                        disabled={isFixing}
                        className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded bg-[#0F6CBD] hover:bg-[#0B5A9A] text-white text-[10px] font-medium disabled:opacity-70"
                        title="Let AI fix XML and MathML issues"
                      >
                        {isFixing ? (
                          <span className="inline-flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Fixing
                          </span>
                        ) : (
                          'AI Fix'
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="font-mono text-xs min-h-[150px] resize-y border-[#0F6CBD] focus-visible:ring-[#0F6CBD] bg-white"
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') cancelEdit();
                      }}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={saveEdit}
                        className="h-8 px-3 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs"
                      >
                        <Check className="w-3 h-3 mr-1" />
                        Save Changes
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={cancelEdit}
                        className="h-8 px-3 text-xs text-[#475569]"
                      >
                        <X className="w-3 h-3 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Issues Section */}
              {issues.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#475569] uppercase">Issues Found</p>
                  <div className="space-y-2">
                    {issues.map((issue, idx) => (
                      issue && (
                        <div
                          key={idx}
                          className={cn(
                            "flex items-start gap-3 p-3 rounded border text-xs",
                            severityBg(issue.severity),
                          )}
                        >
                          {severityIcon(issue.severity)}
                          <div className="flex-1">
                            <p className="text-[#111827] font-medium">{String(issue.message || '')}</p>
                            {issue.element && (
                              <code className="text-[10px] text-[#475569] font-mono mt-1 block">
                                {String(issue.element)}
                              </code>
                            )}
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}

              {!hasErrors && !hasWarnings && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#475569] uppercase">Validation Result</p>
                  <div className="p-3 rounded bg-green-50 border border-green-200">
                    <p className="text-xs text-[#16A34A] font-medium">{String(item.summary || 'Valid')}</p>
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Ready State Card ────────────────────────────────────────────────────────────

function ReadyCard({
  totalItems,
  availableProviders,
  currentProvider,
  onProviderChange,
  onStartValidation,
  onCancel,
}: {
  totalItems: number;
  availableProviders: AIProvider[];
  currentProvider: AIProvider;
  onProviderChange: (provider: AIProvider) => void;
  onStartValidation: () => void;
  onCancel: () => void;
}) {
  return (
    <Card className="border border-[#0F6CBD] bg-[#F0F9FF]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#0F6CBD]" />
          Ready to Validate
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-white rounded-lg border border-[#E2E8F0]">
          <p className="text-sm text-[#475569]">
            <span className="font-semibold text-[#0F6CBD]">{totalItems} questions</span> will be validated using AI to check for XML schema compliance and educational content quality.
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-[#475569]">
            Select AI Provider
          </label>
          <Select value={currentProvider} onValueChange={(v) => onProviderChange(v as AIProvider)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose provider" />
            </SelectTrigger>
            <SelectContent>
              {availableProviders.map((provider) => (
                <SelectItem key={provider} value={provider}>
                  {provider.charAt(0).toUpperCase() + provider.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-[#94A3B8]">
            {currentProvider === 'gemini' ? 'Using Google Gemini API' : 'Using Groq API'}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={onStartValidation}
            className="bg-[#0F6CBD] hover:bg-[#0B5A9A] active:bg-[#094A7F] text-white font-semibold px-6 rounded-md"
          >
            <Play className="w-4 h-4 mr-2" />
            Start Validation
          </Button>
          <Button
            onClick={onCancel}
            variant="ghost"
            className="font-semibold px-5 text-[#475569] hover:bg-[#F1F5F9]"
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Report Component ──────────────────────────────────────────────────────

export function AIValidationReport({
  phase,
  items,
  totalItems,
  availableProviders,
  currentProvider,
  onProviderChange,
  onStartValidation,
  onItemXmlChange,
  onItemAutoFix,
  onRevalidate,
  onDownloadValid,
  onCancel,
  isRevalidating,
  isDownloading,
  fixingItemNo,
  progress,
}: AIValidationReportProps) {
  const validCount = items.filter((i) => i.isValid).length;
  const invalidCount = items.filter((i) => !i.isValid).length;
  const isRunning = !!progress && progress.current < progress.total;

  // Ready state - show the initial validation prompt
  if (phase === 'ready') {
    return <ReadyCard
      totalItems={totalItems || 0}
      availableProviders={availableProviders}
      currentProvider={currentProvider}
      onProviderChange={onProviderChange}
      onStartValidation={onStartValidation}
      onCancel={onCancel}
    />;
  }

  // Running or Done state - show results table
  return (
    <Card className="border border-[#0F6CBD] bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="w-5 h-5 text-[#0F6CBD]" />
          AI Validation Report
        </CardTitle>
        <p className="text-sm text-[#475569]">Powered by Gemini</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress bar (during validation / revalidation) */}
        {(isRunning || isRevalidating) && progress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#475569]">
                {isRevalidating ? 'Re-validating' : 'Validating'} items...
              </span>
              <span className="font-medium text-[#111827]">
                {progress.current} / {progress.total}
              </span>
            </div>
            <Progress
              value={Math.round((progress.current / progress.total) * 100)}
              className="h-2"
            />
          </div>
        )}

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
            <p className="text-2xl font-bold text-[#111827]">{items.length}</p>
            <p className="text-xs text-[#475569]">Total</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-green-50 border border-green-200">
            <p className="text-2xl font-bold text-[#16A34A]">{validCount}</p>
            <p className="text-xs text-[#475569]">Valid</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-2xl font-bold text-[#DC2626]">{invalidCount}</p>
            <p className="text-xs text-[#475569]">Invalid</p>
          </div>
        </div>

        {/* Table */}
        {items.length > 0 && (
          <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F1F5F9] sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#475569] w-[100px]">
                      Item No.
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-[#475569] w-[120px]">
                      Validated
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#475569]">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <ValidationRow
                      key={item.itemNo}
                      item={item}
                      onXmlChange={(newXml) => onItemXmlChange(item.itemNo, newXml)}
                      onAutoFix={() => onItemAutoFix(item.itemNo)}
                      isFixing={fixingItemNo === item.itemNo}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-2 border-t border-[#E2E8F0]">
          <Button
            onClick={onDownloadValid}
            disabled={isDownloading || isRevalidating || validCount === 0}
            className="bg-[#0F6CBD] hover:bg-[#0B5A9A] text-white font-semibold px-6 rounded-md"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Download Valid Items ({validCount})
              </>
            )}
          </Button>

          <Button
            onClick={onRevalidate}
            disabled={isRevalidating || isDownloading}
            variant="outline"
            className="font-semibold px-5 border border-[#334155] text-[#1F2937] hover:bg-[#F1F5F9] rounded-md"
          >
            {isRevalidating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Re-validating...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Re-validate
              </>
            )}
          </Button>

          <Button
            onClick={onCancel}
            disabled={isRevalidating || isDownloading}
            variant="ghost"
            className="font-semibold px-5 text-[#475569] hover:bg-[#F1F5F9] rounded-md"
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
