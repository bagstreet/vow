-- 017: the browser extension is a delivery channel (pull-based: it polls the outbox)
alter table channel_links drop constraint if exists channel_links_channel_check;
alter table channel_links add constraint channel_links_channel_check check (channel in ('telegram','slack','discord','web','push','extension'));
