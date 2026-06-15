// Storage Keys
const votedStorageKey = "campusverite:voted";
const reportedStorageKey = "campusverite:reported";

/* ==========================================================================
   HELPER FUNCTIONS & LOCAL STORAGE
   ========================================================================== */
function readStoredIds(key) {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
  } catch {
    return new Set();
  }
}

function writeStoredIds(key, ids) {
  localStorage.setItem(key, JSON.stringify([...ids]));
}

// Custom Toast System
function showToast(message, type = "success") {
  let toast = document.querySelector("[data-toast]");

  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.dataset.toast = "";
    document.body.appendChild(toast);
  }

  // Set icon based on type
  let icon = '<i class="lucide-check-circle color-suggestion"></i>';
  if (type === "error") {
    icon = '<i class="lucide-alert-circle color-rant"></i>';
  } else if (type === "info") {
    icon = '<i class="lucide-info color-blue"></i>';
  }

  toast.innerHTML = `${icon} <span>${message}</span>`;
  toast.classList.add("is-visible");
  
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 3000);
}

// Utility to hash string to simple stable numbers (for stable coordinates)
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

/* ==========================================================================
   CONFETA CREATION (Wow factor)
   ========================================================================== */
function triggerConfettiBurst() {
  if (typeof confetti === "function") {
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.75 },
      colors: ["#05b19b", "#3b82f6", "#fbbf24", "#f43f5e", "#8b5cf6"]
    });
  }
}

function triggerSuccessConfetti() {
  if (typeof confetti === "function") {
    const duration = 2 * 1000;
    const end = Date.now() + duration;

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ["#05b19b", "#3b82f6"]
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ["#f43f5e", "#fbbf24"]
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  }
}

/* ==========================================================================
   THEME SWITCHING (Dark / Light)
   ========================================================================== */
function initTheme() {
  const toggleBtn = document.getElementById("theme-toggle");
  if (!toggleBtn) return;

  const currentTheme = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", currentTheme);
  updateThemeColorMeta(currentTheme);

  toggleBtn.addEventListener("click", () => {
    const theme = document.documentElement.getAttribute("data-theme");
    const nextTheme = theme === "dark" ? "light" : "dark";
    
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("theme", nextTheme);
    updateThemeColorMeta(nextTheme);
    
    // Refresh chart colors if chart exists
    if (window.tensionChart) {
      updateChartTheme(window.tensionChart, nextTheme);
    }
  });
}

function updateThemeColorMeta(theme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === "dark" ? "#080b11" : "#f3f4f6");
  }
}

/* ==========================================================================
   DYNAMIC SONAR RADAR CANVAS (Expert Visuals)
   ========================================================================== */
