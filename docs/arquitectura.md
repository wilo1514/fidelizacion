# Arquitectura funcional y tecnica

## Objetivo

El sistema debe permitir que un administrador genere un QR unico y temporal para que un cliente:

- actualice sus datos,
- reciba por correo un enlace unico de confirmacion,
- acepte politica de proteccion de datos y condiciones del sorteo,
- quede listo para validacion manual del premio.

## Flujo principal

1. El administrador inicia sesion en el panel.
2. El administrador ingresa la cedula y genera un QR.
3. El cliente escanea el QR y ve sus datos precargados desde ICG.
4. El backend valida en ICG SQL Server si el cliente existe.
5. Si no existe, responde `Verifique los datos ingresados`.
6. Si existe, guarda en la base intermedia y envia un correo con enlace unico.
7. El cliente confirma desde el correo.
8. El administrador recupera la respuesta y valida la aceptacion.
9. A las `22:00` y `05:00`, el sistema intenta actualizar SAP B1 via Service Layer.
10. Si no encuentra el cliente en SAP, queda en cola de reintento.
11. El administrador puede forzar manualmente una corrida desde el panel cuando necesite validar una carga fuera del horario programado.

## Mapeo actual

- ICG `CLIENTES.NIF20` -> documento del cliente
- ICG `CLIENTES.TELEFONO1` -> telefono
- ICG `CLIENTES.E_MAIL` -> correo
- ICG `CLIENTES.DIRECCION1` -> direccion
- SAP `OCRD.U_DOCUMENTO` -> campo de busqueda
- SAP `OCRD.Phone1` -> telefono a actualizar
- SAP `OCRD.E_Mail` -> correo a actualizar
- SAP `CRD1.Street` -> direccion a actualizar solo donde `AdresType = 'S'`

## Recomendaciones clave

- Base intermedia: SQL Server.
- Backend: Node.js 20 LTS.
- Frontend: sitio web responsive sobre HTTPS.
- Reverse proxy: Nginx.
- Correo: Amazon SES, SendGrid o Microsoft 365.
- SSL: Let's Encrypt.
