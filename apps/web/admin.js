const qrArea = document.getElementById("qrArea");
const statusArea = document.getElementById("statusArea");
const generateQrBtn = document.getElementById("generateQrBtn");
const refreshStatusBtn = document.getElementById("refreshStatusBtn");
const adminUsername = document.getElementById("adminUsername");
const adminPassword = document.getElementById("adminPassword");

let activeToken = null;

function adminHeaders() {
  const username = adminUsername?.value ?? "";
  const password = adminPassword?.value ?? "";
  const basic = btoa(`${username}:${password}`);
  return {
    Authorization: `Basic ${basic}`
  };
}

generateQrBtn?.addEventListener("click", async () => {
  const response = await fetch("/api/admin/qr-sessions", {
    method: "POST",
    headers: adminHeaders()
  });
  if (response.status === 401) {
    statusArea.innerHTML = "<p>Credenciales de administrador invalidas.</p>";
    return;
  }
  const data = await response.json();
  activeToken = data.token;
  qrArea.innerHTML = `
    <img src="${data.qrDataUrl}" alt="QR del cliente" style="max-width:280px;width:100%;" />
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

function renderStatus(data) {
  statusArea.innerHTML = `
    <p><strong>Estado de sesion:</strong> ${data.status ?? "OPEN"}</p>
    <p><strong>Estado de formulario:</strong> ${data.form_status ?? "Sin respuesta"}</p>
    <p><strong>Estado de consentimiento:</strong> ${data.consent_status ?? "Pendiente"}</p>
    <p><strong>Cliente:</strong> ${data.full_name ?? "-"}</p>
    <p><strong>Documento:</strong> ${data.document_number ?? "-"}</p>
    <p><strong>Correo:</strong> ${data.email ?? "-"}</p>
  `;
}
