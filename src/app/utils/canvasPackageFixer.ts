import JSZip from 'jszip';

export type CanvasPreviewItem = {
  id: string;
  xmlPath: string;
  xmlFileName: string;
  xmlContent: string;
  status: 'ready' | 'skipped';
  includeInExport: boolean;
  issues: string[];
  referencedImages: string[];
};

export type CanvasPreviewPackage = {
  manifestOriginalXml: string;
  items: CanvasPreviewItem[];
  imageFiles: Array<{ path: string; data: Uint8Array }>;
  summary: {
    totalXml: number;
    readyXml: number;
    skippedXml: number;
    convertedImgTags: number;
  };
};

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp']);

function normalizePath(value: string): string {
  let normalized = String(value || '').replace(/\\/g, '/').trim();
  normalized = normalized.replace(/^\.\//, '');
  normalized = normalized.replace(/[?#].*$/, '');

  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // Keep original normalized value when URI decoding fails.
  }

  return normalized;
}

function pathDir(path: string): string {
  const normalized = normalizePath(path);
  const idx = normalized.lastIndexOf('/');
  return idx === -1 ? '' : normalized.slice(0, idx);
}

function joinNormalizedPath(baseDir: string, relPath: string): string {
  const baseParts = normalizePath(baseDir).split('/').filter(Boolean);
  const relParts = normalizePath(relPath).split('/').filter(Boolean);
  const out = [...baseParts];

  for (const part of relParts) {
    if (part === '.') continue;
    if (part === '..') {
      out.pop();
      continue;
    }
    out.push(part);
  }

  return out.join('/');
}

function fileBaseName(path: string): string {
  const p = normalizePath(path);
  const parts = p.split('/');
  return parts[parts.length - 1] || '';
}

function getExt(path: string): string {
  const base = fileBaseName(path).toLowerCase();
  const idx = base.lastIndexOf('.');
  return idx >= 0 ? base.slice(idx + 1) : '';
}

function isImagePath(path: string): boolean {
  return IMAGE_EXTENSIONS.has(getExt(path));
}

function mimeFromPath(path: string): string {
  const ext = getExt(path);
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    bmp: 'image/bmp',
  };
  return map[ext] || 'application/octet-stream';
}

function isRemoteUrl(path: string): boolean {
  return /^https?:\/\//i.test(path);
}

function parseAttr(tag: string, attrName: string): string {
  const match = tag.match(new RegExp(`${attrName}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return match?.[1] || '';
}

function canonicalPathKey(value: string): string {
  const normalized = normalizePath(value).toLowerCase();
  const base = fileBaseName(normalized);
  const dotIndex = base.lastIndexOf('.');
  const rawName = dotIndex >= 0 ? base.slice(0, dotIndex) : base;
  let ext = dotIndex >= 0 ? base.slice(dotIndex + 1) : '';
  if (ext === 'jpeg') ext = 'jpg';
  const compact = rawName.replace(/[\s._-]+/g, '');
  return ext ? `${compact}.${ext}` : compact;
}

function parseManifestResources(manifestXml: string): string[] {
  return manifestXml.match(/<resource\b[\s\S]*?<\/resource>/gi) || [];
}

function getManifestImageRefsByXmlBase(manifestXml: string): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const block of parseManifestResources(manifestXml)) {
    const fileHrefMatches = Array.from(
      block.matchAll(/<file\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*\/?\s*>/gi)
    );
    const hrefs = fileHrefMatches.map((m) => normalizePath(m[1] || '')).filter(Boolean);
    const xmlHref = hrefs.find((h) => /\.xml$/i.test(h));
    if (!xmlHref) continue;

    const xmlBase = fileBaseName(xmlHref);
    const images = hrefs.filter((h) => isImagePath(h));
    map.set(xmlBase, images);
  }

  return map;
}

function resolveImageTargetPath(
  src: string,
  xmlPath: string,
  imagePathMap: Map<string, string>,
  canonicalImagePathMap: Map<string, string>,
  declaredManifestRefs: string[]
): string | undefined {
  const normalizedSrc = normalizePath(src);
  const xmlDir = pathDir(xmlPath);

  const candidatePaths = [
    normalizedSrc,
    joinNormalizedPath(xmlDir, normalizedSrc),
    fileBaseName(normalizedSrc),
  ].filter(Boolean);

  for (const candidate of candidatePaths) {
    const mapped =
      imagePathMap.get(candidate) ||
      imagePathMap.get(fileBaseName(candidate)) ||
      canonicalImagePathMap.get(canonicalPathKey(candidate));
    if (mapped) return mapped;
  }

  const srcCanonical = canonicalPathKey(normalizedSrc);
  if (srcCanonical) {
    for (const declaredPath of declaredManifestRefs) {
      if (canonicalPathKey(declaredPath) === srcCanonical) {
        const mapped =
          imagePathMap.get(declaredPath) ||
          imagePathMap.get(fileBaseName(declaredPath)) ||
          canonicalImagePathMap.get(canonicalPathKey(declaredPath));
        if (mapped) return mapped;
      }
    }
  }

  if (declaredManifestRefs.length === 1) {
    const only = declaredManifestRefs[0];
    return (
      imagePathMap.get(only) ||
      imagePathMap.get(fileBaseName(only)) ||
      canonicalImagePathMap.get(canonicalPathKey(only))
    );
  }

  return undefined;
}

function collectLocalMediaRefs(xml: string): Set<string> {
  const refs = new Set<string>();

  const objectMatches = Array.from(xml.matchAll(/<object\b[^>]*\bdata\s*=\s*["']([^"']+)["'][^>]*>/gi));
  for (const m of objectMatches) {
    const dataPath = normalizePath(m[1] || '');
    if (!dataPath || isRemoteUrl(dataPath)) continue;
    refs.add(dataPath);
  }

  const imgMatches = Array.from(xml.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi));
  for (const m of imgMatches) {
    const srcPath = normalizePath(m[1] || '');
    if (!srcPath || isRemoteUrl(srcPath)) continue;
    refs.add(srcPath);
  }

  return refs;
}

export function transformXmlForCanvasExport(xml: string): string {
  let transformed = xml;

  // Remove feedback blocks entirely to keep export lean and avoid LMS parsing issues.
  transformed = transformed.replace(/<feedbackBlock\b[^>]*>[\s\S]*?<\/feedbackBlock>/gi, '');

  // Convert <object data="..."> to Canvas-friendly <img src="..." />
  transformed = transformed.replace(
    /<object\b[^>]*\bdata\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/object>/gi,
    (_fullTag, dataPath) => {
      const src = String(dataPath || '').trim();
      if (!src) return '';
      return `<img src="${src}" alt="image" />`;
    }
  );

  return transformed;
}

function updateManifest(
  manifestXml: string,
  itemMap: Map<string, CanvasPreviewItem>
): string {
  let updated = manifestXml;

  const resourceBlocks = parseManifestResources(updated);
  for (const block of resourceBlocks) {
    const hrefMatch = block.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    const fileHrefMatches = Array.from(block.matchAll(/<file\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*\/?\s*>/gi));

    const xmlHrefFromFiles = fileHrefMatches
      .map((m) => m[1])
      .find((href) => /\.xml$/i.test(href));

    const xmlHref = xmlHrefFromFiles || hrefMatch?.[1] || '';
    const xmlBase = fileBaseName(xmlHref);
    if (!xmlBase) continue;

    const item = itemMap.get(xmlBase);
    if (!item || !item.includeInExport) {
      updated = updated.replace(block, '');
      continue;
    }

    const allImageRefs = new Set<string>(item.referencedImages || []);
    collectLocalMediaRefs(item.xmlContent).forEach((path) => allImageRefs.add(path));

    let newBlock = block;
    for (const imgPath of allImageRefs) {
      const escaped = imgPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const exists = new RegExp(`<file\\b[^>]*\\bhref\\s*=\\s*["']${escaped}["']`, 'i').test(newBlock);
      if (!exists) {
        newBlock = newBlock.replace(/<\/resource>\s*$/i, `    <file href="${imgPath}"/>\n  </resource>`);
      }
    }

    updated = updated.replace(block, newBlock);
  }

  return updated;
}

export async function prepareCanvasPackagePreview(file: File): Promise<CanvasPreviewPackage> {
  const inputZip = await JSZip.loadAsync(file);

  const allEntries = Object.entries(inputZip.files);
  const manifestEntry = allEntries.find(
    ([path, entry]) => !entry.dir && /(^|\/)imsmanifest\.xml$/i.test(path)
  );
  if (!manifestEntry) {
    throw new Error('Uploaded ZIP must contain imsmanifest.xml');
  }

  const manifestXmlOriginal = await inputZip.file(manifestEntry[0])!.async('text');
  const manifestImageRefsByXmlBase = getManifestImageRefsByXmlBase(manifestXmlOriginal);

  const imagePathMap = new Map<string, string>();
  const canonicalImagePathMap = new Map<string, string>();
  const imageFiles: Array<{ path: string; data: Uint8Array }> = [];

  for (const [path, entry] of allEntries) {
    if (entry.dir) continue;
    const normalized = normalizePath(path);
    if (!isImagePath(normalized)) continue;

    const base = fileBaseName(normalized);
    if (!base) continue;

    const target = `images/${base}`;
    imagePathMap.set(normalized, target);
    if (!imagePathMap.has(base)) {
      imagePathMap.set(base, target);
    }

    const canonical = canonicalPathKey(base);
    if (canonical && !canonicalImagePathMap.has(canonical)) {
      canonicalImagePathMap.set(canonical, target);
    }

    const bytes = await entry.async('uint8array');
    imageFiles.push({ path: target, data: bytes });
  }

  const xmlEntries = allEntries.filter(
    ([path, entry]) => !entry.dir && /\.xml$/i.test(path) && !/(^|\/)imsmanifest\.xml$/i.test(path)
  );

  const items: CanvasPreviewItem[] = [];
  let convertedImgTags = 0;

  for (let i = 0; i < xmlEntries.length; i += 1) {
    const [xmlPath] = xmlEntries[i];
    const xmlBase = fileBaseName(xmlPath);
    const xmlOutputPath = normalizePath(xmlPath);
    const xmlText = await inputZip.file(xmlPath)!.async('text');
    const declaredManifestRefs = manifestImageRefsByXmlBase.get(xmlBase) || [];

    let missingImage = false;
    let sawImageTag = false;
    const usedImages = new Set<string>();

    let updatedXml = xmlText.replace(/<img\b[^>]*\/?>|<img\b[^>]*>[\s\S]*?<\/img>/gi, (imgTag) => {
      const src = parseAttr(imgTag, 'src');
      if (!src) return imgTag;
      sawImageTag = true;

      if (isRemoteUrl(src)) {
        convertedImgTags += 1;
        return `<object data="${src}" type="${mimeFromPath(src)}"></object>`;
      }

      const mappedPath = resolveImageTargetPath(
        src,
        xmlOutputPath,
        imagePathMap,
        canonicalImagePathMap,
        declaredManifestRefs
      );

      if (!mappedPath) {
        missingImage = true;
        return imgTag;
      }

      usedImages.add(mappedPath);
      convertedImgTags += 1;
      return `<object data="${mappedPath}" type="${mimeFromPath(mappedPath)}"></object>`;
    });

    updatedXml = updatedXml.replace(/<object\b[^>]*\bdata\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/object>/gi, (fullTag, dataPath, inner) => {
      const rawData = String(dataPath || '').trim();
      if (!rawData) return fullTag;

      if (isRemoteUrl(rawData)) {
        return `<object data="${rawData}" type="${mimeFromPath(rawData)}">${inner || ''}</object>`;
      }

      const mappedPath = resolveImageTargetPath(
        rawData,
        xmlOutputPath,
        imagePathMap,
        canonicalImagePathMap,
        declaredManifestRefs
      );

      if (!mappedPath) {
        missingImage = true;
        return fullTag;
      }

      usedImages.add(mappedPath);
      return `<object data="${mappedPath}" type="${mimeFromPath(mappedPath)}">${inner || ''}</object>`;
    });

    const issues: string[] = [];
    let status: 'ready' | 'skipped' = 'ready';
    let includeInExport = true;

    // Keep preview aligned with final export behavior.
    updatedXml = transformXmlForCanvasExport(updatedXml);

    if (sawImageTag && missingImage) {
      status = 'skipped';
      issues.push('One or more image references could not be resolved in the ZIP.');
    }

    items.push({
      id: `canvas-item-${i + 1}`,
      xmlPath: xmlOutputPath,
      xmlFileName: xmlBase,
      xmlContent: updatedXml,
      status,
      includeInExport,
      issues,
      referencedImages: Array.from(usedImages),
    });
  }

  const readyXml = items.filter((item) => item.status === 'ready').length;
  const skippedXml = items.filter((item) => item.status === 'skipped').length;

  return {
    manifestOriginalXml: manifestXmlOriginal,
    items,
    imageFiles,
    summary: {
      totalXml: items.length,
      readyXml,
      skippedXml,
      convertedImgTags,
    },
  };
}

export async function buildCanvasPackageFromPreview(preview: CanvasPreviewPackage): Promise<Blob> {
  const outputZip = new JSZip();

  const itemMap = new Map<string, CanvasPreviewItem>();
  const transformedItems: CanvasPreviewItem[] = [];

  for (const item of preview.items) {
    if (!item.includeInExport) continue;

    const transformedXml = transformXmlForCanvasExport(item.xmlContent);
    const transformedItem: CanvasPreviewItem = {
      ...item,
      xmlContent: transformedXml,
    };

    transformedItems.push(transformedItem);
    itemMap.set(fileBaseName(transformedItem.xmlFileName), transformedItem);
    outputZip.file(transformedItem.xmlPath, transformedItem.xmlContent);
  }

  const updatedManifest = updateManifest(preview.manifestOriginalXml, itemMap);
  outputZip.file('imsmanifest.xml', updatedManifest);

  for (const image of preview.imageFiles) {
    outputZip.file(image.path, image.data);
  }

  return outputZip.generateAsync({ type: 'blob' });
}
