const { invoke } = window.__TAURI__.core;
const $ = (selector) => document.querySelector(selector);
const tabs = ["games", "media", "settings"];
const selectionSound = new Audio("/assets/audio/navigation.wav");
const launchSound = new Audio("/assets/audio/activation.wav");

let library;
let selectedIndex = 0;
let activeTab = "games";
let lastMove = 0;
let lastButtons = new Map();
let axisWasPressed = false;
let activeBackground = 0;
let backgroundRevision = 0;
let lastPoll = 0;
let lastControllerId = "";
let onboardingActive = false;
let onboardingStep = 0;
let onboardingIntroTimer = 0;
let controllerConnected = false;

function changeBackground(source) {
  const layers = [$("#hero-background"), $("#hero-background-next")];
  const previous = activeBackground;
  if (layers[previous].dataset.source === source) return;
  const next = 1 - previous;
  const revision = ++backgroundRevision;
  layers[next].style.backgroundImage = source ? `url("${source}")` : "";
  layers[next].dataset.source = source;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (revision !== backgroundRevision) return;
    layers[next].classList.add("visible");
    layers[previous].classList.remove("visible");
  }));
  activeBackground = next;
}

function showError(message) {
  const output = $("#status");
  output.textContent = message;
  output.classList.add("error");
}

function clearError() {
  const output = $("#status");
  output.textContent = "";
  output.classList.remove("error");
}

function playSound(audio) {
  audio.currentTime = 0;
  audio.play().catch((error) => console.warn("Dashboard sound could not play:", error));
}

function currentGame() {
  return library?.games[selectedIndex];
}

function setTab(tab) {
  if (!tabs.includes(tab)) return;
  activeTab = tab;
  for (const button of document.querySelectorAll("[data-tab]")) {
    button.classList.toggle("active", button.dataset.tab === tab);
    button.setAttribute("aria-selected", button.dataset.tab === tab);
  }
  $("#games-view").hidden = tab !== "games";
  $("#media-view").hidden = tab !== "media";
  $("#settings-view").hidden = tab !== "settings";
  clearError();
  if (tab === "settings") renderSettings();
  if (tab === "games") renderGames();
}

function moveSelection(direction) {
  if (activeTab !== "games" || !library.games.length) return;
  selectedIndex = (selectedIndex + direction + library.games.length) % library.games.length;
  playSound(selectionSound);
  renderGames();
}

function renderGames() {
  const game = currentGame();
  const strip = $("#game-strip");
  strip.replaceChildren();

  if (!game) {
    $("#game-title").textContent = "Add games in Settings";
    $("#game-path").textContent = "No games in your library yet.";
    changeBackground("");
    $("#play-button").disabled = true;
    return;
  }

  $("#play-button").disabled = false;
  $("#game-title").textContent = game.title;
  $("#game-path").textContent = game.gamePath;
  changeBackground(game.banner || "/assets/Images/PS5/Background/PS5Background1.jpg");
  const logo = $("#game-logo");
  logo.hidden = !game.logo;
  if (game.logo) logo.src = game.logo;
  else logo.removeAttribute("src");

  library.games.forEach((item, index) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = `game-tile${index === selectedIndex ? " selected" : ""}`;
    tile.setAttribute("aria-label", item.title);
    tile.setAttribute("aria-pressed", index === selectedIndex);
    tile.style.backgroundImage = `url("${item.cover || "/assets/Images/PS5/Background/PS5Library.jpg"}")`;
    tile.addEventListener("click", () => {
      selectedIndex = index;
      playSound(selectionSound);
      renderGames();
    });
    tile.addEventListener("dblclick", launchSelectedGame);
    strip.append(tile);
  });
}