function initSonarRadar() {
  const canvas = document.getElementById("radar-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const cx = width / 2;
  const cy = height / 2;
  const radius = cx - 15;

  // Extract categories from HTML DOM data attributes
  const heatItems = document.querySelectorAll(".heat-item");
  const points = Array.from(heatItems).map((item) => {
    const slug = item.dataset.categorySlug;
    const name = item.dataset.categoryName;
    const score = parseFloat(item.dataset.categoryScore || 0);
    
    // Stable stable pseudo-random polar coordinates using string hash
    const seed = hashCode(slug);
    const angleOffset = (seed % 360) * (Math.PI / 180);
    const distFactor = 0.3 + (seed % 5) * 0.12; // stable distance between 30% and 90% of radius
    
    // Color mapping
    let color = "#05b19b"; // calm
    let pulseColor = "rgba(5, 177, 155, 0.4)";
    if (score >= 12) {
      color = "#f43f5e"; // critical
      pulseColor = "rgba(244, 63, 94, 0.4)";
    } else if (score >= 5) {
      color = "#fbbf24"; // watch
      pulseColor = "rgba(251, 191, 36, 0.4)";
    }

    return {
      slug,
      name,
      score,
      angle: angleOffset,
      distance: radius * distFactor,
      x: cx + radius * distFactor * Math.cos(angleOffset),
      y: cy + radius * distFactor * Math.sin(angleOffset),
      color,
      pulseColor,
      intensity: 0.1, // Sweep hit intensity
      size: 5 + Math.min(score / 3, 5) // Size proportional to score
    };
  });

  let sweepAngle = 0;
  let hoveredPoint = null;

  // Track Mouse Move
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * width;
    const my = ((e.clientY - rect.top) / rect.height) * height;

    let found = null;
    for (const p of points) {
      const dist = Math.hypot(p.x - mx, p.y - my);
      if (dist < p.size + 8) {
        found = p;
        break;
      }
    }
    
    if (found !== hoveredPoint) {
      hoveredPoint = found;
      canvas.style.cursor = found ? "pointer" : "default";
    }
  });

  // Radar Animation Loop
  function drawRadar() {
    ctx.clearRect(0, 0, width, height);

    const isDark = document.documentElement.getAttribute("data-theme") !== "light";
    const gridColor = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.06)";
    const sweepGradientColor = isDark ? "rgba(5, 177, 155," : "rgba(13, 148, 136,";

    // 1. Draw Radar Grid
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;

    // Rings
    for (let r = radius / 3; r <= radius; r += radius / 3) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(cx - radius, cy); ctx.lineTo(cx + radius, cy);
    ctx.moveTo(cx, cy - radius); ctx.lineTo(cx, cy + radius);
    ctx.stroke();

    // 2. Draw Sweep line (rotating radar sonar arm)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sweepAngle);
    
    // Draw sweep gradient fan
    const sweepSegments = 60;
    for (let i = 0; i < sweepSegments; i++) {
      const alpha = (i / sweepSegments) * 0.18;
      ctx.fillStyle = `${sweepGradientColor}${alpha})`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, -(i + 1) * 0.015, -i * 0.015);
      ctx.closePath();
      ctx.fill();
    }
    
    // Sweep line edge
    ctx.strokeStyle = isDark ? "rgba(5, 177, 155, 0.6)" : "rgba(13, 148, 136, 0.7)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(radius, 0);
    ctx.stroke();

    ctx.restore();

    // 3. Draw Points (Blips)
    points.forEach((p) => {
      // Check if sweep line matches the angle of the point
      const relativeSweep = sweepAngle % (Math.PI * 2);
      const angleDiff = Math.abs(relativeSweep - p.angle);
      
      // If the sweep arm is passing, light up the blip
      if (angleDiff < 0.08 || angleDiff > Math.PI * 2 - 0.08) {
        p.intensity = 1.0;
      } else {
        // Slow decay
        p.intensity = Math.max(0.15, p.intensity - 0.005);
      }

      ctx.save();
      
      // Pulse ring for higher tension categories
      if (p.score >= 5) {
        const pulseFactor = 1 + 0.3 * Math.sin(Date.now() * 0.005 + p.angle * 10);
        ctx.strokeStyle = p.pulseColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * pulseFactor, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw blip dot with glowing opacity based on sweep hits
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.intensity;
      ctx.shadowBlur = p.score >= 5 ? 12 * p.intensity : 4;
      ctx.shadowColor = p.color;
      
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    });

    // 4. Draw Tooltip for Hovered point
    if (hoveredPoint) {
      const p = hoveredPoint;
      
      // Highlight circle
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size + 4, 0, Math.PI * 2);
      ctx.stroke();

      // Tooltip box
      const text = `${p.name} (Tension: ${p.score})`;
      ctx.font = "bold 11px 'Plus Jakarta Sans', sans-serif";
      const textWidth = ctx.measureText(text).width;
      const boxWidth = textWidth + 16;
      const boxHeight = 24;
      
      // Position tooltip above dot
      const tx = Math.max(10, Math.min(width - boxWidth - 10, p.x - boxWidth / 2));
      const ty = p.y - p.size - boxHeight - 6;

      ctx.fillStyle = "rgba(8, 11, 17, 0.92)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      
      // Draw tooltip rectangle
      ctx.beginPath();
      ctx.roundRect(tx, ty, boxWidth, boxHeight, 6);
      ctx.fill();
      ctx.stroke();

      // Text inside tooltip
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, tx + boxWidth / 2, ty + boxHeight / 2);
    }

    // Update sweep angle (speed)
    sweepAngle = (sweepAngle + 0.012) % (Math.PI * 2);

    requestAnimationFrame(drawRadar);
  }

  // Start Radar
  requestAnimationFrame(drawRadar);
}

