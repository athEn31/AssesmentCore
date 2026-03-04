import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Download, AlertCircle, FileJson, Lock, LogIn, Clock } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { 
  convertToMoodleXML,
} from "../../utils/lmsConverters";

const LMS_FORMATS = [
  {
    id: "moodle",
    name: "Moodle XML",
    description: "Native Moodle format for question import",
    icon: "📚",
    available: true,
  },
  {
    id: "qti",
    name: "QTI 2.1",
    description: "Question and Test Interoperability standard",
    icon: "📋",
    available: false,
  },
  {
    id: "canvas",
    name: "Canvas QTI",
    description: "Instructure Canvas LMS format",
    icon: "🎨",
    available: false,
  },
  {
    id: "blackboard",
    name: "Blackboard",
    description: "Blackboard Learn format",
    icon: "⬛",
    available: false,
  },
  {
    id: "d2l",
    name: "D2L Brightspace",
    description: "Desire2Learn format",
    icon: "💡",
    available: false,
  },
  {
    id: "scorm",
    name: "SCORM",
    description: "Shareable Content Object Reference Model",
    icon: "📦",
    available: false,
  },
];

export function LMSExportPage() {
  const navigate = useNavigate();
  const { isAuthenticated, loading, user, userUsage } = useAuth();
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [formData, setFormData] = useState<{
    editedRows: any[];
    columnMapping: any;
    validationResults: Map<string, any>;
  } | null>(null);

  const isPaidUser = Boolean(userUsage?.is_unlimited);

  // Check for saved form data from BatchCreator
  useEffect(() => {
    const savedData = localStorage.getItem("batchCreatorData");
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        // Reconstruct Map from serialized data
        const validationResults = new Map(parsed.validationResults || []) as Map<string, any>;
        setFormData({
          editedRows: parsed.editedRows,
          columnMapping: parsed.columnMapping,
          validationResults,
        });
        setHasData(true);
      } catch (error) {
        console.error("Error parsing saved data:", error);
        setHasData(false);
      }
    }
  }, []);

  const handleExport = async (formatId: string) => {
    if (!formData) {
      alert("No data available. Please go to Batch QTI Creator first.");
      return;
    }

    setSelectedFormat(formatId);
    setIsExporting(true);

    try {
      let content = "";
      let filename = "";
      const mimeType = "application/xml";

      const { editedRows, columnMapping, validationResults } = formData;

      switch (formatId) {
        case "moodle":
          content = convertToMoodleXML(editedRows, columnMapping, validationResults);
          filename = `moodle-export-${new Date().toISOString().slice(0, 10)}.xml`;
          break;
        default:
          throw new Error(`${formatId.toUpperCase()} format is coming soon!`);
      }

      if (!content) {
        throw new Error(`Export produced no content. Check your question data.`);
      }

      // Download file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(`Export error:`, error);
      alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsExporting(false);
      setSelectedFormat(null);
    }
  };

  // ── Not authenticated ──
  if (!loading && !isAuthenticated) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full border-[#E2E8F0]">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="w-14 h-14 bg-[#FEF3C7] rounded-full flex items-center justify-center mx-auto">
              <LogIn className="w-7 h-7 text-[#D97706]" />
            </div>
            <h2 className="text-xl font-bold text-[#111827]">Sign In Required</h2>
            <p className="text-sm text-[#475569]">
              Please sign in to access the LMS Export feature.
            </p>
            <Button
              onClick={() => navigate("/auth/login")}
              className="bg-[#0F6CBD] hover:bg-[#0D5BA8] text-white"
            >
              <LogIn className="w-4 h-4 mr-2" /> Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Not a paid / allowed user ──
  if (!loading && isAuthenticated && !isPaidUser) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full border-[#E2E8F0]">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="w-14 h-14 bg-[#DBEAFE] rounded-full flex items-center justify-center mx-auto">
              <Lock className="w-7 h-7 text-[#0F6CBD]" />
            </div>
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-xl font-bold text-[#111827]">Pro Feature</h2>
              <Badge className="bg-gradient-to-r from-[#0F6CBD] to-[#7C3AED] text-white text-xs">
                PRO
              </Badge>
            </div>
            <p className="text-sm text-[#475569]">
              LMS Export is available for Pro users. Upgrade your plan to export questions directly to Moodle, Canvas, Blackboard, and other LMS formats.
            </p>
            <Button
              disabled
              className="bg-[#0F6CBD] hover:bg-[#0D5BA8] text-white opacity-80"
            >
              <Lock className="w-4 h-4 mr-2" /> Upgrade to Pro
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main content (paid / allowed user) ──
  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-[#111827] flex items-center gap-2">
          <Download className="w-8 h-8 text-[#0F6CBD]" />
          Export to LMS Format
        </h1>
        <p className="text-[#475569]">
          Select your Learning Management System and export your questions in the appropriate format.
        </p>
      </div>

      {/* Data Status Alert */}
      {!hasData && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-yellow-900">No Data Available</h3>
            <p className="text-sm text-yellow-800">
              Please go to <strong>Batch QTI Creator</strong> to prepare and validate your questions first, then come back here to export to LMS format.
            </p>
          </div>
        </div>
      )}

      {/* Format Selection Grid */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {LMS_FORMATS.map((format) => {
            const isComingSoon = !format.available;
            const isClickable = format.available && hasData && !isExporting;

            return (
              <Card
                key={format.id}
                className={`transition-all border-2 ${
                  isComingSoon
                    ? "border-[#E2E8F0] bg-[#F8FAFC] opacity-75 cursor-not-allowed"
                    : isClickable
                      ? `cursor-pointer hover:shadow-lg ${
                          selectedFormat === format.id
                            ? "border-[#0F6CBD] bg-blue-50"
                            : "border-[#E2E8F0] hover:border-[#B3D9E8]"
                        }`
                      : "border-[#E2E8F0] cursor-not-allowed"
                }`}
                onClick={() => isClickable && handleExport(format.id)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-4xl">{format.icon}</div>
                    {isComingSoon && (
                      <Badge variant="outline" className="text-[10px] border-[#94A3B8] text-[#64748B] gap-1">
                        <Clock className="w-3 h-3" />
                        Coming Soon
                      </Badge>
                    )}
                    {!isComingSoon && selectedFormat === format.id && isExporting && (
                      <div className="flex items-center gap-1 text-xs text-[#0F6CBD] font-medium">
                        <div className="animate-spin">⚙️</div>
                        Exporting...
                      </div>
                    )}
                  </div>
                  <h3 className={`font-semibold text-sm mb-1 ${isComingSoon ? "text-[#94A3B8]" : "text-[#111827]"}`}>
                    {format.name}
                  </h3>
                  <p className="text-xs text-[#475569]">{format.description}</p>
                  <Button
                    className={`w-full mt-4 ${
                      isComingSoon
                        ? "bg-[#CBD5E1] text-[#64748B] cursor-not-allowed hover:bg-[#CBD5E1]"
                        : "bg-[#0F6CBD] hover:bg-[#0D5BA8] text-white"
                    }`}
                    size="sm"
                    disabled={!isClickable}
                  >
                    {isComingSoon ? (
                      <>
                        <Clock className="w-3.5 h-3.5 mr-2" />
                        Coming Soon
                      </>
                    ) : selectedFormat === format.id && isExporting ? (
                      "Exporting..."
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5 mr-2" />
                        {hasData ? "Export" : "No Data"}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Get Started Section */}
      {!hasData && (
        <Card className="border-[#E2E8F0]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileJson className="w-5 h-5 text-[#0F6CBD]" />
              Get Started
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[#475569]">
            <ol className="list-decimal list-inside space-y-2">
              <li>Go to <strong>Batch QTI Creator</strong> in the sidebar</li>
              <li>Upload your questions from CSV or Excel</li>
              <li>Map the columns to your question data</li>
              <li>Review the validation results</li>
              <li>Export your questions (this saves data for LMS export)</li>
              <li>Return here and click <strong>Moodle XML</strong> to download</li>
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