function renderSettings() {
  $("#emulator-path").value = library.emulatorPath;
  $("#launch-args").value = library.launchArgs.join("\n");
  const list = $("#library-list");
  list.replaceChildren();

  for (const [index, game] of library.games.entries()) {
    const row = document.createElement("div");
    row.className = "library-row";
    const details = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = game.title;
    const path = document.createElement("small");
    path.textContent = game.gamePath;
    details.append(title, path);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "quiet-button";
    remove.textContent = "Remove";
    remove.addEventListener("click", async () => {
      library.games.splice(index, 1);
      selectedIndex = Math.min(selectedIndex, library.games.length - 1);
      await saveLibrary();
    });
    row.append(details, remove);
    list.append(row);
  }
}

function updateOnboardingController() {
  if (!onboardingActive) return;
  $("#onboarding-controller").textContent = controllerConnected
    ? `${lastControllerId.slice(0, 48)} · CONNECTED`
    : "Connect a controller or continue with your keyboard";
}

function renderOnboardingStep() {
  const steps = [
    ["LANGUAGE", "Choose your language", "Select the language used by this version of the launcher."],
    ["CONTROLLER", "Connect your controller", "Connect a controller now, or continue with your keyboard and connect one later."],
    ["EMULATOR", "Set up Kyty", "Confirm where Kyty is installed. You can update this path at any time."],
    ["READY", "You're all set", "Your local game launcher is ready to use."],
  ];
  const [kicker, title, description] = steps[onboardingStep];
  $("#setup-kicker").textContent = kicker;
  $("#setup-title").textContent = title;
  $("#setup-description").textContent = description;
  $("#setup-step-count").textContent = `STEP ${onboardingStep + 1} OF ${steps.length}`;
  $("#setup-progress-fill").style.width = `${((onboardingStep + 1) / steps.length) * 100}%`;
  $("#setup-back").disabled = onboardingStep === 0;
  $("#setup-next").textContent = onboardingStep === steps.length - 1 ? "Finish setup" : "Continue";

  for (const panel of document.querySelectorAll("[data-setup-panel]")) {
    panel.hidden = panel.dataset.setupPanel !== ["language", "controller", "kyty", "ready"][onboardingStep];
  }
  $("#onboarding-status").textContent = "";
  if (onboardingStep === 1) updateOnboardingController();
  if (onboardingStep === 3) {
    const count = library.games.length;
    $("#setup-summary").textContent = `${count} ${count === 1 ? "game is" : "games are"} in your library. Add or edit games later in Settings.`;
  }
}

function showOnboardingSteps() {
  clearTimeout(onboardingIntroTimer);
  $("#boot-splash").hidden = true;
  $("#setup-flow").hidden = false;
  renderOnboardingStep();
  $("#setup-next").focus();
}

function startOnboarding() {
  onboardingActive = true;
  onboardingStep = 0;
  $("#onboarding").hidden = false;
  $("#boot-splash").hidden = false;
  $("#setup-flow").hidden = true;
  $("#onboarding-emulator-path").value = library.emulatorPath;
  onboardingIntroTimer = setTimeout(showOnboardingSteps, 2400);
}

function previousOnboardingStep() {
  if (!onboardingActive || $("#setup-flow").hidden || onboardingStep === 0) return;
  onboardingStep -= 1;
  renderOnboardingStep();
  $("#setup-next").focus();
}

async function nextOnboardingStep() {
  if (!onboardingActive) return;
  if ($("#setup-flow").hidden) {
    showOnboardingSteps();
    return;
  }
  if (onboardingStep === 2 && !$("#onboarding-emulator-path").value.trim()) {
    $("#onboarding-status").textContent = "Enter a path to the Kyty executable to continue.";
    return;
  }
  if (onboardingStep < 3) {
    onboardingStep += 1;
    renderOnboardingStep();
    $("#setup-next").focus();
    return;
  }

  const button = $("#setup-next");
  button.disabled = true;
  library.emulatorPath = $("#onboarding-emulator-path").value.trim();
  library.setupComplete = true;
  try {
    await invoke("save_library", { library });
    onboardingActive = false;
    $("#onboarding").hidden = true;
  } catch (error) {
    library.setupComplete = false;
    $("#onboarding-status").textContent = `Could not save setup: ${error}`;
  } finally {
    button.disabled = false;
  }
}

