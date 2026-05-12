import { getJson } from "../api.js";
import { renderSingleChart } from "../charts.js";
import { formatCurrencyVnd } from "../utils.js";

async function init() {
  const [trend, segmentation] = await Promise.all([
    getJson("/api/trend?time_granularity=month"),
    getJson("/api/segmentation"),
  ]);

  // Forecast Chart (Simulated)
  const values = trend.map((i) => i.value);
  const forecast = values.map((v, idx, arr) => {
    if (idx < 2) return v;
    return Math.round((arr[idx - 1] + arr[idx - 2]) / 2);
  });
  renderSingleChart("forecastChart", {
    type: "line",
    data: {
      labels: trend.map((i) => i.period),
      datasets: [
        { label: "Thực tế", data: values, borderColor: "#2563eb", backgroundColor: "rgba(37,99,235,0.08)", fill: true, tension: 0.3, pointRadius: 3 },
        { label: "Dự báo", data: forecast, borderColor: "#7c3aed", borderDash: [5, 5], backgroundColor: "rgba(124,58,237,0.06)", fill: true, tension: 0.3, pointRadius: 3 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", labels: { color: "#e2e8f0", font: { size: 13 } } },
      },
      scales: {
        x: { ticks: { color: "#94a3b8", maxTicksLimit: 12 }, grid: { color: "rgba(255,255,255,0.05)" } },
        y: { ticks: { color: "#94a3b8", callback: v => (v / 1e9).toFixed(1) + " tỷ" }, grid: { color: "rgba(255,255,255,0.05)" } },
      },
    },
  });

  // K-Means Distribution Chart
  const summary = segmentation.summary;
  renderSingleChart("kmeansChart", {
    type: "doughnut",
    data: {
      labels: summary.map((i) => i.Segment_Name),
      datasets: [{
        data: summary.map((i) => i.User_ID),
        backgroundColor: ["#2563eb", "#7c3aed", "#10b981", "#f59e0b"]
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: "#e2e8f0" } }
      }
    }
  });

  // Populate Summary Table
  const tableBody = document.getElementById("segmentSummaryTable");
  tableBody.innerHTML = summary.map(item => `
    <tr>
      <td><strong>${item.Segment_Name}</strong></td>
      <td>${item.User_ID}</td>
      <td>${Math.round(item.Recency)} ngày</td>
      <td>${item.Frequency.toFixed(1)} giao dịch</td>
      <td><span class="text-success">${formatCurrencyVnd(item.Monetary)}</span></td>
    </tr>
  `).join("");
}

init();
