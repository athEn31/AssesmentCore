import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import JSZip from "jszip";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FileArchive,
  Lock,
  LogIn,
  Package,
  Upload,
  Wand2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Textarea } from "../../components/ui/textarea";
import { useAuth } from "../../../contexts/AuthContext";
import {
  buildCanvasPackageFromPreview,
  type CanvasPreviewItem,
  type CanvasPreviewPackage,
  prepareCanvasPackagePreview,
} from "@/app/utils/canvasPackageFixer";

type LmsPlatformId = "canvas" | "moodle" | "blackboard" | "d2l" | "scorm";

type UploadedPackageSummary = {
  fileName: string;
  xmlCount: number;
  imageCount: number;
  manifestFound: boolean;
};

const LMS_PLATFORMS: Array<{
  id: LmsPlatformId;
  name: string;
  shortName: string;
  description: string;
  available: boolean;
  icon: string;
}> = [
  {
    id: "canvas",
    name: "Canvas LMS",
    shortName: "Canvas",
    description: "Analyze and rewrite the QTI ZIP for Canvas-compatible image, manifest, and package structure.",
    available: true,
    icon: "🎨",
  },
  {
    id: "moodle",
    name: "Moodle LMS",
    shortName: "Moodle",
    description: "Planned package conversion path for Moodle-compatible import ZIP behavior.",
    available: false,
    icon: "📚",
  },
  {
    id: "blackboard",
    name: "Blackboard Learn",
    shortName: "Blackboard",
    description: "Planned package conversion path for Blackboard-specific packaging rules.",
    available: false,
    icon: "⬛",
  },
  {
    id: "d2l",
    name: "D2L Brightspace",
    shortName: "D2L",
    description: "Planned package conversion path for Brightspace import requirements.",
    available: false,
    icon: "💡",
  },
  {
    id: "scorm",
    name: "SCORM",
    shortName: "SCORM",
    description: "Planned package conversion path for SCORM-compliant LMS packages.",
    available: false,
    icon: "📦",
  },
];

async function inspectZipPackage(file: File): Promise<UploadedPackageSummary> {
  const zip = await JSZip.loadAsync(file);
  const files = Object.values(zip.files).filter((entry) => !entry.dir);

  const xmlCount = files.filter((entry) => /\.xml$/i.test(entry.name) && !/(^|\/)imsmanifest\.xml$/i.test(entry.name)).length;
  const imageCount = files.filter((entry) => /\.(png|jpe?g|gif|svg|webp|bmp)$/i.test(entry.name)).length;
  const manifestFound = files.some((entry) => /(^|\/)imsmanifest\.xml$/i.test(entry.name));

  return {
    fileName: file.name,
    xmlCount,
    imageCount,
    manifestFound,
  };
}

