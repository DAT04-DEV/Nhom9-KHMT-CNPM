const scopeText = document.querySelector("#scopeText");
const adminPanel = document.querySelector("#adminPanel");
const accountsBody = document.querySelector("#accountsBody");
const transactionsBody = document.querySelector("#transactionsBody");
const transactionMessage = document.querySelector("#transactionMessage");
const profileDetails = document.querySelector("#profileDetails");
const logoutButton = document.querySelector("#logoutButton");
const refreshAccounts = document.querySelector("#refreshAccounts");
const loadTransactions = document.querySelector("#loadTransactions");

async function api(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
        const publicPages = ["/", "/login", "/register"];
        if (!publicPages.includes(window.location.pathname)) {
            window.location.href = "/login";
        }
        return null;
    }
    if (!response.ok) {
        throw new Error(data.error || "Yêu cầu không thành công.");
    }
    return data;
}

function text(value) {
    return value === null || value === undefined || value === "" ? "-" : value;
}

function renderRows(tbody, rows, columns) {
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!rows.length) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = columns.length;
        td.textContent = "Không có dữ liệu.";
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    rows.forEach((row) => {
        const tr = document.createElement("tr");
        columns.forEach((column) => {
            const td = document.createElement("td");
            td.textContent = text(row[column]);
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

function renderProfile(account) {
    if (!profileDetails) return;
    const rows = [
        ["Email", account.email],
        ["Họ tên", account.full_name],
        ["Vai trò", account.role],
        ["Ngày tạo", account.created_at],
        ["Lần đăng nhập cuối", account.last_login_at],
    ];
    profileDetails.innerHTML = "";
    rows.forEach(([label, value]) => {
        const item = document.createElement("div");
        const dt = document.createElement("dt");
        const dd = document.createElement("dd");
        dt.textContent = label;
        dd.textContent = text(value);
        item.append(dt, dd);
        profileDetails.appendChild(item);
    });
}

async function loadMe() {
    const data = await api("/api/me");
    if (!data) return null;
    const account = data.account;
    renderProfile(account);
    if (scopeText) {
        scopeText.textContent =
            account.role === "admin"
                ? "Admin có quyền xem toàn bộ dữ liệu."
                : "User có quyền xem dữ liệu giao dịch.";
    }
    if (adminPanel && account.role === "admin") {
        adminPanel.classList.remove("hidden");
        await loadAccounts();
    }
    return account;
}

async function loadAccounts() {
    const data = await api("/api/admin/accounts");
    if (!data) return;
    renderRows(accountsBody, data.accounts, [
        "email",
        "full_name",
        "role",
        "merchant_id",
        "last_login_at",
    ]);
}

async function loadScopedTransactions() {
    if (transactionMessage) transactionMessage.textContent = "Đang tải...";
    try {
        const data = await api("/api/transactions");
        if (!data) return;
        renderRows(transactionsBody, data.transactions, [
            "id",
            "merchant_id",
            "transaction_time",
            "amount",
            "status",
        ]);
        if (transactionMessage) transactionMessage.textContent = "";
    } catch (error) {
        if (transactionMessage) transactionMessage.textContent = error.message;
    }
}

logoutButton?.addEventListener("click", async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.href = "/";
});

refreshAccounts?.addEventListener("click", loadAccounts);
loadTransactions?.addEventListener("click", loadScopedTransactions);
loadMe().catch((error) => {
    if (scopeText) scopeText.textContent = error.message;
});
