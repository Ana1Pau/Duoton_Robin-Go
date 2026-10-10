/* Ampliación ADITIVA para Robin Go. No borra tablas ni datos.
   Ejecutar dentro de la base Katerbot ya inicializada. Hacer respaldo antes.
   001_schema.sql es destructivo: NO volver a ejecutarlo sobre datos existentes.
   Estados empresariales/compras aquí son DEMOSTRACIONES, no autorización de pagos reales. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.users',N'U') IS NULL THROW 51000,'Falta dbo.users; inicializa una base nueva antes de esta migracion.',1;
IF OBJECT_ID(N'dbo.robin_expenses',N'U') IS NULL
BEGIN
 CREATE TABLE dbo.robin_expenses(
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES dbo.users(id),
  scope NVARCHAR(12) NOT NULL CHECK(scope IN ('company','shopping')),
  currency NVARCHAR(3) NOT NULL CHECK(currency IN ('USD','MXN','EUR')),
  amount_minor BIGINT NOT NULL CHECK(amount_minor>0 AND amount_minor<=100000000000),
  expense_date DATE NOT NULL,
  payload NVARCHAR(MAX) NOT NULL CHECK(ISJSON(payload)=1),
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
 );
 CREATE INDEX IX_robin_expenses_user_scope_date ON dbo.robin_expenses(user_id,scope,expense_date);
END;
IF OBJECT_ID(N'dbo.robin_demo_workspaces',N'U') IS NULL
BEGIN
 CREATE TABLE dbo.robin_demo_workspaces(
  user_id INT NOT NULL REFERENCES dbo.users(id),
  scope NVARCHAR(12) NOT NULL CHECK(scope IN ('company','shopping')),
  revision BIGINT NOT NULL DEFAULT 1 CHECK(revision>0),
  payload NVARCHAR(MAX) NOT NULL CHECK(ISJSON(payload)=1),
  updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_robin_demo_workspaces PRIMARY KEY(user_id,scope)
 );
END;
COMMIT;
