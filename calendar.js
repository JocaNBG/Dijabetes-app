function updateCalendar(entries) {
  const calendar = document.getElementById("calendar");
  calendar.innerHTML = "";

  const days = {};

  entries.forEach(e => {
    if (!days[e.date]) days[e.date] = [];
    days[e.date].push(e);
  });

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const fragment = document.createDocumentFragment();

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const cell = document.createElement("div");
    cell.className = "calendar-day";
    cell.textContent = d;

    if (days[dateStr]) {
      const avg = (days[dateStr].reduce((sum, e) => sum + e.glucose, 0) / days[dateStr].length).toFixed(1);
      cell.innerHTML += `<br/><small>${avg} mmol/L</small>`;
      cell.onclick = () => openModal(dateStr, days[dateStr]);
    }

    fragment.appendChild(cell);
  }

  calendar.appendChild(fragment);
}