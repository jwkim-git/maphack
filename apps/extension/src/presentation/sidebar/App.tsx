import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SidebarViewModel, type SidebarViewState } from "./ViewModel";
import type { MessageRef } from "../../../../../packages/core/src/domain/entities/MessageRef";
import type { Bookmark } from "../../../../../packages/core/src/domain/entities/Bookmark";
import {
  IconClose,
  IconChatBubble,
  IconBookmark,
  IconLogo,
  IconPerson,
  IconSmartToy,
  IconScrollTop
} from "./icons";

export interface SidebarAppHandle {
  dispose(): void;
  viewModel: SidebarViewModel;
}

export interface SidebarAppOptions {
  onRequestClose?: () => void;
}


function formatTimestamp(timestamp: number | null): string {
  if (typeof timestamp !== "number") {
    return "";
  }

  const date = new Date(timestamp * 1000);
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${y}.${mo}.${d} ${h}:${mi}`;
}

function useSidebarState(viewModel: SidebarViewModel): SidebarViewState {
  const [state, setState] = useState<SidebarViewState>(() => viewModel.getState());

  useEffect(() => {
    return viewModel.subscribe(setState);
  }, [viewModel]);

  return state;
}

function BookmarkButton({
  bookmarked,
  onToggle
}: {
  bookmarked: boolean;
  onToggle: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      className={`mh-bookmark-action${bookmarked ? " mh-bookmark-action-active" : ""}`}
      aria-pressed={bookmarked}
      title={bookmarked ? "Remove bookmark" : "Add bookmark"}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <IconBookmark size={12} filled={bookmarked} />
    </button>
  );
}

function ChatBubble({
  messageRef,
  bookmarked,
  selected,
  onRowClick,
  onBookmarkToggle
}: {
  messageRef: MessageRef;
  bookmarked: boolean;
  selected: boolean;
  onRowClick: () => void;
  onBookmarkToggle: () => void;
}): ReactElement {
  const isUser = messageRef.role === "user";
  const ts = formatTimestamp(messageRef.timestamp);

  const rowClass = isUser ? "mh-bubble-row-user" : "mh-bubble-row-assistant";

  const baseBubbleClass = isUser
    ? bookmarked ? "mh-bubble mh-bubble-user-bookmarked" : "mh-bubble mh-bubble-user"
    : bookmarked ? "mh-bubble mh-bubble-assistant-bookmarked" : "mh-bubble mh-bubble-assistant";
  const bubbleClass = selected ? `${baseBubbleClass} mh-bubble-selected` : baseBubbleClass;

  const roleRowClass = isUser ? "mh-role-row mh-role-row-user" : "mh-role-row mh-role-row-assistant";
  const roleLabelClass = bookmarked ? "mh-role-label mh-role-label-highlighted" : "mh-role-label mh-role-label-default";
  const roleIconClass = bookmarked ? "mh-role-icon-highlighted" : "mh-role-icon-default";
  const bodyClass = isUser ? "mh-body-user" : "mh-body-assistant";
  const footerClass = bookmarked ? "mh-bubble-footer mh-bubble-footer-highlighted" : "mh-bubble-footer mh-bubble-footer-default";

  return (
    <div className={rowClass} data-message-ref-id={messageRef.id}>
      <div className={bubbleClass} onClick={onRowClick}>
        <div className={roleRowClass}>
          {isUser
            ? <><span className={roleLabelClass}>USER</span><IconPerson size={12} className={roleIconClass} /></>
            : <><IconSmartToy size={12} className={roleIconClass} /><span className={roleLabelClass}>ASSISTANT</span></>}
        </div>
        <div className={bodyClass}>{messageRef.preview.length > 100 ? messageRef.preview.slice(0, 100) + "…" : messageRef.preview}</div>
        <div className={footerClass}>
          {isUser
            ? <><span className="mh-timestamp">{ts}</span><BookmarkButton bookmarked={bookmarked} onToggle={onBookmarkToggle} /></>
            : <><BookmarkButton bookmarked={bookmarked} onToggle={onBookmarkToggle} /><span className="mh-timestamp">{ts}</span></>}
        </div>
      </div>
    </div>
  );
}

function BookmarkBubble({
  bookmark,
  selected,
  onRowClick,
  onBookmarkToggle
}: {
  bookmark: Bookmark;
  selected: boolean;
  onRowClick: () => void;
  onBookmarkToggle: () => void;
}): ReactElement {
  const isUser = bookmark.messageRole === "user";
  const ts = formatTimestamp(bookmark.timestamp);
  const roleRowClass = isUser ? "mh-role-row mh-role-row-user" : "mh-role-row mh-role-row-assistant";

  const rowClass = isUser ? "mh-bubble-row-user" : "mh-bubble-row-assistant";
  const bubbleBookmarkClass = selected ? "mh-bubble-bookmark mh-bubble-bookmark-selected" : "mh-bubble-bookmark";

  return (
    <div className="mh-bookmark-item">
      <div className={rowClass}>
        <div className={bubbleBookmarkClass} onClick={onRowClick}>
          <div className={roleRowClass}>
            {isUser
              ? <><span className="mh-role-label mh-role-label-highlighted">USER</span><IconPerson size={12} className="mh-role-icon-highlighted" /></>
              : <><IconSmartToy size={12} className="mh-role-icon-highlighted" /><span className="mh-role-label mh-role-label-highlighted">ASSISTANT</span></>}
          </div>
          <div className={isUser ? "mh-body-user" : "mh-body-assistant"}>
            {bookmark.messagePreview.length > 100 ? bookmark.messagePreview.slice(0, 100) + "…" : bookmark.messagePreview}
          </div>
          <div className="mh-bubble-footer mh-bubble-footer-highlighted">
            {isUser
              ? <><span className="mh-timestamp">{ts}{bookmark.edited ? <span className="mh-edited-badge">edited</span> : null}</span><BookmarkButton bookmarked={true} onToggle={onBookmarkToggle} /></>
              : <><BookmarkButton bookmarked={true} onToggle={onBookmarkToggle} /><span className="mh-timestamp">{ts}{bookmark.edited ? <span className="mh-edited-badge">edited</span> : null}</span></>}
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarApp({
  viewModel,
  onRequestClose
}: {
  viewModel: SidebarViewModel;
  onRequestClose?: () => void;
}): ReactElement {
  const state = useSidebarState(viewModel);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const bookmarkScrollRef = useRef<HTMLDivElement>(null);
  const isBaseTab = state.activeTab === "base";
  const hasConversation = typeof state.base.conversationId === "string";

  const onClickBaseTab = useCallback(() => {
    viewModel.setActiveTab("base");
  }, [viewModel]);

  const onClickBookmarksTab = useCallback(() => {
    viewModel.setActiveTab("bookmarks");
  }, [viewModel]);

  const onScrollTop = useCallback(() => {
    const ref = isBaseTab ? chatScrollRef : bookmarkScrollRef;
    ref.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [isBaseTab]);

  const prevConversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    const id = state.base.conversationId;
    if (id === null || !state.base.initialLoadSettled || !isBaseTab) {
      return;
    }
    if (id === prevConversationIdRef.current) {
      return;
    }
    prevConversationIdRef.current = id;

    const scrollContainer = chatScrollRef.current;
    if (!scrollContainer) {
      return;
    }

    const targetMessageId = state.selectedBaseMessageId;
    const rafId = requestAnimationFrame(() => {
      if (targetMessageId) {
        const bubble = scrollContainer.querySelector(`[data-message-ref-id="${targetMessageId}"]`);
        if (bubble) {
          bubble.scrollIntoView({ block: "center" });
          return;
        }
      }
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [state.base.conversationId, state.base.initialLoadSettled, isBaseTab]);

  const syncStatus = isBaseTab
    ? !hasConversation
      ? { dot: "mh-sync-dot mh-sync-dot-loading", text: "WAITING" }
      : state.base.loading
        ? { dot: "mh-sync-dot mh-sync-dot-loading", text: "SYNCING" }
        : state.base.error !== null
          ? { dot: "mh-sync-dot mh-sync-dot-error", text: "FAILED" }
          : { dot: "mh-sync-dot mh-sync-dot-ok", text: "SYNCED" }
    : state.bookmarks.loading
      ? { dot: "mh-sync-dot mh-sync-dot-loading", text: "SYNCING" }
      : state.bookmarks.error !== null
        ? { dot: "mh-sync-dot mh-sync-dot-error", text: "FAILED" }
        : { dot: "mh-sync-dot mh-sync-dot-ok", text: "SYNCED" };

  return (
    <div className="mh-root">
      <div className="mh-header">
        <div className="mh-header-logo-area">
          <IconLogo height={16.5} />
        </div>
        {onRequestClose ? (
          <button
            type="button"
            className="mh-close-btn"
            onClick={onRequestClose}
            aria-label="Close MapHack"
            title="Close MapHack"
          >
            <IconClose size={20} />
          </button>
        ) : null}
      </div>

      <nav className="mh-nav">
        <button
          type="button"
          className={`mh-tab ${isBaseTab ? "mh-tab-active" : "mh-tab-inactive"}`}
          onClick={onClickBaseTab}
        >
          <span className="mh-tab-label">
            <IconChatBubble size={14} filled={isBaseTab} />
            CHAT
          </span>
        </button>
        <button
          type="button"
          className={`mh-tab ${isBaseTab ? "mh-tab-inactive" : "mh-tab-active"}`}
          onClick={onClickBookmarksTab}
        >
          <span className="mh-tab-label">
            <IconBookmark size={14} filled={!isBaseTab} />
            BOOKMARK
          </span>
        </button>
      </nav>

      <div className={isBaseTab ? "mh-scroll" : "mh-scroll mh-hidden"} ref={chatScrollRef}>
        <div className="mh-content-chat">
          {hasConversation &&
          !state.base.loading &&
          state.base.error === null &&
          state.base.messages.length === 0 ? (
            <div className="mh-empty-message">No messages</div>
          ) : (
            state.base.messages.map((messageRef) => (
              <ChatBubble
                key={messageRef.id}
                messageRef={messageRef}
                bookmarked={viewModel.isBaseMessageBookmarked(messageRef)}
                selected={state.selectedBaseMessageId === messageRef.id}
                onRowClick={() => { viewModel.onBaseRowClick(messageRef); }}
                onBookmarkToggle={() => { void viewModel.onBaseBookmarkToggle(messageRef); }}
              />
            ))
          )}
        </div>
      </div>

      <div className={isBaseTab ? "mh-scroll mh-hidden" : "mh-scroll"} ref={bookmarkScrollRef}>
        <div className="mh-content-bookmark">
          {!state.bookmarks.loading &&
          state.bookmarks.error === null &&
          state.bookmarks.items.length === 0 ? (
            <div className="mh-empty-message">No bookmarks</div>
          ) : (
            state.bookmarks.items.map((bookmark) => (
              <BookmarkBubble
                key={bookmark.id}
                bookmark={bookmark}
                selected={state.selectedBookmarkId === bookmark.id}
                onRowClick={() => { viewModel.onBookmarkRowClick(bookmark); }}
                onBookmarkToggle={() => { void viewModel.onBookmarkToggle(bookmark); }}
              />
            ))
          )}
        </div>
      </div>

      <div className="mh-status-bar">
        <div className="mh-status-left">
          <div className="mh-count-group">
            <div className="mh-count-item">
              <IconChatBubble size={12} />
              <span className="mh-count-number">{state.base.messages.length}</span>
            </div>
            <span className="mh-count-divider">|</span>
            <div className="mh-count-item">
              <IconBookmark size={12} />
              <span className="mh-count-number">{state.bookmarks.items.length}</span>
            </div>
          </div>
          <div className="mh-sync-group">
            <span className={syncStatus.dot} />
            <span className="mh-sync-text">{syncStatus.text}</span>
          </div>
        </div>
        <button
          type="button"
          className="mh-scroll-top-btn"
          onClick={onScrollTop}
          aria-label="Scroll to top"
          title="Scroll to top"
        >
          <IconScrollTop size={16} />
        </button>
      </div>
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