function handleOnboardingButton(index, pressed, wasPressed) {
  if (!onboardingActive) return false;
  if (index >= 12 && index <= 15) {
    if (pressed && !wasPressed) {
      if (index === 12 || index === 14) previousOnboardingStep();
      else nextOnboardingStep();
    }
    return true;
  }
  if (!pressed || wasPressed) return true;
  if (index === 0 || index === 5 || index === 9) nextOnboardingStep();
  else if (index === 1 || index === 4) previousOnboardingStep();
  return true;
}

async function saveLibrary() {
  try {
    library.emulatorPath = $("#emulator-path").value.trim();
    library.launchArgs = $("#launch-args").value
      .split(/\r?\n/)
      .map((argument) => argument.trim())
      .filter(Boolean);
    await invoke("save_library", { library });
    clearError();
    renderGames();
    renderSettings();
  } catch (error) {
    showError(`Could not save library: ${error}`);
  }
}

async function encodeArtwork(file, width, height, crop = true, type = "image/jpeg") {
  if (!file) return "";
  if (!file.type.startsWith("image/")) throw new Error("Artwork must be an image.");
  if (file.size > 20 * 1024 * 1024) throw new Error("Artwork must be 20 MB or smaller.");

  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare image artwork.");

    const scale = (crop ? Math.max : Math.min)(width / bitmap.width, height / bitmap.height);
    const scaledWidth = bitmap.width * scale;
    const scaledHeight = bitmap.height * scale;
    if (type === "image/jpeg") {
      context.fillStyle = "#14181e";
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(
      bitmap,
      (width - scaledWidth) / 2,
      (height - scaledHeight) / 2,
      scaledWidth,
      scaledHeight,
    );
    return canvas.toDataURL(type, type === "image/jpeg" ? 0.82 : undefined);
  } finally {
    bitmap.close();
  }
}

async function addGame(event) {
  event.preventDefault();
  const title = $("#new-game-title").value.trim();
  const gamePath = $("#new-game-path").value.trim();
  if (!title || !gamePath) {
    showError("Enter both a game title and its Kyty game path.");
    return;
  }

  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (library.games.some((game) => game.id === id)) {
    showError("A game with that title is already in the library.");
    return;
  }

  try {
    library.games.push({
      id: id || `game-${Date.now()}`,
      title,
      gamePath,
      cover: await encodeArtwork($("#new-game-cover").files[0], 600, 850),
      banner: await encodeArtwork($("#new-game-banner").files[0], 1920, 1080),
      logo: await encodeArtwork($("#new-game-logo").files[0], 900, 260, false, "image/png"),
      launchType: "kyty",
    });
    $("#add-game-form").reset();
    await saveLibrary();
  } catch (error) {
    showError(`Could not add game artwork: ${error}`);
  }
}

async function launchSelectedGame() {
  const game = currentGame();
  if (!game) return;
  clearError();
  playSound(launchSound);
  $("#status").textContent = `Launching ${game.title}…`;
  try {
    $("#status").textContent = await invoke("launch_game", { gameId: game.id });
  } catch (error) {
    showError(`Could not launch ${game.title}: ${error}`);
  }
}

function changeTab(direction) {
  const target = activeTab === "settings"
    ? (direction > 0 ? "games" : "media")
    : activeTab === "games"
      ? "media"
      : "games";
  setTab(target);
}

function onGamepadButton(index, pressed) {
  const wasPressed = lastButtons.get(index) || false;
  lastButtons.set(index, pressed);
  const now = performance.now();

  if (handleOnboardingButton(index, pressed, wasPressed)) return;
  if (index >= 12 && index <= 15) {
    if (pressed && (!wasPressed || now - lastMove >= 150)) {
      if (now - lastMove >= 150 || !lastMove) {
        if (index === 14) moveSelection(-1);
        else if (index === 15) moveSelection(1);
        else if (index === 12) moveSelection(-1);
        else if (index === 13) moveSelection(1);
        lastMove = now;
      }
    }
    return;
  }
  if (!pressed || wasPressed) return;

  if (index === 0 && activeTab === "games") launchSelectedGame();
  else if (index === 1 && activeTab !== "games") setTab("games");
  else if (index === 4) changeTab(-1);
  else if (index === 5) changeTab(1);
  else if (index === 9) setTab(activeTab === "settings" ? "games" : "settings");
}

