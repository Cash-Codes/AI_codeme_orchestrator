import type {
  FilterResult,
  ShortcutAction,
  ShortcutReference,
  ShortcutWebhookPayload,
  StoryContext,
} from "../types/shortcut.js";

const TRIGGER_TAG = "@codemeai";

/**
 * Parse an optional `base-branch: <name>` directive from a ticket description.
 * Returns undefined when the directive is absent.
 *
 * Accepted forms (case-insensitive):
 *   base-branch: develop
 *   base-branch:develop
 *   target-branch: develop
 */
export function parseBaseBranch(description: string): string | undefined {
  const match = description.match(/(?:base|target)-branch:\s*([^\s,\n]+)/i);
  return match?.[1];
}

/**
 * Find the first story action that is not a delete.
 * Delete events don't carry usable content and should be ignored.
 */
export function findStoryAction(
  payload: ShortcutWebhookPayload,
): ShortcutAction | undefined {
  return payload.actions.find(
    (a) => a.entity_type === "story" && a.action !== "delete",
  );
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
 *
 * Description resolution order:
 *   1. changes.description.new  — present on update events that touched description
 *   2. action.description        — present on create events
 *
 * Returns undefined when required fields (id, name) are absent, or when
 * description cannot be resolved from the payload (API fetch needed).
 */
export function extractStoryContext(
  action: ShortcutAction,
  references: ShortcutReference[] | undefined,
): StoryContext | undefined {
  const storyId = action.id;
  const name = action.changes?.name?.new ?? action.name;

  // Prefer the changed value; fall back to the top-level field (create events).
  const description = action.changes?.description?.new ?? action.description;

  if (!name || description == null) return undefined;

  const workflowStateId = action.changes?.workflow_state_id?.new;

  return {
    storyId,
    name,
    description,
    workflowStateId,
    workflowStateName: resolveWorkflowStateName(workflowStateId, references),
    baseBranch: parseBaseBranch(description),
  };
}

/**
 * Inspect a Shortcut webhook payload and decide whether to process it.
 *
 * Rules:
 *  1. Payload must contain a non-delete story action.
 *  2. The story context must be extractable (id + name + description present).
 *  3. The description must contain the trigger tag (@codemeai).
 *
 * Designed as a pure function so it can be tested without any I/O.
 * When description is absent from the payload (state-change-only updates),
 * the caller should fetch the full story via the Shortcut API and retry.
 */
export function shouldProcessPayload(
  payload: ShortcutWebhookPayload,
): FilterResult {
  const storyAction = findStoryAction(payload);

  if (!storyAction) {
    return {
      shouldProcess: false,
      reason: "No non-delete story action found in payload",
    };
  }

  const context = extractStoryContext(storyAction, payload.references);

  if (!context) {
    return {
      shouldProcess: false,
      reason: `Story ${storyAction.id}: description not in payload — API fetch required`,
      context: undefined,
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
