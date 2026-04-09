// Subset of the Shortcut webhook payload shape we care about.
// Shortcut sends a top-level envelope with an `actions` array;
// each action represents one entity that changed.

export interface ShortcutActionChanges {
  description?: { new?: string; old?: string };
  workflow_state_id?: { new?: number; old?: number };
  name?: { new?: string; old?: string };
}

export interface ShortcutAction {
  id: number;
  entity_type: string; // "story" | "epic" | "workflow-state" | ...
  action: "create" | "update" | "delete";
  name?: string;
  story_type?: string;
  changes?: ShortcutActionChanges;
}

export interface ShortcutReference {
  id: number;
  entity_type: string;
  name?: string;
}

export interface ShortcutWebhookPayload {
  id: string;
  changed_at: string;
  primary_id?: number;
  version: string;
  actions: ShortcutAction[];
  references?: ShortcutReference[];
}

// Normalised context extracted from a webhook payload for a single story action.
export interface StoryContext {
  storyId: number;
  name: string;
  description: string;
  workflowStateId?: number;
  workflowStateName?: string;
}

// Result of the shouldProcess check.
export interface FilterResult {
  shouldProcess: boolean;
  reason: string;
  context?: StoryContext;
}