function pollGamepads() {
  const now = performance.now();
  if (now - lastPoll < 1000 / 60) {
    requestAnimationFrame(pollGamepads);
    return;
  }
  lastPoll = now;
  const pads = navigator.getGamepads?.() || [];
  const controller = Array.from(pads).find((pad) => pad?.connected);
  const controllerId = controller?.id || "";
  if (controllerId !== lastControllerId) {
    controllerConnected = Boolean(controllerId);
    $("#controller-status").textContent = controllerId
      ? `${controllerId.slice(0, 40)} · CONNECTED`
      : "CONNECT CONTROLLER";
    lastControllerId = controllerId;
    updateOnboardingController();
  }
  for (const pad of pads) {
    if (!pad?.connected) continue;
    for (let index = 0; index < pad.buttons.length; index += 1) {
      onGamepadButton(index, pad.buttons[index].pressed);
    }

    const left = pad.axes[0] || 0;
    const vertical = pad.axes[1] || 0;
    const now = performance.now();
    const axisPressed = Math.abs(left) > 0.65 || Math.abs(vertical) > 0.65;
    if (axisPressed && (!axisWasPressed || now - lastMove >= 150)) {
      if (onboardingActive) {
        const direction = Math.abs(left) > Math.abs(vertical) ? left : vertical;
        if (direction > 0) nextOnboardingStep();
        else previousOnboardingStep();
      } else if (Math.abs(left) > Math.abs(vertical)) moveSelection(left > 0 ? 1 : -1);
      else if (activeTab === "games") moveSelection(vertical > 0 ? 1 : -1);
      lastMove = now;
    }
    axisWasPressed = axisPressed;

    for (let index = 12; index <= 15; index += 1) {
      onGamepadButton(index, pad.buttons[index]?.pressed || false);
    }
  }
  requestAnimationFrame(pollGamepads);
}

function updateClock() {
  $("#clock").textContent = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

window.addEventListener("DOMContentLoaded", async () => {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.tab));
  });
  $("#play-button").addEventListener("click", launchSelectedGame);
  $("#save-settings").addEventListener("click", saveLibrary);
  $("#add-game-form").addEventListener("submit", addGame);
  $("#back-button").addEventListener("click", () => setTab("games"));
  $("#media-back").addEventListener("click", () => setTab("games"));
  $("#start-setup").addEventListener("click", showOnboardingSteps);
  $("#setup-back").addEventListener("click", previousOnboardingStep);
  $("#setup-next").addEventListener("click", nextOnboardingStep);

  window.addEventListener("keydown", (event) => {
    if (onboardingActive) {
      if (event.key === "Enter") {
        event.preventDefault();
        nextOnboardingStep();
      } else if (event.key === "Escape" || event.key === "ArrowLeft") {
        if (event.key === "ArrowLeft" && event.target instanceof HTMLInputElement) return;
        event.preventDefault();
        previousOnboardingStep();
      } else if (event.key === "ArrowRight") {
        if (event.target instanceof HTMLInputElement) return;
        event.preventDefault();
        nextOnboardingStep();
      }
      return;
    }
    if (event.key === "ArrowRight") moveSelection(1);
    else if (event.key === "ArrowLeft") moveSelection(-1);
    else if (event.key === "Enter" && activeTab === "games") launchSelectedGame();
    else if (event.key === "Escape") setTab("games");
  });

  try {
    library = await invoke("load_library");
    selectedIndex = Math.max(0, Math.min(selectedIndex, library.games.length - 1));
    renderGames();
    if (!library.setupComplete) startOnboarding();
  } catch (error) {
    showError(`Could not load library: ${error}`);
  }

  updateClock();
  setInterval(updateClock, 30_000);
  requestAnimationFrame(pollGamepads);
});