/* ==========================================================================
   CHART.JS DATA VISUALIZATION (Analytic Panel)
   ========================================================================== */
function initTensionChart() {
  const canvas = document.getElementById("tension-distribution-chart");
  if (!canvas || typeof Chart === "undefined") return;

  const heatItems = document.querySelectorAll(".heat-item");
  const labels = [];
  const dataScores = [];
  const backgroundColors = [];
  const borderColors = [];

  heatItems.forEach((item) => {
    const name = item.dataset.categoryName;
    const score = parseFloat(item.dataset.categoryScore || 0);
    labels.push(name);
    dataScores.push(score);

    // Color theme matching
    if (score >= 12) {
      backgroundColors.push("rgba(244, 63, 94, 0.2)");
      borderColors.push("#f43f5e");
    } else if (score >= 5) {
      backgroundColors.push("rgba(251, 191, 36, 0.2)");
      borderColors.push("#fbbf24");
    } else {
      backgroundColors.push("rgba(5, 177, 155, 0.2)");
      borderColors.push("#05b19b");
    }
  });

  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const textColor = isDark ? "#9ca3af" : "#4b5563";
  const gridColor = isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)";

  const config = {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Indice de tension",
          data: dataScores,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1.5,
          borderRadius: 6,
        },
      ],
    },
    options: {
      indexAxis: "y", // Horizontal bars
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: isDark ? "rgba(15, 20, 34, 0.95)" : "rgba(255, 255, 255, 0.95)",
          titleColor: isDark ? "#ffffff" : "#111827",
          bodyColor: isDark ? "#9ca3af" : "#4b5563",
          borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
          borderWidth: 1,
          padding: 10,
        },
      },
      scales: {
        x: {
          grid: {
            color: gridColor,
          },
          ticks: {
            color: textColor,
            font: {
              family: "'Plus Jakarta Sans', sans-serif",
              size: 10,
            },
          },
        },
        y: {
          grid: {
            display: false,
          },
          ticks: {
            color: textColor,
            font: {
              family: "'Plus Jakarta Sans', sans-serif",
              weight: "600",
              size: 11,
            },
          },
        },
      },
    },
  };

  window.tensionChart = new Chart(canvas, config);
}

function updateChartTheme(chart, theme) {
  const isDark = theme !== "light";
  const textColor = isDark ? "#9ca3af" : "#4b5563";
  const gridColor = isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)";

  chart.options.scales.x.grid.color = gridColor;
  chart.options.scales.x.ticks.color = textColor;
  chart.options.scales.y.ticks.color = textColor;
  chart.options.plugins.tooltip.backgroundColor = isDark ? "rgba(15, 20, 34, 0.95)" : "rgba(255, 255, 255, 0.95)";
  chart.options.plugins.tooltip.titleColor = isDark ? "#ffffff" : "#111827";
  chart.options.plugins.tooltip.bodyColor = isDark ? "#9ca3af" : "#4b5563";
  chart.options.plugins.tooltip.borderColor = isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)";
  
  chart.update();
}

/* ==========================================================================
   STAT CARD COUNTERS ANIMATION
   ========================================================================== */
function animateCounters() {
  document.querySelectorAll("[data-counter]").forEach((counter) => {
    const target = Number(counter.dataset.counter || "0");
    const duration = 1200; // slightly longer, smoother
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      // Quintic ease-out curve
      const eased = 1 - Math.pow(1 - progress, 5);
      counter.textContent = Math.round(target * eased).toString();

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        // Pulse once finished
        counter.style.animation = "none";
        setTimeout(() => {
          counter.style.transform = "scale(1.05)";
          counter.style.transition = "transform 0.15s ease";
          setTimeout(() => {
            counter.style.transform = "none";
          }, 150);
        }, 50);
      }
    }

    requestAnimationFrame(tick);
  });
}

