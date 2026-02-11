import type { FilesystemPort } from "../../ports/filesystem.port.js";

import { createLsTool } from "./ls.tool.js";
import { createReadFileTool } from "./read-file.tool.js";
import { createWriteFileTool } from "./write-file.tool.js";
import { createEditFileTool } from "./edit-file.tool.js";
import { createGlobTool } from "./glob.tool.js";
import { createGrepTool } from "./grep.tool.js";

export {
  createLsTool,
  createReadFileTool,
  createWriteFileTool,
  createEditFileTool,
  createGlobTool,
  createGrepTool,
};

export function createFilesystemTools(fs: FilesystemPort) {
  return {
    ls: createLsTool(fs),
    read_file: createReadFileTool(fs),
    write_file: createWriteFileTool(fs),
    edit_file: createEditFileTool(fs),
    glob: createGlobTool(fs),
    grep: createGrepTool(fs),
  };
}
