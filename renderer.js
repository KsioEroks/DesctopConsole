(function () {
  function init() {
    const typedText = document.getElementById("typedText");
    const closeBtn = document.getElementById("closeBtn");
    const settingsBtn = document.getElementById("settingsBtn");
    const settingsMenu = document.getElementById("settingsMenu");
    const textInput = document.getElementById("textInput");
    const speedSelect = document.getElementById("speedSelect");
    const applyBtn = document.getElementById("applyBtn");
    const commandInput = document.getElementById("commandInput");
    const sendBtn = document.getElementById("sendBtn");
    const statusLine = document.getElementById("statusLine");
    const spriteImage = document.getElementById("spriteImage");
    const desktopShell = document.getElementById("desktopShell");
    const spriteNameInput = document.getElementById("spriteNameInput");
    const showSpriteCheckbox = document.getElementById("showSpriteCheckbox");

    const sprites = {
      normal: "assets/sprites/normal.png",
      blinkHalf: "assets/sprites/blink-half.png",
      blink: "assets/sprites/blink.png",
      sad: "assets/sprites/sad.png",
      happy: "assets/sprites/happy.png"
    };

    let spriteAnimating = false;

    function setSprite(state) {
      spriteImage.src = sprites[state];
    }

    function randomBetween(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function playBlink() {
      if (spriteAnimating) {
        setTimeout(playBlink, 1500);
        return;
      }

      spriteAnimating = true;

      setSprite("normal");

      setTimeout(() => setSprite("blinkHalf"), 200);
      setTimeout(() => setSprite("blink"), 400);
      setTimeout(() => setSprite("blinkHalf"), 700);
      setTimeout(() => {
        setSprite("normal");
        spriteAnimating = false;
      }, 1000);
    }

    function playHappy() {
      if (spriteAnimating) {
        setTimeout(playHappy, 2000);
        return;
      }

      spriteAnimating = true;

      setSprite("happy");

      setTimeout(() => {
        setSprite("normal");
        spriteAnimating = false;
      }, 4000);
    }

    function scheduleBlinkCycle() {
      const cycleLength = 90 * 1000;

      const firstBlink = randomBetween(5000, 45000);
      const secondBlink = randomBetween(firstBlink + 30000, 85000);

      setTimeout(playBlink, firstBlink);
      setTimeout(playBlink, secondBlink);

      setTimeout(scheduleBlinkCycle, cycleLength);
    }

    function scheduleHappyCycle() {
      const cycleLength = 5 * 60 * 1000;
      const happyTime = randomBetween(15000, cycleLength - 15000);

      setTimeout(playHappy, happyTime);
      setTimeout(scheduleHappyCycle, cycleLength);
    }

    let text = localStorage.getItem("consoleText") || "Welcome back, Ksio";
    let speed = Number(localStorage.getItem("typingSpeed")) || 90;
    let spriteName = localStorage.getItem("spriteName") || "Ksio";
    let showSprite = localStorage.getItem("showSprite") !== "false";

    let index = 0;
    let typingTimer = null;

    textInput.value = text;
    speedSelect.value = String(speed);
    spriteNameInput.value = spriteName;
    showSpriteCheckbox.checked = showSprite;

    function updateSpriteVisibility() {
      desktopShell.classList.toggle("sprite-hidden", !showSprite);
    }

    updateSpriteVisibility();

    setSprite("normal");
    scheduleBlinkCycle();
    scheduleHappyCycle();

    function typeText() {
      clearTimeout(typingTimer);
      typedText.textContent = "";
      index = 0;

      function typeNextLetter() {
        if (index < text.length) {
          typedText.textContent += text[index];
          index += 1;
          typingTimer = setTimeout(typeNextLetter, speed);
        }
      }

      typeNextLetter();
    }

    settingsBtn.addEventListener("click", () => {
      settingsMenu.classList.toggle("hidden");
    });

    applyBtn.addEventListener("click", () => {
      text = textInput.value || "Welcome back, Ksio";
      speed = Number(speedSelect.value);
      spriteName = spriteNameInput.value || "Ksio";
      showSprite = showSpriteCheckbox.checked;

      localStorage.setItem("consoleText", text);
      localStorage.setItem("typingSpeed", String(speed));
      localStorage.setItem("spriteName", spriteName);
      localStorage.setItem("showSprite", String(showSprite));

      updateSpriteVisibility();

      settingsMenu.classList.add("hidden");
      typeText();
    });

    closeBtn.addEventListener("click", () => {
      window.close();
    });

    async function sendCommand() {
      const command = commandInput.value.trim();

      if (!command) {
        return;
      }

      statusLine.textContent = "Поиск...";
      commandInput.value = "";

      const result = await window.desktopConsole.openProgram(command);

      if (result.ok) {
        statusLine.textContent = "Открываю: " + result.name;
      } else {
        statusLine.textContent = result.message || "Не распознано";
      }
    }

    sendBtn.addEventListener("click", sendCommand);

    commandInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        sendCommand();
      }
    });

    setTimeout(typeText, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
