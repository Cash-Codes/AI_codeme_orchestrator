import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { Run } from "../types.ts";
import { StatusBadge } from "./StatusBadge.tsx";

interface Props {
  run: Run;
}

function PrIcon() {
  return (
    <svg
      width={11}
      height={11}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 2.5h-1V4h1a1 1 0 011 1v5.628a2.251 2.251 0 101.5 0V5A2.5 2.5 0 0011 2.5zm1 10.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM3.75 12a.75.75 0 100 1.5.75.75 0 000-1.5z" />
    </svg>
  );
}

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const GRID = "68px 1fr 190px 120px 120px 32px";

const rowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: GRID,
  alignItems: "center",
  padding: "13px 20px",
  borderBottom: "1px solid var(--border)",
  cursor: "pointer",
  background: "var(--surface)",
  transition: "background 0.1s",
};

const linkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontFamily: "'Geist Mono', monospace",
  fontSize: 11,
  fontWeight: 500,
  color: "var(--accent)",
  background: "var(--accent-bg)",
  border: "1px solid var(--accent-border)",
  padding: "3px 9px",
  borderRadius: 5,
  whiteSpace: "nowrap",
  transition: "all 0.12s",
  textDecoration: "none",
};

export function RunRow({ run }: Props) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  function handleRowClick() {
    setOpen((o) => !o);
  }

  function stopAndOpen(e: React.MouseEvent) {
    e.stopPropagation();
  }

  const prNumber = run.pr_url ? run.pr_url.match(/\/pull\/(\d+)/)?.[1] : null;

  return (
    <>
      <div
        style={{
          ...rowStyle,
          background: open || hovered ? "var(--bg-subtle)" : "var(--surface)",
        }}
        onClick={handleRowClick}
        onKeyDown={(e) =>
          (e.key === "Enter" || e.key === " ") && handleRowClick()
        }
        role="button"
        tabIndex={0}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Run ID */}
        <span
          style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 12,
            color: "var(--dim)",
            fontWeight: 500,
          }}
        >
          #{run.id}
        </span>

        {/* Story */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            overflow: "hidden",
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {run.external_ticket_id}
          </span>
          {run.story_url ? (
            <a
              href={run.story_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={stopAndOpen}
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 10,
                fontWeight: 500,
                color: "var(--accent)",
                background: "var(--accent-bg)",
                border: "1px solid var(--accent-border)",
                padding: "2px 6px",
                borderRadius: 4,
                flexShrink: 0,
                textDecoration: "none",
              }}
            >
              {run.external_ticket_id}
            </a>
          ) : null}
        </div>

        {/* PR / branch */}
        <div style={{ display: "flex", alignItems: "center" }}>
          {run.pr_url && prNumber ? (
            <a
              href={run.pr_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={stopAndOpen}
              style={linkStyle}
            >
              <PrIcon />
              PR #{prNumber}
            </a>
          ) : run.branch_name ? (
            <span
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 11,
                color: "var(--dim)",
                fontStyle: "italic",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {run.branch_name}
            </span>
          ) : (
            <span
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 11,
                color: "var(--dim)",
              }}
            >
              —
            </span>
          )}
        </div>

        {/* Started */}
        <span
          style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 11,
            color: "var(--muted)",
          }}
        >
          {relativeTime(run.created_at)}
        </span>

        {/* Status */}
        <StatusBadge status={run.status} />

        {/* Chevron */}
        <span
          style={{
            fontSize: 11,
            color: "var(--dim)",
            textAlign: "center",
            transition: "transform 0.18s",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ⌄
        </span>
      </div>

      {/* Expandable detail panel */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            style={{
              overflow: "hidden",
              borderBottom: "1px solid var(--border)",
              background: "var(--bg-subtle)",
            }}
          >
            <div style={{ padding: "0 20px 18px" }}>
              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  paddingTop: 14,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 20,
                }}
              >
                {/* Summary or error */}
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--dim)",
                      marginBottom: 7,
                    }}
                  >
                    {run.error_message ? "Error" : "Summary"}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      lineHeight: 1.7,
                      fontFamily: "'Geist Mono', monospace",
                      color: run.error_message ? "var(--red)" : "var(--text-2)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {run.error_message ?? run.summary ?? "No output yet."}
                  </div>
                </div>

                {/* Target branch */}
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--dim)",
                      marginBottom: 7,
                    }}
                  >
                    Target branch
                  </div>
                  {run.pr_target_branch ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        fontFamily: "'Geist Mono', monospace",
                        fontSize: 11,
                        fontWeight: 500,
                        color: "var(--green)",
                        background: "var(--green-bg)",
                        border: "1px solid var(--green-border)",
                        padding: "2px 8px",
                        borderRadius: 4,
                      }}
                    >
                      → {run.pr_target_branch}
                    </span>
                  ) : (
                    <span
                      style={{
                        fontFamily: "'Geist Mono', monospace",
                        fontSize: 11,
                        color: "var(--dim)",
                      }}
                    >
                      —
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
