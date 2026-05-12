import { getJson, fetchDashboardData } from "./api.js";
import { renderDistributionCharts, renderTrendChart } from "./charts.js";
import { formatCurrencyVnd, formatInteger, formatPercent, formatQueryString } from "./utils.js";

const elements = {
  totalGmv: document.getElementById("totalGmv"),
  totalTransactions: document.getElementById("totalTransactions"),
  fraudRate: document.getElementById("fraudRate"),
  topCity: document.getElementById("topCity"),
  locationFilter: document.getElementById("locationFilter"),
  paymentFilter: document.getElementById("paymentFilter"),
  timeGranularity: document.getElementById("timeGranularity"),
  dashboardMessage: document.getElementById("dashboardMessage"),
};

function setMessage(message, variant = "info") {
  elements.dashboardMessage.textContent = message;
  elements.dashboardMessage.classList.toggle("error", variant === "error");
}

function getCurrentFilters() {
  return {
    location: elements.locationFilter.value,
    paymentMethod: elements.paymentFilter.value,
    timeGranularity: elements.timeGranularity.value,
  };
}

function renderSummary(summary) {
  elements.totalGmv.textContent = formatCurrencyVnd(summary.total_gmv);
  elements.totalTransactions.textContent = formatInteger(summary.total_transactions);
  elements.fraudRate.textContent = formatPercent(summary.fraud_rate);
  elements.topCity.textContent = summary.top_city || "-";
}

function appendOptions(selectEl, values) {
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    selectEl.appendChild(option);
  });
}

async function populateFilters() {
  const data = await getJson("/api/filters");
  appendOptions(elements.locationFilter, data.locations);
  appendOptions(elements.paymentFilter, data.payment_methods);
}

async function loadDashboard() {
  try {
    setMessage("Đang tải dữ liệu...");
    const queryString = formatQueryString(getCurrentFilters());
    const { summary, distributions, trend } = await fetchDashboardData(queryString);

    renderSummary(summary);
    renderDistributionCharts(distributions);
    renderTrendChart(trend);
    setMessage("Dữ liệu đã được cập nhật.");
  } catch (error) {
    console.error(error);
    setMessage("Không thể tải dữ liệu dashboard. Vui lòng thử lại.", "error");
  }
}

async function initDashboard() {
  // Tách bước khởi tạo filter và bước render dữ liệu giúp dễ debug khi API có sự cố.
  await populateFilters();
  await loadDashboard();

  [elements.locationFilter, elements.paymentFilter, elements.timeGranularity].forEach((selectEl) => {
    selectEl.addEventListener("change", loadDashboard);
  });
}

initDashboard().catch((error) => {
  console.error(error);
  setMessage("Khởi tạo dashboard thất bại. Kiểm tra API backend.", "error");
});
