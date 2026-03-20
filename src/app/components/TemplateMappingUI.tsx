import React, { useState, useEffect } from 'react';
import { extractTemplateFields, ExtractedTemplate, TemplateField } from '../utils/templateFieldExtractor';
import { parseSheetData, ColumnMapping, SheetRow, mapRowToFields, MappedRow } from '../utils/templateDataMapper';
import { AlertCircle, Check } from 'lucide-react';

type SubsectionEntry = {
  id: string;
  name: string;
  column: string | null;
};

type FieldMappingMode = 'add-column' | 'add-subsections';

const DEFAULT_SUBSECTIONS = ['Key Idea', 'Explanation', 'Concept', 'Final answer', 'Image'];

function supportsSubsections(field: TemplateField): boolean {
  const normalized = field.name.toLowerCase();
  return normalized === 'question stem' || normalized === 'text entry prompt' || normalized === 'incorrect feedback';
}

function normalizeSubsectionName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'subsection';
}

function subsectionMappingKey(fieldId: string, subsectionName: string): string {
  return `subsection::${fieldId}::${normalizeSubsectionName(subsectionName)}`;
}

interface TemplateMappingUIProps {
  templateXml: string;
  sheetFile: File;
  selectedQtiVersion?: string;
  onMappingComplete: (mapping: ColumnMapping, sheetRows: SheetRow[], extractedTemplate: ExtractedTemplate) => void;
  onCancel: () => void;
}

