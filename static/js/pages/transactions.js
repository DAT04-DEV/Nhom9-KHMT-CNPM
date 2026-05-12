import { getJson } from "../api.js";
import { formatCurrencyVnd } from "../utils.js";

const els = {
  search: document.getElementById("txSearch"),
  sortBy: document.getElementById("txSortBy"),
  sortOrder: document.getElementById("txSortOrder"),
  reload: document.getElementById("txReload"),
  prev: document.getElementById("txPrev"),
  next: document.getElementById("txNext"),
  page: document.getElementById("txPage"),
  count: document.getElementById("txCount"),
  body: document.querySelector("#txTable tbody"),
};
let currentPage = 1;

function buildUrl() {
  const params = new URLSearchParams({
    page: String(currentPage),
    page_size: "20",
    search: els.search.value || "",
    sort_by: els.sortBy.value,
    sort_order: els.sortOrder.value,
  });
  return `/api/transactions?${params.toString()}`;
}

async function loadTable() {
  const data = await getJson(buildUrl());
  els.body.innerHTML = "";
  data.rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${row.transaction_id}</b></td>
      <td>${row.user_id}</td>
      <td>${formatCurrencyVnd(row.amount_vnd)}</td>
      <td>${row.timestamp}</td>
      <td>${row.payment_method}</td>
      <td>${row.merchant_category}</td>
      <td>${row.location}</td>
    `;
    els.body.appendChild(tr);
  });
  
  els.count.textContent = `Tổng cộng: ${formatInteger(data.total)} giao dịch`;
  els.page.textContent = `Trang ${data.page}`;
  els.prev.disabled = data.page <= 1;
  els.next.disabled = data.page * data.page_size >= data.total;
}

els.reload.addEventListener("click", () => {
  currentPage = 1;
  loadTable();
});
els.prev.addEventListener("click", () => {
  if (currentPage > 1) currentPage -= 1;
  loadTable();
});
els.next.addEventListener("click", () => {
  currentPage += 1;
  loadTable();
});

loadTable();
