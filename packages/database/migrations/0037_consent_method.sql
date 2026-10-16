-- The sign-in button is the consent. Rows stored before that name
-- used sign-in-checkbox for the same act.
UPDATE "user_consents"
SET "method" = 'sign-in-button'
WHERE "method" = 'sign-in-checkbox';
