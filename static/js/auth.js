const formMessage = document.querySelector("#formMessage");
const loginForm = document.querySelector("#loginForm");
const registerForm = document.querySelector("#registerForm");
const roleSelect = document.querySelector("#roleSelect");
const merchantField = document.querySelector("#merchantField");
const inviteField = document.querySelector("#inviteField");

function setMessage(text, isSuccess = false) {
    if (!formMessage) return;
    formMessage.textContent = text;
    formMessage.classList.toggle("success", isSuccess);
}

async function postJson(url, payload) {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || "Yêu cầu không thành công.");
    }
    return data;
}

function formToObject(form) {
    return Object.fromEntries(new FormData(form).entries());
}

function syncRoleFields() {
    if (!roleSelect) return;
    const isAdmin = roleSelect.value === "admin";
    merchantField?.classList.toggle("hidden", isAdmin);
    inviteField?.classList.toggle("hidden", !isAdmin);
}

roleSelect?.addEventListener("change", syncRoleFields);
syncRoleFields();

loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = loginForm.querySelector("button[type='submit']");
    button.disabled = true;
    setMessage("");
    try {
        await postJson("/api/auth/login", formToObject(loginForm));
        window.location.href = "/";
    } catch (error) {
        setMessage(error.message);
    } finally {
        button.disabled = false;
    }
});

registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = registerForm.querySelector("button[type='submit']");
    button.disabled = true;
    setMessage("");
    try {
        await postJson("/api/auth/register", formToObject(registerForm));
        window.location.href = "/";
    } catch (error) {
        setMessage(error.message);
    } finally {
        button.disabled = false;
    }
});
