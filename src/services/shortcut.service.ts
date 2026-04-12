import { shortcutClient } from "../clients/shortcut.client.js";
import type { ShortcutClient } from "../clients/shortcut.client.js";

// ---------------------------------------------------------------------------
// Normalised types — what the rest of the app works with
// ---------------------------------------------------------------------------

export interface Story {
  id: number;
  name: string;
  description: string;
  storyType: string;
  workflowStateId: number;
  appUrl: string;
}

export interface Comment {
  id: number;
  storyId: number;
  text: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Service — thin normalization layer over the HTTP client.
// Accepts an explicit client to make testing straightforward:
//
//   const svc = new ShortcutService(mockClient);
//
// The exported `shortcutService` singleton uses the real client.
// ---------------------------------------------------------------------------

export class ShortcutService {
  constructor(private readonly client: ShortcutClient) {}

  async getStoryById(storyId: number): Promise<Story> {
    const raw = await this.client.getStory(storyId);
    return {
      id: raw.id,
      name: raw.name,
      description: raw.description,
      storyType: raw.story_type,
      workflowStateId: raw.workflow_state_id,
      appUrl: raw.app_url,
    };
  }

  async createStoryComment(storyId: number, text: string): Promise<Comment> {
    const raw = await this.client.createComment(storyId, text);
    return {
      id: raw.id,
      storyId: raw.story_id,
      text: raw.text,
      createdAt: raw.created_at,
    };
  }
}

export const shortcutService = new ShortcutService(shortcutClient);
