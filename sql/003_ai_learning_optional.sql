/* =====================================================================
   Katerbot — OPTIONAL: AI / MCP learning from past orders (SQL Server 2025)
   Not required for the demo. Uses the SQL Server 2025 native VECTOR type.

   How to plug it in later:
   1. Run this script.
   2. Fill order_learning.embedding from an embedding model, e.g. with
      SQL Server 2025 AI_GENERATE_EMBEDDINGS(... USE MODEL <external model>)
      after CREATE EXTERNAL MODEL, or from the app.
   3. Expose dbo.v_order_history + dbo.usp_similar_orders through the
      SQL Server MCP server (e.g. "MSSQL MCP" / Data API builder MCP)
      so an LLM agent can read purchase history as a tool.
   The rule-based agent in src/lib/agent.ts already uses order history
   (frequency of past purchases) without any of this.
   ===================================================================== */
USE Katerbot;
GO
IF OBJECT_ID(N'dbo.usp_similar_orders', N'P') IS NOT NULL DROP PROCEDURE dbo.usp_similar_orders;
IF OBJECT_ID(N'dbo.v_order_history', N'V') IS NOT NULL DROP VIEW dbo.v_order_history;
IF OBJECT_ID(N'dbo.order_learning', N'U') IS NOT NULL DROP TABLE dbo.order_learning;
GO

CREATE TABLE dbo.order_learning (
    id            INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_order_learning PRIMARY KEY,
    user_id       INT            NOT NULL,
    reap_order_id INT            NULL,
    summary_text  NVARCHAR(2000) NOT NULL,   -- e.g. "Bought 2 L leche + 12 huevos on Monday, budget OK"
    embedding     VECTOR(1536)   NULL,       -- SQL Server 2025 native vector type
    created_at    DATETIME2(0)   NOT NULL CONSTRAINT DF_order_learning_created DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_order_learning_user  FOREIGN KEY (user_id) REFERENCES dbo.users(id),
    CONSTRAINT FK_order_learning_order FOREIGN KEY (reap_order_id) REFERENCES dbo.reap_orders(id) ON DELETE SET NULL
);
GO

CREATE VIEW dbo.v_order_history
AS
SELECT  o.user_id,
        o.id AS reap_order_id,
        o.product_query,
        o.status,
        o.total_amount,
        o.currency,
        o.created_at
FROM    dbo.reap_orders AS o
WHERE   o.status = N'COMPLETED';
GO

/* Returns the past orders most similar to a query embedding (cosine distance). */
CREATE PROCEDURE dbo.usp_similar_orders
    @user_id INT,
    @query_embedding VECTOR(1536),
    @top INT = 5
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP (@top)
           ol.reap_order_id,
           ol.summary_text,
           VECTOR_DISTANCE('cosine', ol.embedding, @query_embedding) AS distance
    FROM   dbo.order_learning AS ol
    WHERE  ol.user_id = @user_id
      AND  ol.embedding IS NOT NULL
    ORDER BY distance ASC;
END
GO
PRINT N'Katerbot optional AI learning objects created.';
GO
