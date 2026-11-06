-- Separate wording for the text message version of a message (Admin > Message wording).
-- Null means texts use the same wording as the email.
alter table message_wording add column sms_body text check (sms_body is null or length(sms_body) between 1 and 1000);
