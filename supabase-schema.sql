-- 班级管理系统 · Supabase 云端同步初始化脚本
-- 在 Supabase Dashboard -> SQL Editor 中整段粘贴并 Run 一次即可。
-- 默认管理员密码仍是 123；登录后在「设置」里修改。

create extension if not exists pgcrypto with schema extensions;

-- 1) 全班数据（一个固定行，payload 就是页面导出的那份 JSON）
create table if not exists public.class_state (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  rev bigint not null default 1,
  updated_at timestamptz not null default now()
);

insert into public.class_state (id, payload)
values ('main', '{}'::jsonb)
on conflict (id) do nothing;

-- 2) 管理员密码哈希（不对外暴露）
create table if not exists public.class_secret (
  id text primary key,
  pwd_hash text not null
);

insert into public.class_secret (id, pwd_hash)
values ('admin', crypt('123', gen_salt('bf')))
on conflict (id) do nothing;

-- 3) RLS：全班数据只读公开；写入只能走下面的函数
alter table public.class_state enable row level security;
alter table public.class_secret enable row level security;

drop policy if exists "class_state_read" on public.class_state;
create policy "class_state_read"
  on public.class_state
  for select
  to anon, authenticated
  using (true);

-- class_secret 不建任何 policy，匿名/登录用户都不能直接读写

revoke all on table public.class_secret from anon, authenticated;
grant select on table public.class_state to anon, authenticated;
revoke insert, update, delete on table public.class_state from anon, authenticated;

-- 4) 校验管理员密码
create or replace function public.check_admin(pwd text)
returns boolean
language sql
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1
    from public.class_secret
    where id = 'admin'
      and pwd_hash = crypt(pwd, pwd_hash)
  );
$$;

-- 5) 保存数据
--    role = admin：整份数据覆盖；只有确实改了请假/留言时才覆盖这两个数组
--    role = guest：只允许改 leaves / messages / issues，其余字段原样保留
create or replace function public.save_state(
  pwd text,
  role text,
  data jsonb,
  touch_guest boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  cur jsonb;
  merged jsonb;
  new_rev bigint;
  safe_role text := case when role = 'admin' then 'admin' else 'guest' end;
  leaves_val jsonb;
  messages_val jsonb;
  issues_val jsonb;
begin
  if data is null or jsonb_typeof(data) <> 'object' then
    raise exception 'data must be a json object';
  end if;

  select payload into cur
  from public.class_state
  where id = 'main'
  for update;

  if cur is null then
    cur := '{}'::jsonb;
  end if;

  if safe_role = 'admin' then
    if pwd is null or not public.check_admin(pwd) then
      raise exception 'invalid admin password';
    end if;

    merged := data - 'adminPassword';
    if jsonb_typeof(merged -> 'settings') = 'object' then
      merged := jsonb_set(merged, '{settings}', (merged -> 'settings') - 'adminPassword', true);
    end if;

    if not touch_guest then
      merged := merged
        || jsonb_build_object('leaves', coalesce(cur -> 'leaves', '[]'::jsonb))
        || jsonb_build_object('messages', coalesce(cur -> 'messages', '[]'::jsonb));
    end if;
  else
    if jsonb_typeof(data -> 'leaves') = 'array' then
      leaves_val := data -> 'leaves';
    else
      leaves_val := coalesce(cur -> 'leaves', '[]'::jsonb);
    end if;

    if jsonb_typeof(data -> 'messages') = 'array' then
      messages_val := data -> 'messages';
    else
      messages_val := coalesce(cur -> 'messages', '[]'::jsonb);
    end if;

    -- Issue 看板是共享待办：访客也可以新增和删除，因此直接采用客户端数组；
    -- 旧客户端没有 issues 字段时保留云端现状。
    if jsonb_typeof(data -> 'issues') = 'array' then
      issues_val := data -> 'issues';
    else
      issues_val := coalesce(cur -> 'issues', '[]'::jsonb);
    end if;

    merged := cur
      || jsonb_build_object('leaves', leaves_val)
      || jsonb_build_object('messages', messages_val)
      || jsonb_build_object('issues', issues_val);
  end if;

  update public.class_state
  set payload = merged,
      rev = rev + 1,
      updated_at = now()
  where id = 'main'
  returning rev into new_rev;

  return jsonb_build_object('rev', new_rev, 'payload', merged);
end;
$$;

-- 6) 修改管理员密码
create or replace function public.change_admin_pwd(old_pwd text, new_pwd text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if old_pwd is null or not public.check_admin(old_pwd) then
    raise exception 'invalid old password';
  end if;

  if new_pwd is null or length(new_pwd) < 1 or length(new_pwd) > 64 then
    raise exception 'new password must be 1-64 characters';
  end if;

  update public.class_secret
  set pwd_hash = crypt(new_pwd, gen_salt('bf'))
  where id = 'admin';

  return true;
end;
$$;

-- 7) 只允许匿名/登录用户调用这三个函数
revoke all on function public.check_admin(text) from public;
revoke all on function public.save_state(text, text, jsonb, boolean) from public;
revoke all on function public.change_admin_pwd(text, text) from public;

grant execute on function public.check_admin(text) to anon, authenticated;
grant execute on function public.save_state(text, text, jsonb, boolean) to anon, authenticated;
grant execute on function public.change_admin_pwd(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
