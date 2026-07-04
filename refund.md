How to properly Refund a completed session:
If it already ended and drained your wallet, you need to manually refund yourself in the database. Run these three queries (replace 1 with your actual User ID, and 2000 with the amount of ₹ that was deducted):

-- 1. Give the money back to the wallet
UPDATE wallets 
SET balance = balance + 2000 
WHERE u_id = 1;

-- 2. Create a paper-trail receipt for the refund (so the UI ledger makes sense)
INSERT INTO wallet_transactions (wallet_id, type, amount, description)
SELECT wallet_id, 'credit', 2000, 'Refund for corrupted IoT telemetry data'
FROM wallets WHERE u_id = 1;

-- 3. Reset the session stats so your charts don't look crazy
UPDATE sessions SET total_units = 0 WHERE session_id = YOUR_SESSION_ID;
UPDATE consumption_records SET units_consumed = 0, cost_share = 0 WHERE session_id = YOUR_SESSION_ID;
