let db;
let chart;

// filteri
let filteredZone = null;
let filteredStart = null;
let filteredEnd = null;

window.onload = function () {
  initDB();
  initChart();
  const sel = document.getElementById("commentSelect");
  if (sel) sel.addEventListener("change", commentChanged);
};

/* =================== DB =================== */
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

/* =============== Helpers (datum/vreme) =============== */
function pad2(n){ return String(n).padStart(2,'0'); }

function normalizeDate(dateStr){
  if(!dateStr) return "";
  const s = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;                  // ISO
  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);            // d.m.yyyy
  if (m) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);                // d/m/yyyy
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

// UI prikaz datuma (srpski format), bez uticaja na sortiranje/filtre
function displayDate(d){
  const iso = normalizeDate(d);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return d;
  const [y, m, day] = iso.split("-");
  return `${parseInt(day,10)}.${parseInt(m,10)}.${y}`;
}

// realni timestamp za sortiranje
function toTimestamp(entry){
  const d = normalizeDate(entry.date);
  const t = normalizeTime(entry.time || "00:00");
  return new Date(`${d}T${t}`).getTime();
}

/* =================== UI helpers =================== */
function commentChanged() {
  const sel = document.getElementById("commentSelect");
  const input = document.getElementById("comment");
  if (input) input.style.display = sel && sel.value === "custom" ? "inline-block" : "none";
}

function getTimeZoneLabel(hour) {
  if (hour >= 6 && hour < 9) return "jutro";
  if (hour >= 9 && hour < 12) return "prepodne";
  if (hour >= 12 && hour < 17) return "podne";
  if (hour >= 17 && hour < 22) return "vece";
  return "noc";
}

/* =================== Unos =================== */
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
    zone: getTimeZoneLabel(parseInt(time.split(":")[0],10))
  };

  const tx = db.transaction("entries", "readwrite");
  const store = tx.objectStore("entries");
  store.add(entry);
  tx.oncomplete = () => loadEntries();
}

/* =================== Učitavanje / prikaz =================== */
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
      // tabela: novije → starije (DESC)
      entries.sort((a, b) => toTimestamp(b) - toTimestamp(a));

      const filtered = getFilteredEntries(entries);
      filtered.forEach(addRow);

      // grafik: starije → novije (ASC)
      updateChart(filtered);

      // ako koristiš kalendar, ostavi kako je bilo
      if (typeof updateCalendar === "function") updateCalendar(entries);
    }
  };
}

function addRow(entry) {
  if (filteredZone && entry.zone !== filteredZone) return;

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${displayDate(entry.date)}</td>
    <td>${normalizeTime(entry.time)}</td>
    <td>${entry.glucose}</td>
    <td>${entry.comment || ""} ${entry.emojis || ""}</td>
  `;
  document.querySelector("#logTable tbody").appendChild(tr);
}

/* =================== Filteri =================== */
function getFilteredEntries(entries){
  return entries.filter(e => {
    if (filteredZone && e.zone !== filteredZone) return false;
    const d = normalizeDate(e.date);
    if (filteredStart && d < filteredStart) return false;
    if (filteredEnd && d > filteredEnd) return false;
    return true;
  });
}

function filterBy(zone) {
  filteredZone = zone;
  loadEntries();
}

function applyDateFilters(){
  const s = document.getElementById('startDate');
  const e = document.getElementById('endDate');
  filteredStart = s && s.value ? normalizeDate(s.value) : null;
  filteredEnd   = e && e.value ? normalizeDate(e.value) : null;
  loadEntries();
}

function resetFilter(){
  filteredZone = null;
  filteredStart = null;
  filteredEnd = null;
  const s = document.getElementById('startDate'); if (s) s.value = '';
  const e = document.getElementById('endDate');   if (e) e.value = '';
  loadEntries();
}

/* =================== Ostalo =================== */
function clearAll() {
  const req = indexedDB.deleteDatabase("glucoseDB");
  req.onsuccess = () => location.reload();
}

function importCSV() {
  const file = document.getElementById("fileInput").files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const raw = e.target.result;
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const startIdx = lines[0].toLowerCase().startsWith("date") ? 1 : 0;

    const tx = db.transaction("entries", "readwrite");
    const store = tx.objectStore("entries");

    for (let i = startIdx; i < lines.length; i++) {
      const row = lines[i];

      // uzmi prva tri polja kao date,time,glucose; ostatak je comment (može da sadrži zareze)
      let parts = row.match(/^(.*?),(.*?),(.*?),(.*)$/);
      if (!parts) parts = row.split(",");
      else parts = [parts[1], parts[2], parts[3], parts[4]];

      const date = (parts[0] || "").trim();
      const time = (parts[1] || "").trim();
      const glucose = parseFloat((parts[2] || "").trim());
      let comment = (parts.slice(3).join(",") || "").trim();
      comment = comment.replace(/^\"|\"$/g,"");

      if (date && time && !isNaN(glucose)) {
        store.add({
          date, time, glucose,
          comment, emojis: "",
          zone: getTimeZoneLabel(parseInt(time.split(":")[0],10))
        });
      }
    }
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
      // izvozimo kako su uneti (ne diramo format)
      entries.forEach(r => {
        const comment = (r.comment || "") + (r.emojis ? (" " + r.emojis) : "");
        const safeComment = '"' + comment.replace(/"/g,'""') + '"';
        csv += `${r.date},${r.time},${r.glucose},${safeComment}\n`;
      });
      const blob = new Blob([csv], { type: "text/csv" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "dnevnik_glukoze.csv";
      link.click();
    }
  };
}

/* =================== Grafik =================== */
function initChart() {
  const el = document.getElementById("glucoseChart");
  if (!el) return;
  const ctx = el.getContext("2d");
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [{ label: "Glukoza (mmol/L)", data: [], fill: false, tension: 0.3 }]
    },
    options: {
      scales: { y: { beginAtZero: true, suggestedMax: 20 } }
    }
  });
}

function updateChart(entries) {
  if (!chart) return;
  // ASC: starije -> novije (levo -> desno)
  const sorted = [...entries].sort((a,b)=> toTimestamp(a) - toTimestamp(b));
  const labels = sorted.map(e => `${displayDate(e.date)} ${normalizeTime(e.time)}`);
  const data   = sorted.map(e => e.glucose);
  chart.data.labels = labels;
  chart.data.datasets[0].data = data;
  chart.update();
}
