function openModal(date, entries) {
  document.getElementById("modalTitle").textContent = `Detalji za ${date}`;
  document.getElementById("dayEntries").innerHTML = entries.map(e =>
    `<li>${e.time} - ${e.glucose} mmol/L (${e.comment} ${e.emojis || ""})</li>`
  ).join("");

  const ctx = document.getElementById("dayChart").getContext("2d");
  new Chart(ctx, {
    type: "line",
    data: {
      labels: entries.map(e => e.time),
      datasets: [{
        label: "Glukoza (mmol/L)",
        data: entries.map(e => e.glucose),
        fill: false
      }]
    },
    options: {
      scales: {
        y: { beginAtZero: true, max: 20 }
      }
    }
  });

  document.getElementById("modal").style.display = "block";
}

function closeModal() {
  document.getElementById("modal").style.display = "none";
}