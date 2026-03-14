# QTI 3.0 Phase 4 Complete: IMS Content Packaging

## Overview

Phase 4 implements the IMS Content Package specification for QTI 3.0, enabling the creation of complete, distributable ZIP packages containing assessment tests, items, images, and a manifest file that describes all resources.

---

## Components Delivered

### 1. Resource Registry
**File**: `resourceRegistry.ts`

Manages all resources in a QTI package with automatic dependency tracking.

**Key Features**:
- Automatic resource ID generation
- Dependency tracking between resources
- File-to-resource mapping
- Resource validation
- Statistics reporting

**Resource Types**:
- `imsqti_test_xmlv3p0` - Assessment tests
- `imsqti_item_xmlv3p0` - Assessment items
- `associatedcontent/learning-application-resource` - Images and media

**Example**:
```typescript
import { ResourceRegistry } from './qti3';

const registry = new ResourceRegistry();

// Register test
registry.registerTest({
  identifier: 'TEST_001',
  href: 'assessmentTest.xml',
  title: 'My Test',
  itemIdentifiers: ['Q001', 'Q002'],
});

// Register items
registry.registerItem({
  identifier: 'Q001',
  href: 'items/Q001.xml',
  title: 'Question 1',
  imageFiles: ['images/diagram.png'],
});

// Register images (automatic from items)
// Images are auto-registered when items reference them

// Get statistics
const stats = registry.getStatistics();
console.log(stats); 
// { totalResources: 4, tests: 1, items: 2, images: 1, totalFiles: 4 }
```

---

### 2. Manifest Builder
**File**: `manifestBuilder.ts`

Generates IMS manifest.xml files compliant with IMS Content Packaging specification.

**Key Features**:
- Complete resource catalog
- Dependency declarations
- Metadata support (title, description, keywords)
- Organizations support (optional hierarchical structure)
- Validation with error reporting

**Generated Manifest Structure**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  identifier="PACKAGE_001">
  
  <metadata>
    <schema>IMS Content</schema>
    <schemaversion>1.2</schemaversion>
    <imsmd:lom>
      <imsmd:general>
        <imsmd:title>
          <imsmd:string language="en">Package Title</imsmd:string>
        </imsmd:title>
      </imsmd:general>
    </imsmd:lom>
  </metadata>
  
  <organizations />
  
  <resources>
    <resource identifier="TEST_001" 
      type="imsqti_test_xmlv3p0" 
      href="assessmentTest.xml">
      <file href="assessmentTest.xml" />
      <dependency identifierref="Q001" />
      <dependency identifierref="Q002" />
    </resource>
    
    <resource identifier="Q001" 
      type="imsqti_item_xmlv3p0" 
      href="items/Q001.xml">
      <file href="items/Q001.xml" />
      <dependency identifierref="IMG_DIAGRAM" />
    </resource>
    
    <resource identifier="IMG_DIAGRAM" 
      type="associatedcontent/learning-application-resource" 
      href="images/diagram.png">
      <file href="images/diagram.png" />
    </resource>
  </resources>
</manifest>
```

**Example**:
```typescript
import { ManifestBuilder, ManifestConfig } from './qti3';

const config: ManifestConfig = {
  identifier: 'PACKAGE_001',
  title: 'Mathematics Assessment Package',
  description: 'QTI 3.0 package with algebra and geometry questions',
  version: '1.0',
};

const builder = new ManifestBuilder(config, registry);
const manifestXML = builder.build();
```

---

### 3. Package Builder
**File**: `packageBuilder.ts`

Creates complete ZIP packages using JSZip with proper IMS Content Package structure.

**Key Features**:
- Automatic package structure creation
- Image deduplication with warnings
- Multiple output formats (blob, arraybuffer, nodebuffer, uint8array)
- Compression level control (0-9)
- Package validation before ZIP creation
- Statistics reporting (file counts, sizes)

**Package Structure**:
```
package.zip
├── imsmanifest.xml        # Resource catalog
├── assessmentTest.xml     # Test structure (Phase 3)
├── items/                 # Item folder
│   ├── Q001.xml          # Assessment item (Phase 1)
│   ├── Q002.xml          # Assessment item (Phase 1)
│   └── Q003.xml
└── images/                # Images folder
    ├── diagram1.png
    ├── chart2.jpg
    └── formula3.svg
```

**Example**:
```typescript
import { buildPackage, PackageConfig } from './qti3';

