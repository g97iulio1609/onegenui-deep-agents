import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FileUpload } from "../components/file-upload.js";

function createFile(name: string, size: number, type: string): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

describe("FileUpload", () => {
  it("should render drop zone with label", () => {
    render(<FileUpload onUpload={vi.fn()} />);
    expect(screen.getByTestId("gauss-file-upload-dropzone")).toBeTruthy();
    expect(
      screen.getByText("Drag & drop files here, or click to select"),
    ).toBeTruthy();
  });

  it("should render custom label", () => {
    render(<FileUpload onUpload={vi.fn()} label="Upload your files" />);
    expect(screen.getByText("Upload your files")).toBeTruthy();
  });

  it("should handle file selection via click", () => {
    const onUpload = vi.fn();
    render(<FileUpload onUpload={onUpload} />);

    const input = screen.getByTestId("gauss-file-upload-input") as HTMLInputElement;
    const file = createFile("test.txt", 100, "text/plain");

    fireEvent.change(input, { target: { files: [file] } });

    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(onUpload).toHaveBeenCalledWith([file]);
  });

  it("should validate file size", () => {
    const onUpload = vi.fn();
    render(<FileUpload onUpload={onUpload} maxSize={500} />);

    const input = screen.getByTestId("gauss-file-upload-input") as HTMLInputElement;
    const file = createFile("big.txt", 1000, "text/plain");

    fireEvent.change(input, { target: { files: [file] } });

    expect(onUpload).not.toHaveBeenCalled();
    expect(screen.getByTestId("gauss-file-upload-errors")).toBeTruthy();
    expect(screen.getByText(/exceeds the maximum size/)).toBeTruthy();
  });

  it("should validate file type", () => {
    const onUpload = vi.fn();
    render(<FileUpload onUpload={onUpload} accept="image/png" />);

    const input = screen.getByTestId("gauss-file-upload-input") as HTMLInputElement;
    const file = createFile("doc.pdf", 100, "application/pdf");

    fireEvent.change(input, { target: { files: [file] } });

    expect(onUpload).not.toHaveBeenCalled();
    expect(screen.getByTestId("gauss-file-upload-errors")).toBeTruthy();
    expect(screen.getByText(/unsupported file type/)).toBeTruthy();
  });

  it("should show file preview list", () => {
    const onUpload = vi.fn();
    render(<FileUpload onUpload={onUpload} />);

    const input = screen.getByTestId("gauss-file-upload-input") as HTMLInputElement;
    const file = createFile("readme.md", 2048, "text/markdown");

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByTestId("gauss-file-upload-list")).toBeTruthy();
    expect(screen.getByText(/readme\.md/)).toBeTruthy();
    expect(screen.getByText(/2\.0 KB/)).toBeTruthy();
  });

  it("should remove file when remove button is clicked", () => {
    const onUpload = vi.fn();
    render(<FileUpload onUpload={onUpload} />);

    const input = screen.getByTestId("gauss-file-upload-input") as HTMLInputElement;
    const file = createFile("file.txt", 100, "text/plain");

    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByTestId("gauss-file-upload-list")).toBeTruthy();

    fireEvent.click(screen.getByTestId("gauss-file-upload-remove"));

    expect(screen.queryByTestId("gauss-file-upload-list")).toBeNull();
    expect(onUpload).toHaveBeenLastCalledWith([]);
  });

  it("should change appearance on drag over", () => {
    render(<FileUpload onUpload={vi.fn()} />);

    const dropzone = screen.getByTestId("gauss-file-upload-dropzone");

    fireEvent.dragOver(dropzone, { dataTransfer: { files: [] } });
    const activeColor = dropzone.style.borderColor;
    expect(activeColor === "#6366f1" || activeColor === "rgb(99, 102, 241)").toBe(true);

    fireEvent.dragLeave(dropzone, { dataTransfer: { files: [] } });
    const inactiveColor = dropzone.style.borderColor;
    expect(inactiveColor !== "#6366f1" && inactiveColor !== "rgb(99, 102, 241)").toBe(true);
  });

  it("should apply disabled state", () => {
    const onUpload = vi.fn();
    render(<FileUpload onUpload={onUpload} disabled />);

    const dropzone = screen.getByTestId("gauss-file-upload-dropzone");
    expect(dropzone.style.opacity).toBe("0.5");
    expect(dropzone.getAttribute("tabindex")).toBe("-1");

    // Drag over should not activate dragging style
    fireEvent.dragOver(dropzone, { dataTransfer: { files: [] } });
    expect(dropzone.style.borderColor).not.toBe("#6366f1");
  });

  it("should support multiple files mode", () => {
    const onUpload = vi.fn();
    render(<FileUpload onUpload={onUpload} multiple />);

    const input = screen.getByTestId("gauss-file-upload-input") as HTMLInputElement;
    const file1 = createFile("a.txt", 100, "text/plain");
    const file2 = createFile("b.txt", 200, "text/plain");

    fireEvent.change(input, { target: { files: [file1] } });
    fireEvent.change(input, { target: { files: [file2] } });

    expect(onUpload).toHaveBeenLastCalledWith([file1, file2]);
    expect(screen.getAllByTestId("gauss-file-upload-remove")).toHaveLength(2);
  });

  it("should handle drop event with valid files", () => {
    const onUpload = vi.fn();
    render(<FileUpload onUpload={onUpload} />);

    const dropzone = screen.getByTestId("gauss-file-upload-dropzone");
    const file = createFile("dropped.txt", 100, "text/plain");

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file] },
    });

    expect(onUpload).toHaveBeenCalledWith([file]);
  });

  it("should have accessible role and aria-label", () => {
    render(<FileUpload onUpload={vi.fn()} label="Upload files" />);
    const dropzone = screen.getByTestId("gauss-file-upload-dropzone");
    expect(dropzone.getAttribute("role")).toBe("button");
    expect(dropzone.getAttribute("aria-label")).toBe("Upload files");
  });
});
