// ---------- dust particles ----------
(function dust() {
  const field = document.getElementById("dust");
  const count = window.innerWidth < 600 ? 10 : 22;
  for (let i = 0; i < count; i++) {
    const mote = document.createElement("span");
    mote.className = "mote";
    mote.style.left = Math.random() * 100 + "vw";
    mote.style.top = 40 + Math.random() * 40 + "vh";
    mote.style.animationDuration = 8 + Math.random() * 10 + "s";
    mote.style.animationDelay = Math.random() * 10 + "s";
    field.appendChild(mote);
  }
})();

// ---------- subtle light parallax ----------
(function lightParallax() {
  const light = document.getElementById("heroLight");
  const hero = document.getElementById("hero");
  if (!light || !hero) return;
  hero.addEventListener("mousemove", (e) => {
    if (hero.classList.contains("is-open")) return;
    const x = (e.clientX / window.innerWidth - 0.5) * 24;
    const y = (e.clientY / window.innerHeight - 0.5) * 24;
    light.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  });
})();

// ---------- open the scroll ----------
(function openScroll() {
  const btn = document.getElementById("openBtn");
  const hero = document.getElementById("hero");
  const archive = document.getElementById("archive");
  if (!btn || !hero || !archive) return;

  btn.addEventListener("click", () => {
    if (hero.classList.contains("is-open")) return;
    btn.disabled = true;
    hero.classList.add("is-open");

    window.setTimeout(() => {
      archive.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 1400);
  });
})();
