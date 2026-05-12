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
        <td>${user.preferred_payment_method}</td>
        <td><span class="heat-cell" style="padding: 4px 8px; font-size: 11px;">${user.segment}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { font: { family: 'Inter', size: 12 } } }
    }
  };

  renderSingleChart("segmentChart", {
    type: "pie",
    data: {
      labels: data.segments.map((i) => i.segment),
      datasets: [{ 
        data: data.segments.map((i) => i.user_count), 
        backgroundColor: ["#2563eb", "#10b981", "#f59e0b"] 
      }],
    },
    options: commonOptions
  });

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

