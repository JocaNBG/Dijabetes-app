function openModal(date, entries) {
  document.getElementById("modalTitle").textContent = `Detalji za ${date}`;
  // sort within the day by time ascending
  const safe = entries.slice().sort((a,b) => (a.time||"").localeCompare(b.time||""));
  document.getElementById("dayEntries").innerHTML = safe
    .map(e => `<li>${e.time} — <b>${e.glucose}</b> mmol/L (${e.zone}) — ${e.comment || ""} ${e.emojis || ""}</li>`)
    .join("");

  const zones = ["jutro","prepodne","podne","vece","noc"];
  const labels = {"jutro":"🌄 Jutro","prepodne":"🌤️ Pre podne","podne":"☀️ Podne","vece":"🌇 Veče","noc":"🌙 Noć"};
  const zoneStatsDiv = document.getElementById("zoneStats");
  zoneStatsDiv.innerHTML = zones.map(z => {
    const zs = safe.filter(e => e.zone === z);
    const avg = zs.length ? (zs.reduce((s,x)=>s + x.glucose,0)/zs.length).toFixed(1) : "—";
    return `<div class="card"><h4>${labels[z]}</h4><p>Prosek: <b>${avg}</b> mmol/L</p><p>Unosa: ${zs.length}</p></div>`;
  }).join("");

  const ctx = document.getElementById("dayChart").getContext("2d");
  if (window._dayChart) { window._dayChart.destroy(); }
  window._dayChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: safe.map(e => e.time),
      datasets: [{ label: "Glukoza (mmol/L)", data: safe.map(e => e.glucose), fill: false, tension: 0.3 }]
    },
    options: { scales: { y: { beginAtZero: true, suggestedMax: 20 } } }
  });

  document.getElementById("modal").style.display = "block";
}

function closeModal() {
  document.getElementById("modal").style.display = "none";
}
