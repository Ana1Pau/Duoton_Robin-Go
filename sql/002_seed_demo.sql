/* =====================================================================
   Katerbot — datos de demostración / demo seed
   Demo user + leche, pan, huevos, pollo, arroz, fruta.
   Dates are RELATIVE to today so the demo always shows live alerts.
   Run after 001_schema.sql.
   ===================================================================== */
USE Katerbot;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

DELETE FROM dbo.reap_orders      WHERE user_id IN (SELECT id FROM dbo.users WHERE email = N'demo@katerbot.app');
DELETE FROM dbo.alerts           WHERE user_id IN (SELECT id FROM dbo.users WHERE email = N'demo@katerbot.app');
DELETE FROM dbo.consumption_logs WHERE user_id IN (SELECT id FROM dbo.users WHERE email = N'demo@katerbot.app');
DELETE FROM dbo.users            WHERE email = N'demo@katerbot.app';  -- cascades items + budget

DECLARE @today DATE = CAST(GETDATE() AS DATE);
DECLARE @uid INT;

INSERT INTO dbo.users (email, display_name, locale, reap_customer_reference)
VALUES (N'demo@katerbot.app', N'Fernando (demo)', N'es', N'katerbot-demo-user-1');
SET @uid = SCOPE_IDENTITY();

INSERT INTO dbo.budget_settings (user_id, weekly_budget, currency, alert_days)
VALUES (@uid, 800.00, 'MXN', 3);

-- name, category, quantity, unit, purchase_date, expiry_date, price (MXN), daily_consumption_estimate
INSERT INTO dbo.cater_items (user_id, name, category, quantity, unit, purchase_date, expiry_date, price, daily_consumption_estimate)
VALUES
 (@uid, N'Leche',  N'Lácteos',   2.000, N'L',   DATEADD(DAY, -3, @today), DATEADD(DAY,  2, @today),  58.00, 0.500), -- caduca en 2 días
 (@uid, N'Pan',    N'Panadería', 6.000, N'pz',  DATEADD(DAY, -2, @today), DATEADD(DAY,  4, @today),  48.00, 3.000), -- se agota en 2 días
 (@uid, N'Huevos', N'Proteína', 12.000, N'pz',  DATEADD(DAY, -4, @today), DATEADD(DAY, 14, @today),  72.00, 2.000), -- OK (6 días)
 (@uid, N'Pollo',  N'Proteína',  1.000, N'kg',  DATEADD(DAY, -1, @today), DATEADD(DAY,  1, @today), 145.00, 0.400), -- caduca mañana y se agota en 2.5 días
 (@uid, N'Arroz',  N'Granos',    2.000, N'kg',  DATEADD(DAY, -5, @today), DATEADD(DAY,180, @today),  62.00, 0.150), -- OK (13 días)
 (@uid, N'Fruta',  N'Frutas',    3.000, N'kg',  DATEADD(DAY, -2, @today), DATEADD(DAY,  5, @today),  90.00, 0.500); -- OK (6 días)

-- A few consumption logs (last 3 days) to show learning of the daily estimate
INSERT INTO dbo.consumption_logs (user_id, cater_item_id, quantity, logged_at, note)
SELECT @uid, ci.id, v.qty, DATEADD(DAY, v.days_ago, SYSUTCDATETIME()), N'demo'
FROM dbo.cater_items AS ci
JOIN (VALUES (N'Leche', 0.5, -1), (N'Leche', 0.5, -2), (N'Pan', 3.0, -1), (N'Huevos', 2.0, -1), (N'Pollo', 0.4, -1))
     AS v(item_name, qty, days_ago) ON v.item_name = ci.name
WHERE ci.user_id = @uid;

-- A past completed order (mock) so the learning view has history
INSERT INTO dbo.reap_orders (user_id, product_query, enrollment_id, quote_id, checkout_id, order_reference, status,
                             total_amount, currency, items_json, is_mock, created_at, updated_at)
VALUES (@uid, N'leche, huevos', N'mock_enr_demo', N'mock_qt_hist01', N'mock_chk_hist01', N'MOCK-ORD-0001', N'COMPLETED',
        142.00, 'MXN', N'[{"name":"Leche","quantity":2,"unit":"L"},{"name":"Huevos","quantity":12,"unit":"pz"}]', 1,
        DATEADD(DAY, -10, SYSUTCDATETIME()), DATEADD(DAY, -10, SYSUTCDATETIME()));

COMMIT TRANSACTION;

SELECT name, quantity, unit, expiry_date, days_to_depletion FROM dbo.v_cater_item_status WHERE user_id = @uid ORDER BY name;
PRINT N'Katerbot demo data loaded.';
GO
