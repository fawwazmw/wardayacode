import { ToolRegistry } from './ToolRegistry.js';
import { ReadFileTool } from './ReadFileTool.js';
import { WriteFileTool } from './WriteFileTool.js';
import { EditFileTool } from './EditFileTool.js';
import { BashTool } from './BashTool.js';
import { GlobTool } from './GlobTool.js';
import { GrepTool } from './GrepTool.js';
import { ListFilesTool } from './ListFilesTool.js';
import { GitTool } from './GitTool.js';
import { UndoManager } from './UndoManager.js';

export { Tool } from './Tool.js';
export { ToolRegistry } from './ToolRegistry.js';
export { ReadFileTool } from './ReadFileTool.js';
export { WriteFileTool } from './WriteFileTool.js';
export { EditFileTool } from './EditFileTool.js';
export { BashTool } from './BashTool.js';
export { GlobTool } from './GlobTool.js';
export { GrepTool } from './GrepTool.js';
export { ListFilesTool } from './ListFilesTool.js';
export { UndoManager } from './UndoManager.js';
export { generateDiff } from './DiffView.js';
export { Checkpoint } from './Checkpoint.js';
export { GitTool } from './GitTool.js';

export function registerCoreTools(registry: ToolRegistry, undoManager?: UndoManager): void {
  registry.register(new ReadFileTool());

  const writeTool = new WriteFileTool();
  if (undoManager) writeTool.setUndoManager(undoManager);
  registry.register(writeTool);

  const editTool = new EditFileTool();
  if (undoManager) editTool.setUndoManager(undoManager);
  registry.register(editTool);

  registry.register(new BashTool());
  registry.register(new GlobTool());
  registry.register(new GrepTool());
  registry.register(new ListFilesTool());
  registry.register(new GitTool());
}