export const TemplateMappingUI: React.FC<TemplateMappingUIProps> = ({
  templateXml,
  sheetFile,
  selectedQtiVersion,
  onMappingComplete,
  onCancel,
}) => {
  const [extractedTemplate, setExtractedTemplate] = useState<ExtractedTemplate | null>(null);
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [sheetRows, setSheetRows] = useState<SheetRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [preview, setPreview] = useState<MappedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [subsectionMappings, setSubsectionMappings] = useState<Record<string, SubsectionEntry[]>>({});
  const [fieldModes, setFieldModes] = useState<Record<string, FieldMappingMode>>({});

  // Load template and sheet on mount
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        // Extract fields from template
        const template = extractTemplateFields(templateXml);
          // Validate that template was extracted successfully
          if (!template || !template.fields || template.fields.length === 0) {
            throw new Error('No extractable fields found in template. Template may be malformed.');
          }
        setExtractedTemplate(template);

        // Initialize mapping with empty values
        const initialMapping: ColumnMapping = {};
        const initialModes: Record<string, FieldMappingMode> = {};
        template.fields.forEach((field) => {
          initialMapping[field.id] = null;
          initialModes[field.id] = supportsSubsections(field) ? 'add-column' : 'add-column';
        });
        setMapping(initialMapping);
        setFieldModes(initialModes);

        // Parse sheet
        const { headers, rows } = await parseSheetData(sheetFile);
          if (!headers || headers.length === 0) {
            throw new Error('Sheet file has no columns or could not be parsed.');
          }
        setSheetHeaders(headers);
        setSheetRows(rows);

        setLoading(false);
      } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error('Template/Sheet Loading Error:', errorMsg, err);
          setError(errorMsg);
        setLoading(false);
      }
    })();
  }, [templateXml, sheetFile]);

  // Update mapping for a field
  const handleMappingChange = (fieldId: string, columnName: string | null) => {
    setMapping((prev) => ({
      ...prev,
      [fieldId]: columnName || null,
    }));
  };

  const getFieldMode = (field: TemplateField): FieldMappingMode => {
    return fieldModes[field.id] || 'add-column';
  };

  const handleFieldModeChange = (field: TemplateField, nextMode: FieldMappingMode) => {
    setFieldModes((prev) => ({
      ...prev,
      [field.id]: nextMode,
    }));

    // User preference: switching to subsection mode should clear parent column mapping.
    if (nextMode === 'add-subsections') {
      setMapping((prev) => ({
        ...prev,
        [field.id]: null,
      }));
    }
  };

  const handleAddSubsection = (fieldId: string, defaultName?: string) => {
    setSubsectionMappings((prev) => {
      const existing = prev[fieldId] || [];
      const nextName = defaultName || `Subsection ${existing.length + 1}`;
      return {
        ...prev,
        [fieldId]: [
          ...existing,
          {
            id: `${fieldId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name: nextName,
            column: null,
          },
        ],
      };
    });
  };

  const handleRemoveSubsection = (fieldId: string, subsectionId: string) => {
    setSubsectionMappings((prev) => ({
      ...prev,
      [fieldId]: (prev[fieldId] || []).filter((entry) => entry.id !== subsectionId),
    }));
  };

  const handleSubsectionNameChange = (fieldId: string, subsectionId: string, nextName: string) => {
    setSubsectionMappings((prev) => ({
      ...prev,
      [fieldId]: (prev[fieldId] || []).map((entry) =>
        entry.id === subsectionId ? { ...entry, name: nextName } : entry,
      ),
    }));
  };

  const handleSubsectionColumnChange = (fieldId: string, subsectionId: string, nextColumn: string | null) => {
    setSubsectionMappings((prev) => ({
      ...prev,
      [fieldId]: (prev[fieldId] || []).map((entry) =>
        entry.id === subsectionId ? { ...entry, column: nextColumn } : entry,
      ),
    }));
  };

  const buildFinalMapping = (): ColumnMapping => {
    const finalMapping: ColumnMapping = { ...mapping };

    if (extractedTemplate) {
      extractedTemplate.fields.forEach((field) => {
        if (supportsSubsections(field)) {
          finalMapping[`mode::${field.id}`] = getFieldMode(field);
        }
      });
    }

    Object.entries(subsectionMappings).forEach(([fieldId, entries]) => {
      entries.forEach((entry) => {
        if (!entry.name.trim()) {
          return;
        }
        finalMapping[subsectionMappingKey(fieldId, entry.name)] = entry.column || null;
      });
    });

    return finalMapping;
  };

  const validateCurrentMapping = (): { valid: boolean; errors: string[] } => {
    if (!extractedTemplate) {
      return { valid: false, errors: ['Template is not loaded.'] };
    }

    const errors: string[] = [];

    extractedTemplate.fields.forEach((field) => {
      if (!field.required) {
        return;
      }

      if (supportsSubsections(field) && getFieldMode(field) === 'add-subsections') {
        const entries = subsectionMappings[field.id] || [];
        const mappedSubsections = entries.filter((entry) => entry.column && entry.column.trim() !== '');
        if (mappedSubsections.length === 0) {
          errors.push(`Required field "${field.name}" is in subsection mode but has no mapped subsection columns`);
        }
        return;
      }

      if (!mapping[field.id]) {
        errors.push(`Required field "${field.name}" is not mapped to any sheet column`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  };

  // Toggle field requirement
  const handleToggleRequired = (fieldId: string) => {
    if (!extractedTemplate) return;

    setExtractedTemplate((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        fields: prev.fields.map((f) => (f.id === fieldId ? { ...f, required: !f.required } : f)),
      };
    });
  };

  // Generate preview
  const handleGeneratePreview = () => {
    if (!extractedTemplate) return;

    // Validate mapping
    const validation = validateCurrentMapping();
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }

    // Map all rows
    const mappedRows = sheetRows.slice(0, 5).map((row, index) => {
      const mapped = mapRowToFields(row, mapping);
      return { ...mapped, rowIndex: index };
    });

    setPreview(mappedRows);
    setShowPreview(true);
    setValidationErrors([]);
  };

  // Complete mapping
  const handleComplete = () => {
    if (!extractedTemplate) return;

    const validation = validateCurrentMapping();
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }

    onMappingComplete(buildFinalMapping(), sheetRows, extractedTemplate);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl p-6 max-h-screen overflow-y-auto">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#0F6CBD]"></div>
            <p className="mt-4 text-[#64748B]">Loading template and sheet...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl p-6">
        <div className="flex gap-3 text-red-600">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Error Loading Data</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={onCancel}
              className="mt-3 text-sm text-blue-600 hover:underline"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!extractedTemplate) {
    return null;
  }

  const visibleFields = extractedTemplate.fields.filter(
    (field) => !field.id.startsWith('placeholder_incorrect_') && !field.id.startsWith('placeholder_correct_'),
  );

  const detectedQtiVersion = extractedTemplate.version;
  const qtiVersionDisplay = selectedQtiVersion || detectedQtiVersion || 'Unknown';
  const showDetectedVersion = selectedQtiVersion && detectedQtiVersion && selectedQtiVersion !== detectedQtiVersion;

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl p-6 max-h-screen overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[#111827]">Map Template Fields to Sheet Columns</h2>
        <p className="text-sm text-[#64748B] mt-1">
          Select which column from your sheet corresponds to each template field. Use XML comments like
          {" "}<code className="text-xs bg-[#F1F5F9] px-1 py-0.5 rounded">&lt;!-- AC:concept --&gt;</code>
          {" "}in your template to mark replaceable sections.
        </p>
      </div>

      {/* Template Info */}
      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-[#64748B]">Template</p>
            <p className="font-semibold text-[#111827]">{extractedTemplate.title}</p>
          </div>
          <div>
            <p className="text-[#64748B]">QTI Version (Selected)</p>
            <p className="font-semibold text-[#111827]">{qtiVersionDisplay}</p>
            {showDetectedVersion && (
              <p className="text-xs text-[#94A3B8] mt-1">Template detected: {detectedQtiVersion}</p>
            )}
          </div>
          <div>
            <p className="text-[#64748B]">Sheet Rows</p>
            <p className="font-semibold text-[#111827]">{sheetRows.length}</p>
          </div>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm font-semibold text-red-700 mb-2">Validation Issues:</p>
          <ul className="text-sm text-red-600 space-y-1">
            {validationErrors.map((error, i) => (
              <li key={i}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Mapping Table */}
      <div className="mb-6 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Template Field</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Required</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Map to Column</th>
            </tr>
          </thead>
          <tbody>
            {visibleFields.map((field) => (
              <tr key={field.id} className="border-b border-[#E2E8F0] hover:bg-[#F9FAFB]">
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[#111827]">{field.name}</p>
                    {field.description && <p className="text-xs text-[#64748B] mt-1">{field.description}</p>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-1 bg-[#F3F4F6] text-xs font-medium text-[#6B7280] rounded">
                    {field.type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggleRequired(field.id)}
                    className={`text-xs font-medium px-2 py-1 rounded border transition-colors ${
                      field.required
                        ? 'bg-blue-100 border-blue-300 text-blue-700'
                        : 'bg-[#F3F4F6] border-[#E5E7EB] text-[#6B7280]'
                    }`}
                  >
                    {field.required ? '✓ Required' : 'Optional'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  {supportsSubsections(field) && (
                    <select
                      value={getFieldMode(field)}
                      onChange={(e) => handleFieldModeChange(field, e.target.value as FieldMappingMode)}
                      className="w-full px-3 py-2 border border-[#E2E8F0] rounded-md text-sm mb-3 focus:ring-2 focus:ring-[#0F6CBD] focus:border-transparent"
                    >
                      <option value="add-column">Add a column</option>
                      <option value="add-subsections">Add subsections</option>
                    </select>
                  )}

                  {(!supportsSubsections(field) || getFieldMode(field) === 'add-column') && (
                    <select
                      value={mapping[field.id] || ''}
                      onChange={(e) => handleMappingChange(field.id, e.target.value || null)}
                      className="w-full px-3 py-2 border border-[#E2E8F0] rounded-md text-sm focus:ring-2 focus:ring-[#0F6CBD] focus:border-transparent"
                    >
                      <option value="">-- Select Column --</option>
                      {sheetHeaders.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  )}

                  {supportsSubsections(field) && getFieldMode(field) === 'add-subsections' && (
                    <div className="mt-3 border border-[#E2E8F0] rounded-md p-3 bg-[#F9FAFB]">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-[#111827]">Subsections</p>
                        <button
                          type="button"
                          onClick={() => handleAddSubsection(field.id)}
                          className="text-xs px-2 py-1 rounded border border-[#CBD5E1] text-[#0F172A] hover:bg-[#E2E8F0]"
                        >
                          Add More
                        </button>
                      </div>

                      <p className="text-[11px] text-[#64748B] mb-2">Map each subsection to a column from your sheet.</p>

                      <div className="flex flex-wrap gap-1 mb-2">
                        {DEFAULT_SUBSECTIONS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleAddSubsection(field.id, preset)}
                            className="text-[11px] px-2 py-1 rounded bg-white border border-[#D1D5DB] text-[#334155] hover:bg-[#F1F5F9]"
                          >
                            + {preset}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-2">
                        {(subsectionMappings[field.id] || []).map((entry) => (
                          <div key={entry.id} className="grid grid-cols-12 gap-2 items-center">
                            <input
                              value={entry.name}
                              onChange={(e) => handleSubsectionNameChange(field.id, entry.id, e.target.value)}
                              placeholder="Subsection name"
                              className="col-span-4 px-2 py-1 border border-[#E2E8F0] rounded text-xs"
                            />
                            <select
                              value={entry.column || ''}
                              onChange={(e) => handleSubsectionColumnChange(field.id, entry.id, e.target.value || null)}
                              className="col-span-7 px-2 py-1 border border-[#E2E8F0] rounded text-xs"
                            >
                              <option value="">-- Select Column --</option>
                              {sheetHeaders.map((header) => (
                                <option key={header} value={header}>
                                  {header}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleRemoveSubsection(field.id, entry.id)}
                              className="col-span-1 text-xs text-red-600 hover:text-red-700"
                              title="Remove subsection"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Preview Section */}
      {showPreview && preview.length > 0 && (
        <div className="mb-6 bg-[#F9FAFB] rounded-lg border border-[#E2E8F0] p-4">
          <h3 className="text-sm font-semibold text-[#111827] mb-3">Preview (First 5 Rows)</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {preview.map((row) => (
              <div key={row.rowIndex} className="bg-white p-3 rounded border border-[#E2E8F0] text-xs">
                <p className="font-semibold text-[#111827] mb-2">Row {row.rowIndex + 1}</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(row.templateFieldValues).map(([fieldId, value]) => {
                    const field = extractedTemplate.fields.find((f) => f.id === fieldId);
                    return (
                      <div key={fieldId}>
                        <p className="text-[#64748B]">{field?.name}:</p>
                        <p className="text-[#111827] truncate">{value || '(empty)'}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-[#111827] border border-[#E2E8F0] rounded-lg hover:bg-[#F9FAFB] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleGeneratePreview}
          className="px-4 py-2 text-sm font-medium text-white bg-[#0F6CBD] rounded-lg hover:bg-[#0D5AA0] transition-colors"
        >
          Preview Mapping
        </button>
        <button
          onClick={handleComplete}
          className="px-4 py-2 text-sm font-medium text-white bg-[#16A34A] rounded-lg hover:bg-[#15803D] transition-colors flex items-center gap-2"
        >
          <Check className="h-4 w-4" />
          Complete Mapping
        </button>
      </div>
    </div>
  );
};
