/**
 * ==============================================================================
 * DASHBOARD MATOMO - VERSION RESTAURÉE (Sélecteur Annuel + Rapports N-1)
 * ==============================================================================
 */

const API_URL = "https://script.google.com/macros/s/AKfycbzs5S-NuzbuRIx-PIR-QvZ6cf2j-YYvyYfVDTdL0upNwswgw4kzr75Q_wWB4TF2njcF/exec";
const CACHE_KEY = "matomo_dashboard_cache";

let allData = null;
let sourcesChart = null;
let devicesChart = null;
let evolutionChart = null;

const MOIS_NOMS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const PALETTES = {
  "Data FA": { primary: ["#FA5629", "#007770", "#4984A9", "#68B0AC", "#FFB347", "#77DD77", "#A181E0"] },
  "Data AP": { primary: ["#fdc300", "#005da4", "#00a3bb", "#0587b5", "#f07d19", "#292e6b", "#8bc34a"] }
};

// ============ INITIALISATION ============

async function initDashboard() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      allData = JSON.parse(cached);
      proceed();
    } else {
      const res = await fetch(API_URL);
      allData = await res.json();
      localStorage.setItem(CACHE_KEY, JSON.stringify(allData));
      proceed();
    }
  } catch (e) { console.error(e); }
}

function proceed() {
  document.getElementById("loading").style.display = "none";
  document.getElementById("dashboard-content").style.display = "block";
  
  initPeriodSelector(); // Génère le sélecteur avec années et mois
  
  document.getElementById("site-select").addEventListener("change", () => {
    initPeriodSelector();
    updateDashboard();
  });
  document.getElementById("period-select").addEventListener("change", updateDashboard);
  
  updateDashboard();
}

// ============ SÉLECTEUR HIÉRARCHIQUE (RESTAURÉ) ============

function initPeriodSelector() {
  const sheetName = document.getElementById("site-select").value;
  const rows = allData.sheets[sheetName]?.rows || [];
  const select = document.getElementById("period-select");
  
  // Extraction et tri des dates
  const dates = [...new Set(rows.map(r => r.date))].sort().reverse();
  
  let html = "";
  let lastYear = "";
  
  dates.forEach(d => {
    const year = d.substring(0, 4);
    const month = d.substring(5, 7);
    
    if (year !== lastYear) {
      html += `<optgroup label="${year}">`;
      // Ajout auto du rapport annuel si présent dans vos données
      if (month === "00") { // Si vous avez des lignes type 2025-00
         html += `<option value="${year}-00">BILAN ANNUEL ${year}</option>`;
      }
      lastYear = year;
    }
    
    if (month !== "00") {
      const label = MOIS_NOMS[parseInt(month) - 1] + " " + year;
      html += `<option value="${d}">${label}</option>`;
    }
  });
  
  select.innerHTML = html;
}

// ============ LOGIQUE DASHBOARD ============

function updateDashboard() {
  const sheetName = document.getElementById("site-select").value;
  const period = document.getElementById("period-select").value;
  const rows = allData.sheets[sheetName].rows;
  
  const current = rows.find(r => r.date === period);
  const currentIndex = rows.findIndex(r => r.date === period);
  
  // M-1 (Mois précédent direct dans la liste)
  const m1 = rows[currentIndex + 1] || null;
  
  // N-1 (Même mois année précédente)
  const d = new Date(period.substring(0, 7) + "-01");
  d.setFullYear(d.getFullYear() - 1);
  const n1Date = d.toISOString().substring(0, 7);
  const n1 = rows.find(r => r.date.startsWith(n1Date));

  renderKPIs(current, m1, n1);
  renderCharts(sheetName, current, rows, currentIndex);
  renderTopPages(sheetName, period);
}

// ============ GRAPHIQUES (REPRIS CONFIG PRÉCÉDENTE) ============

