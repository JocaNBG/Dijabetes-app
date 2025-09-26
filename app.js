let db;
let filteredStart = null;
let filteredEnd = null;
let chart;
let filteredZone = null;

window.onload = function () {
  initDB();
  initChart();
  document.getElementById("commentSelect").addEventListener("change", commentChanged);
};

function initDB() {
  const request = indexedDB.open("glucoseDB", 1);
  request.onupgradeneeded = function (e) {
    db = e.target.result;
    db.createObjectStore("entries", { keyPath: "id", autoIncrement: true });
  };
  request.onsuccess = function (e) {
    db = e.target.result;
    loadEntries();
  };
}


function pad2(n){ return String(n).padStart(2,'0'); }
function normalizeDate(dateStr){
  if(!dateStr) return "";
  const s = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
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
  const s = timeStr.trim().replace(".",":");
  let m = s.match(/^(\d{1,2}):(\d{1,2})$/);
  if (m) return `${pad2(parseInt(m[1],10))}:${pad2(parseInt(m[2],10))}`;
  m = s.match(/^(\d{1,2}):(\d{1,2}):\d{1,2}$/);
  if (m) return `${pad2(parseInt(m[1],10))}:${pad2(parseInt(m[2],10))}`;
  return s;
}
function toTimestamp(entry){
  const d = normalizeDate(entry.date);
  const t = normalizeTime(entry.time || "00:00");
  return new Date(`${d}T${t}`).getTime();
}

function commentChanged() {
  const sel = document.getElementById("commentSelect");
  const input = document.getElementById("comment");
  input.style.display = sel.value === "custom" ? "inline-block" : "none";
}

function getTimeZoneLabel(hour) {
  if (hour >= 6 && hour < 9) return "jutro";
  if (hour >= 9 && hour < 12) return "prepodne";
  if (hour >= 12 && hour < 17) return "podne";
  if (hour >= 17 && hour < 22) return "vece";
  return "noc";
}

function addEntry() {
  const date = document.getElementById("date").value;
  const time = document.getElementById("time").value;
  const glucose = parseFloat(document.getElementById("glucose").value);
  let comment = document.getElementById("commentSelect").value;
  if (comment === "custom") comment = document.getElementById("comment").value;

  const emojis = Array.from(document.querySelectorAll(".emoji-select input:checked"))
                      .map(c => c.value).join(" ");

  const entry = {
    date, time, glucose, comment, emojis,
    zone: getTimeZoneLabel(parseInt(time.split(":")[0]))
  };

  const tx = db.transaction("entries", "readwrite");
  const store = tx.objectStore("entries");
  store.add(entry);
  tx.oncomplete = () => loadEntries();
}

function loadEntries() {
  const tbody = document.querySelector("#logTable tbody");
  tbody.innerHTML = "";
  const store = db.transaction("entries").objectStore("entries");
  const entries = [];

  store.openCursor().onsuccess = function (e) {
    const cursor = e.target.result;
    if (cursor) {
      entries.push({ id: cursor.key, ...cursor.value });
      cursor.continue();
    } else {
      // Sort reverse chrono
      entries.sort((a, b) => toTimestamp(b) - toTimestamp(a));
      const filtered = getFilteredEntries(entries);
      filtered.forEach(addRow);
      updateChart(filtered);
      updateCalendar(entries);
    }
  };
}

function addRow(entry) {
  if (filteredZone && entry.zone !== filteredZone) return;

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${entry.date}</td>
    <td>${entry.time}</td>
    <td>${entry.glucose}</td>
    <td>${entry.comment} ${entry.emojis || ""}</td>
  `;
  document.querySelector("#logTable tbody").appendChild(tr);
}

function filterBy(zone) {
  filteredZone = zone;
  loadEntries();
}

function resetFilter() {
  filteredZone = null;
  loadEntries();
}

function clearAll() {
  const req = indexedDB.deleteDatabase("glucoseDB");
  req.onsuccess = () => location.reload();
}

function importCSV() {
  const file = document.getElementById("fileInput").files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const lines = e.target.result.split("\n").slice(1);
    const tx = db.transaction("entries", "readwrite");
    const store = tx.objectStore("entries");

    lines.forEach(line => {
      const [date, time, glucose, comment] = line.split(",");
      if (date && time && glucose) {
        store.add({
          date, time, glucose: parseFloat(glucose),
          comment, emojis: "", zone: getTimeZoneLabel(parseInt(time.split(":")[0]))
        });
      }
    });
    tx.oncomplete = () => loadEntries();
  };
  reader.readAsText(file);
}

function exportCSV() {
  const store = db.transaction("entries").objectStore("entries");
  const entries = [];
  store.openCursor().onsuccess = function (e) {
    const cursor = e.target.result;
    if (cursor) {
      entries.push(cursor.value);
      cursor.continue();
    } else {
      let csv = "date,time,glucose,comment\n";
      entries.forEach(e => {
        csv += `${e.date},${e.time},${e.glucose},"${e.comment} ${e.emojis || ""}"\n`;
      });
      const blob = new Blob([csv], { type: "text/csv" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "dnevnik_glukoze.csv";
      link.click();
    }
  };
}

function initChart() {
  const ctx = document.getElementById("glucoseChart").getContext("2d");
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "Glukoza (mmol/L)",
        data: [],
        fill: false,
        tension: 0.3
      }]
    },
    options: {
      scales: {
        y: { beginAtZero: true, max: 20 }
      }
    }
  });
}

function updateChart(entries) {
  const labels = entries.map(e => `${e.date} ${e.time}`);
  const data = entries.map(e => e.glucose);
  chart.data.labels = labels;
  chart.data.datasets[0].data = data;
  chart.update();
}
function getFilteredEntries(entries){
  return entries.filter(e => {
    if (typeof filteredZone !== 'undefined' && filteredZone && e.zone !== filteredZone) return false;
    const d = normalizeDate(e.date);
    if (filteredStart && d < filteredStart) return false;
    if (filteredEnd && d > filteredEnd) return false;
    return true;
  });
}

function applyDateFilters(){
  const s = document.getElementById('startDate');
  const e = document.getElementById('endDate');
  filteredStart = s && s.value ? normalizeDate(s.value) : null;
  filteredEnd = e && e.value ? normalizeDate(e.value) : null;
  loadEntries();
}

// override to also clear date period
function resetFilter(){
  if (typeof filteredZone !== 'undefined') filteredZone = null;
  filteredStart = null; filteredEnd = null;
  const s = document.getElementById('startDate'); if (s) s.value = '';
  const e = document.getElementById('endDate');   if (e) e.value = '';
  loadEntries();
}
