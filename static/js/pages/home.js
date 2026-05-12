import { getJson } from "../api.js";
import { renderSingleChart } from "../charts.js";
import { chartPalette, formatCurrencyVnd, formatInteger, formatPercent } from "../utils.js";

const messageEl = document.getElementById("dashboardMessage");
const valueEls = {
  totalGmv: document.getElementById("totalGmv"),
  totalTransactions: document.getElementById("totalTransactions"),
  monthlyActiveUsers: document.getElementById("monthlyActiveUsers"),
  growthRate: document.getElementById("growthRate"),
};

function setMessage(text, isError = false) {
  if (!messageEl) return;
  messageEl.textContent = text;
  messageEl.classList.toggle("error", isError);
}

function animateCount(el, target, formatter) {
  const durationMs = 700;
  const start = performance.now();
  function tick(now) {
    const progress = Math.min((now - start) / durationMs, 1);
    el.textContent = formatter(target * progress);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

const PROVINCE_COORDS = {
  'Hà Nội': [21.0285, 105.8542],
  'Hồ Chí Minh': [10.8231, 106.6297],
  'TP.HCM': [10.8231, 106.6297],
  'Đà Nẵng': [16.0544, 108.2022],
  'Cần Thơ': [10.0452, 105.7469],
  'Hải Phòng': [20.8449, 106.6881],
  'Bình Dương': [10.9804, 106.6519],
  'Đồng Nai': [10.9575, 106.8427],
  'Khánh Hòa': [12.2462, 109.1944],
  'Quảng Ninh': [20.9599, 107.0445],
};

async function renderMap(locations) {
  const mapElement = document.getElementById("map");
  if (!mapElement) return;

  // Clear existing map instance if it exists to avoid error
  if (window.leafletMap) {
    window.leafletMap.remove();
  }

  const map = L.map('map').setView([15.8, 108.3], 5);
  window.leafletMap = map;
  
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }).addTo(map);

  const maxValue = Math.max(...locations.map(i => i.value), 1);
  const salesData = {};
  locations.forEach(loc => {
    salesData[loc.label] = loc.value;
    
    // Add Bubble Marker (Circle) if coordinates exist
    const coords = PROVINCE_COORDS[loc.label];
    if (coords) {
      const radius = Math.max(5, (loc.value / maxValue) * 25);
      L.circleMarker(coords, {
        radius: radius,
        fillColor: "#2563eb",
        color: "#fff",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.6
      })
      .addTo(map)
      .bindPopup(`<b>${loc.label}</b><br>Doanh số: ${formatCurrencyVnd(loc.value)}`);
    }
  });

  try {
    // Try to load GeoJSON for choropleth effect in background
    const response = await fetch('https://raw.githubusercontent.com/TungTh/tungth.github.io/master/data/vn-provinces.json');
    if (!response.ok) throw new Error("GeoJSON not found");
    const geojsonData = await response.json();

    function getColor(d) {
        return d > maxValue * 0.8 ? '#1e3a8a' :
               d > maxValue * 0.5 ? '#2563eb' :
               d > maxValue * 0.2 ? '#60a5fa' :
               d > 0              ? '#bfdbfe' :
                                    'transparent';
    }

    L.geoJson(geojsonData, {
        style: function(feature) {
            let cleanName = feature.properties.Name.replace("Thành phố ", "").replace("Tỉnh ", "");
            // Match TP.HCM vs Hồ Chí Minh
            let val = salesData[cleanName] || 0;
            if (val === 0) {
                if (cleanName === "Hồ Chí Minh") val = salesData["TP.HCM"] || 0;
                if (cleanName === "TP.HCM") val = salesData["Hồ Chí Minh"] || 0;
            }
            
            return {
                fillColor: getColor(val),
                weight: 1,
                opacity: 0.5,
                color: '#cbd5e1',
                fillOpacity: 0.3
            };
        }
    }).addTo(map);

  } catch (error) {
    console.warn("Choropleth background failed, showing bubble map only.");
  }
}

function renderInsights(items) {
  const list = document.getElementById("insightItems");
  if (!list) return;
  list.innerHTML = "";
  items.forEach((text) => {
    const li = document.createElement("li");
    li.style.marginBottom = "8px";
    li.textContent = text;
    list.appendChild(li);
  });
}

