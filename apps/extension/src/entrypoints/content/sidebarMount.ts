import { createSidebarRuntimeGateway } from "../../infra/messaging/sidebarRuntimeGateway";
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

const SIDEBAR_WIDTH_PX = 300;
const SIDEBAR_OPEN_BUTTON_SIZE_PX = 56;
const VIEWPORT_RIGHT_TOLERANCE_PX = 2;

let mountedHandle: SidebarAppHandle | null = null;
let mountedShell: SidebarShellHandle | null = null;
let mountPromise: Promise<void> | null = null;

export async function mountSidebarInIsolated(documentRef: Document): Promise<void> {
  if (mountedHandle && mountedShell) {
    if (!mountedShell.open()) {
      console.error("sidebar-layout-target-unresolved");
    }
    return;
  }

  if (mountPromise) {
    return mountPromise;
  }

  mountPromise = (async () => {
    const layoutController = createChatgptSidebarLayout(documentRef, {
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
        windowRef: documentRef.defaultView ?? window
      });
      const viewModel = new SidebarViewModel(runtimeGateway, turnNavigator);
      const appHandle = await bootstrapSidebarApp(shell.rootElement, viewModel, {
        onRequestClose: () => {
          shell.close();
        }
      });

      const opened = shell.open();
      if (!opened) {
        appHandle.dispose();
        shell.dispose();
        console.error("sidebar-layout-target-unresolved");
        return;
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
