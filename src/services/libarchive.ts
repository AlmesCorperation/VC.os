import { vfs } from './vfs';
import { kernel } from './kernel';

export type ArchiveFormat = 'tar' | 'zip' | '7z' | 'iso' | 'cpio' | 'ar';
export type CompressionType = 'none' | 'gzip' | 'bzip2' | 'xz' | 'zstd' | 'lz4';

export interface ArchiveEntry {
  pathname: string;
  size: number;
  filetype: 'file' | 'dir' | 'link';
  perm: number;
  mtime: number;
  content?: string;
}

export class LibArchive {
  private static instance: LibArchive;
  
  private constructor() {}

  public static getInstance(): LibArchive {
    if (!LibArchive.instance) {
      LibArchive.instance = new LibArchive();
    }
    return LibArchive.instance;
  }

  /**
   * Simulated automatic format detection
   */
  public detectFormat(content: string): { format: ArchiveFormat; compression: CompressionType } {
    if (content.includes('VCOS_TAR_XZ')) return { format: 'tar', compression: 'xz' };
    if (content.startsWith('PK')) return { format: 'zip', compression: 'none' };
    if (content.startsWith('7z')) return { format: '7z', compression: 'none' };
    if (content.includes('CD001')) return { format: 'iso', compression: 'none' };
    
    // Default fallback
    return { format: 'tar', compression: 'none' };
  }

  /**
   * Read an archive and return its entries
   */
  public async readArchive(path: string): Promise<ArchiveEntry[]> {
    kernel.emitEvent('SYSCALL', `LIBARCHIVE_READ: ${path}`);
    const content = vfs.cat(path);
    
    if (content.startsWith('Error:')) {
      throw new Error(content);
    }

    const { format, compression } = this.detectFormat(content);
    kernel.emitEvent('TASK', `ARCHIVE_DETECTED: ${format.toUpperCase()} (${compression.toUpperCase()})`);

    // Simulated extraction logic
    try {
      if (content.trim().startsWith('{')) {
        const data = JSON.parse(content);
        if (data.files) {
          return Object.entries(data.files).map(([pathname, fileContent]) => ({
            pathname,
            size: (fileContent as string).length,
            filetype: 'file',
            perm: 0o644,
            mtime: Date.now(),
            content: fileContent as string
          }));
        }
      }
    } catch (e) {
      // Fallback for non-JSON archives
    }

    // Default simulated entry if parsing fails
    return [{
      pathname: 'extracted_data',
      size: content.length,
      filetype: 'file',
      perm: 0o644,
      mtime: Date.now(),
      content: content
    }];
  }

  /**
   * Write an archive from a list of file paths
   */
  public async writeArchive(path: string, filePaths: string[], format: ArchiveFormat = 'tar', compression: CompressionType = 'none'): Promise<void> {
    kernel.emitEvent('SYSCALL', `LIBARCHIVE_WRITE: ${path} [${format}]`);
    
    const archiveData: Record<string, string> = {};
    filePaths.forEach(p => {
      const file = vfs.getFile(p);
      if (file && file.type === 'file') {
        archiveData[p] = file.content;
      }
    });

    const magicMap: Record<ArchiveFormat, string> = {
      tar: 'VCOS_TAR',
      zip: 'PK_VCOS',
      '7z': '7Z_VCOS',
      iso: 'CD001_VCOS',
      cpio: 'CPIO_VCOS',
      ar: 'AR_VCOS'
    };

    const archiveObject = {
      magic: magicMap[format] + (compression !== 'none' ? `_${compression.toUpperCase()}` : ''),
      version: '1.0',
      format,
      compression,
      files: archiveData,
      timestamp: Date.now()
    };

    vfs.write(path, JSON.stringify(archiveObject, null, 2));
    kernel.emitEvent('MEM', `ARCHIVE_COMMITTED: ${path} (${Object.keys(archiveData).length} files)`);
  }

  /**
   * bsdtar simulated command
   */
  public async bsdtar(args: string[]): Promise<string> {
    const flags = args.filter(a => a.startsWith('-')).join('');
    const params = args.filter(a => !a.startsWith('-'));

    if (flags.includes('x')) { // Extract
      const archivePath = params[0];
      if (!archivePath) return 'bsdtar: error: no archive specified';
      
      const entries = await this.readArchive(archivePath);
      entries.forEach(entry => {
        vfs.write(entry.pathname, entry.content || '');
      });
      return `Extracted ${entries.length} files from ${archivePath}`;
    }

    if (flags.includes('c')) { // Create
      const archivePath = params[0];
      const filesToArchive = params.slice(1);
      if (!archivePath || filesToArchive.length === 0) return 'bsdtar: error: usage: bsdtar -cvf <archive> <files...>';
      
      let format: ArchiveFormat = 'tar';
      if (archivePath.endsWith('.zip')) format = 'zip';
      if (archivePath.endsWith('.iso')) format = 'iso';
      if (archivePath.endsWith('.7z')) format = '7z';

      await this.writeArchive(archivePath, filesToArchive, format);
      return `Created ${format} archive: ${archivePath}`;
    }

    if (flags.includes('t')) { // List
      const archivePath = params[0];
      if (!archivePath) return 'bsdtar: error: no archive specified';
      
      const entries = await this.readArchive(archivePath);
      return entries.map(e => `${e.perm.toString(8)} ${e.size} ${e.pathname}`).join('\n');
    }

    return 'bsdtar: usage: -x (extract), -c (create), -t (list)';
  }
}

export const libarchive = LibArchive.getInstance();
