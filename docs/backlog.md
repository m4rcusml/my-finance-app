# Backlog pós-V1

Este documento evita que ideias futuras sejam anunciadas como capacidade atual. Nenhum item abaixo pertence ao aceite da V1 e nenhuma ordem implica compromisso de entrega.

## Dados de mercado

- integração com provedores de cotação;
- preços atuais e séries históricas;
- valorização, lucro/prejuízo e rentabilidade;
- eventos corporativos, dividendos e splits;
- cache distribuído e política de atualização.

Hoje `MarketAsset` é apenas catálogo manual e a carteira mostra custo de aquisição.

## Instituições e conectividade

- Open Finance;
- conectores diretos para bancos adicionais;
- Mercado Pago e BTG;
- Binance, Bipa, Coinbase e outras corretoras;
- sincronização automática e conciliação.

A V1 importa apenas arquivos nos layouts Inter e genérico.

## Automação financeira

- sugestão automática de categoria;
- regras criadas pelo usuário;
- aprendizado de máquina;
- detecção de anomalias;
- orçamento automático;
- projeções estatísticas além da média simples.

## Alertas e comunicação

- e-mail;
- push;
- alertas de vencimento, limite e meta;
- relatórios agendados;
- preferências de notificação.

A V1 mostra pendências dentro da aplicação, sem canal externo.

## Investimentos e planejamento

- otimizador de carteira;
- recomendações personalizadas;
- simulações;
- rebalanceamento;
- metas alimentadas automaticamente pelo ledger;
- múltiplas moedas e conversão cambial.

## Experiência e distribuição

- modo offline;
- aplicação instalável/PWA;
- sincronização entre dispositivos sem API própria;
- backup em nuvem;
- aplicativos móveis nativos;
- internacionalização além de pt-BR.

## Operação em escala

- manifesto específico para um provedor;
- alta disponibilidade;
- rate limit compartilhado;
- fila distribuída para jobs;
- observabilidade externa, tracing e alertas operacionais;
- estratégia automatizada de disaster recovery;
- testes de carga e capacidade.

A V1 fornece artefatos, healthchecks, CI e Docker local; escolher e publicar em infraestrutura externa é uma decisão separada.

## Critério de entrada

Antes de promover um item:

1. registrar problema e usuário afetado;
2. definir contrato e regra de dados;
3. decidir impacto em segurança e privacidade;
4. criar migration compatível, se necessária;
5. desenhar estados de loading, vazio e erro;
6. definir testes e critério de rollback;
7. atualizar esta fronteira de escopo e os documentos da V1.

Não implemente itens deste arquivo como efeito colateral de uma correção.
