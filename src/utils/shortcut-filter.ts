import type {
  FilterResult,
  ShortcutAction,
  ShortcutReference,
  ShortcutWebhookPayload,
  StoryContext,
} from "../types/shortcut.js";

const TRIGGER_TAG = "@codemeai";

/** Find the first action whose entity_type is "story". */
export function findStoryAction(
  payload: ShortcutWebhookPayload,
): ShortcutAction | undefined {
  return payload.actions.find((a) => a.entity_type === "story");
}

/**
 * Resolve a workflow-state name from the references array.
 * Returns undefined when the state id or references are absent.
 */
export function resolveWorkflowStateName(
  stateId: number | undefined,
  references: ShortcutReference[] | undefined,
): string | undefined {
  if (stateId == null || !references) return undefined;
  return references.find(
    (r) => r.entity_type === "workflow-state" && r.id === stateId,
  )?.name;
}

/**
 * Extract a StoryContext from a story action.
 * Returns undefined when required fields (id, name, description) are absent.
 */
export function extractStoryContext(
  action: ShortcutAction,
  references: ShortcutReference[] | undefined,
): StoryContext | undefined {
  const storyId = action.id;
  const name = action.changes?.name?.new ?? action.name;
  const description = action.changes?.description?.new;

  if (!name || description == null) return undefined;

  const workflowStateId = action.changes?.workflow_state_id?.new;

  return {
    storyId,
    name,
    description,
    workflowStateId,
    workflowStateName: resolveWorkflowStateName(workflowStateId, references),
  };
}

/**
 * Inspect a Shortcut webhook payload and decide whether to process it.
 *
 * Rules:
 *  1. Payload must contain a story action.
 *  2. The story context must be extractable (id + name + description present).
 *  3. The description must contain the trigger tag (@codemeai).
 *
 * Designed as a pure function so it can be tested without any I/O.
 */
export function shouldProcessPayload(
  payload: ShortcutWebhookPayload,
): FilterResult {
  const storyAction = findStoryAction(payload);

  if (!storyAction) {
    return {
      shouldProcess: false,
      reason: "No story action found in payload",
    };
  }

  const context = extractStoryContext(storyAction, payload.references);

  if (!context) {
    return {
      shouldProcess: false,
      reason: `Story ${storyAction.id}: missing name or description in payload — skipping (full story fetch not yet implemented)`,
    };
  }

  if (!context.description.includes(TRIGGER_TAG)) {
    return {
      shouldProcess: false,
      reason: `Story ${context.storyId}: description does not contain ${TRIGGER_TAG}`,
      context,
    };
  }

  return {
    shouldProcess: true,
    reason: `Story ${context.storyId}: trigger tag ${TRIGGER_TAG} found`,
    context,
  };
}
