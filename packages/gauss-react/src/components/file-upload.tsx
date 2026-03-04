import React, { useCallback, useRef, useState } from "react";

export interface FileUploadProps {
  /** Called when files are selected/dropped. */
  onUpload: (files: File[]) => void;
  /** Accepted MIME types. Default: all. */
  accept?: string;
  /** Max file size in bytes. Default: 10MB. */
  maxSize?: number;
  /** Allow multiple files. Default: false. */
  multiple?: boolean;
  /** Disabled state. */
  disabled?: boolean;
  /** Custom className. */
  className?: string;
  /** Custom label text. */
  label?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB

/** Drag-and-drop file upload zone with validation and preview. */
export function FileUpload({
  onUpload,
  accept,
  maxSize = DEFAULT_MAX_SIZE,
  multiple = false,
  disabled = false,
  className,
  label = "Drag & drop files here, or click to select",
}: FileUploadProps): React.JSX.Element {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFiles = useCallback(
    (files: File[]): { valid: File[]; errors: string[] } => {
      const valid: File[] = [];
      const errs: string[] = [];

      for (const file of files) {
        if (accept) {
          const acceptedTypes = accept.split(",").map((t) => t.trim());
          const matches = acceptedTypes.some((type) => {
            if (type.endsWith("/*")) {
              return file.type.startsWith(type.replace("/*", "/"));
            }
            return file.type === type;
          });
          if (!matches) {
            errs.push(`"${file.name}" has an unsupported file type.`);
            continue;
          }
        }
        if (file.size > maxSize) {
          errs.push(
            `"${file.name}" exceeds the maximum size of ${formatFileSize(maxSize)}.`,
          );
          continue;
        }
        valid.push(file);
      }

      return { valid, errors: errs };
    },
    [accept, maxSize],
  );

  const processFiles = useCallback(
    (files: File[]) => {
      const { valid, errors: errs } = validateFiles(files);
      setErrors(errs);

      if (valid.length > 0) {
        setSelectedFiles((prev) => {
          const next = multiple ? [...prev, ...valid] : valid;
          onUpload(next);
          return next;
        });
      }
    },
    [validateFiles, multiple, onUpload],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragging(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files);
      processFiles(files);
    },
    [disabled, processFiles],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return;
      const files = Array.from(e.target.files);
      processFiles(files);
      // Reset so the same file can be re-selected
      e.target.value = "";
    },
    [processFiles],
  );

  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && !disabled) {
        e.preventDefault();
        inputRef.current?.click();
      }
    },
    [disabled],
  );

  const removeFile = useCallback(
    (index: number) => {
      const next = selectedFiles.filter((_, i) => i !== index);
      setSelectedFiles(next);
      onUpload(next);
    },
    [selectedFiles, onUpload],
  );

  const dropZoneStyle: React.CSSProperties = {
    ...baseDropZoneStyle,
    ...(isDragging ? draggingStyle : {}),
    ...(disabled ? disabledStyle : {}),
  };

  return (
    <div className={className} data-testid="gauss-file-upload">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        data-testid="gauss-file-upload-dropzone"
        style={dropZoneStyle}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span style={labelStyle}>{label}</span>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          style={hiddenInputStyle}
          data-testid="gauss-file-upload-input"
          tabIndex={-1}
        />
      </div>

      {errors.length > 0 && (
        <div data-testid="gauss-file-upload-errors" style={errorsContainerStyle}>
          {errors.map((err, i) => (
            <div key={i} style={errorItemStyle}>
              {err}
            </div>
          ))}
        </div>
      )}

      {selectedFiles.length > 0 && (
        <ul data-testid="gauss-file-upload-list" style={fileListStyle}>
          {selectedFiles.map((file, i) => (
            <li key={i} style={fileItemStyle}>
              <span data-testid="gauss-file-upload-file-info">
                {file.name} ({formatFileSize(file.size)})
              </span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                data-testid="gauss-file-upload-remove"
                style={removeButtonStyle}
                aria-label={`Remove ${file.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Inline Styles ───────────────────────────────────────────────────────────

const baseDropZoneStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  border: "2px dashed #d1d5db",
  borderRadius: "8px",
  cursor: "pointer",
  transition: "border-color 0.15s, background-color 0.15s",
  backgroundColor: "#fafafa",
  textAlign: "center",
};

const draggingStyle: React.CSSProperties = {
  borderColor: "#6366f1",
  backgroundColor: "#eef2ff",
};

const disabledStyle: React.CSSProperties = {
  opacity: 0.5,
  cursor: "not-allowed",
};

const labelStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#6b7280",
  pointerEvents: "none",
};

const hiddenInputStyle: React.CSSProperties = {
  display: "none",
};

const errorsContainerStyle: React.CSSProperties = {
  marginTop: "8px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const errorItemStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#dc2626",
};

const fileListStyle: React.CSSProperties = {
  listStyle: "none",
  margin: "8px 0 0",
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const fileItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "6px 10px",
  fontSize: "13px",
  backgroundColor: "#f3f4f6",
  borderRadius: "6px",
};

const removeButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: "14px",
  color: "#6b7280",
  padding: "2px 6px",
  borderRadius: "4px",
  lineHeight: 1,
};