export function LMSExportPage() {
  const navigate = useNavigate();
  const { isAuthenticated, loading, userUsage } = useAuth();
  const [activeTab, setActiveTab] = useState<"upload" | "configure">("upload");
  const [uploadedZipFile, setUploadedZipFile] = useState<File | null>(null);
  const [packageSummary, setPackageSummary] = useState<UploadedPackageSummary | null>(null);
  const [uploadError, setUploadError] = useState<string>("");
  const [isInspectingZip, setIsInspectingZip] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<LmsPlatformId>("canvas");
  const [isExporting, setIsExporting] = useState(false);
  const [isPreparingPreview, setIsPreparingPreview] = useState(false);
  const [canvasPreview, setCanvasPreview] = useState<CanvasPreviewPackage | null>(null);
  const [expandedPreviewRows, setExpandedPreviewRows] = useState<Set<string>>(new Set());
  const zipInputRef = useRef<HTMLInputElement>(null);

  const isPaidUser = Boolean(userUsage?.is_unlimited);

  const selectedPlatformMeta = useMemo(
    () => LMS_PLATFORMS.find((platform) => platform.id === selectedPlatform) || LMS_PLATFORMS[0],
    [selectedPlatform]
  );

  const generateCanvasPreviewFromFile = async (file: File) => {
    setIsPreparingPreview(true);
    setUploadError("");

    try {
      const preview = await prepareCanvasPackagePreview(file);
      setCanvasPreview(preview);
      setExpandedPreviewRows(new Set());
    } catch (error) {
      console.error("Canvas preview error:", error);
      setCanvasPreview(null);
      setUploadError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsPreparingPreview(false);
    }
  };

  const handleZipUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsInspectingZip(true);
    setUploadError("");

    try {
      const summary = await inspectZipPackage(file);
      if (!summary.manifestFound) {
        throw new Error("Uploaded ZIP must contain imsmanifest.xml");
      }

      setUploadedZipFile(file);
      setPackageSummary(summary);
      setCanvasPreview(null);
      setExpandedPreviewRows(new Set());
      setActiveTab("configure");

      // Auto-generate preview for Canvas so the preview section is immediately visible.
      if (selectedPlatform === "canvas") {
        await generateCanvasPreviewFromFile(file);
      }
    } catch (error) {
      console.error("ZIP inspection error:", error);
      setUploadedZipFile(null);
      setPackageSummary(null);
      setUploadError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsInspectingZip(false);
      event.target.value = "";
    }
  };

  const handlePlatformExport = async () => {
    if (!uploadedZipFile) {
      setUploadError("Please upload a ZIP package before exporting.");
      setActiveTab("upload");
      return;
    }

    if (!selectedPlatformMeta.available) {
      alert(`${selectedPlatformMeta.name} conversion is not enabled yet.`);
      return;
    }

    setIsExporting(true);

    try {
      switch (selectedPlatform) {
        case "canvas": {
          if (!canvasPreview) {
            throw new Error("Generate and review Canvas XML preview before exporting.");
          }

          const blob = await buildCanvasPackageFromPreview(canvasPreview);
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `canvas-fixed-${new Date().toISOString().slice(0, 10)}.zip`;
          link.click();
          URL.revokeObjectURL(url);

          const included = canvasPreview.items.filter((item: CanvasPreviewItem) => item.includeInExport).length;
          const skipped = canvasPreview.items.length - included;
          alert(`Canvas package created successfully. Included XML: ${included}, skipped XML: ${skipped}.`);
          break;
        }
        default:
          alert(`${selectedPlatformMeta.name} conversion is not available yet.`);
          break;
      }
    } catch (error) {
      console.error("LMS export error:", error);
      alert(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleGenerateCanvasPreview = async () => {
    if (!uploadedZipFile) {
      setUploadError("Please upload a ZIP package first.");
      setActiveTab("upload");
      return;
    }

    await generateCanvasPreviewFromFile(uploadedZipFile);
  };

  const handleCanvasXmlChange = (itemId: string, xmlContent: string) => {
    setCanvasPreview((prev: CanvasPreviewPackage | null) => {
      if (!prev) return prev;

      return {
        ...prev,
        items: prev.items.map((item: CanvasPreviewItem) =>
          item.id === itemId ? { ...item, xmlContent } : item
        ),
      };
    });
  };

  const handleCanvasIncludeToggle = (itemId: string, includeInExport: boolean) => {
    setCanvasPreview((prev: CanvasPreviewPackage | null) => {
      if (!prev) return prev;

      return {
        ...prev,
        items: prev.items.map((item: CanvasPreviewItem) =>
          item.id === itemId ? { ...item, includeInExport } : item
        ),
      };
    });
  };

  const togglePreviewRow = (itemId: string) => {
    setExpandedPreviewRows((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

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
              LMS package export is available for Pro users. Upgrade your plan to upload a QTI ZIP, configure a target LMS, and download a platform-adapted package.
            </p>
            <Button disabled className="bg-[#0F6CBD] hover:bg-[#0D5BA8] text-white opacity-80">
              <Lock className="w-4 h-4 mr-2" /> Upgrade to Pro
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 bg-[radial-gradient(circle_at_top_left,_rgba(15,108,189,0.08),_transparent_30%),linear-gradient(180deg,_#F8FAFC_0%,_#FFFFFF_100%)] min-h-full">
      <input
        ref={zipInputRef}
        type="file"
        className="hidden"
        accept=".zip"
        onChange={handleZipUpload}
      />

      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1 text-xs font-medium text-[#0C4A6E]">
          <Package className="h-3.5 w-3.5" />
          LMS Package Conversion
        </div>
        <div>
          <h1 className="text-3xl font-bold text-[#111827]">Export to LMS</h1>
          <p className="mt-2 max-w-3xl text-[#475569]">
            Upload a QTI ZIP package containing imsmanifest.xml, inspect the package, choose your target LMS,
            and export a converted package tailored to that platform's XML and manifest requirements.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "upload" | "configure")}>
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-white/80 border border-[#E2E8F0]">
          <TabsTrigger value="upload">1. Upload Package</TabsTrigger>
          <TabsTrigger value="configure" disabled={!uploadedZipFile}>2. Configure Export</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6 pt-4">
          <Card className="border-[#DCEAF8] shadow-sm bg-white/95">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#111827]">
                <Upload className="w-5 h-5 text-[#0F6CBD]" />
                Upload QTI ZIP Package
              </CardTitle>
              <CardDescription>
                Upload a ZIP containing imsmanifest.xml plus the item XML and media files to be adapted for an LMS platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <button
                type="button"
                onClick={() => zipInputRef.current?.click()}
                className="group flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-[#93C5FD] bg-[linear-gradient(180deg,_#F8FBFF_0%,_#EEF6FF_100%)] px-6 py-12 text-center transition hover:border-[#0F6CBD] hover:bg-[linear-gradient(180deg,_#F3F9FF_0%,_#E3F0FF_100%)]"
              >
                <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm border border-[#DBEAFE]">
                  <FileArchive className="h-10 w-10 text-[#0F6CBD]" />
                </div>
                <p className="text-base font-semibold text-[#0F172A]">
                  {isInspectingZip ? "Inspecting uploaded package..." : "Choose ZIP file"}
                </p>
                <p className="mt-2 text-sm text-[#64748B]">
                  Manifest is required. We will inspect XML count, media count, and package readiness before export.
                </p>
              </button>

              {uploadError && (
                <Alert className="bg-[#FEF2F2] border-red-500">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <AlertTitle className="text-red-900">Upload Failed</AlertTitle>
                  <AlertDescription className="text-red-700 text-sm">
                    {uploadError}
                  </AlertDescription>
                </Alert>
              )}

              {packageSummary && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <Card className="border-[#E2E8F0] bg-[#FAFCFF]">
                    <CardContent className="pt-6">
                      <p className="text-xs text-[#64748B]">Package</p>
                      <p className="mt-1 text-sm font-semibold text-[#0F172A] break-all">{packageSummary.fileName}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-[#E2E8F0] bg-[#FAFCFF]">
                    <CardContent className="pt-6">
                      <p className="text-xs text-[#64748B]">Item XML</p>
                      <p className="mt-1 text-2xl font-bold text-[#0F6CBD]">{packageSummary.xmlCount}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-[#E2E8F0] bg-[#FAFCFF]">
                    <CardContent className="pt-6">
                      <p className="text-xs text-[#64748B]">Images</p>
                      <p className="mt-1 text-2xl font-bold text-[#0F6CBD]">{packageSummary.imageCount}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-[#E2E8F0] bg-[#FAFCFF]">
                    <CardContent className="pt-6">
                      <p className="text-xs text-[#64748B]">Manifest</p>
                      <div className="mt-1 flex items-center gap-2 font-semibold text-[#166534]">
                        <CheckCircle2 className="w-4 h-4" />
                        Present
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => setActiveTab("configure")}
                  disabled={!uploadedZipFile}
                  className="bg-[#0F6CBD] hover:bg-[#0D5BA8] text-white"
                >
                  Continue to Configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configure" className="space-y-6 pt-4">
          {!uploadedZipFile ? (
            <Alert className="bg-[#FFF7ED] border-[#FDBA74]">
              <AlertCircle className="h-4 w-4 text-[#C2410C]" />
              <AlertTitle className="text-[#7C2D12]">Upload Required</AlertTitle>
              <AlertDescription className="text-[#9A3412] text-sm">
                Upload a QTI ZIP package first. Once package inspection succeeds, configuration options will appear here.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
              <Card className="border-[#DCEAF8] shadow-sm bg-white/95">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[#111827]">
                    <Wand2 className="w-5 h-5 text-[#0F6CBD]" />
                    Select Target LMS
                  </CardTitle>
                  <CardDescription>
                    Choose the LMS platform. The uploaded XML and manifest will be transformed according to that platform's package rules.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {LMS_PLATFORMS.map((platform) => {
                      const isSelected = selectedPlatform === platform.id;
                      return (
                        <button
                          key={platform.id}
                          type="button"
                          onClick={() => setSelectedPlatform(platform.id)}
                          className={`rounded-2xl border p-4 text-left transition ${
                            isSelected
                              ? "border-[#0F6CBD] bg-[#EFF6FF] shadow-sm"
                              : "border-[#E2E8F0] bg-white hover:border-[#93C5FD]"
                          } ${!platform.available ? "opacity-70" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-3xl">{platform.icon}</div>
                              <p className="mt-3 font-semibold text-[#111827]">{platform.name}</p>
                              <p className="mt-1 text-sm text-[#64748B]">{platform.description}</p>
                            </div>
                            {platform.available ? (
                              <Badge className="bg-[#DCFCE7] text-[#166534]">Ready</Badge>
                            ) : (
                              <Badge variant="outline" className="border-[#CBD5E1] text-[#64748B] gap-1">
                                <Clock className="w-3 h-3" />
                                Coming Soon
                              </Badge>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[#DCEAF8] shadow-sm bg-white/95">
                <CardHeader>
                  <CardTitle className="text-[#111827]">Export Summary</CardTitle>
                  <CardDescription>
                    Review the uploaded package and export it for the selected LMS.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                    <p className="text-xs uppercase tracking-wide text-[#64748B]">Uploaded Package</p>
                    <p className="mt-1 text-sm font-semibold text-[#111827]">{packageSummary?.fileName}</p>
                    <p className="mt-2 text-sm text-[#475569]">
                      {packageSummary?.xmlCount || 0} item XML, {packageSummary?.imageCount || 0} image files, manifest verified.
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                    <p className="text-xs uppercase tracking-wide text-[#64748B]">Selected LMS</p>
                    <p className="mt-1 text-sm font-semibold text-[#111827]">{selectedPlatformMeta.name}</p>
                    <p className="mt-2 text-sm text-[#475569]">{selectedPlatformMeta.description}</p>
                  </div>

                  {selectedPlatform === "canvas" && (
                    <Alert className="bg-[#EFF6FF] border-[#93C5FD]">
                      <CheckCircle2 className="h-4 w-4 text-[#0F6CBD]" />
                      <AlertTitle className="text-[#0C4A6E]">Canvas Format Applied</AlertTitle>
                      <AlertDescription className="text-[#0C4A6E] text-sm">
                        Converts QTI items to Canvas-compatible format: proper namespace handling, nested paragraph cleanup, feedbackBlock to modalFeedback conversion, and inline textEntryInteraction support.
                      </AlertDescription>
                    </Alert>
                  )}

                  {selectedPlatform === "canvas" && (
                    <Button
                      type="button"
                      onClick={handleGenerateCanvasPreview}
                      disabled={isPreparingPreview || !uploadedZipFile}
                      variant="outline"
                      className="w-full border-[#0F6CBD] text-[#0F6CBD] hover:bg-[#EFF6FF]"
                    >
                      {isPreparingPreview ? (
                        <>
                          <Clock className="w-4 h-4 mr-2 animate-spin" />
                          Generating Canvas Preview...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4 mr-2" />
                          Generate Canvas XML Preview
                        </>
                      )}
                    </Button>
                  )}

                  {!selectedPlatformMeta.available && (
                    <Alert className="bg-[#FFF7ED] border-[#FDBA74]">
                      <Clock className="h-4 w-4 text-[#C2410C]" />
                      <AlertTitle className="text-[#7C2D12]">Platform Not Yet Enabled</AlertTitle>
                      <AlertDescription className="text-[#9A3412] text-sm">
                        This platform appears in the configuration list, but conversion logic is not enabled yet.
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="button"
                    onClick={handlePlatformExport}
                    disabled={
                      isExporting ||
                      !selectedPlatformMeta.available ||
                      (selectedPlatform === "canvas" && !canvasPreview)
                    }
                    className="w-full bg-[#0F6CBD] hover:bg-[#0D5BA8] text-white"
                  >
                    {isExporting ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                        Converting Package...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Export for {selectedPlatformMeta.shortName}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {selectedPlatform === "canvas" && (
            <Card className="border-[#DCEAF8] shadow-sm bg-white/95">
              <CardHeader>
                <CardTitle className="text-[#111827]">Canvas XML Preview</CardTitle>
                <CardDescription>
                  Review generated Canvas XML files, edit content, choose which files to include, then export the final ZIP.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isPreparingPreview && (
                  <Alert className="bg-[#EFF6FF] border-[#93C5FD]">
                    <Clock className="h-4 w-4 text-[#0F6CBD] animate-spin" />
                    <AlertTitle className="text-[#0C4A6E]">Generating Preview</AlertTitle>
                    <AlertDescription className="text-[#0C4A6E] text-sm">
                      Creating Canvas XML preview from uploaded package...
                    </AlertDescription>
                  </Alert>
                )}

                {!isPreparingPreview && !canvasPreview && (
                  <Alert className="bg-[#FFF7ED] border-[#FDBA74]">
                    <AlertCircle className="h-4 w-4 text-[#C2410C]" />
                    <AlertTitle className="text-[#7C2D12]">Preview Not Generated Yet</AlertTitle>
                    <AlertDescription className="text-[#9A3412] text-sm">
                      Click Generate Canvas XML Preview to load editable converted XML files.
                    </AlertDescription>
                  </Alert>
                )}

                {canvasPreview && (
                  <>
                    <div className="bg-[#F0F9FF] border border-[#93C5FD] rounded-lg p-3 text-sm text-[#0C4A6E]">
                      <p className="font-semibold mb-2">Conversion Summary:</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <p className="text-xs text-[#0884C6]">Total Items</p>
                          <p className="text-lg font-bold">{canvasPreview.summary.totalXml}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#0884C6]">Ready</p>
                          <p className="text-lg font-bold text-[#166534]">{canvasPreview.summary.readyXml}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#0884C6]">Skipped</p>
                          <p className="text-lg font-bold text-[#92400E]">{canvasPreview.summary.skippedXml}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#0884C6]">Images Conv.</p>
                          <p className="text-lg font-bold">{canvasPreview.summary.convertedImgTags}</p>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-[#E2E8F0] rounded-lg shadow-sm">
                      <table className="w-full text-sm">
                        <thead className="bg-[#F8FAFC] text-[#334155]">
                          <tr>
                            <th className="text-left px-3 py-2 border-b border-[#E2E8F0] w-12">Include</th>
                            <th className="text-left px-3 py-2 border-b border-[#E2E8F0]">XML File</th>
                            <th className="text-left px-3 py-2 border-b border-[#E2E8F0] w-20">Status</th>
                            <th className="text-left px-3 py-2 border-b border-[#E2E8F0] flex-1">Issues</th>
                            <th className="text-left px-3 py-2 border-b border-[#E2E8F0] w-24">Edit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {canvasPreview.items.map((item: CanvasPreviewItem) => {
                            const expanded = expandedPreviewRows.has(item.id);
                            return (
                              <React.Fragment key={item.id}>
                                <tr className="odd:bg-white even:bg-[#FCFDFF] hover:bg-[#F0F4F8]">
                                  <td className="px-3 py-2 border-b border-[#F1F5F9]">
                                    <input
                                      type="checkbox"
                                      checked={item.includeInExport}
                                      onChange={(e) => handleCanvasIncludeToggle(item.id, e.target.checked)}
                                      className="cursor-pointer"
                                    />
                                  </td>
                                  <td className="px-3 py-2 border-b border-[#F1F5F9] font-medium text-[#0F172A] break-all">{item.xmlFileName}</td>
                                  <td className="px-3 py-2 border-b border-[#F1F5F9]">
                                    {item.status === "ready" ? (
                                      <Badge className="bg-[#DCFCE7] text-[#166534]">Ready</Badge>
                                    ) : (
                                      <Badge className="bg-[#FEF3C7] text-[#92400E]">Skipped</Badge>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 border-b border-[#F1F5F9] text-[#475569] text-xs max-w-xs overflow-hidden text-ellipsis">
                                    {item.issues.length > 0 ? item.issues[0] : '-'}
                                  </td>
                                  <td className="px-3 py-2 border-b border-[#F1F5F9]">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => togglePreviewRow(item.id)}
                                      className="whitespace-nowrap"
                                    >
                                      {expanded ? (
                                        <><ChevronUp className="w-4 h-4 mr-1" /> Hide</>
                                      ) : (
                                        <><ChevronDown className="w-4 h-4 mr-1" /> Show</>
                                      )}
                                    </Button>
                                  </td>
                                </tr>
                                {expanded && (
                                  <tr className="bg-[#F8FAFC]">
                                    <td className="px-3 py-3 border-b border-[#F1F5F9]" colSpan={5}>
                                      <div className="space-y-2">
                                        <p className="text-xs font-semibold text-[#64748B]">XML Content ({item.xmlContent.length} bytes)</p>
                                        <Textarea
                                          value={item.xmlContent}
                                          onChange={(e) => handleCanvasXmlChange(item.id, e.target.value)}
                                          className="min-h-[300px] font-mono text-xs border border-[#E2E8F0]"
                                          spellCheck="false"
                                        />
                                        {item.issues.length > 0 && (
                                          <div className="bg-[#FEF3C7] border border-[#FDBA74] rounded p-2">
                                            <p className="text-xs font-semibold text-[#92400E]">Issues:</p>
                                            <ul className="text-xs text-[#B45309] list-disc list-inside mt-1">
                                              {item.issues.map((issue, idx) => (
                                                <li key={idx}>{issue}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
