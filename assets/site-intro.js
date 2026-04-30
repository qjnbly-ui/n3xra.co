(() => {
  const splash = document.querySelector("[data-entry-splash]");
  if (!splash) return;

  const key = "n3xraIntroSeen";

  function hasSeenIntro() {
    try {
      return sessionStorage.getItem(key) === "true";
    } catch {
      return false;
    }
  }

  function markIntroSeen() {
    try {
      sessionStorage.setItem(key, "true");
    } catch {
      // If sessionStorage is blocked, the splash can still run normally.
    }
  }

  if (hasSeenIntro()) {
    markIntroSeen();
    splash.classList.add("is-hidden");
    return;
  }

  markIntroSeen();
  splash.classList.add("is-active");

  window.setTimeout(() => {
    splash.classList.remove("is-active");
    splash.classList.add("is-hidden");
  }, 3400);
})();
