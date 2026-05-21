import type { JourneyStep } from "./journeySteps";

export function checklistKey(stepId: string, index: number): string {
  return `tbox-review-check-${stepId}-${index}`;
}

export function noteKey(stepId: string): string {
  return `tbox-review-note-${stepId}`;
}

export function readChecklistForStep(step: JourneyStep): boolean[] {
  return step.acceptance.map((_, i) => localStorage.getItem(checklistKey(step.id, i)) === "1");
}

export function readNoteForStep(stepId: string): string {
  return localStorage.getItem(noteKey(stepId)) ?? "";
}

export function writeChecklistItem(stepId: string, index: number, checked: boolean): void {
  localStorage.setItem(checklistKey(stepId, index), checked ? "1" : "0");
}

export function writeNoteForStep(stepId: string, note: string): void {
  localStorage.setItem(noteKey(stepId), note);
}