const config: PackageConfig = {
  packageIdentifier: 'MATH_PACKAGE_2024',
  packageTitle: 'Mathematics Final Exam 2024',
  packageDescription: 'Comprehensive math assessment',
  packageVersion: '1.0',
  
  testIdentifier: 'MATH_TEST_001',
  testXML: testXML, // From Phase 3
  testTitle: 'Math Test',
  
  items: [
    {
      identifier: 'Q001',
      xml: item1XML, // From Phase 1
      title: 'Linear Equations',
      images: [
        {
          filename: 'graph1.png',
          data: imageBuffer,
          mimeType: 'image/png',
        }
      ],
    },
    {
      identifier: 'Q002',
      xml: item2XML,
      title: 'Triangle Properties',
      images: [
        {
          filename: 'triangle.svg',
          data: svgString,
        }
      ],
    },
  ],
  
  outputFormat: 'blob',
  compressionLevel: 6,
};

const result = await buildPackage(config);

if (result.success) {
  console.log('Package created successfully!');
  console.log('Statistics:', result.statistics);
  // Download or save result.data
} else {
  console.error('Package creation failed:', result.errors);
}
```

---

## Complete Workflow (Phases 1-4)

### Step-by-Step Package Creation

```typescript
import {
  // Phase 1: Item building
  buildAssessmentItem,
  
  // Phase 3: Test building
  buildAssessmentTest,
  TestBuildConfig,
  
  // Phase 4: Packaging
  buildPackage,
  PackageConfig,
} from './qti3';

// Sample questions data
const questions = [
  {
    id: 'Q001',
    type: 'mcq',
    questionText: 'What is 2 + 2?',
    choices: ['3', '4', '5', '6'],
    correctAnswer: '4',
    points: 1,
    explanation: 'Basic arithmetic',
  },
  {
    id: 'Q002',
    type: 'textEntry',
    questionText: 'Capital of France?',
    correctAnswer: 'Paris',
    points: 1,
  },
];

// PHASE 1: Build items
const itemResults = questions.map(q => 
  buildAssessmentItem({
    questionType: q.type as 'mcq' | 'textEntry',
    question: q,
    imageFolderPath: './images',
  })
);

// PHASE 3: Build test
const testConfig: TestBuildConfig = {
  testIdentifier: 'TEST_001',
  testTitle: 'Sample Test',
  
  items: itemResults.map((result, index) => ({
    itemIdentifier: questions[index].id,
    itemHref: `items/${questions[index].id}.xml`,
    title: questions[index].questionText,
    weight: questions[index].points,
  })),
  
  navigationMode: 'nonlinear',
  submissionMode: 'simultaneous',
  aggregateScores: true,
};

const testXML = buildAssessmentTest(testConfig);

// PHASE 4: Build package
const packageConfig: PackageConfig = {
  packageIdentifier: 'PACKAGE_001',
  packageTitle: 'Sample Assessment Package',
  testIdentifier: 'TEST_001',
  testXML: testXML,
  
  items: itemResults.map((result, index) => ({
    identifier: questions[index].id,
    xml: result.xml,
    title: questions[index].questionText,
    images: result.images ? Array.from(result.images.entries()).map(([filename, data]) => ({
      filename,
      data,
    })) : undefined,
  })),
  
  outputFormat: 'blob',
};

const packageResult = await buildPackage(packageConfig);

if (packageResult.success) {
  // Download the package
  const blob = packageResult.data as Blob;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'assessment-package.zip';
  link.click();
  
  console.log('Package statistics:', packageResult.statistics);
  // {
  //   totalFiles: 5,
  //   testFiles: 1,
  //   itemFiles: 2,
  //   imageFiles: 1,
  //   totalSize: 45678,
  //   manifestSize: 2345
  // }
}
```

---

## Output Formats

The package builder supports multiple output formats for different environments:

### 1. Blob (Browser)
Best for browser downloads:
```typescript
const result = await buildPackage({
  ...config,
  outputFormat: 'blob',
});

const blob = result.data as Blob;
// Create download link
const url = URL.createObjectURL(blob);
```

### 2. ArrayBuffer (Browser)
For sending via XHR or Fetch:
```typescript
const result = await buildPackage({
  ...config,
  outputFormat: 'arraybuffer',
});

