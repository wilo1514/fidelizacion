IF DB_ID('Fidelizacion') IS NULL
BEGIN
    CREATE DATABASE Fidelizacion;
END
GO

USE Fidelizacion;
GO

IF OBJECT_ID('dbo.admin_users', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.admin_users (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        username NVARCHAR(100) NOT NULL UNIQUE,
        password_hash NVARCHAR(500) NOT NULL,
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID('dbo.qr_sessions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.qr_sessions (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        session_token NVARCHAR(120) NOT NULL UNIQUE,
        created_by_admin_id UNIQUEIDENTIFIER NULL,
        expires_at DATETIME2 NOT NULL,
        status NVARCHAR(30) NOT NULL DEFAULT 'OPEN',
        last_status_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID('dbo.customer_updates', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.customer_updates (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        qr_session_id UNIQUEIDENTIFIER NOT NULL UNIQUE,
        icg_customer_code NVARCHAR(100) NOT NULL,
        full_name NVARCHAR(200) NOT NULL,
        document_number NVARCHAR(50) NOT NULL,
        mobile_phone NVARCHAR(30) NOT NULL,
        email NVARCHAR(200) NOT NULL,
        address_line NVARCHAR(300) NULL,
        source_system NVARCHAR(20) NOT NULL DEFAULT 'ICG',
        form_status NVARCHAR(30) NOT NULL DEFAULT 'PENDING_EMAIL_CONFIRMATION',
        consent_status NVARCHAR(30) NOT NULL DEFAULT 'PENDING',
        email_confirmation_sent_at DATETIME2 NULL,
        email_confirmed_at DATETIME2 NULL,
        accepted_policy_version NVARCHAR(20) NULL,
        accepted_terms_version NVARCHAR(20) NULL,
        ip_address NVARCHAR(64) NULL,
        user_agent NVARCHAR(MAX) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_customer_updates_qr_sessions FOREIGN KEY (qr_session_id) REFERENCES dbo.qr_sessions(id)
    );

    CREATE INDEX IX_customer_updates_document ON dbo.customer_updates(document_number);
    CREATE INDEX IX_customer_updates_status ON dbo.customer_updates(consent_status, form_status, created_at DESC);
END
GO

IF OBJECT_ID('dbo.consent_email_tokens', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.consent_email_tokens (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        customer_update_id UNIQUEIDENTIFIER NOT NULL,
        token_hash NVARCHAR(128) NOT NULL UNIQUE,
        expires_at DATETIME2 NOT NULL,
        used_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_consent_email_tokens_customer_updates FOREIGN KEY (customer_update_id) REFERENCES dbo.customer_updates(id)
    );
END
GO

IF OBJECT_ID('dbo.consent_audit_log', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.consent_audit_log (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        customer_update_id UNIQUEIDENTIFIER NOT NULL,
        event_type NVARCHAR(50) NOT NULL,
        event_detail NVARCHAR(MAX) NULL,
        ip_address NVARCHAR(64) NULL,
        user_agent NVARCHAR(MAX) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_consent_audit_log_customer_updates FOREIGN KEY (customer_update_id) REFERENCES dbo.customer_updates(id)
    );
END
GO

IF OBJECT_ID('dbo.sap_sync_queue', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.sap_sync_queue (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        customer_update_id UNIQUEIDENTIFIER NOT NULL UNIQUE,
        sync_status NVARCHAR(30) NOT NULL DEFAULT 'PENDING',
        attempts INT NOT NULL DEFAULT 0,
        last_attempt_at DATETIME2 NULL,
        next_attempt_at DATETIME2 NULL,
        last_error NVARCHAR(MAX) NULL,
        last_http_status INT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_sap_sync_queue_customer_updates FOREIGN KEY (customer_update_id) REFERENCES dbo.customer_updates(id)
    );

    CREATE INDEX IX_sap_sync_queue_status ON dbo.sap_sync_queue(sync_status, next_attempt_at, created_at);
END
GO

IF OBJECT_ID('dbo.outbound_email_log', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.outbound_email_log (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        customer_update_id UNIQUEIDENTIFIER NULL,
        recipient_email NVARCHAR(200) NOT NULL,
        email_type NVARCHAR(50) NOT NULL,
        delivery_status NVARCHAR(30) NOT NULL DEFAULT 'PENDING',
        provider_message_id NVARCHAR(200) NULL,
        error_message NVARCHAR(MAX) NULL,
        sent_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_outbound_email_log_customer_updates FOREIGN KEY (customer_update_id) REFERENCES dbo.customer_updates(id)
    );
END
GO
