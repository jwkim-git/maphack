import type {
  TurnNavigationTarget,
  TurnNavigator
} from "../../application/ports/TurnNavigator";
import type {
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
}

type StateListener = (state: SidebarViewState) => void;
type ReadActiveConversationId = () => string | null;
type SubscribeActiveConversationContextInvalidation =
  (onInvalidate: () => void) => () => void;
type BaseReloadOutcome = "applied" | "skipped_due_to_navigation" | "source_missing" | "failed";
type BookmarkListReloadOutcome = "applied" | "failed";

const LIST_BASE_RETRY_DELAYS_MS = [0, 120, 360] as const;
const LIST_BASE_RETRYABLE_ERRORS = new Set([
  "list-base-timeout",
  "list-base-no-response"
]);
const STARTUP_BASE_RECOVERY_RETRY_DELAYS_MS = [300, 500, 800, 1_200, 2_000, 3_000] as const;
const SOURCE_UPDATE_RETRY_DELAY_MS = 500;

export class SidebarViewModel {
  private state: SidebarViewState = {
    activeTab: "base",
    base: {
      conversationId: null,
      messages: [],
      loading: false,
      error: null
    },
    bookmarks: {
      items: [],
      loading: false,
      error: null
    }
  };

  private readonly listeners = new Set<StateListener>();
  private readonly lastAppliedSeqByConversationId = new Map<string, number>();
  private readonly pendingSeqByConversationId = new Map<string, number>();
  private activeSourceUpdateSessionId: string | null = null;
  private unsubscribeSourceUpdated: (() => void) | null = null;
  private unsubscribeActiveConversationContextInvalidation: (() => void) | null = null;
  private reloadBaseInFlight: Promise<BaseReloadOutcome> | null = null;
  private reloadBaseConversationIdInFlight: string | null = null;
  private reloadBookmarksInFlight: Promise<BookmarkListReloadOutcome> | null = null;
  private bookmarkMutationRevision = 0;
  private needsBookmarkReloadAfterMutation = false;
  private sourceUpdateDrainInFlight: Promise<void> | null = null;
  private sourceUpdateRetryTimer: ReturnType<typeof setTimeout> | null = null;
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
        error: this.state.base.error
      },
      bookmarks: {
        items: this.state.bookmarks.items.map((bookmark) => ({ ...bookmark })),
        loading: this.state.bookmarks.loading,
        error: this.state.bookmarks.error
      }
    };
  }

  async start(): Promise<void> {
    if (this.disposed) {
      return;
    }

    if (this.unsubscribeSourceUpdated === null) {
      this.unsubscribeSourceUpdated = this.gateway.subscribeSourceUpdated(
        (signal) => {
          this.onSourceUpdated(signal);
        }
      );
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
  }

  setActiveTab(tab: SidebarTab): void {
    if (this.disposed || this.state.activeTab === tab) {
      return;
    }

    this.patchState({ activeTab: tab });
  }

  dispose(): void {
    this.disposed = true;
    this.pendingSeqByConversationId.clear();
    this.lastAppliedSeqByConversationId.clear();
    this.activeSourceUpdateSessionId = null;
    this.clearScheduledSourceUpdateDrain();
    this.unsubscribeSourceUpdated?.();
    this.unsubscribeSourceUpdated = null;
    this.unsubscribeActiveConversationContextInvalidation?.();
    this.unsubscribeActiveConversationContextInvalidation = null;
    this.listeners.clear();
  }

  async reloadBaseMessages(
    conversationId: string | null = this.state.base.conversationId
  ): Promise<void> {
    await this.loadBaseMessages(conversationId);
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
    this.reconcileBookmarksFromStore();
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
    this.reconcileBookmarksFromStore();
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

    if (this.activeSourceUpdateSessionId !== signal.sessionId) {
      this.activeSourceUpdateSessionId = signal.sessionId;
      this.lastAppliedSeqByConversationId.clear();
      this.pendingSeqByConversationId.clear();
    }

    void this.turnNavigator.consumePendingNavigation(signal.conversationId).catch((error: unknown) => {
      console.error("consume-pending-navigation-failed", error);
    });

    const lastAppliedSeq = this.lastAppliedSeqByConversationId.get(signal.conversationId);
    if (lastAppliedSeq !== undefined && signal.seq <= lastAppliedSeq) {
      return;
    }

    const pendingSeq = this.pendingSeqByConversationId.get(signal.conversationId);
    if (pendingSeq !== undefined && signal.seq <= pendingSeq) {
      return;
    }

    this.pendingSeqByConversationId.set(signal.conversationId, signal.seq);
    this.ensureSourceUpdateDrain();
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

    if (activeConversationId === null) {
      return;
    }

    await this.loadBaseMessages(activeConversationId);
    void this.recoverInitialBaseIfEmpty(activeConversationId);
  }

  private syncBaseStateToActiveConversation(activeConversationId: string | null): void {
    if (this.state.base.conversationId === activeConversationId) {
      return;
    }

    this.patchBaseState({
      conversationId: activeConversationId,
      messages: [],
      loading: activeConversationId !== null,
      error: null
    });
  }

  private clearScheduledSourceUpdateDrain(): void {
    if (this.sourceUpdateRetryTimer === null) {
      return;
    }

    clearTimeout(this.sourceUpdateRetryTimer);
    this.sourceUpdateRetryTimer = null;
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

  private ensureSourceUpdateDrain(): void {
    if (
      this.disposed ||
      this.sourceUpdateDrainInFlight !== null ||
      this.pendingSeqByConversationId.size === 0
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

  private consumePendingSourceUpdates(): Map<string, number> {
    const pending = new Map(this.pendingSeqByConversationId);
    this.pendingSeqByConversationId.clear();
    return pending;
  }

  private requeueSourceUpdate(conversationId: string, seq: number): void {
    const pendingSeq = this.pendingSeqByConversationId.get(conversationId);
    if (pendingSeq === undefined || seq > pendingSeq) {
      this.pendingSeqByConversationId.set(conversationId, seq);
    }
  }

  private requeueSourceUpdates(updates: ReadonlyMap<string, number>): void {
    for (const [conversationId, seq] of updates.entries()) {
      this.requeueSourceUpdate(conversationId, seq);
    }
  }

  private markAppliedSourceUpdates(appliedUpdates: ReadonlyMap<string, number>): void {
    for (const [conversationId, seq] of appliedUpdates.entries()) {
      const previous = this.lastAppliedSeqByConversationId.get(conversationId);
      if (previous === undefined || seq > previous) {
        this.lastAppliedSeqByConversationId.set(conversationId, seq);
      }
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

        if (this.needsBookmarkReloadAfterMutation && !this.disposed) {
          this.needsBookmarkReloadAfterMutation = false;
          void this.loadBookmarks();
        }
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
    }

    const bookmarkListOutcome = await this.loadBookmarks();
    const finalActiveConversationId = this.readActiveConversationId();
    this.syncBaseStateToActiveConversation(finalActiveConversationId);

    if (bookmarkListOutcome === "failed") {
      this.requeueSourceUpdates(pendingUpdates);
      this.scheduleDelayedSourceUpdateDrain();
      return;
    }

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

  private async recoverInitialBaseIfEmpty(conversationId: string): Promise<void> {
    for (const delayMs of STARTUP_BASE_RECOVERY_RETRY_DELAYS_MS) {
      if (this.disposed || this.readActiveConversationId() !== conversationId) {
        return;
      }

      if (this.state.base.messages.length > 0 || this.state.base.error !== null) {
        return;
      }

      await this.wait(delayMs);

      if (this.disposed || this.readActiveConversationId() !== conversationId) {
        return;
      }

      const outcome = await this.loadBaseMessages(conversationId);
      if (
        outcome === "applied" &&
        this.state.base.conversationId === conversationId &&
        this.state.base.messages.length > 0
      ) {
        return;
      }
    }
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
      return "applied";
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
    this.patchBookmarkState({
      items: this.state.bookmarks.items.filter((item) => item.id !== bookmarkId),
      loading: false,
      error: null
    });
  }

  private reconcileBookmarksFromStore(): void {
    if (this.disposed) {
      return;
    }

    if (this.reloadBookmarksInFlight) {
      this.needsBookmarkReloadAfterMutation = true;
      return;
    }

    this.needsBookmarkReloadAfterMutation = false;
    void this.loadBookmarks();
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
