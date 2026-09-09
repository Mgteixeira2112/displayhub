# DisplayHub — Arquitetura inicial

## Objetivo da Fase 0

Estabelecer uma fundação técnica mínima, publicável e verificável, sem implementar funcionalidades de negócio.

## Stack

- React + TypeScript
- Vite
- Supabase JS
- GitHub Actions
- GitHub Pages

## Fonte de verdade

O projeto Supabase `meqeluddtwthqmrtbhbr` é a única fonte de verdade operacional do DisplayHub.

O frontend utiliza somente a URL pública do projeto e uma publishable key. Chaves `service_role`/secret nunca podem ser enviadas ao navegador, commitadas ou incluídas em URLs.

## Persistência

Nesta fase nenhuma tabela, bucket, policy, trigger, função ou dado de negócio é criado.

`localStorage` não será usado para persistência operacional.

## Isolamento

DisplayHub é independente do NovoHotel. Não há compartilhamento de banco, autenticação, código em runtime, deploy ou dependências operacionais.

## Próximas fases

As estruturas de Auth, empresas, unidades, perfis e RLS serão introduzidas apenas na Fase 1, após homologação da Fase 0.
