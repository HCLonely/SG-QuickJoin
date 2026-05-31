// ── Types ────────────────────────────────────────────────────────────────────

interface GiveawayInfo {
  outWrap: HTMLElement;
  headingName: HTMLAnchorElement;
  code: string;
  requiredPoints: number;
  button: HTMLButtonElement;
}

// ── Styles ───────────────────────────────────────────────────────────────────

GM_addStyle(`
  .sg-quickjoin-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    align-self: stretch;
    flex-shrink: 0;
    white-space: nowrap;
    box-sizing: border-box;
    min-width: 180px;
    padding: 0 16px;
    border-radius: 0 4px 4px 0;
    font-size: 13px;
    font-weight: 500;
    transition: background 0.2s;
  }

  .sg-quickjoin-btn[data-state="idle"] {
    background: #7ba4f7;
    color: #fff;
    cursor: pointer;
    border: none;
  }

  .sg-quickjoin-btn[data-state="loading"] {
    background: #a0a7b3;
    color: #fff;
    cursor: wait;
    border: none;
  }

  .sg-quickjoin-btn[data-state="joined"] {
    background: #e8a860;
    color: #fff;
    cursor: pointer;
    border: none;
  }

  .sg-quickjoin-btn[data-state="error"] {
    background: #e07b7b;
    color: #fff;
    cursor: pointer;
    border: none;
  }

  .sg-quickjoin-btn[data-state="insufficient"] {
    background: #c5cad2;
    color: #fff;
    cursor: not-allowed;
    border: none;
  }

  .sg-quickjoin-btn[data-state="entered"] {
    background: #e8a860;
    color: #fff;
    cursor: pointer;
    border: none;
  }

  .sg-quickjoin-btn[data-state="leaving"] {
    background: #a0a7b3;
    color: #fff;
    cursor: wait;
    border: none;
  }

  .sg-quickjoin-header-fixed {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    z-index: 1000;
  }
`);

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Extract the giveaway code from an href like "/giveaway/YnnXy/slug" */
function extractCode(href: string): string {
  if (!href) return "";
  const parts = href.split("/");
  return parts[2] ?? "";
}

/** Parse required points from text like "(35P)" */
function extractRequiredPoints(text: string): number {
  const match = text.match(/\((\d+)P\)/i);
  return match ? parseInt(match[1], 10) : 0;
}

/** Get xsrf_token from the page's hidden input */
function getXsrfToken(): string {
  const el = document.querySelector<HTMLInputElement>(
    'input[name="xsrf_token"]'
  );
  return el?.value ?? "";
}

/** Get current points from nav bar */
function getCurrentPoints(): number {
  const el = document.querySelector<HTMLSpanElement>("span.nav__points");
  const text = el?.innerText?.trim() ?? "0";
  return parseInt(text, 10) || 0;
}

/** Update the nav points display */
function updatePointsDisplay(points: number): void {
  const el = document.querySelector<HTMLSpanElement>("span.nav__points");
  if (el) {
    el.innerText = String(points);
  }
}

// ── Button state management ──────────────────────────────────────────────────

type ButtonState = "idle" | "loading" | "joined" | "error" | "insufficient" | "entered" | "leaving";

const STATE_TEXT: Record<ButtonState, string> = {
  idle:          "Join",
  loading:       "Joining...",
  joined:        "Leave",
  error:         "⚠ Error",
  insufficient:  "Need more P",
  entered:       "Leave",
  leaving:       "Leaving...",
};

const CLICKABLE_STATES: ReadonlySet<ButtonState> = new Set(["idle", "error", "entered", "joined"]);

function setButtonState(
  btn: HTMLButtonElement,
  state: ButtonState,
  extraText?: string
): void {
  const text = STATE_TEXT[state];
  btn.textContent = extraText ? `${text} ${extraText}` : text;
  btn.disabled = !CLICKABLE_STATES.has(state);
  btn.dataset.state = state;
}

// ── Store all giveaway infos for re-evaluation ───────────────────────────────

const allGiveaways: GiveawayInfo[] = [];

let isRequestInProgress = false;

// ── Main join logic ──────────────────────────────────────────────────────────

