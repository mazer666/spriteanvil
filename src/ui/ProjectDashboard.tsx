import React, { useState } from "react";
import { Project } from "../lib/supabase/projects";

export type NewProjectRequest = {
  name: string;
  width: number;
  height: number;
};

type Props = {
  projects: Project[];
  onSelect: (project: Project) => void;
  onCreate: (data: NewProjectRequest) => void;
  onDelete: (project: Project) => void;
  onRename: (project: Project) => void;
  onDuplicate: (project: Project) => void;
  onRefresh: () => void;
  loading?: boolean;
  error?: string | null;
};

export default function ProjectDashboard({
  projects,
  onSelect,
  onCreate,
  onDelete,
  onRename,
  onDuplicate,
  onRefresh,
  loading,
  error,
}: Props) {
  const [name, setName] = useState("New Project");
  const [width, setWidth] = useState(64);
  const [height, setHeight] = useState(64);

  return (
    <div className="project-dashboard">
      <header className="project-dashboard__header">
        <div className="project-dashboard__header-copy">
          <div className="project-dashboard__brand">SpriteAnvil</div>
          <h1>Projects</h1>
          <p className="muted">Create a new sprite or jump straight into a recent build.</p>
        </div>
        <div className="project-dashboard__header-actions">
          <button className="uiBtn uiBtn--ghost" onClick={onRefresh} disabled={loading}>
            Refresh
          </button>
        </div>
      </header>

      {error && <div className="project-dashboard__error">{error}</div>}

      <section className="project-dashboard__create">
        <div className="project-dashboard__create-header">
          <div>
            <h2>New Sprite</h2>
            <p className="muted">Start from a clean canvas with the exact size you need.</p>
          </div>
          <button
            className="uiBtn uiBtn--primary"
            onClick={() => onCreate({ name, width, height })}
            disabled={loading || !name.trim()}
          >
            Create Project
          </button>
        </div>
        <div className="project-dashboard__create-grid">
          <div className="project-dashboard__preview">
            <div
              className="project-dashboard__preview-box"
              style={{ aspectRatio: `${width} / ${height}` }}
            >
              <span>
                {width}×{height}
              </span>
            </div>
          </div>
          <label>
            Name
            <input
              className="uiInput"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Width
            <input
              className="uiInput"
              type="number"
              min={8}
              max={1024}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
            />
          </label>
          <label>
            Height
            <input
              className="uiInput"
              type="number"
              min={8}
              max={1024}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
            />
          </label>
        </div>
      </section>

      <section className="project-dashboard__gallery">
        <div className="project-dashboard__title">Recent Projects</div>
        {loading ? (
          <div className="project-dashboard__empty">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="project-dashboard__empty">No projects yet. Create your first one above.</div>
        ) : (
          <div className="project-dashboard__grid">
            {projects.map((project) => (
              <div
                key={project.id}
                className="project-card"
                role="button"
                tabIndex={0}
                onClick={() => onSelect(project)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(project);
                  }
                }}
              >
                <div className="project-card__actions">
                  <button
                    className="project-card__action"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRename(project);
                    }}
                    title="Rename project"
                  >
                    ✎
                  </button>
                  <button
                    className="project-card__action"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDuplicate(project);
                    }}
                    title="Duplicate project"
                  >
                    ⧉
                  </button>
                  <button
                    className="project-card__action project-card__delete"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(project);
                    }}
                    title="Delete project"
                  >
                    🗑
                  </button>
                </div>
                <div className="project-card__thumb">
                  {project.thumbnail_url ? (
                    <img src={project.thumbnail_url} alt={project.name} />
                  ) : (
                    <div className="project-card__placeholder">{project.name.charAt(0)}</div>
                  )}
                </div>
                <div className="project-card__meta">
                  <div className="project-card__name">{project.name}</div>
                  <div className="project-card__date">
                    {new Date(project.updated_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
