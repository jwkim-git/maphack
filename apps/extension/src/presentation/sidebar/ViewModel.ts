import type {
  TurnNavigationTarget,
  TurnNavigator
} from "../../application/ports/TurnNavigator";
import type {
  BookmarksUpdatedSignal,
  SidebarGateway,
  SourceUpdatedSignal
} from "../../application/ports/SidebarGateway";
import type { MessageRef } from "../../../../../packages/core/src/domain/entities/MessageRef";
import type { Bookmark } from "../../../../../packages/core/src/domain/entities/Bookmark";

export type SidebarTab = "base" | "bookmarks";

export interface SidebarBaseTabState {
  conversationId: string | null;
  messages: MessageRef[];
  loading: boolean;
  error: string | null;
  initialLoadSettled: boolean;
}

export interface SidebarBookmarksTabState {
  items: Bookmark[];
  loading: boolean;
  error: string | null;
}

export interface SidebarViewState {
  activeTab: SidebarTab;
  base: SidebarBaseTabState;
  bookmarks: SidebarBookmarksTabState;
  selectedBaseMessageId: string | null;
  selectedBookmarkId: string | null;
  assistantGenerating: boolean;
}

type StateListener = (state: SidebarViewState) => void;
type ReadActiveConversationId = () => string | null;
type SubscribeActiveConversationContextInvalidation =
  (onInvalidate: () => void) => () => void;
type BaseReloadOutcome = "applied" | "skipped_due_to_navigation" | "source_missing" | "failed";
type BookmarkListReloadOutcome = "applied" | "failed" | "stale_ignored";

const LIST_BASE_RETRY_DELAYS_MS = [0, 120, 360] as const;
const LIST_BASE_RETRYABLE_ERRORS = new Set([
  "list-base-timeout",
  "list-base-no-response"
]);
const SOURCE_UPDATE_RETRY_DELAY_MS = 500;
const BOOKMARK_UPDATE_RETRY_DELAY_MS = 500;
const SELECTED_BOOKMARK_STORAGE_KEY = "maphack:selected-bookmark-id";

export class SidebarViewModel {
  private state: SidebarViewState = {
    activeTab: "base",
    base: {
      conversationId: null,
      messages: [],
      loading: false,
      error: null,
      initialLoadSettled: false
    },
    bookmarks: {
      items: [],
      loading: false,
      error: null
    },
    selectedBaseMessageId: null,
    selectedBookmarkId: null,
    assistantGenerating: false
  };

