const themeToggle = document.getElementById("themeToggle");
const root = document.documentElement;
const searchBox = document.getElementById("globalSearch");

const savedTheme = localStorage.getItem("theme") || "dark";
root.setAttribute("data-theme", savedTheme);

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const current = root.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  });
}

if (searchBox) {
  searchBox.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && searchBox.value.trim()) {
      window.location.href = `/transactions?search=${encodeURIComponent(searchBox.value.trim())}`;
    }
  });
}

// Drawer Toggle Logic
const menuToggle = document.getElementById("menuToggle");
const closeDrawer = document.getElementById("closeDrawer");
const sidebarDrawer = document.getElementById("sidebarDrawer");
const drawerOverlay = document.getElementById("drawerOverlay");

if (menuToggle && sidebarDrawer && drawerOverlay) {
  const toggleDrawer = (active) => {
    sidebarDrawer.classList.toggle("active", active);
    drawerOverlay.classList.toggle("active", active);
    document.body.style.overflow = active ? "hidden" : "";
  };

  menuToggle.addEventListener("click", () => toggleDrawer(true));
  if (closeDrawer) closeDrawer.addEventListener("click", () => toggleDrawer(false));
  drawerOverlay.addEventListener("click", () => toggleDrawer(false));
}

// Global Filter Logic
// Global Filter Logic (Updated: 2 Dropdowns + Location Buttons)
async function initGlobalFilters() {
  const paySelect = document.getElementById("quickPaymentFilter");
  const catSelect = document.getElementById("quickCategoryFilter");
  const quickLocBtns = document.querySelectorAll(".loc-btn");
  
  // 1. Populate Dropdowns if they exist
  if (paySelect && catSelect) {
    try {
      const res = await fetch("/api/filters");
      if (res.ok) {
        const data = await res.json();
        // Clear options first but keep "Tất cả"
        paySelect.innerHTML = '<option value="">Tất cả thanh toán</option>';
        catSelect.innerHTML = '<option value="">Tất cả ngành hàng</option>';
        
        data.payment_methods.forEach(v => paySelect.append(new Option(v, v)));
        if (data.merchant_categories) data.merchant_categories.forEach(v => catSelect.append(new Option(v, v)));
      }

      // Sync from URL
      const urlParams = new URLSearchParams(window.location.search);
      paySelect.value = urlParams.get("payment_method") || "";
      catSelect.value = urlParams.get("merchant_category") || "";

      const applyFilters = () => {
        const params = new URLSearchParams(window.location.search);
        if (paySelect.value) params.set("payment_method", paySelect.value);
        else params.delete("payment_method");
        if (catSelect.value) params.set("merchant_category", catSelect.value);
        else params.delete("merchant_category");
        window.location.search = params.toString();
      };
      paySelect.addEventListener("change", applyFilters);
      catSelect.addEventListener("change", applyFilters);
    } catch (err) {
      console.error("Filter population failed", err);
    }
  }

  // 2. Handle Location Buttons if they exist
  if (quickLocBtns.length > 0) {
    const urlParams = new URLSearchParams(window.location.search);
    const currentLoc = urlParams.get("location") || "";
    
    quickLocBtns.forEach(btn => {
      const btnLoc = btn.getAttribute("data-loc") || "";
      btn.classList.toggle("active", btnLoc === currentLoc);
      
      btn.addEventListener("click", () => {
        const params = new URLSearchParams(window.location.search);
        if (btnLoc) params.set("location", btnLoc);
        else params.delete("location");
        window.location.search = params.toString();
      });
    });
  }
}

async function initCsvUploader() {
  const uploadBtn = document.getElementById("uploadCsvBtn");
  const fileInput = document.getElementById("csvFileInput");
  const nameLabel = document.getElementById("currentCsvName");
  
  if (!uploadBtn || !fileInput) return;

  // Get current dataset name
  try {
    const res = await fetch("/api/settings/current-dataset");
    if (res.ok) {
      const data = await res.json();
      if (nameLabel) nameLabel.textContent = data.filename;
    }
  } catch (err) {
    console.error("Failed to get current dataset", err);
  }

  uploadBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    if (fileInput.files.length === 0) return;
    
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append("file", file);

    try {
      uploadBtn.disabled = true;
      if (nameLabel) nameLabel.textContent = "Đang tải...";
      
      const res = await fetch("/api/settings/upload-csv", {
        method: "POST",
        body: formData
      });
      
      if (res.ok) {
        window.location.reload();
      } else {
        const error = await res.json();
        alert("Lỗi: " + error.error);
        window.location.reload();
      }
    } catch (err) {
      console.error("Error uploading CSV", err);
      alert("Đã xảy ra lỗi khi tải file.");
      window.location.reload();
    }
  });
}

initGlobalFilters();
initCsvUploader();
