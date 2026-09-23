/* ===========================================================
   UNLOCKING THE SCROLLS — 3D chamber scene
   Vanilla Three.js (r128, global THREE, no build step).
   Sections:
     1. Setup & constants
     2. Procedural textures (stone / parchment / seal)
     3. Scene objects (chamber, table, scroll, dust, lights)
     4. Camera intro + pointer parallax
     5. Unseal interaction
     6. Render loop & resize
=========================================================== */

(function () {
  "use strict";

  var REDUCED_MOTION = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var canvas   = document.getElementById("scene");
  var loader   = document.getElementById("loader");
  var ctaWrap  = document.getElementById("ctaWrap");
  var unsealBtn = document.getElementById("unsealBtn");
  var archiveTitle = document.querySelector(".archive-title");

  if (typeof THREE === "undefined") {
    // Three.js failed to load (offline/CDN blocked) — fail gracefully.
    if (loader) loader.querySelector(".loader-text").textContent = "unable to load the chamber";
    if (ctaWrap) ctaWrap.classList.add("visible");
    return;
  }

  /* ---------------- 1. setup ---------------- */
  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0908, 0.045);

  var camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
  var START_POS  = new THREE.Vector3(0, 3.4, 26);
  var FINAL_POS  = new THREE.Vector3(0, 1.7, 8.6);
  var LOOK_TARGET = new THREE.Vector3(0, 1.05, 0);
  camera.position.copy(REDUCED_MOTION ? FINAL_POS : START_POS);
  camera.lookAt(LOOK_TARGET);

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;

  /* ---------------- 2. procedural textures ---------------- */

  function noiseCanvas(w, h, base, spots, alpha) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var ctx = c.getContext("2d");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < spots; i++) {
      var x = Math.random() * w, y = Math.random() * h;
      var r = 4 + Math.random() * (w * 0.04);
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      var shade = Math.random() > 0.5 ? "0,0,0" : "255,255,255";
      g.addColorStop(0, "rgba(" + shade + "," + alpha + ")");
      g.addColorStop(1, "rgba(" + shade + ",0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    return c;
  }

  function stoneTexture() {
    var c = noiseCanvas(512, 512, "#1c1712", 900, 0.14);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 3);
    return t;
  }

  function parchmentTexture() {
    var w = 1024, h = 512;
    var c = noiseCanvas(w, h, "#dcc48c", 260, 0.06);
    var ctx = c.getContext("2d");

    // warm stains
    for (var i = 0; i < 5; i++) {
      var x = Math.random() * w, y = Math.random() * h, r = 60 + Math.random() * 120;
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(120,86,42,0.18)");
      g.addColorStop(1, "rgba(120,86,42,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }

    // lettering, pressed into the material rather than floating on it
    ctx.fillStyle = "rgba(58,38,18,0.82)";
    ctx.textAlign = "center";
    ctx.font = "600 78px Georgia, 'Iowan Old Style', serif";
    ctx.fillText("UNLOCKING", w / 2, h * 0.42);
    ctx.fillText("THE SCROLLS", w / 2, h * 0.58);

    ctx.font = "14px 'Courier New', monospace";
    ctx.fillStyle = "rgba(58,38,18,0.55)";
    ctx.save();
    ctx.translate(w / 2, h * 0.72);
    var words = "SEARCH \u00B7 CONTEXT \u00B7 REVELATION \u00B7 OBSERVATION \u00B7 LANGUAGE";
    ctx.fillText(words.split("").join("\u200A"), 0, 0);
    ctx.restore();

    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }

  function sealTexture() {
    // an original mark: a small flame within a radiating disc — not a cross.
    var s = 256;
    var c = document.createElement("canvas");
    c.width = c.height = s;
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#3a1414";
    ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2 - 4, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = "rgba(200,160,90,0.65)";
    ctx.lineWidth = 2;
    for (var i = 0; i < 18; i++) {
      var a = (i / 18) * Math.PI * 2;
      var r1 = s * 0.34, r2 = s * 0.46;
      ctx.beginPath();
      ctx.moveTo(s / 2 + Math.cos(a) * r1, s / 2 + Math.sin(a) * r1);
      ctx.lineTo(s / 2 + Math.cos(a) * r2, s / 2 + Math.sin(a) * r2);
      ctx.stroke();
    }

    ctx.fillStyle = "#e8c98a";
    ctx.beginPath();
    ctx.moveTo(s / 2, s * 0.30);
    ctx.bezierCurveTo(s * 0.62, s * 0.46, s * 0.58, s * 0.62, s / 2, s * 0.72);
    ctx.bezierCurveTo(s * 0.42, s * 0.62, s * 0.38, s * 0.46, s / 2, s * 0.30);
    ctx.fill();

    var t = new THREE.CanvasTexture(c);
    return t;
  }

  /* ---------------- 3. scene objects ---------------- */

  // chamber — an inward-facing box so the room reads as stone on all sides
  var chamberMat = new THREE.MeshStandardMaterial({ map: stoneTexture(), color: 0x35291c, roughness: 1, side: THREE.BackSide });
  var chamber = new THREE.Mesh(new THREE.BoxGeometry(30, 16, 40), chamberMat);
  chamber.position.set(0, 6, -6);
  scene.add(chamber);

  // table
  var table = new THREE.Mesh(
    new THREE.BoxGeometry(7.5, 1, 4),
    new THREE.MeshStandardMaterial({ color: 0x1c140d, roughness: 0.9 })
  );
  table.position.set(0, 0.1, 0);
  scene.add(table);

  // scroll group
  var scrollGroup = new THREE.Group();
  scrollGroup.position.set(0, 0.95, 0);
  scene.add(scrollGroup);

  var rollerMat = new THREE.MeshStandardMaterial({ color: 0x2c1d10, roughness: 0.7 });
  var leftRoller = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 3.4, 20), rollerMat);
  leftRoller.rotation.z = Math.PI / 2;
  leftRoller.position.x = -2.15;
  scrollGroup.add(leftRoller);

  var rightRoller = leftRoller.clone();
  rightRoller.position.x = 2.15;
  scrollGroup.add(rightRoller);

  // parchment — a bent plane; buildParchmentGeometry(curl) rebuilds vertices
  // curl:1 = tightly rolled edges (closed), curl:0 = flat (open)
  var PW = 4.1, PH = 2.15, SEG_X = 40, SEG_Y = 1;
  function buildParchmentGeometry(curl) {
    var geo = new THREE.PlaneGeometry(PW, PH, SEG_X, SEG_Y);
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i);
      var edge = Math.min(1, Math.abs(x) / (PW * 0.5));       // 0 center -> 1 at edges
      var bend = Math.pow(edge, 3) * curl;                    // stronger bend near edges
      var z = Math.sin(bend * Math.PI) * 0.55;
      var xOffset = (x > 0 ? -1 : 1) * (1 - Math.cos(bend * Math.PI)) * 0.35;
      pos.setZ(i, z);
      pos.setX(i, x + xOffset);
    }
    geo.computeVertexNormals();
    return geo;
  }
  var parchmentMat = new THREE.MeshStandardMaterial({
    map: parchmentTexture(), roughness: 0.85, side: THREE.DoubleSide
  });
  var parchment = new THREE.Mesh(buildParchmentGeometry(1), parchmentMat);
  scrollGroup.add(parchment);

  // seal — small disc sitting on the closed parchment
  var seal = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 32),
    new THREE.MeshStandardMaterial({ map: sealTexture(), roughness: 0.6, transparent: true })
  );
  seal.position.set(0, 0, 0.42);
  scrollGroup.add(seal);

  // dust
  var DUST_COUNT = 260;
  var dustGeo = new THREE.BufferGeometry();
  var dustPos = new Float32Array(DUST_COUNT * 3);
  for (var d = 0; d < DUST_COUNT; d++) {
    dustPos[d * 3]     = (Math.random() - 0.5) * 14;
    dustPos[d * 3 + 1] = Math.random() * 7;
    dustPos[d * 3 + 2] = (Math.random() - 0.5) * 18;
  }
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  var dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0xcbb27a, size: 0.02, transparent: true, opacity: 0.35, depthWrite: false
  }));
  scene.add(dust);

  // lighting
  var ambient = new THREE.AmbientLight(0x2a2015, 0.55);
  scene.add(ambient);

  var spot = new THREE.SpotLight(0xf3d8a1, REDUCED_MOTION ? 6 : 0, 22, Math.PI / 7, 0.5, 1.2);
  spot.position.set(2, 7, 4);
  spot.target = scrollGroup;
  scene.add(spot);

  var fill = new THREE.PointLight(0x6a4a26, 0.4, 14);
  fill.position.set(-3, 2, 3);
  scene.add(fill);

  /* ---------------- 4. camera intro + parallax ---------------- */
  var clock = new THREE.Clock();
  var introDone = REDUCED_MOTION;
  var introDuration = 4.6;

  var pointer = { x: 0, y: 0 };
  var pointerEased = { x: 0, y: 0 };
  window.addEventListener("mousemove", function (e) {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  });
  window.addEventListener("touchmove", function (e) {
    if (!e.touches[0]) return;
    pointer.x = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.touches[0].clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function revealCTA() {
    ctaWrap.classList.add("visible");
  }

  /* ---------------- 5. unseal interaction ---------------- */
  var unsealed = false;
  var unsealStart = null;
  var UNSEAL_DURATION = REDUCED_MOTION ? 0.5 : 2.2;
  var camAtUnseal = new THREE.Vector3();
  var camUnsealTarget = new THREE.Vector3(0, 1.4, 4.8);

  unsealBtn.addEventListener("click", function () {
    if (unsealed) return;
    unsealed = true;
    unsealBtn.setAttribute("aria-expanded", "true");
    ctaWrap.classList.add("hidden");
    camAtUnseal.copy(camera.position);
    unsealStart = clock.getElapsedTime();
  });

  function runUnseal(elapsed) {
    var t = Math.min(1, (elapsed - unsealStart) / UNSEAL_DURATION);
    var e = easeOutCubic(t);

    // seal breaks away
    seal.material.opacity = 1 - Math.min(1, t * 2.2);
    seal.scale.setScalar(1 - e * 0.6);
    seal.position.y = e * 0.4;

    // rollers turn and part
    leftRoller.position.x = -2.15 - e * 1.5;
    rightRoller.position.x = 2.15 + e * 1.5;
    leftRoller.rotation.x += (REDUCED_MOTION ? 0 : 0.09);
    rightRoller.rotation.x -= (REDUCED_MOTION ? 0 : 0.09);

    // parchment unrolls
    var curl = 1 - e;
    parchment.geometry.dispose();
    parchment.geometry = buildParchmentGeometry(curl);
    parchment.scale.x = 1 + e * 0.35;

    // camera pushes in
    camera.position.lerpVectors(camAtUnseal, camUnsealTarget, e);
    camera.lookAt(LOOK_TARGET);

    // light warms as the scroll opens
    spot.intensity = 6 + e * 3;

    if (t >= 1) {
      unsealStart = null;
      window.setTimeout(function () {
        if (archiveTitle) { archiveTitle.setAttribute("tabindex", "-1"); archiveTitle.focus(); }
        document.getElementById("archive").scrollIntoView({ behavior: REDUCED_MOTION ? "auto" : "smooth" });
      }, 250);
    }
  }

  /* ---------------- 6. render loop & resize ---------------- */
  function animate() {
    requestAnimationFrame(animate);
    var elapsed = clock.getElapsedTime();

    if (!introDone) {
      var t = Math.min(1, elapsed / introDuration);
      var e = easeOutCubic(t);
      camera.position.lerpVectors(START_POS, FINAL_POS, e);
      camera.lookAt(LOOK_TARGET);
      spot.intensity = e * 6;
      if (t >= 1) { introDone = true; revealCTA(); }
    } else if (unsealStart !== null) {
      runUnseal(elapsed);
    } else if (!unsealed) {
      // idle parallax once framed
      pointerEased.x += (pointer.x - pointerEased.x) * 0.04;
      pointerEased.y += (pointer.y - pointerEased.y) * 0.04;
      camera.position.x = FINAL_POS.x + pointerEased.x * 0.6;
      camera.position.y = FINAL_POS.y - pointerEased.y * 0.3;
      camera.lookAt(LOOK_TARGET);
    }

    if (!REDUCED_MOTION) {
      dust.rotation.y = elapsed * 0.01;
      dust.position.y = Math.sin(elapsed * 0.15) * 0.15;
    }

    renderer.render(scene, camera);
  }

  window.addEventListener("resize", function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // reveal the scene, then start
  window.setTimeout(function () {
    loader.classList.add("hide");
    if (REDUCED_MOTION) revealCTA();
  }, 500);

  animate();
})();
