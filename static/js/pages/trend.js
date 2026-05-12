import { getJson } from "../api.js";
import { renderSingleChart } from "../charts.js";
import { bindFilterEvents, getSharedElements, populateFilters, setMessage, toQueryString } from "./common.js";

const elements = getSharedElements();

async function loadPage() {
  try {
    setMessage(elements, "Đang tải dữ liệu...");
    const query = toQueryString(elements);
    const rows = await getJson(`/api/trend?${query}`);

    renderSingleChart("chartCanvas", {
      type: "line",
      data: {
        labels: rows.map((item) => item.period),
        datasets: [
          {
            label: "Xu hướng thanh toán",
            data: rows.map((item) => item.value),
            borderColor: "#a855f7",
            backgroundColor: "rgba(168,85,247,0.2)",
            fill: true,
            tension: 0.3,
          },
        ],
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
