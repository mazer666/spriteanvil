import React, { useState, useEffect, useRef } from "react";

export type Command = {
  id: string;
  name: string;
  description?: string;
  shortcut?: string;
  category?: string;
  keywords?: string[];
  action: () => void;
};

type Props = {
  commands: Command[];
  isOpen: boolean;
  onClose: () => void;
};

export default function CommandPalette({ commands, isOpen, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- SEARCH LOGIC (Noob Guide) ---
  // To make searching easy, we combine everything we know about a command
  // into one long string (the "haystack"), and see if it contains what you typed.
  const query = search.toLowerCase();
  const filteredCommands = commands.filter((cmd) => {
    // We look at the name, description, category, and even hidden keywords
    const haystack = [
      cmd.name,
      cmd.description,
      cmd.category,
      cmd.shortcut,
      ...(cmd.keywords ?? []),
    ]
      .filter(Boolean) // Remove empty/null items
      .join(" ")       // Combine into "Name Description Category Keywords"
      .toLowerCase();

    // If your search matches anywhere in that big string, we show it!
    return haystack.includes(query);
  });

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setSearch("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  if (!isOpen) return null;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
        onClose();
      }
    }
  }

  function handleCommandClick(cmd: Command) {
    cmd.action();
    onClose();
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "10vh",
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "600px",
          maxWidth: "90vw",
          background: "#1a1a1a",
          border: "1px solid #444",
          borderRadius: "8px",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Searchable actions..."
          style={{
            width: "100%",
            padding: "16px",
            fontSize: "16px",
            background: "#2a2a2a",
            color: "#fff",
            border: "none",
            outline: "none",
            borderBottom: "1px solid #444",
          }}
        />

        <div
          style={{
            maxHeight: "400px",
            overflowY: "auto",
          }}
        >
          {filteredCommands.length === 0 ? (
            <div
              style={{
                padding: "32px",
                textAlign: "center",
                color: "#888",
              }}
            >
              No commands found
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => (
              <div
                key={cmd.id}
                onClick={() => handleCommandClick(cmd)}
                style={{
                  padding: "12px 16px",
                  background: idx === selectedIndex ? "#3a3a3a" : "transparent",
                  cursor: "pointer",
                  borderLeft: idx === selectedIndex ? "3px solid #4a9eff" : "3px solid transparent",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "bold", marginBottom: "2px" }}>
                    {cmd.category && (
                      <span style={{ color: "#888", fontSize: "12px", marginRight: "8px" }}>
                        {cmd.category}
                      </span>
                    )}
                    {cmd.name}
                  </div>
                  {cmd.description && (
                    <div style={{ fontSize: "12px", color: "#aaa" }}>
                      {cmd.description}
                    </div>
                  )}
                </div>
                {cmd.shortcut && (
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#888",
                      padding: "4px 8px",
                      background: "#2a2a2a",
                      borderRadius: "4px",
                      fontFamily: "monospace",
                    }}
                  >
                    {cmd.shortcut}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div
          style={{
            padding: "8px 16px",
            borderTop: "1px solid #444",
            fontSize: "11px",
            color: "#888",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>↑↓ Navigate</span>
          <span>Enter to select</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
