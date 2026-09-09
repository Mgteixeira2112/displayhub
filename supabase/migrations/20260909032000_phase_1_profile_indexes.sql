create index profiles_company_id_idx
on public.profiles (company_id);

create index profiles_unit_company_idx
on public.profiles (unit_id, company_id)
where unit_id is not null;
