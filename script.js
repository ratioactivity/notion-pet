(() => {
  "use strict";

  const HOUR_MS = 60 * 60 * 1000;
  const MAX_STAT = 20;
  const WARN_THRESHOLD = 15;
  const LEVEL_CAP = 20;
  const OVERLOAD_DURATION = 7 * 24 * 60 * 60 * 1000;
  const STORAGE_KEY = "notion-pet-state-v1";
  const SCALE_STORAGE_KEY = "notion-pet-scale-pref";
  const DEFAULT_NAME = "Aurora";
  const MAX_NAME_LENGTH = 18;
  const BASE_CARD_WIDTH = 320;
  const MIN_UI_SCALE = 0.5;
  const MAX_UI_SCALE = 1.05;

  const SPRITE_PATH = "assets/sprites/";
  const FISH_PATH = "assets/fish/";
  const EMOTE_PATH = "assets/emotes/";

  const spriteSequences = mapSpritePaths({
    idle: [
      "otter_idle_1.png",
      "otter_idle_2.png",
      "otter_idle_3.png",
      "otter_idle_4.png",
      "otter_idle_2.png"
    ],
    cuddle: [
      "otter_idle_alt_1.png",
      "otter_idle_alt_2.png",
      "otter_idle_alt_3.png",
      "otter_idle_alt_4.png",
      "otter_idle_alt_5.png",
      "otter_idle_alt_6.png"
    ],
    snack: [
      "otter_idle_alt_7.png",
      "otter_idle_alt_8.png",
      "otter_idle_alt_9.png",
      "otter_idle_alt_10.png",
      "otter_idle_alt_11.png",
      "otter_idle_alt_12.png"
    ],
    play: [
      "otter_jump_1.png",
      "otter_jump_2.png",
      "otter_jump_3.png",
      "otter_jump_4.png",
      "otter_spin_1.png",
      "otter_spin_2.png",
      "otter_spin_3.png",
      "otter_land_1.png",
      "otter_land_2.png",
      "otter_land_3.png"
    ],
    run: ["otter_run_1.png", "otter_run_2.png", "otter_run_3.png"],
    sleep: [
      "otter_sleep_1.png",
      "otter_sleep_2.png",
      "otter_sleep_3.png",
      "otter_sleep_4.png",
      "otter_sleep_5.png",
      "otter_sleep_6.png"
    ]
  });

  const fishSources = [
    "fishfood1.png",
    "fishfood2.png",
    "fishfood3.png",
    "fishfood4.png",
    "fishfood5.png",
    "fishfood6.png",
    "fishfood7.png",
    "fishfood8.png"
  ].map((name) => FISH_PATH + name);

  const emoteSources = {
    heart: EMOTE_PATH + "tripleheart.gif",
    stars: EMOTE_PATH + "stars.gif",
    tears: EMOTE_PATH + "tears.gif"
  };

  const deathSnark = [
    "Maybe try feeding them before they starve next time.",
    "Calling that “parenting” was generous at best.",
    "You really just watched the comfort bars max out, huh?",
    "Neglect speedrun complete. Congrats, I guess."
  ];

  const elements = {
    petName: document.getElementById("petName"),
    levelValue: document.getElementById("levelValue"),
    hungerFill: document.getElementById("hungerFill"),
    sleepinessFill: document.getElementById("sleepinessFill"),
    enrichmentFill: document.getElementById("enrichmentFill"),
    bondingFill: document.getElementById("bondingFill"),
    petSprite: document.getElementById("petSprite"),
    signalEmote: document.getElementById("signalEmote"),
    moodEmote: document.getElementById("moodEmote"),
    crownEmote: document.getElementById("crownEmote"),
    fishEmote: document.getElementById("fishEmote"),
    petPlaceholder: document.getElementById("petPlaceholder"),
    statusMessage: document.getElementById("statusMessage"),
    renameButton: document.getElementById("renameButton"),
    adoptButton: document.getElementById("adoptButton"),
    afterlifeActions: document.getElementById("afterlifeActions"),
    reviveButton: document.getElementById("reviveButton"),
    cardScaler: document.getElementById("cardScaler"),
    petCard: document.querySelector(".pet-card"),
    sizeButtons: Array.from(document.querySelectorAll("[data-scale-mode]")),
    root: document.documentElement,
    renameDialog: document.getElementById("renameDialog"),
    renameForm: document.getElementById("renameForm"),
    renameInput: document.getElementById("renameInput"),
    renameCancel: document.getElementById("renameCancel"),
    renameTitle: document.getElementById("renameTitle"),
    renameSubmit: document.getElementById("renameSubmit")
  };

  const actionButtons = Array.from(document.querySelectorAll("[data-action]"));

  let signalTimeout = null;
  let fishTimeout = null;
  let idleInterval = null;
  let actionInterval = null;
  let actionTimeout = null;
  let lastActionMessage = "";
  let scaleMode = "auto";
  let manualScale = 1;
  let currentScale = 1;
  let scaleResizeObserver = null;
  let pendingScaleSync = false;
  let lastFocusedElement = null;
  let nameDialogContext = null;

  const storage = initStorage();
  let isFirstLaunch = false;
  let state = loadState();

  initialize();

  function initialize() {
    attachEventHandlers();
    setupSizeControls();

    const reviveStateChanged = ensureReviveAvailability();

    if (isFirstLaunch) {
      setName(state.name);
      setStatus(`${state.name} is ready for cozy adventures.`);
      openNameDialog({
        title: "Welcome! Name your new pet friend:",
        submitLabel: "Adopt",
        initialValue: state.name,
        onConfirm: (newName) => {
          setName(newName);
          setStatus(`${state.name} is ready for cozy adventures.`);
          updateUI();
          saveState();
        }
      });
    } else {
      setName(state.name);
      setStatus(state.alive ? `${state.name} missed you!` : "");
    }

    updateUI();
    if (reviveStateChanged) {
      saveState();
    }
    tick(true);
    window.setInterval(tick, 60 * 1000);
  }

  function attachEventHandlers() {
    actionButtons.forEach((button) => {
      button.addEventListener("click", () => handleAction(button.dataset.action));
    });

    if (elements.renameButton) {
      elements.renameButton.addEventListener("click", () => {
        if (!state.alive) {
          return;
        }
        openNameDialog({
          title: "Rename your companion:",
          submitLabel: "Save",
          initialValue: state.name,
          onConfirm: (newName) => {
            if (newName !== state.name) {
              setName(newName);
              setStatus(`${state.name} loves their new name.`);
              updateUI();
              saveState();
            }
          }
        });
      });
    }

    if (elements.adoptButton) {
      elements.adoptButton.addEventListener("click", adoptNewPet);
    }

    if (elements.reviveButton) {
      elements.reviveButton.addEventListener("click", revivePet);
    }

    if (elements.renameForm) {
      elements.renameForm.addEventListener("submit", handleRenameSubmit);
    }

    if (elements.renameCancel) {
      elements.renameCancel.addEventListener("click", cancelNameDialog);
    }

    if (elements.renameDialog) {
      elements.renameDialog.addEventListener("click", (event) => {
        if (event.target === elements.renameDialog) {
          cancelNameDialog();
        }
      });
    }
  }

  function setupSizeControls() {
    if (!elements.cardScaler || !elements.petCard) {
      return;
    }

    const saved = loadScalePreference();
    scaleMode = saved.mode;
    manualScale = saved.value;
    updateScaleButtons();

    elements.sizeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.dataset.scaleMode;
        if (mode === "auto") {
          if (scaleMode !== "auto") {
            scaleMode = "auto";
            saveScalePreference();
            updateScaleButtons();
            queueScaleSync();
          }
          return;
        }

        const value = clampNumber(button.dataset.scaleValue, MIN_UI_SCALE, MAX_UI_SCALE, manualScale);
        if (scaleMode !== "manual" || Math.abs(value - manualScale) > 0.001) {
          scaleMode = "manual";
          manualScale = value;
          saveScalePreference();
          updateScaleButtons();
          queueScaleSync();
        }
      });
    });

    if (typeof ResizeObserver === "function") {
      const target = elements.cardScaler?.parentElement || elements.cardScaler || elements.petCard;
      if (target) {
        scaleResizeObserver = new ResizeObserver(queueScaleSync);
        scaleResizeObserver.observe(target);
      }
    }

    window.addEventListener("resize", queueScaleSync, { passive: true });
    queueScaleSync();
  }

  function handleAction(action) {
    tick();

    if (!state.alive) {
      setStatus("Your pet has already drifted away. Adopt a new friend to continue.");
      updateUI();
      return;
    }

    const now = Date.now();
    let message = "";

    switch (action) {
      case "feed":
        setHunger(0);
        increaseBonding(1);
        showFishEmote();
        playOnce(spriteSequences.snack, 220, 400);
        message = `${state.name} devours the fishy snack.`;
        break;
      case "pet":
        increaseBonding(3);
        playOnce(spriteSequences.cuddle, 200, 500);
        showTemporaryEmote("heart", 2600, "Heartfelt appreciation");
        message = `${state.name} melts into your gentle scritches.`;
        break;
      case "play":
        increaseBonding(2);
        increaseEnrichment(2);
        increaseSleepiness(1);
        playOnce(spriteSequences.play, 180, 500);
        message = `${state.name} spins and tumbles with delight.`;
        break;
      case "exercise":
        increaseEnrichment(3);
        increaseSleepiness(1);
        loopAnimation(spriteSequences.run, 140, 2600);
        message = `${state.name} dashes around to burn off energy.`;
        break;
      case "sleep":
        setSleepiness(0);
        loopAnimation(spriteSequences.sleep, 520, 4200);
        message = `${state.name} curls up for a restorative nap.`;
        break;
      default:
        return;
    }

    const levelMessage = evaluateFriendshipProgress();
    const combinedMessage = levelMessage ? `${message} ${levelMessage}`.trim() : message;
    setStatus(combinedMessage);
    updateOverloadState(now);
    updateUI();
    saveState();
  }

  function tick(force = false) {
    const now = Date.now();

    if (!state.alive) {
      state.lastTick = now;
      if (force) {
        updateUI();
      }
      return;
    }

    const progressed = applyTimeProgress(now);
    const died = updateOverloadState(now);
    if (died) {
      return;
    }

    if (force || progressed) {
      updateUI();
      saveState();
    } else {
      updateMoodEmote();
      updateStatusText();
    }
  }

  function applyTimeProgress(now) {
    if (state.lastTick > now) {
      state.lastTick = now;
      return false;
    }

    const elapsed = now - state.lastTick;
    if (elapsed < HOUR_MS) {
      return false;
    }

    const increments = Math.floor(elapsed / HOUR_MS);
    const remainder = elapsed % HOUR_MS;

    const previousHunger = state.hunger;
    const previousSleepiness = state.sleepiness;

    const newHunger = Math.min(MAX_STAT, previousHunger + increments);
    const newSleepiness = Math.min(MAX_STAT, previousSleepiness + increments);

    let hungerReachedAt = null;
    let sleepReachedAt = null;

    if (newHunger >= MAX_STAT) {
      if (previousHunger < MAX_STAT) {
        const hoursToMax = MAX_STAT - previousHunger;
        const overflowHours = increments - hoursToMax;
        hungerReachedAt = now - (overflowHours * HOUR_MS + remainder);
      } else if (!state.hungerMaxTimestamp) {
        hungerReachedAt = now - remainder;
      }
    }

    if (newSleepiness >= MAX_STAT) {
      if (previousSleepiness < MAX_STAT) {
        const hoursToMax = MAX_STAT - previousSleepiness;
        const overflowHours = increments - hoursToMax;
        sleepReachedAt = now - (overflowHours * HOUR_MS + remainder);
      } else if (!state.sleepinessMaxTimestamp) {
        sleepReachedAt = now - remainder;
      }
    }

    setHunger(newHunger, hungerReachedAt);
    setSleepiness(newSleepiness, sleepReachedAt);

    state.lastTick = now - remainder;

    return newHunger !== previousHunger || newSleepiness !== previousSleepiness;
  }

  function evaluateFriendshipProgress() {
    if (state.enrichment >= MAX_STAT && state.bonding >= MAX_STAT) {
      if (state.level < LEVEL_CAP) {
        state.level += 1;
        state.enrichment = 0;
        state.bonding = 0;
        showTemporaryEmote("stars", 2800, "Friendship level up");
        return `${state.name}'s friendship level rose to ${state.level}!`;
      }
      state.enrichment = MAX_STAT;
      state.bonding = MAX_STAT;
      return `${state.name} cannot get any closer—this bond is legendary.`;
    }
    return "";
  }

  function updateOverloadState(now) {
    if (state.hungerMaxTimestamp && state.sleepinessMaxTimestamp) {
      const start = Math.max(state.hungerMaxTimestamp, state.sleepinessMaxTimestamp);
      state.overloadStart = start;
      if (now - start >= OVERLOAD_DURATION) {
        handleDeath();
        return true;
      }
    } else {
      state.overloadStart = null;
    }
    return false;
  }

  function handleDeath() {
    if (!state.alive) {
      return;
    }

    state.alive = false;
    state.lastTick = Date.now();
    stopAnimations();
    hideEmotes();

    const snark = deathSnark[Math.floor(Math.random() * deathSnark.length)];
    const reviveTarget = Math.max(1, state.level - 1);
    const reviveHint =
      state.level > 1
        ? ` Revive them to bring them back at level ${reviveTarget}.`
        : " Revive them to give them another chance.";
    const message = `Your pet has died. ${snark}${reviveHint}`;
    state.deathNote = message;
    state.deathSnarkLine = snark;
    state.hungerMaxTimestamp = null;
    state.sleepinessMaxTimestamp = null;
    state.overloadStart = null;
    state.reviveLevel = reviveTarget;

    setStatus("");
    updateUI();
    saveState();
  }

  function adoptNewPet() {
    stopAnimations();
    hideEmotes();
    state = createDefaultState();
    setName(state.name);
    setStatus(`${state.name} is ready for cozy adventures.`);
    updateUI();
    showTemporaryEmote("heart", 2600, `${state.name} is relieved to be back`);
    saveState();
    openNameDialog({
      title: "A new pet is ready to move in! What will you name them?",
      submitLabel: "Adopt",
      initialValue: state.name,
      onConfirm: (newName) => {
        setName(newName);
        setStatus(`${state.name} wiggles in to meet you.`);
        updateUI();
        saveState();
      }
    });
  }

  function revivePet() {
    if (state.alive || state.reviveLevel == null) {
      return;
    }

    const revivedLevel = clamp(state.reviveLevel, 1, LEVEL_CAP);
    const previousLevel = state.level;

    state.level = revivedLevel;
    state.alive = true;
    state.reviveLevel = null;
    state.hunger = 0;
    state.sleepiness = 0;
    state.enrichment = 0;
    state.bonding = 0;
    state.lastTick = Date.now();
    state.hungerMaxTimestamp = null;
    state.sleepinessMaxTimestamp = null;
    state.overloadStart = null;
    state.deathNote = "";
    state.deathSnarkLine = "";

    stopAnimations();
    hideEmotes();

    const levelDrop = Math.max(0, previousLevel - state.level);
    const message = levelDrop
      ? `${state.name} returns, but their friendship level slipped to ${state.level}.`
      : `${state.name} returns, grateful for a second chance.`;
    setStatus(message);

    updateUI();
    showTemporaryEmote("heart", 2600, `${state.name} is relieved to be back`);
    saveState();
  }

  function setName(name) {
    const clean = sanitizeName(name);
    state.name = clean;
    elements.petName.textContent = clean;
  }

  function setStatus(message) {
    lastActionMessage = message ? message.trim() : "";
  }

  function updateUI() {
    elements.petName.textContent = state.name;
    elements.levelValue.textContent = state.level;

    updateBar(elements.hungerFill, state.hunger);
    updateBar(elements.sleepinessFill, state.sleepiness);
    updateBar(elements.enrichmentFill, state.enrichment);
    updateBar(elements.bondingFill, state.bonding);

    const showPet = state.alive;
    elements.petSprite.classList.toggle("hidden", !showPet);
    elements.petPlaceholder.classList.toggle("hidden", showPet);
    if (elements.afterlifeActions) {
      elements.afterlifeActions.classList.toggle("hidden", showPet);
    }

    if (showPet) {
      elements.petPlaceholder.innerHTML = "";
    } else {
      const snark = state.deathSnarkLine || "Maybe try nurturing instead of neglect.";
      const reviveHint =
        state.reviveLevel != null
          ? `<span class="revive-hint">Revive them to return at level ${state.reviveLevel}.</span>`
          : "";
      elements.petPlaceholder.innerHTML = `<strong>Your pet has died.</strong><span>${snark}</span>${reviveHint}`;
    }

    elements.crownEmote.classList.toggle("hidden", !showPet || state.level < LEVEL_CAP);
    elements.crownEmote.alt = showPet && state.level >= LEVEL_CAP ? `${state.name} wears a tiny crown` : "Crown emote";
    elements.adoptButton.classList.toggle("hidden", showPet);
    if (elements.reviveButton) {
      const canRevive = !showPet && state.reviveLevel != null;
      elements.reviveButton.classList.toggle("hidden", !canRevive);
      if (canRevive) {
        const reviveLabel =
          state.level > 1
            ? `Revive at level ${state.reviveLevel}`
            : "Revive your pet";
        elements.reviveButton.textContent = reviveLabel;
        elements.reviveButton.setAttribute("aria-label", reviveLabel);
      }
    }
    elements.renameButton.disabled = !showPet;
    elements.renameButton.setAttribute("aria-disabled", showPet ? "false" : "true");

    actionButtons.forEach((button) => {
      button.disabled = !showPet;
    });

    updateMoodEmote();
    updateStatusText();

    if (!showPet) {
      stopIdleAnimation();
    } else if (!idleInterval && !actionInterval) {
      startIdleAnimation();
    }

    queueScaleSync();
  }

  function updateStatusText() {
    if (!state.alive) {
      elements.statusMessage.textContent = state.deathNote || "Your pet has passed on.";
      elements.statusMessage.classList.add("warning");
      return;
    }

    const warnings = [];
    if (state.hunger >= WARN_THRESHOLD) {
      warnings.push(`${state.name} is starving for a snack.`);
    }
    if (state.sleepiness >= WARN_THRESHOLD) {
      warnings.push(`${state.name} is desperate for sleep.`);
    }

    const base = lastActionMessage || `${state.name} is feeling cozy.`;
    const message = warnings.length ? `${base} ${warnings.join(" ")}` : base;
    elements.statusMessage.textContent = message.trim();
    elements.statusMessage.classList.toggle("warning", warnings.length > 0);
  }

  function updateMoodEmote() {
    if (!state.alive) {
      elements.moodEmote.classList.add("hidden");
      return;
    }

    if (state.hunger >= WARN_THRESHOLD || state.sleepiness >= WARN_THRESHOLD) {
      if (elements.moodEmote.classList.contains("hidden")) {
        restartGif(elements.moodEmote, emoteSources.tears);
      }
      elements.moodEmote.alt = `${state.name} is upset`;
      elements.moodEmote.classList.remove("hidden");
    } else {
      elements.moodEmote.classList.add("hidden");
    }
  }

  function updateBar(fillElement, value) {
    const percent = Math.max(0, Math.min(100, Math.round((value / MAX_STAT) * 100)));
    fillElement.style.width = `${percent}%`;
    fillElement.style.height = "100%";
    const bar = fillElement.parentElement;
    if (bar) {
      bar.setAttribute("aria-valuenow", String(value));
    }
  }

  function increaseEnrichment(amount) {
    state.enrichment = clamp(state.enrichment + amount, 0, MAX_STAT);
  }

  function increaseBonding(amount) {
    state.bonding = clamp(state.bonding + amount, 0, MAX_STAT);
  }

  function increaseSleepiness(amount) {
    const previous = state.sleepiness;
    const next = Math.min(MAX_STAT, previous + amount);
    const reachedAt = next >= MAX_STAT && previous < MAX_STAT ? Date.now() : null;
    setSleepiness(next, reachedAt);
  }

  function setHunger(value, reachedAt = null) {
    const clamped = clamp(value, 0, MAX_STAT);
    const wasMax = state.hunger >= MAX_STAT;
    state.hunger = clamped;

    if (clamped >= MAX_STAT) {
      if (!wasMax || !state.hungerMaxTimestamp) {
        state.hungerMaxTimestamp = reachedAt ?? Date.now();
      }
    } else {
      state.hungerMaxTimestamp = null;
    }
  }

  function setSleepiness(value, reachedAt = null) {
    const clamped = clamp(value, 0, MAX_STAT);
    const wasMax = state.sleepiness >= MAX_STAT;
    state.sleepiness = clamped;

    if (clamped >= MAX_STAT) {
      if (!wasMax || !state.sleepinessMaxTimestamp) {
        state.sleepinessMaxTimestamp = reachedAt ?? Date.now();
      }
    } else {
      state.sleepinessMaxTimestamp = null;
    }
  }

  function showTemporaryEmote(type, duration = 2200, altText = "") {
    const source = emoteSources[type];
    if (!source) {
      return;
    }
    window.clearTimeout(signalTimeout);
    restartGif(elements.signalEmote, source);
    elements.signalEmote.alt = altText || (type === "heart" ? "Heart emote" : "Sparkling stars");
    elements.signalEmote.classList.remove("hidden");
    signalTimeout = window.setTimeout(() => {
      elements.signalEmote.classList.add("hidden");
    }, duration);
  }

  function showFishEmote() {
    window.clearTimeout(fishTimeout);
    const source = fishSources[Math.floor(Math.random() * fishSources.length)];
    elements.fishEmote.src = source;
    elements.fishEmote.alt = "Fish snack";
    elements.fishEmote.classList.remove("hidden");
    fishTimeout = window.setTimeout(() => {
      elements.fishEmote.classList.add("hidden");
    }, 2200);
  }

  function hideEmotes() {
    window.clearTimeout(signalTimeout);
    window.clearTimeout(fishTimeout);
    signalTimeout = null;
    fishTimeout = null;
    elements.signalEmote.classList.add("hidden");
    elements.moodEmote.classList.add("hidden");
    elements.fishEmote.classList.add("hidden");
    elements.crownEmote.classList.add("hidden");
  }

  function startIdleAnimation() {
    if (!state.alive) {
      return;
    }
    stopIdleAnimation();
    let index = 0;
    setFrame(spriteSequences.idle[index]);
    idleInterval = window.setInterval(() => {
      index = (index + 1) % spriteSequences.idle.length;
      setFrame(spriteSequences.idle[index]);
    }, 900);
  }

  function stopIdleAnimation() {
    if (idleInterval) {
      window.clearInterval(idleInterval);
      idleInterval = null;
    }
  }

  function stopAnimations() {
    stopIdleAnimation();
    clearActionAnimation();
  }

  function playOnce(frames, frameDuration = 200, holdDuration = 400) {
    if (!frames || !frames.length) {
      return;
    }
    stopIdleAnimation();
    clearActionAnimation();

    let index = 0;
    setFrame(frames[index]);

    if (frames.length === 1) {
      actionTimeout = window.setTimeout(() => {
        if (state.alive) {
          startIdleAnimation();
        }
      }, holdDuration);
      return;
    }

    actionInterval = window.setInterval(() => {
      index += 1;
      if (index >= frames.length) {
        clearActionAnimation();
        actionTimeout = window.setTimeout(() => {
          if (state.alive) {
            startIdleAnimation();
          }
        }, holdDuration);
      } else {
        setFrame(frames[index]);
      }
    }, frameDuration);
  }

  function loopAnimation(frames, frameDuration, totalDuration) {
    if (!frames || !frames.length) {
      return;
    }
    stopIdleAnimation();
    clearActionAnimation();

    let index = 0;
    setFrame(frames[index]);

    actionInterval = window.setInterval(() => {
      index = (index + 1) % frames.length;
      setFrame(frames[index]);
    }, frameDuration);

    actionTimeout = window.setTimeout(() => {
      clearActionAnimation();
      if (state.alive) {
        startIdleAnimation();
      }
    }, totalDuration);
  }

  function clearActionAnimation() {
    if (actionInterval) {
      window.clearInterval(actionInterval);
      actionInterval = null;
    }
    if (actionTimeout) {
      window.clearTimeout(actionTimeout);
      actionTimeout = null;
    }
  }

  function setFrame(frame) {
    if (!frame || !elements.petSprite) {
      return;
    }
    elements.petSprite.src = frame;
  }

  function restartGif(image, src) {
    if (!image) {
      return;
    }
    image.src = `${src}?v=${Date.now()}`;
  }

  function sanitizeName(name) {
    const trimmed = String(name || DEFAULT_NAME).trim();
    if (!trimmed) {
      return DEFAULT_NAME;
    }
    return trimmed.slice(0, MAX_NAME_LENGTH);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function createDefaultState() {
    const now = Date.now();
    return {
      name: DEFAULT_NAME,
      hunger: 0,
      sleepiness: 0,
      enrichment: 0,
      bonding: 0,
      level: 1,
      alive: true,
      lastTick: now,
      hungerMaxTimestamp: null,
      sleepinessMaxTimestamp: null,
      overloadStart: null,
      deathNote: "",
      deathSnarkLine: "",
      reviveLevel: null,
      createdAt: now
    };
  }

  function loadState() {
    const base = createDefaultState();
    if (!storage) {
      isFirstLaunch = true;
      return base;
    }

    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      isFirstLaunch = true;
      return base;
    }

    try {
      const parsed = JSON.parse(raw);
      const sanitized = { ...base };

      sanitized.name = typeof parsed.name === "string" ? sanitizeName(parsed.name) : base.name;
      sanitized.hunger = clampNumber(parsed.hunger, 0, MAX_STAT, base.hunger);
      sanitized.sleepiness = clampNumber(parsed.sleepiness, 0, MAX_STAT, base.sleepiness);
      sanitized.enrichment = clampNumber(parsed.enrichment, 0, MAX_STAT, base.enrichment);
      sanitized.bonding = clampNumber(parsed.bonding, 0, MAX_STAT, base.bonding);
      sanitized.level = clampNumber(parsed.level, 1, LEVEL_CAP, base.level);
      sanitized.alive = parsed.alive !== false;
      sanitized.lastTick = typeof parsed.lastTick === "number" ? Math.min(parsed.lastTick, Date.now()) : base.lastTick;
      sanitized.hungerMaxTimestamp = typeof parsed.hungerMaxTimestamp === "number" ? parsed.hungerMaxTimestamp : null;
      sanitized.sleepinessMaxTimestamp = typeof parsed.sleepinessMaxTimestamp === "number" ? parsed.sleepinessMaxTimestamp : null;
      sanitized.overloadStart = typeof parsed.overloadStart === "number" ? parsed.overloadStart : null;
      sanitized.deathNote = typeof parsed.deathNote === "string" ? parsed.deathNote : "";
      sanitized.deathSnarkLine = typeof parsed.deathSnarkLine === "string" ? parsed.deathSnarkLine : "";
      if (typeof parsed.reviveLevel === "number") {
        sanitized.reviveLevel = clamp(parsed.reviveLevel, 1, LEVEL_CAP);
      } else if (!sanitized.alive) {
        sanitized.reviveLevel = clamp(Math.max(1, sanitized.level - 1), 1, LEVEL_CAP);
      } else {
        sanitized.reviveLevel = null;
      }
      sanitized.createdAt = typeof parsed.createdAt === "number" ? parsed.createdAt : base.createdAt;

      isFirstLaunch = false;
      return sanitized;
    } catch (error) {
      console.warn("Unable to load pet state.", error);
      isFirstLaunch = true;
      return base;
    }
  }

  function ensureReviveAvailability() {
    if (state.alive) {
      return false;
    }

    let changed = false;
    if (state.reviveLevel == null) {
      state.reviveLevel = clamp(Math.max(1, state.level - 1), 1, LEVEL_CAP);
      changed = true;
    }

    if (state.reviveLevel != null) {
      const reviveHint =
        state.level > 1
          ? ` Revive them to bring them back at level ${state.reviveLevel}.`
          : " Revive them to give them another chance.";
      const baseNote = state.deathNote && state.deathNote.trim().length
        ? state.deathNote.trim()
        : `Your pet has died.${state.deathSnarkLine ? ` ${state.deathSnarkLine}` : ""}`;
      if (!baseNote.includes("Revive them")) {
        state.deathNote = `${baseNote}${reviveHint}`;
        changed = true;
      } else {
        state.deathNote = baseNote;
      }
    }

    return changed;
  }

  function saveState() {
    if (!storage) {
      return;
    }
    const payload = {
      name: state.name,
      hunger: state.hunger,
      sleepiness: state.sleepiness,
      enrichment: state.enrichment,
      bonding: state.bonding,
      level: state.level,
      alive: state.alive,
      lastTick: state.lastTick,
      hungerMaxTimestamp: state.hungerMaxTimestamp,
      sleepinessMaxTimestamp: state.sleepinessMaxTimestamp,
      overloadStart: state.overloadStart,
      deathNote: state.deathNote,
      deathSnarkLine: state.deathSnarkLine,
      reviveLevel: state.reviveLevel,
      createdAt: state.createdAt
    };
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn("Unable to save pet state.", error);
    }
  }

  function clampNumber(value, min, max, fallback) {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return fallback;
    }
    return clamp(numeric, min, max);
  }

  function loadScalePreference() {
    const defaults = { mode: "auto", value: 1 };
    if (!storage) {
      return defaults;
    }
    const raw = storage.getItem(SCALE_STORAGE_KEY);
    if (!raw) {
      return defaults;
    }
    try {
      const parsed = JSON.parse(raw);
      const mode = parsed.mode === "manual" ? "manual" : "auto";
      const value = clampNumber(parsed.value, MIN_UI_SCALE, MAX_UI_SCALE, 1);
      return { mode, value };
    } catch (error) {
      console.warn("Unable to load scale preference.", error);
      return defaults;
    }
  }

  function saveScalePreference() {
    if (!storage) {
      return;
    }
    try {
      storage.setItem(SCALE_STORAGE_KEY, JSON.stringify({ mode: scaleMode, value: manualScale }));
    } catch (error) {
      console.warn("Unable to save scale preference.", error);
    }
  }

  function updateScaleButtons() {
    elements.sizeButtons.forEach((button) => {
      const mode = button.dataset.scaleMode;
      const value = clampNumber(button.dataset.scaleValue, MIN_UI_SCALE, MAX_UI_SCALE, manualScale);
      const active = mode === "auto" ? scaleMode === "auto" : scaleMode === "manual" && Math.abs(value - manualScale) <= 0.001;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function queueScaleSync() {
    if (pendingScaleSync) {
      return;
    }
    pendingScaleSync = true;
    window.requestAnimationFrame(() => {
      pendingScaleSync = false;
      syncScale();
    });
  }

  function syncScale() {
    if (!elements.root) {
      return;
    }

    const container = elements.cardScaler?.parentElement || elements.cardScaler || elements.petCard || document.body;
    let availableWidth = 0;
    if (container) {
      const bounds = container.getBoundingClientRect();
      availableWidth = bounds?.width || container.clientWidth || 0;
    }
    if (!availableWidth) {
      availableWidth = window.innerWidth;
    }

    const maxForWidth = availableWidth ? availableWidth / BASE_CARD_WIDTH : MAX_UI_SCALE;
    let targetScale = scaleMode === "auto" ? maxForWidth : manualScale;

    if (availableWidth) {
      targetScale = Math.min(targetScale, maxForWidth);
    }

    targetScale = clamp(targetScale, MIN_UI_SCALE, MAX_UI_SCALE);
    if (Math.abs(targetScale - currentScale) <= 0.005) {
      return;
    }

    currentScale = targetScale;
    elements.root.style.setProperty("--ui-scale", targetScale.toFixed(3));
  }

  function initStorage() {
    try {
      const testKey = "__notion_pet__";
      window.localStorage.setItem(testKey, "ok");
      window.localStorage.removeItem(testKey);
      return window.localStorage;
    } catch (error) {
      console.warn("Local storage is unavailable; progress will not persist.", error);
      return null;
    }
  }

  function mapSpritePaths(definitions) {
    const mapped = {};
    Object.entries(definitions).forEach(([key, frames]) => {
      mapped[key] = frames.map((frame) => SPRITE_PATH + frame);
    });
    return mapped;
  }

  function openNameDialog({
    title = "Rename your pet",
    submitLabel = "Save",
    initialValue = state.name,
    onConfirm = null,
    onCancel = null
  } = {}) {
    if (!elements.renameDialog || !elements.renameInput || !elements.renameSubmit || !elements.renameTitle) {
      if (typeof onConfirm === "function") {
        onConfirm(sanitizeName(initialValue));
      }
      return;
    }

    nameDialogContext = { onConfirm, onCancel };

    elements.renameTitle.textContent = title;
    elements.renameSubmit.textContent = submitLabel;
    elements.renameInput.value = sanitizeName(initialValue);
    elements.renameDialog.classList.remove("hidden");
    elements.renameDialog.setAttribute("aria-hidden", "false");

    const activeElement = document.activeElement;
    lastFocusedElement = activeElement && typeof activeElement.focus === "function" ? activeElement : null;

    window.setTimeout(() => {
      elements.renameInput.focus();
      elements.renameInput.select();
    }, 20);

    document.addEventListener("keydown", handleDialogKeydown, true);
  }

  function closeNameDialog() {
    if (!elements.renameDialog) {
      return;
    }
    elements.renameDialog.classList.add("hidden");
    elements.renameDialog.setAttribute("aria-hidden", "true");
    document.removeEventListener("keydown", handleDialogKeydown, true);
    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      window.setTimeout(() => {
        lastFocusedElement.focus();
      }, 30);
    }
    lastFocusedElement = null;
  }

  function handleRenameSubmit(event) {
    event.preventDefault();
    if (!elements.renameInput) {
      closeNameDialog();
      return;
    }
    const context = nameDialogContext;
    const cleaned = sanitizeName(elements.renameInput.value);
    nameDialogContext = null;
    closeNameDialog();
    if (context && typeof context.onConfirm === "function") {
      context.onConfirm(cleaned);
    }
  }

  function cancelNameDialog() {
    const context = nameDialogContext;
    nameDialogContext = null;
    closeNameDialog();
    if (context && typeof context.onCancel === "function") {
      context.onCancel();
    }
  }

  function handleDialogKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelNameDialog();
    }
  }
})();
