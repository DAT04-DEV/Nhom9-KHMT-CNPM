import { getJson } from "../api.js";
import { renderSingleChart } from "../charts.js";
import { bindFilterEvents, getSharedElements, populateFilters, setMessage, toQueryString } from "./common.js";

const elements = getSharedElements();

async function loadPage() {
  try {
    setMessage(elements, "Đang tải dữ liệu...");
    const query = toQueryString(elements);
    const data = await getJson(`/api/distributions?${query}`);
    const rows = data.merchant_category_spend || [];

    renderSingleChart("chartCanvas", {
      type: "bar",
      data: {
        labels: rows.map((item) => item.label),
        datasets: [{ label: "Doanh số (VND)", data: rows.map((item) => item.value), backgroundColor: "#3b82f6" }],
      },
      options: {
        scales: { x: { ticks: { color: "#e2e8f0" } }, y: { ticks: { color: "#e2e8f0" } } },
      },
    });
    setMessage(elements, "Đã cập nhật.");
  } catch (error) {
    console.error(error);
    setMessage(elements, "Không thể tải dữ liệu.", "error");
  }
}

async function init() {
  await populateFilters(elements);
  await loadPage();
  bindFilterEvents(elements, loadPage);
}

init().catch((error) => {
  console.error(error);
  setMessage(elements, "Khởi tạo thất bại.", "error");
});
