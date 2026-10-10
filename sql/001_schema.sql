/* =====================================================================
   Katerbot — esquema de base de datos / database schema
   Target: SQL Server 2025 (Developer / Enterprise). Also runs on 2019/2022.
   Run with:  sqlcmd -S localhost -U sa -P <pwd> -C -i sql/001_schema.sql
   Re-runnable: drops and recreates Katerbot tables in dbo.

   SECURITY: no table stores card number (PAN), CVV/CVC or OTP. Card entry
   happens on Reap-hosted pages; Katerbot only keeps the enrollment id,
   quote id, checkout id, merchant order reference and status.
   ===================================================================== */

IF DB_ID(N'Katerbot') IS NULL
BEGIN
    CREATE DATABASE Katerbot;
END
GO

USE Katerbot;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ---------- drop in FK-safe order ---------- */
IF OBJECT_ID(N'dbo.v_cater_item_status', N'V') IS NOT NULL DROP VIEW dbo.v_cater_item_status;
IF OBJECT_ID(N'dbo.reap_orders', N'U')      IS NOT NULL DROP TABLE dbo.reap_orders;
IF OBJECT_ID(N'dbo.alerts', N'U')           IS NOT NULL DROP TABLE dbo.alerts;
IF OBJECT_ID(N'dbo.consumption_logs', N'U') IS NOT NULL DROP TABLE dbo.consumption_logs;
IF OBJECT_ID(N'dbo.budget_settings', N'U')  IS NOT NULL DROP TABLE dbo.budget_settings;
IF OBJECT_ID(N'dbo.cater_items', N'U')      IS NOT NULL DROP TABLE dbo.cater_items;
IF OBJECT_ID(N'dbo.users', N'U')            IS NOT NULL DROP TABLE dbo.users;
GO

/* ---------- users ---------- */
CREATE TABLE dbo.users (
    id                      INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_users PRIMARY KEY,
    email                   NVARCHAR(320)  NOT NULL,
    display_name            NVARCHAR(120)  NOT NULL,
    locale                  NVARCHAR(10)   NOT NULL CONSTRAINT DF_users_locale DEFAULT (N'es'),
    -- Reap enrollment: ONLY the id + status. Never card data.
    reap_customer_reference NVARCHAR(100)  NULL,
    reap_enrollment_id      NVARCHAR(100)  NULL,
    reap_enrollment_status  NVARCHAR(30)   NULL,
    created_at              DATETIME2(0)   NOT NULL CONSTRAINT DF_users_created DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_users_email UNIQUE (email),
    CONSTRAINT CK_users_enroll_status CHECK (reap_enrollment_status IS NULL OR reap_enrollment_status IN
        (N'REQUIRES_ACTION', N'ACTIVE', N'FAILED', N'EXPIRED', N'REVOKED'))
);
GO

/* ---------- cater_items (pantry inventory) ---------- */
CREATE TABLE dbo.cater_items (
    id                          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_cater_items PRIMARY KEY,
    user_id                     INT            NOT NULL,
    name                        NVARCHAR(120)  NOT NULL,
    category                    NVARCHAR(60)   NOT NULL,
    quantity                    DECIMAL(10,3)  NOT NULL,
    unit                        NVARCHAR(20)   NOT NULL,
    purchase_date               DATE           NOT NULL CONSTRAINT DF_cater_items_purchase DEFAULT (CAST(GETDATE() AS DATE)),
    expiry_date                 DATE           NULL,
    price                       DECIMAL(12,2)  NOT NULL CONSTRAINT DF_cater_items_price DEFAULT (0),
    daily_consumption_estimate  DECIMAL(10,3)  NOT NULL CONSTRAINT DF_cater_items_daily DEFAULT (0),
    -- Persisted computed column: estimated days until the item runs out.
    days_to_depletion AS (CASE WHEN daily_consumption_estimate > 0
                               THEN CAST(quantity / daily_consumption_estimate AS DECIMAL(10,2)) END) PERSISTED,
    created_at                  DATETIME2(0)   NOT NULL CONSTRAINT DF_cater_items_created DEFAULT (SYSUTCDATETIME()),
    updated_at                  DATETIME2(0)   NOT NULL CONSTRAINT DF_cater_items_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_cater_items_user FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE,
    CONSTRAINT CK_cater_items_qty   CHECK (quantity >= 0),
    CONSTRAINT CK_cater_items_price CHECK (price >= 0),
    CONSTRAINT CK_cater_items_daily CHECK (daily_consumption_estimate >= 0)
);
GO
CREATE INDEX IX_cater_items_user_expiry ON dbo.cater_items (user_id, expiry_date) INCLUDE (name, quantity);
GO

/* ---------- consumption_logs ---------- */
CREATE TABLE dbo.consumption_logs (
    id            INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_consumption_logs PRIMARY KEY,
    user_id       INT            NOT NULL,
    cater_item_id INT            NOT NULL,
    quantity      DECIMAL(10,3)  NOT NULL,
    logged_at     DATETIME2(0)   NOT NULL CONSTRAINT DF_consumption_logs_at DEFAULT (SYSUTCDATETIME()),
    note          NVARCHAR(200)  NULL,
    CONSTRAINT FK_consumption_logs_user FOREIGN KEY (user_id) REFERENCES dbo.users(id),
    CONSTRAINT FK_consumption_logs_item FOREIGN KEY (cater_item_id) REFERENCES dbo.cater_items(id) ON DELETE CASCADE,
    CONSTRAINT CK_consumption_logs_qty CHECK (quantity > 0)
);
GO
CREATE INDEX IX_consumption_logs_item_time ON dbo.consumption_logs (cater_item_id, logged_at);
GO

