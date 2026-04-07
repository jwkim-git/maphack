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
  host.style.background = "var(--mh-bg)";
  host.style.borderLeft = "1px solid var(--mh-border)";
  host.style.overflow = "hidden";
  host.style.transition = "transform 150ms ease";
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

const GLOBAL_STYLE_ID = "maphack-global-style";

const OPEN_BUTTON_SVG = `<svg viewBox="0 0 127.57 120" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;filter:drop-shadow(0 0 6px rgba(255,255,255,0.5)) drop-shadow(0 0 6px rgba(255,255,255,0.5));transition:transform 0.5s ease;"><path d="M85.72,119.37c-1.89-.32-3.79-.42-5.57-.84-1.05-.32-2-.32-2.95-.63-2-.53-3.57-1.89-4.94-2.73-1.16-.74-2.1-1.26-2.52-1.68-1.58-1.26-2.52-2.31-3.79-3.15-.74-.53-1.26-1.47-2-1.47-.42,0-.84.53-1.05.74l-2.31,2.1c-.42.42-1.47,1.26-1.79,1.68-.42.74-3.68,1.37-4,1.47-1.79.32-4.1.84-6.1.84-2.1,0-4.42-.53-5.99-1.05-.95-.32-2.31-1.05-2.73-1.26-1.37-.95-2.74-1.79-4-2.95-1.05-.84-2-1.79-2.63-2.73-1.47-2.42-2.63-1.37-3.79-.11-.74.74-1.37.74-2.31,1.26-1.05.63-2.42,1.58-4.1,2.52-.63.42-2.1,1.16-2.84,1.37-2,.53-3.58,1.26-5.57,1.26h-2.42c-.95,0-1.68-.53-2.31-.53-2.31,0-4.21-1.05-5.68-2.52-.95-.94-2.42-2.21-3.15-3.36-.84-1.26-1.16-2.73-1.16-4.21,0-.84.21-2.21.63-3.47.63-1.58,1.79-2.84,2.31-3.79.42-.74.63-1.47,1.16-2.21,1.05-1.37,2-2.84,3.26-4.1.63-.63.74-1.05,1.58-1.89.84-.84,1.58-1.47,2-2.1.11-.21.84-1.26,1.47-1.89.74-.74,1.68-1.47,1.79-1.58,1.26-1.26,1.89-2,2.84-3.15.32-.42.63-1.05,1.37-2.42.42-.63.63-.95.74-1.47.32-.95.84-2,1.26-2.95.31-.74,1.16-1.47,1.16-1.68,0-.84,1.05-1.47,1.16-2.31.53-3.37,1.89-4.84,1.89-6.52,0-1.26-1.79-1.89-2.63-2.84-1.68-2-2.74-4.73-4.21-6.21-.84-.84-3.26-3.05-4.1-4.73-.84-1.47-1.26-2.63-2.21-4.21-.31-.53-.74-1.58-1.26-2.63-.32-.53-.53-1.47-.84-2.21-.31-.84-.63-1.79-.84-2.84-.53-2.63-1.05-5.36-1.47-8.2-.1-1.05-.84-2.95-.84-5.05,0-.95.74-1.89.74-2.63s0-1.47.1-2.52c.1-.95.42-2,.63-2.84l.74-2.52c.63-1.37,1.16-2.84,2.42-4.21.74-.84,3.37-3.68,5.15-3.68l2.73-.1c3.37,0,4.84,2.52,6.63,4.84,1.47,1.89,2.21,4.42,2.74,5.15.53.95,1.05,1.89,1.37,3.05.53,2,.95,3.68,1.16,5.05.32,1.79.42,1.47.42,2.1,0,.84.32,1.79.53,3.05.1.84.21,1.68.42,2.42.32,1.58.53,3.05.95,4.31.21.84,1.26,1.89,1.26,3.26v.53c0,.84.84,1.05,1.47,1.05.84,0,1.79-.63,1.79-1.47,0-.42.53-1.79.84-2.84.42-1.37.63-2.84,1.05-4.31.21-.63.63-.95.63-1.26,0-.53,0-2.52.21-3.26.42-1.26.95-1.26,1.16-2,.32-.84.53-1.16.74-2l.94-2.73c.42-1.47.63-3.26,1.47-5.05.42-1.05,1.26-1.68,1.79-2.52.42-.63,1.37-2.73,2.21-3.26.42-.32.95-.53,1.37-.95l2.1-2c1.79-1.79,3.58-3.26,4.73-3.26.63,0,.95-.74,2.73-1.05,2-.42,3.37-.21,5.05-.53.74-.11,1.79-.74,2.95-.74,1.58,0,3.15.21,4.31.21,1.47,0,4.31,1.16,5.36,1.68,1.68.84,3.26,2,4.63,2.84.95.63,1.26,1.16,1.79,1.58.84.53,1.79,1.16,2.42,1.89,1.05,1.05,1.79,2.1,2.1,2.52l3.05,4.63c.42.74.84,1.79,1.16,2.73.21.74.95,2.84.95,3.68,0,1.47-.31,2.84-.31,3.26,0,.53.53,2.42.53,3.68,0,2.1-.63,4-.95,5.26-.1.63-.32,1.16-.32,1.68,0,2.21-1.05,4.73-1.05,5.47,0,.21-.42,1.05.1,1.05s.84-1.37,1.47-2.21c1.05-1.16,2.1-2.42,3.37-3.68,1.79-1.79,1.89-3.37,3.36-5.78.63-1.16,1.05-1.68,1.79-2.52,1.05-1.16,1.89-3.37,4-4.94,2.31-1.68,4.84-2.31,6.31-2.84.84-.32,1.89-.74,3.47-.74,2.52,0,5.15.84,7.26,2.42,1.89,1.37,3.37,3.37,4.52,5.26.74,1.26.84,2.63.84,3.89,0,2.21-.42,4.31-1.05,5.99-.95,2.73-2.21,5.26-3.47,6.52-.21.21-.63,1.58-.95,2.1-1.05,1.79-1.68,3.89-2.63,4.84-.63.63-.84,1.79-1.68,2.63l-5.47,5.57c-.63.63-1.37,1.26-2.1,1.79-2,1.26-3.58,1.47-4.21,2.1-.84.84-1.58,1.47-1.68,1.68-.63.84-3.05,1.79-3.47,2-1.37.95-2.52,1.47-3.36,2.31-.42.42-.63.84-.74,1.05-.95,1.68-1.37,2-1.37,2.21,0,1.26.42,2.52.42,3.68,0,.74,0,1.47.21,2.1.31.74,1.05.95,1.05,1.89,0,.42.21,1.89.42,2.21.63,1.16,1.89,2.42,2.84,4.63.21.63.42,1.47,1.05,2.52,1.26,2.42,3.47,7.05,3.79,8.41.21.74.53,1.68.74,3.05.53,2.63,1.79,5.36.53,8.2-1.58,3.68-2.42,4.52-3.89,6.21-1.05,1.26-2.1,1.79-3.36,2.42-.84.53-1.26.95-1.47.95-.1,0-3.15,1.68-4.21,1.68-.53,0-1.47.21-2.63.21-1.89,0-3.58-.42-5.15-.63ZM94.76,110.85c1.05-.63,1.58-1.16,2-2,.84-1.47,1.16-3.15,1.58-4.73.21-.74.42-1.37.42-2.21,0-1.37-.74-2.63-1.26-4l-.53-1.68c-.63-1.37-1.37-2.63-2.1-3.89-.42-.74-.74-1.58-.95-2.42-.21-.74-.63-1.37-.95-2.1-.32-.74-.42-1.47-.74-2.21-.42-.84-1.05-1.58-1.37-2.42-.63-1.47-1.05-2.73-1.58-4.21l-.74-2.52c-.31-1.37-1.37-2.84-1.37-4.52,0-1.37.74-2.63,1.26-4.1.32-.84.74-1.79,1.16-2.21l1.89-2c.74-.74,1.16-1.47,1.79-2.1,1.26-1.26,2.95-1.89,4.31-2.94.84-.53,1.68-.84,2.52-1.16.74-.21,1.26-.53,2-.95,1.37-.95,3.05-1.79,4.31-3.05.42-.42.95-1.16,1.58-1.79.63-.63,1.05-1.26,1.47-1.68.63-.63,1.58-.74,2.1-1.47.63-.74.95-1.58,1.47-2.42l2.1-3.89c.42-.84,1.16-1.68,1.58-2.63.31-.63.31-1.37.63-2.31.21-.74.95-1.37,1.37-2.31.42-1.05.94-2,.94-3.26,0-1.05-.21-2.1-.84-2.94-.53-.74-1.26-1.68-1.89-1.68-1.79,0-3.36-.21-4.94.63-1.68.95-2.63,2.52-3.68,3.79-.63.74-.74,2-1.16,2.63-.95,1.37-2.1,2.31-3.05,3.58-.63.74-.84,1.58-1.26,2.31-.95,1.58-1.89,2.94-2.84,4.31-.53.63-.84,1.37-1.26,1.79-.42.42-1.47.95-2.1,1.26-1.68,1.05-2.95,2-4.42,2.63-.74.32-1.68.21-2.21.21-1.79,0-3.15-1.37-4.63-2.42-.63-.53-.95-1.16-1.05-1.68-.21-.95-.1-1.58-.1-2.42v-3.37l-.1-2.94c0-.74.53-1.47.74-2.42.32-1.47.84-3.26.84-5.05l-.1-2.52c0-.84.31-1.79.31-2.84,0-1.47-.21-2.94-.53-4.31-.21-.84-.53-1.37-.95-2.1-.74-1.37-1.16-2.63-2.31-3.79-1.05-1.16-2.21-2.1-3.37-3.26-.63-.63-1.16-1.26-2.1-1.89-.42-.32-1.05-.53-1.47-.63-1.68-.53-3.16-1.05-4.52-1.05-1.58,0-3.05,1.37-4.42,1.37-1.05,0-2-.42-2.94-.42-1.05,0-2.1.21-2.95.21-1.68,0-2.42,2-3.37,2.84-.94.74-1.79.95-2.31,1.47-.84.84-1.37,2-1.79,2.73l-2.31,4.31c-.42.84-.53,1.58-.53,2.1,0,1.05-.74,1.79-.95,2.31-.63,1.68-1.26,3.15-1.58,4.63-.42,1.79-.63,3.26-.95,5.05-.21.84-.53,1.79-.84,2.52-.95,2.21-1.16,4.63-2.63,6.1l-3.79,4.1c-.53.63-1.79.32-2.52.32h-1.16c-.63,0-1.26,0-1.68-.21-1.47-.63-2.84-1.89-4-2.94-.63-.53-1.16-1.26-1.58-2-.84-1.37-1.16-2.73-1.68-4.21-.21-.53-.32-1.16-.53-1.79-.32-.63-.84-1.47-1.05-2.21-.42-1.68-.32-3.15-.63-4.84-.11-.84-.42-1.79-.63-2.63-.21-.74-.53-1.58-.63-2.42-.21-.95-.31-1.89-.31-2.63,0-1.79-1.05-3.47-1.79-5.15-.42-1.16-.74-3.37-2.1-3.37-1.47,0-2.42,1.58-3.05,2.73-.74,1.37-.74,2.95-1.26,4.52-.32.84-.53,1.58-.53,2.42,0,1.58.84,3.05.84,4.31,0,.95,0,1.79.11,2.42.1,1.16.42,2.1.63,2.95.21.84.1,1.58.31,2.21.42,1.79,1.16,3.68,1.79,5.15.31.84.42,1.68.74,2.42.32.74.84,1.47,1.26,2.1.53.74.74,1.26,1.05,2.1.42.84.84,1.58,1.47,2.21,1.26,1.26,2.21,2.63,3.36,3.68.63.63.95,1.47,1.47,2.1.95,1.16,1.89,2.21,2.95,3.15.84.63,1.26,1.47,1.47,2.1.53,2,.42,3.68.42,5.36,0,.84-.42,1.47-.63,2.31-.21.95-.53,1.89-.84,2.63l-2,4.63c-.42.84-1.26,1.58-1.58,2.21-.53,1.05-.74,1.79-1.16,2.42-.84,1.37-1.47,2.73-2.21,4.1-.63,1.16-1.26,2.42-2,3.37-.95,1.26-2.21,1.58-3.05,2.31-.74.53-.95,1.37-1.58,2-.74.74-1.26,1.68-1.89,2.21-.95.74-1.05,1.79-1.47,2.42-1.05,1.58-2.63,2.94-3.47,3.79-.42.42-.95,1.37-1.05,1.79-.32,1.37-.42,2.84-.42,4.1,0,1.47,2.63,1.68,4.1,1.68.74,0,1.79-.11,2.52-.42,1.16-.53,2.31-1.58,3.47-2.31.74-.42,1.58-.63,2.42-1.05,1.26-.63,2.63-1.26,3.89-2,.53-.32,1.05-.42,1.68-.63,1.68-.74,2.95-2,4.52-2s3.26.84,4.73,1.37c.74.21,1.37.95,2,1.47.74.74,1.37,2.1,2.1,2.95.84.95,1.79,1.89,2.84,2.52.63.42,1.37.42,2.1.63,1.47.42,2.63,1.37,4.31,1.37.42,0,1.16-.32,1.79-.53.74-.21,1.58,0,2.21-.53,1.16-.84,2.1-2,2.63-2.52.84-.84,1.79-2.21,3.15-2.84,1.58-.74,3.58-.74,5.57-.74,1.58,0,2.84,1.68,4.42,2.63.63.32,1.58.84,1.89,1.16.94.95,2.31,2.21,3.68,3.15,1.26.84,2.84,1.37,4.21,2,.95.42,1.47.74,2.21.95.84.32,1.47.95,2.42.95l1.89-.1c1.47,0,3.05.31,4.73.31,1.58,0,3.05-.84,4.52-1.58ZM49.64,92.13c-1.16-.21-2-.21-3.05-.84-1.68-1.05-3.15-2.21-4.21-3.47-.63-.74-1.47-2-1.47-3.26,0-1.68.21-3.68.53-5.57.21-.95.63-1.68.63-2.42v-.63c0-.63.1-1.47.42-2.42.42-1.26,1.05-1.79,1.47-2.63.63-1.16,1.26-3.05,2.63-4.42,1.68-1.68,1.16-3.26,1.16-4.42s-2.11-2.21-2.11-4.31c0-.84.11-1.58.21-2.52.21-1.37-.21-3.15.95-4.31.42-.42.74-.95,1.26-1.47.42-.42,1.16-.63,1.89-.63,1.37,0,2.94.84,2.94,2.31l-.1,3.05c0,1.68-.21,3.26-.21,4.63,0,.84,1.26,1.47,2.42,2.1,1.26.74,2.73,1.05,4.21,1.37.84.21,1.47.21,2.52.21.21,0,.53-.63,1.47-1.05.84-.42,1.26-.74,2-1.37,1.16-.95,2.63-2.1,3.58-3.05.21-.21.32-1.37,1.26-2.31.42-.42,1.58-1.05,2.31-1.05,1.68,0,3.47.84,3.47,2.21,0,2.1-1.05,3.79-1.58,4.94-.53,1.05-1.37,2-1.79,2.42l-3.15,3.26c-.21.21-.31.63-.53,1.47-.31,1.58-.42,2.95-.95,4.31-.31.84-.63,1.58-.74,2.21-.1.95-.1,1.68-.1,2.52,0,1.26-.63,1.68-.95,2.42-1.26,2.31-2.21,4.52-3.15,6.63-.32.74-.53,1.58-.95,2-.42.42-1.26,1.37-2.31,1.89-1.47.74-2.84,1.16-4.31,1.68-1.16.42-2.31.63-3.15.63s-1.68.1-2.52-.1ZM53.53,85.71c1.37,0,2.1-1.58,2.84-2.31.84-.84,2-2.52,2.84-4,.42-.74.74-1.58,1.05-2.42.31-1.05.63-1.58.63-2.1,0-1.05.42-1.79.42-2.84,0-.84-.21-3.26-1.26-3.26-.95,0-1.26,1.47-2.1,2.63-.31.42-.63,1.05-.95,1.68-.42.84-.53,1.68-.84,2.42-.42.95-1.58,2.1-1.16,3.26.42,1.26-.95,2.42-1.89,2.42s-1.47-.1-1.89-.74c-.31-.53-.84-1.58-.84-2.31,0-1.89,1.26-3.05,1.68-4.1.53-1.58,1.16-3.05,1.37-4.63.21-1.47,0-1.16-.42-.63-.84.95-1.47,2-2.1,2.95-.84,1.37-1.47,2.73-2.1,4.21-.21.63-.21,1.26-.21,1.79,0,.74-.84,4-.84,5.78,0,1.37,1.26,2.21,2.21,2.21h3.58ZM49.96,41.96v-4.31c0-1.68,1.05-4.31,2.84-4.31l2-.11c1.89,0,4.31.95,4.31,2.52,0,1.26.21,2.42.21,3.47s-1.05,2.1-1.68,2.73c-1.26,1.26-2.95,2.31-4.52,2.31-1.26,0-3.15-.84-3.15-2.31ZM64.26,47.64c-.94-.95-2-2.42-2-3.79v-3.58c0-.95.74-1.58,1.05-2.52.31-.74.53-1.47,1.05-2.21.42-.74.63-1.37,1.37-2,1.26-1.05,2.42-2.42,4.21-2.42.84,0,1.68.21,2.21.74,1.37,1.37,3.15,2.63,3.15,4.42l-.1,4.42c0,1.47-.42,2.73-.42,3.89,0,1.05-1.05,1.79-1.47,2.21-.42.42-1.05.84-1.68,1.16-1.68.63-3.37.95-4.84.95-1.05,0-1.79-.53-2.52-1.26Z"/></svg>`;

