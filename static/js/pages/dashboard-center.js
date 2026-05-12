import { getJson } from "../api.js";
import { renderSingleChart } from "../charts.js";
import { chartPalette } from "../utils.js";

async function loadData() {
  // Get filters from URL
  const urlParams = new URLSearchParams(window.location.search);
  const q = urlParams.toString();

  const [distributions, trend, hourly] = await Promise.all([
    getJson(`/api/distributions?${q}`),
    getJson(`/api/trend?${q}`),
    getJson(`/api/hourly-distribution?${q}`),
  ]);

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { font: { family: 'Inter', size: 12 } } }
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

  renderSingleChart("pieChart", {
    type: "pie",
    data: {
      labels: distributions.payment_method_share.map((_, idx) => `P${idx + 1}`),
      datasets: [{ data: distributions.payment_method_share.map((i) => i.value), backgroundColor: chartPalette }],
    },
    options: {
      ...commonOptions,
      maintainAspectRatio: true,
      plugins: {
        ...commonOptions.plugins,
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const item = distributions.payment_method_share[ctx.dataIndex];
              return `${item.label}: ${item.value.toLocaleString("vi-VN")} ₫`;
            },
          },
        },
      },
    },
  });

  const paymentLegend = document.getElementById("paymentLegend");
  if (paymentLegend) {
    paymentLegend.innerHTML = distributions.payment_method_share
      .map((item, idx) => `
        <span>
          <i style="display:inline-block; width:12px; height:12px; background:${chartPalette[idx % chartPalette.length]}; border-radius:3px;"></i>
          <strong>P${idx + 1}</strong>: ${item.label}
        </span>
      `)
      .join("");
  }

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
      scales: { x: { ticks: { maxRotation: 0, minRotation: 0 } } },
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
