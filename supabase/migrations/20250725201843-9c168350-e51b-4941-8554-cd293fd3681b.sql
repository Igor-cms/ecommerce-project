-- Fix the sequence for the coffees table to prevent duplicate key errors
SELECT setval('coffees_id_seq', (SELECT MAX(id) FROM coffees), true);