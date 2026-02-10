/* =======================================================
   CONFIGURATION ET VARIABLES GLOBALES
   ======================================================= */
const API_URL = "https://script.google.com/macros/s/AKfycbzs5S-NuzbuRIx-PIR-QvZ6cf2j-YYvyYfVDTdL0upNwswgw4kzr75Q_wWB4TF2njcF/exec";
const CACHE_KEY = "matomo_dashboard_cache";
const CACHE_MONTH_KEY = "matomo_dashboard_cache_month";

let allData = null;

// Variables pour les graphiques
let sourcesChart = null;
let devicesChart = null;
let evolutionChart = null;
let comparisonChart = null;

// CONFIGURATION DES SITES (AVEC TF)
const SITE_CODES = { "FA": "Data FA", "AP": "Data AP", "TF": "Data TF", "RR": "Data RR" };
const SITE_CODES_REVERSE = { "Data FA": "FA", "Data AP": "AP", "Data TF": "TF", "Data RR": "RR" };

const SITE_CONFIG = {
  "Data FA": { url: "img/logo-fa.png", height: "34px" },
  "Data AP": { url: "img/logo-ap.png", height: "60px" }, // 60px
  "Data TF": { url: "img/logo-ap.png", height: "60px" }, // Même logo/taille que AP
  "Data RR": { url: "img/logo-rr.png", height: "45px" }
};

const COULEURS_FA = ["#FA5629", "#007770", "#4984A9", "#68B0AC", "#FFB347", "#77DD77"];
const COULEURS_AP = ["#fdc300", "#005da4", "#00a3bb", "#0587b5", "#f07d19", "#292e6b"];
const COULEURS_RR = ["#302F58", "#413A74", "#A35BA1", "#EC74A9", "#F0B2A9", "#F9CD98"];

const PALETTES = {
  "Data FA": { primary: COULEURS_FA, secondary: COULEURS_FA.map(c => c + "CC"), tertiary: COULEURS_FA.map(c => c + "99"), accent: "#FA5629", dark: "#007770" },
  "Data AP": { primary: COULEURS_AP, secondary: COULEURS_AP.map(c => c + "CC"), tertiary: COULEURS_AP.map(c => c + "99"), accent: "#fdc300", dark: "#292e6b" },
  "Data TF": { primary: COULEURS_AP, secondary: COULEURS_AP.map(c => c + "CC"), tertiary: COULEURS_AP.map(c => c + "99"), accent: "#fdc300", dark: "#292e6b" },
  "Data RR": { primary: COULEURS_RR, secondary: COULEURS_RR.map(c => c + "CC"), tertiary: COULEURS_RR.map(c => c + "99"), accent: "#A35BA1", dark: "#302F58" }
};

const MOIS_NOMS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

/* =======================================================
   UTILITAIRES
   ======================================================= */
function getAllColors(sheetName) { const p = PALETTES[sheetName] || PALETTES["Data FA"]; return [...p.primary, ...p.secondary, ...p.tertiary]; }
function getEvolutionColors(sheetName) { const p = PALETTES[sheetName] || PALETTES["Data FA"]; return { visites: p.primary[0], pages_vues: p.primary[1], taux_rebond: p.primary[2], duree: p.primary[3] }; }
function getComparisonColors(sheetName) {
  const p = PALETTES[sheetName] || PALETTES["Data FA"];
  if (sheetName === "Data RR") return { current: p.primary[0], previous: p.primary[2] };
  return { current: p.primary[0], previous: p.primary[1] };
}
function getSiteHumanName(sheetName) {
  if (sheetName === "Data FA") return "France Assureurs";
  if (sheetName === "Data AP") return "Assurance Prévention";
  if (sheetName === "Data TF") return "Nos Temps Forts (AP)";
  if (sheetName === "Data RR") return "Revue Risques";
  return sheetName;
}

/* =======================================================
   INIT
   ======================================================= */
