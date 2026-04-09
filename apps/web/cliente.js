const form = document.getElementById("customerForm");
const message = document.getElementById("formMessage");
const modal = document.getElementById("consentModal");
const confirmConsentBtn = document.getElementById("confirmConsentBtn");
const acceptCheckbox = document.getElementById("acceptCheckbox");
const fullNameInput = document.getElementById("fullName");
const documentNumberInput = document.getElementById("documentNumber");
const mobilePhoneInput = document.getElementById("mobilePhone");
const emailInput = document.getElementById("email");
const addressLineInput = document.getElementById("addressLine");

const searchParams = new URLSearchParams(window.location.search);
const token = searchParams.get("token");
let pendingFormData = null;

async function loadSessionData() {
  if (!token) {
    message.textContent = "El enlace no es valido o ha expirado.";
    return;
  }

  const response = await fetch(`/api/public/qr-sessions/${token}`);
  const data = await response.json();

  if (!response.ok) {
    message.textContent = data.message ?? "No fue posible cargar los datos del cliente.";
    form?.classList.add("hidden");
    return;
  }

  if (fullNameInput) fullNameInput.value = data.fullName ?? "";
  if (documentNumberInput) documentNumberInput.value = data.documentNumber ?? "";
  if (mobilePhoneInput) mobilePhoneInput.value = data.mobilePhone ?? "";
  if (emailInput) emailInput.value = data.email ?? "";
  if (addressLineInput) addressLineInput.value = data.addressLine ?? "";
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!token) {
    message.textContent = "El enlace no es valido o ha expirado.";
    return;
  }

  const formData = new FormData(form);
  pendingFormData = {
    token,
    fullName: String(formData.get("fullName") ?? ""),
    documentNumber: String(formData.get("documentNumber") ?? ""),
    mobilePhone: String(formData.get("mobilePhone") ?? ""),
    email: String(formData.get("email") ?? ""),
    addressLine: String(formData.get("addressLine") ?? ""),
    acceptedPolicyVersion: "v1",
    acceptedTermsVersion: "v1"
  };

  modal?.showModal();
});

confirmConsentBtn?.addEventListener("click", async () => {
  if (!acceptCheckbox?.checked) {
    message.textContent = "Debes aceptar la politica y las condiciones del sorteo.";
    return;
  }

  const response = await fetch("/api/public/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pendingFormData)
  });

  const data = await response.json();
  message.textContent = data.message ?? "Proceso completado.";

  if (response.ok) {
    modal?.close();
    loadSessionData();
  }
});

loadSessionData();
