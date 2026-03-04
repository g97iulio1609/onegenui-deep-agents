import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConversationList } from "../components/conversation-list.js";
import type { Conversation } from "../components/conversation-list.js";

const now = Date.now();

const conversations: Conversation[] = [
  {
    id: "c1",
    title: "Project Setup",
    lastMessage: "Let's configure the TypeScript project",
    updatedAt: new Date(now - 2 * 60 * 1000), // 2 minutes ago
    agentName: "Code Assistant",
  },
  {
    id: "c2",
    title: "Bug Investigation",
    lastMessage: "The null pointer exception occurs in the auth module",
    updatedAt: new Date(now - 60 * 60 * 1000), // 1 hour ago
  },
  {
    id: "c3",
    title: "API Design",
    lastMessage: "REST endpoints for the user service",
    updatedAt: new Date(now - 25 * 60 * 60 * 1000), // Yesterday
  },
];

describe("ConversationList", () => {
  it("should render conversation list with items", () => {
    render(<ConversationList conversations={conversations} />);
    expect(screen.getByTestId("gauss-conversation-list")).toBeTruthy();
    const items = screen.getAllByTestId("gauss-conversation-item");
    expect(items).toHaveLength(3);
    expect(screen.getByText("Project Setup")).toBeTruthy();
    expect(screen.getByText("Bug Investigation")).toBeTruthy();
    expect(screen.getByText("API Design")).toBeTruthy();
  });

  it("should show empty state when no conversations", () => {
    render(<ConversationList conversations={[]} />);
    expect(screen.getByText("No conversations found")).toBeTruthy();
  });

  it("should show custom empty message", () => {
    render(<ConversationList conversations={[]} emptyMessage="Nothing here yet" />);
    expect(screen.getByText("Nothing here yet")).toBeTruthy();
  });

  it("should filter conversations by title", () => {
    render(<ConversationList conversations={conversations} />);
    const search = screen.getByTestId("gauss-conversation-search");
    fireEvent.change(search, { target: { value: "Bug" } });
    const items = screen.getAllByTestId("gauss-conversation-item");
    expect(items).toHaveLength(1);
    expect(screen.getByText("Bug Investigation")).toBeTruthy();
  });

  it("should filter conversations by lastMessage", () => {
    render(<ConversationList conversations={conversations} />);
    const search = screen.getByTestId("gauss-conversation-search");
    fireEvent.change(search, { target: { value: "TypeScript" } });
    const items = screen.getAllByTestId("gauss-conversation-item");
    expect(items).toHaveLength(1);
    expect(screen.getByText("Project Setup")).toBeTruthy();
  });

  it("should show empty state when search matches nothing", () => {
    render(<ConversationList conversations={conversations} />);
    const search = screen.getByTestId("gauss-conversation-search");
    fireEvent.change(search, { target: { value: "zzzzzzz" } });
    expect(screen.queryAllByTestId("gauss-conversation-item")).toHaveLength(0);
    expect(screen.getByText("No conversations found")).toBeTruthy();
  });

  it("should call onSelect with correct id when item is clicked", () => {
    const onSelect = vi.fn();
    render(<ConversationList conversations={conversations} onSelect={onSelect} />);
    const items = screen.getAllByTestId("gauss-conversation-item");
    fireEvent.click(items[1]);
    expect(onSelect).toHaveBeenCalledWith("c2");
  });

  it("should call onDelete with correct id when delete button is clicked", () => {
    const onDelete = vi.fn();
    render(<ConversationList conversations={conversations} onDelete={onDelete} />);
    const items = screen.getAllByTestId("gauss-conversation-item");

    // Hover to reveal delete button
    fireEvent.mouseEnter(items[0]);
    const deleteBtn = screen.getByTestId("gauss-conversation-delete-btn");
    fireEvent.click(deleteBtn);

    expect(onDelete).toHaveBeenCalledWith("c1");
  });

  it("should call onCreate when new conversation button is clicked", () => {
    const onCreate = vi.fn();
    render(<ConversationList conversations={conversations} onCreate={onCreate} />);
    fireEvent.click(screen.getByTestId("gauss-conversation-new-btn"));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("should not show new button when onCreate is not provided", () => {
    render(<ConversationList conversations={conversations} />);
    expect(screen.queryByTestId("gauss-conversation-new-btn")).toBeNull();
  });

  it("should highlight selected item", () => {
    render(<ConversationList conversations={conversations} selectedId="c2" />);
    const items = screen.getAllByTestId("gauss-conversation-item");
    const bgColor = items[1].style.backgroundColor;
    // Should have the primary color (either CSS var or fallback)
    expect(bgColor).toBeTruthy();
    expect(items[1].style.color).toBe("rgb(255, 255, 255)");
  });

  it("should show relative time correctly", () => {
    render(<ConversationList conversations={conversations} />);
    expect(screen.getByText("2m ago")).toBeTruthy();
    expect(screen.getByText("1h ago")).toBeTruthy();
    expect(screen.getByText("Yesterday")).toBeTruthy();
  });

  it("should show agent name badge", () => {
    render(<ConversationList conversations={conversations} />);
    expect(screen.getByTestId("gauss-conversation-agent-badge")).toBeTruthy();
    expect(screen.getByText("Code Assistant")).toBeTruthy();
  });
});
