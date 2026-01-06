// ============ CONFIGURATION ============
const API_URL = "https://script.google.com/macros/s/AKfycbzs5S-NuzbuRIx-PIR-QvZ6cf2j-YYvyYfVDTdL0upNwswgw4kzr75Q_wWB4TF2njcF/exec";

let allData = null;
let sourcesChart = null;
let devicesChart = null;
let evolutionChart = null;
let comparisonChart = null;

// Mapping des codes hash vers les noms de sheets
const SITE_CODES = {
  "FA": "Data FA",
  "AP": "Data AP"
};

const SITE_CODES_REVERSE = {
  "Data FA": "FA",
  "Data AP": "AP"
};

// Palettes de couleurs par site
const PALETTES = {
  "Data FA": {
    primary: ["#FA5629", "#007770", "#4984A9", "#68B0AC"],
    secondary: ["#FA5629CC", "#007770CC", "#4984A9CC", "#68B0ACCC"],
    tertiary: ["#FA562999", "#00777099", "#4984A999", "#68B0AC99"],
    accent: "#FA5629",
    dark: "#007770"
  },
  "Data AP": {
    primary: ["#fdc300", "#005da4", "#00a3bb", "#0587b5"],
    secondary: ["#0075b2", "#c13401", "#de5534", "#f07d19"],
    tertiary: ["#b9348b", "#483d8b", "#292e6b", "#7dd5bd"],
    accent: "#fdc300",
    dark: "#292e6b"
  }
};

const MOIS_NOMS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

// ============ COLOR UTILITIES ============
function getAllColors(sheetName) {
  const p = PALETTES[sheetName] || PALETTES["Data FA"];
  return [...p.primary, ...p.secondary, ...p.tertiary];
}

function getEvolutionColors(sheetName) {
  const p = PALETTES[sheetName] || PALETTES["Data FA"];
  return {
    visites: p.primary[0],
    pages_vues: p.primary[1],
    taux_rebond: p.primary[2],
    duree: p.primary[3]
  };
}

function getComparisonColors(sheetName) {
  const p = PALETTES[sheetName] || PALETTES["Data FA"];
  const baseColor = p.primary[1];
  return {
    current: baseColor,
    previous: baseColor + "99"
  };
}

// ============ HASH MANAGEMENT ============
function parseHash() {
  const hash = window.location.hash.replace('#', '');
  if (!hash) return null;
  
  // Format avec site : FA-2025 ou FA-2025-02
  const matchWithSite = hash.match(/^(FA|AP)-(\d{4})(?:-(\d{2}))?$/);
  if (matchWithSite) {
    const siteCode = matchWithSite[1];
    const year = matchWithSite[2];
    const month = matchWithSite[3];
    
    return {
      site: SITE_CODES[siteCode],
      type: month ? 'month' : 'year',
      value: month ? `${year}-${month}` : year
    };
  }
  
  // Format sans site (rétrocompatibilité) : 2025 ou 2025-02
  const matchYear = hash.match(/^(\d{4})$/);
  if (matchYear) {
    return { site: null, type: 'year', value: matchYear[1] };
  }
  
  const matchMonth = hash.match(/^(\d{4})-(\d{2})$/);
  if (matchMonth) {
    return { site: null, type: 'month', value: `${matchMonth[1]}-${matchMonth[2]}` };
  }
  
  return null;
}

function updateHash() {
  const siteSelect = document.getElementById("site-select");
  const periodSelect = document.getElementById("period-select");
  
  const siteCode = SITE_CODES_REVERSE[siteSelect.value] || "FA";
  const periodValue = periodSelect.value;
  
  let periodHash = '';
  if (periodValue.startsWith('year-')) {
    periodHash = periodValue.replace('year-', '');
  } else if (periodValue.startsWith('month-')) {
    periodHash = periodValue.replace('month-', '');
  }
  
  if (periodHash) {
    history.replaceState(null, null, '#' + siteCode + '-' + periodHash);
  }
}

