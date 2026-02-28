import { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Edit2,
  Save,
  X,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './ui/collapsible';
import { ValidationResult } from '../utils/questionValidator';

interface ValidationReportProps {
  columns: string[];
  rows: Record<string, any>[];
  validationResults: Map<string, ValidationResult>;
  isCollapsed?: boolean;
  onDataChange?: (updatedRows: Record<string, any>[]) => void;
}

interface EditingCell {
  rowId: string;
  column: string;
}

export function ValidationReport({
  columns,
  rows,
  validationResults,
  isCollapsed = false,
  onDataChange,
}: ValidationReportProps) {
  const [collapsed, setCollapsed] = useState(isCollapsed);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [localRows, setLocalRows] = useState(rows);
  const [customColumns, setCustomColumns] = useState<string[]>([]);
  const [editingHeaderColumn, setEditingHeaderColumn] = useState<string | null>(null);
  const [editingHeaderValue, setEditingHeaderValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);

  // Auto-select all text when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [editingCell]);

  // Auto-select all text when editing header starts
  useEffect(() => {
    if (editingHeaderColumn && headerInputRef.current) {
      setTimeout(() => {
        headerInputRef.current?.focus();
        headerInputRef.current?.select();
      }, 0);
    }
  }, [editingHeaderColumn]);

  const allColumns = [...columns, ...customColumns];

  const addCustomColumn = () => {
    const newColumnName = `Custom ${customColumns.length + 1}`;
    setCustomColumns([...customColumns, newColumnName]);
  };

  const deleteCustomColumn = (columnName: string) => {
    // Remove from custom columns
    const updatedCustomColumns = customColumns.filter(col => col !== columnName);
    setCustomColumns(updatedCustomColumns);

    // Remove the column data from all rows
    const updatedRows = localRows.map(row => {
      const { [columnName]: _, ...rest } = row;
      return rest;
    });

    setLocalRows(updatedRows);
    onDataChange?.(updatedRows);
  };

  const handleHeaderEdit = (columnName: string) => {
    setEditingHeaderColumn(columnName);
    setEditingHeaderValue(columnName);
  };

  const saveHeaderEdit = () => {
    if (!editingHeaderColumn) return;

    const customIndex = customColumns.indexOf(editingHeaderColumn);
    if (customIndex !== -1) {
      const updatedCustomColumns = [...customColumns];
      updatedCustomColumns[customIndex] = editingHeaderValue;
      setCustomColumns(updatedCustomColumns);
    }

    setEditingHeaderColumn(null);
    setEditingHeaderValue('');
  };

  const cancelHeaderEdit = () => {
    setEditingHeaderColumn(null);
    setEditingHeaderValue('');
  };

  const handleHeaderKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveHeaderEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelHeaderEdit();
    }
  };

  const toggleRowExpanded = (rowId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowId)) {
      newExpanded.delete(rowId);
    } else {
      newExpanded.add(rowId);
    }
    setExpandedRows(newExpanded);
  };

  const handleCellEdit = (rowId: string, column: string, value: any) => {
    setEditingCell({ rowId, column });
    setEditValue(value?.toString() || '');
  };

  const saveEdit = () => {
    if (!editingCell) return;

    const updatedRows = localRows.map(row => {
      if (row.id === editingCell.rowId) {
        return {
          ...row,
          [editingCell.column]: editValue,
        };
      }
      return row;
    });

    setLocalRows(updatedRows);
    onDataChange?.(updatedRows);
    setEditingCell(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  const getStatusColor = (status: ValidationResult['status']) => {
    switch (status) {
      case 'valid':
        return 'bg-green-50 border-green-200';
      case 'caution':
        return 'bg-yellow-50 border-yellow-200';
      case 'rejected':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusBadge = (status: ValidationResult['status']) => {
    switch (status) {
      case 'valid':
        return (
          <Badge className="bg-green-100 text-green-800 gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Valid
          </Badge>
        );
      case 'caution':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 gap-1">
            <AlertCircle className="w-3 h-3" />
            Caution
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-100 text-red-800 gap-1">
            <XCircle className="w-3 h-3" />
            Rejected
          </Badge>
        );
    }
  };

  if (collapsed) {
    return (
      <Card className="border border-gray-200">
        <Collapsible open={!collapsed} onOpenChange={(open: boolean) => setCollapsed(!open)}>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <ChevronDown className="w-5 h-5" />
                <h3 className="font-semibold">Validation Report</h3>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">
                  {localRows.length} rows
                </Badge>
              </div>
            </div>
          </CollapsibleTrigger>
        </Collapsible>
      </Card>
    );
  }

  return (
    <Card className="border border-gray-200">
      <Collapsible open={!collapsed} onOpenChange={(open: boolean) => setCollapsed(!open)}>
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
              >
                {collapsed ? <ChevronUp /> : <ChevronDown />}
                <CardTitle>Validation Report</CardTitle>
              </Button>
            </CollapsibleTrigger>
            <div className="flex gap-2">
              {validationResults && (
                <>
                  <Badge className="bg-green-100 text-green-800">
                    {Array.from(validationResults.values()).filter(r => r.status === 'valid').length} Valid
                  </Badge>
                  <Badge className="bg-yellow-100 text-yellow-800">
                    {Array.from(validationResults.values()).filter(r => r.status === 'caution').length} Caution
                  </Badge>
                  <Badge className="bg-red-100 text-red-800">
                    {Array.from(validationResults.values()).filter(r => r.status === 'rejected').length} Rejected
                  </Badge>
                </>
              )}
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent asChild>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              {/* Header Row */}
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  <th className="border-r border-gray-300 px-3 py-2 text-left font-semibold w-10">
                    #
                  </th>
                  {allColumns.map(col => {
                    const isCustomColumn = !columns.includes(col);
                    const isEditingHeader = editingHeaderColumn === col;

                    return (
                      <th
                        key={col}
                        className="border-r border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap bg-gray-50"
                        onClick={() => {
                          if (isCustomColumn && !isEditingHeader) {
                            handleHeaderEdit(col);
                          }
                        }}
                      >
                        {isEditingHeader ? (
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              ref={headerInputRef}
                              type="text"
                              value={editingHeaderValue}
                              onChange={(e) => setEditingHeaderValue(e.target.value)}
                              onKeyDown={handleHeaderKeyDown}
                              className="flex-1 px-2 py-1 border border-blue-300 rounded text-sm"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                saveHeaderEdit();
                              }}
                              className="text-blue-600 hover:text-blue-800 text-sm font-bold px-2"
                              title="Save (Enter)"
                            >
                              ✓
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                cancelHeaderEdit();
                              }}
                              className="text-red-600 hover:text-red-800 text-sm font-bold px-2"
                              title="Cancel (Esc)"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between group">
                            <span className={isCustomColumn ? 'cursor-pointer hover:text-blue-600 hover:underline flex-1' : 'flex-1'}>
                              {col}
                            </span>
                            {isCustomColumn && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteCustomColumn(col);
                                }}
                                className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0"
                                title="Delete column"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </th>
                    );
                  })}
                  <th className="border-r border-gray-300 px-3 py-2 text-center font-semibold bg-gray-50 w-10">
                    <button
                      onClick={addCustomColumn}
                      className="text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center justify-center"
                      title="Add custom column"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </th>
                  <th className="border-r border-gray-300 px-3 py-2 text-left font-semibold bg-gray-50 min-w-[140px]">
                    Validation Status
                  </th>
                  <th className="px-3 py-2 text-left font-semibold bg-gray-50 min-w-[100px]">
                    Details
                  </th>
                </tr>
              </thead>

              {/* Data Rows */}
              <tbody>
                {localRows.map((row, rowIndex) => {
                  const validation = validationResults.get(row.id);
                  const isExpanded = expandedRows.has(row.id);
                  const statusColor = validation ? getStatusColor(validation.status) : 'bg-white';

                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-gray-200 ${statusColor} transition-colors`}
                    >
                      {/* Row Number and Expand Button */}
                      <td className="border-r border-gray-300 px-3 py-2 text-center bg-gray-50 font-medium">
                        <button
                          onClick={() => toggleRowExpanded(row.id)}
                          className="text-gray-600 hover:text-gray-900 inline-flex"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                        <span className="ml-1">{rowIndex + 1}</span>
                      </td>

                      {/* Data Cells */}
                      {allColumns.map(col => {
                        const isEditing =
                          editingCell?.rowId === row.id && editingCell?.column === col;
                        const cellValue = row[col];

                        return (
                          <td
                            key={`${row.id}-${col}`}
                            className="border-r border-gray-300 px-3 py-2 cursor-pointer hover:bg-blue-50 max-w-xs"
                            onClick={() => {
                              if (!isEditing) {
                                handleCellEdit(row.id, col, cellValue);
                              }
                            }}
                          >
                            {isEditing ? (
                              <div 
                                className="flex gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Input
                                  ref={inputRef}
                                  value={editValue}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value)}
                                  onKeyDown={handleKeyDown}
                                  className="h-8 text-xs flex-1"
                                  onClick={(e) => e.stopPropagation()}
                                  spellCheck="false"
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    saveEdit();
                                  }}
                                  className="h-8 w-8 p-0"
                                  title="Save (Enter)"
                                >
                                  <Save className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    cancelEdit();
                                  }}
                                  className="h-8 w-8 p-0"
                                  title="Cancel (Esc)"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between group">
                                <span className="truncate text-gray-900">
                                  {cellValue?.toString() || '-'}
                                </span>
                                <Edit2 className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 ml-2 flex-shrink-0" />
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Empty cell for + button alignment */}
                      <td className="border-r border-gray-300 px-3 py-2 w-10"></td>

                      {/* Validation Status Cell */}
                      <td className="border-r border-gray-300 px-3 py-2">
                        {validation ? (
                          getStatusBadge(validation.status)
                        ) : (
                          <Badge variant="outline">-</Badge>
                        )}
                      </td>

                      {/* Expand Details Button */}
                      <td className="px-3 py-2">
                        <button
                          onClick={() => toggleRowExpanded(row.id)}
                          className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                        >
                          {isExpanded ? 'Hide' : 'Show'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Expanded Row Details */}
          {Array.from(expandedRows).map(rowId => {
            const row = localRows.find(r => r.id === rowId);
            const validation = validationResults.get(rowId);

            if (!row || !validation) return null;

            return (
              <div
                key={`details-${rowId}`}
                className="bg-gray-50 border-t border-gray-200 p-4"
              >
                <div className="max-w-3xl">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    {getStatusBadge(validation.status)}
                    <span>Question Details - {validation.detectedType?.toUpperCase()}</span>
                  </h4>

                  <div className="space-y-3">
                    {/* Question Text */}
                    <div className="bg-white p-3 rounded border border-gray-200">
                      <p className="text-xs text-gray-600 font-semibold mb-1">Question Text:</p>
                      <p className="text-sm text-gray-900">
                        {row.question || row.questionText || 'Not available'}
                      </p>
                    </div>

                    {/* Validation Issues */}
                    {(validation.criticalErrors.length > 0 || validation.warnings.length > 0) && (
                      <div className="bg-white p-3 rounded border border-gray-200">
                        {validation.criticalErrors.length > 0 && (
                          <>
                            <p className="text-xs text-gray-600 font-semibold mb-2">Critical Errors:</p>
                            <ul className="space-y-1 mb-3">
                              {validation.criticalErrors.map((error, idx) => (
                                <li key={`error-${idx}`} className="text-sm text-red-600 flex gap-2">
                                  <span className="text-red-400">•</span>
                                  <span><strong>{error.field}:</strong> {error.message}</span>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                        {validation.warnings.length > 0 && (
                          <>
                            <p className="text-xs text-gray-600 font-semibold mb-2">Warnings:</p>
                            <ul className="space-y-1">
                              {validation.warnings.map((warning, idx) => (
                                <li key={`warning-${idx}`} className="text-sm text-yellow-600 flex gap-2">
                                  <span className="text-yellow-500">⚠</span>
                                  <span><strong>{warning.field}:</strong> {warning.message}</span>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    )}

                    {/* All Row Data */}
                    <div className="bg-white p-3 rounded border border-gray-200">
                      <p className="text-xs text-gray-600 font-semibold mb-2">All Fields:</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(row).map(([key, value]) => (
                          <div key={key} className="border-l-2 border-gray-200 pl-2">
                            <p className="text-gray-600 font-medium">{key}:</p>
                            <p className="text-gray-900 truncate">
                              {value?.toString() || '-'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleRowExpanded(rowId)}
                      >
                        Close Details
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Empty State */}
          {localRows.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-gray-500">No data to display</p>
            </div>
          )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
