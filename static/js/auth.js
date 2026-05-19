// Sync theme from localStorage
const savedTheme = localStorage.getItem("theme") || "dark";
document.documentElement.setAttribute("data-theme", savedTheme);

const formMessage = document.querySelector("#formMessage");
const loginForm = document.querySelector("#loginForm");
const registerForm = document.querySelector("#registerForm");
const roleSelect = document.querySelector("#roleSelect");
const inviteField = document.querySelector("#inviteField");

// Auto-wrap all password inputs with hold-to-reveal toggle buttons
document.querySelectorAll('input[type="password"]').forEach(input => {
    const wrapper = document.createElement('div');
    wrapper.className = 'password-wrapper';
    wrapper.style.width = '100%'; // Ensure full width matching the label structure
    
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toggle-password-btn';
    btn.setAttribute('aria-label', 'Hiện mật khẩu');
    btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
    `;
    
    wrapper.appendChild(btn);
    
    const showPassword = () => { input.type = 'text'; };
    const hidePassword = () => { input.type = 'password'; };
    
    const updateBtnVisibility = () => {
        btn.style.setProperty('display', input.value.length > 0 ? 'flex' : 'none', 'important');
    };
    
    // Listen to typing, change, keyup, focus, and blur events
    input.addEventListener('input', updateBtnVisibility);
    input.addEventListener('change', updateBtnVisibility);
    input.addEventListener('keyup', updateBtnVisibility);
    input.addEventListener('focus', updateBtnVisibility);
    input.addEventListener('blur', updateBtnVisibility);
    
    // Check initial state and run checks for browser autofills
    updateBtnVisibility();
    setTimeout(updateBtnVisibility, 100);
    setTimeout(updateBtnVisibility, 500);
    
    // Mouse events for hold-to-reveal (global release handler to prevent getting stuck/disappearing when dragging off button)
    btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        showPassword();
        
        const onMouseUp = () => {
            hidePassword();
            window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mouseup', onMouseUp);
    });
    
    // Touch events for mobile compatibility (global release handler)
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        showPassword();
        
        const onTouchEnd = () => {
            hidePassword();
            window.removeEventListener('touchend', onTouchEnd);
            window.removeEventListener('touchcancel', onTouchEnd);
        };
        window.addEventListener('touchend', onTouchEnd);
        window.addEventListener('touchcancel', onTouchEnd);
    }, { passive: false });
});

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
        const params = new URLSearchParams(window.location.search);
        const next = params.get("next");
        window.location.href = next && next.startsWith("/") ? next : "/";
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