function applyHashToSelectors() {
  const parsed = parseHash();
  if (!parsed) return false;
  
  const siteSelect = document.getElementById("site-select");
  const periodSelect = document.getElementById("period-select");
  
  let applied = false;
  
  // Appliquer le site si spécifié
  if (parsed.site) {
    const siteOptionExists = Array.from(siteSelect.options).some(opt => opt.value === parsed.site);
    if (siteOptionExists) {
      siteSelect.value = parsed.site;
      // Réinitialiser le sélecteur de période pour ce site
      initPeriodSelector();
      applied = true;
    }
  }
  
  // Appliquer la période
  let targetValue = '';
  if (parsed.type === 'year') {
    targetValue = `year-${parsed.value}`;
  } else if (parsed.type === 'month') {
    targetValue = `month-${parsed.value}`;
  }
  
  const periodOptionExists = Array.from(periodSelect.options).some(opt => opt.value === targetValue);
  if (periodOptionExists) {
    periodSelect.value = targetValue;
    applied = true;
  }
  
  return applied;
}

// ============ INITIALISATION ============
async function initDashboard() {
  try {
    const res = await fetch(API_URL);
    allData = await res.json();

    document.getElementById("loading").style.display = "none";
    document.getElementById("dashboard-content").style.display = "block";

    // Initialiser le sélecteur de période avec le site par défaut
    initPeriodSelector();
    
    // Appliquer le hash APRÈS que les données soient chargées et les selects remplis
    applyHashToSelectors();
    
    // Mettre à jour le hash initial (pour normaliser l'URL)
    updateHash();
    
    updateDashboard();

    // Event listeners
    document.getElementById("site-select").addEventListener("change", () => {
      initPeriodSelector();
      updateHash();
      updateDashboard();
    });
    
    document.getElementById("period-select").addEventListener("change", () => {
      updateHash();
      updateDashboard();
    });
    
    // Écouter les changements de hash (bouton retour/avant du navigateur)
    window.addEventListener("hashchange", () => {
      if (applyHashToSelectors()) {
        updateDashboard();
      }
    });

  } catch (err) {
    console.error("Erreur de récupération API :", err);
    document.getElementById("loading").textContent = "Erreur de chargement des données.";
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDashboard);
} else {
  initDashboard();
}

function initPeriodSelector() {
  const sheetName = document.getElementById("site-select").value;
  const rows = getRowsForSheet(sheetName);
  const periodSelect = document.getElementById("period-select");

  // Collecter les années et mois disponibles
  const yearMonths = {};
  rows.forEach(row => {
    const m = String(row.date).match(/^(\d{4})-(\d{2})/);
    if (m) {
      const year = m[1];
      const month = m[2];
      if (!yearMonths[year]) yearMonths[year] = [];
      if (!yearMonths[year].includes(month)) {
        yearMonths[year].push(month);
      }
    }
  });

  // Trier les années décroissantes et les mois décroissants (antéchronologique)
  const years = Object.keys(yearMonths).sort().reverse();
  years.forEach(year => {
    yearMonths[year].sort().reverse();
  });

  // Construire les options avec structure hiérarchique
  let options = '';
  years.forEach(year => {
    // Option pour l'année entière
    options += `<option value="year-${year}">${year}</option>`;
    // Options pour chaque mois (indentées avec tiret cadratin)
    yearMonths[year].forEach(month => {
      const monthName = MOIS_NOMS[parseInt(month) - 1];
      options += `<option value="month-${year}-${month}">— ${monthName}</option>`;
    });
  });

  periodSelect.innerHTML = options;
  
  // Sélectionner le dernier mois disponible par défaut
  if (years.length > 0) {
    const lastYear = years[0];
    const lastMonth = yearMonths[lastYear][0];
    periodSelect.value = `month-${lastYear}-${lastMonth}`;
  }
}

