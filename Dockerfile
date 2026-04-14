# =============================================================================
# Stage 1: Build the React/Vite frontend
# =============================================================================
FROM node:22-slim AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
# Outputs to ../dist/frontend (vite.config.ts: outDir: "../dist/frontend")
RUN npm run build


# =============================================================================
# Stage 2: Compile TypeScript + install production deps (needs build tools for
# better-sqlite3 native bindings)
# =============================================================================
FROM node:22-slim AS backend-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
RUN npx tsc

# Prune devDeps in-place — compiled native modules stay intact
RUN npm prune --omit=dev


# =============================================================================
# Stage 3: Runtime — Claude Code agent + Express orchestration server
# =============================================================================
FROM node:22-slim AS runtime

# git is required for worktree operations
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Bundle plugins and skills directly — no marketplace auth needed at build time
COPY docker/claude/plugins /root/.claude/plugins
COPY docker/claude/skills  /root/.claude/skills

# Write Claude Code runtime config directly into the image
RUN mkdir -p /root/.claude/agents

RUN cat > /root/.claude/settings.json <<'EOF'
{
  "permissions": {
    "allow": [
      "Bash(git *)",
      "Bash(npm *)",
      "Bash(npx *)",
      "Bash(node *)",
      "Bash(mkdir *)",
      "Bash(mv *)",
      "Bash(cp *)",
      "Bash(ls *)",
      "Bash(cat *)",
      "Bash(find *)",
      "Bash(grep *)",
      "Bash(touch *)",
      "Bash(chmod *)"
    ],
    "deny": [
      "Bash(git push*)",
      "Bash(rm -rf /*)",
      "Bash(curl *)",
      "Bash(wget *)",
      "Bash(ssh *)",
      "Bash(sudo *)"
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

# Production node_modules (pre-built native modules from backend-builder)
COPY --from=backend-builder /app/node_modules ./node_modules

# Compiled backend from Stage 2
COPY --from=backend-builder /app/dist ./dist

# Built frontend SPA served as static files by Express
COPY --from=frontend-builder /app/dist/frontend ./dist/frontend

# Needed by Node to resolve ESM ("type": "module")
COPY package.json ./

# SQLite database directory — mount a volume here for persistence
RUN mkdir -p /app/data

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