async function initDashboard() {
  try {
    var cached = getCachedData();
    if (cached) { allData = cached; } 
    else { var res = await fetch(API_URL); allData = await res.json(); setCachedData(allData); }
    
    document.getElementById("loading").style.display = "none";
    document.getElementById("dashboard-content").style.display = "block";
    initPeriodSelector();
    if (!applyHashToSelectors()) updateHash();
    updateDashboard();

    document.getElementById("site-select").addEventListener("change", () => { initPeriodSelector(); updateHash(); updateDashboard(); });
    document.getElementById("period-select").addEventListener("change", () => { updateHash(); updateDashboard(); });
    window.addEventListener("hashchange", () => { if (applyHashToSelectors()) updateDashboard(); });
  } catch (err) { console.error(err); document.getElementById("loading").textContent = "Erreur de chargement."; }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initDashboard); else initDashboard();

/* =======================================================
   CACHE & SELECTEURS
   ======================================================= */
function getCurrentMonth() { var now = new Date(); return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0'); }
function getCachedData() { try { if(localStorage.getItem(CACHE_MONTH_KEY) !== getCurrentMonth()) { localStorage.removeItem(CACHE_KEY); return null; } return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch(e){return null;} }
function setCachedData(data) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); localStorage.setItem(CACHE_MONTH_KEY, getCurrentMonth()); } catch(e){} }

function initPeriodSelector() {
  var sheetName = document.getElementById("site-select").value;
  var rows = getRowsForSheet(sheetName);
  var periodSelect = document.getElementById("period-select");
  var yearMonths = {};
  rows.forEach(function(row) {
    var m = String(row.date).match(/^(\d{4})-(\d{2})/);
    if (m) {
      if (!yearMonths[m[1]]) yearMonths[m[1]] = [];
      if (yearMonths[m[1]].indexOf(m[2]) === -1) yearMonths[m[1]].push(m[2]);
    }
  });
  var years = Object.keys(yearMonths).sort().reverse();
  var options = '';
  years.forEach(function(year) {
    yearMonths[year].sort().reverse();
    options += '<option value="year-' + year + '">' + year + '</option>';
    yearMonths[year].forEach(function(month) { options += '<option value="month-' + year + '-' + month + '">— ' + MOIS_NOMS[parseInt(month) - 1] + '</option>'; });
  });
  periodSelect.innerHTML = options;
  if (years.length > 0) periodSelect.value = 'month-' + years[0] + '-' + yearMonths[years[0]][0];
}

