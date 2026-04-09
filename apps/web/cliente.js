const form = document.getElementById("customerForm");
const message = document.getElementById("formMessage");
const modal = document.getElementById("consentModal");
const confirmConsentBtn = document.getElementById("confirmConsentBtn");
const acceptCheckbox = document.getElementById("acceptCheckbox");

const searchParams = new URLSearchParams(window.location.search);
const token = searchParams.get("token");
let pendingFormData = null;

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
    form?.reset();
  }
});