function renderCharts(sheetName, row, allRows, idx) {
  const colors = PALETTES[sheetName].primary;
  
  // 1. SOURCES (Camembert avec légendes et labels)
  const ctxS = document.getElementById("sourcesChart").getContext("2d");
  if (sourcesChart) sourcesChart.destroy();
  sourcesChart = new Chart(ctxS, {
    type: 'pie',
    plugins: [ChartDataLabels],
    data: {
      labels: ["Moteurs", "Direct", "Sites Ext.", "Social", "IA", "Campagnes"],
      datasets: [{
        data: [row.moteurs_de_recherche, row.entrees_directes, row.sites_externes, row.reseaux_sociaux, row.assistants_ia, row.campagnes],
        backgroundColor: colors
      }]
    },
    options: {
      plugins: {
        legend: { position: 'right' },
        datalabels: {
          formatter: (v, ctx) => {
            let sum = ctx.dataset.data.reduce((a, b) => a + b, 0);
            return v > 0 ? (v * 100 / sum).toFixed(0) + "%" : "";
          },
          color: '#fff', font: { weight: 'bold' }
        }
      }
    }
  });

  // 2. EVOLUTION (Restauré : 12 derniers mois)
  const ctxE = document.getElementById("evolutionChart").getContext("2d");
  if (evolutionChart) evolutionChart.destroy();
  const history = allRows.slice(idx, idx + 12).reverse();
  
  evolutionChart = new Chart(ctxE, {
    type: 'line',
    data: {
      labels: history.map(r => r.date.substring(5, 7) + "/" + r.date.substring(2, 4)),
      datasets: [{
        label: 'Visites',
        data: history.map(r => r.visites),
        borderColor: colors[0],
        tension: 0.3,
        fill: false
      }]
    },
    options: { scales: { y: { beginAtZero: true } } }
  });
}

// ============ TOP PAGES (RESTAURÉ) ============

function renderTopPages(sheetName, period) {
  const site = sheetName.replace("Data ", "");
  const topRows = allData.sheets["Top Pages"]?.rows || [];
  const filtered = topRows.filter(r => r.site === site && r.date === period)
                          .sort((a,b) => a.position - b.position);

  const tbody = document.querySelector("#top-pages-table tbody");
  if (!filtered.length) {
    tbody.innerHTML = "<tr><td colspan='7'>Aucune donnée Top 10</td></tr>";
    return;
  }

  tbody.innerHTML = filtered.map(p => `
    <tr>
      <td>${p.position}</td>
      <td class="${p.evolution === 'new' ? 'new' : (p.evolution.includes('+') ? 'up' : 'down')}">${p.evolution}</td>
      <td><a href="${p.url}" target="_blank">${p.titre_page}</a></td>
      <td>${Number(p.vues).toLocaleString()}</td>
      <td>${(p.pct_trafic * 100).toFixed(1)}%</td>
      <td>${(p.taux_rebond * 100).toFixed(0)}%</td>
      <td>${p.temps_moyen}</td>
    </tr>
  `).join('');
}

// ============ KPIs ============

function renderKPIs(c, m1, n1) {
  const grid = document.getElementById("kpis-grid");
  const metrics = [
    { label: "Visites", k: "visites" },
    { label: "Pages vues", k: "pages_vues" },
    { label: "Rebond", k: "taux_de_rebond", isPct: true },
    { label: "Durée", k: "duree_moyenne" },
    { label: "Actions", k: "actions_moy" },
    { label: "Téléchargements", k: "telechargements" }
  ];

  grid.innerHTML = metrics.map(m => {
    const val = c[m.k];
    const varM1 = calculateVar(val, m1 ? m1[m.k] : null);
    const varN1 = calculateVar(val, n1 ? n1[m.k] : null);
    
    return `
      <div class="kpi-card">
        <h3>${m.label}</h3>
        <div class="kpi-value">${m.isPct ? (val*100).toFixed(1)+'%' : val}</div>
        <div class="kpi-comparisons">
          <div class="kpi-comparison"><span>${varM1}</span><small>vs M-1</small></div>
          <div class="kpi-comparison"><span>${varN1}</span><small>vs N-1</small></div>
        </div>
      </div>`;
  }).join('');
}

function calculateVar(curr, prev) {
  if (!prev) return "--";
  const c = typeof curr === 'string' ? parseFloat(curr) : curr;
  const p = typeof prev === 'string' ? parseFloat(prev) : prev;
  const pct = ((c - p) / p) * 100;
  return (pct > 0 ? "+" : "") + pct.toFixed(1) + "%";
}

initDashboard();