// ==UserScript==
// @name         SG QuickJoin
// @namespace    https://github.com/HCLonely/SG-QuickJoin
// @version      1.0.1
// @description  Adds a 'one-click "Join / Leave"' button to each giveaway on SteamGifts
// @author       HCLonely
// @match        https://www.steamgifts.com/*
// @license      MIT
// @tag          games
// @grant        none
// ==/UserScript==

"use strict";
(() => {
  // src/main.ts
  function extractCode(href) {
    if (!href) return "";
    const parts = href.split("/");
    return parts[2] ?? "";
  }
  function extractRequiredPoints(text) {
    const match = text.match(/\((\d+)P\)/i);
    return match ? parseInt(match[1], 10) : 0;
  }
  function getXsrfToken() {
    const el = document.querySelector(
      'input[name="xsrf_token"]'
    );
    return el?.value ?? "";
  }
  function getCurrentPoints() {
    const el = document.querySelector("span.nav__points");
    const text = el?.innerText?.trim() ?? "0";
    return parseInt(text, 10) || 0;
  }
  function updatePointsDisplay(points) {
    const el = document.querySelector("span.nav__points");
    if (el) {
      el.innerText = String(points);
    }
  }
  var STATE_STYLES = {
    idle: {
      text: "Join",
      style: {
        background: "#7ba4f7",
        color: "#fff",
        cursor: "pointer",
        border: "none"
      }
    },
    loading: {
      text: "Joining...",
      style: {
        background: "#a0a7b3",
        color: "#fff",
        cursor: "wait",
        border: "none"
      }
    },
    joined: {
      text: "Leave",
      style: {
        background: "#e8a860",
        color: "#fff",
        cursor: "pointer",
        border: "none"
      }
    },
    error: {
      text: "⚠ Error",
      style: {
        background: "#e07b7b",
        color: "#fff",
        cursor: "pointer",
        border: "none"
      }
    },
    insufficient: {
      text: "Need more P",
      style: {
        background: "#c5cad2",
        color: "#fff",
        cursor: "not-allowed",
        border: "none"
      }
    },
    entered: {
      text: "Leave",
      style: {
        background: "#e8a860",
        color: "#fff",
        cursor: "pointer",
        border: "none"
      }
    },
    leaving: {
      text: "Leaving...",
      style: {
        background: "#a0a7b3",
        color: "#fff",
        cursor: "wait",
        border: "none"
      }
    }
  };
  var CLICKABLE_STATES = /* @__PURE__ */ new Set(["idle", "error", "entered", "joined"]);
  function setButtonState(btn, state, extraText) {
    const cfg = STATE_STYLES[state];
    btn.textContent = extraText ? `${cfg.text} ${extraText}` : cfg.text;
    btn.disabled = !CLICKABLE_STATES.has(state);
    btn.dataset.state = state;
    Object.assign(btn.style, {
      ...cfg.style
    });
  }
  var allGiveaways = [];
  var isRequestInProgress = false;
  async function handleJoin(info) {
    if (isRequestInProgress) return;
    const { code, requiredPoints, button } = info;
    isRequestInProgress = true;
    setButtonState(button, "loading");
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
        code
      });
      const resp = await fetch("https://www.steamgifts.com/ajax.php", {
        method: "POST",
        headers: {
          accept: "application/json, text/javascript, */*; q=0.01",
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "x-requested-with": "XMLHttpRequest"
        },
        body: body.toString(),
        credentials: "include"
      });
      if (!resp.ok) {
        setButtonState(button, "error");
        return;
      }
      const data = await resp.json();
      if (data.type === "success") {
        setButtonState(button, "joined");
        const newPoints = parseInt(data.points ?? "0", 10);
        if (newPoints > 0) {
          updatePointsDisplay(newPoints);
        }
      } else {
        const errMsg = data.msg;
        setButtonState(button, "error", errMsg);
        const errPoints = parseInt(data.points ?? "0", 10);
        if (errPoints > 0) {
          updatePointsDisplay(errPoints);
        }
      }
    } catch (err) {
      console.error("[SG-QuickJoin] Request failed:", err);
      setButtonState(button, "error");
    } finally {
      isRequestInProgress = false;
      updateAllButtonStates();
    }
  }
  async function handleLeave(info) {
    if (isRequestInProgress) return;
    const { code, button } = info;
    isRequestInProgress = true;
    setButtonState(button, "leaving");
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
        code
      });
      const resp = await fetch("https://www.steamgifts.com/ajax.php", {
        method: "POST",
        headers: {
          accept: "application/json, text/javascript, */*; q=0.01",
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "x-requested-with": "XMLHttpRequest"
        },
        body: body.toString(),
        credentials: "include"
      });
      if (!resp.ok) {
        setButtonState(button, "error");
        button.dataset.action = "leave";
        return;
      }
      const data = await resp.json();
      if (data.type === "success") {
        setButtonState(button, "idle");
        button.dataset.action = "join";
        const newPoints = parseInt(data.points ?? "0", 10);
        if (newPoints > 0) {
          updatePointsDisplay(newPoints);
        }
      } else {
        const errMsg = data.msg;
        setButtonState(button, "error", errMsg);
        button.dataset.action = "leave";
        const errPoints = parseInt(data.points ?? "0", 10);
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
  function handleButtonClick(info) {
    const state = info.button.dataset.state;
    if (state === "entered" || state === "joined") {
      handleLeave(info);
    } else if (state === "error" && info.button.dataset.action === "leave") {
      handleLeave(info);
    } else {
      handleJoin(info);
    }
  }
  function updateAllButtonStates() {
    const currentPoints = getCurrentPoints();
    for (const info of allGiveaways) {
      const btn = info.button;
      const state = btn.dataset.state;
      if (state === "idle" || state === "insufficient" || state === "error" && btn.dataset.action !== "leave") {
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
  var BTN_MIN_WIDTH = "180px";
  function createJoinButton() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sg-quickjoin-btn";
    Object.assign(btn.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "stretch",
      flexShrink: "0",
      whiteSpace: "nowrap",
      boxSizing: "border-box",
      minWidth: BTN_MIN_WIDTH,
      padding: "0 16px",
      borderRadius: "0 4px 4px 0",
      fontSize: "13px",
      fontWeight: "500",
      transition: "background 0.2s"
    });
    return btn;
  }
  function setupGiveawayRow(outWrap) {
    const headingName = outWrap.querySelector(
      "a.giveaway__heading__name"
    );
    if (!headingName) return;
    const code = extractCode(headingName.getAttribute("href") ?? "");
    if (!code) return;
    const thinSpan = outWrap.querySelector(
      "span.giveaway__heading__thin"
    );
    const requiredPoints = thinSpan ? extractRequiredPoints(thinSpan.innerText) : 0;
    const info = {
      outWrap,
      headingName,
      code,
      requiredPoints: requiredPoints || 0,
      button: null
    };
    const innerWrap = outWrap.querySelector(
      ".giveaway__row-inner-wrap"
    );
    const parent = innerWrap ?? outWrap;
    const alreadyEntered = innerWrap?.classList.contains("is-faded") ?? false;
    const btn = createJoinButton();
    info.button = btn;
    if (alreadyEntered) {
      setButtonState(btn, "entered");
    } else {
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
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleButtonClick(info);
    });
    function syncButtonHeight() {
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
    window.addEventListener("resize", syncButtonHeight, { passive: true });
    allGiveaways.push(info);
  }
  function fixHeader() {
    const header = document.querySelector("header");
    if (!header) return;
    header.style.position = "fixed";
    header.style.top = "0";
    header.style.left = "0";
    header.style.width = "100%";
    header.style.zIndex = "1000";
    document.body.style.marginTop = header.offsetHeight + "px";
  }
  function main() {
    fixHeader();
    const outWraps = document.querySelectorAll(
      "div.giveaway__row-outer-wrap"
    );
    if (outWraps.length === 0) return;
    outWraps.forEach(setupGiveawayRow);
    updateAllButtonStates();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();
