/**
 * ==============================================================================
 * DASHBOARD ANALYTICS MATOMO - VERSION INTEGRALE (BACKFILL A-Q)
 * ==============================================================================
 * Ce fichier gère l'interface, les graphiques Chart.js, la gestion du cache,
 * les comparaisons temporelles et l'affichage du Top Pages.
 */

// ------------------------------------------------------------------------------
// 1. CONFIGURATION & CONSTANTES GLOBALES
// ------------------------------------------------------------------------------
const API_URL = "https://script.google.com/macros/s/AKfycbzs5S-NuzbuRIx-PIR-QvZ6cf2j-YYvyYfVDTdL0upNwswgw4kzr75Q_wWB4TF2njcF/exec";
const CACHE_KEY = "matomo_dashboard_cache";
const CACHE_MONTH_KEY = "matomo_dashboard_cache_month";

// Variables globales pour les instances Chart.js (pour pouvoir les détruire/recréer)
let allData = null;
let sourcesChart = null;
let devicesChart = null;
let evolutionChart = null;
let comparisonChart = null;

const SITE_CODES = { "FA": "Data FA", "AP": "Data AP" };
const SITE_CODES_REVERSE = { "Data FA": "FA", "Data AP": "AP" };

// Palettes de couleurs institutionnelles
const PALETTES = {
  "Data FA": {
    primary: ["#FA5629", "#007770", "#4984A9", "#68B0AC", "#FFB347", "#77DD77", "#A181E0"],
    secondary: ["#FA5629CC", "#007770CC", "#4984A9CC", "#68B0ACCC"],
    accent: "#FA5629",
    dark: "#007770"
  },
  "Data AP": {
    primary: ["#fdc300", "#005da4", "#00a3bb", "#0587b5", "#f07d19", "#292e6b", "#8bc34a"],
    secondary: ["#0075b2", "#c13401", "#de5534", "#f07d19"],
    accent: "#fdc300",
    dark: "#292e6b"
  }
};

const MOIS_NOMS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

// ------------------------------------------------------------------------------
// 2. FONCTIONS UTILITAIRES (FORMATAGE & CALCULS)
// ------------------------------------------------------------------------------

/**
 * Formate un nombre au format français (1 234 567)
 */
function formatNumber(n) {
  if (n === null || n === undefined) return "0";
  return Number(n).toLocaleString("fr-FR");
}

/**
 * Formate un pourcentage avec signe (+10.5%)
 */
function formatPercent(v) {
  if (v === null || v === undefined) return "—";
  const sign = v >= 0 ? "+" : "";
  return sign + v.toFixed(1) + "%";
}

/**
 * Parse une durée "X min Y s" en secondes totales
 */
function parseDuration(str) {
  if (!str || typeof str !== 'string') return 0;
  const match = str.match(/(\d+)\s*min\s*(\d+)?/);
  if (!match) return 0;
  const minutes = parseInt(match[1]) || 0;
  const seconds = parseInt(match[2]) || 0;
  return (minutes * 60) + seconds;
}

/**
 * Formate des secondes en "X min Y s"
 */
function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return min + ' min ' + sec + ' s';
}

/**
 * Calcule la variation en pourcentage entre deux valeurs
 */
