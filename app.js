// ============ CONFIGURATION ============
const API_URL = "https://script.google.com/macros/s/AKfycbzs5S-NuzbuRIx-PIR-QvZ6cf2j-YYvyYfVDTdL0upNwswgw4kzr75Q_wWB4TF2njcF/exec";
const CACHE_KEY = "matomo_dashboard_cache";
const CACHE_MONTH_KEY = "matomo_dashboard_cache_month";

let allData = null;
let sourcesChart = null;
let devicesChart = null;
let evolutionChart = null;
let comparisonChart = null;

const SITE_CODES = { "FA": "Data FA", "AP": "Data AP" };
const SITE_CODES_REVERSE = { "Data FA": "FA", "Data AP": "AP" };

const PALETTES = {
  "Data FA": {
    primary: ["#FA5629", "#007770", "#4984A9", "#68B0AC", "#FFB347", "#77DD77"],
    accent: "#FA5629"
  },
  "Data AP": {
    primary: ["#fdc300", "#005da4", "#00a3bb", "#0587b5", "#f07d19", "#292e6b"],
    accent: "#fdc300"
  }
};

const MOIS_NOMS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

// ============ UTILS ============
function getAllColors(sheetName) {
  const p = PALETTES[sheetName] || PALETTES["Data FA"];
  return p.primary;
}

function formatNumber(n) { return Number(n || 0).toLocaleString("fr-FR"); }
function formatPercent(v) { return (v > 0 ? "+" : "") + v.toFixed(1) + "%"; }
function parseDuration(s) {
  if (!s) return 0;
  const m = String(s).match(/(\d+)\s*min\s*(\d+)?/);
  return m ? parseInt(m[1]) * 60 + (parseInt(m[2]) || 0) : 0;
}
function formatDuration(sec) {
  return Math.floor(sec / 60) + ' min ' + Math.round(sec % 60) + ' s';
}
function calcVariation(curr, prev) {
  return (prev && prev !== 0) ? ((curr - prev) / prev) * 100 : null;
}

// ============ CORE LOGIC ============
async function initDashboard() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const cachedMonth = localStorage.getItem(CACHE_MONTH_KEY);
    const currentMonth = new Date().getFullYear() + '-' + (new Date().getMonth() + 1);

    if (cached && cachedMonth === currentMonth) {
      allData = JSON.parse(cached);
    } else {
      const res = await fetch(API_URL);
      allData = await res.json();
      localStorage.setItem(CACHE_KEY, JSON.stringify(allData));
      localStorage.setItem(CACHE_MONTH_KEY, currentMonth);
    }

    document.getElementById("loading").style.display = "none";
    document.getElementById("dashboard-content").style.display = "block";

    initPeriodSelector();
    updateDashboard();

    document.getElementById("site-select").addEventListener("change", () => { initPeriodSelector(); updateDashboard(); });
    document.getElementById("period-select").addEventListener("change", updateDashboard);
  } catch (err) {
    document.getElementById("loading").textContent = "Erreur de chargement des données.";
  }
}

function initPeriodSelector() {
  const sheetName = document.getElementById("site-select").value;
  const rows = allData.sheets[sheetName]?.rows || [];
  const select = document.getElementById("period-select");
  
  const periods = [...new Set(rows.map(r => r.date.substring(0, 7)))].sort().reverse();
  select.innerHTML = periods.map(p => `<option value="month-${p}">${p}</option>`).join('');
}

function updateDashboard() {
  const sheetName = document.getElementById("site-select").value;
  const periodValue = document.getElementById("period-select").value.replace("month-", "");
  const rows = allData.sheets[sheetName].rows;

  const current = rows.find(r => r.date.startsWith(periodValue));
  const prevDate = new Date(periodValue + "-01");
  prevDate.setMonth(prevDate.getMonth() - 1);
  const prevMonthStr = prevDate.toISOString().substring(0, 7);
  const previous = rows.find(r => r.date.startsWith(prevMonthStr));

  renderKPIs(current, previous);
  renderSourcesPie(sheetName, current);
  renderDevicesPie(sheetName, current);
  updateTopPages(sheetName, periodValue);
}