/* ==========================================================================
   REVEAL ELEMENTS ON SCROLL
   ========================================================================== */
function revealElements() {
  const elements = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    elements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  elements.forEach((element, index) => {
    element.style.animationDelay = `${Math.min(index * 60, 400)}ms`;
    observer.observe(element);
  });
}

/* ==========================================================================
   FORM CHARACTER COUNTER (Submit Page)
   ========================================================================== */
function initCharCounter() {
  const textarea = document.getElementById("content");
  const counter = document.getElementById("char-counter");
  if (!textarea || !counter) return;

  const updateCounter = () => {
    const len = textarea.value.length;
    counter.textContent = `${len} / 900`;
    
    // Color indicators as they approach limit
    if (len >= 850) {
      counter.style.color = "var(--color-rose)";
    } else if (len >= 600) {
      counter.style.color = "var(--color-amber)";
    } else {
      counter.style.color = "var(--text-muted)";
    }
  };

  textarea.addEventListener("input", updateCounter);
  updateCounter(); // Initial check
}

/* ==========================================================================
   VOTE BUTTONS MARKING
   ========================================================================== */
function markVotedButtons(votedIds) {
  document.querySelectorAll("[data-action='vote']").forEach((button) => {
    const id = button.dataset.id;
    if (votedIds.has(id)) {
      button.disabled = true;
      button.querySelector("[data-vote-label]").textContent = "Utile";
      button.classList.add("is-voted");
    }
  });
}

function markReportedButtons(reportedIds) {
  document.querySelectorAll("[data-action='report']").forEach((button) => {
    const id = button.dataset.id;
    if (reportedIds.has(id)) {
      button.disabled = true;
      button.querySelector("span").textContent = "Signalé";
    }
  });
}

function ensurePetitionBadge(card) {
  if (card.querySelector(".badge-petition")) {
    return;
  }

  const meta = card.querySelector(".post-meta");
  const badge = document.createElement("span");
  badge.className = "badge-tag badge-petition animate-pulse";
  badge.innerHTML = '<i class="lucide-award"></i> Pétition Active';
  
  // Insert before the time tag
  const timeTag = meta.querySelector(".post-time");
  meta.insertBefore(badge, timeTag);
}

function updateSignalChip(card, votes) {
  const chip = card.querySelector(".signal-priority-chip");
  if (!chip) return;

  if (votes >= 10) {
    chip.innerHTML = '<span class="priority-indicator indicator-high"></span><span>Priorité Forte</span>';
  } else if (votes >= 4) {
    chip.innerHTML = '<span class="priority-indicator indicator-medium"></span><span>En Hausse</span>';
  } else {
    chip.innerHTML = '<span class="priority-indicator indicator-low"></span><span>Signal Frais</span>';
  }
}

async function postAction(url) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-Requested-With": "fetch",
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Action impossible.");
  }

  return response.json();
}

