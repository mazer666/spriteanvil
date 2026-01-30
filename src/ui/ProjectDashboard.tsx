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
  onRefresh: () => void;
  loading?: boolean;
  error?: string | null;
};

export default function ProjectDashboard({
  projects,
  onSelect,
  onCreate,
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
        <div>
          <h1>SpriteAnvil Projects</h1>
          <p className="muted">Select a project or start a new canvas.</p>
        </div>
        <button className="uiBtn" onClick={onRefresh} disabled={loading}>
          Refresh
        </button>
      </header>

      {error && <div className="project-dashboard__error">{error}</div>}

      <section className="project-dashboard__new">
        <h2>Create New Project</h2>
        <div className="project-dashboard__new-grid">
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
          <button
            className="uiBtn uiBtn--primary"
            onClick={() => onCreate({ name, width, height })}
            disabled={loading || !name.trim()}
          >
            Create Project
          </button>
        </div>
      </section>

      <section className="project-dashboard__gallery">
        <div className="project-dashboard__title">Your Projects</div>
        {loading ? (
          <div className="project-dashboard__empty">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="project-dashboard__empty">No projects yet. Create your first one above.</div>
        ) : (
          <div className="project-dashboard__grid">
            {projects.map((project) => (
              <button
                key={project.id}
                className="project-card"
                onClick={() => onSelect(project)}
              >
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
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
