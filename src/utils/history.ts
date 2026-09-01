import type { EditorState, FacadeState } from '../types/facade'
import { cloneFacadeState } from '../types/facade'

export interface HistorySnapshot {
  facade: FacadeState
  editor: EditorState
}

function cloneEditorState(editor: EditorState): EditorState {
  return {
    selectedWallIds: [...editor.selectedWallIds],
    selectedOpenings: editor.selectedOpenings.map((ref) => ({ ...ref })),
    selectedEdges: [...editor.selectedEdges],
  }
}

export class EditHistory {
  private undoStack: HistorySnapshot[] = []
  private redoStack: HistorySnapshot[] = []
  private readonly limit: number

  constructor(limit = 50) {
    this.limit = limit
  }

  record(snapshot: HistorySnapshot) {
    this.undoStack.push({
      facade: cloneFacadeState(snapshot.facade),
      editor: cloneEditorState(snapshot.editor),
    })
    if (this.undoStack.length > this.limit) {
      this.undoStack.shift()
    }
    this.redoStack = []
  }

  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  undo(current: HistorySnapshot): HistorySnapshot | null {
    if (!this.canUndo()) return null
    this.redoStack.push({
      facade: cloneFacadeState(current.facade),
      editor: cloneEditorState(current.editor),
    })
    const previous = this.undoStack.pop()!
    return {
      facade: cloneFacadeState(previous.facade),
      editor: cloneEditorState(previous.editor),
    }
  }

  redo(current: HistorySnapshot): HistorySnapshot | null {
    if (!this.canRedo()) return null
    this.undoStack.push({
      facade: cloneFacadeState(current.facade),
      editor: cloneEditorState(current.editor),
    })
    const next = this.redoStack.pop()!
    return {
      facade: cloneFacadeState(next.facade),
      editor: cloneEditorState(next.editor),
    }
  }

  clear() {
    this.undoStack = []
    this.redoStack = []
  }
}
