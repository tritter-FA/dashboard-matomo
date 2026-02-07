// ============ CONFIGURATION ET VARIABLES GLOBALES ============
const API_URL = "https://script.google.com/macros/s/AKfycbzs5S-NuzbuRIx-PIR-QvZ6cf2j-YYvyYfVDTdL0upNwswgw4kzr75Q_wWB4TF2njcF/exec";
const CACHE_KEY = "matomo_dashboard_cache";

let allData = null;
let sourcesChart = null;
let devicesChart = null;

const PALETTES = {
  "Data FA": {
    primary: ["#FA5629", "#007770", "#4984A9", "#68B0AC", "#FFB347", "#77DD77", "#A181E0"],
    accent: "#FA5629"
  },
  "Data AP": {
    primary: ["#fdc300", "#005da4", "#00a3bb", "#0587b5", "#f07d19", "#292e6b", "#8bc34a"],
    accent: "#fdc300"
  }
};

// ============ INITIALISATION ============

async function initDashboard() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      allData = JSON.parse(cached);
      proceedWithData();
    } else {
      const response = await fetch(API_URL);
      allData = await response.json();
      localStorage.setItem(CACHE_KEY, JSON.stringify(allData));
      proceedWithData();
    }
  } catch (error) {
    console.error("Erreur d'initialisation:", error);
    document.getElementById("loading").textContent = "Erreur de connexion à l'API.";
  }
}

function proceedWithData() {
  document.getElementById("loading").style.display = "none";
  document.getElementById("dashboard-content").style.display = "block";
  
  // Remplir le sélecteur de période au démarrage
  updatePeriodSelector();
  
  // Écouteurs d'événements
  document.getElementById("site-select").addEventListener("change", function() {
    updatePeriodSelector();
    updateDashboard();
  });
  
  document.getElementById("period-select").addEventListener("change", updateDashboard);
  
  // Premier affichage
  updateDashboard();
}

// ============ LOGIQUE D'AFFICHAGE ============

function updateDashboard() {
  const sheetName = document.getElementById("site-select").value;
  const selectedPeriod = document.getElementById("period-select").value;
  const rows = allData.sheets[sheetName].rows;
  
  const currentData = rows.find(r => r.date === selectedPeriod);
  
  // Calcul des index pour M-1 et N-1 (version explicite)
  const currentIndex = rows.findIndex(r => r.date === selectedPeriod);
  const prevMonthData = rows[currentIndex + 1] || null; // Dans l'ordre décroissant du Sheet
  
  // Recherche N-1 (même mois, année précédente)
  const dateObj = new Date(selectedPeriod + "-01");
  dateObj.setFullYear(dateObj.getFullYear() - 1);
  const n1DateStr = dateObj.toISOString().substring(0, 7);
  const prevYearData = rows.find(r => r.date === n1DateStr);

  renderKPIs(currentData, prevMonthData, prevYearData);
  renderCharts(sheetName, currentData);
  updateTopPages(sheetName, selectedPeriod);
}

function renderKPIs(current, m1, n1) {
  const grid = document.getElementById("kpis-grid");
  grid.innerHTML = ""; // On vide proprement

  if (!current) return;

  // Définition manuelle de chaque carte pour garder le contrôle total
  const metrics = [
    { label: "Visites", key: "visites", type: "number" },
    { label: "Pages vues", key: "pages_vues", type: "number" },
    { label: "Taux de rebond", key: "taux_de_rebond", type: "percent" },
    { label: "Durée moyenne", key: "duree_moyenne", type: "duration" },
    { label: "Actions moyennes", key: "actions_moy", type: "float" },
    { label: "Téléchargements", key: "telechargements", type: "number" } // LA COLONNE G
  ];

  metrics.forEach(m => {
    const val = current[m.key];
    const valM1 = m1 ? m1[m.key] : null;
    const valN1 = n1 ? n1[m.key] : null;
    
    grid.innerHTML += createKPICard(m.label, val, valM1, valN1, m.type);
  });
}

function renderCharts(sheetName, row) {
  if (!row) return;
  const colors = PALETTES[sheetName].primary;

  // 1. CHART SOURCES (Avec IA et Réseaux Sociaux)
  const ctxSources = document.getElementById("sourcesChart").getContext("2d");
  if (sourcesChart) sourcesChart.destroy();
  
  sourcesChart = new Chart(ctxSources, {
    type: 'pie',
    data: {
      labels: ["Moteurs", "Direct", "Sites Ext.", "Social", "Assistants IA", "Campagnes"],
      datasets: [{
        data: [
          row.moteurs_de_recherche || 0,
          row.entrees_directes || 0,
          row.sites_externes || 0,
          row.reseaux_sociaux || 0, // Colonne L
          row.assistants_ia || 0,    // Colonne M
          row.campagnes || 0
        ],
        backgroundColor: colors
      }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });

  // 2. CHART DEVICES
  const ctxDevices = document.getElementById("devicesChart").getContext("2d");
  if (devicesChart) devicesChart.destroy();
  
  devicesChart = new Chart(ctxDevices, {
    type: 'pie',
    data: {
      labels: ["Ordinateur", "Smartphone", "Tablette"],
      datasets: [{
        data: [row.ordinateurs || 0, row.smartphone || 0, row.tablettes || 0],
        backgroundColor: [colors[0], colors[1], colors[2]]
      }]
    }
  });
}

// ============ FONCTIONS UTILITAIRES DE CONSTRUCTION ============

function createKPICard(label, val, valM1, valN1, type) {
  let displayVal = val;
  if (type === "percent") displayVal = (val * 100).toFixed(1) + "%";
  if (type === "number") displayVal = Number(val).toLocaleString();
  if (type === "float") displayVal = Number(val).toFixed(2);
  
  const varM1 = calculateVariation(val, valM1, type);
  
  return `
    <div class="kpi-card">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${displayVal}</div>
      <div class="kpi-diff">
        <span class="diff-value ${varM1.class}">${varM1.text}</span>
        <span class="diff-label">vs mois dernier</span>
      </div>
    </div>
  `;
}

function calculateVariation(curr, prev, type) {
  if (prev === null || prev === undefined || prev === 0) return { text: "--", class: "" };
  
  // Pour la durée, transformer "2 min 30 s" en secondes pour comparer
  let c = curr, p = prev;
  if (type === "duration") {
    c = durationToSeconds(curr);
    p = durationToSeconds(prev);
  }

  const pct = ((c - p) / p) * 100;
  const sign = pct >= 0 ? "+" : "";
  const cls = pct >= 0 ? "positive" : "negative";
  
  return { text: sign + pct.toFixed(1) + "%", class: cls };
}

function durationToSeconds(str) {
  if (!str) return 0;
  const regex = /(\d+)\s*min\s*(\d+)?/;
  const match = String(str).match(regex);
  if (!match) return 0;
  return parseInt(match[1]) * 60 + (parseInt(match[2]) || 0);
}

function updatePeriodSelector() {
  const sheetName = document.getElementById("site-select").value;
  const rows = allData.sheets[sheetName].rows;
  const select = document.getElementById("period-select");
  
  select.innerHTML = "";
  rows.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r.date;
    opt.textContent = r.date;
    select.appendChild(opt);
  });
}

function refreshData() {
  localStorage.removeItem(CACHE_KEY);
  location.reload();
}

// Lancement
initDashboard();