function ensureGlobalStyle(documentRef: Document): void {
  if (documentRef.getElementById(GLOBAL_STYLE_ID)) {
    return;
  }

  const style = documentRef.createElement("style");
  style.id = GLOBAL_STYLE_ID;
  style.textContent = [
    "@keyframes sticker-float{",
    "0%,100%{transform:translate(-50%,-50%) translate3d(0,10%,0)}",
    "50%{transform:translate(-50%,-50%) translate3d(0,-10%,0)}}",
    `#${SIDEBAR_OPEN_BUTTON_ID}{transition:opacity 1000ms ease}`,
    `#${SIDEBAR_OPEN_BUTTON_ID}.mh-hidden{opacity:0;pointer-events:none;transition:none}`,
    `#${SIDEBAR_OPEN_BUTTON_ID}:hover{scale:1.05;animation:none!important}`,
    `#${SIDEBAR_OPEN_BUTTON_ID}:hover svg{transform:scale(1.05) rotate(5deg)}`
  ].join("");
  documentRef.head.appendChild(style);
}

function ensureOpenButton(documentRef: Document, openButtonSizePx: number): HTMLButtonElement | null {
  if (!documentRef.body) {
    return null;
  }

  documentRef.getElementById(SIDEBAR_OPEN_BUTTON_ID)?.remove();
  ensureGlobalStyle(documentRef);

  const button = documentRef.createElement("button");
  button.id = SIDEBAR_OPEN_BUTTON_ID;
  button.type = "button";
  button.innerHTML = OPEN_BUTTON_SVG;
  button.title = "Open MapHack";
  button.setAttribute("aria-label", "Open MapHack");
  button.style.position = "fixed";
  button.style.width = `${openButtonSizePx}px`;
  button.style.height = `${openButtonSizePx}px`;
  button.style.background = "transparent";
  button.style.border = "none";
  button.style.cursor = "pointer";
  button.style.zIndex = "2147483647";
  button.style.display = "flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.style.animation = "sticker-float 2s ease-in-out infinite";
  documentRef.body.appendChild(button);

  return button;
}

function renderOpen(host: HTMLElement, openButton: HTMLButtonElement): void {
  host.style.transform = "translateX(0)";
  host.style.pointerEvents = "auto";
  openButton.classList.add("mh-hidden");
}

function renderClosed(
  host: HTMLElement,
  openButton: HTMLButtonElement,
  placement: SidebarOpenButtonPlacement,
  sidebarWidthPx: number
): void {
  host.style.transform = `translateX(${sidebarWidthPx}px)`;
  host.style.pointerEvents = "none";
  openButton.classList.remove("mh-hidden");
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
