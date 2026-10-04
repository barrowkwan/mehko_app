-- Product owner clarification: the same pickup point MAY be used more than once in an offering on the same day
-- (e.g. a morning and an evening time). The merchant is warned in the preview and customers see the times
-- distinctly. Reverses the "only once per offering" trigger from 20261013.
drop trigger offerings_slot_point_unique on offerings;
drop function check_slot_point_unique();
