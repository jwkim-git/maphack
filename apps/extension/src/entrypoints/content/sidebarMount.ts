import { createSidebarRuntimeGateway } from "../../infra/messaging/sidebarRuntimeGateway";
import { readCurrentChatgptConversation } from "../../infra/providers/chatgpt/currentConversation";
import { createChatgptTurnNavigator } from "../../infra/providers/chatgpt/scrollNavigator";
import {
  bootstrapSidebarApp,
  type SidebarAppHandle
} from "../../presentation/sidebar/App";
import { SidebarViewModel } from "../../presentation/sidebar/ViewModel";
import { createChatgptSidebarLayout } from "../../infra/providers/chatgpt/sidebarLayout";
import {
  createSidebarShell,
  type SidebarShellHandle
} from "./sidebarShell";

const SIDEBAR_WIDTH_PX = 260;
const SIDEBAR_OPEN_BUTTON_SIZE_PX = 48;
const VIEWPORT_RIGHT_TOLERANCE_PX = 2;

let mountedHandle: SidebarAppHandle | null = null;
let mountedShell: SidebarShellHandle | null = null;
let mountPromise: Promise<void> | null = null;

function subscribeActiveConversationContextInvalidation(
  documentRef: Document,
  windowRef: Window,
  onInvalidate: () => void
): () => void {
  let active = true;
  let queued = false;

  const requestInvalidate = (): void => {
    if (!active || queued) {
      return;
    }

    queued = true;
    windowRef.setTimeout(() => {
      queued = false;
      if (!active) {
        return;
      }

      onInvalidate();
    }, 0);
  };

  const observerTarget = documentRef.body ?? documentRef.documentElement;
  const observer = observerTarget
    ? new MutationObserver(() => {
        requestInvalidate();
      })
    : null;

  observer?.observe(observerTarget, {
    subtree: true,
    childList: true,
    characterData: true
  });

  const onFocus = (): void => {
    requestInvalidate();
  };
  const onPopState = (): void => {
    requestInvalidate();
  };
  const onVisibilityChange = (): void => {
    if (documentRef.visibilityState === "visible") {
      requestInvalidate();
    }
  };

  windowRef.addEventListener("focus", onFocus);
  windowRef.addEventListener("popstate", onPopState);
  documentRef.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    active = false;
    observer?.disconnect();
    windowRef.removeEventListener("focus", onFocus);
    windowRef.removeEventListener("popstate", onPopState);
    documentRef.removeEventListener("visibilitychange", onVisibilityChange);
  };
}

export async function mountSidebarInIsolated(documentRef: Document): Promise<void> {
  if (mountedHandle && mountedShell) {
    return;
  }

  if (mountPromise) {
    return mountPromise;
  }

  mountPromise = (async () => {
    const windowRef = documentRef.defaultView!;

    const layoutController = createChatgptSidebarLayout(documentRef, windowRef, {
      sidebarWidthPx: SIDEBAR_WIDTH_PX,
      openButtonSizePx: SIDEBAR_OPEN_BUTTON_SIZE_PX,
      viewportRightTolerancePx: VIEWPORT_RIGHT_TOLERANCE_PX
    });
    if (!layoutController) {
      console.error("sidebar-layout-target-unresolved");
      return;
    }

    const shell = createSidebarShell(documentRef, layoutController, {
      sidebarWidthPx: SIDEBAR_WIDTH_PX,
      openButtonSizePx: SIDEBAR_OPEN_BUTTON_SIZE_PX
    });
    if (!shell) {
      layoutController.dispose();
      return;
    }
    try {
      const runtimeGateway = createSidebarRuntimeGateway();
      const turnNavigator = createChatgptTurnNavigator({
        documentRef,
        windowRef
      });
      const readActiveConversationId = () => readCurrentChatgptConversation()?.id ?? null;

      const isCrossConversation =
        sessionStorage.getItem("maphack:selected-bookmark-id") !== null;

      const viewModel = new SidebarViewModel(
        runtimeGateway,
        turnNavigator,
        readActiveConversationId,
        (onInvalidate) =>
          subscribeActiveConversationContextInvalidation(documentRef, windowRef, onInvalidate)
      );
      const appHandle = await bootstrapSidebarApp(shell.rootElement, viewModel, {
        onRequestClose: () => {
          shell.close();
        }
      });

      if (isCrossConversation) {
        const opened = shell.open();
        if (!opened) {
          appHandle.dispose();
          shell.dispose();
          console.error("sidebar-layout-target-unresolved");
          return;
        }
      }

      mountedShell = shell;
      mountedHandle = {
        viewModel: appHandle.viewModel,
        dispose(): void {
          appHandle.dispose();
          shell.dispose();
          mountedHandle = null;
          mountedShell = null;
        }
      };
    } catch (error: unknown) {
      shell.dispose();
      console.error("sidebar-mount-failed", error);
      throw error;
    }
  })().finally(() => {
    mountPromise = null;
  });

  return mountPromise;
}
