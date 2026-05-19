import { getJson } from "../api.js";
import { renderSingleChart } from "../charts.js";
import { formatCurrencyVnd } from "../utils.js";

let currentUserRole = null;
let activeModelName = "decision_tree";

// ── General Charts (LSTM + K-Means) ────────────────────────────────────────
async function loadGeneralCharts() {
  const [trend, segmentation] = await Promise.all([
    getJson("/api/trend?time_granularity=month").catch(() => []),
    getJson("/api/segmentation").catch(() => ({ summary: [] })),
  ]);

  const textColor = document.documentElement.getAttribute("data-theme") === "dark" ? "#ffffff" : "#000000";
  const gridColor = document.documentElement.getAttribute("data-theme") === "dark" ? "rgba(148,163,184,0.15)" : "rgba(0,0,0,0.08)";

  if (trend.length > 0) {
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
        plugins: { legend: { position: "top", labels: { color: textColor, font: { size: 13 } } } },
        scales: {
          x: { ticks: { color: textColor, maxTicksLimit: 12 }, grid: { color: gridColor } },
          y: { ticks: { color: textColor, callback: v => (v / 1e9).toFixed(1) + " tỷ" }, grid: { color: gridColor } },
        },
      },
    });
  }

  const summary = segmentation.summary || [];
  if (summary.length > 0) {
    renderSingleChart("kmeansChart", {
      type: "doughnut",
      data: {
        labels: summary.map((i) => i.Segment_Name),
        datasets: [{ data: summary.map((i) => i.User_ID), backgroundColor: ["#2563eb", "#7c3aed", "#10b981", "#f59e0b"] }],
      },
      options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: "bottom", labels: { color: textColor } } } },
    });

    const tableBody = document.getElementById("segmentSummaryTable");
    tableBody.innerHTML = summary
      .map(
        (item) => `
      <tr>
        <td><strong>${item.Segment_Name}</strong></td>
        <td>${item.User_ID}</td>
        <td>${Math.round(item.Recency)} ngày</td>
        <td>${item.Frequency.toFixed(1)} giao dịch</td>
        <td><span class="text-success">${formatCurrencyVnd(item.Monetary)}</span></td>
      </tr>
    `
      )
      .join("");
  }
}

// ── Metrics UI Update ──────────────────────────────────────────────────────
function updateModelMetricsUI(modelName, data) {
  const container = document.querySelector(`.model-container[data-model="${modelName}"]`);
  if (!container) return;

  const untrainedMsg = container.querySelector(".untrained-msg");
  const metricsCard = container.querySelector(".metrics-card");

  if (!data.is_trained) {
    untrainedMsg.style.display = "block";
    metricsCard.style.display = "none";
  } else {
    untrainedMsg.style.display = "none";
    metricsCard.style.display = "block";

    const m = data.metrics;
    container.querySelector(".metric-accuracy").innerText = `${(m.accuracy * 100).toFixed(1)}%`;
    container.querySelector(".metric-f1").innerText = `${(m.f1_score * 100).toFixed(1)}%`;

    if (m.confusion_matrix && m.confusion_matrix.length === 2) {
      container.querySelector(".metric-cm-tn").innerText = m.confusion_matrix[0][0];
      container.querySelector(".metric-cm-fp").innerText = m.confusion_matrix[0][1];
      container.querySelector(".metric-cm-fn").innerText = m.confusion_matrix[1][0];
      container.querySelector(".metric-cm-tp").innerText = m.confusion_matrix[1][1];
    }
  }
}