// ============ DATA ACCESS ============
function getRowsForSheet(sheetName) {
  if (!allData?.sheets?.[sheetName]) return [];
  return allData.sheets[sheetName].rows || [];
}

function getTopPagesForSite(siteName) {
  if (!allData?.sheets?.["Top Pages"]) return [];
  const allTopPages = allData.sheets["Top Pages"].rows || [];
  return allTopPages.filter(row => row.site === siteName);
}

function getRowForMonth(rows, ym) {
  return rows.find(row => {
    const m = String(row.date).match(/^(\d{4})-(\d{2})/);
    return m && `${m[1]}-${m[2]}` === ym;
  }) || null;
}

// ============ UTILITIES ============
function parseDuration(str) {
  if (!str) return 0;
  const m = str.match(/(\d+)\s*min\s*(\d+)?\s*s?/);
  if (m) {
    return parseInt(m[1]) * 60 + (parseInt(m[2]) || 0);
  }
  return 0;
}

function formatDuration(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return `${min} min ${sec} s`;
}

function formatMonthYear(ym) {
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (!m) return ym;
  const year = m[1];
  const monthIndex = parseInt(m[2]) - 1;
  return `${MOIS_NOMS[monthIndex]} ${year}`;
}

function formatPercent(value, showSign = true) {
  if (value === null || value === undefined || isNaN(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return (showSign && value > 0 ? sign : "") + value.toFixed(1) + "%";
}

function formatNumber(n) {
  return n.toLocaleString("fr-FR");
}

function calcVariation(current, previous) {
  if (!previous || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

// ============ UPDATE DASHBOARD ============
function updateDashboard() {
  const sheetName = document.getElementById("site-select").value;
  const periodValue = document.getElementById("period-select").value;
  const rows = getRowsForSheet(sheetName);

  if (periodValue.startsWith("year-")) {
    const year = periodValue.replace("year-", "");
    updateYearlyView(sheetName, rows, year);
  } else if (periodValue.startsWith("month-")) {
    const parts = periodValue.replace("month-", "").split("-");
    const ym = `${parts[0]}-${parts[1]}`;
    updateMonthlyView(sheetName, rows, ym);
  }
}

// ============ MONTHLY VIEW ============
function updateMonthlyView(sheetName, rows, ym) {
  const [year, month] = ym.split("-");
  
  const currentRow = getRowForMonth(rows, ym);
  
  const prevMonth = parseInt(month) === 1 
    ? `${parseInt(year) - 1}-12` 
    : `${year}-${String(parseInt(month) - 1).padStart(2, "0")}`;
  const prevMonthRow = getRowForMonth(rows, prevMonth);
  
  const prevYearMonth = `${parseInt(year) - 1}-${month}`;
  const prevYearRow = getRowForMonth(rows, prevYearMonth);

  renderKPIs(currentRow, prevMonthRow, prevYearRow, "M-1", `${MOIS_NOMS[parseInt(month)-1]} ${parseInt(year)-1}`);

  document.getElementById("section-repartition").textContent = `Sources de trafic et devices – ${formatMonthYear(ym)}`;
  renderSourcesPie(sheetName, ym, currentRow);
  renderDevicesPie(sheetName, ym, currentRow);

  updateTopPages(sheetName, ym);

  const monthIndex = rows.findIndex(r => {
    const m = String(r.date).match(/^(\d{4})-(\d{2})/);
    return m && `${m[1]}-${m[2]}` === ym;
  });
  const last12 = rows.slice(Math.max(0, monthIndex - 11), monthIndex + 1);
  renderEvolutionChart(last12, `Évolution sur 12 mois (jusqu'à ${formatMonthYear(ym)})`, sheetName);

  document.getElementById("comparison-section").style.display = "none";
}

// ============ YEARLY VIEW ============
function updateYearlyView(sheetName, rows, year) {
  const yearRows = rows.filter(r => String(r.date).startsWith(year));
  const prevYearRows = rows.filter(r => String(r.date).startsWith(String(parseInt(year) - 1)));

  const currentAgg = aggregateRows(yearRows);
  const prevAgg = aggregateRows(prevYearRows);

  renderKPIsFromAgg(currentAgg, prevAgg, `${parseInt(year)-1}`);

  document.getElementById("section-repartition").textContent = `Sources de trafic et devices – Année ${year}`;
  renderSourcesPieFromAgg(sheetName, year, currentAgg);
  renderDevicesPieFromAgg(sheetName, year, currentAgg);

  updateTopPages(sheetName, year);

  renderEvolutionChart(yearRows, `Évolution mensuelle - ${year}`, sheetName);

  document.getElementById("comparison-section").style.display = "block";
  document.getElementById("section-comparison").textContent = `Comparaison ${year} vs ${parseInt(year)-1}`;
  renderComparisonChart(rows, year, sheetName);
}

function aggregateRows(rows) {
  if (!rows || rows.length === 0) return null;
  const agg = {
    visites: 0,
    pages_vues: 0,
    taux_rebond_sum: 0,
    duree_sum: 0,
    actions_moy_sum: 0,
    count: rows.length,
    moteurs_de_recherche: 0,
    entrees_directes: 0,
    sites_externes: 0,
    reseaux_sociaux: 0,
    campagnes: 0,
    ordinateurs: 0,
    smartphone: 0,
    tablettes: 0
  };
  rows.forEach(r => {
    agg.visites += Number(r.visites || 0);
    agg.pages_vues += Number(r.pages_vues || 0);
    agg.taux_rebond_sum += Number(r.taux_de_rebond || 0);
    agg.duree_sum += parseDuration(r.duree_moyenne);
    agg.actions_moy_sum += Number(r.actions_moy || 0);
    agg.moteurs_de_recherche += Number(r.moteurs_de_recherche || 0);
    agg.entrees_directes += Number(r.entrees_directes || 0);
    agg.sites_externes += Number(r.sites_externes || 0);
    agg.reseaux_sociaux += Number(r.reseaux_sociaux || 0);
    agg.campagnes += Number(r.campagnes || 0);
    agg.ordinateurs += Number(r.ordinateurs || 0);
    agg.smartphone += Number(r.smartphone || 0);
    agg.tablettes += Number(r.tablettes || 0);
  });
  agg.taux_rebond = agg.taux_rebond_sum / agg.count;
  agg.duree_moyenne = agg.duree_sum / agg.count;
  agg.actions_moy = agg.actions_moy_sum / agg.count;
  return agg;
}

// ============ RENDER KPIs ============
function renderKPIs(current, prevMonth, prevYear, labelM1, labelN1) {
  const grid = document.getElementById("kpis-grid");
  
  if (!current) {
    grid.innerHTML = '<div class="kpi-card">Aucune donnée</div>';
    return;
  }

  const visites = Number(current.visites || 0);
  const pagesVues = Number(current.pages_vues || 0);
  const tauxRebond = Number(current.taux_de_rebond || 0) * 100;
  const duree = parseDuration(current.duree_moyenne);
  const actionsMoy = Number(current.actions_moy || 0);

  const visitesM1 = prevMonth ? Number(prevMonth.visites || 0) : null;
  const visitesN1 = prevYear ? Number(prevYear.visites || 0) : null;
  const pagesM1 = prevMonth ? Number(prevMonth.pages_vues || 0) : null;
  const pagesN1 = prevYear ? Number(prevYear.pages_vues || 0) : null;
  const rebondM1 = prevMonth ? Number(prevMonth.taux_de_rebond || 0) * 100 : null;
  const rebondN1 = prevYear ? Number(prevYear.taux_de_rebond || 0) * 100 : null;
  const dureeM1 = prevMonth ? parseDuration(prevMonth.duree_moyenne) : null;
  const dureeN1 = prevYear ? parseDuration(prevYear.duree_moyenne) : null;
  const actionsM1 = prevMonth ? Number(prevMonth.actions_moy || 0) : null;
  const actionsN1 = prevYear ? Number(prevYear.actions_moy || 0) : null;

  grid.innerHTML = `
    ${renderKPICard("Visites", formatNumber(visites), calcVariation(visites, visitesM1), calcVariation(visites, visitesN1), labelM1, labelN1)}
    ${renderKPICard("Pages vues", formatNumber(pagesVues), calcVariation(pagesVues, pagesM1), calcVariation(pagesVues, pagesN1), labelM1, labelN1)}
    ${renderKPICard("Taux de rebond", tauxRebond.toFixed(1) + "%", calcVariation(tauxRebond, rebondM1), calcVariation(tauxRebond, rebondN1), labelM1, labelN1, true)}
    ${renderKPICard("Durée moyenne", formatDuration(duree), calcVariation(duree, dureeM1), calcVariation(duree, dureeN1), labelM1, labelN1)}
    ${renderKPICard("Actions moyennes", actionsMoy.toFixed(1), calcVariation(actionsMoy, actionsM1), calcVariation(actionsMoy, actionsN1), labelM1, labelN1)}
  `;
}

function renderKPIsFromAgg(current, prev, labelPrev) {
  const grid = document.getElementById("kpis-grid");
  
  if (!current) {
    grid.innerHTML = '<div class="kpi-card">Aucune donnée</div>';
    return;
  }

  const visites = current.visites;
  const pagesVues = current.pages_vues;
  const tauxRebond = current.taux_rebond * 100;
  const duree = current.duree_moyenne;
  const actionsMoy = current.actions_moy;

  const visitesP = prev ? prev.visites : null;
  const pagesP = prev ? prev.pages_vues : null;
  const rebondP = prev ? prev.taux_rebond * 100 : null;
  const dureeP = prev ? prev.duree_moyenne : null;
  const actionsP = prev ? prev.actions_moy : null;

  grid.innerHTML = `
    ${renderKPICard("Visites", formatNumber(visites), null, calcVariation(visites, visitesP), "", labelPrev)}
    ${renderKPICard("Pages vues", formatNumber(pagesVues), null, calcVariation(pagesVues, pagesP), "", labelPrev)}
    ${renderKPICard("Taux de rebond", tauxRebond.toFixed(1) + "%", null, calcVariation(tauxRebond, rebondP), "", labelPrev, true)}
    ${renderKPICard("Durée moyenne", formatDuration(duree), null, calcVariation(duree, dureeP), "", labelPrev)}
    ${renderKPICard("Actions moyennes", actionsMoy.toFixed(1), null, calcVariation(actionsMoy, actionsP), "", labelPrev)}
  `;
}

function renderKPICard(title, value, varM1, varN1, labelM1, labelN1, invertColors = false) {
  const getClass = (v) => {
    if (v === null) return "neutral";
    if (invertColors) return v > 0 ? "down" : v < 0 ? "up" : "neutral";
    return v > 0 ? "up" : v < 0 ? "down" : "neutral";
  };

  return `
    <div class="kpi-card">
      <h3>${title}</h3>
      <div class="kpi-value">${value}</div>
      <div class="kpi-comparisons">
        ${labelM1 && varM1 !== null ? `<div class="kpi-comparison">
          <span class="label">vs ${labelM1}:</span>
          <span class="value ${getClass(varM1)}">${formatPercent(varM1)}</span>
        </div>` : ""}
        ${labelN1 && varN1 !== null ? `<div class="kpi-comparison">
          <span class="label">vs ${labelN1}:</span>
          <span class="value ${getClass(varN1)}">${formatPercent(varN1)}</span>
        </div>` : ""}
      </div>
    </div>
  `;
}

// ============ PIE CHARTS ============
function renderSourcesPie(sheetName, ym, row) {
  const ctx = document.getElementById("sourcesChart").getContext("2d");
  if (sourcesChart) sourcesChart.destroy();

  if (!row) {
    sourcesChart = new Chart(ctx, { type: "pie", data: { labels: [], datasets: [] } });
    return;
  }

  const siteLabel = sheetName === "Data FA" ? "France Assureurs" : "Assurance Prévention";
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  const monthLabel = m ? `${m[2]}/${m[1]}` : ym;

  const data = [
    Number(row.moteurs_de_recherche || 0),
    Number(row.entrees_directes || 0),
    Number(row.sites_externes || 0),
    Number(row.reseaux_sociaux || 0),
    Number(row.campagnes || 0)
  ];

  sourcesChart = new Chart(ctx, {
    type: "pie",
    plugins: [ChartDataLabels],
    data: {
      labels: ["Moteurs de recherche", "Entrées directes", "Sites externes", "Réseaux sociaux", "Campagnes"],
      datasets: [{ data, backgroundColor: getAllColors(sheetName).slice(0, 5), borderWidth: 2, borderColor: "#fff" }]
    },
    options: getPieOptions(`Sources de trafic – ${siteLabel} – ${monthLabel}`)
  });
}

function renderSourcesPieFromAgg(sheetName, label, agg) {
  const ctx = document.getElementById("sourcesChart").getContext("2d");
  if (sourcesChart) sourcesChart.destroy();

  if (!agg) {
    sourcesChart = new Chart(ctx, { type: "pie", data: { labels: [], datasets: [] } });
    return;
  }

  const siteLabel = sheetName === "Data FA" ? "France Assureurs" : "Assurance Prévention";
  const data = [agg.moteurs_de_recherche, agg.entrees_directes, agg.sites_externes, agg.reseaux_sociaux, agg.campagnes];

  sourcesChart = new Chart(ctx, {
    type: "pie",
    plugins: [ChartDataLabels],
    data: {
      labels: ["Moteurs de recherche", "Entrées directes", "Sites externes", "Réseaux sociaux", "Campagnes"],
      datasets: [{ data, backgroundColor: getAllColors(sheetName).slice(0, 5), borderWidth: 2, borderColor: "#fff" }]
    },
    options: getPieOptions(`Sources de trafic – ${siteLabel} – ${label}`)
  });
}

function renderDevicesPie(sheetName, ym, row) {
  const ctx = document.getElementById("devicesChart").getContext("2d");
  if (devicesChart) devicesChart.destroy();

  if (!row) {
    devicesChart = new Chart(ctx, { type: "pie", data: { labels: [], datasets: [] } });
    return;
  }

  const siteLabel = sheetName === "Data FA" ? "France Assureurs" : "Assurance Prévention";
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  const monthLabel = m ? `${m[2]}/${m[1]}` : ym;

  const data = [
    Number(row.ordinateurs || 0),
    Number(row.smartphone || 0),
    Number(row.tablettes || 0)
  ];

  const colors = PALETTES[sheetName]?.primary || PALETTES["Data FA"].primary;

  devicesChart = new Chart(ctx, {
    type: "pie",
    plugins: [ChartDataLabels],
    data: {
      labels: ["Ordinateurs", "Smartphones", "Tablettes"],
      datasets: [{ data, backgroundColor: [colors[0], colors[1], colors[2]], borderWidth: 2, borderColor: "#fff" }]
    },
    options: getPieOptions(`Périphériques – ${siteLabel} – ${monthLabel}`)
  });
}

function renderDevicesPieFromAgg(sheetName, label, agg) {
  const ctx = document.getElementById("devicesChart").getContext("2d");
  if (devicesChart) devicesChart.destroy();

  if (!agg) {
    devicesChart = new Chart(ctx, { type: "pie", data: { labels: [], datasets: [] } });
    return;
  }

  const siteLabel = sheetName === "Data FA" ? "France Assureurs" : "Assurance Prévention";
  const data = [agg.ordinateurs, agg.smartphone, agg.tablettes];
  const colors = PALETTES[sheetName]?.primary || PALETTES["Data FA"].primary;

  devicesChart = new Chart(ctx, {
    type: "pie",
    plugins: [ChartDataLabels],
    data: {
      labels: ["Ordinateurs", "Smartphones", "Tablettes"],
      datasets: [{ data, backgroundColor: [colors[0], colors[1], colors[2]], borderWidth: 2, borderColor: "#fff" }]
    },
    options: getPieOptions(`Périphériques – ${siteLabel} – ${label}`)
  });
}

function getPieOptions(title) {
  return {
    responsive: true,
    plugins: {
      datalabels: {
        color: "#fff",
        font: { weight: "bold", size: 13 },
        formatter: (value, ctx) => {
          const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
          if (total === 0 || value === 0) return "";
          const pct = (value / total) * 100;
          return pct >= 5 ? pct.toFixed(1) + "%" : "";
        }
      },
      title: { display: true, text: title, font: { size: 14, weight: "bold" } },
      legend: { position: "bottom" },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct = total > 0 ? (ctx.parsed / total) * 100 : 0;
            return ` ${ctx.label} : ${formatNumber(ctx.parsed)} (${pct.toFixed(1)}%)`;
          }
        }
      }
    }
  };
}

// ============ EVOLUTION CHART ============
function renderEvolutionChart(rows, title, sheetName) {
  const ctx = document.getElementById("evolutionChart").getContext("2d");
  if (evolutionChart) evolutionChart.destroy();

  const COLORS = getEvolutionColors(sheetName || document.getElementById("site-select").value);

  const labels = rows.map(r => {
    const m = String(r.date).match(/^(\d{4})-(\d{2})/);
    return m ? `${m[2]}/${m[1]}` : r.date;
  });

  evolutionChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Visites",
          data: rows.map(r => Number(r.visites || 0)),
          borderColor: COLORS.visites,
          backgroundColor: COLORS.visites + "20",
          yAxisID: "y",
          tension: 0.3
        },
        {
          label: "Pages vues",
          data: rows.map(r => Number(r.pages_vues || 0)),
          borderColor: COLORS.pages_vues,
          backgroundColor: COLORS.pages_vues + "20",
          yAxisID: "y",
          tension: 0.3
        },
        {
          label: "Taux de rebond (%)",
          data: rows.map(r => Number(r.taux_de_rebond || 0) * 100),
          borderColor: COLORS.taux_rebond,
          backgroundColor: COLORS.taux_rebond + "20",
          yAxisID: "y1",
          tension: 0.3
        },
        {
          label: "Durée (sec)",
          data: rows.map(r => parseDuration(r.duree_moyenne)),
          borderColor: COLORS.duree,
          backgroundColor: COLORS.duree + "20",
          yAxisID: "y1",
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: "index", intersect: false },
      plugins: {
        title: { display: true, text: title, font: { size: 14, weight: "bold" } },
        legend: { position: "bottom" }
      },
      scales: {
        y: {
          type: "linear",
          position: "left",
          title: { display: true, text: "Visites / Pages vues" }
        },
        y1: {
          type: "linear",
          position: "right",
          title: { display: true, text: "Taux rebond (%) / Durée (s)" },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

// ============ COMPARISON CHART ============
function renderComparisonChart(rows, year, sheetName) {
  const ctx = document.getElementById("comparisonChart").getContext("2d");
  if (comparisonChart) comparisonChart.destroy();

  const colors = getComparisonColors(sheetName || document.getElementById("site-select").value);

  const prevYear = String(parseInt(year) - 1);
  const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
  const labels = MOIS_NOMS;

  const currentData = months.map(m => {
    const row = getRowForMonth(rows, `${year}-${m}`);
    return row ? Number(row.visites || 0) : 0;
  });

  const prevData = months.map(m => {
    const row = getRowForMonth(rows, `${prevYear}-${m}`);
    return row ? Number(row.visites || 0) : 0;
  });

  comparisonChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: year,
          data: currentData,
          backgroundColor: colors.current
        },
        {
          label: prevYear,
          data: prevData,
          backgroundColor: colors.previous
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: `Visites mensuelles : ${year} vs ${prevYear}`, font: { size: 14, weight: "bold" } },
        legend: { position: "bottom" }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

// ============ TOP PAGES ============
function updateTopPages(sheetName, period) {
  const topPages = getTopPagesForSite(sheetName);
  
  const isYear = period.length === 4;
  
  let filtered;
  if (isYear) {
    filtered = topPages.filter(row => String(row.date) === period);
  } else {
    filtered = topPages.filter(row => {
      const m = String(row.date).match(/^(\d{4})-(\d{2})/);
      return m && `${m[1]}-${m[2]}` === period;
    });
  }
  
  filtered = filtered.sort((a, b) => a.position - b.position).slice(0, 10);
  
  const thead = document.querySelector("#top-pages-table thead");
  const tbody = document.querySelector("#top-pages-table tbody");
  
  if (filtered.length === 0) {
    thead.innerHTML = "";
    tbody.innerHTML = "<tr><td colspan='7' style='text-align:center;color:#888;'>Aucune donnée Top Pages pour cette période</td></tr>";
    return;
  }
  
  const periodLabel = isYear ? `Année ${period}` : formatMonthYear(period);
  document.getElementById("section-top-pages").textContent = `🏆 Top 10 des pages les plus consultées – ${periodLabel}`;
  
  thead.innerHTML = `
    <tr>
      <th class="position">#</th>
      <th class="evolution">Évol.</th>
      <th class="page-title">Page</th>
      <th class="numeric">Vues</th>
      <th class="numeric">% Trafic</th>
      <th class="numeric">Taux rebond</th>
      <th class="numeric">Temps moy.</th>
    </tr>
  `;
  
  tbody.innerHTML = filtered.map(row => {
    const evolutionClass = getEvolutionClass(row.evolution);
    const evolutionLabel = getEvolutionLabel(row.evolution);
    
    return `
      <tr>
        <td class="position">${row.position}</td>
        <td class="evolution ${evolutionClass}">${evolutionLabel}</td>
        <td class="page-title">
          <a href="${row.url}" target="_blank" title="${row.titre_page}">${truncateText(row.titre_page, 60)}</a>
        </td>
        <td class="numeric">${formatNumber(row.vues)}</td>
        <td class="numeric">${(row.pct_trafic * 100).toFixed(2)}%</td>
        <td class="numeric">${(row.taux_rebond * 100).toFixed(1)}%</td>
        <td class="numeric">${row.temps_moyen}</td>
      </tr>
    `;
  }).join("");
}

function getEvolutionClass(evolution) {
  if (evolution === "new") return "new";
  if (evolution === "stable" || evolution === "=" || evolution === "—") return "stable";
  const num = parseInt(evolution);
  if (num > 0) return "up";
  if (num < 0) return "down";
  return "stable";
}

function getEvolutionLabel(evolution) {
  if (evolution === "new") return "🆕 New";
  if (evolution === "stable" || evolution === "=" || evolution === "—") return "— Stable";
  const num = parseInt(evolution);
  if (num > 0) return `↑ +${num}`;
  if (num < 0) return `↓ ${num}`;
  return "-";
}

function truncateText(text, maxLength) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

// ============ DARK MODE ============
function toggleDarkMode() {
  document.body.classList.toggle("dark");
  const btn = document.querySelector(".toggle-dark");
  btn.textContent = document.body.classList.contains("dark") ? "☀️ Mode clair" : "🌙 Mode sombre";
}

// ============ EXPORT PDF ============
function exportPDF() {
  window.print();
}
