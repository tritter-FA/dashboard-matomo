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
  "AP": "Data AP"
};

const SITE_CODES_REVERSE = {
  "Data FA": "FA",
  "Data AP": "AP"
};

// Palettes de couleurs par site
const PALETTES = {
  "Data FA": {
    primary: ["#FA5629", "#007770", "#4984A9", "#68B0AC", "#FFB347", "#77DD77", "#A181E0"], // Ajout de couleurs pour IA/Social
    secondary: ["#FA5629CC", "#007770CC", "#4984A9CC", "#68B0ACCC"],
    tertiary: ["#FA562999", "#00777099", "#4984A999", "#68B0AC99"],
    accent: "#FA5629",
    dark: "#007770"
  },
  "Data AP": {
    primary: ["#fdc300", "#005da4", "#00a3bb", "#0587b5", "#f07d19", "#292e6b", "#8bc34a"], // Ajout de couleurs
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
  var hash = window.location.hash.replace('#', '');
  if (!hash) return null;
  
  var match = hash.match(/^(FA|AP)-(\d{4})(?:-(\d{2}))?$/);
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
    if (cached) return JSON.parse(cached);
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

// ============ INITIALISATION ============
async function initDashboard() {
  try {
    var cached = getCachedData();
    if (cached) {
      allData = cached;
    } else {
      var res = await fetch(API_URL);
      allData = await res.json();
      setCachedData(allData);
    }

    document.getElementById("loading").style.display = "none";
    document.getElementById("dashboard-content").style.display = "block";

    initPeriodSelector();
    var hashApplied = applyHashToSelectors();
    if (!hashApplied) updateHash();
    
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
      if (applyHashToSelectors()) updateDashboard();
    });

  } catch (err) {
    console.error("Erreur de récupération API :", err);
    document.getElementById("loading").textContent = "Erreur de chargement des données.";
  }
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
      if (yearMonths[year].indexOf(month) === -1) yearMonths[year].push(month);
    }
  });

  var years = Object.keys(yearMonths).sort().reverse();
  years.forEach(function(year) { yearMonths[year].sort().reverse(); });

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
  return allTopPages.filter(function(row) { return row.site === SITE_CODES_REVERSE[siteName]; });
}

function getRowForMonth(rows, ym) {
  for (var i = 0; i < rows.length; i++) {
    var m = String(rows[i].date).match(/^(\d{4})-(\d{2})/);
    if (m && (m[1] + '-' + m[2]) === ym) return rows[i];
  }
  return null;
}

// ============ UTILITIES ============
function parseDuration(str) {
  if (!str) return 0;
  var m = String(str).match(/(\d+)\s*min\s*(\d+)?\s*s?/);
  if (m) return parseInt(m[1]) * 60 + (parseInt(m[2]) || 0);
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
  return MOIS_NOMS[parseInt(m[2]) - 1] + ' ' + m[1];
}

function formatPercent(value, showSign) {
  if (showSign === undefined) showSign = true;
  if (value === null || value === undefined || isNaN(value)) return "-";
  var sign = value > 0 ? "+" : "";
  return (showSign && value > 0 ? sign : "") + value.toFixed(1) + "%";
}

function formatNumber(n) { return Number(n || 0).toLocaleString("fr-FR"); }

