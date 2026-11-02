begin;
create extension if not exists pgcrypto;
create table public.profiles(id uuid primary key references auth.users on delete cascade,email text not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.domains(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,hostname text not null check(hostname=lower(hostname)),verification_token text not null default encode(gen_random_bytes(32),'hex'),verified boolean not null default false,verified_at timestamptz,created_at timestamptz not null default now(),unique(user_id,hostname),unique(id,user_id));
create table public.scans(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,domain_id uuid,tool text not null check(tool in ('webshield','headerguard')),status text not null check(status in ('completed','failed')),score integer check(score between 0 and 100),grade text,findings jsonb not null default '[]',result jsonb not null,scoring_version text not null,started_at timestamptz not null,completed_at timestamptz not null,foreign key(domain_id,user_id) references public.domains(id,user_id) on delete cascade);
create table public.monitors(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,domain_id uuid not null,frequency text not null check(frequency in ('daily','weekly','monthly')),enabled boolean not null default true,last_run_at timestamptz,next_run_at timestamptz not null default now(),created_at timestamptz not null default now(),unique(domain_id),foreign key(domain_id,user_id) references public.domains(id,user_id) on delete cascade);
create table public.alerts(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,domain_id uuid not null references public.domains on delete cascade,scan_id uuid references public.scans on delete cascade,severity text not null,alert_type text not null,message text not null,deduplication_key text not null unique,sent_at timestamptz,delivery_attempts integer not null default 0,delivery_started_at timestamptz,delivery_claim uuid,delivery_error text,acknowledged_at timestamptz,created_at timestamptz not null default now());
create table public.notification_preferences(user_id uuid primary key references auth.users on delete cascade,email_enabled boolean not null default true,ssl_alerts boolean not null default true,header_alerts boolean not null default true,summary_enabled boolean not null default false,email_destination text);
create table public.scan_jobs(id uuid primary key default gen_random_uuid(),monitor_id uuid not null references public.monitors on delete cascade,status text not null default 'pending' check(status in ('pending','running','completed','failed')),attempts integer not null default 0,scheduled_for timestamptz not null,started_at timestamptz,finished_at timestamptz,error_message text,available_at timestamptz not null default now(),claim_token uuid,unique(monitor_id,scheduled_for));
create table public.rate_buckets(key text primary key,window_at timestamptz not null,hits integer not null);
create index scans_history on public.scans(user_id,completed_at desc);
create index scans_hostname_tool on public.scans(user_id,(result->>'hostname'),tool,completed_at desc);
create index scans_domain on public.scans(domain_id,tool,completed_at desc);
create index domains_owner on public.domains(user_id);
create index monitors_due on public.monitors(next_run_at) where enabled;
create index alerts_history on public.alerts(user_id,created_at desc);
create index jobs_pending on public.scan_jobs(status,scheduled_for);
create function public.new_user() returns trigger language plpgsql security definer set search_path=public as $$begin insert into profiles(id,email) values(new.id,new.email);insert into notification_preferences(user_id) values(new.id);return new;end$$;
create trigger new_user after insert on auth.users for each row execute function public.new_user();
create function public.guard_monitor() returns trigger language plpgsql set search_path=public as $$begin if new.enabled and not exists(select 1 from domains where id=new.domain_id and user_id=new.user_id and verified and verified_at>now()-interval '90 days') then raise exception 'DOMAIN_NOT_VERIFIED';end if;return new;end$$;
create trigger guard_monitor before insert or update on public.monitors for each row execute function public.guard_monitor();
-- All user writes that change verification, scans, schedules or alert delivery go through authorized server code.
do $$declare t text;begin foreach t in array array['profiles','domains','scans','monitors','alerts','notification_preferences'] loop execute format('alter table public.%I enable row level security',t);execute format('create policy owner_read on public.%I for select to authenticated using (%s = auth.uid())',t,case when t='profiles' then 'id' else 'user_id' end);end loop;end$$;
alter table public.scan_jobs enable row level security;
alter table public.rate_buckets enable row level security;
revoke all on public.profiles,public.domains,public.scans,public.monitors,public.alerts,public.notification_preferences,public.scan_jobs,public.rate_buckets from anon,authenticated;
grant select on public.profiles,public.domains,public.scans,public.monitors,public.alerts,public.notification_preferences to authenticated;
grant all on public.profiles,public.domains,public.scans,public.monitors,public.alerts,public.notification_preferences,public.scan_jobs,public.rate_buckets to service_role;
create function public.consume_rate(bucket_key text,bucket_limit integer) returns boolean language plpgsql security definer set search_path=public as $$declare n integer;begin
insert into rate_buckets(key,window_at,hits) values(bucket_key,date_trunc('minute',now()),1) on conflict(key) do update set hits=case when rate_buckets.window_at<date_trunc('minute',now()) then 1 else rate_buckets.hits+1 end,window_at=date_trunc('minute',now()) returning hits into n;return n<=bucket_limit;end$$;
create function public.claim_job() returns setof public.scan_jobs language plpgsql security definer set search_path=public as $$begin
-- Expired leases are retryable; exhausted attempts remain recorded.
update scan_jobs set status=case when attempts>=3 then 'failed' else 'pending' end,error_message='Lease expired' where status='running' and started_at<now()-interval '5 minutes';
insert into scan_jobs(monitor_id,scheduled_for) select m.id,m.next_run_at from monitors m join domains d on d.id=m.domain_id where m.enabled and m.next_run_at<=now() and d.verified and d.verified_at>now()-interval '90 days' order by m.next_run_at,m.id limit 100 on conflict do nothing;
return query with candidate as (select j.id from scan_jobs j join monitors m on m.id=j.monitor_id join domains d on d.id=m.domain_id where j.status='pending' and j.available_at<=now() and j.attempts<3 and m.enabled and d.verified and d.verified_at>now()-interval '90 days' order by j.scheduled_for for update of j skip locked limit 1) update scan_jobs j set status='running',attempts=j.attempts+1,started_at=now(),claim_token=gen_random_uuid() from candidate c where j.id=c.id returning j.*;
end$$;
create function public.finish_job(job_id uuid,lease uuid,next_time timestamptz,failure text default null) returns boolean language plpgsql security definer set search_path=public as $$declare mid uuid;begin
select monitor_id into mid from scan_jobs where id=job_id and claim_token=lease and status='running' for update;if mid is null then return false;end if;
update scan_jobs set status=case when failure is null then 'completed' when attempts<3 then 'pending' else 'failed' end,error_message=failure,finished_at=now(),available_at=now()+interval '15 minutes' where id=job_id;
if failure is null or exists(select 1 from scan_jobs where id=job_id and attempts>=3) then update monitors set last_run_at=now(),next_run_at=next_time where id=mid;end if;return true;end$$;
create function public.enroll_monitor(owner_id uuid,owned_domain uuid,schedule text) returns uuid language plpgsql security definer set search_path=public as $$declare result uuid;begin
perform pg_advisory_xact_lock(hashtextextended('irongate-monitor-capacity',0));if (select count(*) from monitors)>=10 or (select count(*) from monitors where user_id=owner_id)>=10 then raise exception 'LIMIT_REACHED';end if;insert into monitors(user_id,domain_id,frequency) values(owner_id,owned_domain,schedule) returning id into result;return result;end$$;
create function public.add_domain(owner_id uuid,host text) returns setof public.domains language plpgsql security definer set search_path=public as $$begin perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));if(select count(*) from domains where user_id=owner_id)>=20 then raise exception 'LIMIT_REACHED';end if;return query insert into domains(user_id,hostname) values(owner_id,host) returning *;end$$;
revoke all on function public.consume_rate(text,integer),public.claim_job(),public.finish_job(uuid,uuid,timestamptz,text),public.enroll_monitor(uuid,uuid,text),public.add_domain(uuid,text),public.new_user(),public.guard_monitor() from public,anon,authenticated;
grant execute on function public.consume_rate(text,integer),public.claim_job(),public.finish_job(uuid,uuid,timestamptz,text),public.enroll_monitor(uuid,uuid,text),public.add_domain(uuid,text) to service_role;
create table public.scan_leases(id uuid primary key default gen_random_uuid(),expires_at timestamptz not null default now()+interval '45 seconds');
alter table public.scan_leases enable row level security;
revoke all on public.scan_leases from anon,authenticated;
grant all on public.scan_leases to service_role;
create function public.acquire_scan_slot() returns uuid language plpgsql security definer set search_path=public as $$declare token uuid;begin
perform pg_advisory_xact_lock(hashtextextended('irongate-global-scan-slots',0));delete from scan_leases where expires_at<now();if(select count(*) from scan_leases)>=8 then return null;end if;insert into scan_leases default values returning id into token;return token;end$$;
revoke all on function public.acquire_scan_slot() from public,anon,authenticated;
grant execute on function public.acquire_scan_slot() to service_role;
create function public.claim_alert() returns setof public.alerts language plpgsql security definer set search_path=public as $$begin
return query with candidate as(select al.id from alerts al join notification_preferences p on p.user_id=al.user_id where al.sent_at is null and al.delivery_attempts<3 and al.created_at>now()-interval '7 days' and (al.delivery_started_at is null or al.delivery_started_at<now()-interval '15 minutes') and p.email_enabled and (p.ssl_alerts or not (al.alert_type like 'certificate%' or al.alert_type='https_unavailable')) and (p.header_alerts or al.alert_type not like 'header%') order by al.created_at,al.id for update of al skip locked limit 1)
update alerts al set delivery_attempts=al.delivery_attempts+1,delivery_started_at=now(),delivery_claim=gen_random_uuid(),delivery_error=null from candidate c where al.id=c.id returning al.*;
end$$;
revoke all on function public.claim_alert() from public,anon,authenticated;
grant execute on function public.claim_alert() to service_role;
commit;
