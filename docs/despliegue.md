# Despliegue seguro paso a paso

## Dominio

Usa un subdominio dedicado, por ejemplo:

- `clientes.megatiendadelsur.com.ec`

## SSL

Debes publicar todo por HTTPS con certificado valido. Recomiendo Let's Encrypt.

## Correo para no caer en spam

Usa un proveedor transaccional real:

- Amazon SES
- SendGrid
- Microsoft 365

Y configura en DNS:

- `SPF`
- `DKIM`
- `DMARC`

## Base intermedia

Usaremos SQL Server, aprovechando el motor que ya tienes instalado.

### Instalacion rapida

1. Abrir SQL Server Management Studio.
2. Ejecutar [001_init.sql](C:\Users\William\Desktop\fidelizacion\database\001_init.sql)
3. Crear un login tecnico para la aplicacion.
4. Dar permisos solo sobre la base `Fidelizacion`.

### Login tecnico sugerido

```sql
USE [master];
GO
CREATE LOGIN fidelizacion_app WITH PASSWORD = 'CAMBIAR_PASSWORD_FUERTE';
GO
USE [Fidelizacion];
GO
CREATE USER fidelizacion_app FOR LOGIN fidelizacion_app;
GO
ALTER ROLE db_datareader ADD MEMBER fidelizacion_app;
ALTER ROLE db_datawriter ADD MEMBER fidelizacion_app;
GO
```

Si ICG y la base intermedia estan en el mismo SQL Server, igual conviene mantener bases separadas:

- `ICG` para lectura del POS
- `Fidelizacion` para la aplicacion nueva

## Integraciones

### ICG SQL Server

- Crear un usuario de solo lectura.
- Idealmente exponer una vista SQL solo con los datos del cliente.

### SAP Service Layer

- Crear un usuario tecnico.
- Permitir solo consulta y actualizacion de Business Partners.

## Backend en el servidor

### Requisitos

- Node.js 20 LTS
- SQL Server ya operativo
- Acceso HTTPS por Nginx o IIS como reverse proxy

### Puesta en marcha

1. Copiar `.env.example` a `.env`
2. Completar credenciales reales
3. Entrar a [apps/api](C:\Users\William\Desktop\fidelizacion\apps\api)
4. Ejecutar `npm install`
5. Ejecutar `npm run build`
6. Ejecutar `npm run start`

## Publicacion del frontend

El frontend ya viene como archivos estaticos dentro de [apps/web](C:\Users\William\Desktop\fidelizacion\apps\web) y el backend los publica directamente.

URLs principales:

- `/` administrador
- `/cliente.html?token=...` formulario cliente
- `/politica-proteccion-datos.html`
- `/condiciones-sorteo.html`

## Recomendacion operativa final

- usar un subdominio exclusivo,
- publicar solo por HTTPS,
- configurar respaldo diario de la base `Fidelizacion`,
- monitorear el envio de correos y rebotes,
- revisar con legal los textos definitivos antes de salir a produccion.
