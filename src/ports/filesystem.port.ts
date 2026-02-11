// =============================================================================
// FilesystemPort — Virtual filesystem contract
// =============================================================================

import type {
  FileEntry,
  FileStat,
  FilesystemZone,
  ListOptions,
  SearchOptions,
  SearchResult,
} from "../types.js";

export interface FilesystemPort {
  /** Read file content as string */
  read(path: string, zone?: FilesystemZone): Promise<string>;

  /** Write content to file, creating directories as needed */
  write(path: string, content: string, zone?: FilesystemZone): Promise<void>;

  /** Check if file or directory exists */
  exists(path: string, zone?: FilesystemZone): Promise<boolean>;

  /** Delete file or directory */
  delete(path: string, zone?: FilesystemZone): Promise<void>;

  /** List directory entries */
  list(
    path: string,
    options?: ListOptions,
    zone?: FilesystemZone,
  ): Promise<FileEntry[]>;

  /** Search file contents by regex/string pattern */
  search(
    pattern: string,
    options?: SearchOptions,
    zone?: FilesystemZone,
  ): Promise<SearchResult[]>;

  /** Find files matching glob pattern */
  glob(pattern: string, zone?: FilesystemZone): Promise<string[]>;

  /** Get file/directory metadata */
  stat(path: string, zone?: FilesystemZone): Promise<FileStat>;

  /** Sync transient data to persistent storage */
  syncToPersistent?(): Promise<void>;

  /** Clear all transient files */
  clearTransient?(): Promise<void>;
}