// ── Comparison Table ───────────────────────────────────────────────────────
function renderComparisonTable(dtData, rfData) {
  const compMsg = document.getElementById("comparisonUntrainedMsg");
  const compTable = document.getElementById("comparisonTableContainer");

  if (!dtData.is_trained || !rfData.is_trained) {
    compMsg.style.display = "block";
    compTable.style.display = "none";
    return;
  }

  compMsg.style.display = "none";
  compTable.style.display = "block";

  const dtM = dtData.metrics;
  const rfM = rfData.metrics;

  const populateCompareRow = (metricKey, idDt, idRf, idWinner) => {
    const valDt = dtM[metricKey] * 100;
    const valRf = rfM[metricKey] * 100;

    document.getElementById(idDt).innerText = `${valDt.toFixed(1)}%`;
    document.getElementById(idRf).innerText = `${valRf.toFixed(1)}%`;

    const elWinner = document.getElementById(idWinner);
    if (Math.abs(valDt - valRf) < 0.1) {
      elWinner.innerHTML = `<span style="color:var(--muted)">Tương đương</span>`;
    } else if (valDt > valRf) {
      elWinner.innerHTML = `<span style="color:var(--primary); font-weight:600">Decision Tree (+${(valDt - valRf).toFixed(1)}%)</span>`;
    } else {
      elWinner.innerHTML = `<span style="color:#a855f7; font-weight:600">Random Forest (+${(valRf - valDt).toFixed(1)}%)</span>`;
    }
  };

  populateCompareRow("accuracy", "compAccDt", "compAccRf", "compAccWinner");
  populateCompareRow("f1_score", "compF1Dt", "compF1Rf", "compF1Winner");
  populateCompareRow("precision", "compPrecDt", "compPrecRf", "compPrecWinner");
  populateCompareRow("recall", "compRecDt", "compRecRf", "compRecWinner");
}

// ── Role-based Visibility ──────────────────────────────────────────────────
function applyRoleVisibility() {
  const isAdmin = currentUserRole === "admin";

  const dtContainer = document.getElementById("dtContainer");
  const rfContainer = document.getElementById("rfContainer");
  const adminConfig = document.getElementById("adminModelConfig");
  const comparisonSection = document.getElementById("comparisonSection");

  if (isAdmin) {
    // Admin sees everything: both models, config panel, comparison
    adminConfig.style.display = "flex";
    dtContainer.style.display = "";
    rfContainer.style.display = "";
    if (comparisonSection) comparisonSection.style.display = "";

    // Show all train buttons
    document.querySelectorAll(".train-btn").forEach((b) => (b.style.display = ""));
  } else {
    // User sees only the active model selected by admin
    adminConfig.style.display = "none";
    if (comparisonSection) comparisonSection.style.display = "none";

    if (activeModelName === "decision_tree") {
      dtContainer.style.display = "";
      rfContainer.style.display = "none";
    } else {
      dtContainer.style.display = "none";
      rfContainer.style.display = "";
    }

    // Hide train buttons for regular users
    document.querySelectorAll(".train-btn").forEach((b) => (b.style.display = "none"));
  }
}

// ── Load Status from Backend ───────────────────────────────────────────────
async function loadModelStatus() {
  try {
    const res = await fetch("/api/fraud-detector/status");
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        activeModelName = data.active_model || "decision_tree";
        updateModelMetricsUI("decision_tree", data.decision_tree);
        updateModelMetricsUI("random_forest", data.random_forest);
        renderComparisonTable(data.decision_tree, data.random_forest);

        // Sync admin selector
        const selector = document.getElementById("activeModelSelector");
        if (selector) selector.value = activeModelName;

        // Apply visibility after knowing active model
        applyRoleVisibility();
      }
    }
  } catch (err) {
    console.error("Failed to load model status:", err);
  }
}

// ── Detect User Role ───────────────────────────────────────────────────────
async function detectUserRole() {
  try {
    const res = await fetch("/api/me");
    if (res.ok) {
      const data = await res.json();
      currentUserRole = data.account?.role || "user";
    } else {
      currentUserRole = "user";
    }
  } catch {
    currentUserRole = "user";
  }
}

// ── Train Buttons ──────────────────────────────────────────────────────────
document.querySelectorAll(".train-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const modelName = btn.getAttribute("data-model");
    const origText = btn.innerHTML;
    btn.innerHTML = `Đang huấn luyện...`;
    btn.disabled = true;

    try {
      const res = await fetch("/api/fraud-detector/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Có lỗi xảy ra");

      // Reload status to update metrics + comparison
      await loadModelStatus();
    } catch (err) {
      alert("Lỗi huấn luyện: " + err.message);
    } finally {
      btn.innerHTML = origText;
      btn.disabled = false;
    }
  });
});

