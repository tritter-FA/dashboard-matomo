/* ============ CONFIGURATION ============ */
const API_URL = "https://script.google.com/macros/s/AKfycbzs5S-NuzbuRIx-PIR-QvZ6cf2j-YYvyYfVDTdL0upNwswgw4kzr75Q_wWB4TF2njcF/exec";
const CACHE_KEY = "matomo_dashboard_cache";
const CACHE_MONTH_KEY = "matomo_dashboard_cache_month";

let allData = null;
let sourcesChart = null;
let devicesChart = null;
let evolutionChart = null;
let comparisonChart = null;

// Mapping des codes hash vers les noms de sheets
const SITE_CODES = {
  "FA": "Data FA",
  "AP": "Data AP",
  "RR": "Data RR"
};

const SITE_CODES_REVERSE = {
  "Data FA": "FA",
  "Data AP": "AP",
  "Data RR": "RR"
};

// Palettes de couleurs par site
const PALETTES = {
  "Data FA": {
    primary: ["#FA5629", "#007770", "#4984A9", "#68B0AC", "#FFB347", "#77DD77"],
    secondary: ["#FA5629CC", "#007770CC", "#4984A9CC", "#68B0ACCC"],
    tertiary: ["#FA562999", "#00777099", "#4984A999", "#68B0AC99"],
    accent: "#FA5629",
    dark: "#007770"
  },
  "Data AP": {
    primary: ["#fdc300", "#005da4", "#00a3bb", "#0587b5", "#f07d19", "#292e6b"],
    secondary: ["#0075b2", "#c13401", "#de5534", "#f07d19"],
    tertiary: ["#b9348b", "#483d8b", "#292e6b", "#7dd5bd"],
    accent: "#fdc300",
    dark: "#292e6b"
  },
  // PALETTE REVUE RISQUES (Teal/Turquoise)
  "Data RR": {
    primary: ["#23ACA5", "#50CBCA", "#d68b94", "#c9bb90", "#65589c", "#24688d"],
    secondary: ["#23ACA5CC", "#50CBCACC", "#d68b94CC", "#c9bb90CC", "#65589cCC", "#24688dCC"],
    tertiary: ["#23ACA599", "#50CBCA99", "#d68b9499", "#c9bb9099", "#65589c99", "#24688d99"],
    accent: "#23ACA5",
    dark: "#24688d"
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
  var hash = window.location.hash.replace('#', '');
  if (!hash) return null;
  
  var match = hash.match(/^(FA|AP|RR)-(\d{4})(?:-(\d{2}))?$/);
  if (!match) return null;
  
  var siteCode = match[1];
  var year = match[2];
  var month = match[3];
  
  return {
    site: SITE_CODES[siteCode],
    type: month ? 'month' : 'year',
    value: month ? (year + '-' + month) : year
  };
}

function updateHash() {
  var siteSelect = document.getElementById("site-select");
  var periodSelect = document.getElementById("period-select");
  
  var siteCode = SITE_CODES_REVERSE[siteSelect.value] || "FA";
  var periodValue = periodSelect.value;
  
  var periodHash = '';
  if (periodValue.indexOf('year-') === 0) {
    periodHash = periodValue.replace('year-', '');
  } else if (periodValue.indexOf('month-') === 0) {
    periodHash = periodValue.replace('month-', '');
  }
  
  if (periodHash) {
    history.replaceState(null, null, '#' + siteCode + '-' + periodHash);
  }
}

function applyHashToSelectors() {
  var parsed = parseHash();
  if (!parsed) return false;
  
  var siteSelect = document.getElementById("site-select");
  var periodSelect = document.getElementById("period-select");
  
  var siteExists = false;
  for (var i = 0; i < siteSelect.options.length; i++) {
    if (siteSelect.options[i].value === parsed.site) {
      siteExists = true;
      break;
    }
  }
  if (!siteExists) return false;
  
  siteSelect.value = parsed.site;
  initPeriodSelector();
  
  var targetValue = '';
  if (parsed.type === 'year') {
    targetValue = 'year-' + parsed.value;
  } else if (parsed.type === 'month') {
    targetValue = 'month-' + parsed.value;
  }
  
  var periodExists = false;
  for (var j = 0; j < periodSelect.options.length; j++) {
    if (periodSelect.options[j].value === targetValue) {
      periodExists = true;
      break;
    }
  }
  
  if (periodExists) {
    periodSelect.value = targetValue;
  }
  
  return true;
}

// ============ CACHE MANAGEMENT ============
function getCurrentMonth() {
  var now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}

function getCachedData() {
  try {
    var cachedMonth = localStorage.getItem(CACHE_MONTH_KEY);
    var currentMonth = getCurrentMonth();
    
    if (cachedMonth !== currentMonth) {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_MONTH_KEY);
      return null;
    }
    
    var cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.warn('Erreur lecture cache:', e);
  }
  return null;
}

