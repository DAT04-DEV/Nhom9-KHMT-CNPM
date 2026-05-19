import { getJson } from "../api.js";
import { renderSingleChart } from "../charts.js";
import { formatCurrencyVnd, formatInteger } from "../utils.js";

async function init() {
  const data = await getJson("/api/user-analytics");
  
  // Render Top Users Table
  const tbody = document.getElementById("topUsersBody");
  if (tbody && data.top_users) {
    tbody.innerHTML = "";
    data.top_users.forEach(user => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><b>${user.user_id}</b></td>
        <td>${formatCurrencyVnd(user.total_spend)}</td>
        <td>${formatInteger(user.transaction_count)}</td>
        <td><span class="heat-cell" style="padding: 4px 8px; font-size: 11px;">${user.segment}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  const textColor = document.documentElement.getAttribute("data-theme") === "dark" ? "#ffffff" : "#000000";
  const gridColor = document.documentElement.getAttribute("data-theme") === "dark" ? "rgba(148,163,184,0.15)" : "rgba(0,0,0,0.08)";

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { ticks: { color: textColor }, grid: { color: gridColor } },
      y: { ticks: { color: textColor }, grid: { color: gridColor } }
    },
    plugins: {
      legend: { labels: { color: textColor, font: { family: 'Inter', size: 12 } } }
    }
  };



  renderSingleChart("hourChart", {
    type: "line",
    data: { 
      labels: data.by_hour.map((i) => i.label), 
      datasets: [{ 
        label: "Số giao dịch",
        data: data.by_hour.map((i) => i.value), 
        borderColor: "#16a34a",
        tension: 0.4
      }] 
    },
    options: commonOptions
  });

  renderSingleChart("dayChart", {
    type: "bar",
    data: { 
      labels: data.by_day.map((i) => i.label), 
      datasets: [{ 
        label: "Số giao dịch",
        data: data.by_day.map((i) => i.value), 
        backgroundColor: "#7c3aed",
        borderRadius: 6
      }] 
    },
    options: commonOptions
  });
}

init();

window.addEventListener("filterChanged", () => {
  init();
});

