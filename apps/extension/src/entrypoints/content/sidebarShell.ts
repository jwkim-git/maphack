const SIDEBAR_HOST_ID = "maphack-sidebar-host";
const SIDEBAR_ROOT_ID = "maphack-sidebar-root";
const SIDEBAR_OPEN_BUTTON_ID = "maphack-sidebar-open-button";

interface SidebarShellOptions {
  sidebarWidthPx: number;
  openButtonSizePx: number;
}

export interface SidebarOpenButtonPlacement {
  centerXPx: number;
  centerYPx: number;
}

export interface SidebarPageLayoutController {
  open(): boolean;
  close(): void;
  dispose(): void;
  getClosedOpenButtonPlacement(): SidebarOpenButtonPlacement;
  subscribeClosedOpenButtonPlacement(
    onPlacementChange: (placement: SidebarOpenButtonPlacement) => void
  ): () => void;
}

export interface SidebarShellHandle {
  rootElement: HTMLElement;
  open(): boolean;
  close(): void;
  dispose(): void;
}

function ensureHost(documentRef: Document, sidebarWidthPx: number): HTMLElement | null {
  if (!documentRef.body) {
    return null;
  }

  documentRef.getElementById(SIDEBAR_HOST_ID)?.remove();

  const host = documentRef.createElement("div");
  host.id = SIDEBAR_HOST_ID;
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.right = "0";
  host.style.width = `${sidebarWidthPx}px`;
  host.style.height = "100vh";
  host.style.zIndex = "2147483647";
  host.style.background = "#0d1117";
  host.style.borderLeft = "1px solid #30363d";
  host.style.overflow = "hidden";
  host.style.transition = "transform 160ms ease";
  documentRef.body.appendChild(host);

  return host;
}

function ensureRoot(documentRef: Document, host: HTMLElement, sidebarWidthPx: number): HTMLElement {
  const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  let root = shadowRoot.getElementById(SIDEBAR_ROOT_ID) as HTMLElement | null;

  if (!root) {
    const link = documentRef.createElement("link");
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("public/sidebar.css");
    shadowRoot.appendChild(link);

    root = documentRef.createElement("div");
    root.id = SIDEBAR_ROOT_ID;
    root.style.width = `${sidebarWidthPx}px`;
    root.style.height = "100vh";
    shadowRoot.appendChild(root);
  }

  return root;
}

function ensureOpenButton(documentRef: Document, openButtonSizePx: number): HTMLButtonElement | null {
  if (!documentRef.body) {
    return null;
  }

  documentRef.getElementById(SIDEBAR_OPEN_BUTTON_ID)?.remove();

  const button = documentRef.createElement("button");
  button.id = SIDEBAR_OPEN_BUTTON_ID;
  button.type = "button";
  button.textContent = "MH";
  button.title = "Open MapHack";
  button.setAttribute("aria-label", "Open MapHack");
  button.style.position = "fixed";
  button.style.width = `${openButtonSizePx}px`;
  button.style.height = `${openButtonSizePx}px`;
  button.style.borderRadius = "9999px";
  button.style.border = "1px solid #d0d5dd";
  button.style.background = "#ffffff";
  button.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
  button.style.cursor = "pointer";
  button.style.zIndex = "2147483647";
  button.style.display = "none";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  documentRef.body.appendChild(button);

  return button;
}

function renderOpen(host: HTMLElement, openButton: HTMLButtonElement): void {
  host.style.transform = "translateX(0)";
  host.style.pointerEvents = "auto";
  openButton.style.display = "none";
  openButton.style.pointerEvents = "none";
}

function renderClosed(
  host: HTMLElement,
  openButton: HTMLButtonElement,
  placement: SidebarOpenButtonPlacement,
  sidebarWidthPx: number
): void {
  host.style.transform = `translateX(${sidebarWidthPx}px)`;
  host.style.pointerEvents = "none";
  openButton.style.display = "flex";
  openButton.style.pointerEvents = "auto";
  openButton.style.left = `${placement.centerXPx}px`;
  openButton.style.top = `${placement.centerYPx}px`;
  openButton.style.right = "auto";
  openButton.style.bottom = "auto";
  openButton.style.transform = "translate(-50%, -50%)";
}

export function createSidebarShell(
  documentRef: Document,
  layoutController: SidebarPageLayoutController,
  options: SidebarShellOptions
): SidebarShellHandle | null {
  if (!documentRef.body) {
    return null;
  }

  const host = ensureHost(documentRef, options.sidebarWidthPx);
  if (!host) {
    return null;
  }

  const rootElement = ensureRoot(documentRef, host, options.sidebarWidthPx);
  const openButton = ensureOpenButton(documentRef, options.openButtonSizePx);
  if (!openButton) {
    host.remove();
    return null;
  }

  let shellOpen = false;

  const unsubscribeClosedPlacement = layoutController.subscribeClosedOpenButtonPlacement(
    (placement) => {
      if (shellOpen) {
        return;
      }

      renderClosed(host, openButton, placement, options.sidebarWidthPx);
    }
  );

  renderClosed(
    host,
    openButton,
    layoutController.getClosedOpenButtonPlacement(),
    options.sidebarWidthPx
  );

  const openShell = (): boolean => {
    const layoutApplied = layoutController.open();
    if (!layoutApplied) {
      shellOpen = false;
      renderClosed(
        host,
        openButton,
        layoutController.getClosedOpenButtonPlacement(),
        options.sidebarWidthPx
      );
      return false;
    }

    shellOpen = true;
    renderOpen(host, openButton);
    return true;
  };

  const closeShell = (): void => {
    shellOpen = false;
    layoutController.close();
    renderClosed(
      host,
      openButton,
      layoutController.getClosedOpenButtonPlacement(),
      options.sidebarWidthPx
    );
  };

  openButton.onclick = () => {
    void openShell();
  };

  return {
    rootElement,
    open(): boolean {
      return openShell();
    },
    close(): void {
      closeShell();
    },
    dispose(): void {
      unsubscribeClosedPlacement();
      layoutController.dispose();
      openButton.remove();
      host.remove();
    }
  };
}
