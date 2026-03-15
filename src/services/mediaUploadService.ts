import { MediaFile, sanitizeMediaFilename } from '../app/utils/mediaUtils';
import { supabase } from './supabaseClient';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export interface UploadedMediaUrl {
  fileName: string;
  serialNumber: number | null;
  storagePath: string;
  publicUrl: string;
}

const DEFAULT_BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'question-media';

function extractSerialNumber(fileName: string): number | null {
  const baseName = sanitizeMediaFilename(fileName).replace(/\.[^.]+$/, '');
  const match = baseName.match(/(\d+)(?!.*\d)/);
  if (!match) return null;

  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value : null;
}

function sanitizeStorageFileName(fileName: string): string {
  const clean = sanitizeMediaFilename(fileName)
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
  return clean || `image_${Date.now()}.bin`;
}

export async function uploadMediaFilesToSupabase(
  mediaFiles: Map<string, MediaFile>,
  bucketName: string = DEFAULT_BUCKET
): Promise<UploadedMediaUrl[]> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are missing');
  }

  if (mediaFiles.size === 0) {
    return [];
  }

  const dateSegment = new Date().toISOString().slice(0, 10);
  const runSegment = new Date().toISOString().replace(/[:.]/g, '-');
  const basePath = `uploads/${dateSegment}/${runSegment}`;

  const uploaded: UploadedMediaUrl[] = [];
  let index = 0;

  for (const mediaFile of mediaFiles.values()) {
    index += 1;

    const safeFileName = sanitizeStorageFileName(mediaFile.filename);
    const storagePath = `${basePath}/${String(index).padStart(3, '0')}_${safeFileName}`;

    const payload = mediaFile.data instanceof Uint8Array
      ? mediaFile.data
      : new Uint8Array(mediaFile.data);

    const { error } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, payload, {
        contentType: mediaFile.type || 'application/octet-stream',
        upsert: true,
      });

    if (error) {
      throw new Error(
        `Failed to upload ${mediaFile.filename}: ${error.message}. ` +
        `Check bucket "${bucketName}" exists and Storage policies allow uploads.`
      );
    }

    const { data } = supabase.storage.from(bucketName).getPublicUrl(storagePath);

    uploaded.push({
      fileName: mediaFile.filename,
      serialNumber: extractSerialNumber(mediaFile.filename),
      storagePath,
      publicUrl: data.publicUrl,
    });
  }

  uploaded.sort((a, b) => {
    if (a.serialNumber == null && b.serialNumber == null) {
      return a.fileName.localeCompare(b.fileName);
    }
    if (a.serialNumber == null) return 1;
    if (b.serialNumber == null) return -1;
    if (a.serialNumber !== b.serialNumber) return a.serialNumber - b.serialNumber;
    return a.fileName.localeCompare(b.fileName);
  });

  return uploaded;
}
