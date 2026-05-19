import { chartPalette, formatCurrencyVnd } from "./utils.js";

const charts = {};

function getThemeTextColor() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  return isDark ? "#ffffff" : "#000000";
}

function getThemeGridColor() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  return isDark ? "rgba(148,163,184,0.15)" : "rgba(0,0,0,0.08)";
}

function buildAxisOptions() {
  const textColor = getThemeTextColor();
  const gridColor = getThemeGridColor();
  return {
    x: { ticks: { color: textColor }, grid: { color: gridColor } },
    y: { ticks: { color: textColor }, grid: { color: gridColor } },
  };
}

function upsertChart(canvasId, config) {
  if (charts[canvasId]) {
    charts[canvasId].data = config.data;
    charts[canvasId].options = config.options;
    charts[canvasId].update();
    return;
  }
  charts[canvasId] = new Chart(document.getElementById(canvasId), config);
}

function tooltipMoneyLabel(context) {
  const value = context.raw ?? 0;
  return `Giá trị: ${formatCurrencyVnd(value)}`;
}

export function renderDistributionCharts(distribution) {
  const pieData = distribution.payment_method_share;
  upsertChart("paymentPie", {
    type: "pie",
    data: {
      labels: pieData.map((item) => item.label),
      datasets: [{ data: pieData.map((item) => item.value), backgroundColor: chartPalette }],
    },
    options: {
      plugins: {
        legend: { position: "bottom", labels: { color: getThemeTextColor() } },
        tooltip: { callbacks: { label: tooltipMoneyLabel } },
      },
    },
  });

  const categoryData = distribution.merchant_category_spend;
  upsertChart("categoryBar", {
    type: "bar",
    data: {
      labels: categoryData.map((item) => item.label),
      datasets: [
        { label: "Doanh số (VND)", data: categoryData.map((item) => item.value), backgroundColor: "#3b82f6" },
      ],
    },
    options: {
      scales: buildAxisOptions(),
      plugins: { tooltip: { callbacks: { label: tooltipMoneyLabel } } },
    },
  });

  const locationData = distribution.location_sales;
  upsertChart("locationBar", {
    type: "bar",
    data: {
      labels: locationData.map((item) => item.label),
      datasets: [
        { label: "Doanh số (VND)", data: locationData.map((item) => item.value), backgroundColor: "#22c55e" },
      ],
    },
    options: {
      indexAxis: "y",
      scales: buildAxisOptions(),
      plugins: { tooltip: { callbacks: { label: tooltipMoneyLabel } } },
    },
  });
}

export function renderTrendChart(trendData) {
  upsertChart("trendLine", {
    type: "line",
    data: {
      labels: trendData.map((item) => item.period),
      datasets: [
        {
          label: "Xu hướng thanh toán",
          data: trendData.map((item) => item.value),
          borderColor: "#a855f7",
          backgroundColor: "rgba(168,85,247,0.2)",
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      scales: buildAxisOptions(),
      plugins: {
        legend: { labels: { color: getThemeTextColor() } },
        tooltip: { callbacks: { label: tooltipMoneyLabel } },
      },
    },
  });
}

export function renderSingleChart(canvasId, config) {
  upsertChart(canvasId, config);
}