async function handleJoin(info: GiveawayInfo): Promise<void> {
  // Guard: prevent concurrent requests
  if (isRequestInProgress) return;

  const { code, requiredPoints, button } = info;

  isRequestInProgress = true;
  setButtonState(button, "loading");

  // Disable all other buttons while a request is in progress
  for (const gi of allGiveaways) {
    if (gi.button !== button) {
      gi.button.disabled = true;
    }
  }

  const currentPoints = getCurrentPoints();

  if (currentPoints < requiredPoints) {
    setButtonState(
      button,
      "insufficient",
      `(${currentPoints}/${requiredPoints}P)`
    );
    isRequestInProgress = false;
    updateAllButtonStates();
    return;
  }

  const xsrfToken = getXsrfToken();
  if (!xsrfToken) {
    setButtonState(button, "error");
    console.error("[SG-QuickJoin] Missing xsrf_token");
    isRequestInProgress = false;
    updateAllButtonStates();
    return;
  }

  try {
    const body = new URLSearchParams({
      xsrf_token: xsrfToken,
      do: "entry_insert",
      code,
    });

    const resp = await fetch("https://www.steamgifts.com/ajax.php", {
      method: "POST",
      headers: {
        accept: "application/json, text/javascript, */*; q=0.01",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-requested-with": "XMLHttpRequest",
      },
      body: body.toString(),
      credentials: "include",
    });

    if (!resp.ok) {
      setButtonState(button, "error");
      return;
    }

    const data: { type?: string; points?: string; entry_count?: string } =
      await resp.json();

    // Update points display from response
    const newPoints = parseInt(data.points ?? "0", 10);
    updatePointsDisplay(newPoints);

    // Refresh all buttons: disable those with insufficient points, re-enable others
    updateAllButtonStates();

    if (data.type === "success") {
      setButtonState(button, "joined");
    } else {
      // Show API error message (e.g. "Not Enough Points")
      console.info(data);
      const errMsg = (data as { msg?: string }).msg;
      setButtonState(button, "error", errMsg);
    }
  } catch (err) {
    console.error("[SG-QuickJoin] Request failed:", err);
    setButtonState(button, "error");
  } finally {
    isRequestInProgress = false;
  }
}

// ── Main leave logic ──────────────────────────────────────────────────────────

async function handleLeave(info: GiveawayInfo): Promise<void> {
  if (isRequestInProgress) return;

  const { code, button } = info;

  isRequestInProgress = true;
  setButtonState(button, "leaving");

  // Disable all other buttons while a request is in progress
  for (const gi of allGiveaways) {
    if (gi.button !== button) {
      gi.button.disabled = true;
    }
  }

  const xsrfToken = getXsrfToken();
  if (!xsrfToken) {
    setButtonState(button, "error");
    button.dataset.action = "leave";
    console.error("[SG-QuickJoin] Missing xsrf_token for leave");
    isRequestInProgress = false;
    updateAllButtonStates();
    return;
  }

  try {
    const body = new URLSearchParams({
      xsrf_token: xsrfToken,
      do: "entry_delete",
      code,
    });

    const resp = await fetch("https://www.steamgifts.com/ajax.php", {
      method: "POST",
      headers: {
        accept: "application/json, text/javascript, */*; q=0.01",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-requested-with": "XMLHttpRequest",
      },
      body: body.toString(),
      credentials: "include",
    });

    if (!resp.ok) {
      setButtonState(button, "error");
      button.dataset.action = "leave";
      return;
    }

    const data: { type?: string; points?: string } = await resp.json();

    if (data.type === "success") {
      // Back to joinable state — points check happens in updateAllButtonStates
      setButtonState(button, "idle");
      button.dataset.action = "join";

      // Update points display from response
      const newPoints = parseInt(data.points ?? "0", 10);
      if (newPoints > 0) {
        updatePointsDisplay(newPoints);
      }
    } else {
      const errMsg = (data as { msg?: string }).msg;
      setButtonState(button, "error", errMsg);
      button.dataset.action = "leave";

      const errPoints = parseInt((data as { points?: string }).points ?? "0", 10);
      if (errPoints > 0) {
        updatePointsDisplay(errPoints);
      }
    }
  } catch (err) {
    console.error("[SG-QuickJoin] Leave request failed:", err);
    setButtonState(button, "error");
    button.dataset.action = "leave";
  } finally {
    isRequestInProgress = false;
    updateAllButtonStates();
  }
}

// ── Click dispatcher ──────────────────────────────────────────────────────────

function handleButtonClick(info: GiveawayInfo): void {
  const state = info.button.dataset.state as ButtonState | undefined;
  if (state === "entered" || state === "joined") {
    handleLeave(info);
  } else if (state === "error" && info.button.dataset.action === "leave") {
    handleLeave(info);
  } else {
    handleJoin(info);
  }
}

