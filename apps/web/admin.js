const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const qrArea = document.getElementById("qrArea");
const statusArea = document.getElementById("statusArea");
const generateQrBtn = document.getElementById("generateQrBtn");
const refreshStatusBtn = document.getElementById("refreshStatusBtn");
const forceSapSyncBtn = document.getElementById("forceSapSyncBtn");
const logoutBtn = document.getElementById("logoutBtn");
const documentNumberInput = document.getElementById("documentNumber");
const adminUsername = document.getElementById("adminUsername");
const adminPassword = document.getElementById("adminPassword");

let activeToken = null;
const storageKey = "fidelizacion_admin_auth";
const isLoginPage = Boolean(loginForm);
const isDashboardPage = Boolean(generateQrBtn);

function getStoredAuth() {
  const raw = sessionStorage.getItem(storageKey);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveAuth() {
  sessionStorage.setItem(storageKey, JSON.stringify({
    username: adminUsername?.value ?? "",
    password: adminPassword?.value ?? ""
  }));
}

function restoreAuth() {
  const auth = getStoredAuth();
  if (!auth) {
    return false;
  }

  if (adminUsername) adminUsername.value = auth.username ?? "";
  if (adminPassword) adminPassword.value = auth.password ?? "";
  return Boolean(auth.username && auth.password);
}

function adminHeaders() {
  const stored = getStoredAuth();
  const username = adminUsername?.value || stored?.username || "";
  const password = adminPassword?.value || stored?.password || "";
  const basic = btoa(`${username}:${password}`);
  return {
    Authorization: `Basic ${basic}`
  };
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const response = await fetch("/api/admin/login", {
    method: "POST",
    headers: adminHeaders()
  });

  if (!response.ok) {
    loginMessage.textContent = "Credenciales de administrador invalidas.";
    return;
  }

  saveAuth();
  loginMessage.textContent = "";
  window.location.href = "/admin-panel.html";
});

generateQrBtn?.addEventListener("click", async () => {
  const documentNumber = documentNumberInput?.value?.trim() ?? "";
  if (!documentNumber) {
    statusArea.innerHTML = "<p>Ingresa la cedula del cliente antes de generar el QR.</p>";
    return;
  }

  const response = await fetch("/api/admin/qr-sessions", {
    method: "POST",
    headers: {
      ...adminHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ documentNumber })
  });

  if (response.status === 401) {
    statusArea.innerHTML = "<p>Credenciales de administrador invalidas.</p>";
    return;
  }

  const data = await response.json();
  if (!response.ok) {
    statusArea.innerHTML = `<p>${data.message ?? "No fue posible generar el QR."}</p>`;
    return;
  }

  activeToken = data.token;
  qrArea.innerHTML = `
    <img src="${data.qrDataUrl}" alt="QR del cliente" style="max-width:280px;width:100%;" />
    <p><strong>Cedula:</strong> ${documentNumber}</p>
    <p><strong>Expira:</strong> ${new Date(data.expiresAt).toLocaleString()}</p>
  `;
  renderStatus(data);
});

refreshStatusBtn?.addEventListener("click", async () => {
  if (!activeToken) {
    statusArea.innerHTML = "<p>Genera primero un QR.</p>";
    return;
  }

  const response = await fetch(`/api/admin/qr-sessions/${activeToken}`, {
    headers: adminHeaders()
  });
  if (response.status === 401) {
    statusArea.innerHTML = "<p>Credenciales de administrador invalidas.</p>";
    return;
  }
  const data = await response.json();
  renderStatus(data);
});

forceSapSyncBtn?.addEventListener("click", async () => {
  const response = await fetch("/api/admin/sap-sync/run", {
    method: "POST",
    headers: adminHeaders()
  });

  const data = await response.json();

  if (response.status === 401) {
    statusArea.innerHTML = "<p>Credenciales de administrador invalidas.</p>";
    return;
  }

  if (!response.ok) {
    statusArea.innerHTML = `<p>${data.message ?? "No fue posible ejecutar la sincronizacion SAP."}</p>`;
    return;
  }

  statusArea.innerHTML = `<p>${data.message ?? "Sincronizacion SAP ejecutada correctamente."}</p>`;
});

logoutBtn?.addEventListener("click", () => {
  sessionStorage.removeItem(storageKey);
  activeToken = null;
  window.location.href = "/";
});

if (isDashboardPage && !restoreAuth()) {
  window.location.href = "/";
}

if (isLoginPage && restoreAuth()) {
  window.location.href = "/admin-panel.html";
}

function maskName(value) {
  if (!value) return "-";
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => {
      if (part.length <= 2) return `${part[0] ?? ""}X`;
      return `${part[0]}${"X".repeat(Math.max(1, part.length - 2))}${part.slice(-1)}`;
    })
    .join(" ");
}

function maskDocument(value) {
  if (!value) return "-";
  if (value.length <= 2) return `${value[0] ?? ""}X`;
  return `${value[0]}${"X".repeat(Math.max(1, value.length - 2))}${value.slice(-1)}`;
}

function maskEmail(value) {
  if (!value || !value.includes("@")) return "-";
  const [local, domain] = value.split("@");
  if (!local || !domain) return "-";

  const visibleLocal = local.slice(0, 2);
  const maskedLocal = `${visibleLocal}${"X".repeat(Math.max(1, local.length - visibleLocal.length))}`;

  return `${maskedLocal}@${domain}`;
}

function renderStatus(data) {
  statusArea.innerHTML = `
    <p><strong>Estado de sesion:</strong> ${data.status ?? "OPEN"}</p>
    <p><strong>Estado de formulario:</strong> ${data.form_status ?? "Sin respuesta"}</p>
    <p><strong>Estado de consentimiento:</strong> ${data.consent_status ?? "Pendiente"}</p>
    <p><strong>Cliente:</strong> ${maskName(data.full_name)}</p>
    <p><strong>Documento:</strong> ${maskDocument(data.customer_document_number ?? data.document_number)}</p>
    <p><strong>Correo:</strong> ${maskEmail(data.email)}</p>
  `;
}