/* ==========================================================================
   DOM CONTENT LOADED INITIALIZATION
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  const votedIds = readStoredIds(votedStorageKey);
  const reportedIds = readStoredIds(reportedStorageKey);

  // Initialize features
  initTheme();
  revealElements();
  animateCounters();
  initSonarRadar();
  initCharCounter();
  
  // Check if we need to load Chart.js and build chart
  if (document.getElementById("tension-distribution-chart")) {
    // Wait slightly for container rendering before initializing Chart.js
    setTimeout(initTensionChart, 100);
  }

  markVotedButtons(votedIds);
  markReportedButtons(reportedIds);

  // Auto-dismiss notice alerts after 5s
  const notice = document.querySelector(".notice-toast");
  if (notice) {
    triggerSuccessConfetti();
    setTimeout(() => {
      notice.style.transition = "opacity 0.5s ease, transform 0.5s ease";
      notice.style.opacity = "0";
      notice.style.transform = "translateY(-10px)";
      setTimeout(() => notice.remove(), 500);
    }, 6000);
  }

  // Global Click listener for AJAX actions
  document.addEventListener("click", async (event) => {
    const voteButton = event.target.closest("[data-action='vote']");
    const reportButton = event.target.closest("[data-action='report']");

    if (!voteButton && !reportButton) return;

    if (voteButton) {
      const id = voteButton.dataset.id;
      if (votedIds.has(id)) return;

      voteButton.disabled = true;

      try {
        const payload = await postAction(`/posts/${id}/vote`);
        const card = voteButton.closest(".post-card");
        
        // Update vote details in UI
        voteButton.querySelector("[data-vote-count]").textContent = payload.useful_votes;
        voteButton.querySelector("[data-vote-label]").textContent = "Utile";
        voteButton.classList.add("is-voted");
        
        votedIds.add(id);
        writeStoredIds(votedStorageKey, votedIds);
        updateSignalChip(card, payload.useful_votes);
        
        // Wow factor: confetti burst
        triggerConfettiBurst();
        showToast("Votre vote utile a été ajouté avec succès !");

        if (payload.is_petition) {
          ensurePetitionBadge(card);
          showToast("Ce signal a atteint 10 votes utiles et devient une pétition !", "info");
        }
      } catch (error) {
        voteButton.disabled = false;
        showToast(error.message, "error");
      }
    }

    if (reportButton) {
      const id = reportButton.dataset.id;
      if (reportedIds.has(id)) return;

      if (!confirm("Voulez-vous vraiment signaler cet avis ? (S'il cumule 5 signalements, il sera masqué du fil public).")) {
        return;
      }

      reportButton.disabled = true;

      try {
        const payload = await postAction(`/posts/${id}/report`);
        reportedIds.add(id);
        writeStoredIds(reportedStorageKey, reportedIds);
        
        reportButton.querySelector("span").textContent = "Signalé";
        showToast("Signalement enregistré.", "info");

        if (payload.hidden) {
          const card = reportButton.closest(".post-card");
          card.style.transition = "transform 0.4s ease, opacity 0.4s ease";
          card.style.transform = "scale(0.9)";
          card.style.opacity = "0";
          setTimeout(() => {
            card.remove();
            // Show empty state if no posts remain in the feed
            const feedList = document.querySelector(".feed-list");
            if (feedList && feedList.children.length === 0) {
              location.reload(); // Quick reset
            }
          }, 400);
          showToast("Ce signal a été masqué en raison d'un grand nombre de signalements.", "info");
        }
      } catch (error) {
        reportButton.disabled = false;
        showToast(error.message, "error");
      }
    }
  });
});

/* ==========================================================================
   CHAT WIDGET
   ========================================================================== */
function initChat() {
  const toggleBtn  = document.getElementById("chat-toggle");
  const closeBtn   = document.getElementById("chat-close");
  const chatBox    = document.getElementById("chat-box");
  const chatForm   = document.getElementById("chat-form");
  const msgsList   = document.getElementById("chat-messages");
  const badge      = document.getElementById("chat-badge");
  if (!toggleBtn) return;

  let isOpen      = false;
  let lastId      = 0;
  let unread      = 0;
  let pollTimer   = null;

  function formatTime(iso) {
    try {
      return new Date(iso + "Z").toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    } catch { return ""; }
  }

  function renderMsg(msg) {
    const el = document.createElement("div");
    el.className = "chat-msg";
    el.dataset.id = msg.id;
    el.innerHTML = `
      <div class="chat-msg-user">${msg.username}</div>
      <div class="chat-msg-text">${msg.content.replace(/</g,"&lt;")}</div>
      <div class="chat-msg-time">${formatTime(msg.created_at)}</div>`;
    return el;
  }

  async function pollMessages() {
    try {
      const res  = await fetch(`/api/chat?since=${lastId}`);
      if (!res.ok) return;
      const msgs = await res.json();
      if (msgs.length) {
        msgs.forEach(msg => {
          if (msg.id > lastId) {
            lastId = msg.id;
            msgsList.appendChild(renderMsg(msg));
          }
        });
        msgsList.scrollTop = msgsList.scrollHeight;
        if (!isOpen) {
          unread += msgs.length;
          badge.textContent = unread > 9 ? "9+" : unread;
          badge.style.display = "flex";
        }
      }
    } catch (_) {}
  }

  function openChat() {
    isOpen = true;
    chatBox.hidden = false;
    badge.style.display = "none";
    unread = 0;
    msgsList.scrollTop = msgsList.scrollHeight;
  }
  function closeChat() {
    isOpen = false;
    chatBox.hidden = true;
  }

  toggleBtn.addEventListener("click", () => isOpen ? closeChat() : openChat());
  closeBtn.addEventListener("click", closeChat);

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("chat-username").value.trim() || "Anonyme";
    const content  = document.getElementById("chat-content").value.trim();
    if (!content) return;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, content }),
      });
      if (res.ok) {
        document.getElementById("chat-content").value = "";
        await pollMessages();
      }
    } catch (_) {}
  });

  // Initial load + poll every 4 seconds
  pollMessages();
  pollTimer = setInterval(pollMessages, 4000);
}