// ── Re-evaluate buttons on points change ─────────────────────────────────────

function updateAllButtonStates(): void {
  const currentPoints = getCurrentPoints();

  for (const info of allGiveaways) {
    const btn = info.button;
    const state = btn.dataset.state as ButtonState | undefined;

    // Leave buttons (entered/joined) should always stay enabled — they may
    // have been disabled during a concurrent request and need re-enabling.
    // Never downgrade them to "insufficient" just because points are low.
    if (state === "entered" || state === "joined") {
      btn.disabled = false;
      continue;
    }

    // Only re-evaluate buttons in transient states.
    // Skip error buttons that were attempting a leave — they should stay as
    // error so the user can retry the leave, not flip back to join.
    if (
      state === "idle" ||
      state === "insufficient" ||
      (state === "error" && btn.dataset.action !== "leave")
    ) {
      if (currentPoints < info.requiredPoints) {
        setButtonState(
          btn,
          "insufficient",
          `(${currentPoints}/${info.requiredPoints}P)`
        );
      } else {
        setButtonState(btn, "idle");
      }
    }
  }
}

// ── Build button element ─────────────────────────────────────────────────────

function createJoinButton(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "sg-quickjoin-btn";
  return btn;
}

// ── Scan page and set up buttons ─────────────────────────────────────────────

function setupGiveawayRow(outWrap: HTMLElement): void {
  const headingName = outWrap.querySelector<HTMLAnchorElement>(
    "a.giveaway__heading__name"
  );
  if (!headingName) return;

  const code = extractCode(headingName.getAttribute("href") ?? "");
  if (!code) return;

  const thinSpan = outWrap.querySelector<HTMLSpanElement>(
    "span.giveaway__heading__thin"
  );
  const requiredPoints = thinSpan
    ? extractRequiredPoints(thinSpan.innerText)
    : 0;

  const info: GiveawayInfo = {
    outWrap,
    headingName,
    code,
    requiredPoints: requiredPoints || 0,
    button: null!,
  };

  const innerWrap = outWrap.querySelector<HTMLElement>(
    ".giveaway__row-inner-wrap"
  );
  const parent = innerWrap ?? outWrap;
  const alreadyEntered = innerWrap?.classList.contains("is-faded") ?? false;

  const btn = createJoinButton();
  info.button = btn;

  if (alreadyEntered) {
    setButtonState(btn, "entered");
  } else {
    // Check points immediately — disable button if insufficient
    const currentPoints = getCurrentPoints();
    if (currentPoints < requiredPoints) {
      setButtonState(
        btn,
        "insufficient",
        `(${currentPoints}/${requiredPoints}P)`
      );
    } else {
      setButtonState(btn, "idle");
    }
  }

  // Attach click handler for all clickable states
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleButtonClick(info);
  });

  // Match button height to parent's full visual height.
  // If parent has padding, the button (a flex child) only fills the
  // content area — negative margins extend it into the padding zone.
  function syncButtonHeight(): void {
    const cs = getComputedStyle(parent);
    const pt = parseFloat(cs.paddingTop) || 0;
    const pb = parseFloat(cs.paddingBottom) || 0;
    if (pt > 0 || pb > 0) {
      btn.style.marginTop = -pt + "px";
      btn.style.marginBottom = -pb + "px";
      btn.style.paddingTop = pt + "px";
      btn.style.paddingBottom = pb + "px";
    }
    btn.style.height = parent.getBoundingClientRect().height + "px";
  }

  parent.appendChild(btn);
  syncButtonHeight();

  // Re-sync if the page resizes
  window.addEventListener("resize", syncButtonHeight, { passive: true });

  allGiveaways.push(info);
}

// ── Fixed header ──────────────────────────────────────────────────────────────

function fixHeader(): void {
  const header = document.querySelector<HTMLElement>("header");
  if (!header) return;

  header.classList.add("sg-quickjoin-header-fixed");

  // Add top margin to body to prevent content from hiding behind the fixed header
  document.body.style.marginTop = header.offsetHeight + "px";
}

// ── Entry point ──────────────────────────────────────────────────────────────

function main(): void {
  fixHeader();

  const outWraps = document.querySelectorAll<HTMLElement>(
    "div.giveaway__row-outer-wrap"
  );

  if (outWraps.length === 0) return;

  outWraps.forEach(setupGiveawayRow);
  // Initial state evaluation
  updateAllButtonStates();
}

// Run on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}