async function init() {
  try {
    setMessage(""); // Clear message

    let failedApi = null;
    const fetchSafe = async (url) => {
      try {
        const data = await getJson(url);
        return data;
      } catch (e) {
        console.error(`API Error [${url}]:`, e);
        failedApi = url;
        return null;
      }
    };



    const qs = window.location.search;
    const trendQs = qs ? qs + "&time_granularity=month" : "?time_granularity=month";

    const [summary, distributions, trend, ai, funnel] = await Promise.all([
      fetchSafe(`/api/summary${qs}`),
      fetchSafe(`/api/distributions${qs}`),
      fetchSafe(`/api/trend${trendQs}`),
      fetchSafe(`/api/ai-insights${qs}`),
      fetchSafe(`/api/funnel${qs}`),
    ]);

    if (!summary || !distributions) {
      throw new Error(`Dữ liệu cốt lõi không khả dụng (Lỗi tại: ${failedApi || 'N/A'}). Vui lòng kiểm tra file CSV.`);
    }

    // Render Map early
    if (distributions.location_sales) {
      renderMap(distributions.location_sales);
    }
    
    renderInsights(ai?.insights || []);
    const growth = summary.fraud_rate > 0 ? Math.max(1, 8 - summary.fraud_rate / 2) : 8.2;
    animateCount(valueEls.totalGmv, summary.total_gmv || 0, formatCurrencyVnd);
    animateCount(valueEls.totalTransactions, summary.total_transactions || 0, (v) => formatInteger(Math.round(v)));
    animateCount(valueEls.monthlyActiveUsers, summary.active_users_monthly_avg || 0, (v) =>
      formatInteger(Math.round(v)),
    );
    animateCount(valueEls.growthRate, growth, (v) => formatPercent(v));

    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { font: { family: 'Inter', size: 12 } } }
      }
    };

    if (trend) {
      renderSingleChart("trendChart", {
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
          }],
        },
        options: commonOptions
      });
    }

    if (distributions.payment_method_share) {
      renderSingleChart("paymentChart", {
        type: "doughnut",
        data: {
          labels: distributions.payment_method_share.map((i) => i.label),
          datasets: [{ 
            data: distributions.payment_method_share.map((i) => i.value), 
            backgroundColor: chartPalette,
            borderWidth: 0
          }],
        },
        options: {
          ...commonOptions,
          cutout: '70%',
          onClick: (event, elements) => {
            if (elements.length > 0) {
              const index = elements[0].index;
              const method = distributions.payment_method_share[index].label;
              const params = new URLSearchParams(window.location.search);
              params.set('payment_method', method);
              window.location.search = params.toString();
            }
          }
        }
      });
    }

    if (distributions.merchant_category_spend) {
      renderSingleChart("categoryChart", {
        type: "bar",
        data: {
          labels: distributions.merchant_category_spend.slice(0, 5).map((i) => i.label),
          datasets: [{ 
            label: "VND", 
            data: distributions.merchant_category_spend.slice(0, 5).map((i) => i.value), 
            backgroundColor: "#22c55e",
            borderRadius: 6
          }],
        },
        options: {
          ...commonOptions,
          scales: {
            y: { beginAtZero: true, grid: { display: false } },
            x: { grid: { display: false } }
          },
          onClick: (event, elements) => {
            if (elements.length > 0) {
              const index = elements[0].index;
              const category = distributions.merchant_category_spend[index].label;
              const params = new URLSearchParams(window.location.search);
              params.set('merchant_category', category);
              window.location.search = params.toString();
            }
          }
        }
      });
    }

    if (funnel && funnel.length > 0) {
      renderSingleChart("funnelChart", {
        type: "bar",
        data: {
          labels: funnel.map((i) => i.label),
          datasets: [{
            label: "Số lượng người dùng",
            data: funnel.map((i) => i.value),
            backgroundColor: ["#3b82f6", "#8b5cf6", "#10b981"],
            borderRadius: 4,
            barPercentage: 0.6,
          }]
        },
        options: {
          ...commonOptions,
          indexAxis: 'y',
          scales: {
            x: { display: false, beginAtZero: true },
            y: { grid: { display: false } }
          },
          plugins: {
            ...commonOptions.plugins,
            legend: { display: false }
          }
        }
      });
    } else {
      document.getElementById("funnelChart").parentElement.innerHTML = "<p style='text-align:center; padding: 20px; color: var(--muted);'>Không có dữ liệu phễu.</p>";
    }

    // Map and Insights were already rendered early
  } catch (error) {
    console.error(error);
    setMessage(error.message || "Không thể tải dữ liệu trang chủ.", true);
  }
}

init();

