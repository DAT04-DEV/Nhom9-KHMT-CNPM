import { getJson } from "../api.js";
import { renderSingleChart } from "../charts.js";
import { chartPalette, formatCurrencyVnd, formatInteger, formatPercent } from "../utils.js";

async function loadData() {
  // Get filters from URL
  const urlParams = new URLSearchParams(window.location.search);
  const q = urlParams.toString();

  const [summary, distributions, trend, hourly] = await Promise.all([
    getJson(`/api/summary?${q}`),
    getJson(`/api/distributions?${q}`),
    getJson(`/api/trend?${q}`),
    getJson(`/api/hourly-distribution?${q}`),
  ]);

  const valueEls = {
    totalGmv: document.getElementById("totalGmv"),
    totalTransactions: document.getElementById("totalTransactions"),
    monthlyActiveUsers: document.getElementById("monthlyActiveUsers"),
    fraudRate: document.getElementById("fraudRate"),
  };

  if (valueEls.totalGmv && summary) {
    valueEls.totalGmv.textContent = formatCurrencyVnd(summary.total_gmv || 0);
    valueEls.totalGmv.classList.remove("reveal-left");
    void valueEls.totalGmv.offsetWidth; // Trigger reflow
    valueEls.totalGmv.classList.add("reveal-left");

    valueEls.totalTransactions.textContent = formatInteger(Math.round(summary.total_transactions || 0));
    valueEls.monthlyActiveUsers.textContent = formatInteger(Math.round(summary.active_users_monthly_avg || 0));
    valueEls.fraudRate.textContent = formatPercent(summary.fraud_rate || 0);
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

  renderSingleChart("lineChart", {
    type: "line",
    data: { 
      labels: trend.map((i) => i.period), 
      datasets: [{ 
        label: "Doanh số",
        data: trend.map((i) => i.value), 
        borderColor: "#2563eb",
        backgroundColor: "rgba(37, 99, 235, 0.1)",
        fill: true,
        tension: 0.4
      }] 
    },
    options: commonOptions
  });

  renderSingleChart("barChart", {
    type: "bar",
    data: {
      labels: distributions.merchant_category_spend.map((i) => i.label),
      datasets: [{ 
        label: "VND",
        data: distributions.merchant_category_spend.map((i) => i.value), 
        backgroundColor: "#2563eb",
        borderRadius: 6
      }],
    },
    options: commonOptions
  });



  renderSingleChart("hourDayChart", {
    type: "bar",
    data: { 
      labels: hourly.map((i) => `${i.label}h`), 
      datasets: [{ 
        label: "Giao dịch",
        data: hourly.map((i) => i.value), 
        backgroundColor: "#22c55e",
        borderRadius: 6
      }] 
    },
    options: commonOptions
  });

  const geoDisplay = distributions.location_sales.map((item, idx) => ({
    code: `L${idx + 1}`,
    label: item.label,
    value: item.value,
  }));

  renderSingleChart("geoChart", {
    type: "bar",
    data: {
      labels: geoDisplay.map((i) => i.code),
      datasets: [{ 
        label: "VND",
        data: geoDisplay.map((i) => i.value), 
        backgroundColor: "#7c3aed",
        borderRadius: 6
      }],
    },
    options: {
      ...commonOptions,
      indexAxis: "x",
      scales: {
        x: { ticks: { color: textColor, maxRotation: 0, minRotation: 0 }, grid: { color: gridColor } },
        y: { ticks: { color: textColor }, grid: { color: gridColor } }
      },
      plugins: {
        ...commonOptions.plugins,
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const item = geoDisplay[ctx.dataIndex];
              return `${item.label}: ${item.value.toLocaleString("vi-VN")} ₫`;
            },
          },
        },
      },
    },
  });

  const geoLegend = document.getElementById("geoLegend");
  if (geoLegend) {
    geoLegend.innerHTML = geoDisplay.map((item) => `
      <span>
        <i style="display:inline-block; width:12px; height:12px; background:#7c3aed; border-radius:3px;"></i>
        <strong>${item.code}</strong>: ${item.label}
      </span>
    `).join("");
  }
}

async function init() {
  await loadData();
}
init();

window.addEventListener("filterChanged", () => {
  init();
});