function parseHash() { var m = window.location.hash.match(/^#(FA|AP|TF|RR)-(\d{4})(?:-(\d{2}))?$/); return m ? { site: SITE_CODES[m[1]], type: m[3] ? 'month' : 'year', value: m[3] ? m[2]+'-'+m[3] : m[2] } : null; }
function updateHash() {
  var s = SITE_CODES_REVERSE[document.getElementById("site-select").value] || "FA";
  var p = document.getElementById("period-select").value.replace(/^(year-|month-)/, '');
  history.replaceState(null, null, '#' + s + '-' + p);
}
function applyHashToSelectors() {
  var p = parseHash(); if (!p) return false;
  var ss = document.getElementById("site-select");
  var ps = document.getElementById("period-select");
  var siteFound = false; for(var i=0; i<ss.options.length; i++) if(ss.options[i].value === p.site) { ss.value = p.site; siteFound=true; break; }
  if(!siteFound) return false;
  initPeriodSelector();
  var target = (p.type === 'year' ? 'year-' : 'month-') + p.value;
  var perFound = false; for(var j=0; j<ps.options.length; j++) if(ps.options[j].value === target) { ps.value = target; perFound=true; break; }
  return perFound;
}

function getRowsForSheet(sheetName) { return allData && allData.sheets[sheetName] ? allData.sheets[sheetName].rows : []; }
function getTopPagesForSite(siteName) { return allData && allData.sheets["Top Pages"] ? allData.sheets["Top Pages"].rows.filter(r => r.site === siteName) : []; }
function getRowForMonth(rows, ym) { for(var i=0; i<rows.length; i++) { if(String(rows[i].date).startsWith(ym)) return rows[i]; } return null; }

/* =======================================================
   NETTOYAGE ET RESET
   ======================================================= */
function resetDashboard() {
  if (sourcesChart) { sourcesChart.destroy(); sourcesChart = null; }
  else { var c = Chart.getChart("sourcesChart"); if(c) c.destroy(); }

  if (devicesChart) { devicesChart.destroy(); devicesChart = null; }
  else { var c = Chart.getChart("devicesChart"); if(c) c.destroy(); }

  if (evolutionChart) { evolutionChart.destroy(); evolutionChart = null; }
  else { var c = Chart.getChart("evolutionChart"); if(c) c.destroy(); }

  if (comparisonChart) { comparisonChart.destroy(); comparisonChart = null; }
  else { var c = Chart.getChart("comparisonChart"); if(c) c.destroy(); }

  document.querySelector("#sources-data-table tbody").innerHTML = "";
  document.querySelector("#devices-data-table tbody").innerHTML = "";
  var topPagesBody = document.querySelector("#top-pages-table tbody");
  if(topPagesBody) topPagesBody.innerHTML = "";
  var topPagesHead = document.querySelector("#top-pages-table thead");
  if(topPagesHead) topPagesHead.innerHTML = "";
  
  var titleIds = ["title-kpis", "title-sources", "title-devices", "title-top-pages", "title-evolution", "title-comparison"];
  titleIds.forEach(id => {
    var el = document.getElementById(id);
    if(el) el.textContent = "";
  });
}

/* =======================================================
   FONCTION PRINCIPALE DE MISE A JOUR
   ======================================================= */
function updateDashboard() {
  resetDashboard();

  var sheetName = document.getElementById("site-select").value;
  var periodValue = document.getElementById("period-select").value;
  var rows = getRowsForSheet(sheetName);
  
  updatePrintTitle(sheetName, periodValue);

  if (periodValue.indexOf("year-") === 0) {
    updateYearlyView(sheetName, rows, periodValue.replace("year-", ""));
  } else {
    var parts = periodValue.replace("month-", "").split("-");
    updateMonthlyView(sheetName, rows, parts[0] + "-" + parts[1]);
  }
}

function updatePrintTitle(sheetName, periodValue) {
  var siteName = getSiteHumanName(sheetName);
  var periodLabel = '';
  if (periodValue.indexOf("year-") === 0) periodLabel = periodValue.replace("year-", "");
  else {
    var parts = periodValue.replace("month-", "").split("-");
    periodLabel = MOIS_NOMS[parseInt(parts[1]) - 1] + ' ' + parts[0];
  }
  
  document.title = 'Reporting - ' + siteName;
  var printPeriod = document.getElementById("print-period");
  if (printPeriod) printPeriod.textContent = ' — ' + periodLabel;

  var logoImg = document.getElementById("site-logo");
  var config = SITE_CONFIG[sheetName];
  if (logoImg && config) { logoImg.src = config.url; logoImg.alt = "Logo " + siteName; logoImg.style.height = config.height; }
}

function updateSectionTitles(siteHuman, periodLabel) {
  var setTitle = function(id, icon, text) {
    var el = document.getElementById(id);
    if (!el) return;
    var fullTitle = siteHuman + ' - ' + icon + ' ' + text + ' - ' + periodLabel;
    el.textContent = fullTitle;
    var container = el.closest('.chart-container') || el.closest('.table-container');
    if(container) { container.setAttribute('data-filename', fullTitle); }
  };

  setTitle('title-kpis',       '⚡', 'Données clés');
  setTitle('title-sources',    '🔗', 'Sources de trafic'); 
  setTitle('title-devices',    '📱', 'Périphériques');
  setTitle('title-top-pages',  '🏆', 'Top 10 des pages');
  setTitle('title-evolution',  '📈', 'Évolution (12 derniers mois)');
}

/* =======================================================
   VUE MENSUELLE
   ======================================================= */
function updateMonthlyView(sheetName, rows, ym) {
  var parts = ym.split("-");
  var current = getRowForMonth(rows, ym);
  var prevM = getRowForMonth(rows, parts[1] === '01' ? (parseInt(parts[0])-1)+'-12' : parts[0]+'-'+String(parseInt(parts[1])-1).padStart(2,'0'));
  var prevY = getRowForMonth(rows, (parseInt(parts[0])-1)+'-'+parts[1]);

  var periodLabel = MOIS_NOMS[parseInt(parts[1]) - 1] + ' ' + parts[0];
  var siteHuman = getSiteHumanName(sheetName);

  updateSectionTitles(siteHuman, periodLabel);

  renderKPIs(current, prevM, prevY, "M-1", MOIS_NOMS[parseInt(parts[1])-1] + ' ' + (parseInt(parts[0])-1));
  
  renderSourcesPie(sheetName, current);
  renderDevicesPie(sheetName, current);
  renderSourcesTable(current);
  renderDevicesTable(current);
  updateTopPages(sheetName, ym);

  var mIdx = -1; for(var i=0; i<rows.length; i++) if(String(rows[i].date).startsWith(ym)) { mIdx = i; break; }
  var last12 = rows.slice(Math.max(0, mIdx - 11), mIdx + 1);
  renderEvolutionChart(last12, sheetName);

  document.getElementById("comparison-section").style.display = "none";
}

/* =======================================================
   VUE ANNUELLE
   ======================================================= */
function updateYearlyView(sheetName, rows, year) {
  document.getElementById("comparison-section").style.display = "block";

  var yRows = rows.filter(r => String(r.date).startsWith(year));
  var pRows = rows.filter(r => String(r.date).startsWith(String(parseInt(year)-1)));
  
  var agg = aggregateRows(yRows);
  var pAgg = aggregateRows(pRows);
  
  var siteHuman = getSiteHumanName(sheetName);
  var periodLabel = 'Année ' + year;

  updateSectionTitles(siteHuman, periodLabel);
  
  var titleEvol = document.getElementById("title-evolution");
  if (titleEvol) {
    var txt = siteHuman + ' - 📈 Évolution mensuelle - ' + periodLabel;
    titleEvol.textContent = txt;
    var cEvol = document.getElementById('container-evolution');
    if(cEvol) cEvol.setAttribute('data-filename', txt);
  }

  var compTitle = siteHuman + ' - 🆚 Comparaison ' + year + ' vs ' + (parseInt(year)-1);
  var compEl = document.getElementById('title-comparison');
  if(compEl) compEl.textContent = compTitle;
  var cComp = document.getElementById('container-comparison');
  if(cComp) cComp.setAttribute('data-filename', compTitle);

  renderKPIsFromAgg(agg, pAgg, String(parseInt(year)-1));
  renderSourcesPieFromAgg(sheetName, agg);
  renderDevicesPieFromAgg(sheetName, agg);
  renderSourcesTable(agg);
  renderDevicesTable(agg);
  updateTopPages(sheetName, year);
  renderEvolutionChart(yRows, sheetName);
  renderComparisonChart(rows, year, sheetName);
}

function aggregateRows(rows) {
  if (!rows || rows.length === 0) return null;
  var agg = { visites:0, pages_vues:0, telechargements:0, taux_rebond_sum:0, duree_sum:0, actions_moy_sum:0, count:rows.length, moteurs_de_recherche:0, entrees_directes:0, sites_externes:0, assistants_ia:0, reseaux_sociaux:0, campagnes:0, ordinateurs:0, smartphone:0, tablettes:0 };
  rows.forEach(function(r) {
    agg.visites += (Number(r.visites) || 0);
    agg.pages_vues += (Number(r.pages_vues) || 0);
    agg.telechargements += (Number(r.telechargements) || 0);
    agg.taux_rebond_sum += (Number(r.taux_de_rebond) || 0);
    agg.duree_sum += parseDuration(r.duree_moyenne);
    agg.actions_moy_sum += (Number(r.actions_moy) || 0);
    agg.moteurs_de_recherche += (Number(r.moteurs_de_recherche) || 0);
    agg.entrees_directes += (Number(r.entrees_directes) || 0);
    agg.sites_externes += (Number(r.sites_externes) || 0);
    agg.assistants_ia += (Number(r.assistants_ia) || 0);
    agg.reseaux_sociaux += (Number(r.reseaux_sociaux) || 0);
    agg.campagnes += (Number(r.campagnes) || 0);
    agg.ordinateurs += (Number(r.ordinateurs) || 0);
    agg.smartphone += (Number(r.smartphone) || 0);
    agg.tablettes += (Number(r.tablettes) || 0);
  });
  agg.taux_rebond = agg.taux_rebond_sum / agg.count;
  agg.duree_moyenne = agg.duree_sum / agg.count;
  agg.actions_moy = agg.actions_moy_sum / agg.count;
  return agg;
}

/* =======================================================
   RENDU DES KPIS
   ======================================================= */
function renderKPIs(current, prevMonth, prevYear, labelM1, labelN1) {
  var grid = document.getElementById("kpis-grid");
  if (!current) { grid.innerHTML = '<div class="kpi-card">Aucune donnée pour cette période</div>'; return; }
  var html = '';
  html += renderKPICard("Visites", formatNumber(current.visites), calcVariation(current.visites, prevMonth?.visites), calcVariation(current.visites, prevYear?.visites), labelM1, labelN1, false);
  html += renderKPICard("Pages vues", formatNumber(current.pages_vues), calcVariation(current.pages_vues, prevMonth?.pages_vues), calcVariation(current.pages_vues, prevYear?.pages_vues), labelM1, labelN1, false);
  html += renderKPICard("Taux de rebond", (current.taux_de_rebond*100).toFixed(1)+"%", calcVariation(current.taux_de_rebond*100, prevMonth?.taux_de_rebond*100), calcVariation(current.taux_de_rebond*100, prevYear?.taux_de_rebond*100), labelM1, labelN1, true);
  html += renderKPICard("Durée moyenne", formatDuration(parseDuration(current.duree_moyenne)), calcVariation(parseDuration(current.duree_moyenne), parseDuration(prevMonth?.duree_moyenne)), calcVariation(parseDuration(current.duree_moyenne), parseDuration(prevYear?.duree_moyenne)), labelM1, labelN1, false);
  html += renderKPICard("Actions moyennes", Number(current.actions_moy).toFixed(1), calcVariation(current.actions_moy, prevMonth?.actions_moy), calcVariation(current.actions_moy, prevYear?.actions_moy), labelM1, labelN1, false);
  html += renderKPICard("Téléchargements", formatNumber(current.telechargements), calcVariation(current.telechargements, prevMonth?.telechargements), calcVariation(current.telechargements, prevYear?.telechargements), labelM1, labelN1, false);
  grid.innerHTML = html;
}

function renderKPIsFromAgg(current, prev, labelPrev) {
  var grid = document.getElementById("kpis-grid");
  if (!current) { grid.innerHTML = '<div class="kpi-card">Aucune donnée</div>'; return; }
  var html = '';
  html += renderKPICard("Visites", formatNumber(current.visites), null, calcVariation(current.visites, prev?.visites), "", labelPrev, false);
  html += renderKPICard("Pages vues", formatNumber(current.pages_vues), null, calcVariation(current.pages_vues, prev?.pages_vues), "", labelPrev, false);
  html += renderKPICard("Taux de rebond", (current.taux_rebond*100).toFixed(1)+"%", null, calcVariation(current.taux_rebond*100, prev?.taux_rebond*100), "", labelPrev, true);
  html += renderKPICard("Durée moyenne", formatDuration(current.duree_moyenne), null, calcVariation(current.duree_moyenne, prev?.duree_moyenne), "", labelPrev, false);
  html += renderKPICard("Actions moyennes", current.actions_moy.toFixed(1), null, calcVariation(current.actions_moy, prev?.actions_moy), "", labelPrev, false);
  html += renderKPICard("Téléchargements", formatNumber(current.telechargements), null, calcVariation(current.telechargements, prev?.telechargements), "", labelPrev, false);
  grid.innerHTML = html;
}

function renderKPICard(title, value, varM1, varN1, labelM1, labelN1, invertColors) {
  var getClass = (v) => v===null?"neutral":(invertColors?(v>0?"down":v<0?"up":"neutral"):(v>0?"up":v<0?"down":"neutral"));
  var html = '<div class="kpi-card"><h3>'+title+'</h3><div class="kpi-value">'+value+'</div><div class="kpi-comparisons">';
  if(labelM1 && varM1!==null) html+='<div class="kpi-comparison"><span class="label">vs '+labelM1+':</span><span class="value '+getClass(varM1)+'">'+formatPercent(varM1)+'</span></div>';
  if(labelN1 && varN1!==null) html+='<div class="kpi-comparison"><span class="label">vs '+labelN1+':</span><span class="value '+getClass(varN1)+'">'+formatPercent(varN1)+'</span></div>';
  return html+'</div></div>';
}

/* =======================================================
   CHARTS
   ======================================================= */
function renderPieCommon(id, sheetName, data, labels, colorCount=6) {
  var canvas = document.getElementById(id);
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  
  var chart = new Chart(ctx, {
    type: "pie", plugins: [ChartDataLabels],
    data: { labels: labels, datasets: [{ data: data, backgroundColor: getAllColors(sheetName).slice(0, colorCount), borderWidth: 2, borderColor: "#fff" }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        datalabels: { color: "#fff", font: { weight: "bold", size: 12 }, formatter: (v, ctx) => { var tot=ctx.dataset.data.reduce((a,b)=>a+b,0); return tot>0 && (v/tot*100)>=5 ? (v/tot*100).toFixed(0)+"%" : ""; } },
        title: { display: false },
        legend: { position: "right" },
        tooltip: { callbacks: { label: function(ctx) { var tot=ctx.dataset.data.reduce((a,b)=>a+b,0); return ' '+ctx.label+' : '+formatNumber(ctx.parsed)+' ('+(tot>0?(ctx.parsed/tot*100):0).toFixed(1)+'%)'; } } }
      }
    }
  });
  
  if(id==="sourcesChart") sourcesChart=chart; else devicesChart=chart;
}

function renderSourcesPie(sheetName, row) { renderPieCommon("sourcesChart", sheetName, row ? [Number(row.moteurs_de_recherche), Number(row.entrees_directes), Number(row.sites_externes), Number(row.assistants_ia), Number(row.reseaux_sociaux), Number(row.campagnes)] : [], ["Moteurs de recherche", "Entrées directes", "Sites externes", "Assistants IA", "Réseaux sociaux", "Campagnes"]); }
function renderSourcesPieFromAgg(sheetName, agg) { renderPieCommon("sourcesChart", sheetName, agg ? [agg.moteurs_de_recherche, agg.entrees_directes, agg.sites_externes, agg.assistants_ia, agg.reseaux_sociaux, agg.campagnes] : [], ["Moteurs de recherche", "Entrées directes", "Sites externes", "Assistants IA", "Réseaux sociaux", "Campagnes"]); }
function renderDevicesPie(sheetName, row) { renderPieCommon("devicesChart", sheetName, row ? [Number(row.ordinateurs), Number(row.smartphone), Number(row.tablettes)] : [], ["Ordinateurs", "Smartphones", "Tablettes"], 3); }
function renderDevicesPieFromAgg(sheetName, agg) { renderPieCommon("devicesChart", sheetName, agg ? [agg.ordinateurs, agg.smartphone, agg.tablettes] : [], ["Ordinateurs", "Smartphones", "Tablettes"], 3); }

/* =======================================================
   EVOLUTION CHART
   ======================================================= */
function renderEvolutionChart(rows, sheetName) {
  var canvas = document.getElementById("evolutionChart");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  
  var COLORS = getEvolutionColors(sheetName);
  var labels = rows.map(r => { var m = String(r.date).match(/^(\d{4})-(\d{2})/); return m ? (m[2] + '/' + m[1]) : r.date; });

  evolutionChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        { label: "Visites", data: rows.map(r=>Number(r.visites||0)), borderColor: COLORS.visites, backgroundColor: COLORS.visites+"20", yAxisID: "y", tension: 0.3, borderWidth: 2 },
        { label: "Pages vues", data: rows.map(r=>Number(r.pages_vues||0)), borderColor: COLORS.pages_vues, backgroundColor: COLORS.pages_vues+"20", yAxisID: "y", tension: 0.3, borderWidth: 2 },
        { label: "Taux de rebond (%)", data: rows.map(r=>Number(r.taux_de_rebond||0)*100), borderColor: COLORS.taux_rebond, backgroundColor: COLORS.taux_rebond+"20", yAxisID: "y1", tension: 0.3, borderWidth: 2 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
      plugins: { title: { display: false }, legend: { position: "bottom" } },
      scales: { y: { type: "linear", position: "left", title: { display: true, text: "Visites / Pages vues" }, beginAtZero: true }, y1: { type: "linear", position: "right", title: { display: true, text: "Taux rebond (%)" }, grid: { drawOnChartArea: false }, beginAtZero: true } }
    }
  });
}

