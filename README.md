# Captura do ambiente Piremaxx

Data da inspeção: 23/09/2026

O ambiente acessível em `https://piremaxx.umov.me/CenterWeb/` é um sistema hospedado uMov.me (versão visível 7.4.0). Esta captura contém o inventário das telas observadas e os recursos estáticos exportáveis pelo navegador. Ela não contém o servidor, banco de dados ou código privado do fornecedor.

## Áreas observadas

- Vendedores — `/CenterWeb/agent` — listagem, pesquisa, filtro avançado e inclusão.
- Equipes — `/CenterWeb/team` — listagem, edição, visualização e hierarquia.
- Clientes — `/CenterWeb/serviceLocal` — cadastro/listagem, pesquisa e filtros.
- Rotas — `/CenterWeb/itinerary` — listagem (nenhum resultado visível durante a inspeção) e inclusão.
- Itens — `/CenterWeb/item` — listagem por descrição, código, subgrupo e edição.
- Outros Cadastros — `/CenterWeb/customEntity` — cadastros personalizados e registros.
- Visitas — `/CenterWeb/schedule` — visitas de hoje, abertas e atrasadas; filtros por ativo, vendedor, cliente, códigos e datas.
- Ausências Programadas — `/CenterWeb/scheduledAbsence` — listagem, pesquisa e filtros.
- Gráficos — `/CenterWeb/graphic` — gráficos configurados, com áreas incorporadas em iframe.
- Mapas — `/CenterWeb/map` — mapas configurados (foram observados “mapa 1” e “mapa2”), com áreas incorporadas em iframe.
- Painel de Gestão — `/CenterWeb/managementPanel` — painel incorporado em iframe com autenticação própria.
- Book de Fotos — `/CenterWeb/ureport` — conteúdo incorporado em iframe.
- Mensagens — `/CenterWeb/message` — listagem de remetente, descrição, data/hora e visualização.

## Observação

As rotas de inclusão (`/add`) e edição/visualização foram identificadas nos links da interface, mas não foram submetidas nem alteradas. Dados operacionais exibidos nas tabelas não foram exportados em massa.

## Sistema independente

O diretório raiz também contém uma implementação independente do Piremaxx (`index.html`, `styles.css` e `app.js`). Ela não importa, altera ou depende do AdorarPro nem do servidor uMov.me. Abra `index.html` no navegador para usar o MVP.

Os registros são mantidos no armazenamento local do navegador. Em **Backup e restauração**, use **Exportar backup JSON** para salvar uma cópia e **Restaurar JSON** para carregar um arquivo anteriormente exportado.

O sistema local agora possui tela de login própria, com o mesmo conceito visual do ambiente examinado, e menu lateral completo: Vendedores, Equipes, Clientes, Rotas, Itens, Outros Cadastros, Visitas, Ausências Programadas, Gráficos, Mapas, Painel de Gestão, Book de Fotos, Mensagens e Backup/Restauração. A sessão é local ao navegador e pode ser encerrada pelo item **Sair**.
