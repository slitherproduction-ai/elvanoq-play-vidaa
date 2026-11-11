-- ELVANOQ Play VIDAA: aceita a plataforma 'vidaa' nas TVs web (código VD-).
alter table public.portal_webos_devices drop constraint portal_webos_devices_platform_check;
alter table public.portal_webos_devices add constraint portal_webos_devices_platform_check
  check (platform = any (array['webos','samsung-msx','ios-msx','titan','vidaa']));

create or replace function public.portal_webos_device_register(p_lgudid_hash text, p_key_hash text, p_app_version text, p_platform text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare result jsonb; existing text; desired text;
begin
 desired := case when p_platform in ('samsung-msx','ios-msx','vidaa') then p_platform else 'webos' end;
 select platform into existing from public.portal_webos_devices where lgudid_hash=p_lgudid_hash for update;
 if existing is not null and existing<>desired and (existing in ('ios-msx','vidaa') or desired in ('ios-msx','vidaa')) then raise exception 'DEVICE_BINDING_REQUIRED'; end if;
 select public.portal_webos_device_register(p_lgudid_hash,p_key_hash,p_app_version) into result;
 update public.portal_webos_devices set platform=desired where lgudid_hash=p_lgudid_hash;
 if desired='ios-msx' then update public.portal_managed_devices set platform='ios-msx',display_name=case when display_name='LG webOS TV' then 'iPhone / iPad (MSX)' else display_name end where id=(result->>'device_id')::uuid; end if;
 if desired='vidaa' then update public.portal_managed_devices set platform='vidaa',display_name=case when display_name='LG webOS TV' then 'TV VIDAA' else display_name end where id=(result->>'device_id')::uuid; end if;
 return result;
end $function$;