/* =======================================================
   COMPARISON CHART
   ======================================================= */
function renderComparisonChart(rows, year, sheetName) {
  var canvas = document.getElementById("comparisonChart");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  
  var colors = getComparisonColors(sheetName);
  var prevYear = String(parseInt(year) - 1);
  var months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
  var curD = months.map(m => { var r = getRowForMonth(rows, year+'-'+m); return r?Number(r.visites||0):0; });
  var prevD = months.map(m => { var r = getRowForMonth(rows, prevYear+'-'+m); return r?Number(r.visites||0):0; });

  comparisonChart = new Chart(ctx, {
    type: "bar",
    data: { labels: MOIS_NOMS, datasets: [ { label: year, data: curD, backgroundColor: colors.current }, { label: prevYear, data: prevD, backgroundColor: colors.previous } ] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { title: { display: false }, legend: { position: "bottom" } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

/* =======================================================
   TOP PAGES & TABLES
   ======================================================= */
function updateTopPages(sheetName, period) {
  var block = document.getElementById("top-pages-block");
  // MODIFICATION POUR TF
  if (sheetName === "Data RR" || sheetName === "Data TF") { 
    if(block) block.style.display = "none"; 
    return; 
  } else { 
    if(block) block.style.display = "block"; 
  }
  
  var topPages = getTopPagesForSite(sheetName);
  var isYear = period.length === 4;
  var filtered = topPages.filter(r => isYear ? String(r.date)===period : String(r.date).startsWith(period));
  filtered = filtered.sort((a,b) => a.position - b.position).slice(0, 10);
  
  var tbody = document.querySelector("#top-pages-table tbody");
  var thead = document.querySelector("#top-pages-table thead");
  
  if (!tbody || !thead) return;
  
  if (filtered.length === 0) { thead.innerHTML=""; tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;">Aucune donnée</td></tr>'; return; }
  
  thead.innerHTML = '<tr><th class="position">#</th><th class="evolution">Évol.</th><th class="page-title">Page</th><th class="numeric">Vues</th><th class="numeric">% Trafic</th><th class="numeric">Rebond</th><th class="numeric">Temps</th></tr>';
  var html = '';
  filtered.forEach(function(r) {
    html += '<tr><td class="position">'+r.position+'</td><td class="evolution '+getEvolutionClass(r.evolution)+'">'+getEvolutionLabel(r.evolution)+'</td><td class="page-title"><a href="'+r.url+'" target="_blank" title="'+(r.titre_page||"")+'">'+truncateText(r.titre_page, 60)+'</a></td><td class="numeric">'+formatNumber(r.vues)+'</td><td class="numeric">'+(r.pct_trafic*100).toFixed(2)+'%</td><td class="numeric">'+(r.taux_rebond*100).toFixed(1)+'%</td><td class="numeric">'+r.temps_moyen+'</td></tr>';
  });
  tbody.innerHTML = html;
}

function renderSourcesTable(row) {
  var tbody = document.querySelector("#sources-data-table tbody");
  if (!tbody) return;
  tbody.innerHTML = ""; if (!row) return;
  var data = [ { l: "Moteurs de recherche", v: Number(row.moteurs_de_recherche||0) }, { l: "Entrées directes", v: Number(row.entrees_directes||0) }, { l: "Sites externes", v: Number(row.sites_externes||0) }, { l: "Assistants IA", v: Number(row.assistants_ia||0) }, { l: "Réseaux sociaux", v: Number(row.reseaux_sociaux||0) }, { l: "Campagnes", v: Number(row.campagnes||0) } ];
  data.sort((a,b)=>b.v - a.v);
  var tot = data.reduce((a,b)=>a+b.v, 0);
  data.forEach(item => { if(item.v>0) tbody.innerHTML += '<tr><td>'+item.l+'</td><td class="numeric">'+formatNumber(item.v)+'</td><td class="numeric">'+(tot>0?item.v/tot*100:0).toFixed(1)+'%</td></tr>'; });
}

function renderDevicesTable(row) {
  var tbody = document.querySelector("#devices-data-table tbody");
  if (!tbody) return;
  tbody.innerHTML = ""; if (!row) return;
  var data = [ { l: "Ordinateurs", v: Number(row.ordinateurs||0) }, { l: "Smartphones", v: Number(row.smartphone||0) }, { l: "Tablettes", v: Number(row.tablettes||0) } ];
  data.sort((a,b)=>b.v - a.v);
  var tot = data.reduce((a,b)=>a+b.v, 0);
  data.forEach(item => { if(item.v>0) tbody.innerHTML += '<tr><td>'+item.l+'</td><td class="numeric">'+formatNumber(item.v)+'</td><td class="numeric">'+(tot>0?item.v/tot*100:0).toFixed(1)+'%</td></tr>'; });
}

/* =======================================================
   NOUVEAU : TÉLÉCHARGEMENT AVEC NOM COMPLET
   ======================================================= */
function downloadElement(elementId) {
  var element = document.getElementById(elementId);
  if (!element) return;

  var baseName = element.getAttribute('data-filename') || 'Graphique';

  var now = new Date();
  var yy = String(now.getFullYear()).slice(-2);
  var mm = String(now.getMonth() + 1).padStart(2, '0');
  var dd = String(now.getDate()).padStart(2, '0');
  var hh = String(now.getHours()).padStart(2, '0');
  var min = String(now.getMinutes()).padStart(2, '0');
  
  var timestamp = yy + mm + dd + ' ' + hh + 'h' + min;
  var finalName = baseName + ' - ' + timestamp + '.png';

  var btn = element.querySelector('.chart-dl-btn');
  if (btn) btn.style.display = 'none';

  html2canvas(element, {
    backgroundColor: document.body.classList.contains('dark') ? '#16213e' : '#ffffff',
    scale: 2
  }).then(function(canvas) {
    var link = document.createElement('a');
    link.download = finalName;
    link.href = canvas.toDataURL('image/png');
    link.click();
    if (btn) btn.style.display = 'block';
  }).catch(function(err) {
    console.error(err);
    if (btn) btn.style.display = 'block';
  });
}

/* =======================================================
   FONCTIONS UTILITAIRES
   ======================================================= */
function parseDuration(str) { if (!str) return 0; var m = str.match(/(\d+)\s*min\s*(\d+)?\s*s?/); return m ? parseInt(m[1])*60+(parseInt(m[2])||0) : 0; }
function formatDuration(s) { var m=Math.floor(s/60), sec=Math.round(s%60); return m+' min '+sec+' s'; }
function formatMonthYear(ym) { var m=ym.match(/^(\d{4})-(\d{2})$/); return m ? MOIS_NOMS[parseInt(m[2])-1]+' '+m[1] : ym; }
function formatPercent(v) { if(v===null||isNaN(v)) return "-"; return (v>0?"+":"")+v.toFixed(1)+"%"; }
function formatNumber(n) { return Number(n||0).toLocaleString("fr-FR"); }
function calcVariation(c, p) { if(!p) return null; return ((c-p)/p)*100; }
function getEvolutionClass(e) { if(e==="new")return "new"; if(e==="stable"||e==="="||e==="—")return "stable"; var n=parseInt(e); return n>0?"up":n<0?"down":"stable"; }
function getEvolutionLabel(e) { if(e==="new")return "🆕 New"; if(e==="stable"||e==="="||e==="—")return "— Stable"; var n=parseInt(e); return n>0?"↑ +"+n:n<0?"↓ "+n:"-"; }
function truncateText(t, l) { if(!t)return ""; return t.length<=l?t:t.substring(0,l)+"..."; }
function toggleDarkMode() { document.body.classList.toggle("dark"); var btn=document.querySelector(".toggle-dark"); btn.textContent=document.body.classList.contains("dark")?"☀️ Mode clair":"🌙 Mode sombre"; }
function exportPDF() { window.print(); }
async function refreshData() { var btn=document.querySelector('.refresh-btn'); btn.disabled=true; btn.textContent='⏳'; try { localStorage.removeItem(CACHE_KEY); localStorage.removeItem(CACHE_MONTH_KEY); var res=await fetch(API_URL); allData=await res.json(); setCachedData(allData); initPeriodSelector(); applyHashToSelectors(); updateDashboard(); console.log('Données rafraîchies'); } catch(err){ alert('Erreur rafraîchissement'); } finally { btn.disabled=false; btn.textContent='🔄'; } }