  private readonly listeners = new Set<StateListener>();
  private readonly lastAppliedSourceRevisionByConversationId = new Map<string, number>();
  private readonly pendingSourceRevisionByConversationId = new Map<string, number>();
  private activeSourceUpdateBackgroundSessionId: string | null = null;
  private lastAppliedBookmarkRevision: number | null = null;
  private pendingBookmarkRevision: number | null = null;
  private activeBookmarkUpdateBackgroundSessionId: string | null = null;
  private unsubscribeSourceUpdated: (() => void) | null = null;
  private unsubscribeBookmarksUpdated: (() => void) | null = null;
  private unsubscribeActiveConversationContextInvalidation: (() => void) | null = null;
  private reloadBaseInFlight: Promise<BaseReloadOutcome> | null = null;
  private reloadBaseConversationIdInFlight: string | null = null;
  private reloadBookmarksInFlight: Promise<BookmarkListReloadOutcome> | null = null;
  private bookmarkMutationRevision = 0;
  private sourceUpdateDrainInFlight: Promise<void> | null = null;
  private bookmarkUpdateDrainInFlight: Promise<void> | null = null;
  private sourceUpdateRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private bookmarkUpdateRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(
    private readonly gateway: SidebarGateway,
    private readonly turnNavigator: TurnNavigator,
    private readonly readActiveConversationId: ReadActiveConversationId,
    private readonly subscribeActiveConversationContextInvalidation:
      SubscribeActiveConversationContextInvalidation
  ) {}

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());

    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): SidebarViewState {
    return {
      activeTab: this.state.activeTab,
      base: {
        conversationId: this.state.base.conversationId,
        messages: this.state.base.messages.map((message) => ({
          ...message,
          metadata: {
            ...message.metadata
          }
        })),
        loading: this.state.base.loading,
        error: this.state.base.error,
        initialLoadSettled: this.state.base.initialLoadSettled
      },
      bookmarks: {
        items: this.state.bookmarks.items.map((bookmark) => ({ ...bookmark })),
        loading: this.state.bookmarks.loading,
        error: this.state.bookmarks.error
      },
      selectedBaseMessageId: this.state.selectedBaseMessageId,
      selectedBookmarkId: this.state.selectedBookmarkId,
      assistantGenerating: this.state.assistantGenerating
    };
  }

  async start(): Promise<void> {
    if (this.disposed) {
      return;
    }

    if (this.unsubscribeSourceUpdated === null) {
      this.unsubscribeSourceUpdated = this.gateway.subscribeSourceUpdated((signal) => {
        this.onSourceUpdated(signal);
      });
    }

    if (this.unsubscribeBookmarksUpdated === null) {
      this.unsubscribeBookmarksUpdated = this.gateway.subscribeBookmarksUpdated((signal) => {
        this.onBookmarksUpdated(signal);
      });
    }

    if (this.unsubscribeActiveConversationContextInvalidation === null) {
      this.unsubscribeActiveConversationContextInvalidation =
        this.subscribeActiveConversationContextInvalidation(() => {
          if (this.disposed) {
            return;
          }

          void this.reconcileActiveConversation().catch((error: unknown) => {
            console.error("active-conversation-reconcile-failed", error);
          });
        });
    }

    await this.reloadBookmarks();
    await this.reconcileActiveConversation();
    this.restoreSelectedBookmarkFromSession();
  }

  setActiveTab(tab: SidebarTab): void {
    if (this.disposed || this.state.activeTab === tab) {
      return;
    }

    this.patchState({ activeTab: tab });
  }

  dispose(): void {
    this.disposed = true;
    this.pendingSourceRevisionByConversationId.clear();
    this.lastAppliedSourceRevisionByConversationId.clear();
    this.activeSourceUpdateBackgroundSessionId = null;
    this.pendingBookmarkRevision = null;
    this.lastAppliedBookmarkRevision = null;
    this.activeBookmarkUpdateBackgroundSessionId = null;
    this.clearScheduledSourceUpdateDrain();
    this.clearScheduledBookmarkUpdateDrain();
    this.unsubscribeSourceUpdated?.();
    this.unsubscribeSourceUpdated = null;
    this.unsubscribeBookmarksUpdated?.();
    this.unsubscribeBookmarksUpdated = null;
    this.unsubscribeActiveConversationContextInvalidation?.();
    this.unsubscribeActiveConversationContextInvalidation = null;
    this.listeners.clear();
  }

  async reloadBookmarks(): Promise<void> {
    await this.loadBookmarks();
  }

  async addBookmark(messageRef: MessageRef): Promise<boolean> {
    if (this.disposed) {
      return false;
    }

    this.patchBookmarkState({ loading: true, error: null });
    const result = await this.gateway.addBookmark(messageRef);

    if (!result.ok) {
      this.patchBookmarkState({ loading: false, error: result.error });
      return false;
    }

    this.applyBookmarkAdded(result.value);
    return true;
  }

  async removeBookmark(bookmarkId: string): Promise<boolean> {
    if (this.disposed) {
      return false;
    }

    this.patchBookmarkState({ loading: true, error: null });
    const result = await this.gateway.removeBookmark(bookmarkId);

    if (!result.ok) {
      this.patchBookmarkState({ loading: false, error: result.error });
      return false;
    }

    this.applyBookmarkRemoved(result.value);
    return true;
  }

  isBaseMessageBookmarked(messageRef: MessageRef): boolean {
    return this.findExactBookmarkForMessage(messageRef) !== null;
  }

  onBaseRowClick(messageRef: MessageRef): void {
    const activeConversationId = this.readActiveConversationId();
    if (activeConversationId !== messageRef.conversationId) {
      return;
    }

    this.patchState({ selectedBaseMessageId: messageRef.id });

    this.runTurnNavigation(
      this.turnNavigator.navigateWithinConversation(
        this.createTurnNavigationTarget(
          messageRef.conversationId,
          messageRef.conversationUrl,
          messageRef.id,
          messageRef.metadata.turnIndex
        )
      ),
      "base-row-navigation-failed"
    );
  }

  onBookmarkRowClick(bookmark: Bookmark): void {
    this.patchState({ selectedBookmarkId: bookmark.id });

    const target = this.createTurnNavigationTarget(
      bookmark.conversationId,
      bookmark.conversationUrl,
      bookmark.messageId,
      bookmark.turnIndex
    );
    const activeConversationId = this.readActiveConversationId();

    if (activeConversationId === bookmark.conversationId) {
      this.runTurnNavigation(
        this.turnNavigator.navigateWithinConversation(target),
        "bookmark-row-navigation-failed"
      );
      return;
    }

    this.writeSelectedBookmarkToSession(bookmark.id, bookmark.messageId);
    this.runTurnNavigation(
      this.turnNavigator.navigateAcrossConversations(target),
      "bookmark-row-cross-conversation-navigation-failed"
    );
  }

  async onBaseBookmarkToggle(messageRef: MessageRef): Promise<boolean> {
    const existingBookmark = this.findExactBookmarkForMessage(messageRef);
    if (existingBookmark) {
      return this.removeBookmark(existingBookmark.id);
    }

    return this.addBookmark(messageRef);
  }

  async onBookmarkToggle(bookmark: Bookmark): Promise<boolean> {
    return this.removeBookmark(bookmark.id);
  }

  private onSourceUpdated(signal: SourceUpdatedSignal): void {
    if (this.disposed) {
      return;
    }

    if (this.activeSourceUpdateBackgroundSessionId !== signal.backgroundSessionId) {
      this.activeSourceUpdateBackgroundSessionId = signal.backgroundSessionId;
      this.lastAppliedSourceRevisionByConversationId.clear();
      this.pendingSourceRevisionByConversationId.clear();

    }

    if (this.state.assistantGenerating !== signal.assistantGenerating) {
      this.patchState({ assistantGenerating: signal.assistantGenerating });
    }

    void this.turnNavigator.consumePendingNavigation(signal.conversationId).catch((error: unknown) => {
      console.error("consume-pending-navigation-failed", error);
    });

    const lastAppliedSourceRevision = this.lastAppliedSourceRevisionByConversationId.get(
      signal.conversationId
    );
    if (
      lastAppliedSourceRevision !== undefined &&
      signal.sourceRevision <= lastAppliedSourceRevision
    ) {
      return;
    }

    const pendingSourceRevision = this.pendingSourceRevisionByConversationId.get(
      signal.conversationId
    );
    if (
      pendingSourceRevision !== undefined &&
      signal.sourceRevision <= pendingSourceRevision
    ) {
      return;
    }

    this.pendingSourceRevisionByConversationId.set(signal.conversationId, signal.sourceRevision);

    this.ensureSourceUpdateDrain();
  }

  private onBookmarksUpdated(signal: BookmarksUpdatedSignal): void {
    if (this.disposed) {
      return;
    }

    if (this.activeBookmarkUpdateBackgroundSessionId !== signal.backgroundSessionId) {
      this.activeBookmarkUpdateBackgroundSessionId = signal.backgroundSessionId;
      this.lastAppliedBookmarkRevision = null;
      this.pendingBookmarkRevision = null;

    }

    if (
      this.lastAppliedBookmarkRevision !== null &&
      signal.bookmarkRevision <= this.lastAppliedBookmarkRevision
    ) {
      return;
    }

    if (
      this.pendingBookmarkRevision !== null &&
      signal.bookmarkRevision <= this.pendingBookmarkRevision
    ) {
      return;
    }

    this.pendingBookmarkRevision = signal.bookmarkRevision;

    this.ensureBookmarkUpdateDrain();
  }

  private createTurnNavigationTarget(
    conversationId: string,
    conversationUrl: string,
    messageId: string,
    turnIndex: number
  ): TurnNavigationTarget {
    return {
      conversationId,
      conversationUrl,
      messageId,
      turnIndex
    };
  }

  private findExactBookmarkForMessage(messageRef: MessageRef): Bookmark | null {
    return (
      this.state.bookmarks.items.find(
        (bookmark) =>
          bookmark.conversationId === messageRef.conversationId &&
          bookmark.messageId === messageRef.id
      ) ?? null
    );
  }

  private runTurnNavigation(
    navigation: Promise<void>,
    errorScope: string
  ): void {
    void navigation.catch((error: unknown) => {
      console.error(errorScope, error);
    });
  }

  private wait(delayMs: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, delayMs);
    });
  }

  private async reconcileActiveConversation(): Promise<void> {
    if (this.disposed) {
      return;
    }

    const activeConversationId = this.readActiveConversationId();
    if (this.state.base.conversationId === activeConversationId) {
      return;
    }

    this.syncBaseStateToActiveConversation(activeConversationId);

  }

  private syncBaseStateToActiveConversation(activeConversationId: string | null): void {
    if (this.state.base.conversationId === activeConversationId) {
      return;
    }

    this.patchState({ selectedBaseMessageId: null });
    this.patchBaseState({
      conversationId: activeConversationId,
      messages: [],
      loading: activeConversationId !== null,
      error: null,
      initialLoadSettled: false
    });
  }

  private clearScheduledSourceUpdateDrain(): void {
    if (this.sourceUpdateRetryTimer === null) {
      return;
    }

    clearTimeout(this.sourceUpdateRetryTimer);
    this.sourceUpdateRetryTimer = null;
  }

  private clearScheduledBookmarkUpdateDrain(): void {
    if (this.bookmarkUpdateRetryTimer === null) {
      return;
    }

    clearTimeout(this.bookmarkUpdateRetryTimer);
    this.bookmarkUpdateRetryTimer = null;
  }

  private scheduleDelayedSourceUpdateDrain(): void {
    if (this.disposed || this.sourceUpdateRetryTimer !== null) {
      return;
    }

    this.sourceUpdateRetryTimer = setTimeout(() => {
      this.sourceUpdateRetryTimer = null;
      this.ensureSourceUpdateDrain();
    }, SOURCE_UPDATE_RETRY_DELAY_MS);
  }

  private scheduleDelayedBookmarkUpdateDrain(): void {
    if (this.disposed || this.bookmarkUpdateRetryTimer !== null) {
      return;
    }

    this.bookmarkUpdateRetryTimer = setTimeout(() => {
      this.bookmarkUpdateRetryTimer = null;
      this.ensureBookmarkUpdateDrain();
    }, BOOKMARK_UPDATE_RETRY_DELAY_MS);
  }

  private ensureSourceUpdateDrain(): void {
    if (
      this.disposed ||
      this.sourceUpdateDrainInFlight !== null ||
      this.pendingSourceRevisionByConversationId.size === 0
    ) {
      return;
    }

    this.clearScheduledSourceUpdateDrain();

    this.sourceUpdateDrainInFlight = this.drainSourceUpdates().finally(() => {
      this.sourceUpdateDrainInFlight = null;

      if (this.sourceUpdateRetryTimer === null) {
        this.ensureSourceUpdateDrain();
      }
    });
  }

  private ensureBookmarkUpdateDrain(): void {
    if (
      this.disposed ||
      this.bookmarkUpdateDrainInFlight !== null ||
      this.pendingBookmarkRevision === null
    ) {
      return;
    }

    this.clearScheduledBookmarkUpdateDrain();

    this.bookmarkUpdateDrainInFlight = this.drainBookmarkUpdates().finally(() => {
      this.bookmarkUpdateDrainInFlight = null;

      if (this.bookmarkUpdateRetryTimer === null) {
        this.ensureBookmarkUpdateDrain();
      }
    });
  }

  private consumePendingSourceUpdates(): Map<string, number> {
    const pending = new Map(this.pendingSourceRevisionByConversationId);
    this.pendingSourceRevisionByConversationId.clear();

    return pending;
  }

  private consumePendingBookmarkUpdate(): number | null {
    const pending = this.pendingBookmarkRevision;
    this.pendingBookmarkRevision = null;

    return pending;
  }

  private requeueSourceUpdate(conversationId: string, sourceRevision: number): void {
    const pendingSourceRevision = this.pendingSourceRevisionByConversationId.get(conversationId);
    if (pendingSourceRevision === undefined || sourceRevision > pendingSourceRevision) {
      this.pendingSourceRevisionByConversationId.set(conversationId, sourceRevision);

    }
  }

  private requeueSourceUpdates(updates: ReadonlyMap<string, number>): void {
    for (const [conversationId, sourceRevision] of updates.entries()) {
      this.requeueSourceUpdate(conversationId, sourceRevision);
    }
  }

  private markAppliedSourceUpdates(appliedUpdates: ReadonlyMap<string, number>): void {
    let changed = false;
    for (const [conversationId, sourceRevision] of appliedUpdates.entries()) {
      const previous = this.lastAppliedSourceRevisionByConversationId.get(conversationId);
      if (previous === undefined || sourceRevision > previous) {
        this.lastAppliedSourceRevisionByConversationId.set(conversationId, sourceRevision);
        changed = true;
      }
    }
    if (changed) {

    }
  }

  private requeueBookmarkUpdate(bookmarkRevision: number): void {
    if (this.pendingBookmarkRevision === null || bookmarkRevision > this.pendingBookmarkRevision) {
      this.pendingBookmarkRevision = bookmarkRevision;

    }
  }

  private markAppliedBookmarkUpdate(bookmarkRevision: number): void {
    if (this.lastAppliedBookmarkRevision === null || bookmarkRevision > this.lastAppliedBookmarkRevision) {
      this.lastAppliedBookmarkRevision = bookmarkRevision;

    }
  }

  private async loadBaseMessages(
    conversationId: string | null
  ): Promise<BaseReloadOutcome> {
    if (this.disposed) {
      return "skipped_due_to_navigation";
    }

    if (
      conversationId !== null &&
      this.reloadBaseInFlight &&
      this.reloadBaseConversationIdInFlight === conversationId
    ) {
      return this.reloadBaseInFlight;
    }

    const nextReload = this.reloadBaseMessagesInternal(conversationId);
    this.reloadBaseInFlight = nextReload;
    this.reloadBaseConversationIdInFlight = conversationId;
    try {
      return await nextReload;
    } finally {
      if (this.reloadBaseInFlight === nextReload) {
        this.reloadBaseInFlight = null;
        this.reloadBaseConversationIdInFlight = null;
      }
    }
  }

  private async loadBookmarks(): Promise<BookmarkListReloadOutcome> {
    if (this.disposed) {
      return "failed";
    }

    if (this.reloadBookmarksInFlight) {
      return this.reloadBookmarksInFlight;
    }

    const nextReload = this.reloadBookmarksInternal();
    this.reloadBookmarksInFlight = nextReload;
    try {
      return await nextReload;
    } finally {
      if (this.reloadBookmarksInFlight === nextReload) {
        this.reloadBookmarksInFlight = null;
      }
    }
  }

  private async drainSourceUpdates(): Promise<void> {
    const pendingUpdates = this.consumePendingSourceUpdates();
    if (pendingUpdates.size === 0 || this.disposed) {
      return;
    }

    const startedActiveConversationId = this.readActiveConversationId();
    this.syncBaseStateToActiveConversation(startedActiveConversationId);

    let baseReloadOutcome: BaseReloadOutcome = "skipped_due_to_navigation";

    if (
      startedActiveConversationId !== null &&
      pendingUpdates.has(startedActiveConversationId)
    ) {
      baseReloadOutcome = await this.loadBaseMessages(startedActiveConversationId);
      if (
        baseReloadOutcome === "applied" &&
        !this.state.base.initialLoadSettled &&
        this.state.base.conversationId === startedActiveConversationId
      ) {
        this.patchBaseState({ initialLoadSettled: true });
      }
    }

    const finalActiveConversationId = this.readActiveConversationId();
    this.syncBaseStateToActiveConversation(finalActiveConversationId);

    const appliedUpdates = new Map(pendingUpdates);

    if (
      finalActiveConversationId !== null &&
      pendingUpdates.has(finalActiveConversationId) &&
      !(
        startedActiveConversationId === finalActiveConversationId &&
        baseReloadOutcome === "applied"
      )
    ) {
      appliedUpdates.delete(finalActiveConversationId);
      this.requeueSourceUpdate(
        finalActiveConversationId,
        pendingUpdates.get(finalActiveConversationId)!
      );

      if (
        startedActiveConversationId === finalActiveConversationId &&
        (baseReloadOutcome === "failed" || baseReloadOutcome === "source_missing")
      ) {
        this.scheduleDelayedSourceUpdateDrain();
      }
    }

    this.markAppliedSourceUpdates(appliedUpdates);
  }

  private async drainBookmarkUpdates(): Promise<void> {
    const pendingBookmarkRevision = this.consumePendingBookmarkUpdate();
    if (pendingBookmarkRevision === null || this.disposed) {
      return;
    }

    const bookmarkListOutcome = await this.loadBookmarks();
    if (bookmarkListOutcome === "failed") {
      this.requeueBookmarkUpdate(pendingBookmarkRevision);
      this.scheduleDelayedBookmarkUpdateDrain();
      return;
    }

    if (bookmarkListOutcome === "stale_ignored") {
      this.requeueBookmarkUpdate(pendingBookmarkRevision);
      return;
    }

    this.markAppliedBookmarkUpdate(pendingBookmarkRevision);
  }

  private canApplyBaseReloadResult(conversationId: string): boolean {
    return (
      !this.disposed &&
      this.state.base.conversationId === conversationId &&
      this.readActiveConversationId() === conversationId
    );
  }

  private async reloadBaseMessagesInternal(
    conversationId: string | null
  ): Promise<BaseReloadOutcome> {
    if (!conversationId) {
      this.patchBaseState({
        conversationId: null,
        messages: [],
        loading: false,
        error: null
      });
      return "skipped_due_to_navigation";
    }

    if (this.state.base.conversationId !== conversationId) {
      this.patchBaseState({
        conversationId,
        messages: [],
        loading: true,
        error: null
      });
    } else {
      this.patchBaseState({ loading: true, error: null });
    }
    for (let attempt = 0; attempt < LIST_BASE_RETRY_DELAYS_MS.length; attempt += 1) {
      const retryDelayMs = LIST_BASE_RETRY_DELAYS_MS[attempt];
      if (retryDelayMs > 0) {
        await this.wait(retryDelayMs);
      }

      if (this.disposed) {
        return "skipped_due_to_navigation";
      }

      const result = await this.gateway.listBaseMessages(conversationId);
      if (!this.canApplyBaseReloadResult(conversationId)) {
        this.syncBaseStateToActiveConversation(this.readActiveConversationId());
        return "skipped_due_to_navigation";
      }

      if (result.ok) {
        this.patchBaseState({
          conversationId,
          messages: result.value,
          loading: false,
          error: null
        });
        return "applied";
      }

      if (result.error === "list-base-source-missing") {
        this.patchBaseState({
          loading: true,
          error: null
        });
        return "source_missing";
      }

      const hasNextAttempt = attempt < LIST_BASE_RETRY_DELAYS_MS.length - 1;
      if (!LIST_BASE_RETRYABLE_ERRORS.has(result.error) || !hasNextAttempt) {
        this.patchBaseState({ loading: false, error: result.error });
        return "failed";
      }
    }

    return "failed";
  }

  private async reloadBookmarksInternal(): Promise<BookmarkListReloadOutcome> {
    const mutationRevisionAtRequestStart = this.bookmarkMutationRevision;
    this.patchBookmarkState({ loading: true, error: null });
    const result = await this.gateway.listBookmarks();

    if (mutationRevisionAtRequestStart !== this.bookmarkMutationRevision) {
      this.patchBookmarkState({ loading: false, error: null });
      return "stale_ignored";
    }

    if (!result.ok) {
      this.patchBookmarkState({ loading: false, error: result.error });
      return "failed";
    }

    this.patchBookmarkState({
      items: result.value,
      loading: false,
      error: null
    });
    return "applied";
  }

  private applyBookmarkAdded(bookmark: Bookmark): void {
    this.bookmarkMutationRevision += 1;
    const nextBookmark = { ...bookmark };
    const remaining = this.state.bookmarks.items.filter((item) => item.id !== nextBookmark.id);
    this.patchBookmarkState({
      items: [nextBookmark, ...remaining],
      loading: false,
      error: null
    });
  }

  private applyBookmarkRemoved(bookmarkId: string): void {
    this.bookmarkMutationRevision += 1;

    if (this.state.selectedBookmarkId === bookmarkId) {
      this.patchState({ selectedBookmarkId: null });
    }

    this.patchBookmarkState({
      items: this.state.bookmarks.items.filter((item) => item.id !== bookmarkId),
      loading: false,
      error: null
    });
  }

  private patchBaseState(partial: Partial<SidebarBaseTabState>): void {
    this.patchState({
      base: {
        ...this.state.base,
        ...partial
      }
    });
  }

  private patchBookmarkState(partial: Partial<SidebarBookmarksTabState>): void {
    this.patchState({
      bookmarks: {
        ...this.state.bookmarks,
        ...partial
      }
    });
  }

  private writeSelectedBookmarkToSession(bookmarkId: string, messageId: string): void {
    try {
      sessionStorage.setItem(
        SELECTED_BOOKMARK_STORAGE_KEY,
        JSON.stringify({ bookmarkId, messageId })
      );
    } catch {}
  }

  private restoreSelectedBookmarkFromSession(): void {
    try {
      const raw = sessionStorage.getItem(SELECTED_BOOKMARK_STORAGE_KEY);
      sessionStorage.removeItem(SELECTED_BOOKMARK_STORAGE_KEY);
      if (typeof raw !== "string" || raw.length === 0) {
        return;
      }

      const parsed: unknown = JSON.parse(raw);
      if (
        parsed !== null &&
        typeof parsed === "object" &&
        typeof (parsed as Record<string, unknown>).bookmarkId === "string" &&
        typeof (parsed as Record<string, unknown>).messageId === "string"
      ) {
        const data = parsed as { bookmarkId: string; messageId: string };
        this.patchState({
          selectedBookmarkId: data.bookmarkId,
          selectedBaseMessageId: data.messageId
        });
      }
    } catch {}
  }

  private patchState(partial: Partial<SidebarViewState>): void {
    this.state = {
      ...this.state,
      ...partial,
      base: partial.base ?? this.state.base,
      bookmarks: partial.bookmarks ?? this.state.bookmarks
    };

    for (const listener of this.listeners) {
      listener(this.getState());
    }
  }
}