/* ---------- alerts ---------- */
CREATE TABLE dbo.alerts (
    id            INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_alerts PRIMARY KEY,
    user_id       INT            NOT NULL,
    cater_item_id INT            NULL,
    alert_type    NVARCHAR(30)   NOT NULL,   -- EXPIRY_SOON | DEPLETION_SOON | BUDGET_EXCEEDED
    severity      NVARCHAR(10)   NOT NULL,   -- info | warning | critical
    message_es    NVARCHAR(400)  NOT NULL,
    message_en    NVARCHAR(400)  NOT NULL,
    is_resolved   BIT            NOT NULL CONSTRAINT DF_alerts_resolved DEFAULT (0),
    created_at    DATETIME2(0)   NOT NULL CONSTRAINT DF_alerts_created DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_alerts_user FOREIGN KEY (user_id) REFERENCES dbo.users(id),
    CONSTRAINT FK_alerts_item FOREIGN KEY (cater_item_id) REFERENCES dbo.cater_items(id) ON DELETE CASCADE,
    CONSTRAINT CK_alerts_type CHECK (alert_type IN (N'EXPIRY_SOON', N'DEPLETION_SOON', N'BUDGET_EXCEEDED')),
    CONSTRAINT CK_alerts_severity CHECK (severity IN (N'info', N'warning', N'critical'))
);
GO
CREATE INDEX IX_alerts_user_open ON dbo.alerts (user_id, is_resolved, created_at DESC);
GO

/* ---------- budget_settings ---------- */
CREATE TABLE dbo.budget_settings (
    id             INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_budget_settings PRIMARY KEY,
    user_id        INT            NOT NULL,
    weekly_budget  DECIMAL(12,2)  NOT NULL,
    currency       CHAR(3)        NOT NULL CONSTRAINT DF_budget_currency DEFAULT ('MXN'),
    alert_days     INT            NOT NULL CONSTRAINT DF_budget_alert_days DEFAULT (3),
    updated_at     DATETIME2(0)   NOT NULL CONSTRAINT DF_budget_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_budget_user FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE,
    CONSTRAINT UQ_budget_user UNIQUE (user_id),
    CONSTRAINT CK_budget_amount CHECK (weekly_budget >= 0),
    CONSTRAINT CK_budget_days CHECK (alert_days BETWEEN 1 AND 30)
);
GO

/* ---------- reap_orders ----------
   Stores ONLY identifiers + status from Reap. No PAN / CVV / OTP columns, by design. */
CREATE TABLE dbo.reap_orders (
    id               INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_reap_orders PRIMARY KEY,
    user_id          INT            NOT NULL,
    product_query    NVARCHAR(1000) NOT NULL,
    enrollment_id    NVARCHAR(100)  NULL,
    quote_id         NVARCHAR(100)  NULL,
    checkout_id      NVARCHAR(100)  NULL,
    order_reference  NVARCHAR(100)  NULL,
    status           NVARCHAR(30)   NOT NULL CONSTRAINT DF_reap_orders_status DEFAULT (N'DRAFT'),
    total_amount     DECIMAL(12,2)  NULL,
    currency         CHAR(3)        NULL,
    quote_expires_at DATETIME2(0)   NULL,
    items_json       NVARCHAR(MAX)  NULL,   -- proposal lines (name, qty, variant id, reason). No payment data.
    is_mock          BIT            NOT NULL CONSTRAINT DF_reap_orders_mock DEFAULT (0),
    error_code       NVARCHAR(60)   NULL,
    created_at       DATETIME2(0)   NOT NULL CONSTRAINT DF_reap_orders_created DEFAULT (SYSUTCDATETIME()),
    updated_at       DATETIME2(0)   NOT NULL CONSTRAINT DF_reap_orders_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_reap_orders_user FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE,
    CONSTRAINT CK_reap_orders_status CHECK (status IN (N'DRAFT', N'QUOTED', N'REQUIRES_ACTION', N'PROCESSING',
        N'COMPLETED', N'FAILED', N'EXPIRED', N'CANCELLED')),
    CONSTRAINT CK_reap_orders_items_json CHECK (items_json IS NULL OR ISJSON(items_json) = 1)
);
GO
CREATE INDEX IX_reap_orders_user_created ON dbo.reap_orders (user_id, created_at DESC);
CREATE UNIQUE INDEX UX_reap_orders_checkout ON dbo.reap_orders (checkout_id) WHERE checkout_id IS NOT NULL;
GO

/* ---------- reporting view: depletion + expiry per item ---------- */
CREATE VIEW dbo.v_cater_item_status
AS
SELECT  ci.id,
        ci.user_id,
        ci.name,
        ci.category,
        ci.quantity,
        ci.unit,
        ci.expiry_date,
        ci.daily_consumption_estimate,
        ci.days_to_depletion,
        CASE WHEN ci.daily_consumption_estimate > 0
             THEN DATEADD(DAY, CAST(FLOOR(ci.quantity / ci.daily_consumption_estimate) AS INT), CAST(GETDATE() AS DATE))
        END AS estimated_depletion_date,
        DATEDIFF(DAY, CAST(GETDATE() AS DATE), ci.expiry_date) AS days_to_expiry
FROM    dbo.cater_items AS ci;
GO

PRINT N'Katerbot schema created.';
GO