// ============ RENDERERS ============
function renderKPIs(curr, prev) {
  const grid = document.getElementById("kpis-grid");
  if (!curr) return;

  const metrics = [
    { label: "Visites", val: curr.visites, prev: prev?.visites },
    { label: "Pages vues", val: curr.pages_vues, prev: prev?.pages_vues },
    { label: "Taux de rebond", val: curr.taux_de_rebond * 100, prev: prev?.taux_de_rebond * 100, unit: "%", inv: true },
    { label: "Durée moyenne", val: parseDuration(curr.duree_moyenne), prev: parseDuration(prev?.duree_moyenne), isTime: true },
    { label: "Actions moyennes", val: curr.actions_moy, prev: prev?.actions_moy },
    { label: "Téléchargements", val: curr.telechargements, prev: prev?.telechargements }
  ];

  grid.innerHTML = metrics.map(m => {
    const varPct = calcVariation(m.val, m.prev);
    const colorClass = varPct === null ? "neutral" : (m.inv ? (varPct > 0 ? "down" : "up") : (varPct > 0 ? "up" : "down"));
    const displayVal = m.isTime ? formatDuration(m.val) : (m.unit ? m.val.toFixed(1) + m.unit : formatNumber(m.val));
    
    return `
      <div class="kpi-card">
        <h3>${m.label}</h3>
        <div class="kpi-value">${displayVal}</div>
        <div class="kpi-comparison">
          <span class="value ${colorClass}">${varPct !== null ? formatPercent(varPct) : "—"}</span>
          <span class="label">vs M-1</span>
        </div>
      </div>`;
  }).join('');
}

function renderSourcesPie(sheetName, row) {
  const ctx = document.getElementById("sourcesChart").getContext("2d");
  if (sourcesChart) sourcesChart.destroy();
  if (!row) return;

  const data = [
    row.moteurs_de_recherche, row.entrees_directes, row.sites_externes, 
    row.assistants_ia, row.reseaux_sociaux, row.campagnes
  ];

  sourcesChart = new Chart(ctx, {
    type: "pie",
    plugins: [ChartDataLabels],
    data: {
      labels: ["Moteurs", "Direct", "Sites Ext.", "IA", "Social", "Campagnes"],
      datasets: [{ data, backgroundColor: getAllColors(sheetName) }]
    },
    options: { plugins: { title: { display: true, text: "Sources de trafic" } } }
  });
}

function renderDevicesPie(sheetName, row) {
  const ctx = document.getElementById("devicesChart").getContext("2d");
  if (devicesChart) devicesChart.destroy();
  if (!row) return;

  devicesChart = new Chart(ctx, {
    type: "pie",
    plugins: [ChartDataLabels],
    data: {
      labels: ["Ordinateurs", "Smartphone", "Tablettes"],
      datasets: [{ data: [row.ordinateurs, row.smartphone, row.tablettes], backgroundColor: getAllColors(sheetName).slice(0,3) }]
    },
    options: { plugins: { title: { display: true, text: "Devices" } } }
  });
}

function updateTopPages(sheetName, period) {
  const siteCode = sheetName.replace("Data ", "");
  const pages = allData.sheets["Top Pages"].rows
    .filter(r => r.site === siteCode && r.date.startsWith(period))
    .sort((a, b) => a.position - b.position)
    .slice(0, 10);

  const tbody = document.querySelector("#top-pages-table tbody");
  const thead = document.querySelector("#top-pages-table thead");

  thead.innerHTML = `<tr><th>#</th><th>Évol.</th><th>Page</th><th>Vues</th><th>%</th><th>Rebond</th></tr>`;
  tbody.innerHTML = pages.map(p => `
    <tr>
      <td class="position">${p.position}</td>
      <td class="evolution ${p.evolution === 'new' ? 'new' : (parseInt(p.evolution) > 0 ? 'up' : 'down')}">${p.evolution}</td>
      <td class="page-title"><a href="${p.url}" target="_blank">${p.titre_page}</a></td>
      <td class="numeric">${formatNumber(p.vues)}</td>
      <td class="numeric">${(p.pct_trafic * 100).toFixed(1)}%</td>
      <td class="numeric">${(p.taux_rebond * 100).toFixed(0)}%</td>
    </tr>
  `).join('');
}

function toggleDarkMode() {
  document.body.classList.toggle("dark");
}

async function refreshData() {
  localStorage.removeItem(CACHE_KEY);
  location.reload();
}

initDashboard();