// ── Admin Model Selector ───────────────────────────────────────────────────
const activeModelSelector = document.getElementById("activeModelSelector");
if (activeModelSelector) {
  activeModelSelector.addEventListener("change", async () => {
    const newModel = activeModelSelector.value;
    try {
      const res = await fetch("/api/fraud-detector/select-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: newModel }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        activeModelName = data.active_model;
        // No need to change visibility for admin, they see both
      } else {
        alert("Lỗi: " + (data.error || "Không thể đổi mô hình"));
        activeModelSelector.value = activeModelName; // revert
      }
    } catch (err) {
      alert("Lỗi kết nối: " + err.message);
      activeModelSelector.value = activeModelName;
    }
  });
}

// ── Simulator Forms ────────────────────────────────────────────────────────
document.querySelectorAll(".simulator-form").forEach((form) => {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const modelName = form.getAttribute("data-model");
    const container = form.closest(".model-container");
    const resultDiv = container.querySelector(".prediction-result");

    resultDiv.style.display = "block";
    resultDiv.style.background = "var(--surface)";
    resultDiv.style.border = "1px solid var(--line)";
    resultDiv.innerHTML = `<div style="text-align:center; padding: 12px; color: var(--text);">Đang phân tích giao dịch...</div>`;

    const formData = new FormData(form);
    const payload = {
      model: modelName,
      amount: parseFloat(formData.get("amount")),
      hour: parseInt(formData.get("hour")),
      is_weekend: parseInt(formData.get("is_weekend")),
      payment_method: formData.get("payment_method"),
      merchant_category: formData.get("merchant_category"),
      location: formData.get("location"),
    };

    try {
      const response = await fetch("/api/fraud-detector/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const res = await response.json();

      if (res.success && res.prediction) {
        const pred = res.prediction;
        const isFraud = pred.is_fraud === 1;
        const probPct = (pred.probability * 100).toFixed(1);

        let bg = isFraud ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)";
        let border = isFraud ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(16, 185, 129, 0.3)";
        let statusText = isFraud ? "🔴 PHÁT HIỆN GIAN LẬN!" : "🟢 GIAO DỊCH AN TOÀN";
        let statusColor = isFraud ? "#ef4444" : "#10b981";

        let rulesHeader =
          modelName === "random_forest"
            ? "<strong>Luồng suy luận (Quy luật từ Cây đại diện):</strong>"
            : "<strong>Luồng suy luận (Decision Rules):</strong>";

        let rulesHtml = pred.rules.map((r) => `<li>${r}</li>`).join("");

        resultDiv.style.background = bg;
        resultDiv.style.border = border;
        resultDiv.innerHTML = `
          <div style="font-weight: 700; font-size: 15px; color: ${statusColor}; margin-bottom: 6px;">
            ${statusText}
          </div>
          <div style="font-size: 13px; margin-bottom: 12px; color: var(--text);">
            Xác suất rủi ro gian lận: <strong>${probPct}%</strong>
          </div>
          <div style="font-size: 13px; color: var(--text);">
            ${rulesHeader}
            <ul style="padding-left: 20px; margin-top: 6px; list-style-type: disc; line-height: 1.5;">
              ${rulesHtml}
            </ul>
          </div>
        `;
      } else {
        resultDiv.innerHTML = `<div style="color: #ef4444; text-align: center;">Lỗi: ${res.error || "Không xác định"}</div>`;
      }
    } catch (err) {
      resultDiv.innerHTML = `<div style="color: #ef4444; text-align: center;">Lỗi kết nối máy chủ: ${err.message}</div>`;
    }
  });
});

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  await detectUserRole();
  await loadGeneralCharts();
  await loadModelStatus();
}

init();

window.addEventListener("filterChanged", () => {
  init();
});
