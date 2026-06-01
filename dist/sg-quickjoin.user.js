// ==UserScript==
// @name            SG QuickJoin
// @namespace       https://github.com/HCLonely/SG-QuickJoin
// @version         1.0.5
// @description     一个基于 Tampermonkey的用户脚本，为 SteamGifts.com上的每个抽奖添加一键"Join / Leave"按钮。
// @description:en  Adds a 'one-click "Join / Leave"' button to each giveaway on SteamGifts
// @author          HCLonely
// @match           https://www.steamgifts.com/*
// @license         MIT
// @tag             games
// @homepage        https://github.com/HCLonely/SG-QuickJoin
// @supportURL      https://github.com/HCLonely/SG-QuickJoin/issues
// @updateURL       https://github.com/HCLonely/SG-QuickJoin/blob/main/dist/sg-quickjoin.user.js?raw=true
// @installURL      https://github.com/HCLonely/SG-QuickJoin/blob/main/dist/sg-quickjoin.user.js?raw=true
// @downloadURL     https://github.com/HCLonely/SG-QuickJoin/blob/main/dist/sg-quickjoin.user.js?raw=true
// @icon            https://github.com/HCLonely/SG-QuickJoin/blob/main/icon.ico?raw=true
// @grant           GM_addStyle
// @grant           GM_registerMenuCommand
// @grant           GM_unregisterMenuCommand
// @grant           GM_setValue
// @grant           GM_getValue
// ==/UserScript==

"use strict";
(() => {
  // src/main.ts
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

  .sg-hide-joined .giveaway__row-outer-wrap:has(.sg-quickjoin-btn[data-state="entered"],.sg-quickjoin-btn[data-state="joined"]) {
    display: none;
  }
`);
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
  var STATE_TEXT = {
    idle: "Join",
    loading: "Joining...",
    joined: "Leave",
    error: "⚠ Error",
    insufficient: "Need more P",
    entered: "Leave",
    leaving: "Leaving..."
  };
  var CLICKABLE_STATES = /* @__PURE__ */ new Set(["idle", "error", "entered", "joined"]);
  function setButtonState(btn, state, extraText) {
    const text = STATE_TEXT[state];
    btn.textContent = extraText ? `${text} ${extraText}` : text;
    btn.disabled = !CLICKABLE_STATES.has(state);
    btn.dataset.state = state;
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
      const newPoints = parseInt(data.points ?? "0", 10);
      updatePointsDisplay(newPoints);
      updateAllButtonStates();
      if (data.type === "success") {
        setButtonState(button, "joined");
      } else {
        console.info(data);
        const errMsg = data.msg;
        setButtonState(button, "error", errMsg);
      }
    } catch (err) {
      console.error("[SG-QuickJoin] Request failed:", err);
      setButtonState(button, "error");
    } finally {
      isRequestInProgress = false;
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
      if (state === "entered" || state === "joined") {
        btn.disabled = false;
        continue;
      }
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
  function createJoinButton() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sg-quickjoin-btn";
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
      button: null,
      syncHeight: null
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
      const parentHeight = parent.getBoundingClientRect().height;
      if (parentHeight === 0) return;
      const cs = getComputedStyle(parent);
      const pt = parseFloat(cs.paddingTop) || 0;
      const pb = parseFloat(cs.paddingBottom) || 0;
      if (pt > 0 || pb > 0) {
        btn.style.marginTop = -pt + "px";
        btn.style.marginBottom = -pb + "px";
        btn.style.paddingTop = pt + "px";
        btn.style.paddingBottom = pb + "px";
      }
      btn.style.height = parentHeight + "px";
    }
    info.syncHeight = syncButtonHeight;
    parent.appendChild(btn);
    syncButtonHeight();
    window.addEventListener("resize", syncButtonHeight, { passive: true });
    allGiveaways.push(info);
  }
  function fixHeader() {
    const header = document.querySelector("header");
    if (!header) return;
    header.classList.add("sg-quickjoin-header-fixed");
    document.body.style.marginTop = header.offsetHeight + "px";
  }
  var HIDE_JOINED_KEY = "hideJoined";
  function applyHideJoinedSetting(shouldHide) {
    document.body.classList.toggle("sg-hide-joined", shouldHide);
    if (!shouldHide) {
      for (const info of allGiveaways) {
        info.syncHeight();
      }
    }
  }
  function toggleHideJoined() {
    const current = GM_getValue(HIDE_JOINED_KEY, false);
    const next = !current;
    GM_setValue(HIDE_JOINED_KEY, next);
    applyHideJoinedSetting(next);
  }
  var menuCommandId;
  function registerHideJoinedMenu() {
    if (menuCommandId) {
      GM_unregisterMenuCommand(menuCommandId);
    }
    const isHidden = GM_getValue(HIDE_JOINED_KEY, false);
    const caption = isHidden ? "☑ 显示已加入的 Giveaway" : "☐ 隐藏已加入的 Giveaway";
    menuCommandId = GM_registerMenuCommand(caption, () => {
      toggleHideJoined();
      registerHideJoinedMenu();
    });
  }
  registerHideJoinedMenu();
  function main() {
    fixHeader();
    applyHideJoinedSetting(GM_getValue(HIDE_JOINED_KEY, false));
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
