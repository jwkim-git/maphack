import { useCallback, useEffect, useState, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  SidebarViewModel,
  type SidebarViewState
} from "./ViewModel";

export interface SidebarAppHandle {
  dispose(): void;
  viewModel: SidebarViewModel;
}

export interface SidebarAppOptions {
  onRequestClose?: () => void;
}

function toTimestampLabel(timestamp: number | null): string {
  return typeof timestamp === "number" ? String(timestamp) : "unresolved";
}

function useSidebarState(viewModel: SidebarViewModel): SidebarViewState {
  const [state, setState] = useState<SidebarViewState>(() => viewModel.getState());

  useEffect(() => {
    return viewModel.subscribe(setState);
  }, [viewModel]);

  return state;
}

function SidebarApp({
  viewModel,
  onRequestClose
}: {
  viewModel: SidebarViewModel;
  onRequestClose?: () => void;
}): ReactElement {
  const state = useSidebarState(viewModel);
  const isBaseTab = state.activeTab === "base";
  const hasConversation = typeof state.base.conversationId === "string";

  const onClickBaseTab = useCallback(() => {
    viewModel.setActiveTab("base");
  }, [viewModel]);

  const onClickBookmarksTab = useCallback(() => {
    viewModel.setActiveTab("bookmarks");
  }, [viewModel]);

  const footerStatus = isBaseTab
    ? !hasConversation
      ? "WAITING FOR CONVERSATION"
      : state.base.loading
        ? "SYNCING MESSAGES"
        : state.base.error !== null
          ? "FAILED TO SYNC MESSAGES"
          : `${state.base.messages.length} MESSAGES SYNCED`
    : state.bookmarks.loading
      ? "SYNCING BOOKMARKS"
      : state.bookmarks.error !== null
        ? "FAILED TO SYNC BOOKMARKS"
        : `${state.bookmarks.items.length} BOOKMARKS`;

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px"
        }}
      >
        <h1 style={{ margin: 0 }}>MapHack Sidebar</h1>
        {onRequestClose ? (
          <button
            type="button"
            onClick={onRequestClose}
            aria-label="Close MapHack"
            title="Close MapHack"
          >
            닫기
          </button>
        ) : null}
      </div>
      <div>
        <button type="button" disabled={isBaseTab} onClick={onClickBaseTab}>기본</button>
        <button type="button" disabled={!isBaseTab} onClick={onClickBookmarksTab}>북마크</button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <section style={{ display: isBaseTab ? "block" : "none" }}>
          <ul>
          {hasConversation &&
          !state.base.loading &&
          state.base.error === null &&
          state.base.messages.length === 0 ? (
            <li>NO MESSAGES</li>
          ) : (
            state.base.messages.map((messageRef) => (
                <li
                  key={messageRef.id}
                  style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}
                >
                  <button
                    type="button"
                    style={{ flex: 1, textAlign: "left" }}
                    onClick={() => {
                      viewModel.onBaseRowClick(messageRef);
                    }}
                  >
                    {`[${messageRef.role}] ${messageRef.preview} (${toTimestampLabel(messageRef.timestamp)})`}
                  </button>
                  <button
                    type="button"
                    aria-pressed={viewModel.isBaseMessageBookmarked(messageRef)}
                    title={
                      viewModel.isBaseMessageBookmarked(messageRef)
                        ? "Remove bookmark"
                        : "Add bookmark"
                    }
                    style={{
                      color: viewModel.isBaseMessageBookmarked(messageRef)
                        ? "#b42318"
                        : "#667085"
                    }}
                    onClick={() => {
                      void viewModel.onBaseBookmarkToggle(messageRef);
                    }}
                  >
                    {viewModel.isBaseMessageBookmarked(messageRef) ? "★" : "☆"}
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>

        <section style={{ display: isBaseTab ? "none" : "block" }}>
          <ul>
            {!state.bookmarks.loading &&
            state.bookmarks.error === null &&
            state.bookmarks.items.length === 0 ? (
              <li>NO BOOKMARKS</li>
            ) : (
              state.bookmarks.items.map((bookmark) => (
                <li
                  key={bookmark.id}
                  style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}
                >
                  <button
                    type="button"
                    style={{ flex: 1, textAlign: "left" }}
                    onClick={() => {
                      viewModel.onBookmarkRowClick(bookmark);
                    }}
                  >
                    <span>{`${bookmark.messagePreview} (${toTimestampLabel(bookmark.timestamp)})`}</span>
                    {bookmark.edited ? <strong style={{ marginLeft: "8px" }}>EDITED</strong> : null}
                  </button>
                  <button
                    type="button"
                    aria-pressed={true}
                    title="Remove bookmark"
                    style={{ color: "#b42318" }}
                    onClick={() => {
                      void viewModel.onBookmarkToggle(bookmark);
                    }}
                  >
                    ★
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <footer
        style={{
          flexShrink: 0,
          borderTop: "1px solid #d0d5dd",
          padding: "8px 12px"
        }}
      >
        <p style={{ margin: 0 }}>{footerStatus}</p>
      </footer>
    </div>
  );
}

export async function bootstrapSidebarApp(
  rootElement: HTMLElement,
  viewModel: SidebarViewModel,
  options: SidebarAppOptions = {}
): Promise<SidebarAppHandle> {
  const root: Root = createRoot(rootElement);
  root.render(
    <SidebarApp
      viewModel={viewModel}
      onRequestClose={options.onRequestClose}
    />
  );

  void viewModel.start().catch((error: unknown) => {
    console.error("sidebar-start-failed", error);
  });

  let disposed = false;

  return {
    viewModel,
    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      root.unmount();
      viewModel.dispose();
    }
  };
}
