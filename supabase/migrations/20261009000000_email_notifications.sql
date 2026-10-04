-- NOTIF-1: email notifications (outbox + producers). See docs/plans/notif-1-email-notifications.md.
-- Rows are queued here by triggers/functions; the app's sender route (service role) claims them, renders the
-- email in the recipient's language and sends it. Nothing here is readable or writable by signed-in users.

-- A per-user switch (shown on the Account page); every email also carries an unsubscribe link.
alter table profiles add column email_notifications boolean not null default true;

create table notification_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  type text not null check (type in ('order_confirmed', 'pickup_reminder', 'merchant_cutoff_summary')),
  entity_id uuid not null, -- the order (customer emails) or the offering (merchant summary); content is read at send time
  due_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'skipped', 'failed')),
  attempts integer not null default 0,
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (type, entity_id, user_id) -- a notification is never queued twice
);
create index notification_outbox_due_idx on notification_outbox (status, due_at);

alter table notification_outbox enable row level security; -- deliberately no policies
revoke all on notification_outbox from anon, authenticated;

-- ───────────────────────── producers ─────────────────────────
-- Order confirmation: queued the moment an order is created (web or any future client).
create function enqueue_order_confirmation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notification_outbox (user_id, type, entity_id) values (new.customer_id, 'order_confirmed', new.id)
  on conflict do nothing;
  return new;
end;
$$;
create trigger orders_enqueue_confirmation after insert on orders
  for each row execute function enqueue_order_confirmation();

-- Time-based producers; the sender calls this at the start of every run. Idempotent.
create function enqueue_due_notifications() returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Pickup reminder: the pickup starts within the next 3 hours. Orders placed inside that window are skipped
  -- (the confirmation just went out).
  insert into notification_outbox (user_id, type, entity_id)
  select o.customer_id, 'pickup_reminder', o.id
  from orders o
  join offerings f on f.id = o.offering_id
  join pickup_points p on p.id = f.pickup_point_id
  cross join lateral (select ((f.pickup_date + f.pickup_start) at time zone p.timezone) as starts_at) s
  where o.status = 'placed'
    and f.status in ('published', 'closed')
    and s.starts_at > now() and s.starts_at <= now() + interval '3 hours'
    and o.created_at < s.starts_at - interval '3 hours'
  on conflict do nothing;

  -- Merchant summary: ordering closed within the last 2 days (no backfill of history) and there is an active order.
  insert into notification_outbox (user_id, type, entity_id)
  select m.owner_id, 'merchant_cutoff_summary', f.id
  from offerings f
  join merchants m on m.id = f.merchant_id
  where f.status in ('published', 'closed')
    and f.cutoff_at <= now() and f.cutoff_at > now() - interval '2 days'
    and exists (select 1 from orders o where o.offering_id = f.id and o.status = 'placed')
  on conflict do nothing;
end;
$$;

-- ───────────────────────── sender support ─────────────────────────
-- Hands out due rows to ONE sender at a time (skip locked), counts the attempt, and re-offers rows whose sender
-- crashed (stuck in 'sending' for more than 10 minutes, up to 5 attempts).
create function claim_notifications(p_limit integer default 20) returns setof notification_outbox
language sql security definer set search_path = public as $$
  update notification_outbox n
     set status = 'sending', attempts = n.attempts + 1, claimed_at = now()
   where n.id in (
     select id from notification_outbox
      where (status = 'pending' and due_at <= now())
         or (status = 'sending' and claimed_at < now() - interval '10 minutes' and attempts < 5)
      order by due_at, created_at
      limit p_limit
      for update skip locked
   )
  returning n.*;
$$;

revoke all on function enqueue_due_notifications(), claim_notifications(integer) from public, anon, authenticated;
grant execute on function enqueue_due_notifications(), claim_notifications(integer) to service_role;
