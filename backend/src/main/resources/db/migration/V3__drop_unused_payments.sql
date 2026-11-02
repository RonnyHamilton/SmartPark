-- SmartPark does not integrate a payment provider in this build. Reservations are
-- paid at the facility, and the application never collects or stores card data.
-- Remove the unused ledger table so the schema reflects the implemented feature set.
DROP TABLE IF EXISTS payments;
