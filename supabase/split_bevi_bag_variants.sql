-- Run once in the Supabase SQL editor.
--
-- The Bevi Bag Full Set is now two products in the inbound forms — Black and
-- Beige — because they are ordered and produced separately. Rows booked before
-- that split carry the old 'bevi-bag' id, which no longer appears in the product
-- list, so they would show a raw key instead of a name.
--
-- Both tables need it: inbound_shipment_items carries the same product id, and a
-- shipment allocation pointing at a product the production list no longer knows
-- would have its freight land in "Unallocated freight" in the cost summary.
--
-- Re-running this is a no-op — after the first pass there is nothing left to
-- match.

UPDATE inbound_items
   SET product_id = 'bevi-bag-black'
 WHERE product_id = 'bevi-bag';

UPDATE inbound_shipment_items
   SET product_id = 'bevi-bag-black'
 WHERE product_id = 'bevi-bag';