function calculateVariation(current, previous) {
  if (previous === null || previous === undefined || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

// ------------------------------------------------------------------------------
// 3. GESTION DU HASH & NAVIGATION
// ------------------------------------------------------------------------------

function updateHash() {
  const siteSelect = document.getElementById("site-select");
  const periodSelect = document.getElementById("period-select");
  const siteCode = SITE_CODES_REVERSE[siteSelect.value] || "FA";
  const periodValue = periodSelect.value.replace("month-", "");
  
  if (periodValue) {
    window.location.hash = `${siteCode}-${periodValue}`;
  }
}

function parseHash() {
  const hash = window.location.hash.replace('#', '');
  if (!hash) return null;
  const match = hash.match(/^(FA|AP)-(\d{4}-\d{2})$/);
  if (!match) return null;
  return {
    site: SITE_CODES[match[1]],
    ym: match[2]
  };
}

// ------------------------------------------------------------------------------
// 4. INITIALISATION & CHARGEMENT
// ------------------------------------------------------------------------------

async function initDashboard() {
  const loadingEl = document.getElementById("loading");
  const contentEl = document.getElementById("dashboard-content");

  try {
    // Gestion du cache mensuel
    const cached = localStorage.getItem(CACHE_KEY);
    const cachedMonth = localStorage.getItem(CACHE_MONTH_KEY);
    const currentMonthLabel = new Date().getFullYear() + '-' + (new Date().getMonth() + 1);

    if (cached && cachedMonth === currentMonthLabel) {
      console.log("Dashboard: Chargement depuis le cache LocalStorage");
      allData = JSON.parse(cached);
    } else {
      console.log("Dashboard: Appel API Web App...");
      const response = await fetch(API_URL);
      allData = await response.json();
      localStorage.setItem(CACHE_KEY, JSON.stringify(allData));
      localStorage.setItem(CACHE_MONTH_KEY, currentMonthLabel);
    }

    loadingEl.style.display = "none";
    contentEl.style.display = "block";

    // Initialisation des sélecteurs
    initPeriodSelector();
    
    // Application du Hash URL si présent
    const hashData = parseHash();
    if (hashData) {
      document.getElementById("site-select").value = hashData.site;
      initPeriodSelector(); // Refresh les périodes pour ce site
      document.getElementById("period-select").value = "month-" + hashData.ym;
    }

    // Premier rendu
    renderDashboard();

    // Event Listeners
    document.getElementById("site-select").addEventListener("change", () => {
      initPeriodSelector();
      updateHash();
      renderDashboard();
    });

    document.getElementById("period-select").addEventListener("change", () => {
      updateHash();
      renderDashboard();
    });

    // Support du bouton précédent/suivant du navigateur
    window.addEventListener("hashchange", () => {
      const h = parseHash();
      if (h) {
        document.getElementById("site-select").value = h.site;
        document.getElementById("period-select").value = "month-" + h.ym;
        renderDashboard();
      }
    });

  } catch (err) {
    console.error("Dashboard Error:", err);
    loadingEl.textContent = "Erreur fatale lors du chargement des données. Vérifiez l'URL de l'API.";
  }
}

function initPeriodSelector() {
  const sheetName = document.getElementById("site-select").value;
  const rows = allData.sheets[sheetName]?.rows || [];
  const periodSelect = document.getElementById("period-select");
  
  // On extrait les dates uniques au format YYYY-MM
  const periods = [...new Set(rows.map(r => r.date.substring(0, 7)))].sort().reverse();
  
  periodSelect.innerHTML = periods.map(p => {
    const parts = p.split('-');
    const label = MOIS_NOMS[parseInt(parts[1]) - 1] + ' ' + parts[0];
    return `<option value="month-${p}">${label}</option>`;
  }).join('');
}

// ------------------------------------------------------------------------------
// 5. MOTEUR DE RENDU PRINCIPAL
// ------------------------------------------------------------------------------

function renderDashboard() {
  const sheetName = document.getElementById("site-select").value;
  const periodValue = document.getElementById("period-select").value.replace("month-", "");
  const rows = allData.sheets[sheetName].rows;

  // 1. Identification du mois courant, M-1 et N-1
  const currentIndex = rows.findIndex(r => r.date.startsWith(periodValue));
  const currentData = rows[currentIndex];
  
  // Mois précédent (dans le tableau trié par date décroissante, c'est l'index suivant)
  const prevMonthData = rows[currentIndex + 1] || null;
  
  // Année précédente (N-1)
  const d = new Date(periodValue + "-01");
  d.setFullYear(d.getFullYear() - 1);
  const n1DateStr = d.toISOString().substring(0, 7);
  const prevYearData = rows.find(r => r.date.startsWith(n1DateStr));

  // 2. Lancement du rendu des modules
  updatePrintHeader(sheetName, periodValue);
  renderKPISection(currentData, prevMonthData, prevYearData);
  renderChartsSection(sheetName, currentData, rows, currentIndex);
  renderTopPagesTable(sheetName, periodValue);
}

/**
 * Mise à jour du titre dynamique pour l'export PDF
 */
function updatePrintHeader(sheetName, ym) {
  const siteLabel = sheetName === "Data FA" ? "France Assureurs" : "Assurance Prévention";
  const parts = ym.split('-');
  const dateLabel = MOIS_NOMS[parseInt(parts[1]) - 1] + ' ' + parts[0];
  
  document.getElementById("print-period").textContent = ` — ${siteLabel} — ${dateLabel}`;
  document.title = `Dashboard Matomo - ${siteLabel} - ${dateLabel}`;
}

// ------------------------------------------------------------------------------
// 6. MODULE : KPIs (CARTES DE PERFORMANCE)
// ------------------------------------------------------------------------------

function renderKPISection(curr, m1, n1) {
  const grid = document.getElementById("kpis-grid");
  if (!curr) {
    grid.innerHTML = "<p>Aucune donnée disponible pour cette période.</p>";
    return;
  }

  // Configuration détaillée des KPIs pour correspondre aux colonnes A-Q
  const kpiConfig = [
    { label: "Visites", key: "visites", type: "int" },
    { label: "Pages vues", key: "pages_vues", type: "int" },
    { label: "Taux de rebond", key: "taux_de_rebond", type: "pct", invert: true },
    { label: "Durée moyenne", key: "duree_moyenne", type: "duration" },
    { label: "Actions moyennes", key: "actions_moy", type: "float" },
    { label: "Téléchargements", key: "telechargements", type: "int" } // Colonne G
  ];

  grid.innerHTML = kpiConfig.map(conf => {
    let val = curr[conf.key];
    let valM1 = m1 ? m1[conf.key] : null;
    let valN1 = n1 ? n1[conf.key] : null;

    // Calculs des variations
    let rawCurr = (conf.type === "duration") ? parseDuration(val) : Number(val || 0);
    let rawM1 = (conf.type === "duration") ? parseDuration(valM1) : (valM1 !== null ? Number(valM1) : null);
    let rawN1 = (conf.type === "duration") ? parseDuration(valN1) : (valN1 !== null ? Number(valN1) : null);

    const varM1 = calculateVariation(rawCurr, rawM1);
    const varN1 = calculateVariation(rawCurr, rawN1);

    // Formatage affichage
    let displayVal = "";
    if (conf.type === "int") displayVal = formatNumber(rawCurr);
    else if (conf.type === "pct") displayVal = (rawCurr * 100).toFixed(1) + "%";
    else if (conf.type === "duration") displayVal = val; // On garde le texte GSheet "X min Y s"
    else if (conf.type === "float") displayVal = rawCurr.toFixed(2);

    return generateKPICardHtml(conf.label, displayVal, varM1, varN1, conf.invert);
  }).join('');
}

function generateKPICardHtml(label, value, varM1, varN1, invert) {
  const getStatusClass = (v) => {
    if (v === null) return "neutral";
    if (invert) return v > 0 ? "down" : "up"; // Pour le rebond, + est mauvais
    return v > 0 ? "up" : "down";
  };

  return `
    <div class="kpi-card">
      <h3>${label}</h3>
      <div class="kpi-value">${value}</div>
      <div class="kpi-comparisons">
        <div class="kpi-comparison">
          <span class="value ${getStatusClass(varM1)}">${varM1 !== null ? formatPercent(varM1) : "—"}</span>
          <span class="label">vs M-1</span>
        </div>
        <div class="kpi-comparison">
          <span class="value ${getStatusClass(varN1)}">${varN1 !== null ? formatPercent(varN1) : "—"}</span>
          <span class="label">vs N-1</span>
        </div>
      </div>
    </div>`;
}

// ------------------------------------------------------------------------------
// 7. MODULE : GRAPHIQUES (CHART.JS)
// ------------------------------------------------------------------------------

function renderChartsSection(sheetName, row, allRows, currentIndex) {
  const colors = PALETTES[sheetName].primary;

  // --- Graphique des Sources (Camembert) ---
  const ctxSources = document.getElementById("sourcesChart").getContext("2d");
  if (sourcesChart) sourcesChart.destroy();
  
  // On récupère les colonnes I, J, K, L, M, N
  const sourceData = [
    Number(row.moteurs_de_recherche || 0),
    Number(row.entrees_directes || 0),
    Number(row.sites_externes || 0),
    Number(row.assistants_ia || 0),    // Colonne M
    Number(row.reseaux_sociaux || 0), // Colonne L
    Number(row.campagnes || 0)
  ];

  sourcesChart = new Chart(ctxSources, {
    type: 'pie',
    plugins: [ChartDataLabels],
    data: {
      labels: ["Moteurs", "Direct", "Sites Ext.", "Assistants IA", "Réseaux Sociaux", "Campagnes"],
      datasets: [{
        data: sourceData,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: document.body.classList.contains('dark') ? '#16213e' : '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15 } },
        title: { display: true, text: 'Répartition des sources de trafic', font: { size: 14 } },
        datalabels: {
          color: '#fff',
          font: { weight: 'bold' },
          formatter: (value, ctx) => {
            let sum = ctx.dataset.data.reduce((a, b) => a + b, 0);
            let pct = (value * 100 / sum).toFixed(1) + "%";
            return value > 0 ? pct : '';
          }
        }
      }
    }
  });

  // --- Graphique des Devices (Camembert) ---
  const ctxDevices = document.getElementById("devicesChart").getContext("2d");
  if (devicesChart) devicesChart.destroy();

  devicesChart = new Chart(ctxDevices, {
    type: 'pie',
    plugins: [ChartDataLabels],
    data: {
      labels: ["Ordinateurs", "Smartphones", "Tablettes"],
      datasets: [{
        data: [
          Number(row.ordinateurs || 0),
          Number(row.smartphone || 0),
          Number(row.tablettes || 0)
        ],
        backgroundColor: [colors[0], colors[1], colors[2]]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        title: { display: true, text: 'Répartition par terminaux' }
      }
    }
  });

  // --- Graphique Evolution (Lignes - 12 mois glissants) ---
  const ctxEvol = document.getElementById("evolutionChart").getContext("2d");
  if (evolutionChart) evolutionChart.destroy();

  // On récupère les 12 mois précédents l'index courant
  const history = allRows.slice(currentIndex, currentIndex + 12).reverse();
  
  evolutionChart = new Chart(ctxEvol, {
    type: 'line',
    data: {
      labels: history.map(r => {
        const p = r.date.split('-');
        return p[1] + '/' + p[0].substring(2);
      }),
      datasets: [
        {
          label: 'Visites',
          data: history.map(r => r.visites),
          borderColor: colors[0],
          backgroundColor: colors[0] + '22',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Pages Vues',
          data: history.map(r => r.pages_vues),
          borderColor: colors[1],
          backgroundColor: colors[1] + '22',
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        title: { display: true, text: 'Évolution visites et pages vues (12 mois)' }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }
      }
    }
  });
}

// ------------------------------------------------------------------------------
// 8. MODULE : TOP PAGES (CLASSEMENT)
// ------------------------------------------------------------------------------

function renderTopPagesTable(sheetName, period) {
  const siteTag = sheetName.replace("Data ", ""); // FA ou AP
  const topRows = allData.sheets["Top Pages"]?.rows || [];
  
  // Filtrage sur le site et la période exacte
  const filtered = topRows.filter(r => r.site === siteTag && r.date.startsWith(period))
                          .sort((a, b) => a.position - b.position)
                          .slice(0, 10);

  const table = document.getElementById("top-pages-table");
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");

  thead.innerHTML = `
    <tr>
      <th class="position">#</th>
      <th class="evolution">Évol.</th>
      <th class="page-title">Titre de la page</th>
      <th class="numeric">Vues</th>
      <th class="numeric">% Trafic</th>
      <th class="numeric">Rebond</th>
      <th class="numeric">Temps moy.</th>
    </tr>`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem;">Aucune donnée Top Pages disponible.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    // Calcul de la classe CSS pour l'évolution
    let evoClass = "stable";
    if (p.evolution === "new") evoClass = "new";
    else if (p.evolution.startsWith("+")) evoClass = "up";
    else if (p.evolution.startsWith("-")) evoClass = "down";

    return `
      <tr>
        <td class="position">${p.position}</td>
        <td class="evolution ${evoClass}">${p.evolution === "new" ? "Nouveau" : p.evolution}</td>
        <td class="page-title">
          <a href="${p.url}" target="_blank" title="${p.url}">${p.titre_page}</a>
        </td>
        <td class="numeric">${formatNumber(p.vues)}</td>
        <td class="numeric">${(p.pct_trafic * 100).toFixed(1)}%</td>
        <td class="numeric">${(p.taux_rebond * 100).toFixed(0)}%</td>
        <td class="numeric">${p.temps_moyen || "—"}</td>
      </tr>`;
  }).join('');
}

// ------------------------------------------------------------------------------
// 9. FONCTIONS D'INTERFACE (UI)
// ------------------------------------------------------------------------------

function toggleDarkMode() {
  document.body.classList.toggle("dark");
  const btn = document.querySelector(".toggle-dark");
  btn.textContent = document.body.classList.contains("dark") ? "☀️ Mode clair" : "🌙 Mode sombre";
}

function exportPDF() {
  window.print();
}

async function refreshData() {
  const btn = document.querySelector(".refresh-btn");
  btn.classList.add("spinning"); // Si tu as une animation CSS
  
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(CACHE_MONTH_KEY);
  
  // Re-déclenche l'initialisation complète
  location.reload();
}

// ------------------------------------------------------------------------------
// 10. LANCEMENT
// ------------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", initDashboard);