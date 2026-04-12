FROM node:22-slim

# Install git (required for git worktree operations)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
  && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Install agent plugins
RUN claude plugin install superpowers \
 && claude plugin install frontend-design@claude-plugins-official \
 && claude plugin install typescript-lsp \
 && claude plugin install security-guidance

# Write Claude Code runtime config directly into the image.
# These files are NOT in the source repo — they belong to the Cloud Run environment only.
RUN mkdir -p /root/.claude/agents

RUN cat > /root/.claude/settings.json <<'EOF'
{
  "permissions": {
    "allow": [
      "Bash(npm run build)",
      "Bash(npm run lint)",
      "Bash(npm run test*)",
      "Bash(npx tsc --noEmit)",
      "Bash(git status)",
      "Bash(git diff*)",
      "Bash(git log*)",
      "Bash(git add*)",
      "Bash(git commit*)",
      "Bash(git branch*)",
      "Bash(git worktree*)"
    ],
    "deny": [
      "Bash(git push*)",
      "Bash(rm -rf*)",
      "Bash(curl*)",
      "Bash(wget*)"
    ]
  }
}
EOF

RUN cat > /root/.claude/agents/frontend-specialist.md <<'EOF'
---
name: frontend-specialist
description: UI/UX specialist for frontend changes — HTML templates, CSS, client-side JS, accessibility, and design consistency. Invokes the frontend-design skill for all implementation work.
---

You are a frontend specialist for this repository.

When given a task, invoke the `frontend-design` skill immediately using the Skill tool before doing anything else. Follow that skill's process exactly.

## Scope

- HTML templates, CSS, client-side TypeScript
- Accessibility (ARIA, keyboard navigation, WCAG AA contrast)
- Design consistency with existing components

## Constraints

- Do not modify backend routes, services, or the DB layer.
- Do not introduce new npm packages without flagging it as an open question.
- Grep for any CSS class before removing it — it may be used elsewhere.
EOF

RUN cat > /root/.claude/agents/superpower-implementer.md <<'EOF'
---
name: superpower-implementer
description: Careful full-stack implementer for backend and orchestration tasks — Express routes, services, DB changes, and the core pipeline. Invokes the using-superpowers skill for all implementation work.
---

You are a disciplined backend engineer for this repository.

When given a task, invoke the `superpowers:using-superpowers` skill immediately using the Skill tool before doing anything else. Follow that skill's process exactly.

## Scope

- Express routes, middleware, services, and clients
- DB layer — treat the runs table as append-only
- Orchestration pipeline: webhook → ticket processor → Claude agent → Shortcut comment
- Git worktree utilities and shell-invoked operations

## Constraints

- Never push to remote or open PRs.
- Never modify .env unless explicitly required.
- Never add a new npm dependency without flagging it as an open question.
EOF

WORKDIR /app

# Ensure the data directory exists so SQLite can write the DB file on first run.
RUN mkdir -p /app/data

# Install Node dependencies (production only)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy and build frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
RUN npm run build:frontend

# Copy compiled output
COPY dist/ ./dist/

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "dist/server.js"]
