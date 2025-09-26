let db;
let chart;
let filteredStart = null;
let filteredEnd = null;

window.onload = function () {
  initDB();
  initChart();
  document.getElementById("commentSelect").addEventListener("change", commentChanged);

  const now = new Date();
  document.getElementById("date").value = now.toISOString().slice(0,10);
  document.getElementById("time").value = now.toTimeString().slice(0,5);
};

function initDB() {
  const request = indexedDB.open("glucoseDB", 1);
  request.onupgradeneeded = function (e) {
    db = e.target.result;
    if (!db.objectStoreNames.contains("entries")) {
      db.createObjectStore("entries", { keyPath: "id", autoIncrement: true });
    }
  };
  request.onsuccess = function (e) {
    db = e.target.result;
    loadEntries();
  };
}

function commentChanged() {
  const sel = document.getElementById("commentSelect");
  const input = document.getElementById("comment");
  input.style.display = sel.value === "custom" ? "inline-block" : "none";
}

// --- Helpers ---
function pad2(n){ return String(n).padStart(2,"0"); }

function normalizeDate(dateStr){
  if(!dateStr) return "";
  const s = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // ISO
  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return `${dt.getFullYear()}-${pad2(dt.getMonth()+1)}-${pad2(dt.getDate())}`;
  return s;
}

function normalizeTime(timeStr){
  if(!timeStr) return "";
  const s = timeStr.trim().replace(".", ":");
  let m = s.match(/^(\d{1,2}):(\d{1,2})$/);
  if (m) return `${pad2(m[1])}:${pad2(m[2])}`;
  m = s.match(/^(\d{1,2}):(\d{1,2}):\d{1,2}$/);
  if (m) return `${pad2(m[1])}:${pad2(m[2])}`;
  return s;
}

function toTimestamp(entry){
  const isoDate = normalizeDate(entry.date);
  const normTime = normalizeTime(entry.time || "00:00");
  const dt = new Date(`${isoDate}T${normTime}`);
  return dt.getTime();
}

function getTimeZoneLabel(hour) {
  if (hour >= 6 && hour < 9) return "jutro";
  if (hour >= 9 && hour < 12) return "prepodne";
  if (hour >= 12 && hour < 17) return "podne";
  if (hour >= 17 && hour < 22) return "vece";
  return "noc";
}

function getSelectedZones(){
  const ids = ["z-jutro","z-prepodne","z-podne","z-vece","z-noc"];
  const map = {"z-jutro":"jutro","z-prepodne":"prepodne","z-podne":"podne","z-vece":"vece","z-noc":"noc"};
  const sel = ids.filter(id => document.getElementById(id)?.checked).map(id => map[id]);
  return sel.length ? sel : ["jutro","prepodne","podne","vece","noc"]; // fallback: all
}

// Functions: addEntry, loadEntries, renderStats, renderTable, applyDateFilters, resetFilter...