function setCachedData(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(CACHE_MONTH_KEY, getCurrentMonth());
  } catch (e) {
    console.warn('Erreur écriture cache:', e);
  }
}

function clearCache() {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(CACHE_MONTH_KEY);
  alert('Cache vidé. Rechargez la page pour récupérer les données fraîches.');
}

// ============ INITIALISATION ============
async function initDashboard() {
  try {
    var cached = getCachedData();
    
    if (cached) {
      console.log('Données chargées depuis le cache');
      allData = cached;
    } else {
      console.log('Récupération des données depuis l\'API...');
      var res = await fetch(API_URL);
      allData = await res.json();
      setCachedData(allData);
      console.log('Données mises en cache');
    }

    document.getElementById("loading").style.display = "none";
    document.getElementById("dashboard-content").style.display = "block";

    initPeriodSelector();
    
    var hashApplied = applyHashToSelectors();
    if (!hashApplied) {
      updateHash();
    }
    
    updateDashboard();

    document.getElementById("site-select").addEventListener("change", function() {
      initPeriodSelector();
      updateHash();
      updateDashboard();
    });
    
    document.getElementById("period-select").addEventListener("change", function() {
      updateHash();
      updateDashboard();
    });
    
    window.addEventListener("hashchange", function() {
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
  var sheetName = document.getElementById("site-select").value;
  var rows = getRowsForSheet(sheetName);
  var periodSelect = document.getElementById("period-select");

  var yearMonths = {};
  rows.forEach(function(row) {
    var m = String(row.date).match(/^(\d{4})-(\d{2})/);
    if (m) {
      var year = m[1];
      var month = m[2];
      if (!yearMonths[year]) yearMonths[year] = [];
      if (yearMonths[year].indexOf(month) === -1) {
        yearMonths[year].push(month);
      }
    }
  });

  var years = Object.keys(yearMonths).sort().reverse();
  years.forEach(function(year) {
    yearMonths[year].sort().reverse();
  });

  var options = '';
  years.forEach(function(year) {
    options += '<option value="year-' + year + '">' + year + '</option>';
    yearMonths[year].forEach(function(month) {
      var monthName = MOIS_NOMS[parseInt(month) - 1];
      options += '<option value="month-' + year + '-' + month + '">— ' + monthName + '</option>';
    });
  });

  periodSelect.innerHTML = options;
  
  if (years.length > 0) {
    var lastYear = years[0];
    var lastMonth = yearMonths[lastYear][0];
    periodSelect.value = 'month-' + lastYear + '-' + lastMonth;
  }
}

// ============ DATA ACCESS ============
function getRowsForSheet(sheetName) {
  if (!allData || !allData.sheets || !allData.sheets[sheetName]) return [];
  return allData.sheets[sheetName].rows || [];
}

function getTopPagesForSite(siteName) {
  if (!allData || !allData.sheets || !allData.sheets["Top Pages"]) return [];
  var allTopPages = allData.sheets["Top Pages"].rows || [];
  return allTopPages.filter(function(row) { return row.site === siteName; });
}

function getRowForMonth(rows, ym) {
  for (var i = 0; i < rows.length; i++) {
    var m = String(rows[i].date).match(/^(\d{4})-(\d{2})/);
    if (m && (m[1] + '-' + m[2]) === ym) {
      return rows[i];
    }
  }
  return null;
}

// ============ UTILITIES ============
function parseDuration(str) {
  if (!str) return 0;
  var m = str.match(/(\d+)\s*min\s*(\d+)?\s*s?/);
  if (m) {
    return parseInt(m[1]) * 60 + (parseInt(m[2]) || 0);
  }
  return 0;
}

function formatDuration(seconds) {
  var min = Math.floor(seconds / 60);
  var sec = Math.round(seconds % 60);
  return min + ' min ' + sec + ' s';
}

function formatMonthYear(ym) {
  var m = ym.match(/^(\d{4})-(\d{2})$/);
  if (!m) return ym;
  var year = m[1];
  var monthIndex = parseInt(m[2]) - 1;
  return MOIS_NOMS[monthIndex] + ' ' + year;
}

function formatPercent(value, showSign) {
  if (showSign === undefined) showSign = true;
  if (value === null || value === undefined || isNaN(value)) return "-";
  var sign = value > 0 ? "+" : "";
  return (showSign && value > 0 ? sign : "") + value.toFixed(1) + "%";
}

function formatNumber(n) {
  return Number(n || 0).toLocaleString("fr-FR");
}

function calcVariation(current, previous) {
  if (!previous || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

// ============ UPDATE DASHBOARD ============
function updateDashboard() {
  var sheetName = document.getElementById("site-select").value;
  var periodValue = document.getElementById("period-select").value;
  var rows = getRowsForSheet(sheetName);

  // C'est cette fonction qui gère le titre.
  updatePrintTitle(sheetName, periodValue);

  if (periodValue.indexOf("year-") === 0) {
    var year = periodValue.replace("year-", "");
    updateYearlyView(sheetName, rows, year);
  } else if (periodValue.indexOf("month-") === 0) {
    var parts = periodValue.replace("month-", "").split("-");
    var ym = parts[0] + "-" + parts[1];
    updateMonthlyView(sheetName, rows, ym);
  }
}

// === FIX TITRE : VERSION ROBUSTE ===
function updatePrintTitle(sheetName, periodValue) {
  // 1. Définition du nom du site
  var siteName = sheetName;
  if (sheetName === "Data FA") siteName = "France Assureurs";
  else if (sheetName === "Data AP") siteName = "Assurance Prévention";
  else if (sheetName === "Data RR") siteName = "Revue Risques";
  
  // 2. Définition de la période
  var periodLabel = '';
  if (periodValue.indexOf("year-") === 0) {
    periodLabel = periodValue.replace("year-", "");
  } else if (periodValue.indexOf("month-") === 0) {
    var parts = periodValue.replace("month-", "").split("-");
    if (parts.length >= 2) {
      var monthIndex = parseInt(parts[1]) - 1;
      if (MOIS_NOMS[monthIndex]) {
        periodLabel = MOIS_NOMS[monthIndex] + ' ' + parts[0];
      } else {
        periodLabel = parts[1] + '/' + parts[0];
      }
    }
  }
  
  // 3. Mise à jour Onglet Navigateur
  document.title = 'Dashboard - ' + siteName + ' - ' + periodLabel;

  // 4. Mise à jour du SPAN dans le H1
  var printPeriod = document.getElementById("print-period");
  if (printPeriod) {
    printPeriod.textContent = ' — ' + siteName + ' — ' + periodLabel;
    console.log("✅ TITRE MIS À JOUR : " + printPeriod.textContent);
  } else {
    // Si l'élément n'existe pas, on loggue une erreur visible
    console.error("❌ ERREUR : Élément <span id='print-period'> non trouvé dans le HTML");
  }
}

// ============ MONTHLY VIEW ============
function updateMonthlyView(sheetName, rows, ym) {
  var parts = ym.split("-");
  var year = parts[0];
  var month = parts[1];
  
  var currentRow = getRowForMonth(rows, ym);
  
  var prevMonth;
  if (parseInt(month) === 1) {
    prevMonth = (parseInt(year) - 1) + '-12';
  } else {
    prevMonth = year + '-' + String(parseInt(month) - 1).padStart(2, "0");
  }
  var prevMonthRow = getRowForMonth(rows, prevMonth);
  
  var prevYearMonth = (parseInt(year) - 1) + '-' + month;
  var prevYearRow = getRowForMonth(rows, prevYearMonth);

  renderKPIs(currentRow, prevMonthRow, prevYearRow, "M-1", MOIS_NOMS[parseInt(month)-1] + ' ' + (parseInt(year)-1));

  document.getElementById("section-repartition").textContent = 'Sources de trafic et devices – ' + formatMonthYear(ym);
  renderSourcesPie(sheetName, ym, currentRow);
  renderDevicesPie(sheetName, ym, currentRow);

  updateTopPages(sheetName, ym);

  var monthIndex = -1;
  for (var i = 0; i < rows.length; i++) {
    var m = String(rows[i].date).match(/^(\d{4})-(\d{2})/);
    if (m && (m[1] + '-' + m[2]) === ym) {
      monthIndex = i;
      break;
    }
  }
  var last12 = rows.slice(Math.max(0, monthIndex - 11), monthIndex + 1);
  renderEvolutionChart(last12, 'Évolution sur 12 mois (jusqu\'à ' + formatMonthYear(ym) + ')', sheetName);

  document.getElementById("comparison-section").style.display = "none";
}

// ============ YEARLY VIEW ============
function updateYearlyView(sheetName, rows, year) {
  var yearRows = rows.filter(function(r) { return String(r.date).indexOf(year) === 0; });
  var prevYearRows = rows.filter(function(r) { return String(r.date).indexOf(String(parseInt(year) - 1)) === 0; });

  var currentAgg = aggregateRows(yearRows);
  var prevAgg = aggregateRows(prevYearRows);

  renderKPIsFromAgg(currentAgg, prevAgg, String(parseInt(year)-1));

  document.getElementById("section-repartition").textContent = 'Sources de trafic et devices – Année ' + year;
  renderSourcesPieFromAgg(sheetName, year, currentAgg);
  renderDevicesPieFromAgg(sheetName, year, currentAgg);

  updateTopPages(sheetName, year);

  renderEvolutionChart(yearRows, 'Évolution mensuelle - ' + year, sheetName);

  document.getElementById("comparison-section").style.display = "block";
  document.getElementById("section-comparison").textContent = 'Comparaison ' + year + ' vs ' + (parseInt(year)-1);
  renderComparisonChart(rows, year, sheetName);
}

function aggregateRows(rows) {
  if (!rows || rows.length === 0) return null;
  var agg = {
    visites: 0,
    pages_vues: 0,
    telechargements: 0,
    taux_rebond_sum: 0,
    duree_sum: 0,
    actions_moy_sum: 0,
    count: rows.length,
    moteurs_de_recherche: 0,
    entrees_directes: 0,
    sites_externes: 0,
    assistants_ia: 0,
    reseaux_sociaux: 0,
    campagnes: 0,
    ordinateurs: 0,
    smartphone: 0,
    tablettes: 0
  };
  rows.forEach(function(r) {
    agg.visites += Number(r.visites || 0);
    agg.pages_vues += Number(r.pages_vues || 0);
    agg.telechargements += Number(r.telechargements || 0);
    agg.taux_rebond_sum += Number(r.taux_de_rebond || 0);
    agg.duree_sum += parseDuration(r.duree_moyenne);
    agg.actions_moy_sum += Number(r.actions_moy || 0);
    agg.moteurs_de_recherche += Number(r.moteurs_de_recherche || 0);
    agg.entrees_directes += Number(r.entrees_directes || 0);
    agg.sites_externes += Number(r.sites_externes || 0);
    agg.assistants_ia += Number(r.assistants_ia || 0);
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
  var grid = document.getElementById("kpis-grid");
  if (!current) { grid.innerHTML = '<div class="kpi-card">Aucune donnée</div>'; return; }

  var visites = Number(current.visites || 0);
  var pagesVues = Number(current.pages_vues || 0);
  var telechargements = Number(current.telechargements || 0);
  var tauxRebond = Number(current.taux_de_rebond || 0) * 100;
  var duree = parseDuration(current.duree_moyenne);
  var actionsMoy = Number(current.actions_moy || 0);

  var visitesM1 = prevMonth ? Number(prevMonth.visites || 0) : null;
  var visitesN1 = prevYear ? Number(prevYear.visites || 0) : null;
  var pagesM1 = prevMonth ? Number(prevMonth.pages_vues || 0) : null;
  var pagesN1 = prevYear ? Number(prevYear.pages_vues || 0) : null;
  var telechM1 = prevMonth ? Number(prevMonth.telechargements || 0) : null;
  var telechN1 = prevYear ? Number(prevYear.telechargements || 0) : null;
  var rebondM1 = prevMonth ? Number(prevMonth.taux_de_rebond || 0) * 100 : null;
  var rebondN1 = prevYear ? Number(prevYear.taux_de_rebond || 0) * 100 : null;
  var dureeM1 = prevMonth ? parseDuration(prevMonth.duree_moyenne) : null;
  var dureeN1 = prevYear ? parseDuration(prevYear.duree_moyenne) : null;
  var actionsM1 = prevMonth ? Number(prevMonth.actions_moy || 0) : null;
  var actionsN1 = prevYear ? Number(prevYear.actions_moy || 0) : null;

  grid.innerHTML = 
    renderKPICard("Visites", formatNumber(visites), calcVariation(visites, visitesM1), calcVariation(visites, visitesN1), labelM1, labelN1, false) +
    renderKPICard("Pages vues", formatNumber(pagesVues), calcVariation(pagesVues, pagesM1), calcVariation(pagesVues, pagesN1), labelM1, labelN1, false) +
    renderKPICard("Taux de rebond", tauxRebond.toFixed(1) + "%", calcVariation(tauxRebond, rebondM1), calcVariation(tauxRebond, rebondN1), labelM1, labelN1, true) +
    renderKPICard("Durée moyenne", formatDuration(duree), calcVariation(duree, dureeM1), calcVariation(duree, dureeN1), labelM1, labelN1, false) +
    renderKPICard("Actions moyennes", actionsMoy.toFixed(1), calcVariation(actionsMoy, actionsM1), calcVariation(actionsMoy, actionsN1), labelM1, labelN1, false) +
    renderKPICard("Téléchargements", formatNumber(telechargements), calcVariation(telechargements, telechM1), calcVariation(telechargements, telechN1), labelM1, labelN1, false);
}

function renderKPIsFromAgg(current, prev, labelPrev) {
  var grid = document.getElementById("kpis-grid");
  if (!current) { grid.innerHTML = '<div class="kpi-card">Aucune donnée</div>'; return; }

  var visites = current.visites;
  var pagesVues = current.pages_vues;
  var telechargements = current.telechargements || 0;
  var tauxRebond = current.taux_rebond * 100;
  var duree = current.duree_moyenne;
  var actionsMoy = current.actions_moy;

  var visitesP = prev ? prev.visites : null;
  var pagesP = prev ? prev.pages_vues : null;
  var telechP = prev ? (prev.telechargements || 0) : null;
  var rebondP = prev ? prev.taux_rebond * 100 : null;
  var dureeP = prev ? prev.duree_moyenne : null;
  var actionsP = prev ? prev.actions_moy : null;

  grid.innerHTML = 
    renderKPICard("Visites", formatNumber(visites), null, calcVariation(visites, visitesP), "", labelPrev, false) +
    renderKPICard("Pages vues", formatNumber(pagesVues), null, calcVariation(pagesVues, pagesP), "", labelPrev, false) +
    renderKPICard("Taux de rebond", tauxRebond.toFixed(1) + "%", null, calcVariation(tauxRebond, rebondP), "", labelPrev, true) +
    renderKPICard("Durée moyenne", formatDuration(duree), null, calcVariation(duree, dureeP), "", labelPrev, false) +
    renderKPICard("Actions moyennes", actionsMoy.toFixed(1), null, calcVariation(actionsMoy, actionsP), "", labelPrev, false) +
    renderKPICard("Téléchargements", formatNumber(telechargements), null, calcVariation(telechargements, telechP), "", labelPrev, false);
}

function renderKPICard(title, value, varM1, varN1, labelM1, labelN1, invertColors) {
  function getClass(v) {
    if (v === null) return "neutral";
    if (invertColors) return v > 0 ? "down" : v < 0 ? "up" : "neutral";
    return v > 0 ? "up" : v < 0 ? "down" : "neutral";
  }

  var html = '<div class="kpi-card">' +
    '<h3>' + title + '</h3>' +
    '<div class="kpi-value">' + value + '</div>' +
    '<div class="kpi-comparisons">';
  
  if (labelM1 && varM1 !== null) {
    html += '<div class="kpi-comparison">' +
      '<span class="label">vs ' + labelM1 + ':</span>' +
      '<span class="value ' + getClass(varM1) + '">' + formatPercent(varM1) + '</span>' +
      '</div>';
  }
  
  if (labelN1 && varN1 !== null) {
    html += '<div class="kpi-comparison">' +
      '<span class="label">vs ' + labelN1 + ':</span>' +
      '<span class="value ' + getClass(varN1) + '">' + formatPercent(varN1) + '</span>' +
      '</div>';
  }
  
  html += '</div></div>';
  return html;
}

// ============ PIE CHARTS ============
function renderSourcesPie(sheetName, ym, row) {
  var ctx = document.getElementById("sourcesChart").getContext("2d");
  if (sourcesChart) sourcesChart.destroy();

  if (!row) {
    sourcesChart = new Chart(ctx, { type: "pie", data: { labels: [], datasets: [] } });
    return;
  }

  var siteLabel = sheetName === "Data FA" ? "France Assureurs" : "Assurance Prévention";
  if (sheetName === "Data RR") siteLabel = "Revue Risques";

  var m = ym.match(/^(\d{4})-(\d{2})$/);
  var monthLabel = m ? (m[2] + '/' + m[1]) : ym;

  var data = [
    Number(row.moteurs_de_recherche || 0),
    Number(row.entrees_directes || 0),
    Number(row.sites_externes || 0),
    Number(row.assistants_ia || 0),
    Number(row.reseaux_sociaux || 0),
    Number(row.campagnes || 0)
  ];

  sourcesChart = new Chart(ctx, {
    type: "pie",
    plugins: [ChartDataLabels],
    data: {
      labels: ["Moteurs de recherche", "Entrées directes", "Sites externes", "Assistants IA", "Réseaux sociaux", "Campagnes"],
      datasets: [{ data: data, backgroundColor: getAllColors(sheetName).slice(0, 6), borderWidth: 2, borderColor: "#fff" }]
    },
    options: getPieOptions('Sources de trafic – ' + siteLabel + ' – ' + monthLabel)
  });
}

function renderSourcesPieFromAgg(sheetName, label, agg) {
  var ctx = document.getElementById("sourcesChart").getContext("2d");
  if (sourcesChart) sourcesChart.destroy();

  if (!agg) {
    sourcesChart = new Chart(ctx, { type: "pie", data: { labels: [], datasets: [] } });
    return;
  }

  var siteLabel = sheetName === "Data FA" ? "France Assureurs" : "Assurance Prévention";
  if (sheetName === "Data RR") siteLabel = "Revue Risques";

  var data = [agg.moteurs_de_recherche, agg.entrees_directes, agg.sites_externes, agg.assistants_ia, agg.reseaux_sociaux, agg.campagnes];

  sourcesChart = new Chart(ctx, {
    type: "pie",
    plugins: [ChartDataLabels],
    data: {
      labels: ["Moteurs de recherche", "Entrées directes", "Sites externes", "Assistants IA", "Réseaux sociaux", "Campagnes"],
      datasets: [{ data: data, backgroundColor: getAllColors(sheetName).slice(0, 6), borderWidth: 2, borderColor: "#fff" }]
    },
    options: getPieOptions('Sources de trafic – ' + siteLabel + ' – ' + label)
  });
}

function renderDevicesPie(sheetName, ym, row) {
  var ctx = document.getElementById("devicesChart").getContext("2d");
  if (devicesChart) devicesChart.destroy();

  if (!row) {
    devicesChart = new Chart(ctx, { type: "pie", data: { labels: [], datasets: [] } });
    return;
  }

  var siteLabel = sheetName === "Data FA" ? "France Assureurs" : "Assurance Prévention";
  if (sheetName === "Data RR") siteLabel = "Revue Risques";
  var m = ym.match(/^(\d{4})-(\d{2})$/);
  var monthLabel = m ? (m[2] + '/' + m[1]) : ym;

  var data = [
    Number(row.ordinateurs || 0),
    Number(row.smartphone || 0),
    Number(row.tablettes || 0)
  ];

  var colors = PALETTES[sheetName] ? PALETTES[sheetName].primary : PALETTES["Data FA"].primary;

  devicesChart = new Chart(ctx, {
    type: "pie",
    plugins: [ChartDataLabels],
    data: {
      labels: ["Ordinateurs", "Smartphones", "Tablettes"],
      datasets: [{ data: data, backgroundColor: [colors[0], colors[1], colors[2]], borderWidth: 2, borderColor: "#fff" }]
    },
    options: getPieOptions('Périphériques – ' + siteLabel + ' – ' + monthLabel)
  });
}

function renderDevicesPieFromAgg(sheetName, label, agg) {
  var ctx = document.getElementById("devicesChart").getContext("2d");
  if (devicesChart) devicesChart.destroy();

  if (!agg) {
    devicesChart = new Chart(ctx, { type: "pie", data: { labels: [], datasets: [] } });
    return;
  }

  var siteLabel = sheetName === "Data FA" ? "France Assureurs" : "Assurance Prévention";
  if (sheetName === "Data RR") siteLabel = "Revue Risques";
  var data = [agg.ordinateurs, agg.smartphone, agg.tablettes];
  var colors = PALETTES[sheetName] ? PALETTES[sheetName].primary : PALETTES["Data FA"].primary;

  devicesChart = new Chart(ctx, {
    type: "pie",
    plugins: [ChartDataLabels],
    data: {
      labels: ["Ordinateurs", "Smartphones", "Tablettes"],
      datasets: [{ data: data, backgroundColor: [colors[0], colors[1], colors[2]], borderWidth: 2, borderColor: "#fff" }]
    },
    options: getPieOptions('Périphériques – ' + siteLabel + ' – ' + label)
  });
}

function getPieOptions(title) {
  return {
    responsive: true,
    plugins: {
      datalabels: {
        color: "#fff",
        font: { weight: "bold", size: 13 },
        formatter: function(value, ctx) {
          var total = ctx.dataset.data.reduce(function(a, b) { return a + b; }, 0);
          if (total === 0 || value === 0) return "";
          var pct = (value / total) * 100;
          return pct >= 5 ? pct.toFixed(1) + "%" : "";
        }
      },
      title: { display: true, text: title, font: { size: 14, weight: "bold" } },
      legend: { position: "bottom" },
      tooltip: {
        callbacks: {
          label: function(ctx) {
            var total = ctx.dataset.data.reduce(function(a, b) { return a + b; }, 0);
            var pct = total > 0 ? (ctx.parsed / total) * 100 : 0;
            return ' ' + ctx.label + ' : ' + formatNumber(ctx.parsed) + ' (' + pct.toFixed(1) + '%)';
          }
        }
      }
    }
  };
}

// ============ EVOLUTION CHART ============
function renderEvolutionChart(rows, title, sheetName) {
  var ctx = document.getElementById("evolutionChart").getContext("2d");
  if (evolutionChart) evolutionChart.destroy();

  var COLORS = getEvolutionColors(sheetName || document.getElementById("site-select").value);

  var labels = rows.map(function(r) {
    var m = String(r.date).match(/^(\d{4})-(\d{2})/);
    return m ? (m[2] + '/' + m[1]) : r.date;
  });

  evolutionChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Visites",
          data: rows.map(function(r) { return Number(r.visites || 0); }),
          borderColor: COLORS.visites,
          backgroundColor: COLORS.visites + "20",
          yAxisID: "y",
          tension: 0.3
        },
        {
          label: "Pages vues",
          data: rows.map(function(r) { return Number(r.pages_vues || 0); }),
          borderColor: COLORS.pages_vues,
          backgroundColor: COLORS.pages_vues + "20",
          yAxisID: "y",
          tension: 0.3
        },
        {
          label: "Taux de rebond (%)",
          data: rows.map(function(r) { return Number(r.taux_de_rebond || 0) * 100; }),
          borderColor: COLORS.taux_rebond,
          backgroundColor: COLORS.taux_rebond + "20",
          yAxisID: "y1",
          tension: 0.3
        },
        {
          label: "Durée (sec)",
          data: rows.map(function(r) { return parseDuration(r.duree_moyenne); }),
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
  var ctx = document.getElementById("comparisonChart").getContext("2d");
  if (comparisonChart) comparisonChart.destroy();

  var colors = getComparisonColors(sheetName || document.getElementById("site-select").value);

  var prevYear = String(parseInt(year) - 1);
  var months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

  var currentData = months.map(function(m) {
    var row = getRowForMonth(rows, year + '-' + m);
    return row ? Number(row.visites || 0) : 0;
  });

  var prevData = months.map(function(m) {
    var row = getRowForMonth(rows, prevYear + '-' + m);
    return row ? Number(row.visites || 0) : 0;
  });

  comparisonChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: MOIS_NOMS,
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
        title: { display: true, text: 'Visites mensuelles : ' + year + ' vs ' + prevYear, font: { size: 14, weight: "bold" } },
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
  var table = document.getElementById("top-pages-table");
  var title = document.getElementById("section-top-pages");
  // On récupère le conteneur parent (la div .card)
  // Fallback sur parentElement si .closest ne trouve rien (structure simple)
  var container = table ? (table.closest ? table.closest('.card') : table.parentElement) : null;

  // --- CAS REVUE RISQUES : ON CACHE TOUT LE BLOC ---
  if (sheetName === "Data RR") {
    if (title) title.style.display = "none";
    if (table) table.style.display = "none";
    if (container) container.style.display = "none"; // Cache la boîte blanche entière
    return;
  }

  // --- CAS AUTRES SITES : ON RÉAFFICHE TOUT ---
  if (title) title.style.display = "block";
  if (table) table.style.display = "table";
  if (container) container.style.display = "block";
  
  var topPages = getTopPagesForSite(sheetName);
  var isYear = period.length === 4;
  var filtered;
  if (isYear) {
    filtered = topPages.filter(function(row) { return String(row.date) === period; });
  } else {
    filtered = topPages.filter(function(row) {
      var m = String(row.date).match(/^(\d{4})-(\d{2})/);
      return m && (m[1] + '-' + m[2]) === period;
    });
  }
  
  filtered = filtered.sort(function(a, b) { return a.position - b.position; }).slice(0, 10);
  
  var thead = document.querySelector("#top-pages-table thead");
  var tbody = document.querySelector("#top-pages-table tbody");
  
  if (filtered.length === 0) {
    thead.innerHTML = "";
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888;">Aucune donnée Top Pages pour cette période</td></tr>';
    // On met quand même à jour le titre
    var periodLabel = isYear ? ('Année ' + period) : formatMonthYear(period);
    if (title) title.textContent = '🏆 Top 10 des pages les plus consultées – ' + periodLabel;
    return;
  }
  
  var periodLabel = isYear ? ('Année ' + period) : formatMonthYear(period);
  if (title) title.textContent = '🏆 Top 10 des pages les plus consultées – ' + periodLabel;
  
  thead.innerHTML = '<tr>' +
    '<th class="position">#</th>' +
    '<th class="evolution">Évol.</th>' +
    '<th class="page-title">Page</th>' +
    '<th class="numeric">Vues</th>' +
    '<th class="numeric">% Trafic</th>' +
    '<th class="numeric">Taux rebond</th>' +
    '<th class="numeric">Temps moy.</th>' +
    '</tr>';
  
  var tbodyHtml = '';
  filtered.forEach(function(row) {
    var evolutionClass = getEvolutionClass(row.evolution);
    var evolutionLabel = getEvolutionLabel(row.evolution);
    
    tbodyHtml += '<tr>' +
      '<td class="position">' + row.position + '</td>' +
      '<td class="evolution ' + evolutionClass + '">' + evolutionLabel + '</td>' +
      '<td class="page-title"><a href="' + row.url + '" target="_blank" title="' + row.titre_page + '">' + truncateText(row.titre_page, 60) + '</a></td>' +
      '<td class="numeric">' + formatNumber(row.vues) + '</td>' +
      '<td class="numeric">' + (row.pct_trafic * 100).toFixed(2) + '%</td>' +
      '<td class="numeric">' + (row.taux_rebond * 100).toFixed(1) + '%</td>' +
      '<td class="numeric">' + row.temps_moyen + '</td>' +
      '</tr>';
  });
  tbody.innerHTML = tbodyHtml;
}

function getEvolutionClass(evolution) {
  if (evolution === "new") return "new";
  if (evolution === "stable" || evolution === "=" || evolution === "—") return "stable";
  var num = parseInt(evolution);
  if (num > 0) return "up";
  if (num < 0) return "down";
  return "stable";
}

function getEvolutionLabel(evolution) {
  if (evolution === "new") return "🆕 New";
  if (evolution === "stable" || evolution === "=" || evolution === "—") return "— Stable";
  var num = parseInt(evolution);
  if (num > 0) return "↑ +" + num;
  if (num < 0) return "↓ " + num;
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
  var btn = document.querySelector(".toggle-dark");
  btn.textContent = document.body.classList.contains("dark") ? "☀️ Mode clair" : "🌙 Mode sombre";
}

// ============ EXPORT PDF ============
function exportPDF() {
  window.print();
}

// ============ REFRESH DATA ============
async function refreshData() {
  var btn = document.querySelector('.refresh-btn');
  btn.disabled = true;
  btn.textContent = '⏳';
  
  try {
    // Vider le cache
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_MONTH_KEY);
    
    // Recharger depuis l'API
    var res = await fetch(API_URL);
    allData = await res.json();
    setCachedData(allData);
    
    // Mettre à jour l'affichage
    initPeriodSelector();
    applyHashToSelectors();
    updateDashboard();
    
    console.log('Données rafraîchies');
  } catch (err) {
    console.error('Erreur rafraîchissement:', err);
    alert('Erreur lors du rafraîchissement des données');
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄';
  }
}