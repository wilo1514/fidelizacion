# Sistema de Actualizacion de Datos y Consentimiento

Base inicial full stack para:

- Actualizar datos de clientes del supermercado.
- Registrar aceptacion de politica de proteccion de datos y condiciones del sorteo.
- Validar clientes existentes en ICG antes de enviar el correo.
- Sincronizar nuevos registros aprobados hacia SAP Business One HANA por Service Layer.

## Arquitectura propuesta

- `apps/api`: backend Node.js + Fastify + TypeScript.
- `apps/web`: frontend estatico responsive para administrador y cliente.
- `database`: scripts SQL para SQL Server.
- `docs`: arquitectura, seguridad y despliegue.

## Flujo funcional

1. El administrador abre la vista de administracion.
2. Genera un QR valido por 15 minutos.
3. El cliente escanea el QR y completa el formulario.
4. El backend valida que el cliente exista en ICG SQL Server.
5. Si existe, se guarda o actualiza en la base intermedia y se envia correo de confirmacion.
6. El cliente abre el enlace del correo y confirma su aceptacion.
7. El administrador recupera la respuesta y valida si ya acepto.
8. A las `22:00` y `05:00` se intenta sincronizar a SAP B1.
9. Si el cliente no existe en SAP, queda en cola de pendientes y se reintenta luego.

## Base intermedia elegida

La solucion quedo ajustada para usar SQL Server como base intermedia, de modo que no necesitas instalar Docker ni PostgreSQL si ya tienes SQL Server en tu servidor.
