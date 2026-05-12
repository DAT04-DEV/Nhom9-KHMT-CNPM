import { getJson } from "../api.js";
import { chartPalette } from "../utils.js";
import { renderSingleChart } from "../charts.js";
import { bindFilterEvents, getSharedElements, populateFilters, setMessage, toQueryString } from "./common.js";

const elements = getSharedElements();

async function loadPage() {
  try {
    setMessage(elements, "Đang tải dữ liệu...");
    const query = toQueryString(elements);
    const data = await getJson(`/api/distributions?${query}`);
    const rows = data.payment_method_share || [];

    renderSingleChart("chartCanvas", {
      type: "pie",
      data: {
        labels: rows.map((item) => item.label),
        datasets: [{ data: rows.map((item) => item.value), backgroundColor: chartPalette }],
      },
      options: {
        plugins: { legend: { position: "bottom", labels: { color: "#e2e8f0" } } },
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