const arrayBuffer = result.data as ArrayBuffer;
// Send to server
fetch('/upload', {
  method: 'POST',
  body: arrayBuffer,
});
```

### 3. NodeBuffer (Node.js)
For Node.js file system:
```typescript
const result = await buildPackage({
  ...config,
  outputFormat: 'nodebuffer',
});

const buffer = result.data as Buffer;
// Save to file
fs.writeFileSync('package.zip', buffer);
```

### 4. Uint8Array (Universal)
For maximum compatibility:
```typescript
const result = await buildPackage({
  ...config,
  outputFormat: 'uint8array',
});

const uint8Array = result.data as Uint8Array;
```

---

## Compression Levels

Control ZIP compression (0-9):

```typescript
const config: PackageConfig = {
  ...baseConfig,
  compressionLevel: 9, // Maximum compression (slower)
};

// Levels:
// 0 - No compression (fastest)
// 1-3 - Fast compression
// 4-6 - Balanced (default: 6)
// 7-9 - Maximum compression (slowest)
```

**Trade-offs**:
- **Level 0**: Fastest, largest file size
- **Level 6**: Good balance (default)
- **Level 9**: Smallest file, slowest generation

---

## Package Validation

The package builder validates before creating ZIP:

```typescript
const result = await buildPackage(config);

if (!result.success) {
  console.error('Validation errors:');
  result.errors?.forEach(error => {
    console.error(`- ${error}`);
  });
  
  // Common errors:
  // - "Test XML is empty"
  // - "No items provided"
  // - "Item 'Q001' has empty XML"
  // - "Resource 'Q001' has missing dependency: 'IMG_001'"
}

// Check for warnings
if (result.warnings) {
  console.warn('Warnings:');
  result.warnings.forEach(warning => {
    console.warn(`- ${warning}`);
  });
  
  // Common warnings:
  // - "Duplicate image: diagram.png (using first occurrence)"
}
```

---

## Package Statistics

Get detailed statistics after successful build:

```typescript
const result = await buildPackage(config);

if (result.success && result.statistics) {
  const stats = result.statistics;
  
  console.log(`Total files: ${stats.totalFiles}`);
  console.log(`Test files: ${stats.testFiles}`);
  console.log(`Item files: ${stats.itemFiles}`);
  console.log(`Image files: ${stats.imageFiles}`);
  console.log(`Total size: ${(stats.totalSize / 1024).toFixed(2)} KB`);
  console.log(`Manifest size: ${stats.manifestSize} bytes`);
}
```

---

## Advanced Usage

### Custom Resource Management

```typescript
import { ResourceRegistry } from './qti3';

const registry = new ResourceRegistry();

// Register resources manually
registry.registerTest({ /* ... */ });
registry.registerItem({ /* ... */ });
registry.registerImages(['img1.png', 'img2.jpg']);

// Get dependency graph
const graph = registry.getDependencyGraph();
console.log(graph);
// {
//   TEST_001: ['Q001', 'Q002'],
//   Q001: ['IMG_DIAGRAM'],
//   Q002: [],
//   IMG_DIAGRAM: []
// }

// Validate
const validation = registry.validate();
if (!validation.valid) {
  console.error(validation.errors);
}
```

### Package with Organizations

Organizations provide hierarchical structure (optional):

```typescript
import { ManifestConfig } from './qti3';

const manifestConfig: ManifestConfig = {
  identifier: 'PACKAGE_001',
  title: 'Structured Package',
  organizations: {
    default: 'ORG_001',
    organizations: [
      {
        identifier: 'ORG_001',
        title: 'Assessment Structure',
        items: [
          {
            identifier: 'ITEM_TEST',
            title: 'Main Test',
            identifierref: 'TEST_001',
            items: [
              {
                identifier: 'ITEM_Q1',
                title: 'Question 1',
                identifierref: 'Q001',
              },
              {
                identifier: 'ITEM_Q2',
                title: 'Question 2',
                identifierref: 'Q002',
              },
            ],
          },
        ],
      },
    ],
  },
};
```

### Build with Detailed Report

```typescript
import { buildPackageWithReport } from './qti3';

const { result, report } = await buildPackageWithReport(config);

console.log('Registry:', report.registry);
// { tests: 1, items: 5, images: 3 }

console.log('Validation:', report.validation);
// { valid: true, errors: [] }

if (result.success) {
  // Use package
}
```

---

## Integration with Existing Code

### From Excel/CSV Parser

```typescript
import { parseExcel } from './fileParser';
import { buildPackage } from './qti3';

