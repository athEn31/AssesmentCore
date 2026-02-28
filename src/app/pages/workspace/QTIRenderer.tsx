import { useState, useRef } from "react";
import { Upload, Play, Download, FileJson, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Textarea } from "../../components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { generateAndValidateMCQ, Question } from "@/engine";

export function QTIRenderer() {
  const [qtiInput, setQtiInput] = useState("");
  const [renderedContent, setRenderedContent] = useState<any>(null);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRender = () => {
    try {
      // Simple validation and parsing simulation
      const parsed = JSON.parse(qtiInput);
      setRenderedContent(parsed);
      setIsValid(true);
    } catch (error) {
      setIsValid(false);
      setRenderedContent(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(content);
          setQtiInput(JSON.stringify(parsed, null, 2));
          setRenderedContent(parsed);
          setIsValid(true);
        } else if (file.name.endsWith('.xml')) {
          setQtiInput(content);
          // For XML, we would need more complex parsing
          alert('XML parsing coming soon');
        } else {
          alert('Please upload a JSON or XML file');
        }
      } catch (error) {
        setIsValid(false);
        alert('Error reading file: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    };
    reader.readAsText(file);
  };

  const exportToQTI = () => {
    if (!renderedContent) return;

    // Convert form data to Question object for the QTI builder
    const question: Question = {
      id: renderedContent.id || `q-${Date.now()}`,
      upload_id: 'manual',
      identifier: renderedContent.id || 'question-1',
      stem: renderedContent.question || '',
      type: 'MCQ',
      options: renderedContent.options?.map((opt: any) => opt.text || '') || [],
      correct_answer: renderedContent.correctAnswer || 'A',
      validation_status: 'Valid',
    };

    // Use the production QTI builder
    const result = generateAndValidateMCQ(question);

    if ('error' in result) {
      alert('Error generating QTI: ' + result.error.message);
      return;
    }

    const blob = new Blob([result.xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qti-${question.identifier}-${Date.now()}.xml`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportToJSON = () => {
    if (!renderedContent) return;
    
    const blob = new Blob([JSON.stringify(renderedContent, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qti-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const loadSampleQTI = () => {
    const sample = {
      "id": "q_sample",
      "type": "multiple_choice",
      "question": "What is the capital of France?",
      "options": [
        { "id": "A", "text": "London" },
        { "id": "B", "text": "Paris" },
        { "id": "C", "text": "Berlin" },
        { "id": "D", "text": "Madrid" }
      ],
      "correctAnswer": "B",
      "points": 1,
      "metadata": {
        "difficulty": "easy",
        "category": "Geography"
      }
    };
    setQtiInput(JSON.stringify(sample, null, 2));
    setRenderedContent(sample);
    setIsValid(true);
  };

  return (
    <div className="h-full bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-[#FFFFFF] border-b border-[#E2E8F0] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">QTI Renderer</h1>
            <p className="text-[#475569] mt-1">Preview and validate your QTI questions in real-time</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadSampleQTI} className="border border-[#334155] text-[#1F2937] hover:bg-[#F1F5F9] rounded-md">
              <FileJson className="w-4 h-4 mr-2" />
              Load Sample
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
                QTI Input
              </CardTitle>
              <CardDescription>
                Paste your QTI JSON or upload a file to render
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <Tabs defaultValue="json" className="flex-1 flex flex-col">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="json">JSON Format</TabsTrigger>
                  <TabsTrigger value="xml">XML Format</TabsTrigger>
                </TabsList>
                <TabsContent value="json" className="flex-1 flex flex-col mt-4">
                  <Textarea
                    placeholder='{"type": "multiple_choice", "question": "Your question here..."}'
                    value={qtiInput}
                    onChange={(e) => setQtiInput(e.target.value)}
                    className="flex-1 font-mono text-sm"
                  />
                </TabsContent>
                <TabsContent value="xml" className="flex-1 flex flex-col mt-4">
                  <Textarea
                    placeholder="<assessmentItem>...</assessmentItem>"
                    className="flex-1 font-mono text-sm"
                  />
                  <Alert className="mt-4 border-[#E2E8F0] bg-[#F8FAFC]">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Coming Soon</AlertTitle>
                    <AlertDescription>
                      XML format support is currently in development.
                    </AlertDescription>
                  </Alert>
                </TabsContent>
              </Tabs>
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
                  Upload File
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.xml"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </CardContent>
          </Card>

          {/* Preview Panel */}
          <Card className="flex flex-col border border-[#E2E8F0] bg-[#FFFFFF]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileJson className="w-5 h-5" />
                Preview
              </CardTitle>
              <CardDescription>
                See how your question will appear to students
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              {isValid === null && (
                <div className="h-full flex items-center justify-center text-[#94A3B8]">
                  <div className="text-center">
                    <FileJson className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Enter QTI content and click "Render QTI" to preview</p>
                  </div>
                </div>
              )}

              {isValid === false && (
                <Alert variant="destructive" className="border-[#DC2626] bg-[#FEF2F2]">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Invalid QTI Format</AlertTitle>
                  <AlertDescription>
                    The QTI content you entered is not valid JSON. Please check your syntax and try again.
                  </AlertDescription>
                </Alert>
              )}

              {isValid === true && renderedContent && (
                <div className="space-y-6">
                  <Alert className="bg-[#F0FDF4] border-[#16A34A]">
                    <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                    <AlertTitle className="text-[#166534]">Valid QTI Content</AlertTitle>
                    <AlertDescription className="text-[#166534]">
                      Your QTI content has been successfully parsed and rendered.
                    </AlertDescription>
                  </Alert>

                  {/* Rendered Question */}
                  <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg p-6">
                    <div className="mb-4">
                      <span className="inline-block px-3 py-1 bg-[#F1F5F9] text-[#0F6CBD] rounded-full text-sm font-medium mb-4">
                        {renderedContent.type?.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      {renderedContent.metadata && (
                        <span className="inline-block ml-2 px-3 py-1 bg-[#F1F5F9] text-[#334155] rounded-full text-sm font-medium">
                          {renderedContent.metadata.difficulty}
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-semibold text-[#111827] mb-4">
                      {renderedContent.question}
                    </h3>

                    {renderedContent.options && (
                      <div className="space-y-2">
                        {renderedContent.options.map((option: any) => (
                          <label
                            key={option.id}
                            className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-[#F1F5F9] transition-colors ${
                              option.id === renderedContent.correctAnswer
                                ? 'border-[#16A34A] bg-[#F0FDF4]'
                                : 'border-[#E2E8F0]'
                            }`}
                          >
                            <input
                              type="radio"
                              name="answer"
                              className="w-4 h-4"
                              defaultChecked={option.id === renderedContent.correctAnswer}
                            />
                            <span className="font-medium text-[#475569]">{option.id}.</span>
                            <span className="text-[#111827]">{option.text}</span>
                            {option.id === renderedContent.correctAnswer && (
                              <CheckCircle2 className="w-5 h-5 text-[#16A34A] ml-auto" />
                            )}
                          </label>
                        ))}
                      </div>
                    )}

                    {renderedContent.points && (
                      <div className="mt-4 pt-4 border-t border-[#E2E8F0]">
                        <p className="text-sm text-[#475569]">
                          Points: <span className="font-semibold text-[#111827]">{renderedContent.points}</span>
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1 border border-[#334155] text-[#1F2937] hover:bg-[#F1F5F9] rounded-md"
                      onClick={exportToQTI}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export QTI
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1 border border-[#334155] text-[#1F2937] hover:bg-[#F1F5F9] rounded-md"
                      onClick={exportToJSON}
                    >
                      <FileJson className="w-4 h-4 mr-2" />
                      Export JSON
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