/* ==========================================================================
   MOOD THERMOMETER
   ========================================================================== */
function initMoods() {
  const list = document.getElementById("mood-list");
  if (!list) return;

  const voted = sessionStorage.getItem("cv:mood_voted");

  function renderMoods(moods) {
    list.querySelectorAll(".mood-btn").forEach(btn => {
      const mood = moods.find(m => m.key === btn.dataset.mood);
      if (!mood) return;
      btn.querySelector(".mood-bar-fill").style.width = mood.pct + "%";
      btn.querySelector(".mood-pct").textContent = mood.pct + "%";
    });
  }

  if (voted) {
    list.querySelectorAll(".mood-btn").forEach(b => {
      b.classList.add("voted");
      b.disabled = true;
    });
  }

  list.querySelectorAll(".mood-btn").forEach(btn => {
    if (voted) return;
    btn.addEventListener("click", async () => {
      if (btn.disabled) return;
      list.querySelectorAll(".mood-btn").forEach(b => { b.disabled = true; b.classList.add("voted"); });
      try {
        const res = await fetch(`/api/moods/${btn.dataset.mood}/vote`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          renderMoods(data.moods);
          sessionStorage.setItem("cv:mood_voted", "1");
          showToast("Merci pour ton vote ! 🫀", "success");
          triggerConfettiBurst();
        }
      } catch (_) {}
    });
  });
}

/* ==========================================================================
   PETITION GENERATOR
   ========================================================================== */
function initPetitionGenerator() {
  const form  = document.getElementById("petition-form");
  const modal = document.getElementById("petition-modal");
  const close = document.getElementById("pm-close");
  if (!form || !modal) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      title:  document.getElementById("pet-title").value.trim(),
      issue:  document.getElementById("pet-issue").value.trim(),
      target: document.getElementById("pet-target").value.trim() || "Administration de l'université",
      demand: document.getElementById("pet-demand").value.trim(),
    };
    try {
      const res  = await fetch("/api/petition/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { showToast("Erreur de génération.", "error"); return; }
      const data = await res.json();

      document.getElementById("pm-title").textContent  = data.title;
      document.getElementById("pm-target").textContent = data.target;
      document.getElementById("pm-issue").textContent  = data.issue;
      document.getElementById("pm-demand").textContent = data.demand || "Non précisé.";
      document.getElementById("pm-date").textContent   = new Date().toLocaleDateString("fr-FR", { year:"numeric", month:"long", day:"numeric" });

      modal.hidden = false;
      triggerConfettiBurst();
    } catch (_) {
      showToast("Erreur réseau.", "error");
    }
  });

  close.addEventListener("click", () => { modal.hidden = true; });
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; });
}

/* ==========================================================================
   BOOT — init all new modules
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  initChat();
  initMoods();
  initPetitionGenerator();
});