// Parse Excel
const questions = await parseExcel(excelFile);

// Build items (Phase 1)
const items = questions.map(q => buildAssessmentItem({ /* ... */ }));

// Build test (Phase 3)
const testXML = buildAssessmentTest({ /* ... */ });

// Build package (Phase 4)
const packageResult = await buildPackage({
  packageIdentifier: `EXCEL_${Date.now()}`,
  packageTitle: 'Excel Import',
  testIdentifier: 'TEST_001',
  testXML,
  items: items.map(item => ({
    identifier: item.assessmentItem.identifier,
    xml: item.xml,
  })),
  outputFormat: 'blob',
});

// Download
if (packageResult.success) {
  downloadBlob(packageResult.data, 'package.zip');
}
```

### From Workspace Component

```typescript
// In workspace page component
const handleGenerateQTI3 = async () => {
  try {
    // Step 1: Build items
    const itemResults = selectedQuestions.map(q => 
      buildAssessmentItem({
        questionType: q.type,
        question: q,
        imageFolderPath: './images',
      })
    );

    // Step 2: Build test
    const testXML = buildAssessmentTest({
      testIdentifier: `TEST_${workspaceId}`,
      testTitle: workspaceName,
      items: itemResults.map(result => ({
        itemIdentifier: result.assessmentItem.identifier,
        itemHref: `items/${result.assessmentItem.identifier}.xml`,
      })),
    });

    // Step 3: Build package
    const packageResult = await buildPackage({
      packageIdentifier: `PKG_${workspaceId}`,
      packageTitle: `${workspaceName} - QTI 3.0 Package`,
      testIdentifier: `TEST_${workspaceId}`,
      testXML,
      items: itemResults.map(result => ({
        identifier: result.assessmentItem.identifier,
        xml: result.xml,
      })),
      outputFormat: 'blob',
    });

    if (packageResult.success) {
      // Trigger download
      const url = URL.createObjectURL(packageResult.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${workspaceName}-qti3.zip`;
      link.click();
      
      toast.success('QTI 3.0 package generated successfully!');
    } else {
      toast.error('Package generation failed');
      console.error(packageResult.errors);
    }
  } catch (error) {
    toast.error('Error generating package');
    console.error(error);
  }
};
```

---

## Testing Phase 4

### Test Cases

1. **Basic package**
   - 1 test, 2 items, 1 image
   - Verify manifest structure
   - Verify ZIP contents

2. **Large package**
   - 1 test, 50 items, 25 images
   - Verify performance
   - Check compression

3. **Duplicate images**
   - Multiple items reference same image
   - Verify only one copy in package
   - Check warnings

4. **No images**
   - Items without images
   - Verify clean package

5. **All output formats**
   - Test blob, arraybuffer, nodebuffer, uint8array
   - Verify data integrity

6. **Validation failures**
   - Empty test XML
   - No items
   - Missing item XML
   - Verify error messages

7. **Statistics calculation**
   - Verify file counts
   - Verify size calculations

---

## Next Steps: Phase 5

With Phase 4 complete, we can now proceed to Phase 5: Metadata Mapping

**Phase 5 Goals**:
- Extract metadata from Excel columns (Subject, Topic, Difficulty, Tags)
- Map to QTI metadata extensions
- Add classification and keyword metadata
- Support LOM (Learning Object Metadata)
- Integrate metadata into items and test

**Files to Create/Modify**:
- `src/engine/qti3/metadataMapper.ts` - Excel → QTI metadata mapping
- Update item builders to include metadata
- Update test builder to include test-level metadata

---

## Phase 4 Summary

✅ **Resource Registry** - Automatic resource management and dependency tracking  
✅ **Manifest Builder** - IMS-compliant manifest.xml generation  
✅ **Package Builder** - Complete ZIP package creation with JSZip  
✅ **Validation** - Comprehensive error checking before packaging  
✅ **Statistics** - Detailed package information  
✅ **Multiple Formats** - Support for blob, arraybuffer, nodebuffer, uint8array  
✅ **Compression Control** - Configurable compression levels  
✅ **Image Deduplication** - Automatic duplicate detection  
✅ **Error Handling** - Detailed error messages and warnings  
✅ **Integration Ready** - Works seamlessly with Phases 1-3  

**Status**: Phase 4 is complete. The system can now create complete, distributable IMS Content Packages containing QTI 3.0 assessments with proper manifest and directory structure.
