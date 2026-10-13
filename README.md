# Observatório Internacional da Violência Política

Revista Timeline · Responsável editorial: Rogerio Pires

Site: https://rogeriotpires-spec.github.io/observatorio-violencia-politica/

## Edição pública de 13 de outubro de 2026

Mapa mundial interativo, acervo documental, 14 capítulos históricos, leitura interna das fichas e documentos, filtros e imagens conceituais identificadas como geradas por IA.

A pesquisa permanece em revisão documental. A publicação desta edição não equivale à validação integral das fichas. Os limites de cada fonte, as divergências e o estado da atribuição de autoria permanecem visíveis. Estatísticas históricas e agregados são separados dos registros individualizados.

O site é estático, com páginas independentes e navegação horizontal permanente. Em telas estreitas, a faixa de links pode ser deslizada lateralmente; não há menu hambúrguer. A página atual é indicada por cor, sublinhado e `aria-current`.

| Página | Conteúdo |
| --- | --- |
| `index.html` | Abertura / Bloco 1 |
| `mapa.html` | Mapa mundial e filtros geográficos |
| `casos.html` | Fichas, busca, filtros e exportação de recortes |
| `regimes.html` | Capítulos históricos, contextos e estimativas |
| `metodos.html` | Formas de violência e responsáveis citados |
| `documentos.html` | Banco de fontes, extratos e critérios da pesquisa |
| `pdf.html` | Dossiê completo e contadores de leitura |

Os arquivos em `assets/` incluem os estilos, scripts, dados, imagens e os quatro extratos documentais. As fichas, os capítulos e os documentos continuam abrindo dentro do Observatório. Os links antigos com `#caso`, `#capitulo`, `#mapa` e os demais destinos são encaminhados à página correspondente, preservando os parâmetros. O início e a página do PDF não carregam a base de registros nem a cartografia. Os recursos compartilhados usam identificadores de versão para atualização do cache.

Não há serviço externo de mapas ou JavaScript de terceiros. Os contadores consultam o serviço persistente da própria Timeline. GitHub Pages publica a raiz de `main`.

Verificação desta reorganização: 15 verificações de estrutura, navegação, filtros, mapa, leitores, links antigos, integridade da base, PDF e contadores. As requisições dos testes foram simuladas, sem alterar os totais públicos. Não foi executada inspeção visual em navegador real nesta edição.

Manutenção: atualizar as páginas específicas e os recursos compartilhados em `assets/`. Evitar substituir `index.html` por uma versão anterior que reúna todas as seções. Alterações em recursos compartilhados precisam atualizar seus identificadores `?v=` nos sete arquivos HTML.

## PDF e contadores

O dossiê completo está em `downloads/Dossie_Observatorio_Timeline.pdf`. O arquivo preserva o estado de revisão documental e inclui as três ilustrações aprovadas.

Os contadores consultam `https://timeline-guia-contadores.rogeriotpires.chatgpt.site/api/observatorio/metrics`, com totais exclusivos do Observatório. Visitas: sessões de 30 minutos desde o último carregamento; navegar entre as páginas não inicia outra sessão. Downloads: cliques no botão, não confirmação de conclusão; links diretos ao PDF não são medidos. Os registros usam identificadores aleatórios, sem nome, e-mail ou IP na aplicação. A contagem começa em 13/10/2026, sem estimativa retroativa. Falhas no contador não impedem o download e não são exibidas como zero. Testes usam um escopo separado dos totais públicos.