function calcVariation(current, previous) {
  if (!previous || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

// ============ UPDATE DASHBOARD ============
function updateDashboard() {
  var sheetName = document.getElementById("site-select").value;
  var periodValue = document.getElementById("period-select").value;
  var rows = getRowsForSheet(sheetName);

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

function updatePrintTitle(sheetName, periodValue) {
  var siteName = sheetName === "Data FA" ? "France Assureurs" : "Assurance Prévention";
  var periodLabel = '';
  if (periodValue.indexOf("year-") === 0) periodLabel = periodValue.replace("year-", "");
  else {
    var parts = periodValue.replace("month-", "").split("-");
    periodLabel = MOIS_NOMS[parseInt(parts[1]) - 1] + ' ' + parts[0];
  }
  document.getElementById("print-period").textContent = ' — ' + siteName + ' — ' + periodLabel;
  document.title = 'Dashboard Matomo - ' + siteName + ' - ' + periodLabel;
}

// ============ MONTHLY VIEW ============
function updateMonthlyView(sheetName, rows, ym) {
  var parts = ym.split("-");
  var year = parts[0];
  var month = parts[1];
  var currentRow = getRowForMonth(rows, ym);
  
  var prevMonth = (parseInt(month) === 1) ? (parseInt(year) - 1) + '-12' : year + '-' + String(parseInt(month) - 1).padStart(2, "0");
  var prevMonthRow = getRowForMonth(rows, prevMonth);
  var prevYearMonth = (parseInt(year) - 1) + '-' + month;
  var prevYearRow = getRowForMonth(rows, prevYearMonth);

  renderKPIs(currentRow, prevMonthRow, prevYearRow, "M-1", MOIS_NOMS[parseInt(month)-1] + ' ' + (parseInt(year)-1));
  document.getElementById("section-repartition").textContent = 'Sources de trafic et devices – ' + formatMonthYear(ym);
  renderSourcesPie(sheetName, ym, currentRow);
  renderDevicesPie(sheetName, ym, currentRow);
  updateTopPages(sheetName, ym);

  var idx = -1;
  for (var i = 0; i < rows.length; i++) { if (String(rows[i].date).startsWith(ym)) { idx = i; break; } }
  var last12 = rows.slice(Math.max(0, idx - 11), idx + 1);
  renderEvolutionChart(last12, 'Évolution sur 12 mois (jusqu\'à ' + formatMonthYear(ym) + ')', sheetName);
  document.getElementById("comparison-section").style.display = "none";
}

// ============ YEARLY VIEW ============
function updateYearlyView(sheetName, rows, year) {
  var yearRows = rows.filter(function(r) { return String(r.date).startsWith(year); });
  var prevYearRows = rows.filter(function(r) { return String(r.date).startsWith(String(parseInt(year) - 1)); });
  var currentAgg = aggregateRows(yearRows);
  var prevAgg = aggregateRows(prevYearRows);

  renderKPIsFromAgg(currentAgg, prevAgg, String(parseInt(year)-1));
  document.getElementById("section-repartition").textContent = 'Sources de trafic et devices – Année ' + year;
  renderSourcesPieFromAgg(sheetName, year, currentAgg);
  renderDevicesPieFromAgg(sheetName, year, currentAgg);
  updateTopPages(sheetName, year);
  renderEvolutionChart(yearRows, 'Évolution mensuelle - ' + year, sheetName);
  document.getElementById("comparison-section").style.display = "block";
  renderComparisonChart(rows, year, sheetName);
}

function aggregateRows(rows) {
  if (!rows || rows.length === 0) return null;
  var agg = { visites: 0, pages_vues: 0, telechargements: 0, taux_rebond_sum: 0, duree_sum: 0, actions_moy_sum: 0, count: rows.length, moteurs_de_recherche: 0, entrees_directes: 0, sites_externes: 0, assistants_ia: 0, reseaux_sociaux: 0, campagnes: 0, ordinateurs: 0, smartphone: 0, tablettes: 0 };
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

  var v = Number(current.visites || 0), pv = Number(current.pages_vues || 0), t = Number(current.telechargements || 0), tr = Number(current.taux_de_rebond || 0) * 100, d = parseDuration(current.duree_moyenne), am = Number(current.actions_moy || 0);
  var vM1 = prevMonth ? Number(prevMonth.visites || 0) : null, vN1 = prevYear ? Number(prevYear.visites || 0) : null;
  var pvM1 = prevMonth ? Number(prevMonth.pages_vues || 0) : null, pvN1 = prevYear ? Number(prevYear.pages_vues || 0) : null;
  var tM1 = prevMonth ? Number(prevMonth.telechargements || 0) : null, tN1 = prevYear ? Number(prevYear.telechargements || 0) : null;
  var trM1 = prevMonth ? Number(prevMonth.taux_de_rebond || 0) * 100 : null, trN1 = prevYear ? Number(prevYear.taux_de_rebond || 0) * 100 : null;
  var dM1 = prevMonth ? parseDuration(prevMonth.duree_moyenne) : null, dN1 = prevYear ? parseDuration(prevYear.duree_moyenne) : null;
  var amM1 = prevMonth ? Number(prevMonth.actions_moy || 0) : null, amN1 = prevYear ? Number(prevYear.actions_moy || 0) : null;

  grid.innerHTML = renderKPICard("Visites", formatNumber(v), calcVariation(v, vM1), calcVariation(v, vN1), labelM1, labelN1, false) +
    renderKPICard("Pages vues", formatNumber(pv), calcVariation(pv, pvM1), calcVariation(pv, pvN1), labelM1, labelN1, false) +
    renderKPICard("Taux de rebond", tr.toFixed(1) + "%", calcVariation(tr, trM1), calcVariation(tr, trN1), labelM1, labelN1, true) +
    renderKPICard("Durée moyenne", formatDuration(d), calcVariation(d, dM1), calcVariation(d, dN1), labelM1, labelN1, false) +
    renderKPICard("Actions moyennes", am.toFixed(1), calcVariation(am, amM1), calcVariation(am, amN1), labelM1, labelN1, false) +
    renderKPICard("Téléchargements", formatNumber(t), calcVariation(t, tM1), calcVariation(t, tN1), labelM1, labelN1, false);
}

function renderKPIsFromAgg(current, prev, labelPrev) {
  var grid = document.getElementById("kpis-grid");
  if (!current) { grid.innerHTML = '<div class="kpi-card">Aucune donnée</div>'; return; }
  grid.innerHTML = renderKPICard("Visites", formatNumber(current.visites), null, calcVariation(current.visites, prev?.visites), "", labelPrev, false) +
    renderKPICard("Pages vues", formatNumber(current.pages_vues), null, calcVariation(current.pages_vues, prev?.pages_vues), "", labelPrev, false) +
    renderKPICard("Taux de rebond", (current.taux_rebond * 100).toFixed(1) + "%", null, calcVariation(current.taux_rebond, prev?.taux_rebond), "", labelPrev, true) +
    renderKPICard("Durée moyenne", formatDuration(current.duree_moyenne), null, calcVariation(current.duree_moyenne, prev?.duree_moyenne), "", labelPrev, false) +
    renderKPICard("Actions moyennes", current.actions_moy.toFixed(1), null, calcVariation(current.actions_moy, prev?.actions_moy), "", labelPrev, false) +
    renderKPICard("Téléchargements", formatNumber(current.telechargements), null, calcVariation(current.telechargements, prev?.telechargements), "", labelPrev, false);
}

function renderKPICard(title, value, varM1, varN1, labelM1, labelN1, invert) {
  function getCls(v) { if (v === null) return "neutral"; return invert ? (v > 0 ? "down" : "up") : (v > 0 ? "up" : "down"); }
  var html = '<div class="kpi-card"><h3>' + title + '</h3><div class="kpi-value">' + value + '</div><div class="kpi-comparisons">';
  if (labelM1 && varM1 !== null) html += '<div class="kpi-comparison"><span class="label">vs ' + labelM1 + ':</span><span class="value ' + getCls(varM1) + '">' + formatPercent(varM1) + '</span></div>';
  if (labelN1 && varN1 !== null) html += '<div class="kpi-comparison"><span class="label">vs ' + labelN1 + ':</span><span class="value ' + getCls(varN1) + '">' + formatPercent(varN1) + '</span></div>';
  return html + '</div></div>';
}

// ============ PIE CHARTS ============
function renderSourcesPie(sheetName, ym, row) {
  var ctx = document.getElementById("sourcesChart").getContext("2d");
  if (sourcesChart) sourcesChart.destroy();
  if (!row) return;
  var data = [Number(row.moteurs_de_recherche || 0), Number(row.entrees_directes || 0), Number(row.sites_externes || 0), Number(row.assistants_ia || 0), Number(row.reseaux_sociaux || 0), Number(row.campagnes || 0)];
  sourcesChart = new Chart(ctx, { type: "pie", plugins: [ChartDataLabels], data: { labels: ["Moteurs", "Direct", "Sites Ext.", "Assistants IA", "Réseaux Sociaux", "Campagnes"], datasets: [{ data: data, backgroundColor: getAllColors(sheetName).slice(0, 6), borderWidth: 2, borderColor: "#fff" }] }, options: getPieOptions('Sources – ' + sheetName + ' – ' + ym) });
}

function renderSourcesPieFromAgg(sheetName, label, agg) {
  var ctx = document.getElementById("sourcesChart").getContext("2d");
  if (sourcesChart) sourcesChart.destroy();
  if (!agg) return;
  var data = [agg.moteurs_de_recherche, agg.entrees_directes, agg.sites_externes, agg.assistants_ia, agg.reseaux_sociaux, agg.campagnes];
  sourcesChart = new Chart(ctx, { type: "pie", plugins: [ChartDataLabels], data: { labels: ["Moteurs", "Direct", "Sites Ext.", "Assistants IA", "Réseaux Sociaux", "Campagnes"], datasets: [{ data: data, backgroundColor: getAllColors(sheetName).slice(0, 6), borderWidth: 2, borderColor: "#fff" }] }, options: getPieOptions('Sources – ' + sheetName + ' – ' + label) });
}

function renderDevicesPie(sheetName, ym, row) {
  var ctx = document.getElementById("devicesChart").getContext("2d");
  if (devicesChart) devicesChart.destroy();
  if (!row) return;
  var data = [Number(row.ordinateurs || 0), Number(row.smartphone || 0), Number(row.tablettes || 0)];
  devicesChart = new Chart(ctx, { type: "pie", plugins: [ChartDataLabels], data: { labels: ["Ordi", "Mobile", "Tablette"], datasets: [{ data: data, backgroundColor: PALETTES[sheetName].primary.slice(0, 3), borderWidth: 2, borderColor: "#fff" }] }, options: getPieOptions('Devices – ' + sheetName + ' – ' + ym) });
}

function renderDevicesPieFromAgg(sheetName, label, agg) {
  var ctx = document.getElementById("devicesChart").getContext("2d");
  if (devicesChart) devicesChart.destroy();
  if (!agg) return;
  var data = [agg.ordinateurs, agg.smartphone, agg.tablettes];
  devicesChart = new Chart(ctx, { type: "pie", plugins: [ChartDataLabels], data: { labels: ["Ordi", "Mobile", "Tablette"], datasets: [{ data: data, backgroundColor: PALETTES[sheetName].primary.slice(0, 3), borderWidth: 2, borderColor: "#fff" }] }, options: getPieOptions('Devices – ' + sheetName + ' – ' + label) });
}

function getPieOptions(t) {
  return { responsive: true, plugins: { datalabels: { color: "#fff", font: { weight: "bold" }, formatter: (v, c) => { var s = c.dataset.data.reduce((a, b) => a + b, 0); return v > 0 ? (v * 100 / s).toFixed(1) + "%" : ""; } }, title: { display: true, text: t }, legend: { position: "bottom" } } };
}

// ============ EVOLUTION ============
function renderEvolutionChart(rows, title, sheetName) {
  var ctx = document.getElementById("evolutionChart").getContext("2d");
  if (evolutionChart) evolutionChart.destroy();
  var c = getEvolutionColors(sheetName);
  evolutionChart = new Chart(ctx, { type: "line", data: { labels: rows.map(r => r.date), datasets: [{ label: "Visites", data: rows.map(r => r.visites), borderColor: c.visites, tension: 0.3 }, { label: "Pages vues", data: rows.map(r => r.pages_vues), borderColor: c.pages_vues, tension: 0.3 }] }, options: { responsive: true, plugins: { title: { display: true, text: title } } } });
}

function renderComparisonChart(rows, year, sheetName) {
  var ctx = document.getElementById("comparisonChart").getContext("2d");
  if (comparisonChart) comparisonChart.destroy();
  var c = getComparisonColors(sheetName);
  var cur = MOIS_NOMS.map((m, i) => getRowForMonth(rows, year + '-' + String(i + 1).padStart(2, '0'))?.visites || 0);
  var prev = MOIS_NOMS.map((m, i) => getRowForMonth(rows, (parseInt(year) - 1) + '-' + String(i + 1).padStart(2, '0'))?.visites || 0);
  comparisonChart = new Chart(ctx, { type: "bar", data: { labels: MOIS_NOMS, datasets: [{ label: year, data: cur, backgroundColor: c.current }, { label: parseInt(year) - 1, data: prev, backgroundColor: c.previous }] } });
}

// ============ TOP PAGES ============
function updateTopPages(sheetName, period) {
  var rows = getTopPagesForSite(sheetName).filter(r => String(r.date).startsWith(period)).sort((a, b) => a.position - b.position).slice(0, 10);
  var tbody = document.querySelector("#top-pages-table tbody");
  var thead = document.querySelector("#top-pages-table thead");
  thead.innerHTML = '<tr><th>#</th><th>Évol.</th><th>Page</th><th>Vues</th><th>%</th><th>Rebond</th><th>Temps</th></tr>';
  tbody.innerHTML = rows.map(r => {
    var cls = r.evolution === "new" ? "new" : (r.evolution.includes("+") ? "up" : "down");
    return '<tr><td>' + r.position + '</td><td class="evolution ' + cls + '">' + r.evolution + '</td><td><a href="' + r.url + '" target="_blank">' + r.titre_page + '</a></td><td>' + formatNumber(r.vues) + '</td><td>' + (r.pct_trafic * 100).toFixed(1) + '%</td><td>' + (r.taux_rebond * 100).toFixed(0) + '%</td><td>' + r.temps_moyen + '</td></tr>';
  }).join('');
}

function toggleDarkMode() { document.body.classList.toggle("dark"); }
function exportPDF() { window.print(); }
async function refreshData() { localStorage.removeItem(CACHE_KEY); location.reload(); }

initDashboard();